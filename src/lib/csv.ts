import { formatCents } from "@/lib/money";
import type { Currency, ProjectionPeriod } from "@/types/forecast";

/**
 * CSV generation.
 *
 * Amounts are written as currency-formatted strings (per the product spec), so
 * they contain thousands separators and symbols. Every field therefore goes
 * through {@link escapeCsvField}: a comma inside `€1,500.00` would otherwise
 * split the cell in two and corrupt the file for the spreadsheet that opens it.
 */

/** Quotes a field when it contains a delimiter, quote or newline; doubles inner quotes. */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeCsvField).join(",")).join("\r\n");
}

export const CSV_COLUMNS = [
  "Period start",
  "Period end",
  "Opening balance",
  "Inflows",
  "Outflows",
  "Net change",
  "Closing balance",
] as const;

/**
 * Projects a set of periods into CSV rows.
 *
 * Negative values are rendered with a leading minus so a spreadsheet parses them
 * as numbers rather than text.
 */
export function periodsToCsv(
  periods: readonly ProjectionPeriod[],
  currency: Currency,
  locale?: string,
): string {
  const money = (cents: number): string => formatCents(cents, currency, { locale });

  const rows: string[][] = [CSV_COLUMNS.slice()];
  for (const period of periods) {
    rows.push([
      period.startDate,
      period.endDate,
      money(period.openingCents),
      money(period.inflowCents),
      money(period.outflowCents),
      money(period.netCents),
      money(period.closingCents),
    ]);
  }
  return toCsv(rows);
}

/** Triggers a browser download. Kept thin so it is the only DOM touchpoint here. */
export function downloadFile(filename: string, mimeType: string, contents: string): void {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next tick so Safari has time to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
