/**
 * Boundary-validation invariants for the query CLI (AX #11).
 * Pure functions only — no network, no filesystem.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQueryArgs } from "../lib/cli-args.js";
import { defaultDateRange } from "../lib/config.js";
import { formatRowsMarkdown } from "../lib/search-analytics.js";
import { GscError } from "../lib/errors.js";

const NOW = new Date("2026-07-18T00:00:00Z");

test("defaults: site from env, ~28-day window, query dim, limit 50", () => {
  const args = parseQueryArgs([], { GSC_DEFAULT_SITE: "sc-domain:example.com" }, NOW);
  assert.equal(args.site, "sc-domain:example.com");
  assert.deepEqual(args.dimensions, ["query"]);
  assert.equal(args.limit, 50);
  assert.equal(args.asJson, false);
  const { startDate, endDate } = defaultDateRange(NOW);
  assert.equal(args.startDate, startDate);
  assert.equal(args.endDate, endDate);
  assert.equal(endDate, "2026-07-15"); // now - 3d (GSC data delay)
});

test("flags override defaults", () => {
  const args = parseQueryArgs(
    ["--site", "sc-domain:a.com", "--start", "2026-01-01", "--end", "2026-01-31", "--dim", "page,query", "--limit", "100", "--json"],
    {},
    NOW,
  );
  assert.equal(args.site, "sc-domain:a.com");
  assert.equal(args.startDate, "2026-01-01");
  assert.equal(args.endDate, "2026-01-31");
  assert.deepEqual(args.dimensions, ["page", "query"]);
  assert.equal(args.limit, 100);
  assert.equal(args.asJson, true);
});

test("missing site → SITE_MISSING", () => {
  assert.throws(
    () => parseQueryArgs([], {}, NOW),
    (e) => e instanceof GscError && e.code === "SITE_MISSING",
  );
});

test("unknown dimension → BAD_DIMENSION", () => {
  assert.throws(
    () => parseQueryArgs(["--site", "x", "--dim", "banana"], {}, NOW),
    (e) => e instanceof GscError && e.code === "BAD_DIMENSION",
  );
});

test("out-of-range limit → BAD_LIMIT", () => {
  assert.throws(
    () => parseQueryArgs(["--site", "x", "--limit", "99999"], {}, NOW),
    (e) => e instanceof GscError && e.code === "BAD_LIMIT",
  );
});

test("unknown flag → BAD_ARG", () => {
  assert.throws(
    () => parseQueryArgs(["--nope"], {}, NOW),
    (e) => e instanceof GscError && e.code === "BAD_ARG",
  );
});

test("formatRowsMarkdown renders header + rows, handles empty", () => {
  const meta = { site: "sc-domain:a.com", startDate: "2026-01-01", endDate: "2026-01-31", dimensions: ["query"] };
  assert.match(formatRowsMarkdown([], meta), /_\(no rows\)_/);
  const out = formatRowsMarkdown(
    [{ keys: ["mcp server"], clicks: 12, impressions: 340, ctr: 0.035, position: 4.2 }],
    meta,
  );
  assert.match(out, /\| 1 \| mcp server \| 12 \| 340 \| 3\.50% \| 4\.2 \|/);
});
