import { FC, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useImportGoodreads,
  useImportStatus,
  type ImportSummary,
} from "../../api/hooks";

// Button + hidden file input to import a Goodreads CSV export. After the CSV is
// imported, books are enriched with API data in the background; we poll and show
// progress, then refresh the affected views when it completes.
export const ImportGoodreads: FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const importCsv = useImportGoodreads();
  const qc = useQueryClient();
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: status } = useImportStatus(jobId);

  // When enrichment finishes, refresh covers, genres and descriptions.
  useEffect(() => {
    if (status?.done) {
      qc.invalidateQueries({ queryKey: ["books"] });
      qc.invalidateQueries({ queryKey: ["shelf"] });
      qc.invalidateQueries({ queryKey: ["shelves"] });
      qc.invalidateQueries({ queryKey: ["genres"] });
      qc.invalidateQueries({ queryKey: ["book"] });
      qc.invalidateQueries({ queryKey: ["recent-views"] });
    }
  }, [status?.done, qc]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setError(null);
    setSummary(null);
    setJobId(null);
    try {
      const text = await file.text();
      const res = await importCsv.mutateAsync(text);
      setSummary(res.summary);
      setJobId(res.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  const pct =
    status && status.total > 0
      ? Math.round((status.enriched / status.total) * 100)
      : 0;

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

          {status && status.total > 0 && (
            <div className="mt-3 border-t border-accent/20 pt-3">
              <div className="flex items-center justify-between text-xs text-ink/60 mb-1">
                <span>
                  {status.done
                    ? "✓ Enrichment complete"
                    : `Enriching ${status.enriched}/${status.total}…`}
                </span>
                <span>{pct}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Enriching imported books with cover art and details"
                aria-valuemin={0}
                aria-valuemax={status.total}
                aria-valuenow={status.enriched}
                className="h-2 w-full overflow-hidden rounded-full bg-ink/10"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
