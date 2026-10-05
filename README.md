# gsc-cli

**Query Google Search Console from the command line — or from an agent.**
Zero runtime dependencies. OAuth user flow. Structured JSON output. Machine-readable errors.

```bash
# Install from GitHub (not published to npm — install straight from the repo)
npm i -g github:superWorldSavior/gsc-cli

gsc-query --site sc-domain:example.com --dim query --json
```

> Prefer no global install? One-off: `npx -p github:superWorldSavior/gsc-cli gsc-query …`.
> As a library: `npm i github:superWorldSavior/gsc-cli` (installs under the name
> `@casys-ai/gsc-cli`, so the imports below work unchanged).

Two small binaries and a library:

| Command | Purpose |
|---|---|
| `gsc-auth` | One-time OAuth bootstrap → stores a refresh token (mode `0600`). |
| `gsc-query` | Query the Search Analytics API (clicks / impressions / CTR / position). |

No `googleapis` SDK (that's 50 MB for two endpoints). Just native `fetch`, `http`,
and `crypto`. Node ≥ 18.

---

## Why this exists

Google Search Console has a good UI and a hostile setup story for automation.
Service accounts get silently rejected by the "Add user" directory for hours to
days. The OAuth *user* flow works immediately for any account that already owns
the property — so that's what this uses. One bootstrap, then a permanent refresh
token that covers **every property that Google account owns**.

It is built to be driven by an **agent** as much as a human: every command has a
`--json` mode, every failure is a stable error `code` with a `recovery` hint, and
inputs are validated at the boundary before any network call. (See
[from DX to AX](https://casys.ai/blog/from-dx-to-ax).)

---

## Setup (one-time)

### 1. Create an OAuth Desktop client in GCP

1. In [Google Cloud Console](https://console.cloud.google.com/) create (or pick) a project.
2. Enable the **Google Search Console API**:
   <https://console.cloud.google.com/apis/library/searchconsole.googleapis.com>
3. Configure the OAuth consent screen: **External** + **Testing**, scope
   `webmasters.readonly`, and add your Google account as a **test user**.
4. Create an OAuth client of type **Desktop app**. Download the JSON.
5. Save it (mode 600) where the CLI expects it:

   ```bash
   mkdir -p ~/.config
   mv ~/Downloads/client_secret_*.json ~/.config/gsc-oauth-client.json
   chmod 600 ~/.config/gsc-oauth-client.json
   ```

### 2. Bootstrap the refresh token

```bash
gsc-auth   # (or: npx -p github:superWorldSavior/gsc-cli gsc-auth)
```

This opens your browser, you authorize (you'll see an "unverified app" warning →
Advanced → Continue), the CLI captures the code on `127.0.0.1:53682`, exchanges
it, and writes `~/.config/gsc-tokens.json`. The refresh token does **not** expire
unless you revoke it.

> Already bootstrapped for another project? Reuse the same
> `~/.config/gsc-tokens.json` — the refresh token is bound to the Google user,
> not the GCP project.

---

## Usage

```bash
# Top 50 queries, default ~28-day window (ending 3 days ago — GSC data delay)
gsc-query --site sc-domain:example.com

# Top pages
gsc-query --site sc-domain:example.com --dim page --limit 100

# Custom window
gsc-query --site sc-domain:example.com --start 2026-06-01 --end 2026-06-28

# Machine-readable output for pipes / agents
gsc-query --site sc-domain:example.com --json > out.json

# Combine dimensions (drill-down)
gsc-query --site sc-domain:example.com --dim query,page
```

Set a default site so you can drop `--site`:

```bash
export GSC_DEFAULT_SITE=sc-domain:example.com
```

### Flags

| Flag | Default | Notes |
|---|---|---|
| `--site <url>` | `$GSC_DEFAULT_SITE` | `sc-domain:example.com` or `https://example.com/`. |
| `--start YYYY-MM-DD` | `today − 31d` | |
| `--end YYYY-MM-DD` | `today − 3d` | GSC data lags 2–3 days. |
| `--dim <list>` | `query` | Comma list of `query,page,country,device,date`. |
| `--limit N` | `50` | 1–25000 (GSC samples beyond 25k). |
| `--json` | off | Emit the JSON envelope instead of a Markdown table. |

### Environment variables

| Var | Default | Used by |
|---|---|---|
| `GSC_OAUTH_CLIENT_PATH` | `~/.config/gsc-oauth-client.json` | `gsc-auth` |
| `GSC_TOKENS_PATH` | `~/.config/gsc-tokens.json` | both |
| `GSC_AUTH_PORT` | `53682` | `gsc-auth` (loopback callback) |
| `GSC_SCOPE` | `readonly` | `gsc-auth` (`full` to allow writes) |
| `GSC_DEFAULT_SITE` | — | `gsc-query` |

---

## Output contract (for agents)

`gsc-query --json` writes to **stdout**:

```json
{
  "ok": true,
  "meta": { "site": "sc-domain:example.com", "startDate": "2026-06-17", "endDate": "2026-07-15", "dimensions": ["query"] },
  "rows": [
    { "keys": ["mcp server"], "clicks": 42, "impressions": 1200, "ctr": 0.035, "position": 4.2 }
  ]
}
```

On failure, **every** command writes an error envelope and exits `1`:

```json
{ "ok": false, "error": { "code": "TOKENS_MISSING", "message": "…", "context": { "path": "…" }, "recovery": "Run `gsc-auth` once to bootstrap the refresh token." } }
```

### Error codes

| Code | Meaning / recovery |
|---|---|
| `OAUTH_CLIENT_MISSING` / `OAUTH_CLIENT_INVALID` | Download the Desktop client JSON from GCP. |
| `TOKENS_MISSING` / `TOKENS_INVALID` | Run `gsc-auth`. |
| `NO_REFRESH_TOKEN` | Revoke at [myaccount.google.com/permissions](https://myaccount.google.com/permissions), re-run `gsc-auth`. |
| `TOKEN_EXCHANGE_FAILED` / `TOKEN_REFRESH_FAILED` | OAuth HTTP error (see `context.status`, `context.body`). |
| `SITE_MISSING` / `BAD_ARG` / `BAD_DIMENSION` / `BAD_LIMIT` | Fix the invocation (see `recovery`). |
| `API_ERROR` | GSC returned non-2xx. `403` → API not enabled, or the user doesn't own the property. |

---

## Library API

Every CLI capability is a composable primitive you can import:

```js
import {
  resolveTokensPath,
  loadTokens,
  refreshAccessToken,
  querySearchAnalytics,
} from "@casys-ai/gsc-cli";

const tokens = await loadTokens(resolveTokensPath());
const accessToken = await refreshAccessToken(tokens);

const rows = await querySearchAnalytics(accessToken, {
  site: "sc-domain:example.com",
  startDate: "2026-06-01",
  endDate: "2026-06-28",
  dimensions: ["query"],
  rowLimit: 50,
});
```

Exports: `bootstrapOAuth`, `refreshAccessToken`, `buildAuthUrl`,
`querySearchAnalytics`, `formatRowsMarkdown`, `parseQueryArgs`, `loadTokens`,
`saveTokens`, `loadOAuthClient`, `resolveClientPath`, `resolveTokensPath`,
`resolveAuthPort`, `defaultDateRange`, `GscError`, `ErrorCodes`,
`SCOPE_READONLY`, `SCOPE_FULL`. Types ship in `index.d.ts`.

---

## Troubleshooting

- **`403 SERVICE_DISABLED`** — enable the Search Console API on the GCP project
  (link above); wait 1–2 min to propagate.
- **`403` on the property** — the OAuth user isn't listed under
  [Search Console → Settings → Users](https://search.google.com/search-console/users).
- **No `refresh_token` returned** — the app was already authorized; revoke at
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
  and re-run `gsc-auth`.
- **Port 53682 busy** — set `GSC_AUTH_PORT` to a free port.

---

## Development

```bash
git clone https://github.com/superWorldSavior/gsc-cli
cd gsc-cli
node --test          # runs the (network-free) boundary tests
node bin/gsc-query.js --help  # or just read bin/*.js
```

No build step, no dependencies. `lib/` holds pure primitives; `bin/` holds thin
CLIs over them.

## License

MIT © [Casys AI](https://casys.ai) (THE NO CODE GUY EURL)
