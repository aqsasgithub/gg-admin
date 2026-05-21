import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Download, Trash2, AlertOctagon, Loader2 } from 'lucide-react';
import {
    startPrivacyExport, startPrivacyErasure,
} from '../../features/admin/adminPrivacySlice';
import { selectAdminCapabilities } from '../../features/auth/authSlice';

/**
 * Per-company privacy controls. Renders in the Company detail page
 * under the "Privacy" tab. Two operations:
 *
 *   Export — package every record attributable to this tenant as a
 *            zip of JSON files. Available for 7 days.
 *   Erase  — anonymise + soft-delete the company and all its users.
 *            DESTRUCTIVE. Requires typing CONFIRM ERASE.
 *
 * Hidden entirely from admins without the relevant capability
 * (privacy.export / privacy.erase — owner-only by default).
 */
export default function CompanyPrivacyTab({ company }) {
    const dispatch = useDispatch();
    const caps = useSelector(selectAdminCapabilities);

    const canExport = caps.includes('*') || caps.includes('privacy.export');
    const canErase  = caps.includes('*') || caps.includes('privacy.erase');

    const [busy, setBusy] = useState(null);   // 'export' | 'erase' | null
    const [eraseModal, setEraseModal] = useState(false);
    const [exportModal, setExportModal] = useState(false);

    if (!canExport && !canErase) {
        return (
            <div className="p-6 bg-white border border-slate-200 rounded text-sm text-slate-600">
                You do not have privacy operation capabilities. Contact an owner-role admin to
                request an export or erasure on this tenant.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <header>
                <h2 className="text-lg font-semibold text-slate-900">Privacy operations</h2>
                <p className="text-sm text-slate-500">
                    GDPR-style export and erasure for {company.name}. Both are audit-logged.
                </p>
            </header>

            {canExport && (
                <div className="p-4 bg-white border border-slate-200 rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                                <Download size={14} /> Export tenant data
                            </h3>
                            <p className="text-sm text-slate-600 mt-1">
                                Bundle every record tied to this company — users, domains, scans,
                                issues, alerts, takedowns, audit history — as a downloadable zip.
                                Available for 7 days.
                            </p>
                        </div>
                        <button type="button" onClick={() => setExportModal(true)}
                            className="px-3 py-1.5 bg-guardian-navy hover:bg-guardian-navy-800 text-white text-sm font-medium rounded-md flex-shrink-0">
                            Start export
                        </button>
                    </div>
                </div>
            )}

            {canErase && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold text-red-900 flex items-center gap-1.5">
                                <Trash2 size={14} /> Erase tenant
                            </h3>
                            <p className="text-sm text-red-800 mt-1">
                                Anonymise all user PII, soft-delete the company and its domains/assets.
                                Audit history is preserved with anonymised pointers. <strong>This is
                                a destructive operation.</strong>
                            </p>
                        </div>
                        <button type="button" onClick={() => setEraseModal(true)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md flex-shrink-0">
                            Start erasure
                        </button>
                    </div>
                </div>
            )}

            {exportModal && (
                <ExportModal
                    busy={busy === 'export'}
                    onClose={() => setExportModal(false)}
                    onSubmit={async (legalBasis) => {
                        setBusy('export');
                        try {
                            await dispatch(startPrivacyExport({
                                subjectType: 'company',
                                subjectId: company.id,
                                legalBasis,
                            }));
                            setExportModal(false);
                        } finally { setBusy(null); }
                    }} />
            )}

            {eraseModal && (
                <EraseModal companyName={company.name}
                    busy={busy === 'erase'}
                    onClose={() => setEraseModal(false)}
                    onSubmit={async ({ legalBasis, confirm }) => {
                        setBusy('erase');
                        try {
                            await dispatch(startPrivacyErasure({
                                subjectType: 'company',
                                subjectId: company.id,
                                legalBasis,
                                confirm,
                            }));
                            setEraseModal(false);
                        } finally { setBusy(null); }
                    }} />
            )}
        </div>
    );
}

function ExportModal({ busy, onClose, onSubmit }) {
    const [legalBasis, setLegalBasis] = useState('');
    const ok = legalBasis.trim().length >= 5;
    return (
        <Modal title="Start tenant export" onClose={onClose}>
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                        Legal basis <span className="text-red-500">*</span>
                    </label>
                    <input value={legalBasis} onChange={(e) => setLegalBasis(e.target.value)}
                        placeholder="e.g. Customer DSAR request 2026-05-21"
                        className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                    <p className="text-xs text-slate-500 mt-1">Recorded in the audit trail.</p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm">Cancel</button>
                    <button type="button" disabled={!ok || busy}
                        onClick={() => onSubmit(legalBasis.trim())}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50 text-white rounded-md">
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        Start export
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function EraseModal({ companyName, busy, onClose, onSubmit }) {
    const [legalBasis, setLegalBasis] = useState('');
    const [confirm,    setConfirm]    = useState('');
    const ok = legalBasis.trim().length >= 5 && confirm === 'CONFIRM ERASE';
    return (
        <Modal title={`Erase ${companyName}?`} onClose={onClose}>
            <div className="space-y-3">
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-900 flex items-start gap-2">
                    <AlertOctagon size={14} className="flex-shrink-0 mt-0.5" />
                    <div>
                        This anonymises all user PII and soft-deletes the company, its domains, and
                        IP assets. Audit history is preserved. There is <strong>no undo</strong>.
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                        Legal basis <span className="text-red-500">*</span>
                    </label>
                    <input value={legalBasis} onChange={(e) => setLegalBasis(e.target.value)}
                        placeholder="e.g. GDPR Art. 17 erasure request"
                        className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                        Type <code className="bg-slate-100 px-1 rounded">CONFIRM ERASE</code> to proceed
                    </label>
                    <input value={confirm} onChange={(e) => setConfirm(e.target.value)}
                        placeholder="CONFIRM ERASE"
                        className="w-full p-2 text-sm font-mono border border-slate-300 rounded-md" />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm">Cancel</button>
                    <button type="button" disabled={!ok || busy}
                        onClick={() => onSubmit({ legalBasis: legalBasis.trim(), confirm })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-md">
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        Erase tenant
                    </button>
                </div>
            </div>
        </Modal>
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
            </div>
        </div>
    );
}
