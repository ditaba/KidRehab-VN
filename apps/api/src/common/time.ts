/**
 * Timezone helpers. The clinic stores an IANA timezone (default Asia/Ho_Chi_Minh);
 * "today" for dashboards and today's sessions is computed in that zone.
 */

/** Offset (in minutes) of `timeZone` from UTC at the given instant. */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** [start, end) of the calendar day containing `date`, in `timeZone`, returned as UTC instants. */
export function dayRange(date: Date, timeZone: string): { start: Date; end: Date } {
  const offset = tzOffsetMinutes(date, timeZone);
  const local = new Date(date.getTime() + offset * 60000);
  const startLocalAsUtc = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const start = new Date(startLocalAsUtc - offset * 60000);
  const end = new Date(start.getTime() + 24 * 60 * 60000);
  return { start, end };
}

/** Whole years between dateOfBirth and `at`. */
export function ageInYears(dateOfBirth: Date, at: Date = new Date()): number {
  let age = at.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const m = at.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < dateOfBirth.getUTCDate())) age--;
  return Math.max(0, age);
}

/** Parses a YYYY-MM-DD (or ISO) string into a Date at UTC midnight for @db.Date columns. */
export function toDateOnly(value: string | Date): Date {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
