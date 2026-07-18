// Google Books is used ONLY to fetch descriptions (Open Library is the search
// source). An API key (GOOGLE_BOOKS_API_KEY) is optional but recommended for quota.
// Docs: https://developers.google.com/books/docs/v1/using

const BASE = "https://www.googleapis.com/books/v1/volumes";

// Appended to every request; empty when no key is configured.
function keyParam(): string {
  const k = process.env.GOOGLE_BOOKS_API_KEY;
  return k ? `&key=${encodeURIComponent(k)}` : "";
}

interface GVolume {
  volumeInfo?: { description?: string };
}
interface GSearchResponse {
  items?: GVolume[];
}

export interface DescriptionQuery {
  isbn?: string | null;
  title: string;
  author?: string;
}

// Best-effort description, matched by ISBN (preferred) or title + author.
// Returns null on quota/network errors so callers can fall back gracefully.
export async function fetchDescription(
  q: DescriptionQuery,
): Promise<string | null> {
  const query = q.isbn
    ? `isbn:${q.isbn}`
    : `intitle:${q.title}${q.author ? `+inauthor:${q.author}` : ""}`;
  try {
    const url = `${BASE}?q=${encodeURIComponent(query)}&maxResults=1&printType=books&country=US${keyParam()}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as GSearchResponse;
    return data.items?.[0]?.volumeInfo?.description ?? null;
  } catch {
    return null;
  }
}
