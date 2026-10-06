import { describe, expect, it } from 'vitest';
import { overlaps, shiftAnchor, startOfWeek, viewRange } from './calendar';

describe('calendar ranges', () => {
  const wed = new Date(2026, 9, 7, 15, 30); // Wed 7 Oct 2026

  it('week starts on Monday', () => {
    expect(startOfWeek(wed)).toEqual(new Date(2026, 9, 5));
  });

  it('day view covers one day', () => {
    const r = viewRange('day', wed);
    expect(r.from).toEqual(new Date(2026, 9, 7));
    expect(r.to).toEqual(new Date(2026, 9, 8));
    expect(r.days).toHaveLength(1);
  });

  it('week view covers Monday to next Monday', () => {
    const r = viewRange('week', wed);
    expect(r.days).toHaveLength(7);
    expect(r.to).toEqual(new Date(2026, 9, 12));
  });

  it('month view covers whole weeks around the month', () => {
    const r = viewRange('month', wed);
    expect(r.from).toEqual(new Date(2026, 8, 28)); // Mon 28 Sep
    expect(r.days.length % 7).toBe(0);
    expect(r.days.at(-1)).toEqual(new Date(2026, 10, 1)); // Sun 1 Nov
  });

  it('shifts months from the first of the month', () => {
    expect(shiftAnchor('month', new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 1));
  });

  it('detects overlapping appointments', () => {
    const a = new Date(2026, 9, 7, 9, 0);
    expect(overlaps(a, 45, new Date(2026, 9, 7, 9, 30), 45)).toBe(true);
    expect(overlaps(a, 45, new Date(2026, 9, 7, 9, 45), 45)).toBe(false);
  });
});
