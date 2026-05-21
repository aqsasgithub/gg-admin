import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Pencil, Trash2, Tag, Box, Loader2, CheckCircle2 } from 'lucide-react';
import {
    fetchPricingPlans, createPricingPlan, updatePricingPlan, deletePricingPlan,
    fetchModulePricing, updateModulePricing,
    selectPricingPlans, selectModulePricing, selectPricingLoading,
} from '../features/admin/adminPricingSlice';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';

const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;
const TABS = ['plans', 'modules'];

export default function PricingPlansPage() {
    const dispatch = useDispatch();
    const plans   = useSelector(selectPricingPlans);
    const modules = useSelector(selectModulePricing);
    const loading = useSelector(selectPricingLoading);

    const [tab,     setTab]     = useState('plans');
    const [editor,  setEditor]  = useState(null);
    const [confirm, setConfirm] = useState(null);

    useEffect(() => { dispatch(fetchPricingPlans()); }, [dispatch]);
    useEffect(() => { dispatch(fetchModulePricing()); }, [dispatch]);

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy">Pricing</h1>
                <p className="text-sm text-slate-600">
                    Tier definitions and per-module rates. Plans are assigned to tenants on the Pricing tab of each company.
                </p>
            </header>

            <div className="border-b border-slate-200 flex gap-1">
                {TABS.map((t) => (
                    <button key={t} type="button" onClick={() => setTab(t)}
                        className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px capitalize ${
                            tab === t ? 'border-guardian-navy text-guardian-navy' : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}>
                        {t}
                    </button>
                ))}
            </div>

            {tab === 'plans' && (
                <PlansTab plans={plans} loading={loading}
                    onCreate={() => setEditor({ kind: 'plan-new' })}
                    onEdit={(p) => setEditor({ kind: 'plan-edit', plan: p })}
                    onDelete={(p) => setConfirm({ kind: 'plan-delete', plan: p })} />
            )}
            {tab === 'modules' && (
                <ModulesTab modules={modules}
                    onEdit={(m) => setEditor({ kind: 'module-edit', module: m })} />
            )}

            {editor?.kind?.startsWith('plan') && (
                <PlanEditor initial={editor.kind === 'plan-edit' ? editor.plan : null}
                    onClose={() => setEditor(null)}
                    onSave={async (payload) => {
                        if (editor.kind === 'plan-edit') {
                            await dispatch(updatePricingPlan({ id: editor.plan.id, payload }));
                        } else {
                            await dispatch(createPricingPlan(payload));
                        }
                        setEditor(null);
                        dispatch(fetchPricingPlans());
                    }} />
            )}
            {editor?.kind === 'module-edit' && (
                <ModuleEditor initial={editor.module}
                    onClose={() => setEditor(null)}
                    onSave={async (payload) => {
                        await dispatch(updateModulePricing({ id: editor.module.id, payload }));
                        setEditor(null);
                        dispatch(fetchModulePricing());
                    }} />
            )}

            <AdminConfirmModal open={confirm?.kind === 'plan-delete'}
                title={`Delete plan "${confirm?.plan?.name}"?`}
                description="If any tenants are on this plan, the deletion will be refused."
                confirmLabel="Delete" variant="destructive"
                onCancel={() => setConfirm(null)}
                onConfirm={async () => {
                    await dispatch(deletePricingPlan(confirm.plan.id));
                    setConfirm(null);
                    dispatch(fetchPricingPlans());
                }} />
        </div>
    );
}

function PlansTab({ plans, loading, onCreate, onEdit, onDelete }) {
    return (
        <>
            <div className="flex justify-end">
                <button type="button" onClick={onCreate}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-guardian-navy hover:bg-guardian-navy-800 text-white text-sm font-medium rounded-md">
                    <Plus size={14} /> New plan
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {loading && !plans.length ? (
                    <div className="col-span-full text-center py-8 text-slate-500">
                        <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                    </div>
                ) : !plans.length ? (
                    <div className="col-span-full text-center py-8 text-slate-500">
                        No plans defined yet. Create at least one before assigning to tenants.
                    </div>
                ) : plans.map((p) => (
                    <div key={p.id} className={`p-4 bg-white border rounded-lg ${p.is_default ? 'border-guardian-navy ring-1 ring-guardian-navy/30' : 'border-slate-200'}`}>
                        <div className="flex items-start justify-between mb-2">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <Tag size={13} className="text-slate-400" />
                                    <h3 className="font-semibold text-slate-900">{p.name}</h3>
                                    {p.is_default && (
                                        <span className="px-1.5 py-0 text-[10px] font-medium bg-guardian-navy text-white rounded uppercase">default</span>
                                    )}
                                    {!p.is_active && (
                                        <span className="px-1.5 py-0 text-[10px] font-medium bg-slate-200 text-slate-700 rounded uppercase">inactive</span>
                                    )}
                                </div>
                                <code className="text-[10px] text-slate-500">{p.key}</code>
                            </div>
                            <div className="text-right">
                                <div className="text-xl font-semibold text-guardian-navy">{fmt(p.base_monthly_cents)}</div>
                                <div className="text-[10px] uppercase tracking-wide text-slate-500">per month</div>
                            </div>
                        </div>
                        {p.description && <p className="text-xs text-slate-600 mb-2">{p.description}</p>}
                        <dl className="space-y-1 text-xs text-slate-700 mb-3">
                            <DLine label="Included domains"
                                value={`${p.included_domains}, then ${fmt(p.per_domain_cents)}/each`} />
                            <DLine label="Included assets"
                                value={`${p.included_assets}, then ${fmt(p.per_asset_cents)}/each`} />
                            {p.included_modules?.length > 0 && (
                                <DLine label="Included modules" value={p.included_modules.join(', ')} />
                            )}
                        </dl>
                        <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => onEdit(p)}
                                className="p-1.5 rounded hover:bg-slate-100 text-slate-600">
                                <Pencil size={13} />
                            </button>
                            <button type="button" onClick={() => onDelete(p)}
                                className="p-1.5 rounded hover:bg-red-50 text-red-600">
                                <Trash2 size={13} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}

function ModulesTab({ modules, onEdit }) {
    return (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                        <th className="px-3 py-2 text-left">Module</th>
                        <th className="px-3 py-2 text-right">Monthly</th>
                        <th className="px-3 py-2 text-right">Per unit</th>
                        <th className="px-3 py-2 text-left">Unit</th>
                        <th className="px-3 py-2 text-right">Included</th>
                        <th className="px-3 py-2 text-right">Provider cost</th>
                        <th className="px-3 py-2 text-center">Active</th>
                        <th className="px-3 py-2"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {!modules.length ? (
                        <tr><td colSpan="8" className="px-3 py-8 text-center text-slate-500">
                            No module pricing defined. Seed your modules to start.
                        </td></tr>
                    ) : modules.map((m) => (
                        <tr key={m.id}>
                            <td className="px-3 py-2.5">
                                <div className="font-medium text-slate-900 flex items-center gap-1.5">
                                    <Box size={12} className="text-slate-400" /> {m.module_name}
                                </div>
                                <code className="text-[10px] text-slate-500">{m.module_key}</code>
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono">{fmt(m.monthly_cents)}</td>
                            <td className="px-3 py-2.5 text-right font-mono">{fmt(m.per_unit_cents)}</td>
                            <td className="px-3 py-2.5 text-xs text-slate-600">{m.unit_type ?? '—'}</td>
                            <td className="px-3 py-2.5 text-right text-xs">{m.included_units}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-xs text-slate-500">{fmt(m.provider_cents_per_unit)}</td>
                            <td className="px-3 py-2.5 text-center">
                                {m.is_active
                                    ? <CheckCircle2 size={14} className="inline text-emerald-600" />
                                    : <span className="text-xs text-slate-400">off</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                                <button type="button" onClick={() => onEdit(m)}
                                    className="p-1.5 rounded hover:bg-slate-100 text-slate-600">
                                    <Pencil size={13} />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function DLine({ label, value }) {
    return (
        <div className="flex justify-between gap-2">
            <dt className="text-slate-500">{label}</dt>
            <dd className="text-right">{value}</dd>
        </div>
    );
}

function PlanEditor({ initial, onClose, onSave }) {
    const isEdit = !!initial;
    const [form, setForm] = useState(initial ?? {
        key: '', name: '', description: '',
        base_monthly_cents: 0, included_domains: 0, included_assets: 0,
        per_domain_cents: 0, per_asset_cents: 0,
        included_modules: [], is_active: true, is_default: false,
    });
    const [busy, setBusy] = useState(false);
    const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
    const setN = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value === '' ? 0 : Number(e.target.value) }));
    const setS = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const send = async () => {
        setBusy(true);
        try { await onSave(form); }
        finally { setBusy(false); }
    };

    return (
        <Modal title={isEdit ? `Edit ${initial.name}` : 'New pricing plan'} onClose={onClose}>
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Key (immutable)">
                        <input value={form.key} onChange={setS('key')} disabled={isEdit}
                            placeholder="starter | pro | enterprise" className="form-input font-mono disabled:bg-slate-50" />
                    </Field>
                    <Field label="Name">
                        <input value={form.name} onChange={setS('name')} className="form-input" />
                    </Field>
                </div>
                <Field label="Description">
                    <textarea value={form.description ?? ''} onChange={setS('description')} rows={2} className="form-input" />
                </Field>
                <Field label="Base monthly (cents)">
                    <input type="number" min="0" value={form.base_monthly_cents} onChange={setN('base_monthly_cents')} className="form-input" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Included domains">
                        <input type="number" min="0" value={form.included_domains} onChange={setN('included_domains')} className="form-input" />
                    </Field>
                    <Field label="Cents per overage domain">
                        <input type="number" min="0" value={form.per_domain_cents} onChange={setN('per_domain_cents')} className="form-input" />
                    </Field>
                    <Field label="Included assets">
                        <input type="number" min="0" value={form.included_assets} onChange={setN('included_assets')} className="form-input" />
                    </Field>
                    <Field label="Cents per overage asset">
                        <input type="number" min="0" value={form.per_asset_cents} onChange={setN('per_asset_cents')} className="form-input" />
                    </Field>
                </div>
                <Field label="Included modules (comma-separated keys)">
                    <input value={(form.included_modules ?? []).join(', ')}
                        onChange={(e) => set('included_modules')(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                        placeholder="threats, dark_web, asset_disc" className="form-input font-mono" />
                </Field>
                <div className="flex gap-4">
                    <label className="inline-flex items-center gap-1.5 text-sm">
                        <input type="checkbox" checked={!!form.is_active} onChange={(e) => set('is_active')(e.target.checked)} />
                        Active
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-sm">
                        <input type="checkbox" checked={!!form.is_default} onChange={(e) => set('is_default')(e.target.checked)} />
                        Default plan for new tenants
                    </label>
                </div>
            </div>
            <ModalFooter onClose={onClose} onSave={send} busy={busy}
                disabled={!form.name || !form.key} />
            <ModalStyles />
        </Modal>
    );
}

function ModuleEditor({ initial, onClose, onSave }) {
    const [form, setForm] = useState({
        module_name: initial.module_name,
        monthly_cents: initial.monthly_cents,
        per_unit_cents: initial.per_unit_cents,
        unit_type: initial.unit_type ?? '',
        included_units: initial.included_units,
        provider_cents_per_unit: initial.provider_cents_per_unit,
        is_active: !!initial.is_active,
    });
    const [busy, setBusy] = useState(false);
    const setN = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value === '' ? 0 : Number(e.target.value) }));
    const setS = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value || null }));

    const send = async () => {
        setBusy(true);
        try { await onSave(form); }
        finally { setBusy(false); }
    };

    return (
        <Modal title={`Edit module: ${initial.module_key}`} onClose={onClose}>
            <div className="space-y-3">
                <Field label="Display name">
                    <input value={form.module_name} onChange={(e) => setForm({ ...form, module_name: e.target.value })}
                        className="form-input" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Monthly (cents)">
                        <input type="number" min="0" value={form.monthly_cents} onChange={setN('monthly_cents')} className="form-input" />
                    </Field>
                    <Field label="Provider cost / unit (cents)">
                        <input type="number" min="0" value={form.provider_cents_per_unit}
                            onChange={setN('provider_cents_per_unit')} className="form-input" />
                    </Field>
                    <Field label="Per-unit price (cents)">
                        <input type="number" min="0" value={form.per_unit_cents} onChange={setN('per_unit_cents')} className="form-input" />
                    </Field>
                    <Field label="Unit type">
                        <select value={form.unit_type ?? ''} onChange={setS('unit_type')} className="form-input">
                            <option value="">(none)</option>
                            <option value="scan">scan</option>
                            <option value="asset">asset</option>
                            <option value="api_call">api_call</option>
                            <option value="gb_stored">gb_stored</option>
                        </select>
                    </Field>
                </div>
                <Field label="Included units / month">
                    <input type="number" min="0" value={form.included_units} onChange={setN('included_units')} className="form-input" />
                </Field>
                <label className="inline-flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                    Active
                </label>
            </div>
            <ModalFooter onClose={onClose} onSave={send} busy={busy} />
            <ModalStyles />
        </Modal>
    );
}

function Modal({ title, children, onClose }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-lg mx-4 bg-white rounded-lg shadow-xl max-h-[85vh] overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold">{title}</h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="px-5 py-4 overflow-y-auto">{children}</div>
            </div>
        </div>
    );
}

function ModalFooter({ onClose, onSave, busy, disabled }) {
    return (
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 -mx-5 -mb-4 mt-4 bg-slate-50">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700 hover:text-slate-900">
                Cancel
            </button>
            <button type="button" onClick={onSave} disabled={busy || disabled}
                className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50 text-white rounded-md">
                {busy ? 'Saving…' : 'Save'}
            </button>
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

function ModalStyles() {
    return <style>{`.form-input{width:100%;padding:.5rem .75rem;font-size:.875rem;border:1px solid #cbd5e1;border-radius:.375rem}`}</style>;
}
