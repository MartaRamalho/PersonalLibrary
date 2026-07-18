import { FC } from "react";
import { clamp } from "./StarRating.utils";

interface Props {
  value: number | null; // 0–5 in 0.5 steps
  onChange?: (value: number | null) => void;
  readOnly?: boolean;
  size?: number; // px
}

// Interactive 5-star rating with half-star precision. Click the left half of a
// star for x.5, the right half for x.0. Clears to unrated with the × button.
export const StarRating: FC<Props> = ({
  value,
  onChange,
  readOnly,
  size = 22,
}) => {
  const v = value ?? 0;
  const interactive = !readOnly && !!onChange;

  return (
    <span
      className="inline-flex items-center gap-0.5"
      style={{ fontSize: size, lineHeight: 1 }}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = clamp(v - i); // 0, 0.5 or 1
        return (
          <span
            key={i}
            className="relative inline-block"
            style={{ width: "1em", height: "1em" }}
          >
            <span
              className="absolute inset-0 overflow-hidden text-ink/20"
              style={{ width: "1em" }}
            >
              ★
            </span>
            <span
              className="absolute inset-0 overflow-hidden text-brass"
              style={{ width: `${fill}em` }}
            >
              ★
            </span>
            {interactive && (
              <>
                <button
                  type="button"
                  onClick={() => onChange!(i + 0.5)}
                  className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                  aria-label={`${i + 0.5} stars`}
                />
                <button
                  type="button"
                  onClick={() => onChange!(i + 1)}
                  className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                  aria-label={`${i + 1} stars`}
                />
              </>
            )}
          </span>
        );
      })}
      {interactive && value != null && (
        <button
          type="button"
          onClick={() => onChange!(null)}
          className="ml-1 text-ink/40 hover:text-ink"
          style={{ fontSize: size * 0.7 }}
          aria-label="Clear rating"
        >
          ×
        </button>
      )}
      {readOnly && value != null && (
        <span className="ml-1 text-ink/50" style={{ fontSize: size * 0.6 }}>
          {value.toFixed(1).replace(/\.0$/, "")}
        </span>
      )}
    </span>
  );
};
