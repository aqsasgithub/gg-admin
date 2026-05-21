import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Shield, Download, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchPrivacyOperations, selectPrivacyOperations, selectPrivacyOperationsLoading,
} from '../features/admin/adminPrivacySlice';

/**
 * Read-only audit list of GDPR export + erasure operations across all
 * tenants. New operations are kicked off from the Privacy tab on the
 * relevant Company or User detail page (CompanyPrivacyTab).
 *
 * Anyone with admin access can VIEW the list (auditors need this); the
 * download URL is only resolved server-side for users with the
 * privacy.export capability.
 */
export default function PrivacyOperationsPage() {
    const dispatch = useDispatch();
    const list    = useSelector(selectPrivacyOperations);
    const loading = useSelector(selectPrivacyOperationsLoading);

    useEffect(() => { dispatch(fetchPrivacyOperations({ per_page: 100 })); }, [dispatch]);

    const exports = list.filter((o) => o.kind === 'export');
    const erasures = list.filter((o) => o.kind === 'erase');

    return (
        <div className="p-6 space-y-4">
            <header>
                <h1 className="text-2xl font-semibold text-guardian-navy">Privacy operations</h1>
                <p className="text-sm text-slate-600">
                    Audit trail of GDPR-style data export and erasure operations. Initiate new
                    operations from a Company or User detail page.
                </p>
            </header>

            <div className="grid grid-cols-3 gap-3">
                <Stat icon={Shield}   label="Total operations" value={list.length} />
                <Stat icon={Download} label="Exports"          value={exports.length} />
                <Stat icon={Trash2}   label="Erasures"         value={erasures.length} />
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">When</th>
                            <th className="px-3 py-2 text-left">Kind</th>
                            <th className="px-3 py-2 text-left">Subject</th>
                            <th className="px-3 py-2 text-left">Legal basis</th>
                            <th className="px-3 py-2 text-left">Requested by</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading…
                            </td></tr>
                        ) : !list.length ? (
                            <tr><td colSpan="7" className="px-3 py-8 text-center text-slate-500">
                                No privacy operations recorded.
                            </td></tr>
                        ) : list.map((op) => (
                            <tr key={op.id}>
                                <td className="px-3 py-2.5 text-xs text-slate-500">
                                    {op.created_at ? formatDistanceToNow(parseISO(op.created_at), { addSuffix: true }) : '—'}
                                </td>
                                <td className="px-3 py-2.5">
                                    <KindPill kind={op.kind} />
                                </td>
                                <td className="px-3 py-2.5 text-xs">
                                    <div className="capitalize">{op.subject_type}</div>
                                    <code className="font-mono text-slate-500">{op.subject_id}</code>
                                    {op.subject_email && <div className="text-slate-500">{op.subject_email}</div>}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-slate-600 max-w-xs truncate" title={op.legal_basis}>
                                    {op.legal_basis ?? '—'}
                                </td>
                                <td className="px-3 py-2.5 text-xs">
                                    <code className="font-mono">{op.requested_by_user_id}</code>
                                </td>
                                <td className="px-3 py-2.5"><StatusPill status={op.status} /></td>
                                <td className="px-3 py-2.5 text-right">
                                    <Link to={`/privacy/${op.id}`}
                                        className="text-xs text-guardian-navy hover:underline">
                                        View
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="p-4 bg-sky-50 border border-sky-200 rounded text-sm text-sky-900">
                <strong>How to start a new operation:</strong> open the relevant Company → Privacy tab
                (for company-wide export/erasure) or the User detail page (for individual subjects).
                Erasure requires typing <code>CONFIRM ERASE</code> and a legal basis is mandatory for both.
            </div>
        </div>
    );
}

function KindPill({ kind }) {
    const map = {
        export: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
        erase:  'bg-red-50 text-red-700 ring-1 ring-red-200',
    };
    return (
        <span className={`px-2 py-0.5 text-xs font-medium uppercase rounded ${map[kind] ?? map.export}`}>
            {kind}
        </span>
    );
}

function StatusPill({ status }) {
    const map = {
        pending:     'bg-slate-100 text-slate-700',
        in_progress: 'bg-amber-50 text-amber-800',
        completed:   'bg-emerald-50 text-emerald-700',
        failed:      'bg-red-50 text-red-700',
    };
    return (
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${map[status] ?? map.pending}`}>
            {status?.replace('_', ' ')}
        </span>
    );
}

function Stat({ icon: Icon, label, value }) {
    return (
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                <Icon size={12} /> {label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-guardian-navy">{value}</div>
        </div>
    );
}
