import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Alert, AlertDescription, AlertIcon, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Label shown in the fallback, e.g. "the projection chart". */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors so one broken panel cannot blank the whole app.
 *
 * Errors are surfaced in the UI rather than the console: this is a client-only
 * app, and a user staring at a blank screen learns nothing from a stack trace
 * they never see.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally no console output in production code. The UI below is the report.
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    const { children, label = "this section" } = this.props;

    if (error === null) return children;

    return (
      <Alert variant="destructive">
        <AlertIcon>
          <TriangleAlertIcon />
        </AlertIcon>
        <AlertTitle>Something went wrong rendering {label}.</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-3">
          <span>
            Your saved forecasts are unaffected. Try again, and if it keeps happening export a JSON
            backup from the Data tab before reloading.
          </span>
          <span className="bg-background/60 rounded border px-2 py-1 font-mono text-xs break-all">
            {error.message}
          </span>
          <Button variant="outline" size="sm" onClick={this.reset}>
            <RefreshCwIcon />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
}
