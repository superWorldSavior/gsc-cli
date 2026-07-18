/**
 * Path & default resolution — pure, env-driven, no hidden state (AX #6, #7).
 *
 * Every default is derived explicitly from `env` (defaults to process.env) so
 * the same inputs always resolve to the same paths. Secrets live under the OS
 * home dir, never in a repo.
 */
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = ".config";

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string} Path to the downloaded OAuth Desktop client JSON.
 */
export function resolveClientPath(env = process.env) {
  return env.GSC_OAUTH_CLIENT_PATH ??
    join(homedir(), CONFIG_DIR, "gsc-oauth-client.json");
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string} Path to the stored refresh-token file.
 */
export function resolveTokensPath(env = process.env) {
  return env.GSC_TOKENS_PATH ??
    join(homedir(), CONFIG_DIR, "gsc-tokens.json");
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {number} Loopback port for the one-time OAuth callback server.
 */
export function resolveAuthPort(env = process.env) {
  const raw = env.GSC_AUTH_PORT;
  if (raw == null || raw === "") return 53682;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`GSC_AUTH_PORT invalid: ${raw}`);
  }
  return port;
}

/** OAuth scope. Read-only by default (AX #2 — safe defaults). */
export const SCOPE_READONLY = "https://www.googleapis.com/auth/webmasters.readonly";
export const SCOPE_FULL = "https://www.googleapis.com/auth/webmasters";

/**
 * Default query window, given a reference `now`. Pure for testability/determinism:
 * GSC data lags ~2-3 days, so `end = now - 3d`, `start = now - 31d`.
 *
 * @param {Date} now
 * @returns {{ startDate: string, endDate: string }} ISO (YYYY-MM-DD) dates.
 */
export function defaultDateRange(now) {
  return {
    startDate: isoDate(addDays(now, -31)),
    endDate: isoDate(addDays(now, -3)),
  };
}

/** @param {Date} d @returns {string} */
export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

/** @param {Date} d @param {number} days @returns {Date} */
export function addDays(d, days) {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}
