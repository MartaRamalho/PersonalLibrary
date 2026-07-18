// Load server/.env into process.env if present (Node >= 20.12, dependency-free).
// Imported first so GOOGLE_BOOKS_API_KEY is available to every request handler.
try {
  process.loadEnvFile();
} catch {
  // No .env file — that's fine; the key may be set in the environment, or unset
  // (Google Books then runs keyless with a lower quota).
}
