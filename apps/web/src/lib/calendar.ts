export type CalendarView = 'day' | 'week' | 'month';

export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

/** Monday-based week start. */
export function startOfWeek(d: Date) {
  const day = (d.getDay() + 6) % 7;
  return addDays(startOfDay(d), -day);
}

export function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Visible [from, to) range for a calendar view. Month view covers whole weeks
 * (Monday → Sunday) so leading/trailing days are filled.
 */
export function viewRange(view: CalendarView, anchor: Date): { from: Date; to: Date; days: Date[] } {
  let from: Date;
  let count: number;
  if (view === 'day') {
    from = startOfDay(anchor);
    count = 1;
  } else if (view === 'week') {
    from = startOfWeek(anchor);
    count = 7;
  } else {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    from = startOfWeek(first);
    const end = addDays(startOfWeek(last), 7);
    count = Math.round((end.getTime() - from.getTime()) / 86400000);
  }
  const days = Array.from({ length: count }, (_, i) => addDays(from, i));
  return { from, to: addDays(from, count), days };
}

export function shiftAnchor(view: CalendarView, anchor: Date, direction: 1 | -1) {
  if (view === 'day') return addDays(anchor, direction);
  if (view === 'week') return addDays(anchor, 7 * direction);
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

/** Do [aStart, aStart+aMin) and [bStart, bStart+bMin) overlap? */
export function overlaps(aStart: Date, aMinutes: number, bStart: Date, bMinutes: number) {
  const aEnd = aStart.getTime() + aMinutes * 60000;
  const bEnd = bStart.getTime() + bMinutes * 60000;
  return aStart.getTime() < bEnd && bStart.getTime() < aEnd;
}
