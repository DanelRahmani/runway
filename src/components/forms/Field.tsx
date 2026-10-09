import { cloneElement, type ReactElement, type ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  /** Must match the `id` of the control so the label is programmatically associated. */
  htmlFor: string;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Label + control + error message, wired for screen readers.
 *
 * The control is cloned to receive `id`, `aria-invalid` and `aria-describedby`,
 * so validation errors are announced rather than only shown in red.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  className,
  children,
}: FieldProps) {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;
  const describedBy = [error !== undefined ? errorId : null, hint !== undefined ? hintId : null]
    .filter((value): value is string => value !== null)
    .join(" ");

  const control =
    children !== null && children !== undefined && typeof children === "object" && "type" in children
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          id: htmlFor,
          "aria-invalid": error !== undefined ? true : undefined,
          "aria-describedby": describedBy === "" ? undefined : describedBy,
        })
      : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="text-muted-foreground font-normal">optional</span>
        )}
      </Label>
      {control}
      {hint !== undefined && error === undefined ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error !== undefined ? (
        <p id={errorId} role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
