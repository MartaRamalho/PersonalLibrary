export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — mirrors the server limit

// Client-side guard mirroring the server checks. Returns an error message, or
// null when the file is acceptable.
export const validateImage = (file: File): string | null => {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Use a JPEG, PNG, or WebP image.";
  }
  if (file.size > MAX_BYTES) {
    return "Image is too large (max 5 MB).";
  }
  return null;
};

// Read a File into a base64 data URL for JSON upload (mirrors the Goodreads
// import, which reads its file to a string in the component).
export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
