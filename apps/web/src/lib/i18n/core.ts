import { messages } from './messages';

export const LOCALES = ['vi', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'vi';
export const LOCALE_COOKIE = 'kidrehab-locale';

/** BCP 47 tags used for Intl date/number formatting. */
export const INTL_LOCALE: Record<Locale, string> = { vi: 'vi-VN', en: 'en-GB' };

type Messages = typeof messages;
type Namespace = keyof Messages;
export type MessageKey = { [N in Namespace]: `${N & string}.${keyof Messages[N]['en'] & string}` }[Namespace];
export type Vars = Record<string, string | number>;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const dot = key.indexOf('.');
  const ns = messages[key.slice(0, dot) as Namespace] as { en: Record<string, string>; vi: Record<string, string> };
  const name = key.slice(dot + 1);
  const template = ns?.[locale]?.[name] ?? ns?.en?.[name] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, v: string) => (v in vars ? String(vars[v]) : m));
}

/** True when `key` names an existing message (used for lookups keyed by runtime values such as enums). */
export function hasMessage(key: string): key is MessageKey {
  const dot = key.indexOf('.');
  const ns = messages[key.slice(0, dot) as Namespace] as { en: Record<string, string> } | undefined;
  return !!ns && key.slice(dot + 1) in ns.en;
}

// The active locale for code that runs outside React components (formatters,
// error mapping). The provider keeps it in sync with its state, and the whole
// tree re-mounts on a locale change so every formatted value is refreshed.
let activeLocale: Locale = DEFAULT_LOCALE;

export function setActiveLocale(locale: Locale) {
  activeLocale = locale;
}

export function getLocale(): Locale {
  return activeLocale;
}

export function intlLocale(): string {
  return INTL_LOCALE[activeLocale];
}

/** Translate with the active locale. Inside components prefer `useT()`. */
export function t(key: MessageKey, vars?: Vars): string {
  return translate(activeLocale, key, vars);
}

/** Label for an enum value (role, status, category, …), falling back to a humanized form. */
export function enumLabel(value?: string | null): string {
  if (!value) return '—';
  const key = `enums.${value}`;
  if (hasMessage(key)) return t(key);
  return value
    .toLowerCase()
    .split('_')
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}
