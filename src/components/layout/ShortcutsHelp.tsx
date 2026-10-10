import { KeyboardIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * A shortcut nobody can find is a shortcut nobody uses.
 *
 * Kept to the keys that actually do something, because a list padded with
 * aspirational entries is worse than a short one: it teaches people the help
 * cannot be trusted.
 */
const SHORTCUTS: ReadonlyArray<{ keys: string; description: string }> = [
  { keys: "N", description: "Add a recurring item, one-off item or invoice, on those tabs" },
  { keys: "Esc", description: "Clear the rows ticked for a bulk change" },
  { keys: "?", description: "Show this list" },
];

export function ShortcutsHelp({ open, onOpenChange }: ShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyboardIcon className="size-4" />
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Nothing here fires while you are typing, so a key never interrupts a field.
          </DialogDescription>
        </DialogHeader>

        <dl className="flex flex-col gap-2.5">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="flex items-start gap-3">
              <dt className="shrink-0">
                <kbd className="bg-muted rounded border px-1.5 py-0.5 font-mono text-xs">
                  {shortcut.keys}
                </kbd>
              </dt>
              <dd className="text-muted-foreground text-xs leading-relaxed">
                {shortcut.description}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
