import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Building2, Pause, Play, Plus, Pencil } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchAdminCompanies, createAdminCompany, updateAdminCompany,
    suspendCompany, reinstateCompany,
    selectAdminCompanies, selectAdminCompaniesMeta, selectAdminCompaniesLoading,
    selectAdminCompanyWorking,
} from '../features/admin/adminCompaniesSlice';
import { fetchPlans, selectPlans } from '../features/admin/adminLicensingSlice';
import LicensePlanBadge from '../components/admin/LicensePlanBadge';
import AdminFilterBar from '../components/admin/AdminFilterBar';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';
import { COUNTRIES, codeToFlagEmoji } from '../utils/countries';

/**
 * Cross-tenant company list. The detail view lives at CompanyDetailPage
 * (route /companies/:id) and exposes Domains + Assets + Licensing tabs.
 */
export default function CompaniesPage() {
    const dispatch  = useDispatch();
    const companies = useSelector(selectAdminCompanies);
    const meta      = useSelector(selectAdminCompaniesMeta);
    const loading   = useSelector(selectAdminCompaniesLoading);
    const plans     = useSelector(selectPlans);

    const [filters, setFilters] = useState({});
    const [page,    setPage]    = useState(1);
    const [showCreate, setShowCreate] = useState(false);

    useEffect(() => {
        dispatch(fetchAdminCompanies({ ...filters, page, per_page: 25 }));
        dispatch(fetchPlans());
    }, [dispatch, filters, page]);

    const refresh = () => dispatch(fetchAdminCompanies({ ...filters, page, per_page: 25 }));

    return (
        <div className="p-6 space-y-4">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy">Companies</h1>
                    <p className="text-sm text-slate-600">All tenants on the platform.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-guardian-navy hover:bg-guardian-navy-800 text-white text-sm font-medium rounded-md"
                >
                    <Plus size={14} /> New Company
                </button>
            </header>

            <AdminFilterBar
                filters={[
                    { key: 'search',  type: 'text',   label: 'Search', placeholder: 'Name, domain, or ID...' },
                    { key: 'plan',    type: 'select', label: 'Plan',    options: (plans?.plans ?? []).map((p) => ({ value: p.key, label: p.key })) },
                    { key: 'status',  type: 'select', label: 'Status',  options: (plans?.statuses ?? []).map((s) => ({ value: s, label: s })) },
                    { key: 'country', type: 'select', label: 'Country', options: COUNTRIES.map((cc) => ({ value: cc.code, label: `${cc.name} (${cc.code})` })) },
                ]}
                value={filters}
                onChange={(v) => { setFilters(v); setPage(1); }}
                onClear={() => { setFilters({}); setPage(1); }}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Company</th>
                            <th className="px-3 py-2 text-left">Country</th>
                            <th className="px-3 py-2 text-left">License</th>
                            <th className="px-3 py-2 text-right">Users</th>
                            <th className="px-3 py-2 text-right">Domains</th>
                            <th className="px-3 py-2 text-left">Created</th>
                            <th className="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !companies.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">Loading...</td></tr>
                        ) : !companies.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">No companies found.</td></tr>
                        ) : companies.map((c) => <CompanyRow key={c.id} company={c} onChange={refresh} />)}
                    </tbody>
                </table>
                {meta && meta.last_page > 1 && <Pagination meta={meta} onChange={setPage} />}
            </div>

            <CreateCompanyModal
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onSubmit={async (payload) => {
                    await dispatch(createAdminCompany(payload));
                    setShowCreate(false);
                    refresh();
                }}
            />
        </div>
    );
}

function CompanyRow({ company: c, onChange }) {
    const dispatch = useDispatch();
    const working  = useSelector((s) => selectAdminCompanyWorking(s, c.id));
    const [confirm, setConfirm] = useState(null);
    const [editing, setEditing] = useState(false);

    // companies.status is the canonical suspension flag (license may be absent).
    const isSuspended = c.status === 'suspended' || c.license?.status === 'suspended';

    const doSuspend   = async (reason) => { await dispatch(suspendCompany({ companyId: c.id, reason })); setConfirm(null); onChange?.(); };
    const doReinstate = async ()      => { await dispatch(reinstateCompany(c.id));                    setConfirm(null); onChange?.(); };
    const doEditSave  = async (payload) => {
        await dispatch(updateAdminCompany({ companyId: c.id, payload }));
        setEditing(false);
        onChange?.();
    };

    return (
        <>
            <tr className={isSuspended ? 'bg-red-50/30' : ''}>
                <td className="px-3 py-2.5">
                    <Link to={`/companies/${c.id}`} className="block group">
                        <div className="font-medium text-slate-900 group-hover:text-guardian-navy">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.domain || c.id}</div>
                    </Link>
                </td>
                <td className="px-3 py-2.5 text-sm text-slate-700">
                    {c.country ? (
                        <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden className="text-base leading-none">{codeToFlagEmoji(c.country)}</span>
                            <span className="text-xs">{c.country}</span>
                        </span>
                    ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-3 py-2.5">
                    <LicensePlanBadge plan={c.license?.plan} status={c.license?.status} expiresAt={c.license?.expires_at} />
                </td>
                <td className="px-3 py-2.5 text-right text-slate-700">{c.user_count ?? 0}</td>
                <td className="px-3 py-2.5 text-right text-slate-700">{c.domains_scanned ?? 0} / {c.domains_total ?? 0}</td>
                <td className="px-3 py-2.5 text-xs text-slate-500">
                    {c.created_at ? formatDistanceToNow(parseISO(c.created_at), { addSuffix: true }) : '—'}
                </td>
                <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                        <button type="button" title="Edit company"
                            onClick={() => setEditing(true)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600">
                            <Pencil size={14} />
                        </button>
                        {isSuspended ? (
                            <button type="button" title="Reinstate" disabled={working === 'reinstate'}
                                onClick={() => setConfirm({ type: 'reinstate' })}
                                className="p-1.5 rounded hover:bg-slate-100 text-emerald-600">
                                <Play size={14} />
                            </button>
                        ) : (
                            <button type="button" title="Suspend" disabled={working === 'suspend'}
                                onClick={() => setConfirm({ type: 'suspend' })}
                                className="p-1.5 rounded hover:bg-slate-100 text-red-600">
                                <Pause size={14} />
                            </button>
                        )}
                    </div>
                </td>
            </tr>
            <AdminConfirmModal open={confirm?.type === 'suspend'} title={`Suspend ${c.name}?`}
                description="All users on this tenant will be locked out immediately."
                confirmLabel="Suspend" variant="destructive" requireReason
                onCancel={() => setConfirm(null)} onConfirm={doSuspend} />
            <AdminConfirmModal open={confirm?.type === 'reinstate'} title={`Reinstate ${c.name}?`}
                confirmLabel="Reinstate" onCancel={() => setConfirm(null)} onConfirm={doReinstate} />
            {editing && <EditCompanyModal company={c} onClose={() => setEditing(false)} onSubmit={doEditSave} />}
        </>
    );
}

function EditCompanyModal({ company, onClose, onSubmit }) {
    const [name,     setName]     = useState(company.name || '');
    const [industry, setIndustry] = useState(company.industry || '');
    const [country,  setCountry]  = useState(company.country || '');
    const [busy,     setBusy]     = useState(false);

    const send = async () => {
        setBusy(true);
        try {
            await onSubmit({
                name:     name     || undefined,
                industry: industry || undefined,
                country:  country  || undefined,
            });
        } finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
                <div className="p-5 border-b border-slate-100">
                    <h3 className="flex items-center gap-2 text-base font-semibold">
                        <Pencil size={16} className="text-guardian-navy" /> Edit company
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">{company.id}</p>
                </div>
                <div className="p-5 space-y-3">
                    <FieldRow label="Name *"><input value={name} onChange={(e) => setName(e.target.value)} className="form-input" /></FieldRow>
                    <FieldRow label="Industry"><input value={industry} onChange={(e) => setIndustry(e.target.value)} className="form-input" /></FieldRow>
                    <FieldRow label="Country">
                        <select value={country} onChange={(e) => setCountry(e.target.value)} className="form-input">
                            <option value="">— Select —</option>
                            {COUNTRIES.map((cc) => (
                                <option key={cc.code} value={cc.code}>{cc.name} ({cc.code})</option>
                            ))}
                        </select>
                    </FieldRow>
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 rounded-b-lg">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700">Cancel</button>
                    <button type="button" onClick={send} disabled={!name || busy}
                        className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50 text-white rounded-md">
                        {busy ? 'Saving...' : 'Save'}
                    </button>
                </div>
                <style>{`.form-input{width:100%;padding:.5rem .75rem;font-size:.875rem;border:1px solid #cbd5e1;border-radius:.375rem}`}</style>
            </div>
        </div>
    );
}

function Pagination({ meta, onChange }) {
    return (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-sm">
            <div className="text-slate-600">Page {meta.current_page} of {meta.last_page} · {meta.total} total</div>
            <div className="flex gap-1">
                <button type="button" disabled={meta.current_page <= 1}
                    onClick={() => onChange(meta.current_page - 1)}
                    className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40">Previous</button>
                <button type="button" disabled={meta.current_page >= meta.last_page}
                    onClick={() => onChange(meta.current_page + 1)}
                    className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40">Next</button>
            </div>
        </div>
    );
}

function CreateCompanyModal({ open, onClose, onSubmit }) {
    const [name, setName] = useState('');
    const [domain, setDomain] = useState('');
    const [industry, setIndustry] = useState('');
    const [country, setCountry] = useState('');
    const [ownerEmail, setOwnerEmail] = useState('');
    const [ownerName,  setOwnerName]  = useState('');
    const [busy, setBusy] = useState(false);

    if (!open) return null;

    const send = async () => {
        setBusy(true);
        try {
            await onSubmit({
                name,
                domain:      domain      || undefined,
                industry:    industry    || undefined,
                country:     country     || undefined,
                owner_email: ownerEmail  || undefined,
                owner_name:  ownerName   || undefined,
            });
            setName(''); setDomain(''); setIndustry(''); setCountry('');
            setOwnerEmail(''); setOwnerName('');
        }
        finally { setBusy(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
                <div className="p-5 border-b border-slate-100">
                    <h3 className="flex items-center gap-2 text-base font-semibold">
                        <Building2 size={16} className="text-guardian-navy" /> Create Company
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">A 14-day trial license is auto-provisioned.</p>
                </div>
                <div className="p-5 space-y-3">
                    <FieldRow label="Name *"><input value={name} onChange={(e) => setName(e.target.value)} className="form-input" /></FieldRow>
                    <FieldRow label="Primary domain"><input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className="form-input" /></FieldRow>
                    <FieldRow label="Industry"><input value={industry} onChange={(e) => setIndustry(e.target.value)} className="form-input" /></FieldRow>
                    <FieldRow label="Country">
                        <select value={country} onChange={(e) => setCountry(e.target.value)} className="form-input">
                            <option value="">— Select —</option>
                            {COUNTRIES.map((c) => (
                                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                            ))}
                        </select>
                    </FieldRow>
                    <FieldRow label="Owner email">
                        <input
                            type="email"
                            value={ownerEmail}
                            onChange={(e) => setOwnerEmail(e.target.value)}
                            placeholder="owner@company.com (optional)"
                            className="form-input"
                        />
                    </FieldRow>
                    {ownerEmail && (
                        <FieldRow label="Owner name">
                            <input
                                type="text"
                                value={ownerName}
                                onChange={(e) => setOwnerName(e.target.value)}
                                placeholder="(optional)"
                                className="form-input"
                            />
                        </FieldRow>
                    )}
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 rounded-b-lg">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700">Cancel</button>
                    <button type="button" onClick={send} disabled={!name || busy}
                        className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50 text-white rounded-md">
                        {busy ? 'Creating...' : 'Create'}
                    </button>
                </div>
                <style>{`.form-input{width:100%;padding:.5rem .75rem;font-size:.875rem;border:1px solid #cbd5e1;border-radius:.375rem}`}</style>
            </div>
        </div>
    );
}

function FieldRow({ label, children }) {
    return <div><label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>{children}</div>;
}
