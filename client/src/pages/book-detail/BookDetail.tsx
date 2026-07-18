import { FC, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useBook, useDeleteBook, useUpdateBook } from "../../api/hooks";
import { Cover } from "../../components/cover/Cover";
import { bookCoverSrc } from "../../components/cover/Cover.utils";
import { CoverUpload } from "../../components/cover-upload/CoverUpload";
import { OwnershipToggle } from "../../components/ownership-toggle/OwnershipToggle";
import { StarRating } from "../../components/star-rating/StarRating";
import { ShelfSelect } from "../../components/shelf-select/ShelfSelect";
import { CommunityScore } from "../../components/community-score/CommunityScore";

export const BookDetail: FC = () => {
  const { id } = useParams();
  const bookId = Number(id);
  const { data, isLoading } = useBook(bookId);
  const updateBook = useUpdateBook();
  const deleteBook = useDeleteBook();
  const navigate = useNavigate();

  const [review, setReview] = useState("");
  const [reviewDirty, setReviewDirty] = useState(false);

  useEffect(() => {
    if (data?.book) setReview(data.book.review ?? "");
  }, [data?.book]);

  if (isLoading) return <p className="text-ink/50">Loading…</p>;
  if (!data) return <p className="text-ink/50">Book not found.</p>;

  const { book, reading_years } = data;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-ink/50 hover:text-ink"
      >
        ← Back
      </button>

      <div className="flex gap-6 flex-col sm:flex-row">
        <div className="shrink-0 self-center sm:self-start">
          <Cover
            url={bookCoverSrc(book)}
            title={book.title}
            className="w-40 h-60 rounded-lg shadow-md"
          />
          <CoverUpload book={book} />
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="font-display text-3xl font-bold">{book.title}</h1>
            <p className="text-ink/60">
              {book.authors.join(", ") || "Unknown author"}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink/60">
            {book.first_publish_year && (
              <span>First published {book.first_publish_year}</span>
            )}
            {book.page_count && <span>{book.page_count} pages</span>}
            {book.isbn && <span>ISBN {book.isbn}</span>}
          </div>

          {/* Shelf + dates */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-ink/50">Shelf</span>
            <ShelfSelect
              value={book.status}
              onChange={(status) => updateBook.mutate({ id: book.id, status })}
            />
            {book.start_date && (
              <span className="text-xs text-ink/50">
                Started {book.start_date}
              </span>
            )}
            {book.finish_date && (
              <span className="text-xs text-ink/50">
                Finished {book.finish_date}
              </span>
            )}
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink/50">Your rating</span>
            <StarRating
              value={book.rating}
              onChange={(rating) =>
                updateBook.mutate({ id: book.id, rating: rating ?? null })
              }
            />
          </div>

          {/* Community rating (Open Library) */}
          {book.ratings_average != null && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink/50">Community</span>
              <CommunityScore
                rating={book.ratings_average}
                count={book.ratings_count}
              />
            </div>
          )}

          {/* Ownership */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink/50">Own a copy?</span>
            <OwnershipToggle book={book} />
          </div>

          {book.subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {book.subjects.slice(0, 8).map((s) => (
                <span key={s} className="tag">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Review */}
      <section>
        <h2 className="font-serif text-lg font-semibold mb-2">Your review</h2>
        <label className="sr-only" htmlFor="book-review">
          Your review
        </label>
        <textarea
          id="book-review"
          value={review}
          onChange={(e) => {
            setReview(e.target.value);
            setReviewDirty(true);
          }}
          placeholder="What did you think?"
          rows={4}
          className="w-full rounded-xl border border-ink/20 p-3 text-sm focus:outline-none focus:border-accent"
        />
        {reviewDirty && (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() =>
                updateBook.mutate(
                  { id: book.id, review: review.trim() || null },
                  { onSuccess: () => setReviewDirty(false) },
                )
              }
              className="btn-primary px-4 py-1.5 text-sm"
            >
              Save review
            </button>
            <button
              type="button"
              onClick={() => {
                setReview(book.review ?? "");
                setReviewDirty(false);
              }}
              className="btn-outline px-4 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {book.description && (
        <section>
          <h2 className="font-serif text-lg font-semibold mb-1">Description</h2>
          <p className="text-ink/70 leading-relaxed whitespace-pre-line">
            {book.description}
          </p>
        </section>
      )}

      {reading_years.length > 0 && (
        <section className="card">
          <h2 className="font-serif font-semibold mb-2">Read in</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {reading_years.map((y) => (
              <li key={y.year}>
                <Link
                  to={`/reading/${y.year}`}
                  className="px-3 py-1 rounded-full bg-ink/5 text-accent hover:underline"
                >
                  {y.year}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="pt-4 border-t border-ink/10">
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove “${book.title}” from your library?`)) {
              deleteBook.mutate(book.id, {
                onSuccess: () => navigate("/shelves"),
              });
            }
          }}
          className="text-sm text-red-600 hover:underline"
        >
          Remove from library
        </button>
      </div>
    </div>
  );
};
