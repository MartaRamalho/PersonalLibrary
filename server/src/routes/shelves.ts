import { Router } from "express";
import { db, serializeBook, BookRow } from "../db.js";
import { SHELVES, DEFAULT_SHELF, isValidShelf } from "../shelves.js";

export const shelvesRouter = Router();

// GET /api/shelves  — the fixed shelves, the default, and per-shelf counts.
shelvesRouter.get("/", (_req, res) => {
  const rows = db
    .prepare("SELECT status, COUNT(*) AS count FROM books GROUP BY status")
    .all() as { status: string; count: number }[];
  const counts = new Map(rows.map((r) => [r.status, r.count]));

  res.json({
    default: DEFAULT_SHELF,
    shelves: SHELVES.map((s) => ({ ...s, count: counts.get(s.key) ?? 0 })),
  });
});

// GET /api/shelves/:key/books  — books on a shelf.
shelvesRouter.get("/:key/books", (req, res) => {
  const key = req.params.key;
  if (!isValidShelf(key)) {
    res.status(404).json({ error: "Unknown shelf" });
    return;
  }
  const rows = db
    .prepare(
      `SELECT * FROM books WHERE status = ?
       ORDER BY COALESCE(finish_date, start_date, created_at) DESC, title`,
    )
    .all(key) as BookRow[];
  const shelf = SHELVES.find((s) => s.key === key)!;
  res.json({ shelf, books: rows.map(serializeBook) });
});
