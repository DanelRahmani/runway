import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A non-modal panel that slides in from the right.
 *
 * Deliberately *not* modal. The point of a peek panel is to consult the graph
 * while still working on the page behind it, so this one leaves the rest of the
 * app interactive and refuses to close on an outside click — otherwise reaching
 * for a form field would dismiss it. Escape and the close button both still work,
 * which is what makes that safe for keyboard users.
 */
export function Drawer({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root modal={false} {...props} />;
}

export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

export function DrawerContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showCloseButton?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Content
        data-slot="drawer-content"
        // A crisp border rather than heavy elevation: the panel should read as a
        // seam in the page, not a floating layer above it.
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l duration-200",
          className,
        )}
        // Keep the panel open when the user works elsewhere on the page.
        onInteractOutside={(event) => event.preventDefault()}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            className="ring-offset-background focus:ring-ring text-muted-foreground hover:text-foreground absolute top-4 right-4 rounded-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
            aria-label="Close panel"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1 border-b px-5 py-4 pr-12 text-left", className)}
      {...props}
    />
  );
}

export function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("font-display text-lg leading-tight tracking-tight", className)}
      {...props}
    />
  );
}

export function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-muted-foreground text-xs leading-relaxed", className)}
      {...props}
    />
  );
}
