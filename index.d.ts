/**
 * Type definitions for @casys-ai/gsc-cli.
 */

export type Dimension = "query" | "page" | "country" | "device" | "date";

export interface OAuthClient {
  client_id: string;
  client_secret: string;
  auth_uri: string;
  token_uri: string;
}

export interface Tokens {
  client_id: string;
  client_secret: string;
  refresh_token: string;
  token_uri: string;
}

export interface Row {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface QueryRequest {
  site: string;
  startDate: string;
  endDate: string;
  dimensions: Dimension[];
  rowLimit: number;
}

export interface QueryArgs {
  site: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  limit: number;
  asJson: boolean;
}

export type ErrorCode =
  | "OAUTH_CLIENT_MISSING"
  | "OAUTH_CLIENT_INVALID"
  | "OAUTH_CALLBACK_ERROR"
  | "TOKEN_EXCHANGE_FAILED"
  | "TOKEN_REFRESH_FAILED"
  | "NO_REFRESH_TOKEN"
  | "TOKENS_MISSING"
  | "TOKENS_INVALID"
  | "SITE_MISSING"
  | "BAD_ARG"
  | "BAD_DIMENSION"
  | "BAD_LIMIT"
  | "API_ERROR";

export class GscError extends Error {
  code: string;
  context: Record<string, unknown>;
  recovery: string;
  constructor(
    code: string,
    message: string,
    opts?: { context?: Record<string, unknown>; recovery?: string },
  );
  toJSON(): { code: string; message: string; context: Record<string, unknown>; recovery: string };
}

export const ErrorCodes: Readonly<Record<ErrorCode, ErrorCode>>;

export const SCOPE_READONLY: string;
export const SCOPE_FULL: string;

export function resolveClientPath(env?: NodeJS.ProcessEnv): string;
export function resolveTokensPath(env?: NodeJS.ProcessEnv): string;
export function resolveAuthPort(env?: NodeJS.ProcessEnv): number;
export function defaultDateRange(now: Date): { startDate: string; endDate: string };

export function loadOAuthClient(path: string): Promise<OAuthClient>;
export function loadTokens(path: string): Promise<Tokens>;
export function saveTokens(path: string, tokens: Tokens): Promise<void>;

export function bootstrapOAuth(opts: {
  clientPath: string;
  tokensPath: string;
  port: number;
  scope?: string;
  onAuthUrl?: (url: string) => void;
  log?: (msg: string) => void;
}): Promise<Tokens>;

export function refreshAccessToken(tokens: Tokens): Promise<string>;
export function buildAuthUrl(
  client: OAuthClient,
  redirectUri: string,
  state: string,
  scope: string,
): string;

export function querySearchAnalytics(
  accessToken: string,
  req: QueryRequest,
): Promise<Row[]>;

export function formatRowsMarkdown(
  rows: Row[],
  meta: { site: string; startDate: string; endDate: string; dimensions: string[] },
): string;

export function parseQueryArgs(
  argv: string[],
  env: NodeJS.ProcessEnv,
  now: Date,
): QueryArgs;
