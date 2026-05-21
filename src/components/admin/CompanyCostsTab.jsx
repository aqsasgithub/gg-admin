import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import {
    DollarSign, Globe, Wifi, Box, Activity, Database, Cloud,
    TrendingUp, TrendingDown, Loader2, FileText,
} from 'lucide-react';
import {
    fetchCompanyCost, fetchCompanyCostRecords,
    selectCompanyCost, selectCompanyCostRecords,
} from '../../features/admin/adminCostsSlice';

const fmt = (cents) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ICONS = {
    base: DollarSign, domains: Globe, assets: Wifi, modules: Box,
    api_calls: Activity, storage: Database, bandwidth: Cloud,
};

export default function CompanyCostsTab({ company }) {
    const dispatch = useDispatch();
    const detail   = useSelector((s) => selectCompanyCost(s, company.id));
    const recs     = useSelector((s) => selectCompanyCostRecords(s, company.id));

    const [showRecords, setShowRecords] = useState(false);

    useEffect(() => { dispatch(fetchCompanyCost(company.id)); }, [dispatch, company.id]);
    useEffect(() => {
        if (showRecords) dispatch(fetchCompanyCostRecords({ companyId: company.id, per_page: 50 }));
    }, [dispatch, company.id, showRecords]);

    if (!detail) {
        return (
            <div className="text-center py-8 text-slate-500">
                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading cost detail…
            </div>
        );
    }

    const cur = detail.current;
    const margin = cur.total_margin_cents;

    return (
        <div className="space-y-4">
            <header>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <DollarSign size={16} /> Cost
                </h2>
                <p className="text-sm text-slate-500">
                    Live calculation for the current month based on this tenant's entitlements and usage.
                </p>
            </header>

            {/* Top-line */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card label="Projected this month" value={fmt(cur.total_billed_cents)} />
                <Card label="Provider cost" value={fmt(cur.total_provider_cents)} sub />
                <Card label="Margin" value={fmt(Math.abs(margin))}
                    prefix={margin < 0 ? '−' : '+'}
                    tone={margin < 0 ? 'critical' : 'good'}
                    icon={margin < 0 ? TrendingDown : TrendingUp} />
                <Card label="Plan" value={cur.plan_name ?? 'none'} sub
                    note={cur.plan_key ? <code className="text-[10px]">{cur.plan_key}</code> : null} />
            </div>

            {/* Volume */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SubCard icon={Globe}  label="Domains"   value={cur.domain_count} />
                <SubCard icon={Wifi}   label="Assets"    value={cur.asset_count} />
                <SubCard icon={Activity} label="Scans"  value={cur.scan_count} />
                <SubCard icon={Cloud}  label="API calls" value={cur.api_call_count.toLocaleString()} />
            </div>

            {/* Breakdown */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                    Cost breakdown
                </div>
                <table className="min-w-full text-sm">
                    <tbody className="divide-y divide-slate-100">
                        {Object.entries(cur.breakdown).map(([key, line]) => {
                            const Icon = ICONS[key] ?? Box;
                            return (
                                <tr key={key}>
                                    <td className="px-3 py-2.5 w-1/3">
                                        <div className="font-medium text-slate-900 flex items-center gap-1.5">
                                            <Icon size={12} className="text-slate-400" /> {line.label}
                                        </div>
                                        {line.note && <div className="text-xs text-slate-500 mt-0.5">{line.note}</div>}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        {line.items && (
                                            <div className="flex flex-wrap gap-1">
                                                {line.items.map((m) => (
                                                    <span key={m.module_key}
                                                        className={`px-1.5 py-0.5 text-[10px] rounded ${m.included ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}
                                                        title={m.included ? 'Included in plan' : `+${fmt(m.cents)}/mo`}>
                                                        {m.module_name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-mono">{fmt(line.cents)}</td>
                                </tr>
                            );
                        })}
                        <tr className="bg-slate-50/50 font-semibold">
                            <td className="px-3 py-2.5" colSpan="2">Subtotal</td>
                            <td className="px-3 py-2.5 text-right font-mono">{fmt(cur.subtotal_cents)}</td>
                        </tr>
                        {cur.discount_cents > 0 && (
                            <tr>
                                <td className="px-3 py-2.5" colSpan="2">Discount</td>
                                <td className="px-3 py-2.5 text-right font-mono text-emerald-600">−{fmt(cur.discount_cents)}</td>
                            </tr>
                        )}
                        <tr className="bg-guardian-navy/5 font-semibold">
                            <td className="px-3 py-2.5 text-guardian-navy" colSpan="2">Total billed</td>
                            <td className="px-3 py-2.5 text-right font-mono text-guardian-navy text-base">
                                {fmt(cur.total_billed_cents)}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* History */}
            {detail.history?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                        Past 12 months
                    </div>
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="text-xs uppercase tracking-wide text-slate-500 bg-slate-50/50">
                                <th className="px-3 py-1.5 text-left">Period</th>
                                <th className="px-3 py-1.5 text-right">Billed</th>
                                <th className="px-3 py-1.5 text-right">Provider</th>
                                <th className="px-3 py-1.5 text-right">Margin</th>
                                <th className="px-3 py-1.5 text-right">Domains</th>
                                <th className="px-3 py-1.5 text-right">Assets</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {detail.history.map((h) => (
                                <tr key={h.id}>
                                    <td className="px-3 py-1.5 text-xs">
                                        {MONTHS[h.period_month - 1]} {h.period_year}
                                    </td>
                                    <td className="px-3 py-1.5 text-right font-mono text-xs">{fmt(h.total_billed_cents)}</td>
                                    <td className="px-3 py-1.5 text-right font-mono text-xs text-slate-500">{fmt(h.total_provider_cents)}</td>
                                    <td className={`px-3 py-1.5 text-right font-mono text-xs ${h.total_margin_cents < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {h.total_margin_cents < 0 ? '−' : ''}{fmt(Math.abs(h.total_margin_cents))}
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-xs">{h.domain_count}</td>
                                    <td className="px-3 py-1.5 text-right text-xs">{h.asset_count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Records drill-in */}
            <div>
                <button type="button" onClick={() => setShowRecords((v) => !v)}
                    className="inline-flex items-center gap-1 text-sm text-guardian-navy hover:underline">
                    <FileText size={12} /> {showRecords ? 'Hide' : 'Show'} raw cost records
                </button>
                {showRecords && (
                    <div className="mt-2 bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <table className="min-w-full text-xs">
                            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-3 py-1.5 text-left">Date</th>
                                    <th className="px-3 py-1.5 text-left">Category</th>
                                    <th className="px-3 py-1.5 text-left">Module / provider</th>
                                    <th className="px-3 py-1.5 text-right">Units</th>
                                    <th className="px-3 py-1.5 text-right">Billed</th>
                                    <th className="px-3 py-1.5 text-right">Provider</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {!recs.list.length ? (
                                    <tr><td colSpan="6" className="px-3 py-6 text-center text-slate-500">
                                        No granular cost events recorded.
                                    </td></tr>
                                ) : recs.list.map((r) => (
                                    <tr key={r.id}>
                                        <td className="px-3 py-1.5 font-mono text-[10px]">{r.recorded_for}</td>
                                        <td className="px-3 py-1.5">{r.category}</td>
                                        <td className="px-3 py-1.5 text-slate-500">
                                            {r.module_key ?? '—'}{r.provider ? ` · ${r.provider}` : ''}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-mono">{r.units}</td>
                                        <td className="px-3 py-1.5 text-right font-mono">{fmt(r.total_cents)}</td>
                                        <td className="px-3 py-1.5 text-right font-mono text-slate-500">{fmt(r.provider_cost_cents)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function Card({ label, value, sub, prefix = '', tone, icon: Icon, note }) {
    const tones = { good: 'text-emerald-600', critical: 'text-red-600', default: 'text-guardian-navy' };
    return (
        <div className="p-3 bg-white border border-slate-200 rounded-lg">
            <div className="text-xs uppercase tracking-wide text-slate-500 flex items-center gap-1">
                {Icon && <Icon size={11} />} {label}
            </div>
            <div className={`mt-0.5 text-lg font-semibold ${sub ? 'text-slate-700' : tones[tone ?? 'default']}`}>
                {prefix}{value}
            </div>
            {note && <div className="mt-0.5">{note}</div>}
        </div>
    );
}

function SubCard({ icon: Icon, label, value }) {
    return (
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1">
                <Icon size={10} /> {label}
            </div>
            <div className="text-base font-semibold text-slate-800">{value}</div>
        </div>
    );
}
