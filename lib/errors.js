/**
 * Machine-readable error type.
 *
 * Agents parse codes, not prose (AX principle #4). Every failure carries a
 * stable `code`, optional `context`, and a `recovery` hint describing the next
 * action. The CLIs serialize this to `{ ok:false, error:{...} }` in --json mode.
 *
 * @see https://casys.ai/blog/from-dx-to-ax
 */
export class GscError extends Error {
  /**
   * @param {string} code     Stable, UPPER_SNAKE error code (never localized).
   * @param {string} message  Human-readable one-liner.
   * @param {object} [opts]
   * @param {Record<string, unknown>} [opts.context]  Structured details.
   * @param {string} [opts.recovery]  Actionable next step.
   */
  constructor(code, message, opts = {}) {
    super(message);
    this.name = "GscError";
    this.code = code;
    this.context = opts.context ?? {};
    this.recovery = opts.recovery ?? "";
  }

  /** Machine-readable shape for JSON output. */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      context: this.context,
      recovery: this.recovery,
    };
  }
}

/** Known error codes — the stable contract for callers. */
export const ErrorCodes = Object.freeze({
  OAUTH_CLIENT_MISSING: "OAUTH_CLIENT_MISSING",
  OAUTH_CLIENT_INVALID: "OAUTH_CLIENT_INVALID",
  OAUTH_CALLBACK_ERROR: "OAUTH_CALLBACK_ERROR",
  TOKEN_EXCHANGE_FAILED: "TOKEN_EXCHANGE_FAILED",
  TOKEN_REFRESH_FAILED: "TOKEN_REFRESH_FAILED",
  NO_REFRESH_TOKEN: "NO_REFRESH_TOKEN",
  TOKENS_MISSING: "TOKENS_MISSING",
  TOKENS_INVALID: "TOKENS_INVALID",
  SITE_MISSING: "SITE_MISSING",
  BAD_ARG: "BAD_ARG",
  BAD_DIMENSION: "BAD_DIMENSION",
  BAD_LIMIT: "BAD_LIMIT",
  API_ERROR: "API_ERROR",
});
