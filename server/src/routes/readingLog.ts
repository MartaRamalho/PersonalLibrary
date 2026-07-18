import { Router } from "express";
import { db, serializeBook, BookRow } from "../db.js";
import { syncReadingYear } from "../bookStatus.js";
import { READ_SHELF } from "../shelves.js";

export const readingLogRouter = Router();

// GET /api/reading-log/years  — years present + counts
readingLogRouter.get("/years", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT year, COUNT(*) AS count FROM reading_log GROUP BY year ORDER BY year DESC`,
    )
    .all() as { year: number; count: number }[];
  res.json({ years: rows });
});

// GET /api/reading-log?year=2024  — a year's books in rank order (least → most favorite)
readingLogRouter.get("/", (req, res) => {
  const year = Number(req.query.year);
  if (!year) {
    res.status(400).json({ error: "year query param is required" });
    return;
  }
  // Select b.* plus reading-log fields under distinct aliases so the book's own
  // `rating` column is not clobbered by the reading_log join.
  const rows = db
    .prepare(
      `SELECT b.*, rl.id AS entry_id, rl.rank_position AS entry_rank
       FROM reading_log rl JOIN books b ON b.id = rl.book_id
       WHERE rl.year = ? ORDER BY rl.rank_position, rl.id`,
    )
    .all(year) as (BookRow & { entry_id: number; entry_rank: number })[];

  const entries = rows.map((r) => ({
    entry_id: r.entry_id,
    rank_position: r.entry_rank,
    book: serializeBook(r),
  }));
  res.json({ year, entries });
});

// POST /api/reading-log  — mark a book as read in a given year. This sets the
// book's shelf to "read" with a finish date in that year; the reading-year
// entry is then created by the sync.
readingLogRouter.post("/", (req, res) => {
  const bookId = Number(req.body?.book_id);
  const year = Number(req.body?.year);
  if (!bookId || !year) {
    res.status(400).json({ error: "book_id and year are required" });
    return;
  }
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(bookId) as
    BookRow | undefined;
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  // Keep an existing finish date if it already falls in this year, else stamp
  // the start of the year so the book lands in the right reading year.
  const keepFinish =
    book.finish_date && book.finish_date.startsWith(String(year))
      ? book.finish_date
      : `${year}-01-01`;
  db.prepare("UPDATE books SET status = ?, finish_date = ? WHERE id = ?").run(
    READ_SHELF,
    keepFinish,
    bookId,
  );
  syncReadingYear(bookId);
  res.status(201).json({ ok: true });
});

// PATCH /api/reading-log/reorder  — body: { year, entry_ids: number[] } in new rank order
// NOTE: declared before '/:entryId' so "reorder" isn't matched as an entry id.
readingLogRouter.patch("/reorder", (req, res) => {
  const year = Number(req.body?.year);
  const entryIds: number[] = req.body?.entry_ids ?? [];
  if (!year || !Array.isArray(entryIds)) {
    res.status(400).json({ error: "year and entry_ids[] are required" });
    return;
  }
  const update = db.prepare(
    "UPDATE reading_log SET rank_position = ? WHERE id = ? AND year = ?",
  );
  const tx = db.transaction((ids: number[]) => {
    ids.forEach((entryId, index) => update.run(index, entryId, year));
  });
  tx(entryIds);
  res.json({ ok: true });
});

// PATCH /api/reading-log/:entryId  — update rating/notes
readingLogRouter.patch("/:entryId", (req, res) => {
  const entryId = Number(req.params.entryId);
  const existing = db
    .prepare("SELECT * FROM reading_log WHERE id = ?")
    .get(entryId) as
    { rating: number | null; notes: string | null } | undefined;
  if (!existing) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }
  const rating =
    req.body?.rating !== undefined ? req.body.rating : existing.rating;
  const notes = req.body?.notes !== undefined ? req.body.notes : existing.notes;
  db.prepare("UPDATE reading_log SET rating = ?, notes = ? WHERE id = ?").run(
    rating,
    notes,
    entryId,
  );
  res.json({ ok: true });
});

// DELETE /api/reading-log/:entryId
readingLogRouter.delete("/:entryId", (req, res) => {
  const info = db
    .prepare("DELETE FROM reading_log WHERE id = ?")
    .run(Number(req.params.entryId));
  if (info.changes === 0) {
    res.status(404).json({ error: "Entry not found" });
    return;
  }
  res.json({ ok: true });
});
