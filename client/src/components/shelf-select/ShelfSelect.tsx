import { FC } from "react";
import { useShelves } from "../../api/hooks";

interface Props {
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

// A <select> of the fixed shelves (Read / Reading / To Read / On Hold / Dropped).
export const ShelfSelect: FC<Props> = ({ value, onChange, className = "" }) => {
  const { data } = useShelves();
  const shelves = data?.shelves ?? [];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`pill-select ${className}`}
    >
      {shelves.map((s) => (
        <option key={s.key} value={s.key}>
          {s.name}
        </option>
      ))}
    </select>
  );
};
