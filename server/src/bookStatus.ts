import { db, BookRow } from "./db.js";
import { READING_SHELF, READ_SHELF } from "./shelves.js";

export function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function yearOf(date: string | null): number | null {
  if (!date) return null;
  const m = date.match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

// Apply a status transition, filling in start/finish dates per the rules:
//  - moving to "reading" stamps a start date (if none yet)
//  - moving to "read" stamps a finish date (if none yet)
// Then re-syncs the reading-year log so finished books appear in their year.
export function applyStatus(bookId: number, newStatus: string): void {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(bookId) as
    BookRow | undefined;
  if (!book) return;

  let startDate = book.start_date;
  let finishDate = book.finish_date;

  if (newStatus === READING_SHELF && !startDate) startDate = today();
  if (newStatus === READ_SHELF && !finishDate) finishDate = today();

  db.prepare(
    "UPDATE books SET status = ?, start_date = ?, finish_date = ? WHERE id = ?",
  ).run(newStatus, startDate, finishDate, bookId);

  syncReadingYear(bookId);
}

// Ensure the reading-year log matches the book's finished state.
//  - read + finish year  -> exactly one entry for that year (created if missing)
//  - otherwise           -> no auto entries for this book
export function syncReadingYear(bookId: number): void {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(bookId) as
    BookRow | undefined;
  if (!book) return;

  const year = book.status === READ_SHELF ? yearOf(book.finish_date) : null;

  if (year == null) {
    db.prepare("DELETE FROM reading_log WHERE book_id = ?").run(bookId);
    return;
  }

  // Drop entries for other years, keep/target the finish year.
  db.prepare("DELETE FROM reading_log WHERE book_id = ? AND year <> ?").run(
    bookId,
    year,
  );

  const existing = db
    .prepare("SELECT id FROM reading_log WHERE book_id = ? AND year = ?")
    .get(bookId, year) as { id: number } | undefined;
  if (!existing) {
    const maxRank =
      (
        db
          .prepare(
            "SELECT MAX(rank_position) AS m FROM reading_log WHERE year = ?",
          )
          .get(year) as {
          m: number | null;
        }
      ).m ?? -1;
    db.prepare(
      "INSERT INTO reading_log (book_id, year, rank_position, date_read) VALUES (?, ?, ?, ?)",
    ).run(bookId, year, maxRank + 1, book.finish_date);
  }
}
