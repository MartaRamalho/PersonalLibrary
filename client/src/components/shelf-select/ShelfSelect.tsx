import { FC } from "react";
import { useShelves } from "../../api/hooks";

interface Props {
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

// A <select> of the fixed shelves (Read / Reading / To Read / On Hold / Dropped).
// When `value` isn't a real shelf (e.g. an auto-saved "seen" book with
// status='none'), a leading placeholder is shown so the control renders sensibly.
export const ShelfSelect: FC<Props> = ({ value, onChange, className = "" }) => {
  const { data } = useShelves();
  const shelves = data?.shelves ?? [];
  const isShelved = shelves.some((s) => s.key === value);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`pill-select ${className}`}
    >
      {!isShelved && (
        <option value={value} disabled>
          — Not on a shelf —
        </option>
      )}
      {shelves.map((s) => (
        <option key={s.key} value={s.key}>
          {s.name}
        </option>
      ))}
    </select>
  );
};
