'use client';

/** Large +/- number control for tablet use. Calls onChange with null when cleared. */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  suffix,
  disabled,
  inline,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
  /** Label on the left, compact control on the right (for narrow columns). */
  inline?: boolean;
}) {
  const set = (v: number | null) => onChange(v === null ? null : Math.min(max, Math.max(min, v)));
  return (
    <div className={inline ? 'flex items-center justify-between gap-3' : undefined}>
      <span className={inline ? 'text-sm font-medium text-slate-600' : 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500'}>{label}</span>
      <div className={`flex items-stretch overflow-hidden rounded-xl border border-slate-300 bg-white ${inline ? 'w-36 shrink-0' : ''}`}>
        <button
          type="button"
          disabled={disabled || (value ?? 0) <= min}
          onClick={() => set((value ?? 0) - step)}
          className="min-h-touch min-w-touch text-xl font-medium text-slate-600 hover:bg-slate-100 disabled:text-slate-300"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          aria-label={label}
          disabled={disabled}
          value={value ?? ''}
          onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))}
          className="w-full min-w-0 border-x border-slate-200 text-center text-base font-semibold tabular-nums focus:outline-none disabled:bg-slate-50"
        />
        {suffix && <span className="self-center px-1 text-xs text-slate-500">{suffix}</span>}
        <button
          type="button"
          disabled={disabled || (value ?? 0) >= max}
          onClick={() => set((value ?? 0) + step)}
          className="min-h-touch min-w-touch text-xl font-medium text-slate-600 hover:bg-slate-100 disabled:text-slate-300"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
