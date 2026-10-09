import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// Self-hosted so the app still renders correctly offline.
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";

import { App } from "@/App";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import "./index.css";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("Runway: #root element is missing from index.html");
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
