import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type * as React from "react";

import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

interface IndicatorBox {
  left: number;
  width: number;
}

/**
 * Segmented control whose selection slides between tabs.
 *
 * Radix keeps the active marker on the trigger itself, which can only fade in
 * place — a slide needs to know where the previous tab *was*. So the pill is
 * measured off the active trigger and animated on `transform`, which the compositor
 * can handle without re-laying-out the row on every frame.
 *
 * Measurement is driven by observation rather than by a value prop, so callers do
 * not have to pass anything: a `MutationObserver` catches Radix flipping
 * `data-state`, and a `ResizeObserver` catches the row reflowing — which is what
 * happens when a label changes or the sidebar of a scenario count appears.
 * Position is set in a layout effect so the pill never lands a frame late.
 */
export function TabsList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<IndicatorBox | null>(null);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (list === null) return;
    const active = list.querySelector<HTMLElement>('[data-state="active"]');
    if (active === null) {
      setBox(null);
      return;
    }
    setBox({ left: active.offsetLeft, width: active.offsetWidth });
  }, []);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null) return;

    measure();

    const mutations = new MutationObserver(measure);
    mutations.observe(list, {
      attributes: true,
      attributeFilter: ["data-state"],
      subtree: true,
    });

    const resizes = new ResizeObserver(measure);
    resizes.observe(list);
    for (const child of list.children) resizes.observe(child);

    return () => {
      mutations.disconnect();
      resizes.disconnect();
    };
  }, [measure]);

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground relative inline-flex h-9 w-fit items-center justify-start gap-1 rounded-lg p-1",
        className,
      )}
      {...props}
    >
      {/* Decorative: the trigger beneath it already carries aria-selected. */}
      <span
        aria-hidden="true"
        data-slot="tabs-indicator"
        className="bg-accent/15 ring-accent/25 pointer-events-none absolute top-1 bottom-1 left-0 rounded-md ring-1 transition-[transform,width,opacity] duration-300 ease-out"
        style={
          {
            transform: `translateX(${box?.left ?? 0}px)`,
            width: box?.width ?? 0,
            opacity: box === null ? 0 : 1,
          } as CSSProperties
        }
      />
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // Sits above the sliding pill, which is absolutely positioned behind the row.
        "relative z-10 inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors",
        "text-muted-foreground hover:text-foreground",
        "data-[state=active]:text-foreground",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}
