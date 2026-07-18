import { FC, ReactNode, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCandidates, useGenres, useShelves } from "../../api/hooks";
import type { Book, PickerFilters } from "../../api/types";
import { Cover } from "../../components/cover/Cover";
import { RouletteWheel } from "../../components/roulette-wheel/RouletteWheel";
import { CommunityScore } from "../../components/community-score/CommunityScore";
import {
  Mode,
  Stage,
  STAGE_LABEL,
  STAGE_ORDER,
  matchesStage,
  randomOf,
  sample,
  stageValues,
} from "./Picker.utils";

const Field: FC<{ label: string; children: ReactNode }> = ({
  label,
  children,
}) => (
  <div>
    <div className="text-xs font-medium text-ink/50 mb-1">{label}</div>
    {children}
  </div>
);

const NumInput: FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
}> = ({ value, onChange, placeholder, label }) => (
  <input
    type="number"
    aria-label={label}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full rounded-lg border border-ink/20 px-3 py-1.5 text-sm focus:outline-none focus:border-accent"
  />
);

const ResultChoices: FC<{ books: Book[] }> = ({ books }) => (
  <div>
    <p className="text-center text-xs uppercase tracking-wide text-accent mb-3">
      {books.length > 1
        ? `Pick one of these ${books.length}`
        : "Read this next"}
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {books.map((book) => (
        <Link
          key={book.id}
          to={`/book/${book.id}`}
          className="rounded-2xl border-2 border-accent/40 bg-accent/5 p-4 text-center hover:border-accent transition-colors"
        >
          <Cover
            url={book.cover_url}
            title={book.title}
            className="w-24 h-36 mx-auto rounded-lg shadow-md mb-3"
          />
          <h3 className="font-serif font-bold leading-tight">{book.title}</h3>
          <p className="text-sm text-ink/60">{book.authors.join(", ")}</p>
          <p className="text-xs text-ink/50 mt-1">
            {book.first_publish_year ?? "—"}
            {book.page_count ? ` · ${book.page_count}p` : ""}
            {book.owned_physical ? " · 📗" : ""}
          </p>
          {book.ratings_average != null && (
            <div className="mt-1 flex justify-center">
              <CommunityScore
                rating={book.ratings_average}
                count={book.ratings_count}
                size={13}
              />
            </div>
          )}
        </Link>
      ))}
    </div>
  </div>
);

export const Picker: FC = () => {
  const { data: shelvesData } = useShelves();
  const { data: genresData } = useGenres();

  // ---- source + filter state ----
  const [mode, setMode] = useState<Mode>("single");
  const [wholeLibrary, setWholeLibrary] = useState(true);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [minPages, setMinPages] = useState("");
  const [maxPages, setMaxPages] = useState("");
  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");
  const [physicalOnly, setPhysicalOnly] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [genreFilter, setGenreFilter] = useState<string[]>([]);
  const [stages, setStages] = useState<Stage[]>(["genre", "decade"]);

  // ---- run state ----
  const [pool, setPool] = useState<Book[] | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  const [history, setHistory] = useState<
    { label: string; value: string; remaining: number }[]
  >([]);
  const [results, setResults] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [wheelLabels, setWheelLabels] = useState<string[]>([]);
  const [wheelTarget, setWheelTarget] = useState<string | null>(null);
  const [wheelCaption, setWheelCaption] = useState("");
  const [spinKey, setSpinKey] = useState(0);
  const pendingApply = useRef<(() => void) | null>(null);

  const baseFilters = (includeGenre: boolean): PickerFilters => ({
    statuses: wholeLibrary ? [] : statuses,
    min_pages: minPages ? Number(minPages) : null,
    max_pages: maxPages ? Number(maxPages) : null,
    min_year: minYear ? Number(minYear) : null,
    max_year: maxYear ? Number(maxYear) : null,
    physical_only: physicalOnly,
    unread_only: unreadOnly,
    subjects: includeGenre ? genreFilter : [],
  });

  const reset = () => {
    setPool(null);
    setStageIndex(0);
    setHistory([]);
    setResults(null);
    setError(null);
    setWheelTarget(null);
    setWheelLabels([]);
    setWheelCaption("");
  };

  const triggerSpin = (
    labels: string[],
    target: string,
    caption: string,
    apply: () => void,
  ) => {
    setWheelLabels(labels.slice(0, 40));
    setWheelTarget(target);
    setWheelCaption(caption);
    pendingApply.current = apply;
    setSpinKey((k) => k + 1);
  };

  const onSettled = () => {
    const fn = pendingApply.current;
    pendingApply.current = null;
    setBusy(false);
    fn?.();
  };

  const loadPool = async (includeGenre: boolean): Promise<Book[] | null> => {
    try {
      const res = await fetchCandidates(baseFilters(includeGenre));
      if (res.candidates.length === 0) {
        setError(
          "No books match these filters. Loosen them or pick another source.",
        );
        return null;
      }
      setError(null);
      return res.candidates;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load candidates");
      return null;
    }
  };

  // Land the wheel, then reveal up to 3 books to choose from.
  const finalSpin = (finalPool: Book[]) => {
    const picks = sample(finalPool, Math.min(3, finalPool.length));
    triggerSpin(
      finalPool.map((b) => b.title),
      picks[0].title,
      "Your shortlist",
      () => setResults(picks),
    );
  };

  const spinSingle = async () => {
    setBusy(true);
    reset();
    const candidates = await loadPool(true);
    if (!candidates) {
      setBusy(false);
      return;
    }
    setPool(candidates);
    finalSpin(candidates);
  };

  const spinChainedNext = async () => {
    setBusy(true);
    setError(null);

    let currentPool = pool;
    if (currentPool === null) {
      reset();
      const candidates = await loadPool(false);
      if (!candidates) {
        setBusy(false);
        return;
      }
      currentPool = candidates;
      setPool(candidates);
      setStageIndex(0);
    }

    const activeStages = STAGE_ORDER.filter((s) => stages.includes(s));
    let idx = stageIndex;
    while (
      idx < activeStages.length &&
      stageValues(currentPool!, activeStages[idx]).length <= 1
    ) {
      idx++;
    }

    if (idx < activeStages.length) {
      const stage = activeStages[idx];
      const values = stageValues(currentPool!, stage);
      const target = randomOf(values);
      const poolAtSpin = currentPool!;
      triggerSpin(values, target, `Spinning for ${STAGE_LABEL[stage]}`, () => {
        const narrowed = poolAtSpin.filter((b) =>
          matchesStage(b, stage, target),
        );
        setPool(narrowed);
        setHistory((h) => [
          ...h,
          {
            label: STAGE_LABEL[stage],
            value: target,
            remaining: narrowed.length,
          },
        ]);
        setStageIndex(idx + 1);
      });
    } else {
      finalSpin(currentPool!);
    }
  };

  const activeStages = STAGE_ORDER.filter((s) => stages.includes(s));
  const done = results !== null;
  const chainedFinalNext =
    pool !== null && stageIndex >= activeStages.length && !done;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold">Book Picker 🎡</h1>
        <p className="text-sm text-ink/50">
          Filter your books, then let the roulette shortlist your next read.
        </p>
      </div>

      {/* Mode switch */}
      <div className="inline-flex rounded-full border border-ink/15 p-1 bg-surface">
        {(["single", "chained"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              reset();
            }}
            className={`px-4 py-1.5 rounded-full text-sm ${
              mode === m ? "bg-accent text-parchment" : "text-ink/60"
            }`}
          >
            {m === "single" ? "Filter → Spin" : "Chained roulettes"}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid sm:grid-cols-2 gap-6 card p-5">
        <div className="space-y-3">
          <Field label="Source">
            <div className="inline-flex rounded-full border border-ink/15 p-1 bg-surface mb-2">
              <button
                onClick={() => setWholeLibrary(true)}
                className={`px-3 py-1 rounded-full text-xs ${wholeLibrary ? "bg-ink text-parchment" : "text-ink/60"}`}
              >
                Whole library
              </button>
              <button
                onClick={() => setWholeLibrary(false)}
                className={`px-3 py-1 rounded-full text-xs ${!wholeLibrary ? "bg-ink text-parchment" : "text-ink/60"}`}
              >
                Specific shelves
              </button>
            </div>
            {!wholeLibrary && (
              <div className="flex flex-wrap gap-1.5">
                {(shelvesData?.shelves ?? []).map((s) => {
                  const on = statuses.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      aria-pressed={on}
                      onClick={() =>
                        setStatuses((ss) =>
                          on ? ss.filter((x) => x !== s.key) : [...ss, s.key],
                        )
                      }
                      className={`px-2.5 py-1 rounded-full text-xs border ${
                        on
                          ? "bg-ink text-parchment border-ink"
                          : "border-ink/20 text-ink/60"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Min pages">
              <NumInput
                label="Minimum pages"
                value={minPages}
                onChange={setMinPages}
                placeholder="0"
              />
            </Field>
            <Field label="Max pages">
              <NumInput
                label="Maximum pages"
                value={maxPages}
                onChange={setMaxPages}
                placeholder="∞"
              />
            </Field>
            <Field label="From year">
              <NumInput
                label="From year"
                value={minYear}
                onChange={setMinYear}
                placeholder="e.g. 1900"
              />
            </Field>
            <Field label="To year">
              <NumInput
                label="To year"
                value={maxYear}
                onChange={setMaxYear}
                placeholder="e.g. 2020"
              />
            </Field>
          </div>

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={physicalOnly}
                onChange={(e) => setPhysicalOnly(e.target.checked)}
              />
              Physical only
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
              />
              Unread only
            </label>
          </div>
        </div>

        <div className="space-y-3">
          {mode === "single" ? (
            <Field label="Genres (optional — matches any)">
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {(genresData?.genres ?? []).map((g) => {
                  const on = genreFilter.includes(g.name);
                  return (
                    <button
                      key={g.name}
                      aria-pressed={on}
                      onClick={() =>
                        setGenreFilter((gs) =>
                          on ? gs.filter((x) => x !== g.name) : [...gs, g.name],
                        )
                      }
                      className={`px-2.5 py-1 rounded-full text-xs border ${
                        on
                          ? "bg-accent text-parchment border-accent"
                          : "border-ink/20 text-ink/60"
                      }`}
                    >
                      {g.name} <span className="opacity-50">{g.count}</span>
                    </button>
                  );
                })}
                {(genresData?.genres ?? []).length === 0 && (
                  <span className="text-xs text-ink/40">
                    Add books to see genres.
                  </span>
                )}
              </div>
            </Field>
          ) : (
            <Field label="Roulette chain — spin these in order">
              <div className="space-y-1.5">
                {STAGE_ORDER.map((s) => {
                  const on = stages.includes(s);
                  return (
                    <label key={s} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setStages((st) =>
                            on ? st.filter((x) => x !== s) : [...st, s],
                          )
                        }
                      />
                      {STAGE_LABEL[s]} roulette
                    </label>
                  );
                })}
                <p className="text-xs text-ink/40 pt-1">
                  Each spin randomly narrows by{" "}
                  {activeStages
                    .map((s) => STAGE_LABEL[s].toLowerCase())
                    .join(", ") || "a value"}
                  , then the final spin shortlists up to 3 books.
                </p>
              </div>
            </Field>
          )}
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Action + wheel */}
      <div className="space-y-5">
        {mode === "single" ? (
          <button
            onClick={spinSingle}
            disabled={busy}
            className="btn-primary px-6 py-3 font-semibold"
          >
            {busy ? "Spinning…" : "🎡 Spin"}
          </button>
        ) : (
          <div className="flex gap-3 flex-wrap items-center">
            <button
              onClick={spinChainedNext}
              disabled={busy || done}
              className="btn-primary px-6 py-3 font-semibold"
            >
              {busy
                ? "Spinning…"
                : pool === null
                  ? "🎡 Start chain"
                  : chainedFinalNext
                    ? "🎯 Shortlist books"
                    : "🎡 Spin next"}
            </button>
            {pool !== null && (
              <button
                onClick={reset}
                className="btn-outline px-4 py-3 text-sm"
              >
                Start over
              </button>
            )}
            {pool !== null && !done && (
              <span className="text-sm text-ink/50">
                {pool.length} books in the pool
              </span>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {history.map((h, i) => (
              <span
                key={i}
                className="px-3 py-1 rounded-full bg-ink/5 text-xs text-ink/70"
              >
                {h.label}: <strong>{h.value}</strong> → {h.remaining} left
              </span>
            ))}
          </div>
        )}

        {spinKey > 0 && !done && (
          <RouletteWheel
            labels={wheelLabels}
            target={wheelTarget}
            spinKey={spinKey}
            caption={wheelCaption}
            onSettled={onSettled}
          />
        )}

        {results && <ResultChoices books={results} />}
      </div>
    </div>
  );
};
