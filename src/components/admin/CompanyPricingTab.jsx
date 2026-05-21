import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Tag, Pencil, Loader2, History, AlertTriangle, CheckCircle2,
    Calculator,
} from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import {
    fetchPricingPlans, fetchCompanyPricing, assignCompanyPricing, previewCompanyCost,
    selectPricingPlans, selectCompanyPricing, selectCostPreview,
} from '../../features/admin/adminPricingSlice';

/**
 * Per-tenant pricing tab. Three sections:
 *
 *   Current plan      — what's in effect now (with effective settings
 *                       merged from plan + custom_overrides)
 *   Edit & preview    — pick a new plan, set overrides, see the
 *                       projected monthly cost before saving
 *   History           — past plan assignments for this tenant
 */

const fmt = (cents) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const PCT = (n) => `${n}%`;

export default function CompanyPricingTab({ company }) {
    const dispatch = useDispatch();
    const plans   = useSelector(selectPricingPlans);
    const detail  = useSelector((s) => selectCompanyPricing(s, company.id));
    const preview = useSelector((s) => selectCostPreview(s, company.id));

    const [editing, setEditing] = useState(false);

    useEffect(() => { dispatch(fetchPricingPlans()); }, [dispatch]);
    useEffect(() => { dispatch(fetchCompanyPricing(company.id)); }, [dispatch, company.id]);
    useEffect(() => { dispatch(previewCompanyCost({ companyId: company.id })); }, [dispatch, company.id]);

    if (!detail) {
        return (
            <div className="text-center py-8 text-slate-500">
                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading pricing…
            </div>
        );
    }

    const current = detail.current;
    const settings = detail.effective_settings;

    return (
        <div className="space-y-4">
            <header className="flex items-start justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <Tag size={16} /> Pricing
                    </h2>
                    <p className="text-sm text-slate-500">
                        Plan assignment, custom overrides, and projected cost for this tenant.
                    </p>
                </div>
                {!editing && (
                    <button type="button" onClick={() => setEditing(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-guardian-navy hover:bg-guardian-navy-800 text-white text-sm font-medium rounded-md">
                        <Pencil size={14} /> Edit pricing
                    </button>
                )}
            </header>

            {/* Current plan */}
            {!current ? (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-sm text-amber-900 flex items-start gap-2">
                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                    <div>
                        <strong>No plan assigned.</strong> This tenant is being billed at the
                        platform default. Click "Edit pricing" to assign a plan.
                    </div>
                </div>
            ) : (
                <CurrentPlanCard current={current} settings={settings} preview={preview} />
            )}

            {/* Editor */}
            {editing && (
                <EditorPanel company={company} plans={plans} initial={current} preview={preview}
                    onPreview={(payload) => dispatch(previewCompanyCost({ companyId: company.id, payload }))}
                    onCancel={() => setEditing(false)}
                    onSave={async (payload) => {
                        await dispatch(assignCompanyPricing({ companyId: company.id, payload }));
                        setEditing(false);
                        dispatch(fetchCompanyPricing(company.id));
                        dispatch(previewCompanyCost({ companyId: company.id }));
                    }} />
            )}

            {/* History */}
            {detail.history?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200 flex items-center gap-1.5">
                        <History size={11} /> Plan history
                    </div>
                    <table className="min-w-full text-sm">
                        <thead className="text-xs uppercase tracking-wide text-slate-500 bg-slate-50/50">
                            <tr>
                                <th className="px-3 py-1.5 text-left">Plan</th>
                                <th className="px-3 py-1.5 text-left">From</th>
                                <th className="px-3 py-1.5 text-left">To</th>
                                <th className="px-3 py-1.5 text-left">Discount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {detail.history.map((h) => (
                                <tr key={h.id}>
                                    <td className="px-3 py-1.5">
                                        <span className="font-medium">{h.plan?.name ?? '(deleted plan)'}</span>{' '}
                                        <code className="text-[10px] text-slate-500">{h.plan?.key}</code>
                                    </td>
                                    <td className="px-3 py-1.5 text-xs text-slate-600">
                                        {format(parseISO(h.effective_from), 'MMM d, yyyy')}
                                    </td>
                                    <td className="px-3 py-1.5 text-xs text-slate-600">
                                        {h.effective_to ? format(parseISO(h.effective_to), 'MMM d, yyyy') : '—'}
                                    </td>
                                    <td className="px-3 py-1.5 text-xs">
                                        {h.discount_percentage > 0
                                            ? <span className="text-emerald-600">−{PCT(h.discount_percentage)}</span>
                                            : <span className="text-slate-400">—</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function CurrentPlanCard({ current, settings, preview }) {
    return (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-guardian-navy/5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-guardian-navy" />
                    <span className="font-semibold text-guardian-navy">
                        {current.plan?.name ?? '(plan removed)'}
                    </span>
                    {current.plan?.key && <code className="text-[10px] text-slate-500">{current.plan.key}</code>}
                </div>
                <div className="text-xs text-slate-500">
                    in effect since {format(parseISO(current.effective_from), 'MMM d, yyyy')}
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 p-4 text-sm">
                <KV label="Base monthly"        value={fmt(settings.base_monthly_cents)} />
                <KV label="Included domains"    value={settings.included_domains} />
                <KV label="Included assets"     value={settings.included_assets} />
                <KV label="Per-domain overage"  value={`${fmt(settings.per_domain_cents)}/each`} />
                <KV label="Per-asset overage"   value={`${fmt(settings.per_asset_cents)}/each`} />
                <KV label="Included modules"
                    value={(settings.included_modules ?? []).length > 0
                        ? settings.included_modules.join(', ')
                        : 'none'} />
                {current.discount_percentage > 0 && (
                    <KV label="Discount"
                        value={<>
                            <span className="text-emerald-600">−{PCT(current.discount_percentage)}</span>
                            {current.discount_reason && (
                                <span className="text-xs text-slate-500 ml-2">({current.discount_reason})</span>
                            )}
                        </>} />
                )}
                {current.contracted_minimum_cents > 0 && (
                    <KV label="Minimum committed" value={`${fmt(current.contracted_minimum_cents)}/mo`} />
                )}
            </div>
            {preview && (
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-slate-600">
                        <Calculator size={12} /> Projected this month
                    </span>
                    <span className="font-mono font-semibold text-guardian-navy">{fmt(preview.total_billed_cents)}</span>
                </div>
            )}
        </div>
    );
}

function EditorPanel({ company, plans, initial, preview, onPreview, onCancel, onSave }) {
    const initialPlanId = initial?.pricing_plan_id ?? plans.find((p) => p.is_default)?.id ?? plans[0]?.id ?? '';
    const initialOverrides = initial?.custom_overrides ?? {};

    const [planId,         setPlanId]         = useState(initialPlanId);
    const [overrides,      setOverrides]      = useState(initialOverrides);
    const [discount,       setDiscount]       = useState(initial?.discount_percentage ?? 0);
    const [discountReason, setDiscountReason] = useState(initial?.discount_reason ?? '');
    const [minimumCents,   setMinimumCents]   = useState(initial?.contracted_minimum_cents ?? 0);
    const [busy,           setBusy]           = useState(false);

    const selectedPlan = plans.find((p) => p.id === planId);

    const payload = {
        pricing_plan_id: planId,
        custom_overrides: Object.keys(overrides).length ? overrides : null,
        discount_percentage: Number(discount) || 0,
        discount_reason: discountReason || null,
        contracted_minimum_cents: Number(minimumCents) || 0,
    };

    // Debounced preview when payload changes
    const triggerPreview = useCallback(() => {
        if (planId) onPreview(payload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planId, overrides, discount, minimumCents]);

    useEffect(() => {
        const t = setTimeout(triggerPreview, 400);
        return () => clearTimeout(t);
    }, [triggerPreview]);

    const setOverride = (key, value) => {
        setOverrides((o) => {
            const next = { ...o };
            if (value === '' || value === null || Number.isNaN(Number(value))) delete next[key];
            else next[key] = Number(value);
            return next;
        });
    };
    const setModulesOverride = (csvOrNull) => {
        if (!csvOrNull) {
            setOverrides((o) => { const n = { ...o }; delete n.included_modules; return n; });
            return;
        }
        const arr = csvOrNull.split(',').map((s) => s.trim()).filter(Boolean);
        setOverrides((o) => ({ ...o, included_modules: arr }));
    };

    const send = async () => {
        if (!planId) return;
        setBusy(true);
        try { await onSave(payload); }
        finally { setBusy(false); }
    };

    return (
        <div className="bg-white border-2 border-guardian-navy/20 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-guardian-navy/5 border-b border-slate-200">
                <h3 className="font-semibold text-guardian-navy">Edit pricing for {company.name}</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                    Saving creates a new pricing row effective today. The current row is closed out.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                {/* Left: form */}
                <div className="space-y-3">
                    <Field label="Pricing plan">
                        <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="form-input">
                            <option value="">— select a plan —</option>
                            {plans.filter((p) => p.is_active).map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({fmt(p.base_monthly_cents)}/mo)
                                </option>
                            ))}
                        </select>
                        {selectedPlan && (
                            <p className="text-xs text-slate-500 mt-1">
                                Base {fmt(selectedPlan.base_monthly_cents)}/mo ·{' '}
                                {selectedPlan.included_domains} domains · {selectedPlan.included_assets} assets
                            </p>
                        )}
                    </Field>

                    <details>
                        <summary className="text-sm font-medium text-slate-700 cursor-pointer">
                            Custom overrides (advanced)
                        </summary>
                        <div className="mt-3 space-y-3 pl-2 border-l-2 border-slate-200">
                            <p className="text-xs text-slate-500">
                                Leave blank to inherit the plan's value. Any value set here applies only to this tenant.
                            </p>
                            <OverrideField label="Base monthly (cents)" planValue={selectedPlan?.base_monthly_cents}
                                value={overrides.base_monthly_cents}
                                onChange={(v) => setOverride('base_monthly_cents', v)} />
                            <OverrideField label="Included domains" planValue={selectedPlan?.included_domains}
                                value={overrides.included_domains}
                                onChange={(v) => setOverride('included_domains', v)} />
                            <OverrideField label="Per-domain overage (cents)" planValue={selectedPlan?.per_domain_cents}
                                value={overrides.per_domain_cents}
                                onChange={(v) => setOverride('per_domain_cents', v)} />
                            <OverrideField label="Included assets" planValue={selectedPlan?.included_assets}
                                value={overrides.included_assets}
                                onChange={(v) => setOverride('included_assets', v)} />
                            <OverrideField label="Per-asset overage (cents)" planValue={selectedPlan?.per_asset_cents}
                                value={overrides.per_asset_cents}
                                onChange={(v) => setOverride('per_asset_cents', v)} />
                            <Field label="Included modules (comma-separated, overrides plan)">
                                <input className="form-input font-mono text-xs"
                                    placeholder={(selectedPlan?.included_modules ?? []).join(', ') || '(none in plan)'}
                                    value={overrides.included_modules?.join(', ') ?? ''}
                                    onChange={(e) => setModulesOverride(e.target.value)} />
                            </Field>
                        </div>
                    </details>

                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Discount (%)">
                            <input type="number" min="0" max="100" value={discount}
                                onChange={(e) => setDiscount(e.target.value)} className="form-input" />
                        </Field>
                        <Field label="Minimum committed (cents)">
                            <input type="number" min="0" value={minimumCents}
                                onChange={(e) => setMinimumCents(e.target.value)} className="form-input" />
                        </Field>
                    </div>
                    {Number(discount) > 0 && (
                        <Field label="Discount reason (audit)">
                            <input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)}
                                placeholder="Annual prepay · 2-yr contract · launch discount"
                                className="form-input" />
                        </Field>
                    )}
                </div>

                {/* Right: live preview */}
                <div>
                    <h4 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-1.5">
                        <Calculator size={14} /> Cost preview (this month)
                    </h4>
                    {!preview ? (
                        <div className="text-sm text-slate-500 italic">Adjust settings to see preview…</div>
                    ) : (
                        <PreviewPanel preview={preview} />
                    )}
                </div>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                <button type="button" onClick={onCancel}
                    className="px-3 py-1.5 text-sm text-slate-700 hover:text-slate-900">Cancel</button>
                <button type="button" onClick={send} disabled={busy || !planId}
                    className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50 text-white rounded-md">
                    {busy ? 'Saving…' : 'Save pricing'}
                </button>
            </div>
            <style>{`.form-input{width:100%;padding:.5rem .75rem;font-size:.875rem;border:1px solid #cbd5e1;border-radius:.375rem;background:white}`}</style>
        </div>
    );
}

function PreviewPanel({ preview }) {
    return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
            <table className="min-w-full text-xs">
                <tbody className="divide-y divide-slate-200">
                    {Object.entries(preview.breakdown).map(([key, line]) => (
                        <tr key={key}>
                            <td className="px-3 py-1.5 text-slate-700">{line.label}</td>
                            <td className="px-3 py-1.5 text-right font-mono">{fmt(line.cents)}</td>
                        </tr>
                    ))}
                    <tr className="bg-white font-semibold">
                        <td className="px-3 py-1.5">Subtotal</td>
                        <td className="px-3 py-1.5 text-right font-mono">{fmt(preview.subtotal_cents)}</td>
                    </tr>
                    {preview.discount_cents > 0 && (
                        <tr>
                            <td className="px-3 py-1.5">Discount</td>
                            <td className="px-3 py-1.5 text-right font-mono text-emerald-600">−{fmt(preview.discount_cents)}</td>
                        </tr>
                    )}
                    <tr className="bg-guardian-navy/5 font-semibold">
                        <td className="px-3 py-2 text-guardian-navy">Total billed</td>
                        <td className="px-3 py-2 text-right font-mono text-guardian-navy">{fmt(preview.total_billed_cents)}</td>
                    </tr>
                    <tr className="text-slate-600">
                        <td className="px-3 py-1.5">Provider cost</td>
                        <td className="px-3 py-1.5 text-right font-mono">{fmt(preview.total_provider_cents)}</td>
                    </tr>
                    <tr className={preview.total_margin_cents < 0 ? 'text-red-600 font-semibold' : 'text-emerald-700 font-semibold'}>
                        <td className="px-3 py-1.5">Margin</td>
                        <td className="px-3 py-1.5 text-right font-mono">
                            {preview.total_margin_cents < 0 ? '−' : ''}{fmt(Math.abs(preview.total_margin_cents))}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

function OverrideField({ label, planValue, value, onChange }) {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
            <div className="flex items-center gap-2">
                <input type="number" min="0" value={value ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={planValue !== undefined ? `${planValue} (plan)` : ''}
                    className="form-input flex-1" />
                {value !== undefined && (
                    <button type="button" onClick={() => onChange('')}
                        className="px-2 py-1 text-xs text-slate-500 hover:text-slate-900">reset</button>
                )}
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
            {children}
        </div>
    );
}

function KV({ label, value }) {
    return (
        <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className="font-medium text-slate-900">{value}</div>
        </div>
    );
}
