'use client';

import clsx from 'clsx';
import { LOCALES, useI18n } from '@/lib/i18n';

const NAMES = { vi: 'Tiếng Việt', en: 'English' } as const;

/** Two-option toggle; each language is named in itself so it is recognisable in either UI. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div role="radiogroup" aria-label={t('shell.switchLanguage')} className={clsx('flex gap-1', className)}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={locale === l}
          lang={l}
          onClick={() => setLocale(l)}
          className={clsx(
            'min-h-touch flex-1 rounded-xl px-3 text-sm font-medium transition-colors',
            locale === l ? 'bg-primary-50 text-primary-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
          )}
        >
          {NAMES[l]}
        </button>
      ))}
    </div>
  );
}
