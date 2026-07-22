import { FC, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBookLookup } from "../../api/hooks";
import type { BookLookupResult } from "../../api/types";
import { Cover } from "../cover/Cover";
import { bookCoverSrc } from "../cover/Cover.utils";
import { useDebouncedValue } from "./BookSearchCombobox.utils";

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void; // Enter with no dropdown item highlighted (→ API search)
  placeholder?: string;
  className?: string;
}

// Search input with a live dropdown of books already in the DB. Typing filters
// the dropdown in real time; selecting a row opens that book; Enter with nothing
// highlighted runs the parent's Open Library search.
export const BookSearchCombobox: FC<Props> = ({
  id,
  value,
  onChange,
  onSubmit,
  placeholder,
  className = "",
}) => {
  const navigate = useNavigate();
  const listId = useId();
  const debounced = useDebouncedValue(value);
  const { data } = useBookLookup(debounced);
  const results = data?.results ?? [];

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const blurTimer = useRef<number | null>(null);

  // Reset the highlight whenever the result set changes.
  useEffect(() => setHighlight(-1), [debounced]);

  const showList = open && value.trim().length > 0 && results.length > 0;

  const selectBook = (book: BookLookupResult) => {
    setOpen(false);
    navigate(`/book/${book.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && showList) {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === "ArrowUp" && showList) {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? results.length - 1 : h - 1));
    } else if (e.key === "Enter") {
      if (showList && highlight >= 0) {
        e.preventDefault();
        selectBook(results[highlight]);
      } else {
        setOpen(false);
        onSubmit();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && highlight >= 0 ? `${listId}-opt-${highlight}` : undefined
        }
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a click on an option registers before the list unmounts.
          blurTimer.current = window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-full border border-ink/20 px-5 py-2.5 focus:outline-none focus:border-accent"
      />

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-ink/15 bg-surface shadow-shelf"
        >
          {results.map((r, i) => (
            <li
              key={r.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                // Prevent the input blur from closing the list before this fires.
                e.preventDefault();
                if (blurTimer.current) clearTimeout(blurTimer.current);
                selectBook(r);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
                i === highlight ? "bg-ink/5" : ""
              }`}
            >
              <Cover
                url={bookCoverSrc(r)}
                title={r.title}
                className="h-10 w-7 shrink-0 rounded"
              />
              <span className="min-w-0">
                <span className="block truncate font-serif text-sm font-semibold">
                  {r.title}
                </span>
                <span className="block truncate text-xs text-ink/60">
                  {r.authors.join(", ") || "Unknown author"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
