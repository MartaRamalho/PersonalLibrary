import { FC, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useAddToYear,
  useLibrary,
  useReadingYear,
  useReadingYears,
  useRemoveFromYear,
  useReorderYear,
} from "../../api/hooks";
import type { ReadingEntry } from "../../api/types";
import { Cover } from "../../components/cover/Cover";
import { bookCoverSrc } from "../../components/cover/Cover.utils";
import { SortableList } from "../../components/sortable-list/SortableList";
import { StarRating } from "../../components/star-rating/StarRating";

// Inline control to add a library book to this year's reading log.
const AddReadBook: FC<{ year: number; existingBookIds: number[] }> = ({
  year,
  existingBookIds,
}) => {
  const { data } = useLibrary();
  const addToYear = useAddToYear();
  const [selected, setSelected] = useState("");

  const available = useMemo(() => {
    const set = new Set(existingBookIds);
    return (data?.books ?? []).filter((b) => !set.has(b.id));
  }, [data, existingBookIds]);

  const add = async () => {
    if (!selected) return;
    await addToYear.mutateAsync({ bookId: Number(selected), year });
    setSelected("");
  };

  return (
    <div className="flex gap-2 rounded-xl border border-dashed border-ink/20 p-3">
      <label className="sr-only" htmlFor="add-read-book">
        Add a book you read in {year}
      </label>
      <select
        id="add-read-book"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="flex-1 pill-select px-4 py-2 text-sm"
      >
        <option value="">Add a book you read in {year}…</option>
        {available.map((b) => (
          <option key={b.id} value={b.id}>
            {b.title}
            {b.authors[0] ? ` — ${b.authors[0]}` : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={add}
        disabled={!selected || addToYear.isPending}
        className="btn-primary px-4 py-2 text-sm"
      >
        Add
      </button>
    </div>
  );
};

export const ReadingYear: FC = () => {
  const { year: yearParam } = useParams();
  const navigate = useNavigate();
  const { data: yearsData } = useReadingYears();

  const currentYear = new Date().getFullYear();
  const year = Number(yearParam) || currentYear;

  const { data, isLoading } = useReadingYear(year);
  const reorder = useReorderYear();
  const removeEntry = useRemoveFromYear();

  const knownYears = yearsData?.years.map((y) => y.year) ?? [];
  const yearOptions = Array.from(
    new Set([...knownYears, currentYear, year]),
  ).sort((a, b) => b - a);

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Reading in {year}</h1>
          <p className="text-sm text-ink/50">
            Drag ⠿ to rank — top = least favorite, bottom = most favorite.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-ink/60" htmlFor="reading-year-select">
            Year
          </label>
          <select
            id="reading-year-select"
            value={year}
            onChange={(e) => navigate(`/reading/${e.target.value}`)}
            className="pill-select"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <AddReadBook
        year={year}
        existingBookIds={entries.map((e) => e.book.id)}
      />

      {isLoading && <p className="text-ink/50">Loading…</p>}

      {entries.length === 0 ? (
        <p className="text-ink/50">
          No books logged for {year} yet. Add books you finished this year
          above.
        </p>
      ) : (
        <SortableList<ReadingEntry>
          items={entries}
          getId={(e) => e.entry_id}
          onReorder={(entryIds) => reorder.mutate({ year, entryIds })}
          renderItem={(entry, index) => (
            <div className="flex items-center gap-4 card-spine p-3">
              <span className="w-7 text-center font-serif text-lg text-ink/40">
                {index + 1}
              </span>
              <Link to={`/book/${entry.book.id}`} className="shrink-0">
                <Cover
                  url={bookCoverSrc(entry.book)}
                  title={entry.book.title}
                  className="w-12 h-18 rounded-md"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/book/${entry.book.id}`}>
                  <h3 className="font-serif font-semibold truncate">
                    {entry.book.title}
                  </h3>
                </Link>
                <p className="text-sm text-ink/60 truncate">
                  {entry.book.authors.join(", ")}
                </p>
                {entry.book.rating != null && (
                  <div className="mt-0.5">
                    <StarRating value={entry.book.rating} readOnly size={14} />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  removeEntry.mutate({ entryId: entry.entry_id, year })
                }
                className="text-ink/30 hover:text-red-600"
                aria-label={`Remove ${entry.book.title} from ${year}`}
              >
                ✕
              </button>
            </div>
          )}
        />
      )}
    </div>
  );
};
