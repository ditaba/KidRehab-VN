import { describe, expect, it } from 'vitest';
import { enumLabel, setActiveLocale, translate } from './core';
import { messages } from './messages';

describe('i18n', () => {
  it('every namespace has the same keys and no empty strings in both languages', () => {
    for (const [ns, table] of Object.entries(messages) as [string, { en: Record<string, string>; vi: Record<string, string> }][]) {
      expect(Object.keys(table.vi).sort(), ns).toEqual(Object.keys(table.en).sort());
      for (const [k, v] of Object.entries(table.vi)) expect(v.trim(), `${ns}.${k}`).not.toBe('');
    }
  });

  it('keeps the same placeholders in both languages', () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const [ns, table] of Object.entries(messages) as [string, { en: Record<string, string>; vi: Record<string, string> }][]) {
      for (const k of Object.keys(table.en)) expect(placeholders(table.vi[k]), `${ns}.${k}`).toEqual(placeholders(table.en[k]));
    }
  });

  it('interpolates variables', () => {
    expect(translate('en', 'common.pageOf', { page: 2, total: 5 })).toBe('Page 2 of 5');
    expect(translate('vi', 'common.pageOf', { page: 2, total: 5 })).toBe('Trang 2/5');
  });

  it('labels enum values in the active language and humanizes unknown ones', () => {
    setActiveLocale('vi');
    expect(enumLabel('THERAPIST')).toBe('Kỹ thuật viên');
    expect(enumLabel('SOMETHING_NEW')).toBe('Something new');
    setActiveLocale('en');
    expect(enumLabel('IN_PROGRESS')).toBe('In progress');
  });
});
