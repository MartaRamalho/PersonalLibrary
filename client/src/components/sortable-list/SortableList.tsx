import { ReactNode, useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Props<T> {
  items: T[];
  getId: (item: T) => number;
  renderItem: (item: T, index: number) => ReactNode;
  onReorder: (orderedIds: number[]) => void;
}

const Row = ({ id, children }: { id: number; children: ReactNode }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch gap-2">
      <button
        type="button"
        className="shrink-0 cursor-grab active:cursor-grabbing px-1 text-ink/30 hover:text-ink/70 touch-none"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <div className="flex-1">{children}</div>
    </div>
  );
};

// Generic vertical drag-to-reorder list. Keeps a local copy so reordering feels
// instant, and reports the new order of ids to the parent to persist.
export const SortableList = <T,>({
  items,
  getId,
  renderItem,
  onReorder,
}: Props<T>) => {
  const [order, setOrder] = useState<T[]>(items);

  useEffect(() => {
    setOrder(items);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex((i) => getId(i) === active.id);
    const newIndex = order.findIndex((i) => getId(i) === over.id);
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    onReorder(next.map(getId));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={order.map(getId)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {order.map((item, index) => (
            <Row key={getId(item)} id={getId(item)}>
              {renderItem(item, index)}
            </Row>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
