import { ArrowLeftIcon, Loader2Icon } from "lucide-react";
import { Suspense, lazy } from "react";
import { Link, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Home } from "@/routes/Home";

/**
 * Route-level code splitting.
 *
 * The dashboard and comparison views pull in Recharts, by far the heaviest
 * dependency. Loading them on demand keeps the landing page — the only thing a
 * first-time visitor sees — small.
 */
const ForecastPage = lazy(() =>
  import("@/routes/Forecast").then((module) => ({ default: module.ForecastPage })),
);
const ComparePage = lazy(() =>
  import("@/routes/Compare").then((module) => ({ default: module.ComparePage })),
);
const DataPage = lazy(() => import("@/routes/Data").then((module) => ({ default: module.DataPage })));

export function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/forecast/:id"
          element={
            <Suspense fallback={<RouteLoading label="forecast" />}>
              <ForecastPage />
            </Suspense>
          }
        />
        <Route
          path="/compare"
          element={
            <Suspense fallback={<RouteLoading label="comparison" />}>
              <ComparePage />
            </Suspense>
          }
        />
        <Route
          path="/data"
          element={
            <Suspense fallback={<RouteLoading label="data tools" />}>
              <DataPage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ErrorBoundary>
  );
}

function RouteLoading({ label }: { label: string }) {
  return (
    <AppShell wide>
      <div
        className="text-muted-foreground flex items-center justify-center gap-2 py-24 text-sm"
        role="status"
      >
        <Loader2Icon className="size-4 animate-spin" />
        Loading {label}…
      </div>
    </AppShell>
  );
}

/** Client-side routing means a bad URL is a real possibility after a typo. */
function NotFound() {
  return (
    <AppShell>
      <div className="flex flex-col items-start gap-3 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">That page does not exist.</h1>
        <p className="text-muted-foreground text-sm">
          The link may be out of date, or a forecast it pointed at has been deleted.
        </p>
        <Button asChild>
          <Link to="/">
            <ArrowLeftIcon />
            Back to Runway
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
