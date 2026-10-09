import type * as React from "react";

import { cn } from "@/lib/utils";

type AlertVariant = "default" | "destructive" | "positive" | "warning";

const variantClasses: Record<AlertVariant, string> = {
  default: "bg-card text-card-foreground",
  destructive: "border-destructive/40 bg-negative-muted text-negative",
  positive: "border-positive/40 bg-positive-muted text-positive",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export function Alert({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: AlertVariant }) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(
        "relative grid w-full grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-sm",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("col-start-2 font-medium", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("col-start-2 text-sm leading-relaxed [&_p]:leading-relaxed", className)}
      {...props}
    />
  );
}

export function AlertIcon({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("row-span-2 mt-0.5 [&_svg]:size-4", className)} {...props} />;
}
