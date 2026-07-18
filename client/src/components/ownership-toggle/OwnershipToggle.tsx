import { FC } from "react";
import type { Book } from "../../api/types";
import { useUpdateBook } from "../../api/hooks";

interface Props {
  book: Book;
}

// Toggle whether the user owns a physical and/or digital copy of a book.
export const OwnershipToggle: FC<Props> = ({ book }) => {
  const update = useUpdateBook();

  const Btn = ({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={update.isPending}
      className={`px-2.5 py-1 rounded-full text-xs border transition-colors disabled:opacity-50 ${
        active
          ? "bg-ink text-parchment border-ink"
          : "bg-transparent text-ink/60 border-ink/20 hover:border-ink/50"
      }`}
    >
      {active ? "✓ " : ""}
      {label}
    </button>
  );

  return (
    <div className="flex gap-1.5">
      <Btn
        active={book.owned_physical}
        label="Physical"
        onClick={() =>
          update.mutate({ id: book.id, owned_physical: !book.owned_physical })
        }
      />
      <Btn
        active={book.owned_digital}
        label="Digital"
        onClick={() =>
          update.mutate({ id: book.id, owned_digital: !book.owned_digital })
        }
      />
    </div>
  );
};
