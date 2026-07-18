import { FC, useEffect, useState } from "react";
import { applyTheme, getInitialTheme, Theme } from "./ThemeToggle.utils";

export const ThemeToggle: FC = () => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const isDark = theme === "dark";
  const onToggle = () => setTheme(isDark ? "light" : "dark");

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className="rounded-full border border-ink/20 px-2.5 py-1.5 text-base leading-none transition-colors hover:border-accent"
    >
      <span aria-hidden="true">{isDark ? "☀️" : "🌙"}</span>
    </button>
  );
};
