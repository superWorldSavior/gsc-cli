/**
 * Search Analytics query + formatting.
 *
 * One primitive does one thing (AX #8): `querySearchAnalytics` takes an access
 * token and a narrow request, returns rows. Formatting is separate so callers
 * can consume rows directly or render Markdown.
 */
import { GscError, ErrorCodes } from "./errors.js";

/** @typedef {"query"|"page"|"country"|"device"|"date"} Dimension */

/**
 * @typedef {object} Row
 * @property {string[]} keys
 * @property {number} clicks
 * @property {number} impressions
 * @property {number} ctr
 * @property {number} position
 */

/**
 * @typedef {object} QueryRequest
 * @property {string} site       Property URL, e.g. "sc-domain:example.com".
 * @property {string} startDate  ISO YYYY-MM-DD.
 * @property {string} endDate    ISO YYYY-MM-DD.
 * @property {Dimension[]} dimensions
 * @property {number} rowLimit   1..25000.
 */

/**
 * Query the GSC Search Analytics endpoint.
 *
 * @param {string} accessToken
 * @param {QueryRequest} req
 * @returns {Promise<Row[]>}
 */
export async function querySearchAnalytics(accessToken, req) {
  const url =
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${
      encodeURIComponent(req.site)
    }/searchAnalytics/query`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDate: req.startDate,
      endDate: req.endDate,
      dimensions: req.dimensions,
      rowLimit: req.rowLimit,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GscError(
      ErrorCodes.API_ERROR,
      `GSC API returned HTTP ${res.status} for ${req.site}.`,
      {
        context: { status: res.status, site: req.site, body },
        recovery: res.status === 403
          ? "Check that the API is enabled on the GCP project and the OAuth " +
            "user owns this property (Search Console → Settings → Users)."
          : "",
      },
    );
  }
  const json = await res.json();
  return json.rows ?? [];
}

/**
 * Render rows as a Markdown table (human/CLI view).
 *
 * @param {Row[]} rows
 * @param {{ site: string, startDate: string, endDate: string, dimensions: string[] }} meta
 * @returns {string}
 */
export function formatRowsMarkdown(rows, meta) {
  const header =
    `# GSC ${meta.site} — ${meta.startDate} → ${meta.endDate} (dim=${
      meta.dimensions.join("+")
    })`;
  if (rows.length === 0) return `${header}\n\n_(no rows)_`;

  const cols = ["#", ...meta.dimensions, "clicks", "impr.", "ctr", "pos."];
  const sep = cols.map(() => "---");
  const body = rows.map((r, i) =>
    tableRow([
      String(i + 1),
      ...r.keys,
      String(r.clicks),
      String(r.impressions),
      `${(r.ctr * 100).toFixed(2)}%`,
      r.position.toFixed(1),
    ])
  );
  return [header, "", tableRow(cols), tableRow(sep), ...body].join("\n");
}

/** @param {string[]} cells @returns {string} */
function tableRow(cells) {
  return `| ${cells.join(" | ")} |`;
}
