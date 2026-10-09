import { categoryEmoji, UNCATEGORISED_LABEL } from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * A category with its emoji.
 *
 * The emoji is `aria-hidden` because it adds nothing a screen reader user needs:
 * the label carries the meaning, and reading "house emoji Housing" is noise.
 */
export function CategoryLabel({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const emoji = categoryEmoji(category);
  const isUncategorised = category === UNCATEGORISED_LABEL;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {emoji !== null ? <span aria-hidden="true">{emoji}</span> : null}
      <span className={cn(isUncategorised && "text-muted-foreground/70 italic")}>{category}</span>
    </span>
  );
}
