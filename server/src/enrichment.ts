import { randomUUID } from "node:crypto";
import { db, BookRow } from "./db.js";
import {
  searchBooks,
  fetchWorkDescription,
  NormalizedBook,
} from "./openlibrary.js";
import { fetchDescription } from "./googlebooks.js";
import { UNSHELVED_STATUS } from "./shelves.js";
import { removeCover } from "./covers.js";

// Background enrichment of imported books: match each book to an Open Library
// work and pull real metadata (cover, subjects, ratings, publisher, page count,
// a proper /works/ id) + a description, while preserving the user's personal
// fields (rating, review, status, dates, ownership, custom cover).

export interface JobState {
  total: number;
  enriched: number;
  done: boolean;
}

const jobs = new Map<string, JobState>();
const CONCURRENCY = 5;

export const getJob = (jobId: string): JobState | undefined => jobs.get(jobId);

// Strip Goodreads/edition noise from a title so it searches + compares cleanly.
// e.g. "La novia gitana (Elena Blanco, #1)" -> "La novia gitana".
const cleanTitle = (raw: string): string =>
  raw
    .replace(/\s*\([^()]*#\d+[^()]*\)/g, " ") // (Series, #1)
    .replace(/\s*\[[^\]]*\]/g, " ") // [ ... ]
    .replace(
      /\s*\([^()]*\b(?:edition|edición|illustrated|unabridged|abridged|omnibus|box(?:ed)? set|anniversary|reprint|deluxe)\b[^()]*\)/gi,
      " ",
    )
    .replace(/\s{2,}/g, " ")
    .replace(/[\s:–—-]+$/, "")
    .trim();

// Lowercase, strip diacritics, reduce to alphanumeric tokens (accent-insensitive).
const foldNorm = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (s: string): string[] => foldNorm(s).split(" ").filter(Boolean);

const isSubset = (a: string[], b: string[]): boolean => {
  const set = new Set(b);
  return a.length > 0 && a.every((t) => set.has(t));
};

// Title similarity in [0,1]: 1 = same, 0.9 = one contains the other, else Dice.
const titleScore = (docTitle: string, queryTitle: string): number => {
  const a = tokens(queryTitle);
  const b = tokens(docTitle);
  if (a.length === 0 || b.length === 0) return 0;
  if (foldNorm(docTitle) === foldNorm(queryTitle)) return 1;
  if (isSubset(a, b) || isSubset(b, a)) return 0.9;
  const setB = new Set(b);
  const overlap = a.filter((t) => setB.has(t)).length;
  return (2 * overlap) / (a.length + b.length);
};

const authorOverlaps = (docAuthors: string[], firstAuthor: string): boolean => {
  const a = foldNorm(firstAuthor);
  if (!a) return true; // nothing to check against
  return (
    docAuthors.length === 0 ||
    docAuthors.some((x) => {
      const d = foldNorm(x);
      return d.includes(a) || a.includes(d);
    })
  );
};

// Accept a candidate: a strong title match stands alone (handles pseudonyms /
// translations); a weaker one needs the author to corroborate. Single-word
// titles must match exactly to avoid over-eager matches.
const acceptScore = (
  score: number,
  cleanedTitle: string,
  doc: NormalizedBook,
  firstAuthor: string,
): boolean => {
  if (tokens(cleanedTitle).length <= 1) return score >= 1;
  if (score >= 0.85) return true;
  return score >= 0.6 && authorOverlaps(doc.authors, firstAuthor);
};

// Thresholds for canonical/cross-language selection (see pick()).
const MIN_TITLE_TRUST = 10; // a title match this popular is trusted outright
const MIN_CANON = 30; // a cross-language canonical work must be at least this rated
const CANON_TOP_N = 3; // ...and appear this high in OL's relevance ranking

// Highest-scoring candidate that passes the title acceptance guard (or null).
const bestTitle = (
  docs: NormalizedBook[],
  cleanedTitle: string,
  firstAuthor: string,
): NormalizedBook | null => {
  let best: NormalizedBook | null = null;
  let bestScore = 0;
  for (const doc of docs) {
    const score = titleScore(doc.title, cleanedTitle);
    if (score > bestScore && acceptScore(score, cleanedTitle, doc, firstAuthor)) {
      best = doc;
      bestScore = score;
    }
  }
  return best;
};

// The most-rated near-top result that has an English edition — used to pick the
// canonical work when it's indexed under a non-English (original) title, so its
// own title doesn't match the CSV's English one (e.g. "No Longer Human" -> 人間失格).
const bestCanonical = (docs: NormalizedBook[]): NormalizedBook | null => {
  let best: NormalizedBook | null = null;
  docs.slice(0, CANON_TOP_N).forEach((doc) => {
    const rc = doc.ratings_count ?? 0;
    if (
      doc.language.includes("eng") &&
      rc >= MIN_CANON &&
      rc > (best?.ratings_count ?? 0)
    ) {
      best = doc;
    }
  });
  return best;
};

// Choose a match from a result set: trust a reasonably popular title match, but
// if the best title match is obscure and a clearly-canonical English-edition work
// out-rates it, prefer that (fixes original-language-titled works).
const pick = (
  docs: NormalizedBook[],
  cleanedTitle: string,
  firstAuthor: string,
): NormalizedBook | null => {
  const titleBest = bestTitle(docs, cleanedTitle, firstAuthor);
  const canonicalBest = bestCanonical(docs);
  if (titleBest && (titleBest.ratings_count ?? 0) >= MIN_TITLE_TRUST) {
    return titleBest;
  }
  if (titleBest) {
    if (
      canonicalBest &&
      (canonicalBest.ratings_count ?? 0) > (titleBest.ratings_count ?? 0)
    ) {
      return canonicalBest;
    }
    return titleBest;
  }
  return canonicalBest;
};

// Find the best Open Library match for a book, preferring an ISBN lookup, then
// fuzzy title(+author) matching on a cleaned title.
const findMatch = async (
  cleanedTitle: string,
  firstAuthor: string,
  isbn: string | null,
): Promise<NormalizedBook | null> => {
  if (isbn) {
    try {
      const byIsbn = await searchBooks(isbn, 3);
      if (byIsbn[0]) return byIsbn[0]; // ISBN search is precise — trust the top hit
    } catch {
      /* fall through to title/author */
    }
  }
  try {
    const withAuthor = firstAuthor
      ? await searchBooks(`${cleanedTitle} ${firstAuthor}`, 5)
      : [];
    const hit = pick(withAuthor, cleanedTitle, firstAuthor);
    if (hit) return hit;

    const byTitle = await searchBooks(cleanedTitle, 5);
    return pick(byTitle, cleanedTitle, firstAuthor);
  } catch {
    return null;
  }
};

const resolveDescription = async (
  match: NormalizedBook,
  title: string,
  firstAuthor: string,
  isbn: string | null,
): Promise<string | null> => {
  const desc = await fetchDescription({ isbn, title, author: firstAuthor });
  if (desc) return desc;
  if (match.ol_key.startsWith("/works/"))
    return fetchWorkDescription(match.ol_key);
  return null;
};

// Enrich a single book row in place. Metadata fields take the API value when
// present; personal fields are never touched.
const enrichBook = async (id: number): Promise<void> => {
  const row = db.prepare("SELECT * FROM books WHERE id = ?").get(id) as
    | BookRow
    | undefined;
  if (!row) return;

  const authors = JSON.parse(row.authors || "[]") as string[];
  const firstAuthor = authors[0] ?? "";
  const cleaned = cleanTitle(row.title);
  const match = await findMatch(cleaned, firstAuthor, row.isbn);
  if (!match) return; // best-effort: keep the CSV data

  const description = await resolveDescription(
    match,
    cleaned,
    firstAuthor,
    row.isbn,
  );

  // Adopt the real /works/ key. If another row already holds it, that row is the
  // same book: when it's an auto-saved "seen" duplicate, merge it away so this
  // shelved book becomes canonical. If the other row is itself shelved, leave
  // both untouched (don't risk destroying curated data) and keep the old key.
  let olKey = row.ol_key;
  if (match.ol_key.startsWith("/works/")) {
    const other = db
      .prepare("SELECT * FROM books WHERE ol_key = ? AND id <> ?")
      .get(match.ol_key, id) as BookRow | undefined;
    if (!other) {
      olKey = match.ol_key;
    } else if (other.status === UNSHELVED_STATUS) {
      removeCover(other.id); // drop the stray's stored cover file, if any
      db.prepare("DELETE FROM books WHERE id = ?").run(other.id);
      olKey = match.ol_key;
    }
  }

  db.prepare(
    `UPDATE books SET
       ol_key = @ol_key,
       cover_url = COALESCE(@cover_url, cover_url),
       publisher = COALESCE(@publisher, publisher),
       first_publish_year = COALESCE(@first_publish_year, first_publish_year),
       page_count = COALESCE(@page_count, page_count),
       subjects = @subjects,
       ratings_average = COALESCE(@ratings_average, ratings_average),
       ratings_count = COALESCE(@ratings_count, ratings_count),
       description = COALESCE(@description, description)
     WHERE id = @id`,
  ).run({
    id,
    ol_key: olKey,
    cover_url: match.cover_url,
    publisher: match.publisher,
    first_publish_year: match.first_publish_year,
    page_count: match.page_count,
    // Only overwrite subjects when the API actually returned some.
    subjects: match.subjects.length
      ? JSON.stringify(match.subjects)
      : row.subjects,
    ratings_average: match.ratings_average,
    ratings_count: match.ratings_count,
    description,
  });
};

// Run enrichment across ids with a bounded worker pool. Per-book failures are
// swallowed so one bad row never stalls the job.
const runJob = async (jobId: string, ids: number[]): Promise<void> => {
  const state = jobs.get(jobId)!;
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        await enrichBook(id);
      } catch {
        /* best-effort */
      }
      state.enriched++;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker),
  );
  state.done = true;
};

// Start a fire-and-forget enrichment job; returns the job id to poll.
export const startEnrichmentJob = (ids: number[]): string => {
  const jobId = randomUUID();
  jobs.set(jobId, { total: ids.length, enriched: 0, done: ids.length === 0 });
  if (ids.length > 0) {
    void runJob(jobId, ids);
  }
  return jobId;
};
