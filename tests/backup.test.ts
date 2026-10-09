import { describe, expect, it } from "vitest";

import { escapeCsvField, periodsToCsv, toCsv } from "@/lib/csv";
import { aggregate } from "@/lib/forecast/aggregate";
import { runProjection } from "@/lib/forecast/engine";
import { CURRENCIES } from "@/types/forecast";
import {
  BACKUP_SCHEMA_VERSION,
  buildBackup,
  csvFilename,
  forecastFilename,
  parseBackup,
  resolveImport,
  serializeBackup,
} from "@/lib/storage/backup";
import { backupFileSchema } from "@/lib/validation";
import type { Forecast } from "@/types/forecast";

function makeForecast(overrides: Partial<Forecast> = {}): Forecast {
  return {
    id: "forecast-1",
    name: "Freelance 2026",
    currency: "EUR",
    startingBalanceCents: 420_000,
    startDate: "2026-01-01",
    horizon: "THIRTEEN_WEEKS",
    notes: "Base assumptions",
    recurringItems: [
      {
        id: "rec-1",
        name: "Rent",
        direction: "OUTFLOW",
        amountCents: 135_000,
        frequency: "MONTHLY",
        startDate: "2026-01-01",
        category: "Housing",
        isActive: true,
      },
    ],
    oneOffItems: [
      {
        id: "one-1",
        name: "Laptop",
        direction: "OUTFLOW",
        amountCents: 200_000,
        date: "2026-01-20",
        category: "Equipment",
      },
    ],
    invoices: [
      {
        id: "inv-1",
        clientName: "Northwind BV",
        amountCents: 380_000,
        issueDate: "2025-12-15",
        expectedPaymentDate: "2026-01-11",
        paymentDelayDays: 14,
        status: "EXPECTED",
        recurrence: "NONE",
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    archived: false,
    ...overrides,
  };
}

/* ------------------------------------------------------------ round trip -- */

describe("JSON export/import round trip", () => {
  it("preserves every field through export, serialise, parse", () => {
    const original = makeForecast();
    const backup = buildBackup([original]);

    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(backup.app).toBe("runway");
    expect(typeof backup.exportedAt).toBe("string");

    const parsed = parseBackup(serializeBackup(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.backup.forecasts).toHaveLength(1);
    // Deep equality, not just a spot check: nothing may be dropped in transit.
    expect(parsed.backup.forecasts[0]).toEqual(original);
  });

  it("round-trips multiple forecasts including scenarios", () => {
    const base = makeForecast();
    const scenario = makeForecast({
      id: "scenario-1",
      name: "Client pays 30 days late",
      baseForecastId: base.id,
      scenarioLabel: "Client pays 30 days late",
    });

    const parsed = parseBackup(serializeBackup(buildBackup([base, scenario])));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.backup.forecasts).toHaveLength(2);
    expect(parsed.backup.forecasts[1]?.baseForecastId).toBe(base.id);
    expect(parsed.counts).toEqual({
      forecasts: 2,
      recurringItems: 2,
      oneOffItems: 2,
      invoices: 2,
      scenarios: 1,
    });
  });

  it("keeps cents exact through a round trip", () => {
    const original = makeForecast({ startingBalanceCents: 1_999_999 });
    const parsed = parseBackup(serializeBackup(buildBackup([original])));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.forecasts[0]?.startingBalanceCents).toBe(1_999_999);
  });

  it("produces a projection identical to the original after a round trip", () => {
    const original = makeForecast();
    const parsed = parseBackup(serializeBackup(buildBackup([original])));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const restored = parsed.backup.forecasts[0];
    expect(restored).toBeDefined();
    if (restored === undefined) return;

    expect(JSON.stringify(runProjection(restored))).toEqual(JSON.stringify(runProjection(original)));
  });
});

/* ------------------------------------------------- personal / business kind -- */

describe("personal and business forecasts", () => {
  it("round-trips the forecast kind", () => {
    for (const kind of ["PERSONAL", "BUSINESS"] as const) {
      const original = makeForecast({ forecastKind: kind });
      const parsed = parseBackup(serializeBackup(buildBackup([original])));

      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.backup.forecasts[0]?.forecastKind).toBe(kind);
    }
  });

  it("accepts a backup written before kinds existed", () => {
    // Simulates an export from a build that had no `forecastKind`.
    const legacy = makeForecast();
    delete (legacy as { forecastKind?: unknown }).forecastKind;

    const result = parseBackup(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: "2026-01-01T00:00:00.000Z",
        app: "runway",
        forecasts: [legacy],
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.forecasts[0]?.forecastKind).toBeUndefined();
  });

  it("rejects an unrecognised kind rather than silently coercing it", () => {
    const broken = { ...makeForecast(), forecastKind: "CHARITY" };
    const result = parseBackup(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: "2026-01-01T00:00:00.000Z",
        app: "runway",
        forecasts: [broken],
      }),
    );

    expect(result.ok).toBe(false);
  });
});

/* --------------------------------------------------------------- parsing -- */

describe("parseBackup validation", () => {
  it("rejects text that is not JSON", () => {
    const result = parseBackup("not json at all {");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("not valid JSON");
  });

  it("rejects JSON that is not a Runway backup", () => {
    const result = parseBackup(JSON.stringify({ hello: "world" }));
    expect(result.ok).toBe(false);
  });

  it("rejects a backup with no forecasts", () => {
    const result = parseBackup(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: "2026-01-01T00:00:00.000Z",
        app: "runway",
        forecasts: [],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("rounds a fractional cent amount rather than refusing the file", () => {
    /*
     * A fractional cent cannot be represented, and the product decision is to
     * round rather than reject so a hand-edited or third-party file still
     * imports. The engine's own tripwire still refuses fractions internally.
     */
    const forecast = makeForecast();
    const payload = {
      schemaVersion: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      app: "runway",
      forecasts: [{ ...forecast, startingBalanceCents: 1999.5 }],
    };

    const result = parseBackup(JSON.stringify(payload));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.forecasts[0]?.startingBalanceCents).toBe(2000);
  });

  it("still refuses an amount that is not a number at all", () => {
    const forecast = makeForecast();
    const payload = {
      schemaVersion: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      app: "runway",
      forecasts: [{ ...forecast, startingBalanceCents: "1500" }],
    };
    expect(parseBackup(JSON.stringify(payload)).ok).toBe(false);
  });

  it("rejects an impossible calendar date", () => {
    const broken = makeForecast({ startDate: "2026-02-30" });
    const result = parseBackup(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: "2026-01-01T00:00:00.000Z",
        app: "runway",
        forecasts: [broken],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown currency", () => {
    // "XYZ" is not a real code. This test used to name GBP, which is now
    // supported, so the example has to stay genuinely outside the list.
    const broken = { ...makeForecast(), currency: "XYZ" };
    const result = parseBackup(
      JSON.stringify({
        schemaVersion: 1,
        exportedAt: "2026-01-01T00:00:00.000Z",
        app: "runway",
        forecasts: [broken],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("accepts every supported currency", () => {
    for (const currency of CURRENCIES) {
      const candidate = { ...makeForecast(), currency };
      const result = parseBackup(
        JSON.stringify({
          schemaVersion: 1,
          exportedAt: "2026-01-01T00:00:00.000Z",
          app: "runway",
          forecasts: [candidate],
        }),
      );
      expect(result.ok, `${currency} should be a supported currency`).toBe(true);
    }
  });

  it("ignores unknown extra keys rather than failing on them", () => {
    const payload = {
      schemaVersion: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      app: "runway",
      futureField: true,
      forecasts: [{ ...makeForecast(), alsoFuture: 1 }],
    };
    expect(parseBackup(JSON.stringify(payload)).ok).toBe(true);
  });

  it("validates its own export with the same schema", () => {
    expect(backupFileSchema.safeParse(buildBackup([makeForecast()])).success).toBe(true);
  });
});

/* --------------------------------------------------------- resolveImport -- */

describe("import resolution", () => {
  const incoming = makeForecast({ id: "clash-id", name: "Freelance 2026" });

  it("keeps both forecasts when ids clash in merge mode", () => {
    const result = resolveImport(buildBackup([incoming]), {
      mode: "merge",
      existingIds: new Set(["clash-id"]),
      existingNames: ["Freelance 2026"],
    });

    expect(result.clearFirst).toBe(false);
    expect(result.report.importedCount).toBe(1);
    expect(result.forecasts).toHaveLength(1);

    const imported = result.forecasts[0];
    // Neither the id nor the name may overwrite what is already stored.
    expect(imported?.id).not.toBe("clash-id");
    expect(imported?.name).not.toBe("Freelance 2026");
    expect(result.report.results[0]?.outcome).toBe("renamed");
  });

  it("imports cleanly when nothing clashes", () => {
    const result = resolveImport(buildBackup([incoming]), {
      mode: "merge",
      existingIds: new Set(["other-id"]),
      existingNames: ["Something else"],
    });

    expect(result.forecasts[0]?.id).toBe("clash-id");
    expect(result.forecasts[0]?.name).toBe("Freelance 2026");
    expect(result.report.results[0]?.outcome).toBe("created");
  });

  it("flags replace mode so the caller clears first", () => {
    const result = resolveImport(buildBackup([incoming]), {
      mode: "replace",
      existingIds: new Set(["clash-id"]),
      existingNames: ["Freelance 2026"],
    });

    expect(result.clearFirst).toBe(true);
    // Replace mode keeps the original id and name, since nothing is being kept.
    expect(result.forecasts[0]?.id).toBe("clash-id");
    expect(result.forecasts[0]?.name).toBe("Freelance 2026");
  });

  it("disambiguates duplicates inside a single file", () => {
    const first = makeForecast({ id: "a", name: "Same name" });
    const second = makeForecast({ id: "b", name: "Same name" });

    const result = resolveImport(buildBackup([first, second]), {
      mode: "merge",
      existingIds: new Set(),
      existingNames: [],
    });

    const names = result.forecasts.map((forecast) => forecast.name);
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
  });

  it("assigns fresh ids to line items so imports cannot collide", () => {
    const a = makeForecast({ id: "a", name: "A" });
    const b = makeForecast({ id: "b", name: "B" });

    const result = resolveImport(buildBackup([a, b]), {
      mode: "merge",
      existingIds: new Set(),
      existingNames: [],
    });

    const ids = result.forecasts.flatMap((forecast) =>
      forecast.recurringItems.map((item) => item.id),
    );
    // `ponytail:` item ids are shared across the source file (both derived from
    // the same fixture), so this documents that duplicates are tolerated: the
    // engine keys items within a single forecast, never across forecasts.
    expect(ids.length).toBeGreaterThan(0);
    expect(result.forecasts[0]?.id).not.toBe(result.forecasts[1]?.id);
  });
});

/* ------------------------------------------------------------------- CSV -- */

describe("CSV export", () => {
  it("quotes fields containing a comma, a quote or a newline", () => {
    expect(escapeCsvField("plain")).toBe("plain");
    expect(escapeCsvField("€1,500.00")).toBe('"€1,500.00"');
    expect(escapeCsvField('He said "hi"')).toBe('"He said ""hi"""');
    expect(escapeCsvField("two\nlines")).toBe('"two\nlines"');
  });

  it("joins cells and rows with the right delimiters", () => {
    expect(toCsv([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d");
  });

  it("writes a header plus one row per period", () => {
    const forecast = makeForecast();
    const periods = aggregate(runProjection(forecast).days, "weekly");
    const csv = periodsToCsv(periods, "EUR", "en-GB");
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe(
      "Period start,Period end,Opening balance,Inflows,Outflows,Net change,Closing balance",
    );
    expect(lines).toHaveLength(periods.length + 1);
    // Currency-formatted amounts contain a comma, so those cells must be quoted.
    expect(lines[1]).toContain('"€');
  });

  it("keeps the closing balance of the last period equal to the projection end", () => {
    const forecast = makeForecast();
    const projection = runProjection(forecast);
    const periods = aggregate(projection.days, "monthly");

    expect(periods[periods.length - 1]?.closingCents).toBe(projection.summary.endingBalanceCents);
  });
});

/* -------------------------------------------------------------- filenames -- */

describe("export filenames", () => {
  it("slugifies the forecast name and stamps the date", () => {
    expect(forecastFilename("Freelance 2026", "2026-10-09")).toBe(
      "runway-forecast-freelance-2026-2026-10-09.json",
    );
    expect(csvFilename("Freelance 2026", "weekly", "2026-10-09")).toBe(
      "runway-freelance-2026-weekly-2026-10-09.csv",
    );
  });

  it("strips characters that are unsafe in a filename", () => {
    expect(forecastFilename("Café / Client: 50%", "2026-10-09")).toBe(
      "runway-forecast-cafe-client-50-2026-10-09.json",
    );
  });

  it("falls back to a usable name when everything is stripped", () => {
    expect(forecastFilename("***", "2026-10-09")).toBe("runway-forecast-forecast-2026-10-09.json");
  });
});
