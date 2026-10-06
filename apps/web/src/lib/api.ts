/**
 * Thin fetch wrapper for the KidRehab API.
 *
 * - The access token lives only in memory (never in localStorage).
 * - The refresh token is an httpOnly cookie handled by the browser; on a 401 we
 *   call /auth/refresh once (deduplicated across concurrent requests) and retry.
 */
const BASE = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: unknown,
  ) {
    super(message);
  }

  /** Field-level messages from Nest's ValidationPipe, if any. */
  get details(): string[] {
    const m = (this.body as { message?: unknown })?.message;
    return Array.isArray(m) ? m.map(String) : [];
  }
}

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onAuthFailure: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setAuthFailureHandler(handler: (() => void) | null) {
  onAuthFailure = handler;
}

export async function refreshAccessToken(): Promise<{ accessToken: string; user: unknown } | null> {
  const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'same-origin' });
  if (!res.ok) {
    accessToken = null;
    return null;
  }
  const data = await res.json();
  accessToken = data.accessToken;
  return data;
}

function refreshOnce(): Promise<boolean> {
  refreshing ??= refreshAccessToken()
    .then((r) => !!r)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
}

export function buildQuery(query?: Query) {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${buildQuery(opts.query)}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.', null);
  }

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshOnce()) return api<T>(path, opts, false);
    onAuthFailure?.();
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = (data as { message?: unknown })?.message;
    const message = Array.isArray(msg) ? msg.join('. ') : typeof msg === 'string' ? msg : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'You do not have permission to do this.';
    return err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}
