// Open Library is the search source (and provides community ratings + genre
// subjects). Docs: https://openlibrary.org/dev/docs/api/search

const UA = { "User-Agent": "PersonalLibraryApp/0.1" };

export interface NormalizedBook {
  ol_key: string; // '/works/OL…W'
  title: string;
  authors: string[];
  cover_url: string | null;
  publisher: string | null;
  first_publish_year: number | null;
  page_count: number | null;
  subjects: string[];
  isbn: string | null;
  ratings_average: number | null;
  ratings_count: number | null;
  language: string[]; // MARC codes across editions, e.g. ["eng","jpn"]
}

interface OLSearchDoc {
  key: string; // e.g. "/works/OL45804W"
  title?: string;
  author_name?: string[];
  cover_i?: number;
  publisher?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
  isbn?: string[];
  ratings_average?: number;
  ratings_count?: number;
  language?: string[];
}

interface OLSearchResponse {
  docs?: OLSearchDoc[];
}

const SEARCH_URL = "https://openlibrary.org/search.json";
const FIELDS = [
  "key",
  "title",
  "author_name",
  "cover_i",
  "publisher",
  "first_publish_year",
  "number_of_pages_median",
  "subject",
  "isbn",
  "ratings_average",
  "ratings_count",
  "language",
].join(",");

function coverUrl(coverId?: number, isbn?: string | null): string | null {
  if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
  if (isbn) return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
  return null;
}

function normalizeDoc(doc: OLSearchDoc): NormalizedBook {
  const isbn = doc.isbn?.[0] ?? null;
  return {
    ol_key: doc.key,
    title: doc.title ?? "Untitled",
    authors: doc.author_name ?? [],
    cover_url: coverUrl(doc.cover_i, isbn),
    publisher: doc.publisher?.[0] ?? null,
    first_publish_year: doc.first_publish_year ?? null,
    page_count: doc.number_of_pages_median ?? null,
    subjects: (doc.subject ?? []).slice(0, 25),
    isbn,
    ratings_average:
      typeof doc.ratings_average === "number"
        ? Math.round(doc.ratings_average * 10) / 10
        : null,
    ratings_count:
      typeof doc.ratings_count === "number" ? doc.ratings_count : null,
    language: doc.language ?? [],
  };
}

export async function searchBooks(
  query: string,
  limit = 20,
): Promise<NormalizedBook[]> {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&fields=${FIELDS}&limit=${limit}&mode=everything`;
  const res = await fetch(url, { headers: UA });
  if (!res.ok) {
    throw new Error(`Open Library search failed: ${res.status}`);
  }
  const data = (await res.json()) as OLSearchResponse;
  return (data.docs ?? []).map(normalizeDoc);
}

// Fetch a work description for a '/works/OL…W' key (fallback description source).
export async function fetchWorkDescription(
  olKey: string,
): Promise<string | null> {
  try {
    const res = await fetch(`https://openlibrary.org${olKey}.json`, {
      headers: UA,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      description?: string | { value: string };
    };
    if (!data.description) return null;
    return typeof data.description === "string"
      ? data.description
      : data.description.value;
  } catch {
    return null;
  }
}
