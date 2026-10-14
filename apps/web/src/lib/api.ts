/**
 * Thin fetch wrapper for the KidRehab API.
 *
 * - The access token lives only in memory (never in localStorage).
 * - The refresh token is an httpOnly cookie handled by the browser; on a 401 we
 *   call /auth/refresh once (deduplicated across concurrent requests) and retry.
 */
import { enumLabel, MessageKey, t, Vars } from './i18n';

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
    throw new ApiError(0, t('errors.network'), null);
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
    const message = Array.isArray(msg) ? msg.join('. ') : typeof msg === 'string' ? msg : t('errors.requestFailed', { status: res.status });
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

// The API answers in English; known messages are shown in the active language.
const KNOWN_ERRORS: Record<string, MessageKey> = {
  'Patient not found': 'errors.patientNotFound',
  'Session not found': 'errors.sessionNotFound',
  'Session exercise not found': 'errors.exerciseNotFound',
  'Treatment plan not found': 'errors.planNotFound',
  'Goal not found': 'errors.goalNotFound',
  'Assessment not found': 'errors.assessmentNotFound',
  'Appointment not found': 'errors.appointmentNotFound',
  'Appointment not found for this patient': 'errors.appointmentNotFound',
  'Exercise not found': 'errors.exerciseNotFound',
  'Measurement not found': 'errors.measurementNotFound',
  'Guardian not found': 'errors.guardianNotFound',
  'Diagnosis not found': 'errors.diagnosisNotFound',
  'Metric not found for this patient': 'errors.metricNotFound',
  'Progress metric not found for this patient': 'errors.metricNotFound',
  'User not found': 'errors.userNotFound',
  'Staff member not found': 'errors.staffNotFound',
  'Receptionists can only update demographic information': 'errors.receptionistDemographicsOnly',
  'Only the assigned therapist or a doctor can edit this session': 'errors.sessionEditNotAllowed',
  'This exercise is disabled': 'errors.exerciseDisabled',
  'Date of birth cannot be in the future': 'errors.dobInFuture',
  'Appointment is cancelled': 'errors.appointmentCancelled',
  'A user with this email already exists': 'errors.emailInUse',
  'A patient must have at least one guardian': 'errors.guardianRequired',
  'Status cannot be changed while completing': 'errors.statusWhileCompleting',
  'Review date must be on or after the start date': 'errors.reviewBeforeStart',
  '"to" must be after "from"': 'errors.toBeforeFrom',
};

const KNOWN_ERROR_PATTERNS: [RegExp, MessageKey, (m: RegExpMatchArray) => Vars][] = [
  [/^Session is (\w+) and can no longer be edited$/, 'errors.sessionLocked', (m) => ({ status: enumLabel(m[1].toUpperCase()).toLowerCase() })],
  [/^Patient code (.+) is already in use$/, 'errors.patientCodeInUse', (m) => ({ code: m[1] })],
  [/^Date range cannot exceed (\d+) days$/, 'errors.rangeTooLong', (m) => ({ days: m[1] })],
];

/** The API's message in the active language when it is a known one, otherwise as sent. */
export function localizeApiMessage(message: string): string {
  const key = KNOWN_ERRORS[message];
  if (key) return t(key);
  for (const [re, k, vars] of KNOWN_ERROR_PATTERNS) {
    const m = message.match(re);
    if (m) return t(k, vars(m));
  }
  return message;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return t('errors.forbidden');
    if (err.status === 0) return t('errors.network');
    return localizeApiMessage(err.message);
  }
  return err instanceof Error ? err.message : t('errors.generic');
}
