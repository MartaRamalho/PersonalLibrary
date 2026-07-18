import { Router } from "express";
import { db, serializeBook, safeParse, BookRow } from "../db.js";

export const pickerRouter = Router();
export const genresRouter = Router();

interface PickerFilters {
  statuses?: string[]; // shelf keys; empty/absent = whole library
  min_pages?: number | null;
  max_pages?: number | null;
  subjects?: string[]; // match any
  min_year?: number | null;
  max_year?: number | null;
  physical_only?: boolean;
  unread_only?: boolean;
}

// POST /api/picker/candidates  — return the pool of books matching the filters.
pickerRouter.post("/candidates", (req, res) => {
  const f: PickerFilters = req.body ?? {};

  const where: string[] = [];
  const params: unknown[] = [];

  // Source: restrict to the given shelves (empty/absent = whole library).
  if (f.statuses && f.statuses.length > 0) {
    const placeholders = f.statuses.map(() => "?").join(",");
    where.push(`b.status IN (${placeholders})`);
    params.push(...f.statuses);
  }

  if (f.min_pages != null) {
    where.push("b.page_count IS NOT NULL AND b.page_count >= ?");
    params.push(f.min_pages);
  }
  if (f.max_pages != null) {
    where.push("b.page_count IS NOT NULL AND b.page_count <= ?");
    params.push(f.max_pages);
  }
  if (f.min_year != null) {
    where.push(
      "b.first_publish_year IS NOT NULL AND b.first_publish_year >= ?",
    );
    params.push(f.min_year);
  }
  if (f.max_year != null) {
    where.push(
      "b.first_publish_year IS NOT NULL AND b.first_publish_year <= ?",
    );
    params.push(f.max_year);
  }
  if (f.physical_only) {
    where.push("b.owned_physical = 1");
  }
  if (f.unread_only) {
    where.push("b.status <> 'read'");
  }

  const sql = `SELECT * FROM books b ${where.length ? "WHERE " + where.join(" AND ") : ""}`;
  let rows = db.prepare(sql).all(...params) as BookRow[];

  // Subject filtering happens in JS (subjects stored as JSON). Match if any overlap.
  if (f.subjects && f.subjects.length > 0) {
    const wanted = f.subjects.map((s) => s.toLowerCase());
    rows = rows.filter((row) => {
      const subs = safeParse<string[]>(row.subjects, []).map((s) =>
        s.toLowerCase(),
      );
      return subs.some((s) => wanted.some((w) => s.includes(w)));
    });
  }

  res.json({ candidates: rows.map(serializeBook), count: rows.length });
});

// GET /api/genres  — distinct subjects across the library with counts (for filter UI).
genresRouter.get("/", (_req, res) => {
  const rows = db.prepare("SELECT subjects FROM books").all() as {
    subjects: string;
  }[];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const subs = safeParse<string[]>(row.subjects, []);
    for (const s of subs) {
      const key = s.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const genres = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 60);
  res.json({ genres });
});
