export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

// Resolve the theme to use on load: an explicit stored choice wins, otherwise
// fall back to the OS preference. Kept in sync with the inline pre-paint script
// in index.html (which reads the same key).
export const getInitialTheme = (): Theme => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

// Toggle the `dark` class on <html> and persist the choice.
export const applyTheme = (theme: Theme): void => {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(STORAGE_KEY, theme);
};
