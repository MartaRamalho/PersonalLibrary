import Database from "better-sqlite3";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { DEFAULT_SHELF } from "./shelves.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

export const db = new Database(join(dataDir, "library.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    ol_key             TEXT UNIQUE NOT NULL,          -- '/works/OL…W' (OL) or 'goodreads:<id>' (import)
    title              TEXT NOT NULL,
    authors            TEXT NOT NULL DEFAULT '[]',    -- JSON array of strings
    cover_url          TEXT,
    publisher          TEXT,
    first_publish_year INTEGER,
    page_count         INTEGER,
    subjects           TEXT NOT NULL DEFAULT '[]',    -- JSON array of strings
    description        TEXT,
    isbn               TEXT,
    owned_physical     INTEGER NOT NULL DEFAULT 0,
    owned_digital      INTEGER NOT NULL DEFAULT 0,
    status             TEXT NOT NULL DEFAULT '${DEFAULT_SHELF}',
    start_date         TEXT,
    finish_date        TEXT,
    rating             REAL,      -- the user's own rating (0–5, half stars)
    review             TEXT,
    ratings_average    REAL,      -- Open Library community rating (0–5)
    ratings_count      INTEGER,   -- number of Open Library ratings
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reading_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id       INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    year          INTEGER NOT NULL,
    rank_position INTEGER NOT NULL DEFAULT 0,
    date_read     TEXT,
    rating        REAL,
    UNIQUE (book_id, year)
  );

  CREATE INDEX IF NOT EXISTS idx_reading_log_year ON reading_log(year);
  CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
`);

// Additive, non-destructive migration: add custom_cover to existing databases
// without wiping data (the app has no general migration system).
const bookColumns = db.prepare("PRAGMA table_info(books)").all() as {
  name: string;
}[];
const hasColumn = (name: string) => bookColumns.some((c) => c.name === name);
if (!hasColumn("custom_cover")) {
  db.exec("ALTER TABLE books ADD COLUMN custom_cover TEXT"); // "<token>.<ext>" or null
}
if (!hasColumn("last_viewed_at")) {
  db.exec("ALTER TABLE books ADD COLUMN last_viewed_at TEXT"); // ISO datetime of last open, or null
}

// ---- Row types -----------------------------------------------------------

export interface BookRow {
  id: number;
  ol_key: string;
  title: string;
  authors: string;
  publisher: string | null;
  cover_url: string | null;
  custom_cover: string | null;
  first_publish_year: number | null;
  page_count: number | null;
  subjects: string;
  description: string | null;
  isbn: string | null;
  owned_physical: number;
  owned_digital: number;
  status: string;
  start_date: string | null;
  finish_date: string | null;
  rating: number | null;
  review: string | null;
  ratings_average: number | null;
  ratings_count: number | null;
  created_at: string;
  last_viewed_at: string | null;
}

export interface Book {
  id: number;
  ol_key: string;
  title: string;
  authors: string[];
  publisher: string | null;
  cover_url: string | null;
  custom_cover: string | null;
  first_publish_year: number | null;
  page_count: number | null;
  subjects: string[];
  description: string | null;
  isbn: string | null;
  owned_physical: boolean;
  owned_digital: boolean;
  status: string;
  start_date: string | null;
  finish_date: string | null;
  rating: number | null;
  review: string | null;
  ratings_average: number | null;
  ratings_count: number | null;
  created_at: string;
  last_viewed_at: string | null;
}

export function serializeBook(row: BookRow): Book {
  return {
    id: row.id,
    ol_key: row.ol_key,
    title: row.title,
    authors: safeParse(row.authors, []),
    publisher: row.publisher,
    cover_url: row.cover_url,
    custom_cover: row.custom_cover,
    first_publish_year: row.first_publish_year,
    page_count: row.page_count,
    subjects: safeParse(row.subjects, []),
    description: row.description,
    isbn: row.isbn,
    owned_physical: !!row.owned_physical,
    owned_digital: !!row.owned_digital,
    status: row.status,
    start_date: row.start_date,
    finish_date: row.finish_date,
    rating: row.rating,
    review: row.review,
    ratings_average: row.ratings_average,
    ratings_count: row.ratings_count,
    created_at: row.created_at,
    last_viewed_at: row.last_viewed_at,
  };
}

export function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
