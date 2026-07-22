import { FC } from "react";
import { Link } from "react-router-dom";
import { useLibrary, useRecentViews, useShelves } from "../../api/hooks";
import { Cover } from "../../components/cover/Cover";
import { bookCoverSrc } from "../../components/cover/Cover.utils";

const Stat: FC<{ label: string; value: number; to: string }> = ({
  label,
  value,
  to,
}) => (
  <Link
    to={to}
    className="card card-hover p-5 text-center"
  >
    <div className="text-3xl font-bold">{value}</div>
    <div className="text-sm text-ink/60 mt-1">{label}</div>
  </Link>
);

export const Dashboard = () => {
  const { data: lib } = useLibrary();
  const { data: shelvesData } = useShelves();
  const { data: recentViews } = useRecentViews(8);

  const books = lib?.books ?? [];
  const recent = books.slice(0, 8);
  const seen = recentViews?.books ?? [];
  const shelfCount = (key: string) =>
    shelvesData?.shelves.find((s) => s.key === key)?.count ?? 0;

  return (
    <div className="space-y-10">
      <section className="text-center py-8">
        <h1 className="font-display text-4xl font-bold">Your Personal Library</h1>
        <p className="mt-2 text-ink/60">
          Search, shelve, rank, and let the roulette pick your next read.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/search" className="btn-primary px-5 py-2.5">
            Find a book
          </Link>
          <Link to="/picker" className="btn-outline px-5 py-2.5">
            🎡 Pick my next read
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4">
        <Stat label="Books in library" value={books.length} to="/shelves" />
        <Stat label="Read" value={shelfCount("read")} to="/shelf/read" />
        <Stat
          label="To read"
          value={shelfCount("to-read")}
          to="/shelf/to-read"
        />
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold mb-3">
            Recently added
          </h2>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {recent.map((b) => (
              <Link key={b.id} to={`/book/${b.id}`} title={b.title}>
                <Cover
                  url={bookCoverSrc(b)}
                  title={b.title}
                  className="w-full aspect-[2/3] rounded-md shadow-sm"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {seen.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold mb-1">
            Recently viewed
          </h2>
          <p className="text-sm text-ink/50 mb-3">
            Books you opened but haven’t added to a shelf yet.
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {seen.map((b) => (
              <Link key={b.id} to={`/book/${b.id}`} title={b.title}>
                <Cover
                  url={bookCoverSrc(b)}
                  title={b.title}
                  className="w-full aspect-[2/3] rounded-md shadow-sm"
                />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
