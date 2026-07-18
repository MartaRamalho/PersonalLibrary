import { Router } from "express";
import { db, serializeBook, BookRow } from "../db.js";
import { DEFAULT_SHELF, isValidShelf } from "../shelves.js";
import { applyStatus, syncReadingYear } from "../bookStatus.js";
import { fetchDescription } from "../googlebooks.js";
import { fetchWorkDescription } from "../openlibrary.js";
import {
  contentTypeForExt,
  coverPath,
  removeCover,
  writeCover,
} from "../covers.js";

export const booksRouter = Router();

function getBookRow(id: number): BookRow | undefined {
  return db.prepare("SELECT * FROM books WHERE id = ?").get(id) as
    BookRow | undefined;
}

// Find an already-stored book matching an incoming payload, by external id,
// then ISBN, then title + first author (dedupes across sources).
function findExistingBook(b: {
  ol_key: string;
  isbn?: string | null;
  title: string;
  authors?: string[];
}): BookRow | undefined {
  let row = db.prepare("SELECT * FROM books WHERE ol_key = ?").get(b.ol_key) as
    BookRow | undefined;
  if (!row && b.isbn) {
    row = db
      .prepare("SELECT * FROM books WHERE isbn = ? AND isbn <> ''")
      .get(b.isbn) as BookRow | undefined;
  }
  if (!row) {
    const cands = db
      .prepare("SELECT * FROM books WHERE lower(title) = lower(?)")
      .all(b.title) as BookRow[];
    const a = (b.authors?.[0] ?? "").toLowerCase();
    row = cands.find(
      (c) =>
        ((JSON.parse(c.authors || "[]") as string[])[0] ?? "").toLowerCase() ===
        a,
    );
  }
  return row;
}

// Description via Google Books, falling back to the Open Library work description.
async function resolveDescription(b: {
  ol_key: string;
  isbn?: string | null;
  title: string;
  authors?: string[];
}): Promise<string | null> {
  const desc = await fetchDescription({
    isbn: b.isbn,
    title: b.title,
    author: b.authors?.[0],
  });
  if (desc) return desc;
  if (b.ol_key.startsWith("/works/")) return fetchWorkDescription(b.ol_key);
  return null;
}

// Normalize a rating to [0,5] in half-star steps, or null to clear.
function normalizeRating(v: unknown): number | null {
  if (v === null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(5, Math.round(n * 2) / 2));
}

// GET /api/books?status=read  — the user's library (optionally one shelf)
booksRouter.get("/", (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  const rows = (
    status
      ? db
          .prepare(
            "SELECT * FROM books WHERE status = ? ORDER BY created_at DESC",
          )
          .all(status)
      : db.prepare("SELECT * FROM books ORDER BY created_at DESC").all()
  ) as BookRow[];
  res.json({ books: rows.map(serializeBook) });
});

// GET /api/books/:id
booksRouter.get("/:id", (req, res) => {
  const row = getBookRow(Number(req.params.id));
  if (!row) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  const book = serializeBook(row);
  const years = db
    .prepare(
      "SELECT year, rank_position FROM reading_log WHERE book_id = ? ORDER BY year DESC",
    )
    .all(book.id) as { year: number; rank_position: number }[];
  res.json({ book, reading_years: years });
});

// POST /api/books  — add/upsert a book onto a shelf (default: To Read)
booksRouter.post("/", async (req, res) => {
  const b = req.body ?? {};
  if (!b.ol_key || !b.title) {
    res.status(400).json({ error: "ol_key and title are required" });
    return;
  }
  const status = isValidShelf(b.status) ? b.status : DEFAULT_SHELF;

  const existing = findExistingBook(b);
  if (existing) {
    // Already in library — just move it to the requested shelf.
    applyStatus(existing.id, status);
    res.json({ book: serializeBook(getBookRow(existing.id)!), created: false });
    return;
  }

  const description = await resolveDescription(b);

  const info = db
    .prepare(
      `INSERT INTO books
        (ol_key, title, authors, cover_url, publisher, first_publish_year, page_count, subjects, description, isbn,
         owned_physical, owned_digital, status, ratings_average, ratings_count)
       VALUES (@ol_key, @title, @authors, @cover_url, @publisher, @first_publish_year, @page_count, @subjects, @description, @isbn,
         @owned_physical, @owned_digital, @status, @ratings_average, @ratings_count)`,
    )
    .run({
      ol_key: b.ol_key,
      title: b.title,
      authors: JSON.stringify(b.authors ?? []),
      cover_url: b.cover_url ?? null,
      publisher: b.publisher ?? null,
      first_publish_year: b.first_publish_year ?? null,
      page_count: b.page_count ?? null,
      subjects: JSON.stringify(b.subjects ?? []),
      description,
      isbn: b.isbn ?? null,
      owned_physical: b.owned_physical ? 1 : 0,
      owned_digital: b.owned_digital ? 1 : 0,
      status,
      ratings_average:
        typeof b.ratings_average === "number" ? b.ratings_average : null,
      ratings_count:
        typeof b.ratings_count === "number" ? b.ratings_count : null,
    });

  const id = Number(info.lastInsertRowid);
  applyStatus(id, status); // stamp start/finish dates + sync reading year
  res.status(201).json({ book: serializeBook(getBookRow(id)!), created: true });
});

// PATCH /api/books/:id  — status, dates, rating, review, ownership
booksRouter.patch("/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = getBookRow(id);
  if (!row) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  const b = req.body ?? {};

  // Status change first (stamps dates + syncs reading year).
  if (typeof b.status === "string" && isValidShelf(b.status)) {
    applyStatus(id, b.status);
  }

  const updates: string[] = [];
  const params: Record<string, unknown> = { id };
  const set = (col: string, val: unknown) => {
    updates.push(`${col} = @${col}`);
    params[col] = val;
  };

  if (typeof b.owned_physical === "boolean")
    set("owned_physical", b.owned_physical ? 1 : 0);
  if (typeof b.owned_digital === "boolean")
    set("owned_digital", b.owned_digital ? 1 : 0);
  if (typeof b.review === "string" || b.review === null)
    set("review", b.review);
  if ("rating" in b) set("rating", normalizeRating(b.rating));
  if ("start_date" in b) set("start_date", b.start_date || null);
  if ("finish_date" in b) set("finish_date", b.finish_date || null);

  if (updates.length) {
    db.prepare(`UPDATE books SET ${updates.join(", ")} WHERE id = @id`).run(
      params,
    );
  }

  // Explicit date/finish edits may change the reading year membership.
  if ("finish_date" in b || "start_date" in b) syncReadingYear(id);

  res.json({ book: serializeBook(getBookRow(id)!) });
});

// POST /api/books/:id/cover  — upload a custom cover (base64 data URL in { image })
booksRouter.post("/:id/cover", (req, res) => {
  const id = Number(req.params.id);
  if (!getBookRow(id)) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  try {
    const customCover = writeCover(id, (req.body ?? {}).image);
    db.prepare("UPDATE books SET custom_cover = @v WHERE id = @id").run({
      v: customCover,
      id,
    });
    res.json({ book: serializeBook(getBookRow(id)!) });
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : "Invalid image",
    });
  }
});

// DELETE /api/books/:id/cover  — revert to the original (Open Library) cover
booksRouter.delete("/:id/cover", (req, res) => {
  const id = Number(req.params.id);
  if (!getBookRow(id)) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  removeCover(id);
  db.prepare("UPDATE books SET custom_cover = NULL WHERE id = ?").run(id);
  res.json({ book: serializeBook(getBookRow(id)!) });
});

// GET /api/books/:id/cover  — serve the stored custom cover file
booksRouter.get("/:id/cover", (req, res) => {
  const id = Number(req.params.id);
  const row = getBookRow(id);
  if (!row || !row.custom_cover) {
    res.status(404).json({ error: "No custom cover" });
    return;
  }
  const ext = row.custom_cover.split(".").pop() ?? "";
  const contentType = contentTypeForExt(ext);
  if (!contentType) {
    res.status(404).json({ error: "No custom cover" });
    return;
  }
  res.type(contentType);
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(coverPath(id, ext), (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: "No custom cover" });
  });
});

// DELETE /api/books/:id
booksRouter.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM books WHERE id = ?").run(id);
  if (info.changes === 0) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  removeCover(id); // don't orphan the cover file
  res.json({ ok: true });
});
