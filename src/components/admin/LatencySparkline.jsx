import { useMemo } from 'react';
import { LineChart, Line, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

/**
 * Tiny latency sparkline for an API health probe. Accepts an array of
 * { latency_ms, status, checked_at } events and renders a line whose
 * color reflects the worst recent status:
 *   any 'down'      → red
 *   any 'degraded'  → amber
 *   otherwise       → emerald
 */

export default function LatencySparkline({ events = [], height = 40 }) {
    const { data, color } = useMemo(() => {
        const points = events
            .filter((e) => Number.isFinite(e?.latency_ms))
            .map((e) => ({
                t:   e.checked_at,
                ms:  e.latency_ms,
                st:  e.status,
            }));

        let worst = 'healthy';
        for (const p of points) {
            if (p.st === 'down') { worst = 'down'; break; }
            if (p.st === 'degraded' && worst !== 'down') worst = 'degraded';
        }

        const color = worst === 'down' ? '#dc2626'
                    : worst === 'degraded' ? '#d97706'
                    : '#059669';

        return { data: points, color };
    }, [events]);

    if (!data.length) {
        return <div className="text-xs text-slate-400 italic">no data</div>;
    }

    return (
        <div style={{ height, width: '100%' }}>
            <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Tooltip
                        contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 11 }}
                        formatter={(v) => [`${v}ms`, 'Latency']}
                        labelFormatter={(_, items) => items?.[0]?.payload?.t?.slice(11, 19) ?? ''}
                    />
                    <Line
                        type="monotone"
                        dataKey="ms"
                        stroke={color}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
