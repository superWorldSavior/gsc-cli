/**
 * OAuth user flow (Desktop client) — zero external deps, native fetch + http.
 *
 * Why OAuth user flow and not a service account? GSC's "Add user" directory does
 * not reliably propagate freshly-created service accounts (silent failures for
 * hours). The user flow works immediately for any account that already owns the
 * property, and is the path every third-party GSC tool uses.
 */
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { GscError, ErrorCodes } from "./errors.js";
import { loadOAuthClient, saveTokens } from "./tokens.js";
import { SCOPE_READONLY } from "./config.js";

/**
 * Run the one-time OAuth bootstrap: open the consent screen, capture the code on
 * a loopback server, exchange it for a refresh token, and persist it.
 *
 * @param {object} opts
 * @param {string} opts.clientPath   Path to the OAuth Desktop client JSON.
 * @param {string} opts.tokensPath   Where to write the resulting tokens.
 * @param {number} opts.port         Loopback callback port.
 * @param {string} [opts.scope]      OAuth scope (defaults to read-only).
 * @param {(url: string) => void} [opts.onAuthUrl]  Called with the consent URL.
 * @param {(msg: string) => void}  [opts.log]       Progress sink (default: noop).
 * @returns {Promise<import("./tokens.js").Tokens>}
 */
export async function bootstrapOAuth(opts) {
  const {
    clientPath,
    tokensPath,
    port,
    scope = SCOPE_READONLY,
    onAuthUrl,
    log = () => {},
  } = opts;

  const client = await loadOAuthClient(clientPath);
  const redirectUri = `http://127.0.0.1:${port}`;
  const state = randomUUID();
  const authUrl = buildAuthUrl(client, redirectUri, state, scope);

  log(`Local callback server on ${redirectUri}`);
  const codePromise = waitForCode(port, state);

  if (onAuthUrl) onAuthUrl(authUrl);
  await openInBrowser(authUrl).catch(() => false);

  const code = await codePromise;
  log("Authorization code received — exchanging for tokens…");

  const exchanged = await exchangeCodeForTokens(client, code, redirectUri);
  if (!exchanged.refresh_token) {
    throw new GscError(
      ErrorCodes.NO_REFRESH_TOKEN,
      "Google returned no refresh_token (the app was already authorized).",
      {
        recovery:
          "Revoke access at https://myaccount.google.com/permissions, then " +
          "re-run `gsc-auth`.",
      },
    );
  }

  /** @type {import("./tokens.js").Tokens} */
  const tokens = {
    client_id: client.client_id,
    client_secret: client.client_secret,
    refresh_token: exchanged.refresh_token,
    token_uri: client.token_uri,
  };
  await saveTokens(tokensPath, tokens);
  return tokens;
}

/**
 * Exchange a stored refresh token for a short-lived access token.
 * @param {import("./tokens.js").Tokens} tokens
 * @returns {Promise<string>} access token
 */
export async function refreshAccessToken(tokens) {
  const res = await fetch(tokens.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: tokens.client_id,
      client_secret: tokens.client_secret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new GscError(
      ErrorCodes.TOKEN_REFRESH_FAILED,
      `Token refresh failed (HTTP ${res.status}).`,
      { context: { status: res.status, body: await safeText(res) } },
    );
  }
  const json = await res.json();
  if (!json.access_token) {
    throw new GscError(
      ErrorCodes.TOKEN_REFRESH_FAILED,
      "Token refresh succeeded but returned no access_token.",
    );
  }
  return json.access_token;
}

// ─── internals ──────────────────────────────────────────────────────────────

/**
 * @param {import("./tokens.js").OAuthClient} client
 * @param {string} redirectUri
 * @param {string} state
 * @param {string} scope
 * @returns {string}
 */
export function buildAuthUrl(client, redirectUri, state, scope) {
  const params = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${client.auth_uri}?${params}`;
}

/**
 * Start a loopback server and resolve with the OAuth `code` once it arrives.
 * @param {number} port
 * @param {string} expectedState
 * @returns {Promise<string>}
 */
export function waitForCode(port, expectedState) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const err = url.searchParams.get("error");

      if (err) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`OAuth error: ${err}`);
        server.close();
        reject(new GscError(ErrorCodes.OAUTH_CALLBACK_ERROR, `OAuth error: ${err}`));
        return;
      }
      if (!code || state !== expectedState) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Waiting for OAuth callback…");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        '<html><body style="font-family:system-ui;padding:2rem">' +
          "<h2>✓ Authorization received</h2>" +
          "<p>You can close this tab and return to the terminal.</p>" +
          "</body></html>",
      );
      server.close();
      resolve(code);
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1");
  });
}

/**
 * Open a URL in the default browser (best-effort, cross-platform).
 * @param {string} url
 * @returns {Promise<boolean>} whether the launcher spawned
 */
export function openInBrowser(url) {
  const [cmd, args] = process.platform === "darwin"
    ? ["open", [url]]
    : process.platform === "win32"
    ? ["cmd", ["/c", "start", "", url]]
    : ["xdg-open", [url]];
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => resolve(false));
    child.on("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

/**
 * @param {import("./tokens.js").OAuthClient} client
 * @param {string} code
 * @param {string} redirectUri
 * @returns {Promise<{ refresh_token?: string, access_token?: string }>}
 */
async function exchangeCodeForTokens(client, code, redirectUri) {
  const res = await fetch(client.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: client.client_id,
      client_secret: client.client_secret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    throw new GscError(
      ErrorCodes.TOKEN_EXCHANGE_FAILED,
      `Token exchange failed (HTTP ${res.status}).`,
      { context: { status: res.status, body: await safeText(res) } },
    );
  }
  return res.json();
}

/** @param {Response} res @returns {Promise<string>} */
async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
