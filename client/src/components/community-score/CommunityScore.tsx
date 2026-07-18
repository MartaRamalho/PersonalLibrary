import { FC } from "react";
import { StarRating } from "../star-rating/StarRating";

interface Props {
  rating: number | null;
  count: number | null;
  size?: number;
}

// Read-only display of the Google Books community score, distinct from the
// user's own rating. Renders nothing when there's no score.
export const CommunityScore: FC<Props> = ({ rating, count, size = 15 }) => {
  if (rating == null) return null;
  return (
    <span
      className="inline-flex items-center gap-1"
      title="Community rating from Google Books"
    >
      <StarRating value={rating} readOnly size={size} />
      {count != null && count > 0 && (
        <span className="text-xs text-ink/40">({count.toLocaleString()})</span>
      )}
    </span>
  );
};
