import { AlertTriangleIcon, ArrowUpRightIcon, DatabaseIcon, GlobeIcon, InfoIcon, LayoutListIcon } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { Disclaimer } from "@/components/layout/Disclaimer";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { Toaster } from "@/components/layout/Toaster";
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

/**
 * The two places a page can be reached from anywhere.
 *
 * Deliberately only two: a forecast is opened from the list, so listing the
 * routes a user cannot yet see would be noise. Data gets a link because it is the
 * one page with no other way in — it is where a backup is taken, and a backup is
 * what saves the data when the browser is cleared.
 */
const NAV_LINKS: ReadonlyArray<{ to: string; label: string; icon: ReactNode; end: boolean }> = [
  { to: "/", label: "Forecasts", icon: <LayoutListIcon className="size-3.5" />, end: true },
  { to: "/data", label: "Data", icon: <DatabaseIcon className="size-3.5" />, end: false },
];

export function AppShell({ children, actions, wide = false }: AppShellProps) {
  const { status } = useForecasts();

  return (
    <div className="bg-background flex min-h-dvh flex-col print:hidden">
      <a
        href="#main"
        className="bg-background focus:ring-ring sr-only rounded-md px-3 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:ring-2"
      >
        Skip to content
      </a>

      <header className="bg-background/85 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
        <div
          className={cn(
            "mx-auto flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-2 py-2 px-4 sm:px-6",
            wide ? "max-w-6xl" : "max-w-5xl",
          )}
        >
          <a href="/" className="flex items-center gap-2" aria-label="Runway home">
            <RunwayMark />
            {/* The wordmark carries the accent thread, like the name on a label. */}
            <span className="font-display text-accent-text text-lg tracking-tight">Runway</span>
          </a>
          <nav aria-label="Main" className="flex items-center gap-0.5">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    "focus-visible:ring-ring inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    isActive
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {link.icon}
                <span className="hidden sm:inline">{link.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {actions}
            <ThemeSwitcher />
            {/*
             * Repeated from the footer on purpose: it is the owner's site, and a
             * reader who wants it should not have to reach the bottom of the page.
             * The label is dropped below `sm` so it never crowds out the page's own
             * controls, and `aria-label` still names the link when that happens.
             */}
            <a
              href="https://danelrahmani.com"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="danelrahmani.com — Danel Rahmani's personal website"
              title="danelrahmani.com"
              className="text-muted-foreground hover:text-foreground hover:bg-secondary focus-visible:ring-ring inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <GlobeIcon className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">danelrahmani.com</span>
            </a>
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
          "mx-auto flex w-full flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10",
          wide ? "max-w-7xl" : "max-w-5xl",
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
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <p className="text-muted-foreground text-xs">
              Everything you enter stays in this browser. Runway has no accounts, no server and no
              tracking.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <ExternalLink
                href="https://github.com/DanelRahmani/runway"
                label="Source on GitHub"
              />
              <ExternalLink href="https://danelrahmani.com" label="danelrahmani.com" />
            </div>
          </div>
        </div>
      </footer>

      <Toaster />
    </div>
  );
}

/**
 * A footer link that leaves the app.
 *
 * `rel="noreferrer"` alongside `noopener`: `noopener` stops the new tab reaching
 * back through `window.opener`, and `noreferrer` additionally withholds the
 * referring URL, which is the safer default now that `noreferrer` implies
 * `noopener` in every browser this supports.
 */
function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-sm text-xs underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      {label}
      <ArrowUpRightIcon className="size-3" aria-hidden="true" />
    </a>
  );
}

/** Inline SVG so the mark needs no extra request and follows the theme. */
function RunwayMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="size-6 shrink-0"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="32" height="32" rx="7" className="fill-foreground" />
      <path
        d="M7 22.5 13 16l4 4 8-9"
        className="stroke-primary"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
