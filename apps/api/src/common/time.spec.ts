import { ageInYears, dayRange, toDateOnly, tzOffsetMinutes } from './time';

describe('time helpers', () => {
  it('computes the Asia/Ho_Chi_Minh offset (+7h)', () => {
    expect(tzOffsetMinutes(new Date('2026-10-06T12:00:00Z'), 'Asia/Ho_Chi_Minh')).toBe(420);
  });

  it('returns the clinic-local day as UTC instants', () => {
    // 22:44 UTC on 6 Oct is already 7 Oct 05:44 in Vietnam.
    const { start, end } = dayRange(new Date('2026-10-06T22:44:00Z'), 'Asia/Ho_Chi_Minh');
    expect(start.toISOString()).toBe('2026-10-06T17:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-07T17:00:00.000Z');
  });

  it('handles DST zones', () => {
    const { start, end } = dayRange(new Date('2026-07-01T12:00:00Z'), 'Europe/Berlin');
    expect(start.toISOString()).toBe('2026-06-30T22:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(24 * 3600 * 1000);
  });

  it('calculates age from date of birth', () => {
    const dob = new Date('2021-10-07T00:00:00Z');
    expect(ageInYears(dob, new Date('2026-10-06T00:00:00Z'))).toBe(4);
    expect(ageInYears(dob, new Date('2026-10-07T00:00:00Z'))).toBe(5);
  });

  it('normalises to a date-only value', () => {
    expect(toDateOnly('2026-11-12').toISOString()).toBe('2026-11-12T00:00:00.000Z');
  });
});
