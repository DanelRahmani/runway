import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  // Tag pills sit in the engraved-label register, so they use the mono face.
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[0.6875rem] font-medium tracking-wide whitespace-nowrap uppercase [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border-strong text-foreground",
        accent: "border-transparent bg-negative-muted text-accent-text",
        positive: "border-transparent bg-positive-muted text-positive",
        negative: "border-transparent bg-negative-muted text-negative",
        muted: "border-transparent bg-secondary text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
