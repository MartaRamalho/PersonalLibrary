import { FC, useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useAddBook, useShelves, useWorkDescription } from "../../api/hooks";
import type { SearchResult } from "../../api/types";
import { Cover } from "../../components/cover/Cover";
import { CommunityScore } from "../../components/community-score/CommunityScore";

// Shows an Open Library book that isn't (necessarily) in the library yet.
// Core fields arrive via router state from the search page; the description is
// fetched on demand. This lets you inspect a book before adding it.
export const BookPreview: FC = () => {
  const location = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { data: shelvesData } = useShelves();
  const addBook = useAddBook();

  const result =
    (location.state as { result?: SearchResult } | null)?.result ?? null;

  const olKey = result?.ol_key ?? params.get("key");

  const { data: desc } = useWorkDescription(
    result
      ? {
          ol_key: result.ol_key,
          isbn: result.isbn,
          title: result.title,
          author: result.authors[0] ?? "",
        }
      : olKey
        ? { ol_key: olKey }
        : null,
  );

  const [shelf, setShelf] = useState("to-read");

  useEffect(() => {
    if (shelvesData?.default) {
      setShelf(shelvesData.default);
    }
  }, [shelvesData]);

  if (!result) {
    return (
      <div className="space-y-3">
        <p className="text-ink/60">
          This preview needs to be opened from the{" "}
          <Link to="/search" className="text-accent">
            search results
          </Link>
          .
        </p>
      </div>
    );
  }

  const add = async () => {
    const res = await addBook.mutateAsync({
      ol_key: result.ol_key,
      title: result.title,
      authors: result.authors,
      cover_url: result.cover_url,
      first_publish_year: result.first_publish_year,
      page_count: result.page_count,
      subjects: result.subjects,
      isbn: result.isbn,
      ratings_average: result.ratings_average,
      ratings_count: result.ratings_count,
      in_library: result.in_library,
      book_id: result.book_id,
      status: shelf,
    });

    navigate(`/book/${res.book.id}`);
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-ink/50 hover:text-ink"
      >
        ← Back to search
      </button>

      <div className="flex gap-6 flex-col sm:flex-row">
        <Cover
          url={result.cover_url}
          title={result.title}
          className="w-40 h-60 rounded-lg shadow-md shrink-0 self-center sm:self-start"
        />

        <div className="flex-1 space-y-3">
          <div>
            <span className="inline-block text-xs uppercase tracking-wide text-ink/40 mb-1">
              Preview · not in your library
            </span>

            <h1 className="font-display text-3xl font-bold">{result.title}</h1>

            <p className="text-ink/60">
              {result.authors?.join(", ") || "Unknown author"}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink/60">
            {result.first_publish_year && (
              <span>First published {result.first_publish_year}</span>
            )}

            {result.page_count && <span>{result.page_count} pages</span>}

            {result.isbn && <span>ISBN {result.isbn}</span>}
          </div>

          {result.ratings_average != null && (
            <CommunityScore
              rating={result.ratings_average}
              count={result.ratings_count}
            />
          )}

          {result.in_library && result.book_id ? (
            <Link
              to={`/book/${result.book_id}`}
              className="btn-primary inline-block px-4 py-2 text-sm"
            >
              Already in library — open
            </Link>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              <label className="sr-only" htmlFor="preview-shelf">
                Shelf to add to
              </label>

              <select
                id="preview-shelf"
                value={shelf}
                onChange={(e) => setShelf(e.target.value)}
                className="pill-select px-3 py-2 text-sm"
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
                className="chip px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
              >
                {addBook.isPending ? "Adding…" : "+ Add to library"}
              </button>
            </div>
          )}

          {(result.subjects ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(result.subjects ?? []).slice(0, 8).map((subject) => (
                <span key={subject} className="tag">
                  {subject}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {desc?.description && (
        <section>
          <h2 className="font-serif text-lg font-semibold mb-1">Description</h2>

          <p className="text-ink/70 leading-relaxed whitespace-pre-line">
            {desc.description}
          </p>
        </section>
      )}
    </div>
  );
};
