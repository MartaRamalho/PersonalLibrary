import { FC, useRef, useState } from "react";
import { useImportGoodreads, type ImportSummary } from "../../api/hooks";

// Button + hidden file input to import a Goodreads CSV export.
export const ImportGoodreads: FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const importCsv = useImportGoodreads();
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setError(null);
    setSummary(null);
    try {
      const text = await file.text();
      const res = await importCsv.mutateAsync(text);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={importCsv.isPending}
        className="btn-outline text-sm disabled:opacity-50"
        title="Import your library from a Goodreads CSV export"
      >
        {importCsv.isPending ? "Importing…" : "📥 Import Goodreads CSV"}
      </button>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="mt-3 rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm">
          <p className="font-semibold mb-1">Import complete 🎉</p>
          <ul className="space-y-0.5 text-ink/70">
            <li>{summary.books_created} new books added to your library</li>
            {summary.books_matched > 0 && (
              <li>
                {summary.books_matched} already in your library (merged, not
                duplicated)
              </li>
            )}
            <li>
              {summary.reading_log_added} finished books logged in your reading
              years
            </li>
            <li className="text-ink/50">
              Sorted onto shelves:{" "}
              {Object.entries(summary.by_shelf)
                .map(([shelf, n]) => `${n} ${shelf}`)
                .join(", ")}
            </li>
          </ul>
          <p className="mt-2 text-xs text-ink/50">
            Read {summary.total_rows} rows from the export.
          </p>
        </div>
      )}
    </div>
  );
};
