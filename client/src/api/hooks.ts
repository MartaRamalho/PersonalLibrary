import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Book,
  Genre,
  PickerFilters,
  ReadingEntry,
  SearchResult,
  Shelf,
  YearSummary,
} from "./types";

export const useSearch = (query: string) => {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () =>
      api.get<{ results: SearchResult[] }>(
        `/api/search?q=${encodeURIComponent(query)}`,
      ),
    enabled: query.trim().length > 0,
    staleTime: 60_000,
  });
};

export interface DescriptionQuery {
  ol_key?: string | null;
  isbn?: string | null;
  title?: string;
  author?: string;
}

export const useWorkDescription = (q: DescriptionQuery | null) => {
  const params = new URLSearchParams();
  if (q?.ol_key) params.set("ol_key", q.ol_key);
  if (q?.isbn) params.set("isbn", q.isbn);
  if (q?.title) params.set("title", q.title);
  if (q?.author) params.set("author", q.author);
  const qs = params.toString();
  return useQuery({
    queryKey: ["work", qs],
    queryFn: () =>
      api.get<{ description: string | null }>(`/api/search/work?${qs}`),
    enabled: !!(q && (q.title || q.isbn)),
    staleTime: 300_000,
  });
};

// ---- Shelves -------------------------------------------------------------

export const useShelves = () => {
  return useQuery({
    queryKey: ["shelves"],
    queryFn: () =>
      api.get<{ default: string; shelves: Shelf[] }>("/api/shelves"),
    staleTime: 30_000,
  });
};

export const useShelfBooks = (key: string) => {
  return useQuery({
    queryKey: ["shelf", key],
    queryFn: () =>
      api.get<{ shelf: Shelf; books: Book[] }>(`/api/shelves/${key}/books`),
    enabled: !!key,
  });
};

// ---- Library / books -----------------------------------------------------

export const useLibrary = () => {
  return useQuery({
    queryKey: ["books"],
    queryFn: () => api.get<{ books: Book[] }>("/api/books"),
  });
};

export const useBook = (id: number) => {
  return useQuery({
    queryKey: ["book", id],
    queryFn: () =>
      api.get<{
        book: Book;
        reading_years: { year: number; rank_position: number }[];
      }>(`/api/books/${id}`),
    enabled: Number.isFinite(id),
  });
};

const invalidateBookViews = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ["books"] });
  qc.invalidateQueries({ queryKey: ["shelf"] });
  qc.invalidateQueries({ queryKey: ["shelves"] });
  qc.invalidateQueries({ queryKey: ["reading-years"] });
  qc.invalidateQueries({ queryKey: ["reading-year"] });
};

export const useAddBook = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: SearchResult & {
        ol_key: string;
        title: string;
        status?: string;
      },
    ) => api.post<{ book: Book; created: boolean }>("/api/books", payload),
    onSuccess: () => {
      invalidateBookViews(qc);
      qc.invalidateQueries({ queryKey: ["search"] });
    },
  });
};

export const useUpdateBook = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & Partial<Book>) =>
      api.patch<{ book: Book }>(`/api/books/${id}`, patch),
    onSuccess: (_data, vars) => {
      invalidateBookViews(qc);
      qc.invalidateQueries({ queryKey: ["book", vars.id] });
      qc.invalidateQueries({ queryKey: ["genres"] });
    },
  });
};

export const useDeleteBook = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/api/books/${id}`),
    onSuccess: () => invalidateBookViews(qc),
  });
};

// Upload a custom cover (base64 data URL) for a book, replacing any previous one.
export const useUploadCover = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, image }: { id: number; image: string }) =>
      api.post<{ book: Book }>(`/api/books/${id}/cover`, { image }),
    onSuccess: (_data, vars) => {
      invalidateBookViews(qc);
      qc.invalidateQueries({ queryKey: ["book", vars.id] });
    },
  });
};

// Remove the custom cover, reverting to the original Open Library cover.
export const useRemoveCover = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del<{ book: Book }>(`/api/books/${id}/cover`),
    onSuccess: (_data, id) => {
      invalidateBookViews(qc);
      qc.invalidateQueries({ queryKey: ["book", id] });
    },
  });
};

// ---- Reading log ---------------------------------------------------------

export const useReadingYears = () => {
  return useQuery({
    queryKey: ["reading-years"],
    queryFn: () => api.get<{ years: YearSummary[] }>("/api/reading-log/years"),
  });
};

export const useReadingYear = (year: number) => {
  return useQuery({
    queryKey: ["reading-year", year],
    queryFn: () =>
      api.get<{ year: number; entries: ReadingEntry[] }>(
        `/api/reading-log?year=${year}`,
      ),
    enabled: Number.isFinite(year),
  });
};

export const useAddToYear = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, year }: { bookId: number; year: number }) =>
      api.post("/api/reading-log", { book_id: bookId, year }),
    onSuccess: () => invalidateBookViews(qc),
  });
};

export const useRemoveFromYear = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId }: { entryId: number; year: number }) =>
      api.del(`/api/reading-log/${entryId}`),
    onSuccess: () => invalidateBookViews(qc),
  });
};

export const useReorderYear = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ year, entryIds }: { year: number; entryIds: number[] }) =>
      api.patch("/api/reading-log/reorder", { year, entry_ids: entryIds }),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: ["reading-year", vars.year] }),
  });
};

// ---- Genres & picker -----------------------------------------------------

export const useGenres = () => {
  return useQuery({
    queryKey: ["genres"],
    queryFn: () => api.get<{ genres: Genre[] }>("/api/genres"),
  });
};

export const fetchCandidates = (filters: PickerFilters) => {
  return api.post<{ candidates: Book[]; count: number }>(
    "/api/picker/candidates",
    filters,
  );
};

// ---- Import --------------------------------------------------------------

export interface ImportSummary {
  total_rows: number;
  books_created: number;
  books_matched: number;
  reading_log_added: number;
  by_shelf: Record<string, number>;
}

export const useImportGoodreads = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) =>
      api.post<{ summary: ImportSummary; library_total: number }>(
        "/api/import/goodreads",
        { csv },
      ),
    onSuccess: () => {
      invalidateBookViews(qc);
      qc.invalidateQueries({ queryKey: ["genres"] });
    },
  });
};
