import { describe, expect, it } from 'vitest';
import { progressPercent } from './progress';

describe('progressPercent', () => {
  it('computes the PRD example (baseline 5, current 22, target 30 → 68%)', () => {
    expect(progressPercent(5, 30, 22)).toBe(68);
  });
  it('clamps to 0–100', () => {
    expect(progressPercent(5, 30, 2)).toBe(0);
    expect(progressPercent(5, 30, 40)).toBe(100);
  });
  it('supports metrics where lower is better', () => {
    expect(progressPercent(15, 3, 9, 'DECREASE_IS_BETTER')).toBe(50);
  });
  it('returns 0 without a current value', () => {
    expect(progressPercent(5, 30, null)).toBe(0);
  });
});
