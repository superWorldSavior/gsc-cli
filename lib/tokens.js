/**
 * OAuth client & token file I/O.
 *
 * The refresh token is bound to the Google *user*, not the GCP project — one
 * bootstrap covers every Search Console property the user owns.
 */
import { readFile, writeFile, chmod, rename, unlink } from "node:fs/promises";
import { GscError, ErrorCodes } from "./errors.js";

/**
 * @typedef {object} OAuthClient
 * @property {string} client_id
 * @property {string} client_secret
 * @property {string} auth_uri
 * @property {string} token_uri
 */

/**
 * @typedef {object} Tokens
 * @property {string} client_id
 * @property {string} client_secret
 * @property {string} refresh_token
 * @property {string} token_uri
 */

/**
 * Load the OAuth Desktop client downloaded from GCP Console.
 * Accepts both the `installed` and `web` wrapper shapes.
 *
 * @param {string} path
 * @returns {Promise<OAuthClient>}
 */
export async function loadOAuthClient(path) {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new GscError(
      ErrorCodes.OAUTH_CLIENT_MISSING,
      `OAuth client not found at ${path}.`,
      {
        context: { path },
        recovery:
          "Download the Desktop OAuth client JSON from GCP Console and save it " +
          "to this path (or set GSC_OAUTH_CLIENT_PATH).",
      },
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GscError(
      ErrorCodes.OAUTH_CLIENT_INVALID,
      `OAuth client at ${path} is not valid JSON.`,
      { context: { path }, recovery: "Re-download the client JSON from GCP." },
    );
  }
  const c = parsed.installed ?? parsed.web ?? {};
  if (!c.client_id || !c.client_secret) {
    throw new GscError(
      ErrorCodes.OAUTH_CLIENT_INVALID,
      `OAuth client at ${path} is missing client_id/client_secret.`,
      { context: { path }, recovery: "Re-download the client JSON from GCP." },
    );
  }
  return {
    client_id: c.client_id,
    client_secret: c.client_secret,
    auth_uri: c.auth_uri ?? "https://accounts.google.com/o/oauth2/auth",
    token_uri: c.token_uri ?? "https://oauth2.googleapis.com/token",
  };
}

/**
 * Load stored refresh-token credentials.
 * @param {string} path
 * @returns {Promise<Tokens>}
 */
export async function loadTokens(path) {
  let raw;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new GscError(
      ErrorCodes.TOKENS_MISSING,
      `Tokens not found at ${path}.`,
      {
        context: { path },
        recovery: "Run `gsc-auth` once to bootstrap the refresh token.",
      },
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GscError(
      ErrorCodes.TOKENS_INVALID,
      `Tokens at ${path} are not valid JSON.`,
      { context: { path }, recovery: "Re-run `gsc-auth`." },
    );
  }
  const missing = ["client_id", "client_secret", "refresh_token", "token_uri"]
    .filter((k) => !parsed[k]);
  if (missing.length > 0) {
    throw new GscError(
      ErrorCodes.TOKENS_INVALID,
      `Tokens at ${path} are missing: ${missing.join(", ")}.`,
      { context: { path, missing }, recovery: "Re-run `gsc-auth`." },
    );
  }
  return parsed;
}

/**
 * Persist tokens with 0600 permissions, atomically.
 *
 * Writing then chmod-ing an existing file leaves a TOCTOU window where the
 * secret sits at the umask default (often 0644). Instead we create a temp file
 * that is 0600 from birth and rename it over the target — rename preserves the
 * source inode's mode, so the final file is never group/other-readable.
 *
 * @param {string} path
 * @param {Tokens} tokens
 * @returns {Promise<void>}
 */
export async function saveTokens(path, tokens) {
  const tmp = `${path}.tmp-${process.pid}`;
  try {
    await writeFile(tmp, JSON.stringify(tokens, null, 2), { mode: 0o600 });
    await chmod(tmp, 0o600); // belt-and-suspenders: umask may strip creation mode
    await rename(tmp, path);
  } catch (err) {
    // Never leave a temp file holding secrets if chmod/rename fails.
    await unlink(tmp).catch(() => {});
    throw err;
  }
}
