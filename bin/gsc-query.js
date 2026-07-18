#!/usr/bin/env node
/**
 * gsc-query — query Search Analytics from the CLI.
 *
 * Auth is via the refresh token bootstrapped by `gsc-auth`. Default output is a
 * Markdown table; `--json` emits a machine-readable envelope on stdout.
 *
 * Env:
 *   GSC_TOKENS_PATH   default ~/.config/gsc-tokens.json
 *   GSC_DEFAULT_SITE  used when --site is omitted (e.g. sc-domain:example.com)
 *
 * Usage:
 *   gsc-query --site sc-domain:example.com
 *   gsc-query --site sc-domain:example.com --dim page --limit 100
 *   gsc-query --site sc-domain:example.com --start 2026-06-01 --end 2026-06-28 --json
 *
 * JSON envelope:
 *   success → { "ok": true,  "meta": {...}, "rows": [...] }
 *   failure → { "ok": false, "error": { "code", "message", "context", "recovery" } }
 * Exit code is 0 on success, 1 on failure (in both text and JSON modes).
 */
import { resolveTokensPath } from "../lib/config.js";
import { parseQueryArgs } from "../lib/cli-args.js";
import { loadTokens } from "../lib/tokens.js";
import { refreshAccessToken } from "../lib/oauth.js";
import {
  querySearchAnalytics,
  formatRowsMarkdown,
} from "../lib/search-analytics.js";
import { GscError } from "../lib/errors.js";

const HELP = `gsc-query — query Google Search Console Search Analytics.

Usage:
  gsc-query [--site <url>] [--start YYYY-MM-DD] [--end YYYY-MM-DD]
            [--dim query|page|country|device|date,...] [--limit N] [--json]

Defaults: --site $GSC_DEFAULT_SITE, last ~28 days (end = today-3d), --dim query,
--limit 50. --json emits { ok, meta, rows }; errors emit { ok:false, error } and exit 1.

Docs: https://github.com/Casys-AI/gsc-cli`;

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(HELP + "\n");
    return;
  }
  const args = parseQueryArgs(argv, process.env, new Date());
  const tokens = await loadTokens(resolveTokensPath());
  const accessToken = await refreshAccessToken(tokens);

  const rows = await querySearchAnalytics(accessToken, {
    site: args.site,
    startDate: args.startDate,
    endDate: args.endDate,
    dimensions: args.dimensions,
    rowLimit: args.limit,
  });

  const meta = {
    site: args.site,
    startDate: args.startDate,
    endDate: args.endDate,
    dimensions: args.dimensions,
  };

  if (args.asJson) {
    process.stdout.write(JSON.stringify({ ok: true, meta, rows }, null, 2) + "\n");
    return;
  }
  process.stdout.write(formatRowsMarkdown(rows, meta) + "\n");
}

main().catch((err) => {
  const error = err instanceof GscError
    ? err.toJSON()
    : { code: "UNEXPECTED", message: String(err?.message ?? err), context: {}, recovery: "" };
  process.stderr.write(JSON.stringify({ ok: false, error }, null, 2) + "\n");
  process.exit(1);
});
