import { FC } from "react";
import { Link } from "react-router-dom";
import { useShelves } from "../../api/hooks";

export const Shelves: FC = () => {
  const { data, isLoading } = useShelves();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Your Shelves</h1>
        <p className="text-sm text-ink/50">
          Every book lives on exactly one shelf.
        </p>
      </div>

      {isLoading && <p className="text-ink/50">Loading…</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {data?.shelves.map((s) => (
          <Link
            key={s.key}
            to={`/shelf/${s.key}`}
            className="card card-hover p-5"
          >
            <h3 className="font-display font-semibold text-lg">{s.name}</h3>
            <p className="text-sm text-ink/50 mt-1">
              {s.count} book{s.count === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
};
