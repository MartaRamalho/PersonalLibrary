import { useEffect, useState } from "react";

// Debounce a rapidly-changing value (e.g. a search input) so the DB lookup only
// fires after the user pauses typing.
export const useDebouncedValue = <T>(value: T, delayMs = 150): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
};
