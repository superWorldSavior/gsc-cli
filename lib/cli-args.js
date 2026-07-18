/**
 * Query CLI argument parsing — pure and validated at the boundary (AX #5).
 *
 * Kept dependency-free and side-effect-free so it can be unit-tested and reused
 * by non-CLI callers. Fails fast with a machine-readable GscError.
 */
import { GscError, ErrorCodes } from "./errors.js";
import { defaultDateRange } from "./config.js";

const DIMENSIONS = new Set(["query", "page", "country", "device", "date"]);

/**
 * @typedef {object} QueryArgs
 * @property {string} site
 * @property {string} startDate
 * @property {string} endDate
 * @property {string[]} dimensions
 * @property {number} limit
 * @property {boolean} asJson
 */

/**
 * @param {string[]} argv  Raw args (already stripped of node/bin, e.g. process.argv.slice(2)).
 * @param {NodeJS.ProcessEnv} env
 * @param {Date} now  Reference date for default window (inject for determinism).
 * @returns {QueryArgs}
 */
export function parseQueryArgs(argv, env, now) {
  const { startDate: defStart, endDate: defEnd } = defaultDateRange(now);

  let site = env.GSC_DEFAULT_SITE ?? "";
  let startDate = defStart;
  let endDate = defEnd;
  let dimensions = ["query"];
  let limit = 50;
  let asJson = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null) {
        throw new GscError(ErrorCodes.BAD_ARG, `${arg} expects a value.`, {
          context: { flag: arg },
        });
      }
      return v;
    };
    switch (arg) {
      case "--site": site = next(); break;
      case "--start": startDate = next(); break;
      case "--end": endDate = next(); break;
      case "--dim": dimensions = parseDims(next()); break;
      case "--limit": limit = Number(next()); break;
      case "--json": asJson = true; break;
      default:
        throw new GscError(ErrorCodes.BAD_ARG, `Unknown argument: ${arg}.`, {
          context: { arg },
          recovery:
            "Usage: gsc-query [--site <url>] [--start YYYY-MM-DD] " +
            "[--end YYYY-MM-DD] [--dim query|page|country|device|date,...] " +
            "[--limit N] [--json]",
        });
    }
  }

  if (!site) {
    throw new GscError(
      ErrorCodes.SITE_MISSING,
      "No site given.",
      { recovery: "Pass --site <url> or set GSC_DEFAULT_SITE." },
    );
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 25000) {
    throw new GscError(
      ErrorCodes.BAD_LIMIT,
      `--limit must be an integer in 1..25000 (got: ${limit}).`,
      { context: { limit } },
    );
  }
  return { site, startDate, endDate, dimensions, limit, asJson };
}

/** @param {string} raw @returns {string[]} */
function parseDims(raw) {
  const dims = raw.split(",").map((d) => d.trim()).filter(Boolean);
  for (const d of dims) {
    if (!DIMENSIONS.has(d)) {
      throw new GscError(
        ErrorCodes.BAD_DIMENSION,
        `Unknown dimension: ${d}.`,
        {
          context: { dimension: d, allowed: [...DIMENSIONS] },
          recovery: `Allowed: ${[...DIMENSIONS].join(", ")}.`,
        },
      );
    }
  }
  if (dims.length === 0) {
    throw new GscError(ErrorCodes.BAD_DIMENSION, "--dim is empty.", {
      recovery: `Allowed: ${[...DIMENSIONS].join(", ")}.`,
    });
  }
  return dims;
}
