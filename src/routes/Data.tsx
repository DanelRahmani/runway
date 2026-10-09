import { ArrowLeftIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { DataTab } from "@/components/forecast/DataTab";
import { Button } from "@/components/ui/button";

/**
 * Standalone Data page.
 *
 * Renders the same {@link DataTab} the dashboard uses, without a forecast in
 * scope, so import/export logic exists in exactly one place.
 */
export function DataPage() {
  return (
    <AppShell
      actions={
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeftIcon />
            <span className="hidden sm:inline">All forecasts</span>
          </Link>
        </Button>
      }
    >
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl leading-tight tracking-tight sm:text-3xl">
          Your data
        </h1>
        <p className="text-muted-foreground text-sm">
          Export a backup, restore one, or download a projection as CSV. Everything stays on this
          device until you choose to export it.
        </p>
      </header>

      <ErrorBoundary label="the data tools">
        <DataTab />
      </ErrorBoundary>
    </AppShell>
  );
}
