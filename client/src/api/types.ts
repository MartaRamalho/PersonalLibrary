export interface Book {
  id: number;
  ol_key: string;
  title: string;
  authors: string[];
  publisher: string | null;
  cover_url: string | null;
  custom_cover: string | null;
  first_publish_year: number | null;
  page_count: number | null;
  subjects: string[];
  description: string | null;
  isbn: string | null;
  owned_physical: boolean;
  owned_digital: boolean;
  status: string;
  start_date: string | null;
  finish_date: string | null;
  rating: number | null;
  review: string | null;
  ratings_average: number | null;
  ratings_count: number | null;
  created_at: string;
}

export interface SearchResult {
  ol_key: string;
  title: string;
  authors: string[];
  cover_url: string | null;
  first_publish_year: number | null;
  page_count: number | null;
  subjects: string[];
  isbn: string | null;
  ratings_average: number | null;
  ratings_count: number | null;
  in_library: boolean;
  book_id: number | null;
}

export interface Shelf {
  key: string;
  name: string;
  count?: number;
}

export interface ReadingEntry {
  entry_id: number;
  rank_position: number;
  book: Book;
}

export interface YearSummary {
  year: number;
  count: number;
}

export interface Genre {
  name: string;
  count: number;
}

export interface PickerFilters {
  statuses?: string[];
  min_pages?: number | null;
  max_pages?: number | null;
  subjects?: string[];
  min_year?: number | null;
  max_year?: number | null;
  physical_only?: boolean;
  unread_only?: boolean;
}
