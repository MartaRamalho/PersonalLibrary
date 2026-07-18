import { Router } from "express";
import { searchBooks, fetchWorkDescription } from "../openlibrary.js";
import { fetchDescription } from "../googlebooks.js";
import { db } from "../db.js";

export const searchRouter = Router();

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// GET /api/search/work?ol_key=/works/OL…W&isbn=…&title=…&author=…
// Description for the preview page: Google Books, with Open Library as a fallback.
searchRouter.get("/work", async (req, res) => {
  const olKey = String(req.query.ol_key ?? "");
  const isbn = req.query.isbn ? String(req.query.isbn) : null;
  const title = String(req.query.title ?? "");
  const author = req.query.author ? String(req.query.author) : undefined;

  let description: string | null = null;
  if (title || isbn)
    description = await fetchDescription({ isbn, title, author });
  if (!description && olKey.startsWith("/works/")) {
    description = await fetchWorkDescription(olKey);
  }
  res.json({ description });
});

// GET /api/search?q=dune
searchRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) {
    res.json({ results: [] });
    return;
  }
  try {
    const results = await searchBooks(q);

    // Match results against the library by external id, then ISBN, then
    // title + first author — so books added via another source still show as
    // "in library" rather than looking new.
    const lib = db
      .prepare("SELECT id, ol_key, isbn, title, authors FROM books")
      .all() as {
      id: number;
      ol_key: string;
      isbn: string | null;
      title: string;
      authors: string;
    }[];
    const byOlKey = new Map(lib.map((b) => [b.ol_key, b.id]));
    const byIsbn = new Map(
      lib.filter((b) => b.isbn).map((b) => [b.isbn as string, b.id]),
    );

    const matchId = (r: (typeof results)[number]): number | null => {
      if (byOlKey.has(r.ol_key)) return byOlKey.get(r.ol_key)!;
      if (r.isbn && byIsbn.has(r.isbn)) return byIsbn.get(r.isbn)!;
      const t = norm(r.title);
      const a = (r.authors[0] ?? "").toLowerCase();
      const hit = lib.find(
        (b) =>
          norm(b.title) === t &&
          (
            (JSON.parse(b.authors || "[]") as string[])[0] ?? ""
          ).toLowerCase() === a,
      );
      return hit ? hit.id : null;
    };

    res.json({
      results: results.map((r) => {
        const id = matchId(r);
        return { ...r, in_library: id != null, book_id: id };
      }),
    });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Failed to reach Open Library" });
  }
});
