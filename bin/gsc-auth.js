#!/usr/bin/env node
/**
 * gsc-auth — one-time OAuth bootstrap.
 *
 * Opens the Google consent screen, captures the code on a loopback server,
 * exchanges it for a refresh token, and writes it (mode 0600) to the tokens
 * path. Run once per machine; the refresh token does not expire unless revoked.
 *
 * Env:
 *   GSC_OAUTH_CLIENT_PATH  default ~/.config/gsc-oauth-client.json
 *   GSC_TOKENS_PATH        default ~/.config/gsc-tokens.json
 *   GSC_AUTH_PORT          default 53682
 *   GSC_SCOPE              "readonly" (default) | "full"
 */
import {
  resolveClientPath,
  resolveTokensPath,
  resolveAuthPort,
  SCOPE_READONLY,
  SCOPE_FULL,
} from "../lib/config.js";
import { bootstrapOAuth } from "../lib/oauth.js";
import { GscError } from "../lib/errors.js";

const HELP = `gsc-auth — one-time Google Search Console OAuth bootstrap.

Usage:
  gsc-auth        Opens the consent screen, stores a refresh token (mode 0600).

Env: GSC_OAUTH_CLIENT_PATH, GSC_TOKENS_PATH, GSC_AUTH_PORT (default 53682),
     GSC_SCOPE (readonly | full).

Docs: https://github.com/Casys-AI/gsc-cli`;

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(HELP);
    return;
  }
  const clientPath = resolveClientPath();
  const tokensPath = resolveTokensPath();
  const port = resolveAuthPort();
  const scope = process.env.GSC_SCOPE === "full" ? SCOPE_FULL : SCOPE_READONLY;

  await bootstrapOAuth({
    clientPath,
    tokensPath,
    port,
    scope,
    onAuthUrl: (url) => {
      console.error("Opening the browser — authorize, then come back here.");
      console.error("If it does not open, paste this URL manually:\n" + url);
    },
    log: (m) => console.error(m),
  });

  console.error(`✓ Tokens saved to ${tokensPath} (mode 600).`);
  console.error("→ You can now run `gsc-query --site sc-domain:example.com`.");
  // The loopback server's keep-alive socket would otherwise hold the event
  // loop open for ~5s after success. This is a one-shot command — exit now.
  process.exit(0);
}

main().catch((err) => {
  const error = err instanceof GscError
    ? err.toJSON()
    : { code: "UNEXPECTED", message: String(err?.message ?? err), context: {}, recovery: "" };
  console.error(JSON.stringify({ ok: false, error }, null, 2));
  process.exit(1);
});
