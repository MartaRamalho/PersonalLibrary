# 📚 Personal Library

A local, single-user app to manage the books you read and want to read.

- **Search** books via the [Open Library](https://openlibrary.org) API (no key needed),
  and open any result to preview it before adding.
- **Community ratings** — Open Library's average rating + rating count are shown alongside
  your own star rating.
- **Descriptions** are fetched from the [Google Books](https://developers.google.com/books)
  API when you add a book (with an Open Library fallback).
- **Shelves** — every book lives on one shelf: Read, Reading, To Read, On Hold, Dropped.
  The set is defined in code (`server/src/shelves.ts`) and easy to rename.
- **Dates** — moving a book to _Reading_ stamps a start date; _Read_ stamps a finish date.
- **Ratings & reviews** — 0–5 stars in half-star steps, plus a free-text review.
- **Physical / digital** ownership flags per book.
- **Reading years** auto-collect the books you finish each year; drag to rank them
  (least → most favorite).
- **Book Picker** — a roulette over your whole library or specific shelves, filterable by
  page count, genre, and age, with a _chained roulette_ mode; it shortlists up to 3 books.
- **Goodreads import** — bulk-import a CSV export (shelves, ratings, reviews, dates).
- (Future) an AI chatbot agent — a `/api/chat` endpoint and route are reserved.

## Google Books API key

Descriptions come from Google Books. Copy `server/.env.example` to `server/.env` and set
`GOOGLE_BOOKS_API_KEY`. A key is optional (there's an Open Library fallback) but
recommended — it raises the request quota and avoids occasional rate-limit errors. Get one
at [Google Cloud Console](https://console.cloud.google.com) → enable the **Books API** →
create an **API key**. (Search and ratings use Open Library, which needs no key.)

## Stack

- **Client:** React + TypeScript + Vite, TanStack Query, React Router, @dnd-kit, Tailwind.
- **Server:** Node + Express + TypeScript, better-sqlite3 (file-based SQLite).

## Getting started

```bash
npm install          # installs root + client + server (npm workspaces)
npm run dev          # starts the API (:4000) and the Vite client (:5173)
```

Then open http://localhost:5173.

The SQLite database is created automatically at `server/data/library.sqlite` on first
run. Delete that file to reset all data.

## Scripts

- `npm run dev` — run client and server together.
- `npm run dev:server` / `npm run dev:client` — run one side only.
- `npm run build` — type-check and build both.

## API overview

`/api/search`, `/api/books` (incl. `/refresh-metadata`), `/api/shelves`, `/api/reading-log`,
`/api/picker/candidates`, `/api/genres`, `/api/import`. See `server/src/routes/` for details.
