import type { Book } from "../../api/types";

export type Mode = "single" | "chained";
export type Stage = "genre" | "decade" | "length";

export const STAGE_ORDER: Stage[] = ["genre", "decade", "length"];
export const STAGE_LABEL: Record<Stage, string> = {
  genre: "Genre",
  decade: "Decade",
  length: "Length",
};

export const bookDecade = (b: Book): string | null => {
  if (!b.first_publish_year) return null;
  return `${Math.floor(b.first_publish_year / 10) * 10}s`;
};

export const bookLength = (b: Book): string => {
  if (b.page_count == null) return "Unknown length";
  if (b.page_count < 250) return "Short (<250p)";
  if (b.page_count <= 450) return "Medium (250–450p)";
  return "Long (>450p)";
};

export const stageValues = (pool: Book[], stage: Stage): string[] => {
  if (stage === "genre") {
    const seen = new Map<string, string>();
    for (const b of pool)
      for (const s of b.subjects) {
        const key = s.toLowerCase();
        if (!seen.has(key)) seen.set(key, s);
      }
    return [...seen.values()];
  }
  if (stage === "decade") {
    return [
      ...new Set(pool.map(bookDecade).filter((d): d is string => !!d)),
    ].sort();
  }
  return [...new Set(pool.map(bookLength))];
};

export const matchesStage = (b: Book, stage: Stage, value: string): boolean => {
  if (stage === "genre")
    return b.subjects.some((s) => s.toLowerCase() === value.toLowerCase());
  if (stage === "decade") return bookDecade(b) === value;
  return bookLength(b) === value;
};

export const randomOf = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

export const sample = <T>(arr: T[], n: number): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
};
