// ---------------------------------------------------------------------------
// Shelves (a.k.a. "lists"). This is the single source of truth for the fixed
// set of shelves and their display names. To rename a shelf, edit `name` here.
// To add/remove a shelf, edit this array (keep `key` stable & url-safe).
// ---------------------------------------------------------------------------

export interface Shelf {
  key: string; // stable, url-safe identifier (do not change casually)
  name: string; // display name (safe to change anytime)
}

export const SHELVES: Shelf[] = [
  { key: "read", name: "Read" },
  { key: "reading", name: "Reading" },
  { key: "to-read", name: "To Read" },
  { key: "on-hold", name: "On Hold" },
  { key: "dropped", name: "Dropped" },
];

// The shelf a newly added book lands on by default.
export const DEFAULT_SHELF = "to-read";

// Special shelf keys that drive date + reading-year behaviour.
export const READING_SHELF = "reading";
export const READ_SHELF = "read";

export const SHELF_KEYS = SHELVES.map((s) => s.key);

export function isValidShelf(key: string): boolean {
  return SHELF_KEYS.includes(key);
}
