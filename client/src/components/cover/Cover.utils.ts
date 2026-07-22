import type { Book } from "../../api/types";

// The cover to display for a library book: the uploaded custom cover when one
// exists (served by the backend), otherwise the original Open Library URL. The
// `?v=` token changes on each upload so the browser fetches the new image.
export const bookCoverSrc = (
  book: Pick<Book, "id" | "cover_url" | "custom_cover">,
): string | null =>
  book.custom_cover
    ? `/api/books/${book.id}/cover?v=${encodeURIComponent(book.custom_cover)}`
    : book.cover_url;
