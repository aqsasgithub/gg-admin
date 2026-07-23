import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
    ArrowLeft, Users, Globe, AlertTriangle, Calendar, Loader2,
    Wifi, CreditCard, Activity as ActivityIcon, LayoutDashboard,
    Plus, Upload, Trash2, ToggleLeft, ToggleRight, Pause, Play,
    // Patch-6 icons for the new god-mode tabs:
    Gauge, DollarSign, Tag, Shield, Flag as FlagIcon,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

import {
    fetchAdminCompany, suspendCompany, reinstateCompany,
    selectAdminCompanyById,
} from '../features/admin/adminCompaniesSlice';
import {
    fetchCompanyEntitlements, replaceEntitlements, fetchPlans, updateCompanyLicense,
    selectCompanyEntitlements, selectPlans,
} from '../features/admin/adminLicensingSlice';
// Pass D / Task 5b.2 — revoke + manual-issue on company detail.
import { revokeLicense, approveLicenseApplication, rejectLicenseApplication } from '../features/admin/adminLicenseApplicationsSlice';
import {
    fetchCompanyDomains, addCompanyDomain, bulkAddDomains,
    toggleDomainScope, removeDomain,
    selectCompanyDomains, selectCompanyDomainsLicense, selectCompanyDomainsLoading,
} from '../features/admin/adminDomainsSlice';
import {
    fetchCompanyActivity, selectCompanyActivity, selectCompanyActivityLoading,
} from '../features/admin/adminActivitySlice';

import LicensePlanBadge from '../components/admin/LicensePlanBadge';
import ModuleEntitlementsGrid from '../components/admin/ModuleEntitlementsGrid';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';
import NetworkTargetsPanel from '../components/admin/NetworkTargetsPanel';
import CompanyUsersTab from '../components/admin/CompanyUsersTab';
import CompanyAssetsTab from '../components/admin/CompanyAssetsTab';
import CompanyAlertsTab from '../components/admin/CompanyAlertsTab';
import CompanyScansTab from '../components/admin/CompanyScansTab';
import CompanyIntegrationsTab from '../components/admin/CompanyIntegrationsTab';
import CompanyTakedownsTab from '../components/admin/CompanyTakedownsTab';
// Patch-6 additions — god-mode + finance tabs.
import CompanyFlagsTab from '../components/admin/CompanyFlagsTab';
import CompanyRateLimitsTab from '../components/admin/CompanyRateLimitsTab';
import CompanyCostsTab from '../components/admin/CompanyCostsTab';
import CompanyPricingTab from '../components/admin/CompanyPricingTab';
import CompanyPrivacyTab from '../components/admin/CompanyPrivacyTab';
import AdminAssessmentRunner from '../components/admin/AdminAssessmentRunner';

/**
 * Rich per-company management. Five tabs:
 *   Overview   — stats, license at a glance, suspend/reinstate
 *   Domains    — FQDN management with bulk import (admin acts on behalf)
 *   Assets     — IPs / CIDRs / hostnames with bulk import
 *   Licensing  — plan + limits + module entitlements
 *   Activity   — per-company event stream
 *
 * Tabs are URL-driven via ?tab= so deep links land on the right place
 * and the browser back button does what you'd expect.
 */

const TABS = [
    { key: 'overview',     label: 'Overview',     icon: LayoutDashboard },
    { key: 'users',        label: 'Users',        icon: Users },
    { key: 'domains',      label: 'Domains',      icon: Globe },
    { key: 'assets',       label: 'Assets',       icon: Wifi },
    { key: 'alerts',       label: 'Alerts',       icon: AlertTriangle },
    { key: 'scans',        label: 'Scans',        icon: ActivityIcon },
    { key: 'takedowns',    label: 'Takedowns',    icon: Pause },
    { key: 'integrations', label: 'Integrations', icon: ToggleRight },
    { key: 'flags',        label: 'Flags',        icon: FlagIcon },
    { key: 'rate-limits',  label: 'Rate limits',  icon: Gauge },
    { key: 'costs',        label: 'Cost',         icon: DollarSign },
    { key: 'pricing',      label: 'Pricing',      icon: Tag },
    { key: 'licensing',    label: 'Licensing',    icon: CreditCard },
    { key: 'privacy',      label: 'Privacy',      icon: Shield },
    { key: 'activity',     label: 'Activity',     icon: ActivityIcon },
];

export default function CompanyDetailPage() {
    const { id: companyId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get('tab') ?? 'overview';

    const dispatch = useDispatch();
    const detail = useSelector((s) => selectAdminCompanyById(s, companyId));

    useEffect(() => { dispatch(fetchAdminCompany(companyId)); }, [dispatch, companyId]);

    if (!detail) {
        return (
            <div className="p-6 flex items-center gap-2 text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Loading company...
            </div>
        );
    }

    const { company, license } = detail;

    return (
        <div className="flex flex-col h-full">
            <div className="px-6 pt-5 pb-3 bg-white border-b border-slate-200">
                <button type="button" onClick={() => navigate('/companies')}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 mb-2">
                    <ArrowLeft size={12} /> Back to companies
                </button>
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-semibold text-guardian-navy truncate">{company.name}</h1>
                        <p className="text-sm text-slate-500">
                            {company.domain || '—'} · <code className="text-xs">{company.id}</code>
                        </p>
                    </div>
                    <LicensePlanBadge plan={license?.plan} status={license?.status} expiresAt={license?.expires_at} />
                </div>

                <nav className="mt-4 -mb-3 flex gap-1">
                    {TABS.map((t) => {
                        const Icon = t.icon;
                        const active = tab === t.key;
                        return (
                            <button key={t.key} type="button" onClick={() => setSearchParams({ tab: t.key })}
                                className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${
                                    active
                                        ? 'border-guardian-navy text-guardian-navy font-medium'
                                        : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}>
                                <Icon size={14} /> {t.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {tab === 'overview'     && <OverviewTab            companyId={companyId} detail={detail} />}
                {tab === 'users'        && <CompanyUsersTab        companyId={companyId} />}
                {tab === 'domains'      && <DomainsTab             companyId={companyId} />}
                {tab === 'assets'       && <AssetsTab              companyId={companyId} />}
                {tab === 'alerts'       && <CompanyAlertsTab       companyId={companyId} />}
                {tab === 'scans'        && <CompanyScansTab        companyId={companyId} />}
                {tab === 'takedowns'    && <CompanyTakedownsTab    companyId={companyId} />}
                {tab === 'integrations' && <CompanyIntegrationsTab companyId={companyId} />}
                {tab === 'flags'        && <CompanyFlagsTab        company={detail.company} />}
                {tab === 'rate-limits'  && <CompanyRateLimitsTab   company={detail.company} />}
                {tab === 'costs'        && <CompanyCostsTab        company={detail.company} />}
                {tab === 'pricing'      && <CompanyPricingTab      company={detail.company} />}
                {tab === 'licensing'    && <LicensingTab           companyId={companyId} />}
                {tab === 'privacy'      && <CompanyPrivacyTab      company={detail.company} />}
                {tab === 'activity'     && <ActivityTab            companyId={companyId} />}
            </div>
        </div>
    );
}

// ── Overview tab ─────────────────────────────────────────────────────────

function OverviewTab({ companyId, detail }) {
    const dispatch = useDispatch();
    const { company, license, stats, recent_activity, pending_application, applications_history } = detail;
    const [confirm, setConfirm] = useState(null);

    const doSuspend = async (reason) => {
        await dispatch(suspendCompany({ companyId, reason }));
        setConfirm(null);
        dispatch(fetchAdminCompany(companyId));
    };
    const doReinstate = async () => {
        await dispatch(reinstateCompany(companyId));
        setConfirm(null);
        dispatch(fetchAdminCompany(companyId));
    };
    // Pass D / Task 5b.2 — revoke license from company-detail view.
    const doRevoke = async (reason) => {
        if (license?.id) {
            await dispatch(revokeLicense({ id: license.id, admin_note: reason }));
            dispatch(fetchAdminCompany(companyId));
        }
        setConfirm(null);
    };

    const isSuspended = license?.status === 'suspended';

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat icon={Users}         label="Users"       value={stats?.users        ?? 0} />
                <Stat icon={Globe}         label="Domains"     value={stats?.domains      ?? 0} />
                <Stat icon={AlertTriangle} label="Open alerts" value={stats?.open_alerts  ?? 0} tone="critical" />
                <Stat icon={Calendar}      label="Open issues" value={stats?.open_issues  ?? 0} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card title="License" className="lg:col-span-2">
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                        <Field k="Plan"    v={<span className="capitalize">{license?.plan ?? '—'}</span>} />
                        <Field k="Status"  v={<span className="capitalize">{license?.status ?? '—'}</span>} />
                        <Field k="Seats"   v={`${license?.seats_limit ?? '—'}`} />
                        <Field k="Domains" v={`${license?.domains_limit ?? '—'}`} />
                        <Field k="Scans / mo" v={`${license?.scans_per_month_limit ?? '—'}`} />
                        <Field k="Expires" v={license?.expires_at ? formatDistanceToNow(parseISO(license.expires_at), { addSuffix: true }) : 'never'} />
                    </dl>
                    {/* Pass D / Task 5b.2 — Revoke + Manually Issue actions
                        on the company detail view (outside the application
                        review flow). Edit License opens the existing modal
                        on the Licensing tab. */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        {license?.status === 'active' && (
                            <button
                                type="button"
                                onClick={() => setConfirm({ type: 'revoke' })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md"
                            >
                                <Pause size={12} /> Revoke license
                            </button>
                        )}
                        {!license && (
                            <button
                                type="button"
                                onClick={() => navigate(`/companies/${companyId}?tab=licensing`)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-guardian-navy bg-guardian-navy/5 hover:bg-guardian-navy/10 border border-guardian-navy/20 rounded-md"
                            >
                                <Plus size={12} /> Issue license manually
                            </button>
                        )}
                        {license && (
                            <Link
                                to={`/companies/${companyId}?tab=licensing`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-guardian-navy"
                            >
                                Edit / change plan →
                            </Link>
                        )}
                    </div>
                </Card>

                <Card title="Operations">
                    <div className="space-y-2 text-sm">
                        <p className="text-slate-600">
                            {isSuspended
                                ? 'This tenant is suspended. Users cannot sign in until reinstated.'
                                : 'Tenant is active. Suspension blocks login and freezes scans.'}
                        </p>
                        {isSuspended ? (
                            <button type="button" onClick={() => setConfirm({ type: 'reinstate' })}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md">
                                <Play size={14} /> Reinstate tenant
                            </button>
                        ) : (
                            <button type="button" onClick={() => setConfirm({ type: 'suspend' })}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md">
                                <Pause size={14} /> Suspend tenant
                            </button>
                        )}
                    </div>
                </Card>
            </div>

            {/* Task 1 — License application surface inside the company-detail
                License tab. Pending application (act on inline) + history. */}
            <LicenseApplicationsBlock
                companyId={companyId}
                pendingApplication={pending_application}
                applicationsHistory={applications_history || []}
            />

            <Card title="Recent activity">
                <Link to={`/activity?company=${companyId}`} className="text-xs text-guardian-navy hover:underline mb-2 inline-block">
                    View full activity →
                </Link>
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                    {(recent_activity ?? []).length === 0 && (
                        <div className="py-6 text-sm text-center text-slate-500">No recent activity.</div>
                    )}
                    {(recent_activity ?? []).map((row) => (
                        <div key={row.id} className="py-2 text-sm">
                            <div className="text-slate-800">{row.summary || row.action}</div>
                            <div className="text-xs text-slate-500">
                                {row.actor_role} · {row.created_at ? formatDistanceToNow(parseISO(row.created_at), { addSuffix: true }) : ''}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <AdminConfirmModal open={confirm?.type === 'suspend'} title={`Suspend ${company.name}?`}
                description="All users on this tenant will be locked out immediately."
                confirmLabel="Suspend" variant="destructive" requireReason
                onCancel={() => setConfirm(null)} onConfirm={doSuspend} />
            <AdminConfirmModal open={confirm?.type === 'revoke'} title={`Revoke ${company.name}'s license?`}
                description="Customer module API calls will start returning 402 (Payment Required) immediately. They can re-apply for a new license."
                confirmLabel="Revoke license" variant="destructive" requireReason
                onCancel={() => setConfirm(null)} onConfirm={doRevoke} />
            <AdminConfirmModal open={confirm?.type === 'reinstate'} title={`Reinstate ${company.name}?`}
                confirmLabel="Reinstate"
                onCancel={() => setConfirm(null)} onConfirm={doReinstate} />
        </div>
    );
}

// ── Domains tab ──────────────────────────────────────────────────────────

function DomainsTab({ companyId }) {
    const dispatch = useDispatch();
    const list    = useSelector((s) => selectCompanyDomains(s, companyId));
    const license = useSelector((s) => selectCompanyDomainsLicense(s, companyId));
    const loading = useSelector((s) => selectCompanyDomainsLoading(s, companyId));

    const [showAdd,  setShowAdd]  = useState(false);
    const [showBulk, setShowBulk] = useState(false);
    const [confirm,  setConfirm]  = useState(null);

    useEffect(() => { dispatch(fetchCompanyDomains({ companyId })); }, [dispatch, companyId]);

    const limitReached = license?.limit > 0 && license?.current >= license?.limit;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Domains</h2>
                    <p className="text-sm text-slate-500">
                        {license?.current ?? 0} / {license?.limit || '∞'} of the {license?.plan ?? '—'} plan domain quota
                        {limitReached && <span className="ml-2 text-red-600 font-medium">· limit reached</span>}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setShowBulk(true)} disabled={limitReached}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-sm rounded-md hover:bg-slate-50 disabled:opacity-50">
                        <Upload size={14} /> Bulk import
                    </button>
                    <button type="button" onClick={() => setShowAdd(true)} disabled={limitReached}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-guardian-navy hover:bg-guardian-navy-800 text-white text-sm font-medium rounded-md disabled:opacity-50">
                        <Plus size={14} /> Add domain
                    </button>
                </div>
            </div>

            {list.length > 0 && (
                <AdminAssessmentRunner companyId={companyId} domains={list} />
            )}

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Domain</th>
                            <th className="px-3 py-2 text-left">Environment</th>
                            <th className="px-3 py-2 text-left">Last scanned</th>
                            <th className="px-3 py-2 text-center">In scope</th>
                            <th className="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !list.length ? (
                            <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-500">Loading...</td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-500">No domains configured.</td></tr>
                        ) : list.map((d) => (
                            <tr key={d.id} className={d.in_scope === false ? 'bg-slate-50/50 text-slate-500' : ''}>
                                <td className="px-3 py-2.5 font-mono text-sm">{d.domain}</td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">{d.environment ?? '—'}</td>
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {d.scanned_at ? formatDistanceToNow(parseISO(d.scanned_at), { addSuffix: true }) : 'never'}
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                    <button type="button" onClick={() => dispatch(toggleDomainScope({ companyId, domainId: d.id }))}
                                        title="Toggle in-scope">
                                        {d.in_scope === false
                                            ? <ToggleLeft size={20} className="text-slate-300" />
                                            : <ToggleRight size={20} className="text-emerald-600" />}
                                    </button>
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                    <button type="button" onClick={() => setConfirm({ type: 'delete', domain: d })}
                                        className="p-1.5 rounded hover:bg-red-50 text-red-600">
                                        <Trash2 size={14} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <AddDomainModal open={showAdd} onClose={() => setShowAdd(false)}
                onSubmit={async (payload) => {
                    await dispatch(addCompanyDomain({ companyId, payload }));
                    setShowAdd(false);
                    dispatch(fetchCompanyDomains({ companyId }));
                }} />
            <BulkDomainsModal open={showBulk} onClose={() => setShowBulk(false)}
                onSubmit={async (lines) => {
                    await dispatch(bulkAddDomains({ companyId, domains: lines }));
                    setShowBulk(false);
                    dispatch(fetchCompanyDomains({ companyId }));
                }} />
            <AdminConfirmModal open={confirm?.type === 'delete'} title={`Remove ${confirm?.domain?.domain}?`}
                description="The domain and its scan history will be removed."
                confirmLabel="Remove" variant="destructive"
                onCancel={() => setConfirm(null)}
                onConfirm={async () => {
                    await dispatch(removeDomain({ companyId, domainId: confirm.domain.id }));
                    setConfirm(null);
                }} />

            <NetworkTargetsPanel companyId={companyId} domains={list} />
        </div>
    );
}

function AddDomainModal({ open, onClose, onSubmit }) {
    const [domain, setDomain] = useState('');
    const [busy, setBusy] = useState(false);
    if (!open) return null;

    const send = async () => {
        setBusy(true);
        try { await onSubmit({ domain }); setDomain(''); }
        finally { setBusy(false); }
    };

    return (
        <Modal title="Add domain" onClose={onClose}>
            <div className="space-y-3">
                <ModalField label="Domain *">
                    <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" className="form-input" />
                </ModalField>
                <p className="text-xs text-slate-500">
                    Hostname is lower-cased and stripped of scheme / path. Duplicates within this
                    company are rejected.
                </p>
            </div>
            <ModalActions onCancel={onClose} onSubmit={send}
                submitLabel={busy ? 'Adding…' : 'Add'} submitDisabled={!domain || busy} />
        </Modal>
    );
}

function BulkDomainsModal({ open, onClose, onSubmit }) {
    const [raw, setRaw] = useState('');
    const [busy, setBusy] = useState(false);
    if (!open) return null;

    const lines = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    const send = async () => {
        setBusy(true);
        try { await onSubmit(lines); setRaw(''); }
        finally { setBusy(false); }
    };

    return (
        <Modal title="Bulk import domains" onClose={onClose}>
            <p className="text-xs text-slate-500 mb-2">
                Paste one domain per line, or separate with spaces / commas. Up to 1000 at a time.
            </p>
            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={10}
                className="w-full font-mono text-sm p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20"
                placeholder="example.com&#10;api.example.com&#10;corp.acme.io" />
            <p className="text-xs text-slate-500 mt-1">{lines.length} domain{lines.length === 1 ? '' : 's'} to add.</p>
            <ModalActions onCancel={onClose} onSubmit={send}
                submitLabel={busy ? 'Importing…' : `Import ${lines.length}`}
                submitDisabled={!lines.length || busy} />
        </Modal>
    );
}

// ── Assets tab (read-only — product owns asset writes) ───────────────────

function AssetsTab({ companyId }) {
    return <CompanyAssetsTab companyId={companyId} />;
}

// ── Operations tabs (alerts, scans, integrations, takedowns) ─────────────


// ── Licensing tab ────────────────────────────────────────────────────────

function LicensingTab({ companyId }) {
    const dispatch     = useDispatch();
    const entitlements = useSelector((s) => selectCompanyEntitlements(s, companyId));
    const plans        = useSelector(selectPlans);
    const detail       = useSelector((s) => selectAdminCompanyById(s, companyId));

    const [pendingEnts, setPendingEnts] = useState(null);
    const [editLicense, setEditLicense] = useState(false);

    useEffect(() => {
        dispatch(fetchCompanyEntitlements(companyId));
        dispatch(fetchPlans());
    }, [dispatch, companyId]);

    const saveEntitlements = async () => {
        const list = Object.entries(pendingEnts).map(([module, enabled]) => ({ module, enabled }));
        await dispatch(replaceEntitlements({ companyId, entitlements: list }));
        setPendingEnts(null);
    };

    const license = detail?.license;

    return (
        <div className="space-y-4">
            <Card title="License plan & limits"
                trailing={
                    <button type="button" onClick={() => setEditLicense(true)}
                        className="text-xs px-2 py-1 bg-guardian-navy text-white rounded hover:bg-guardian-navy-800">
                        Edit
                    </button>
                }>
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <Field k="Plan"        v={<span className="capitalize">{license?.plan ?? '—'}</span>} />
                    <Field k="Status"      v={<span className="capitalize">{license?.status ?? '—'}</span>} />
                    <Field k="Seats"       v={license?.seats_limit          ?? '—'} />
                    <Field k="Domains"     v={license?.domains_limit        ?? '—'} />
                    <Field k="Scans / mo"  v={license?.scans_per_month_limit ?? '—'} />
                    <Field k="Expires"     v={license?.expires_at
                        ? new Date(license.expires_at).toLocaleDateString()
                        : 'never'} />
                </dl>
            </Card>

            <Card title="Module entitlements"
                trailing={pendingEnts && (
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setPendingEnts(null)}
                            className="text-xs text-slate-600 hover:text-slate-900">Cancel</button>
                        <button type="button" onClick={saveEntitlements}
                            className="text-xs px-2 py-1 bg-guardian-navy text-white rounded hover:bg-guardian-navy-800">
                            Save changes
                        </button>
                    </div>
                )}>
                <ModuleEntitlementsGrid entitlements={entitlements} onChange={(map) => setPendingEnts(map)} />
                <p className="mt-3 text-xs text-slate-500">
                    Disabling a module returns <code className="px-1 py-0.5 bg-slate-100 rounded">402 Payment Required</code>
                    to any scan/scoring request that would otherwise be allowed for this tenant.
                </p>
            </Card>

            {editLicense && (
                <EditLicenseModal license={license} plans={plans}
                    onClose={() => setEditLicense(false)}
                    onSave={async (payload) => {
                        await dispatch(updateCompanyLicense({ companyId, payload }));
                        setEditLicense(false);
                        dispatch(fetchAdminCompany(companyId));
                    }} />
            )}
        </div>
    );
}

function EditLicenseModal({ license, plans, onClose, onSave }) {
    const [plan,    setPlan]    = useState(license?.plan ?? 'trial');
    const [status,  setStatus]  = useState(license?.status ?? 'active');
    const [seats,   setSeats]   = useState(license?.seats_limit ?? 0);
    const [domains, setDomains] = useState(license?.domains_limit ?? 0);
    const [scans,   setScans]   = useState(license?.scans_per_month_limit ?? 0);
    const [expires, setExpires] = useState(license?.expires_at?.slice(0, 10) ?? '');
    const [busy,    setBusy]    = useState(false);

    const applyPlanDefaults = (newPlan) => {
        setPlan(newPlan);
        const def = (plans?.plans ?? []).find((p) => p.key === newPlan);
        if (def) { setSeats(def.seats); setDomains(def.domains); setScans(def.scans_per_month); }
    };

    const save = async () => {
        setBusy(true);
        try {
            await onSave({
                plan, status,
                seats_limit:           Number(seats),
                domains_limit:         Number(domains),
                scans_per_month_limit: Number(scans),
                expires_at:            expires || null,
            });
        } finally { setBusy(false); }
    };

    return (
        <Modal title="Edit license" onClose={onClose}>
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <ModalField label="Plan">
                        <select value={plan} onChange={(e) => applyPlanDefaults(e.target.value)} className="form-input">
                            {(plans?.plans ?? []).map((p) => <option key={p.key} value={p.key}>{p.key}</option>)}
                        </select>
                    </ModalField>
                    <ModalField label="Status">
                        <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-input">
                            {(plans?.statuses ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </ModalField>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <ModalField label="Seats"><input type="number" min="0" value={seats}   onChange={(e) => setSeats(e.target.value)}   className="form-input" /></ModalField>
                    <ModalField label="Domains"><input type="number" min="0" value={domains} onChange={(e) => setDomains(e.target.value)} className="form-input" /></ModalField>
                    <ModalField label="Scans/mo"><input type="number" min="0" value={scans}  onChange={(e) => setScans(e.target.value)}  className="form-input" /></ModalField>
                </div>
                <ModalField label="Expires">
                    <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} className="form-input" />
                </ModalField>
            </div>
            <ModalActions onCancel={onClose} onSubmit={save}
                submitLabel={busy ? 'Saving…' : 'Save'} submitDisabled={busy} />
        </Modal>
    );
}

// ── Activity tab ─────────────────────────────────────────────────────────

function ActivityTab({ companyId }) {
    const dispatch = useDispatch();
    const feed     = useSelector((s) => selectCompanyActivity(s, companyId)) ?? [];
    const loading  = useSelector((s) => selectCompanyActivityLoading(s, companyId));

    useEffect(() => { dispatch(fetchCompanyActivity({ companyId, limit: 200 })); }, [dispatch, companyId]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Activity</h2>
                    <p className="text-sm text-slate-500">Scans, alerts, takedowns, and admin actions for this tenant.</p>
                </div>
                <Link to={`/activity?company=${companyId}`} className="text-xs text-guardian-navy hover:underline">
                    Open full activity view →
                </Link>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg">
                {loading && !feed.length ? (
                    <div className="p-8 text-center text-slate-500">Loading activity…</div>
                ) : !feed.length ? (
                    <div className="p-8 text-center text-slate-500">No recent activity.</div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {feed.map((e, i) => (
                            <div key={`${e.type}-${e.target_id}-${i}`} className="p-3">
                                <div className="flex items-center gap-2 text-sm">
                                    <TypePill type={e.type} />
                                    <span className="text-slate-800">{e.summary}</span>
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    {e.at ? formatDistanceToNow(parseISO(e.at), { addSuffix: true }) : ''}
                                    {e.actor && <> · by <code>{e.actor}</code></>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Shared primitives ────────────────────────────────────────────────────

function Stat({ icon: Icon, label, value, tone = 'default' }) {
    const toneColor = tone === 'critical' && Number(value) > 0 ? 'text-red-600' : 'text-guardian-navy';
    return (
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Icon size={12} /> {label}
            </div>
            <div className={`mt-1 text-2xl font-semibold ${toneColor}`}>{value}</div>
        </div>
    );
}

function SmallStat({ label, value, onClick, active }) {
    return (
        <button type="button" onClick={onClick}
            className={`text-left p-3 rounded-lg border transition-colors ${
                active ? 'bg-guardian-navy text-white border-guardian-navy' : 'bg-white border-slate-200 hover:border-slate-300'
            }`}>
            <div className={`text-xs uppercase tracking-wide ${active ? 'text-white/70' : 'text-slate-500'}`}>{label}</div>
            <div className="mt-0.5 text-xl font-semibold">{value}</div>
        </button>
    );
}

function Card({ title, trailing, className = '', children }) {
    return (
        <div className={`p-4 bg-white border border-slate-200 rounded-lg ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                {trailing}
            </div>
            {children}
        </div>
    );
}

function Field({ k, v }) {
    return (
        <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt>
            <dd className="mt-0.5 text-slate-900 font-medium">{v}</dd>
        </div>
    );
}

function KindPill({ kind }) {
    const styles = {
        ip:       'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
        cidr:     'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
        hostname: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    };
    return (
        <span className={`px-2 py-0.5 text-xs font-medium uppercase rounded-full ${styles[kind] ?? 'bg-slate-100 text-slate-700'}`}>
            {kind}
        </span>
    );
}

function TypePill({ type }) {
    const map = {
        scan:     'bg-sky-50 text-sky-700',
        alert:    'bg-amber-50 text-amber-800',
        takedown: 'bg-red-50 text-red-700',
        audit:    'bg-slate-100 text-slate-700',
    };
    return (
        <span className={`text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded ${map[type] ?? 'bg-slate-100 text-slate-600'}`}>
            {type}
        </span>
    );
}

function Modal({ title, onClose, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-base font-semibold">{title}</h3>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
                </div>
                <div className="p-5">{children}</div>
                <style>{`.form-input{width:100%;padding:.5rem .75rem;font-size:.875rem;border:1px solid #cbd5e1;border-radius:.375rem}`}</style>
            </div>
        </div>
    );
}

function ModalField({ label, children }) {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
            {children}
        </div>
    );
}

function ModalActions({ onCancel, onSubmit, submitLabel, submitDisabled }) {
    return (
        <div className="flex items-center justify-end gap-2 mt-4 -mb-1">
            <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-slate-700 hover:text-slate-900">Cancel</button>
            <button type="button" onClick={onSubmit} disabled={submitDisabled}
                className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50 text-white rounded-md">
                {submitLabel}
            </button>
        </div>
    );
}

// ───────────────────────────────────────────────────────────────────────
// LicenseApplicationsBlock — Task 1 (Pass F).
// Renders the company's license-application surface inside the existing
// company-detail Overview tab: pending application card (inline approve /
// reject) + applications history list. Active application transitions in
// place via fetchAdminCompany after the action.
// ───────────────────────────────────────────────────────────────────────
function LicenseApplicationsBlock({ companyId, pendingApplication, applicationsHistory }) {
    const dispatch = useDispatch();
    const [approveBusy, setApproveBusy] = useState(false);
    const [rejectBusy,  setRejectBusy]  = useState(false);
    const [rejectNote,  setRejectNote]  = useState('');
    const [showReject,  setShowReject]  = useState(false);
    const [adminNote,   setAdminNote]   = useState('');

    const refresh = () => dispatch(fetchAdminCompany(companyId));

    const onApprove = async () => {
        if (!pendingApplication) return;
        setApproveBusy(true);
        try {
            await dispatch(approveLicenseApplication({
                id: pendingApplication.id,
                payload: { admin_note: adminNote || undefined },
            }));
            setAdminNote('');
            refresh();
        } finally { setApproveBusy(false); }
    };

    const onReject = async () => {
        if (!pendingApplication || rejectNote.trim().length < 1) return;
        setRejectBusy(true);
        try {
            await dispatch(rejectLicenseApplication({
                id: pendingApplication.id,
                admin_note: rejectNote.trim(),
            }));
            setRejectNote('');
            setShowReject(false);
            refresh();
        } finally { setRejectBusy(false); }
    };

    return (
        <Card title="License application">
            {pendingApplication ? (
                <div className="space-y-3">
                    <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded text-sm">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-amber-900 font-medium">
                                    Pending application · <span className="capitalize">{pendingApplication.license_type_slug}</span>
                                </div>
                                <div className="text-xs text-amber-800/80 mt-0.5">
                                    {pendingApplication.applicant?.email ?? pendingApplication.applicant_user_id}
                                    {' · applied '}
                                    {pendingApplication.applied_at
                                        ? formatDistanceToNow(parseISO(pendingApplication.applied_at), { addSuffix: true })
                                        : '—'}
                                </div>
                                {pendingApplication.message && (
                                    <div className="mt-2 text-xs text-amber-900 italic">"{pendingApplication.message}"</div>
                                )}
                            </div>
                        </div>
                    </div>
                    {showReject ? (
                        <div className="space-y-2">
                            <textarea
                                value={rejectNote}
                                onChange={(e) => setRejectNote(e.target.value)}
                                rows={3}
                                placeholder="Reason — shown to the customer"
                                className="w-full text-sm p-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-red-200"
                            />
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={onReject}
                                    disabled={rejectBusy || rejectNote.trim().length < 1}
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded">
                                    Reject application
                                </button>
                                <button type="button" onClick={() => { setShowReject(false); setRejectNote(''); }}
                                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={onApprove} disabled={approveBusy}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded">
                                {approveBusy ? 'Approving…' : 'Approve'}
                            </button>
                            <button type="button" onClick={() => setShowReject(true)}
                                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded">
                                Reject
                            </button>
                            <input
                                type="text"
                                value={adminNote}
                                onChange={(e) => setAdminNote(e.target.value)}
                                placeholder="Optional approval note"
                                className="flex-1 text-xs p-1.5 border border-slate-300 rounded"
                            />
                        </div>
                    )}
                </div>
            ) : (
                <p className="text-sm text-slate-500">
                    No pending application. The customer can apply for a new subscription from their License page.
                </p>
            )}

            {applicationsHistory.length > 0 && (
                <div className="mt-5 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">Applications history</h4>
                    <ul className="space-y-1.5 text-xs">
                        {applicationsHistory.map((a) => (
                            <li key={a.id} className="flex items-center justify-between gap-2">
                                <span className="text-slate-700">
                                    <span className="capitalize font-medium">{a.license_type_slug}</span>
                                    {' · '}
                                    <span className={
                                        a.status === 'approved' ? 'text-emerald-700' :
                                        a.status === 'rejected' ? 'text-red-700' :
                                        'text-slate-500'
                                    }>{a.status}</span>
                                </span>
                                <span className="text-slate-400">
                                    {a.reviewed_at
                                        ? formatDistanceToNow(parseISO(a.reviewed_at), { addSuffix: true })
                                        : a.applied_at
                                            ? formatDistanceToNow(parseISO(a.applied_at), { addSuffix: true })
                                            : ''}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </Card>
    );
}
