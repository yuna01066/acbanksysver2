import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, GripVertical, CheckCircle2 } from "lucide-react";
import { ProcessingCategory } from "@/hooks/useProcessingCategories";

interface SortableCategoryItemProps {
  category: ProcessingCategory;
  isSelected: boolean;
  Icon: any;
  onSelect: (categoryKey: string) => void;
  onEdit: (category: ProcessingCategory) => void;
  onDelete: (id: string) => void;
}

export const SortableCategoryItem = ({
  category,
  isSelected,
  Icon,
  onSelect,
  onEdit,
  onDelete,
}: SortableCategoryItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <button
        onClick={() => onSelect(category.category_key)}
        className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
          isSelected
            ? 'bg-primary/10 border-primary shadow-md'
            : 'bg-background border-border hover:border-primary/30'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted/50 rounded"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          <Icon className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">{category.category_name}</span>
          {isSelected && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
        </div>
      </button>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => onEdit(category)}
        >
          <Pencil className="w-3 h-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(category.id)}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};
