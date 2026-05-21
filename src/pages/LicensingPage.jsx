import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { CreditCard, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchAllLicenses, fetchPlans, updateCompanyLicense,
    selectAllLicenses, selectAllLicensesMeta, selectPlans, selectLicensingLoading,
} from '../features/admin/adminLicensingSlice';
import LicensePlanBadge from '../components/admin/LicensePlanBadge';
import AdminFilterBar from '../components/admin/AdminFilterBar';

/**
 * Cross-tenant license dashboard. Summary cards by plan, a filterable
 * table, and inline plan-change controls for support.
 */

export default function AdminLicensing() {
    const dispatch  = useDispatch();
    const licenses  = useSelector(selectAllLicenses);
    const meta      = useSelector(selectAllLicensesMeta);
    const plans     = useSelector(selectPlans);
    const loading   = useSelector(selectLicensingLoading);

    const [filters, setFilters] = useState({});
    const [editingLicense, setEditingLicense] = useState(null);

    useEffect(() => {
        dispatch(fetchAllLicenses({ ...filters, per_page: 100 }));
        dispatch(fetchPlans());
    }, [dispatch, filters]);

    const summary = useMemo(() => {
        const byPlan = {};
        for (const l of licenses) {
            byPlan[l.plan] = (byPlan[l.plan] ?? 0) + 1;
        }
        const expiringSoon = licenses.filter((l) => {
            if (!l.expires_at) return false;
            const diff = new Date(l.expires_at).getTime() - Date.now();
            return diff > 0 && diff < 1000 * 60 * 60 * 24 * 14;
        });
        const overdue = licenses.filter((l) => ['past_due', 'expired'].includes(l.status));
        return { byPlan, expiringSoon: expiringSoon.length, overdue: overdue.length, total: licenses.length };
    }, [licenses]);

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy">Licensing</h1>
                <p className="text-sm text-slate-600">Plans, billing status, and expiry across every tenant.</p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat icon={CreditCard} label="Total licenses" value={summary.total} />
                <Stat icon={Clock}      label="Expiring (14d)" value={summary.expiringSoon}  tone={summary.expiringSoon ? 'warning' : 'default'} />
                <Stat icon={AlertTriangle} label="Past due / expired" value={summary.overdue} tone={summary.overdue ? 'critical' : 'default'} />
                <Stat icon={TrendingUp} label="Pro+ tenants" value={(summary.byPlan?.pro ?? 0) + (summary.byPlan?.enterprise ?? 0)} />
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {(plans?.plans ?? []).map((p) => (
                        <div key={p.key} className="flex flex-col items-center p-2 bg-slate-50 rounded">
                            <span className="text-xs uppercase tracking-wide text-slate-500">{p.key}</span>
                            <span className="text-lg font-semibold text-guardian-navy">{summary.byPlan?.[p.key] ?? 0}</span>
                            <span className="text-[10px] text-slate-400">
                                {p.seats || '∞'} seats · {p.domains || '∞'} domains
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <AdminFilterBar
                filters={[
                    { key: 'plan',   type: 'select', label: 'Plan',
                      options: (plans?.plans ?? []).map((p) => ({ value: p.key, label: p.key })) },
                    { key: 'status', type: 'select', label: 'Status',
                      options: (plans?.statuses ?? []).map((s) => ({ value: s, label: s })) },
                ]}
                value={filters}
                onChange={setFilters}
                onClear={() => setFilters({})}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Company</th>
                            <th className="px-3 py-2 text-left">Plan</th>
                            <th className="px-3 py-2 text-right">Seats</th>
                            <th className="px-3 py-2 text-right">Domains</th>
                            <th className="px-3 py-2 text-left">Expires</th>
                            <th className="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !licenses.length ? (
                            <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">Loading...</td></tr>
                        ) : !licenses.length ? (
                            <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">No licenses.</td></tr>
                        ) : licenses.map((l) => (
                            <tr key={l.id}>
                                <td className="px-3 py-2.5">
                                    <Link to={`/companies/${l.company_id}`} className="text-slate-900 hover:text-guardian-navy">
                                        <div className="font-medium">{l.company?.name ?? l.company_id}</div>
                                        <div className="text-xs text-slate-500">{l.company_id}</div>
                                    </Link>
                                </td>
                                <td className="px-3 py-2.5">
                                    <LicensePlanBadge plan={l.plan} status={l.status} expiresAt={l.expires_at} />
                                </td>
                                <td className="px-3 py-2.5 text-right text-slate-700">{l.seats_limit}</td>
                                <td className="px-3 py-2.5 text-right text-slate-700">{l.domains_limit}</td>
                                <td className="px-3 py-2.5 text-xs text-slate-600">
                                    {l.expires_at
                                        ? formatDistanceToNow(parseISO(l.expires_at), { addSuffix: true })
                                        : 'never'}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                    <button
                                        type="button"
                                        onClick={() => setEditingLicense(l)}
                                        className="px-2 py-1 text-xs text-guardian-navy hover:bg-guardian-navy/5 rounded"
                                    >
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingLicense && (
                <EditLicenseModal
                    license={editingLicense}
                    plans={plans}
                    onClose={() => setEditingLicense(null)}
                    onSave={async (payload) => {
                        await dispatch(updateCompanyLicense({
                            companyId: editingLicense.company_id,
                            payload,
                        }));
                        setEditingLicense(null);
                        dispatch(fetchAllLicenses({ ...filters, per_page: 100 }));
                    }}
                />
            )}
        </div>
    );
}

function Stat({ icon: Icon, label, value, tone = 'default' }) {
    const tones = {
        critical: 'text-red-600',
        warning:  'text-amber-700',
        default:  'text-guardian-navy',
    };
    return (
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Icon size={12} /> {label}
            </div>
            <div className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</div>
        </div>
    );
}

// ── Edit modal ───────────────────────────────────────────────────────────

function EditLicenseModal({ license, plans, onClose, onSave }) {
    const [plan,    setPlan]    = useState(license.plan);
    const [status,  setStatus]  = useState(license.status);
    const [seats,   setSeats]   = useState(license.seats_limit);
    const [domains, setDomains] = useState(license.domains_limit);
    const [scans,   setScans]   = useState(license.scans_per_month_limit);
    const [expires, setExpires] = useState(license.expires_at?.slice(0, 10) ?? '');
    const [busy,    setBusy]    = useState(false);

    // When the admin picks a new plan, pre-fill limits from defaults so
    // they don't have to type three numbers. They can still override.
    const applyPlanDefaults = (newPlan) => {
        setPlan(newPlan);
        const def = (plans?.plans ?? []).find((p) => p.key === newPlan);
        if (def) {
            setSeats(def.seats);
            setDomains(def.domains);
            setScans(def.scans_per_month);
        }
    };

    const save = async () => {
        setBusy(true);
        try {
            await onSave({
                plan,
                status,
                seats_limit:           Number(seats),
                domains_limit:         Number(domains),
                scans_per_month_limit: Number(scans),
                expires_at:            expires || null,
            });
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
                <div className="p-5 border-b border-slate-100">
                    <h3 className="text-base font-semibold text-slate-900">Edit license</h3>
                    <p className="text-xs text-slate-500 mt-1">{license.company?.name ?? license.company_id}</p>
                </div>
                <div className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Plan">
                            <select value={plan} onChange={(e) => applyPlanDefaults(e.target.value)} className="form-input">
                                {(plans?.plans ?? []).map((p) => (
                                    <option key={p.key} value={p.key}>{p.key}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Status">
                            <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-input">
                                {(plans?.statuses ?? []).map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <Field label="Seats">
                            <input type="number" min="0" value={seats} onChange={(e) => setSeats(e.target.value)} className="form-input" />
                        </Field>
                        <Field label="Domains">
                            <input type="number" min="0" value={domains} onChange={(e) => setDomains(e.target.value)} className="form-input" />
                        </Field>
                        <Field label="Scans/mo">
                            <input type="number" min="0" value={scans} onChange={(e) => setScans(e.target.value)} className="form-input" />
                        </Field>
                    </div>
                    <Field label="Expires">
                        <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="form-input" />
                    </Field>
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 rounded-b-lg">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700">Cancel</button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={busy}
                        className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 text-white rounded-md disabled:opacity-50"
                    >
                        {busy ? 'Saving...' : 'Save'}
                    </button>
                </div>
                <style>{`.form-input{width:100%;padding:.5rem .75rem;font-size:.875rem;border:1px solid #cbd5e1;border-radius:.375rem}`}</style>
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
