import { FC, useState } from "react";
import { Link } from "react-router-dom";
import { useAddBook, useSearch, useShelves } from "../../api/hooks";
import type { SearchResult } from "../../api/types";
import { Cover } from "../../components/cover/Cover";
import { ImportGoodreads } from "../../components/import-goodreads/ImportGoodreads";
import { CommunityScore } from "../../components/community-score/CommunityScore";
import { BookSearchCombobox } from "../../components/book-search-combobox/BookSearchCombobox";

const ResultRow: FC<{ result: SearchResult }> = ({ result }) => {
  const addBook = useAddBook();
  const { data: shelvesData } = useShelves();
  // Only treat as "already added" when it's actually on a shelf; a seen-but-
  // unshelved book (in_library=false) stays addable even though it has a book_id.
  const [addedId, setAddedId] = useState<number | null>(
    result.in_library ? result.book_id : null,
  );
  const [shelf, setShelf] = useState(shelvesData?.default ?? "to-read");

  const previewLink = {
    pathname: "/preview",
    search: `?key=${encodeURIComponent(result.ol_key)}`,
  };

  const add = async () => {
    const res = await addBook.mutateAsync({ ...result, status: shelf });
    setAddedId(res.book.id);
  };

  const inLibrary = result.in_library || addedId != null;

  return (
    <div className="flex gap-4 card p-3">
      <Link to={previewLink} state={{ result }} className="shrink-0">
        <Cover
          url={result.cover_url}
          title={result.title}
          className="w-16 h-24 rounded-md"
        />
      </Link>
      <div className="flex-1 min-w-0">
        <Link to={previewLink} state={{ result }}>
          <h3 className="font-serif font-semibold truncate hover:text-accent">
            {result.title}
          </h3>
        </Link>
        <p className="text-sm text-ink/60 truncate">
          {result.authors.join(", ") || "Unknown author"}
        </p>
        <p className="text-xs text-ink/50 mt-1">
          {result.first_publish_year ?? "—"}
          {result.page_count ? ` · ${result.page_count} pages` : ""}
        </p>
        {result.ratings_average != null && (
          <div className="mt-1">
            <CommunityScore
              rating={result.ratings_average}
              count={result.ratings_count}
              size={13}
            />
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          {inLibrary ? (
            <Link
              to={addedId ? `/book/${addedId}` : previewLink}
              className="text-xs text-accent font-medium"
            >
              ✓ In your library — view
            </Link>
          ) : (
            <>
              <label className="sr-only" htmlFor={`shelf-${result.ol_key}`}>
                Shelf to add to
              </label>
              <select
                id={`shelf-${result.ol_key}`}
                value={shelf}
                onChange={(e) => setShelf(e.target.value)}
                className="pill-select px-3 py-1 text-xs"
              >
                {(shelvesData?.shelves ?? []).map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={add}
                disabled={addBook.isPending}
                className="chip px-3 py-1 text-xs hover:opacity-90 disabled:opacity-50"
              >
                {addBook.isPending ? "Adding…" : "+ Add"}
              </button>
            </>
          )}
          <Link
            to={previewLink}
            state={{ result }}
            className="text-xs text-ink/50 hover:text-ink"
          >
            Open
          </Link>
        </div>
      </div>
    </div>
  );
};

export const Search: FC = () => {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const { data, isFetching, error } = useSearch(query);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(input.trim());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold">Find books</h1>
          <p className="text-sm text-ink/50">
            Search Open Library, or bulk-import your Goodreads library.
          </p>
        </div>
        <ImportGoodreads />
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <label className="sr-only" htmlFor="book-search">
          Search books
        </label>
        <BookSearchCombobox
          id="book-search"
          value={input}
          onChange={setInput}
          onSubmit={() => setQuery(input.trim())}
          placeholder="Search by title, author, ISBN…"
          className="flex-1"
        />
        <button type="submit" className="btn-primary px-5 py-2.5">
          Search
        </button>
      </form>

      {isFetching && <p className="text-ink/50">Searching Open Library…</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}

      <div className="space-y-3">
        {data?.results.map((r) => (
          <ResultRow key={r.ol_key} result={r} />
        ))}
        {data && data.results.length === 0 && query && (
          <p className="text-ink/50">No results for “{query}”.</p>
        )}
      </div>
    </div>
  );
};
