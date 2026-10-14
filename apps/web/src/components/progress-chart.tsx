'use client';

import { useRouter } from 'next/navigation';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate, formatValue } from '@/lib/format';
import type { ProgressGoal } from '@/lib/types';
import { useT } from '@/lib/i18n';

const SERIES = '#3b76e0'; // primary-600
const INK_MUTED = '#64748b'; // slate-500
const GRID = '#e2e8f0'; // slate-200
const TARGET = '#228650'; // success-600

interface Point {
  t: number;
  value: number;
  sessionId: string | null;
  sessionDate: string | null;
  therapist: string;
}

/**
 * US-061: Y = measurement value, X = date (chronological). Hover shows date,
 * measurement and session; clicking a point opens that session.
 */
export function ProgressChart({ goal }: { goal: ProgressGoal }) {
  const router = useRouter();
  const t = useT();
  const data: Point[] = [...goal.measurements]
    .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime())
    .map((m) => ({ t: new Date(m.measuredAt).getTime(), value: m.value, sessionId: m.sessionId, sessionDate: m.sessionDate, therapist: m.therapist }));

  const values = [goal.baselineValue, goal.targetValue, ...data.map((d) => d.value)];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.1 || 1;

  return (
    <div className="h-64 w-full sm:h-72" role="img" aria-label={t('progress.chartAriaLabel', { metric: goal.metricName, target: goal.targetValue, unit: goal.unit })}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 56, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={data.length === 1 ? [data[0].t - 86400000 * 7, data[0].t + 86400000 * 7] : ['dataMin', 'dataMax']}
            tickFormatter={(t: number) => formatDate(new Date(t), { year: undefined, day: 'numeric', month: 'short' })}
            tick={{ fill: INK_MUTED, fontSize: 12 }}
            stroke={GRID}
            tickMargin={8}
            minTickGap={24}
          />
          <YAxis
            domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
            tick={{ fill: INK_MUTED, fontSize: 12 }}
            stroke={GRID}
            width={48}
            tickFormatter={(v: number) => formatValue(v)}
          />
          <ReferenceLine
            y={goal.targetValue}
            stroke={TARGET}
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{ value: t('progress.chartTarget'), position: 'right', fill: TARGET, fontSize: 12, fontWeight: 600 }}
          />
          <ReferenceLine
            y={goal.baselineValue}
            stroke={INK_MUTED}
            strokeDasharray="2 4"
            label={{ value: t('progress.chartBaseline'), position: 'right', fill: INK_MUTED, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ stroke: INK_MUTED, strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
                  <p className="font-medium text-slate-900">{formatDate(new Date(p.t))}</p>
                  <p className="text-slate-700">
                    {goal.metricName}: <strong>{formatValue(p.value, goal.unit)}</strong>
                  </p>
                  <p className="text-slate-500">
                    {t('progress.tooltipSession', { date: p.sessionDate ? formatDate(p.sessionDate) : '—', therapist: p.therapist })}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={SERIES}
            strokeWidth={2}
            isAnimationActive={false}
            dot={{ r: 5, fill: SERIES, stroke: '#fff', strokeWidth: 2 }}
            activeDot={{
              r: 8,
              fill: SERIES,
              stroke: '#fff',
              strokeWidth: 2,
              cursor: 'pointer',
              onClick: (_e: unknown, payload: unknown) => {
                const p = (payload as { payload?: Point })?.payload;
                if (p?.sessionId) router.push(`/sessions/${p.sessionId}`);
              },
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
