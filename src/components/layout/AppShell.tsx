import { AlertTriangleIcon, InfoIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Disclaimer } from "@/components/layout/Disclaimer";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Alert, AlertDescription, AlertIcon } from "@/components/ui/alert";
import { useForecasts } from "@/lib/storage/forecasts";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: ReactNode;
  /** Extra element for the header's right-hand action slot. */
  actions?: ReactNode;
  /** Widen the container for the dashboard's chart and tables. */
  wide?: boolean;
}

export function AppShell({ children, actions, wide = false }: AppShellProps) {
  const { status } = useForecasts();

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <a
        href="#main"
        className="bg-background focus:ring-ring sr-only rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:ring-2"
      >
        Skip to content
      </a>

      <header className="bg-background/85 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
        <div
          className={cn(
            "mx-auto flex h-14 w-full items-center gap-3 px-4 sm:px-6",
            wide ? "max-w-6xl" : "max-w-5xl",
          )}
        >
          <a href="/" className="flex items-center gap-2" aria-label="Runway home">
            <RunwayMark />
            <span className="text-sm font-semibold tracking-tight">Runway</span>
          </a>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {!status.available ? (
        <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6">
          <Alert variant="warning">
            <AlertIcon>
              <AlertTriangleIcon />
            </AlertIcon>
            <AlertDescription>
              <strong className="font-medium">Changes will not be saved.</strong>{" "}
              {status.reason ?? "Local storage is unavailable in this browser."} You can keep
              working and use <em>Data → Export</em> to save a JSON backup before closing this tab.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <main
        id="main"
        className={cn(
          "mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8",
          wide ? "max-w-6xl" : "max-w-5xl",
        )}
      >
        {children}
      </main>

      <footer className="mt-auto border-t">
        <div
          className={cn(
            "mx-auto flex w-full flex-col gap-3 px-4 py-6 sm:px-6",
            wide ? "max-w-6xl" : "max-w-5xl",
          )}
        >
          <Alert variant="default" className="border-dashed">
            <AlertIcon>
              <InfoIcon />
            </AlertIcon>
            <AlertDescription>
              <Disclaimer />
            </AlertDescription>
          </Alert>
          <p className="text-muted-foreground text-xs">
            Everything you enter stays in this browser. Runway has no accounts, no server and no
            tracking.
          </p>
        </div>
      </footer>
    </div>
  );
}

/** Inline SVG so the mark needs no extra request and inherits the theme colour. */
function RunwayMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-6 shrink-0"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="7" className="fill-primary" />
      <path
        d="M7 22.5 13 16l4 4 8-9"
        className="stroke-positive"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
