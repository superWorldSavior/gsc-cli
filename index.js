/**
 * @casys-ai/gsc-cli — programmatic API.
 *
 * Composable primitives for Google Search Console with zero runtime deps.
 * Import these to build your own tooling; or use the `gsc-auth` / `gsc-query`
 * bins for the command line.
 *
 * @example
 * import { resolveTokensPath, loadTokens, refreshAccessToken, querySearchAnalytics } from "@casys-ai/gsc-cli";
 * const tokens = await loadTokens(resolveTokensPath());
 * const accessToken = await refreshAccessToken(tokens);
 * const rows = await querySearchAnalytics(accessToken, {
 *   site: "sc-domain:example.com",
 *   startDate: "2026-06-01", endDate: "2026-06-28",
 *   dimensions: ["query"], rowLimit: 50,
 * });
 */
export { GscError, ErrorCodes } from "./lib/errors.js";
export {
  resolveClientPath,
  resolveTokensPath,
  resolveAuthPort,
  defaultDateRange,
  SCOPE_READONLY,
  SCOPE_FULL,
} from "./lib/config.js";
export { loadOAuthClient, loadTokens, saveTokens } from "./lib/tokens.js";
export {
  bootstrapOAuth,
  refreshAccessToken,
  buildAuthUrl,
} from "./lib/oauth.js";
export {
  querySearchAnalytics,
  formatRowsMarkdown,
} from "./lib/search-analytics.js";
export { parseQueryArgs } from "./lib/cli-args.js";
