import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";

// Custom book covers are stored on disk (not in the DB), one file per book id,
// named `<id>.<ext>`. The `books.custom_cover` column holds "<token>.<ext>",
// where the token changes on every upload so the client can cache-bust.

const __dirname = dirname(fileURLToPath(import.meta.url));
export const COVERS_DIR = join(__dirname, "..", "data", "covers");
mkdirSync(COVERS_DIR, { recursive: true });

export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const contentTypeForExt = (ext: string): string | undefined =>
  CONTENT_TYPE_BY_EXT[ext];

export const coverPath = (id: number, ext: string): string =>
  join(COVERS_DIR, `${id}.${ext}`);

// Delete any stored cover file for this book (handles a changed extension).
export const removeCover = (id: number): void => {
  let entries: string[];
  try {
    entries = readdirSync(COVERS_DIR);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === `${id}.jpg` || name === `${id}.png` || name === `${id}.webp`) {
      rmSync(join(COVERS_DIR, name), { force: true });
    }
  }
};

// Parse a `data:<mime>;base64,<data>` URL, validate type + size, write the file,
// and return the "<token>.<ext>" value to store in `custom_cover`. Throws on
// invalid input (the route turns this into a 400).
export const writeCover = (id: number, dataUrl: unknown): string => {
  if (typeof dataUrl !== "string") {
    throw new Error("No image provided");
  }
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) {
    throw new Error("Expected a base64 image data URL");
  }
  const [, mime, base64] = match;
  const ext = EXT_BY_MIME[mime];
  if (!ext) {
    throw new Error("Unsupported image type — use JPEG, PNG, or WebP");
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    throw new Error("Image data is empty");
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error("Image is too large (max 5 MB)");
  }

  removeCover(id); // clear any previous cover (possibly a different extension)
  writeFileSync(coverPath(id, ext), buffer);

  const token = Date.now().toString(36);
  return `${token}.${ext}`;
};
