# AGENTS.md

Operating notes for AI agents driving `gsc-cli`. (Humans: see `README.md`.)

## What this is

Two Node bins that read Google Search Console. No SDK, no build step, Node ≥ 18.

- `gsc-auth` — one-time interactive OAuth (opens a browser). **You cannot run
  this unattended.** If tokens are missing, stop and ask the human to run it.
- `gsc-query` — non-interactive, safe to run in a loop. Read-only by default.

## Preconditions

Before `gsc-query`, `~/.config/gsc-tokens.json` must exist (from `gsc-auth`).
If it doesn't, `gsc-query` returns `{"ok":false,"error":{"code":"TOKENS_MISSING"}}`
— surface that and ask the human to bootstrap; do not try to create tokens yourself.

## The only call you need

```bash
gsc-query --site sc-domain:example.com --dim query --limit 100 --json
```

Always pass `--json`. Parse stdout as:

```
{ "ok": true, "meta": {...}, "rows": [ { "keys": [...], "clicks", "impressions", "ctr", "position" } ] }
```

## Contract

- **Exit 0** ⇒ success, stdout is the envelope above.
- **Exit 1** ⇒ failure, stderr is `{ "ok": false, "error": { code, message, context, recovery } }`.
  Branch on `error.code` (stable), never on `message` (prose). Follow `error.recovery`.
- Determinism: pass explicit `--start`/`--end`. The default window depends on the
  current date (end = today − 3 days, the GSC data-delay).
- Limits: `--limit` ≤ 25000; GSC samples beyond that. Data lags 2–3 days.

## Codes you'll actually hit

| Code | Do this |
|---|---|
| `TOKENS_MISSING` | Ask the human to run `gsc-auth` once. |
| `SITE_MISSING` | Pass `--site` or set `GSC_DEFAULT_SITE`. |
| `BAD_DIMENSION` / `BAD_LIMIT` / `BAD_ARG` | Fix the invocation per `recovery`. |
| `API_ERROR` (`context.status` 403) | The API isn't enabled or the user doesn't own the property. Human action. |

## Programmatic use

Prefer the library over shelling out when you're already in Node:

```js
import { loadTokens, resolveTokensPath, refreshAccessToken, querySearchAnalytics } from "@casys-ai/gsc-cli";
const token = await refreshAccessToken(await loadTokens(resolveTokensPath()));
const rows = await querySearchAnalytics(token, {
  site: "sc-domain:example.com", startDate: "2026-06-01", endDate: "2026-06-28",
  dimensions: ["query"], rowLimit: 100,
});
```

Failures throw `GscError` (has `.code`, `.context`, `.recovery`).
