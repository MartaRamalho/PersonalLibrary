import { Router } from "express";
import { db, BookRow } from "../db.js";
import { syncReadingYear } from "../bookStatus.js";
import { isValidShelf, DEFAULT_SHELF } from "../shelves.js";

export const importRouter = Router();

// ---- CSV parsing ---------------------------------------------------------

// A small, correct CSV parser (state machine). Handles quoted fields,
// escaped quotes (""), commas and newlines inside quotes, and CRLF/LF.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

function toRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => (rec[h] = cells[i] ?? ""));
    return rec;
  });
}

// ---- field mapping helpers ----------------------------------------------

function cleanIsbn(v: string): string {
  return (v ?? "").replace(/^=/, "").replace(/"/g, "").trim();
}

function yearFromDate(v: string): number | null {
  const m = (v ?? "").match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// Map a Goodreads "Exclusive Shelf" to one of our shelf keys.
function shelfFromGoodreads(shelf: string): string {
  const s = (shelf || "").trim().toLowerCase();
  if (s === "read") return "read";
  if (s === "currently-reading" || s === "reading") return "reading";
  if (s === "to-read") return "to-read";
  if (s === "on-hold") return "on-hold";
  if (
    s === "dropped" ||
    s === "did-not-finish" ||
    s === "dnf" ||
    s === "abandoned"
  )
    return "dropped";
  return isValidShelf(s) ? s : DEFAULT_SHELF;
}

// ---- import endpoint -----------------------------------------------------

interface ImportSummary {
  total_rows: number;
  books_created: number;
  books_matched: number;
  reading_log_added: number;
  by_shelf: Record<string, number>;
}

importRouter.post("/goodreads", (req, res) => {
  const csv: string = req.body?.csv ?? "";
  if (!csv || typeof csv !== "string") {
    res
      .status(400)
      .json({ error: 'Provide the CSV contents in a "csv" string field.' });
    return;
  }

  let records: Record<string, string>[];
  try {
    records = toRecords(csv);
  } catch {
    res.status(400).json({ error: "Could not parse the CSV file." });
    return;
  }
  if (records.length === 0 || !("Title" in records[0])) {
    res.status(400).json({
      error:
        "This does not look like a Goodreads export (missing Title column).",
    });
    return;
  }

  const summary: ImportSummary = {
    total_rows: records.length,
    books_created: 0,
    books_matched: 0,
    reading_log_added: 0,
    by_shelf: {},
  };

  const findByOlKey = db.prepare("SELECT * FROM books WHERE ol_key = ?");
  const findByIsbn = db.prepare(
    "SELECT * FROM books WHERE isbn = ? AND isbn <> ''",
  );
  const findByTitle = db.prepare(
    "SELECT * FROM books WHERE lower(title) = lower(?)",
  );
  const findById = db.prepare("SELECT * FROM books WHERE id = ?");
  const insertBook = db.prepare(
    `INSERT INTO books
       (ol_key, title, authors, cover_url, first_publish_year, page_count, subjects, description, isbn,
        owned_physical, owned_digital, status, start_date, finish_date, rating, review)
     VALUES (@ol_key, @title, @authors, @cover_url, @first_publish_year, @page_count, @subjects, @description, @isbn,
        @owned_physical, @owned_digital, @status, @start_date, @finish_date, @rating, @review)`,
  );

  const titleAuthorSeen = new Map<string, number>();

  const run = db.transaction(() => {
    for (const rec of records) {
      const title = (rec["Title"] ?? "").trim();
      if (!title) continue;

      const gid = (rec["Book Id"] ?? "").trim();
      const olKey = gid
        ? `goodreads:${gid}`
        : `goodreads:${normalizeTitle(title)}`;
      const authors = [
        rec["Author"],
        ...(rec["Additional Authors"] ?? "").split(","),
      ]
        .map((a) => a.trim())
        .filter(Boolean);
      const isbn = cleanIsbn(rec["ISBN13"]) || cleanIsbn(rec["ISBN"]);
      const pagesRaw = Number(rec["Number of Pages"]);
      const pageCount =
        Number.isFinite(pagesRaw) && pagesRaw > 0 ? pagesRaw : null;
      const pubYear =
        yearFromDate(rec["Original Publication Year"]) ??
        yearFromDate(rec["Year Published"]);
      const ownedPhysical = Number(rec["Owned Copies"]) > 0;
      const coverUrl = isbn
        ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`
        : null;

      const status = shelfFromGoodreads(rec["Exclusive Shelf"]);
      const ratingNum = Math.round(Number(rec["My Rating"]) * 2) / 2;
      const rating = ratingNum > 0 ? ratingNum : null;
      const review = (rec["My Review"] ?? "").trim() || null;

      // Dates from the shelf.
      const readYear =
        yearFromDate(rec["Date Read"]) ?? yearFromDate(rec["Date Added"]);
      let finishDate: string | null = null;
      let startDate: string | null = null;
      if (status === "read") {
        finishDate =
          (rec["Date Read"] || "").replace(/\//g, "-") ||
          (readYear ? `${readYear}-01-01` : null);
      } else if (status === "reading") {
        startDate = (rec["Date Added"] || "").replace(/\//g, "-") || null;
      }

      // ---- dedupe or create ----
      let book = findByOlKey.get(olKey) as BookRow | undefined;
      if (!book && isbn) book = findByIsbn.get(isbn) as BookRow | undefined;
      const taKey = `${normalizeTitle(title)}|${(authors[0] ?? "").toLowerCase()}`;
      if (!book && titleAuthorSeen.has(taKey)) {
        book = findById.get(titleAuthorSeen.get(taKey)!) as BookRow | undefined;
      }
      if (!book) {
        const firstAuthor = (authors[0] ?? "").toLowerCase();
        const candidates = findByTitle.all(title) as BookRow[];
        book = candidates.find(
          (c) =>
            (
              (JSON.parse(c.authors || "[]") as string[])[0] ?? ""
            ).toLowerCase() === firstAuthor,
        );
      }

      let bookId: number;
      if (book) {
        bookId = book.id;
        summary.books_matched++;
        // Fill in useful fields without clobbering user edits.
        db.prepare(
          `UPDATE books SET
             status = ?,
             owned_physical = MAX(owned_physical, ?),
             rating = COALESCE(rating, ?),
             review = COALESCE(review, ?),
             finish_date = COALESCE(finish_date, ?),
             start_date = COALESCE(start_date, ?)
           WHERE id = ?`,
        ).run(
          status,
          ownedPhysical ? 1 : 0,
          rating,
          review,
          finishDate,
          startDate,
          bookId,
        );
      } else {
        const info = insertBook.run({
          ol_key: olKey,
          title,
          authors: JSON.stringify(authors),
          cover_url: coverUrl,
          first_publish_year: pubYear,
          page_count: pageCount,
          subjects: "[]",
          description: null,
          isbn,
          owned_physical: ownedPhysical ? 1 : 0,
          owned_digital: 0,
          status,
          start_date: startDate,
          finish_date: finishDate,
          rating,
          review,
        });
        bookId = Number(info.lastInsertRowid);
        summary.books_created++;
      }
      titleAuthorSeen.set(taKey, bookId);
      summary.by_shelf[status] = (summary.by_shelf[status] ?? 0) + 1;

      // Auto-add finished books to their reading year.
      if (status === "read") {
        const before = db
          .prepare("SELECT COUNT(*) AS c FROM reading_log WHERE book_id = ?")
          .get(bookId) as { c: number };
        syncReadingYear(bookId);
        const after = db
          .prepare("SELECT COUNT(*) AS c FROM reading_log WHERE book_id = ?")
          .get(bookId) as { c: number };
        if (after.c > before.c) summary.reading_log_added++;
      }
    }
  });

  try {
    run();
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Import failed while writing to the database." });
    return;
  }

  const total = (
    db.prepare("SELECT COUNT(*) AS c FROM books").get() as { c: number }
  ).c;
  res.json({ summary, library_total: total });
});

export { toRecords, cleanIsbn };
