import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { FileCheck, FileClock, FileX2, FileText } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';

import {
    fetchLicenseApplications,
    approveLicenseApplication,
    rejectLicenseApplication,
    revokeLicense,
    selectApplications,
    selectApplicationsMeta,
    selectApplicationsLoading,
    selectActing,
} from '../features/admin/adminLicenseApplicationsSlice';
import AdminFilterBar from '../components/admin/AdminFilterBar';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';

/**
 * /admin/license-applications — review queue for customer-initiated
 * license applications.
 *
 * Pass B / Task 5 frontend.
 */

const STATUS_OPTIONS = [
    { value: 'pending',  label: 'Pending'  },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
];

const STATUS_TONE = {
    pending:  'bg-amber-50  text-amber-800  ring-amber-200',
    approved: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    rejected: 'bg-red-50   text-red-800   ring-red-200',
};

export default function LicenseApplicationsPage() {
    const dispatch = useDispatch();
    const apps     = useSelector(selectApplications);
    const meta     = useSelector(selectApplicationsMeta);
    const loading  = useSelector(selectApplicationsLoading);
    const acting   = useSelector(selectActing);

    // Task 1 — default to "all statuses" so processed (approved/rejected/
    // revoked/expired) rows remain visible. Admin filters via the bar.
    const [filters, setFilters] = useState({});
    const [approveTarget, setApproveTarget] = useState(null);
    const [rejectTarget,  setRejectTarget]  = useState(null);
    const [revokeTarget,  setRevokeTarget]  = useState(null);

    useEffect(() => {
        dispatch(fetchLicenseApplications({ ...filters, per_page: 50 }));
    }, [dispatch, filters]);

    const summary = useMemo(() => {
        const acc = { pending: 0, approved: 0, rejected: 0 };
        for (const a of apps) if (acc[a.status] !== undefined) acc[a.status]++;
        return acc;
    }, [apps]);

    const refetch = () => dispatch(fetchLicenseApplications({ ...filters, per_page: 50 }));

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy">License Applications</h1>
                <p className="text-sm text-slate-600">
                    Customer-initiated requests for a license. Approving issues a CompanyLicense and grants default module entitlements.
                </p>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat icon={FileText}  label="Total in view" value={meta?.total ?? apps.length} />
                <Stat icon={FileClock} label="Pending"   value={summary.pending}  tone={summary.pending  ? 'warning' : 'default'} />
                <Stat icon={FileCheck} label="Approved"  value={summary.approved} />
                <Stat icon={FileX2}    label="Rejected"  value={summary.rejected} tone={summary.rejected ? 'critical' : 'default'} />
            </div>

            <AdminFilterBar
                filters={[
                    { key: 'status', type: 'select', label: 'Status', options: STATUS_OPTIONS },
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
                            <th className="px-3 py-2 text-left">Applicant</th>
                            <th className="px-3 py-2 text-left">Plan</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Applied</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !apps.length ? (
                            <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">Loading…</td></tr>
                        ) : !apps.length ? (
                            <tr><td colSpan="6" className="px-3 py-8 text-center text-slate-500">No applications match.</td></tr>
                        ) : apps.map((a) => (
                            <tr key={a.id}>
                                <td className="px-3 py-2.5">
                                    <Link to={`/companies/${a.company_id}`} className="text-slate-900 hover:text-guardian-navy">
                                        <div className="font-medium">{a.company?.name ?? a.company_id}</div>
                                        <div className="text-xs text-slate-500">{a.company_id}</div>
                                    </Link>
                                </td>
                                <td className="px-3 py-2.5 text-slate-700">
                                    <div>{a.applicant?.email ?? a.applicant_user_id}</div>
                                    {a.applicant_ip && (
                                        <div className="text-[11px] text-slate-400">{a.applicant_ip}</div>
                                    )}
                                </td>
                                <td className="px-3 py-2.5">
                                    <div className="flex flex-col gap-1">
                                        {/* Pass I — kind badge: New vs Upgrade */}
                                        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded inline-block w-fit ${
                                            a.kind === 'upgrade'
                                                ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                                                : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'
                                        }`}>
                                            {a.kind === 'upgrade' ? 'Upgrade' : 'New'}
                                        </span>
                                        <span className="px-2 py-0.5 text-xs uppercase tracking-wider rounded bg-slate-100 text-slate-700">
                                            {a.license_type_slug}
                                        </span>
                                        {/* For upgrades, show "from → to" */}
                                        {a.kind === 'upgrade' && a.upgrading_from_license_id && a.current_license?.plan && (
                                            <span className="text-[10px] text-slate-500">
                                                from <span className="capitalize">{a.current_license.plan}</span> → <span className="capitalize">{a.license_type_slug}</span>
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-3 py-2.5">
                                    <span className={`px-2 py-0.5 text-xs uppercase rounded ring-1 ${STATUS_TONE[a.status] || ''}`}>
                                        {a.status}
                                    </span>
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-600">
                                    {a.applied_at ? formatDistanceToNow(parseISO(a.applied_at), { addSuffix: true }) : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                    {a.status === 'pending' && (
                                        <div className="inline-flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setApproveTarget(a)}
                                                disabled={acting}
                                                className="px-3 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded disabled:opacity-50"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRejectTarget(a)}
                                                disabled={acting}
                                                className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded disabled:opacity-50"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                    {/* Task 1 — Approved + license currently active → Revoke inline */}
                                    {a.status === 'approved' && a.current_license?.status === 'active' && (
                                        <button
                                            type="button"
                                            onClick={() => setRevokeTarget(a)}
                                            disabled={acting}
                                            className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded disabled:opacity-50"
                                        >
                                            Revoke
                                        </button>
                                    )}
                                    {/* Rejected / Expired / Revoked → no actions, just a quiet timestamp. */}
                                    {(a.status === 'rejected' || (a.status === 'approved' && a.current_license?.status !== 'active')) && (
                                        <span className="text-xs text-slate-400">
                                            {a.reviewed_at ? `reviewed ${formatDistanceToNow(parseISO(a.reviewed_at), { addSuffix: true })}` : ''}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {approveTarget && (
                <ApproveModal
                    application={approveTarget}
                    onCancel={() => setApproveTarget(null)}
                    onConfirm={async ({ duration_days, license_type_slug, admin_note }) => {
                        await dispatch(approveLicenseApplication({
                            id: approveTarget.id,
                            payload: { duration_days, license_type_slug, admin_note },
                        }));
                        setApproveTarget(null);
                        refetch();
                    }}
                />
            )}

            {rejectTarget && (
                <AdminConfirmModal
                    open
                    title={`Reject application for ${rejectTarget.company?.name ?? rejectTarget.company_id}?`}
                    description={`Plan requested: ${rejectTarget.license_type_slug}. The customer will see your note and may re-apply.`}
                    confirmLabel="Reject application"
                    variant="destructive"
                    requireReason
                    onCancel={() => setRejectTarget(null)}
                    onConfirm={async (reason) => {
                        await dispatch(rejectLicenseApplication({
                            id: rejectTarget.id,
                            admin_note: reason,
                        }));
                        setRejectTarget(null);
                        refetch();
                    }}
                />
            )}

            {/* Task 1 — Revoke inline on approved rows whose license is active. */}
            {revokeTarget && revokeTarget.current_license?.id && (
                <AdminConfirmModal
                    open
                    title={`Revoke ${revokeTarget.company?.name ?? revokeTarget.company_id}'s license?`}
                    description="Customer module API calls will start returning 402 (Payment Required) immediately. They can re-apply for a new license."
                    confirmLabel="Revoke license"
                    variant="destructive"
                    requireReason
                    onCancel={() => setRevokeTarget(null)}
                    onConfirm={async (reason) => {
                        await dispatch(revokeLicense({
                            id: revokeTarget.current_license.id,
                            admin_note: reason,
                        }));
                        setRevokeTarget(null);
                        refetch();
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

function ApproveModal({ application, onCancel, onConfirm }) {
    const [slug,     setSlug]     = useState(application.license_type_slug);
    const [duration, setDuration] = useState('');
    const [note,     setNote]     = useState('');
    const [busy,     setBusy]     = useState(false);

    const submit = async () => {
        setBusy(true);
        try {
            await onConfirm({
                duration_days:     duration ? Number(duration) : undefined,
                license_type_slug: slug || undefined,
                admin_note:        note || undefined,
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-lg">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h3 className="text-lg font-semibold text-guardian-navy">Approve application</h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Issuing a license for <strong>{application.company?.name ?? application.company_id}</strong> · requested plan <strong className="uppercase">{application.license_type_slug}</strong>.
                    </p>
                </div>
                <div className="px-5 py-4 space-y-4">
                    <Field label="Plan (override)" hint="Leave as requested unless you want to issue a different tier.">
                        <select
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-guardian-navy"
                        >
                            {['trial', 'starter', 'pro', 'enterprise', 'custom'].map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Duration (days)" hint="Leave blank to use the plan's default.">
                        <input
                            type="number"
                            min="1"
                            max="3650"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            placeholder="e.g. 365"
                            className="w-full px-3 py-2 text-sm rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-guardian-navy"
                        />
                    </Field>
                    <Field label="Admin note" hint="Optional. Visible in the audit log; not shown to the customer.">
                        <textarea
                            rows={3}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            maxLength={2000}
                            className="w-full px-3 py-2 text-sm rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-guardian-navy"
                        />
                    </Field>
                </div>
                <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={busy}
                        className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded disabled:opacity-50"
                    >
                        {busy ? 'Approving…' : 'Approve & issue license'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, hint, children }) {
    return (
        <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">{label}</label>
            {children}
            {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
        </div>
    );
}
