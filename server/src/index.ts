import "./env.js"; // load .env before anything reads process.env
import express from "express";
import cors from "cors";
import "./db.js"; // initialize the database + schema on boot
import { searchRouter } from "./routes/search.js";
import { booksRouter } from "./routes/books.js";
import { shelvesRouter } from "./routes/shelves.js";
import { readingLogRouter } from "./routes/readingLog.js";
import { pickerRouter, genresRouter } from "./routes/picker.js";
import { importRouter } from "./routes/import.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: "15mb" })); // Goodreads CSV exports can be large

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/search", searchRouter);
app.use("/api/books", booksRouter);
app.use("/api/shelves", shelvesRouter);
app.use("/api/reading-log", readingLogRouter);
app.use("/api/picker", pickerRouter);
app.use("/api/genres", genresRouter);
app.use("/api/import", importRouter);

// Placeholder for the future AI chatbot agent (see plan). Not implemented yet.
app.post("/api/chat", (_req, res) => {
  res.status(501).json({ error: "Chat agent not implemented yet" });
});

app.listen(PORT, () => {
  console.log(`📚 Personal Library API listening on http://localhost:${PORT}`);
});
