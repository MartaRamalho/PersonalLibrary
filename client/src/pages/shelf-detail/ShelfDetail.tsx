import { FC } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useDeleteBook,
  useShelfBooks,
  useShelves,
  useUpdateBook,
} from "../../api/hooks";
import { Cover } from "../../components/cover/Cover";
import { bookCoverSrc } from "../../components/cover/Cover.utils";
import { StarRating } from "../../components/star-rating/StarRating";
import { ShelfSelect } from "../../components/shelf-select/ShelfSelect";

export const ShelfDetail: FC = () => {
  const { key = "" } = useParams();
  const { data, isLoading } = useShelfBooks(key);
  const { data: shelvesData } = useShelves();
  const updateBook = useUpdateBook();
  const deleteBook = useDeleteBook();

  const shelfName =
    shelvesData?.shelves.find((s) => s.key === key)?.name ?? key;

  if (isLoading) return <p className="text-ink/50">Loading…</p>;

  const books = data?.books ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/shelves" className="text-sm text-ink/50 hover:text-ink">
          ← All shelves
        </Link>
        <h1 className="font-display text-2xl font-bold mt-1">{shelfName}</h1>
        <p className="text-sm text-ink/50">
          {books.length} book{books.length === 1 ? "" : "s"}
        </p>
      </div>

      {books.length === 0 ? (
        <p className="text-ink/50">
          Nothing here yet. Add books from the{" "}
          <Link to="/search" className="text-accent">
            search
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-2">
          {books.map((book) => (
            <div
              key={book.id}
              className="flex gap-4 card-spine p-3"
            >
              <Link to={`/book/${book.id}`} className="shrink-0">
                <Cover
                  url={bookCoverSrc(book)}
                  title={book.title}
                  className="w-14 h-20 rounded-md"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/book/${book.id}`}>
                  <h3 className="font-serif font-semibold truncate">
                    {book.title}
                  </h3>
                </Link>
                <p className="text-sm text-ink/60 truncate">
                  {book.authors.join(", ")}
                </p>
                <div className="mt-1 flex items-center gap-3">
                  {book.rating != null && (
                    <StarRating value={book.rating} readOnly size={15} />
                  )}
                  {book.finish_date && (
                    <span className="text-xs text-ink/40">
                      Finished {book.finish_date}
                    </span>
                  )}
                  {book.owned_physical && (
                    <span className="text-xs text-ink/40">📗 physical</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <ShelfSelect
                  value={book.status}
                  onChange={(status) =>
                    updateBook.mutate({ id: book.id, status })
                  }
                />
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remove “${book.title}” from your library?`)) {
                      deleteBook.mutate(book.id);
                    }
                  }}
                  className="text-ink/30 hover:text-red-600 text-sm"
                  aria-label={`Remove ${book.title} from library`}
                >
                  ✕ remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
