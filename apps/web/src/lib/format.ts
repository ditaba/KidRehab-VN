import { enumLabel, intlLocale, t } from './i18n';
import type { PatientRef } from './types';

export function patientName(p: Pick<PatientRef, 'firstName' | 'lastName'>) {
  // Vietnamese order: family name first (e.g. "Nguyen Van A").
  return `${p.lastName} ${p.firstName}`.trim();
}

export function formatDate(value?: string | Date | null, opts: Intl.DateTimeFormatOptions = {}) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString(intlLocale(), { day: '2-digit', month: 'short', year: 'numeric', ...opts });
}

/** For @db.Date values (stored at UTC midnight) – render without timezone shift. */
export function formatDay(value?: string | null) {
  if (!value) return '—';
  return formatDate(value, { timeZone: 'UTC' });
}

export function formatTime(value?: string | Date | null) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleTimeString(intlLocale(), { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return '—';
  return `${formatDate(value)} ${formatTime(value)}`;
}

export function formatValue(value: number | null | undefined, unit?: string) {
  if (value === null || value === undefined) return '—';
  const n = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
  return unit ? `${n} ${unit}` : n;
}

export function formatDuration(seconds?: number | null) {
  if (!seconds) return null;
  if (seconds < 60) return t('common.unitSeconds', { n: seconds });
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? t('common.unitMinutesSeconds', { m, s }) : t('common.unitMinutes', { n: m });
}

/** "3 × 10 reps · 30 s" (localized) */
export function formatPrescription(p: { sets?: number | null; repetitions?: number | null; durationSeconds?: number | null }) {
  const parts: string[] = [];
  if (p.sets && p.repetitions) parts.push(t('common.setsTimesReps', { sets: p.sets, reps: p.repetitions }));
  else if (p.sets) parts.push(t('common.sets', { n: p.sets }));
  else if (p.repetitions) parts.push(t('common.reps', { n: p.repetitions }));
  const d = formatDuration(p.durationSeconds);
  if (d) parts.push(d);
  return parts.join(' · ') || '—';
}

/** YYYY-MM-DD for <input type="date"> in local time. */
export function toInputDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toInputTime(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ageFromDob(dob: string, at = new Date()) {
  const d = new Date(dob);
  let age = at.getFullYear() - d.getUTCFullYear();
  const m = at.getMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && at.getDate() < d.getUTCDate())) age--;
  return Math.max(0, age);
}

/** Display label for an enum value (role, status, category, …) in the active language. */
export function humanize(value?: string | null) {
  return enumLabel(value);
}
