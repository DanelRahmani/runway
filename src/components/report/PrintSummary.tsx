import { useMemo } from "react";
import { createPortal } from "react-dom";

import { buildPrintSummary } from "@/lib/report/printSummary";
import type { Forecast, Projection } from "@/types/forecast";

/**
 * The printable one-pager.
 *
 * Rendered through a portal so it sits outside the app shell in the DOM — the
 * shell is `print:hidden`, and a node inside it would be hidden with it. On
 * screen the whole section is `hidden`, so nothing here affects the app.
 *
 * Charts are deliberately absent: a Recharts figure measures its container, and
 * the print engine lays that container out differently, which can come out
 * blank. A table prints the same everywhere.
 */
export function PrintSummary({
  forecast,
  projection,
}: {
  forecast: Forecast;
  projection: Projection;
}) {
  const summary = useMemo(() => buildPrintSummary(forecast, projection), [forecast, projection]);

  return createPortal(
    <section className="hidden print:block">
      <header className="mb-4 border-b pb-3">
        <h1 className="text-xl font-semibold">{summary.title}</h1>
        <p className="text-xs">{summary.subtitle}</p>
      </header>

      <dl className="mb-4 grid grid-cols-1 gap-x-8 gap-y-1 text-xs sm:grid-cols-2">
        {summary.lines.map((line) => (
          <div
            key={line.label}
            className="flex justify-between gap-4 border-b border-dotted py-0.5"
          >
            <dt>{line.label}</dt>
            <dd className="font-medium">{line.value}</dd>
          </div>
        ))}
      </dl>

      <table className="w-full text-xs">
        <caption className="sr-only">Monthly cash flow</caption>
        <thead>
          <tr>
            {summary.columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={`border-b py-1 ${index === 0 ? "text-left" : "text-right"}`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {summary.rows.map((row) => (
            <tr key={row.period}>
              <td className="py-0.5">{row.period}</td>
              <td className="py-0.5 text-right">{row.opening}</td>
              <td className="py-0.5 text-right">{row.inflow}</td>
              <td className="py-0.5 text-right">{row.outflow}</td>
              <td className="py-0.5 text-right">{row.closing}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-[10px] leading-relaxed">
        Runway provides estimates for planning purposes only and is not financial advice. Generated
        from data held in this browser; nothing was sent anywhere.
      </p>
    </section>,
    document.body,
  );
}
