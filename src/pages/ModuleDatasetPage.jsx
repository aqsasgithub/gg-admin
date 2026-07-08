import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft, Plus, Edit, Trash2, X, Save, Loader2,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchDatasetRecords, fetchDatasetRecord,
    createDatasetRecord, updateDatasetRecord, deleteDatasetRecord,
    selectDataset,
} from '../features/admin/adminModuleDataSlice';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';
import AdminContextBar from '../components/admin/AdminContextBar';
import {
    selectAdminContextCompanyId, selectAdminContextDomainId,
} from '../features/admin/adminContextSlice';
import { fetchAdminCompanies } from '../features/admin/adminCompaniesSlice';

/**
 * /modules/:module/:dataset
 *
 * Generic CRUD table for any module dataset. Adapts to either of the
 * two backend metadata shapes:
 *
 *  (a) Legacy single-payload shape (Brand Protection / Domain Security /
 *      Application Security):
 *        meta.payload_column  — name of the data-blob field
 *        meta.extra_fields    — scalar columns
 *
 *  (b) Tabular multi-field shape (Network Security / Cloud Security /
 *      Compliance):
 *        meta.list_fields     — columns shown in the index table + as
 *                                inputs in the form
 *        meta.full_fields     — heavyweight JSON/text fields, shown
 *                                only on the form (rendered as textareas)
 *
 * The two shapes never overlap on the same dataset — the page picks one
 * at render time based on whichever key is present in the response.
 */
export default function ModuleDatasetPage() {
    const { module, dataset } = useParams();
    const dispatch  = useDispatch();
    const bucket    = useSelector((s) => selectDataset(s, module, dataset));
    // The picked context is auto-injected as request headers by the
    // axios interceptor — we read it here only to re-fetch the list
    // when the user switches company or domain.
    const ctxCompanyId = useSelector(selectAdminContextCompanyId);
    const ctxDomainId  = useSelector(selectAdminContextDomainId);

    const [filters,  setFilters]  = useState({
        domain: '', page: 1, per_page: 50,
    });
    const [editing,  setEditing]  = useState(null);   // null | { id?, ...attrs }  (open form)
    const [deleting, setDeleting] = useState(null);   // null | record

    useEffect(() => {
        const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null));
        dispatch(fetchDatasetRecords({ module, dataset, params }));
        // Picker changes feed into headers (not params) — but we still
        // need to re-fetch when they flip, so list them in deps.
    }, [dispatch, module, dataset, filters, ctxCompanyId, ctxDomainId]);

    const meta          = bucket?.meta;
    // Company-level datasets (e.g. brand-protection social indicators) apply to
    // the whole company — no domain needed; the form shows a company dropdown.
    const companyLevel  = !!meta?.company_level;
    const companies     = useSelector((s) => s.adminCompanies.list || []);
    useEffect(() => {
        if (companyLevel && companies.length === 0) dispatch(fetchAdminCompanies());
    }, [dispatch, companyLevel, companies.length]);
    // Shape detection — see file header. `list_fields` wins when both
    // are present (a controller could theoretically expose both).
    const tabularMode   = Array.isArray(meta?.list_fields) && meta.list_fields.length > 0;
    const payloadColumn = meta?.payload_column;
    const extraFields   = meta?.extra_fields ?? [];
    const listFields    = meta?.list_fields  ?? [];
    const fullFields    = meta?.full_fields  ?? [];

    const moduleLabel   = humanizeModule(module);
    const datasetLabel  = meta?.label ?? humanizeDataset(dataset);

    const setFilter = (key, val) => setFilters((f) => ({
        ...f,
        [key]: val,
        // Reset paging when any non-page filter changes.
        page: key === 'page' ? val : 1,
    }));

    const onSave = async (record) => {
        if (record.id) {
            await dispatch(updateDatasetRecord({ module, dataset, id: record.id, payload: stripIdentity(record) }));
        } else {
            await dispatch(createDatasetRecord({ module, dataset, payload: stripIdentity(record) }));
        }
        setEditing(null);
    };

    const onDelete = async () => {
        if (!deleting) return;
        await dispatch(deleteDatasetRecord({ module, dataset, id: deleting.id }));
        setDeleting(null);
    };

    // The paginated list row intentionally omits the heavy payload column
    // (`meta` for social indicators, `findings`/etc. elsewhere) to keep the
    // index light; the edit click loads the full row — with the payload — into
    // `byId` via fetchDatasetRecord. Merge that in so the form is populated with
    // the real payload instead of `null`. `editKey` flips from `list` to `full`
    // once the full row arrives, remounting the modal (it reads `record` only in
    // its useState initialiser) so the payload textarea re-initialises with it.
    const editFull   = editing?.id ? bucket?.byId?.[editing.id] : null;
    const editRecord = editing ? { ...editing, ...(editFull ?? {}) } : null;
    const editKey    = editing ? `${editing.id ?? 'new'}:${editFull ? 'full' : 'list'}` : 'none';

    return (
        <div className="p-6 space-y-4">
            <AdminContextBar />
            <div>
                <Link to={`/modules/${module}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900">
                    <ArrowLeft size={12} /> Back to {moduleLabel}
                </Link>
                <div className="mt-2 flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold text-guardian-navy">{datasetLabel}</h1>
                        <p className="text-sm text-slate-600">
                            {meta?.total != null && (
                                <>
                                    <strong>{meta.total.toLocaleString()}</strong> record{meta.total === 1 ? '' : 's'}
                                    {' · '}
                                </>
                            )}
                            <code className="text-xs px-1 py-0.5 bg-slate-100 rounded">{module}/{dataset}</code>
                        </p>
                    </div>
                    <button type="button"
                        onClick={() => setEditing({ /* blank = create */ })}
                        disabled={!ctxCompanyId}
                        title={!ctxCompanyId ? 'Pick a company in the context bar first.' : ''}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-guardian-navy hover:bg-guardian-navy-800 text-white text-sm font-medium rounded-md disabled:opacity-50">
                        <Plus size={14} /> Add record
                    </button>
                </div>
            </div>

            {/* Filters — company/domain come from the context bar above. */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
                <FilterField label="Domain contains" value={filters.domain}
                    onChange={(v) => setFilter('domain', v)} placeholder="example.com" />
                <button type="button"
                    onClick={() => setFilters({ domain: '', page: 1, per_page: 50 })}
                    className="px-3 py-1.5 text-sm border border-slate-300 rounded-md hover:bg-slate-50">
                    Clear filters
                </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">ID</th>
                            {tabularMode ? (
                                listFields.map((f) => (
                                    <th key={f} className="px-3 py-2 text-left">{humanizeField(f)}</th>
                                ))
                            ) : (
                                <>
                                    <th className="px-3 py-2 text-left">Domain</th>
                                    <th className="px-3 py-2 text-left">Company</th>
                                    {extraFields.map((f) => (
                                        <th key={f} className="px-3 py-2 text-left">{humanizeField(f)}</th>
                                    ))}
                                </>
                            )}
                            <th className="px-3 py-2 text-left">Updated</th>
                            <th className="px-3 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {bucket?.loading && !bucket?.list?.length ? (
                            <tr><td colSpan={3 + (tabularMode ? listFields.length : 2 + extraFields.length)} className="px-3 py-8 text-center text-slate-500">
                                <Loader2 size={14} className="inline animate-spin mr-2" /> Loading records…
                            </td></tr>
                        ) : !bucket?.list?.length ? (
                            <tr><td colSpan={3 + (tabularMode ? listFields.length : 2 + extraFields.length)} className="px-3 py-8 text-center text-slate-500">
                                No records match these filters. Click <strong>Add record</strong> to create one.
                            </td></tr>
                        ) : bucket.list.map((row) => (
                            <Row key={row.id} row={row}
                                columns={tabularMode ? listFields : ['domain', 'company_id', ...extraFields]}
                                tabularMode={tabularMode}
                                onEdit={() => { dispatch(fetchDatasetRecord({ module, dataset, id: row.id })); setEditing(row); }}
                                onDelete={() => setDeleting(row)} />
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {meta && meta.last_page > 1 && (
                <div className="flex items-center justify-between text-xs text-slate-600">
                    <div>
                        Showing {(meta.current_page - 1) * meta.per_page + 1}–
                        {Math.min(meta.current_page * meta.per_page, meta.total)} of {meta.total.toLocaleString()}
                    </div>
                    <div className="flex gap-2">
                        <button type="button" disabled={meta.current_page <= 1}
                            onClick={() => setFilter('page', meta.current_page - 1)}
                            className="px-2 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40">‹ Previous</button>
                        <span className="px-2 py-1">Page {meta.current_page} / {meta.last_page}</span>
                        <button type="button" disabled={meta.current_page >= meta.last_page}
                            onClick={() => setFilter('page', meta.current_page + 1)}
                            className="px-2 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40">Next ›</button>
                    </div>
                </div>
            )}

            {editing !== null && (
                tabularMode ? (
                    <TabularRecordFormModal
                        key={editKey}
                        record={editRecord}
                        listFields={listFields}
                        fullFields={fullFields}
                        datasetLabel={datasetLabel}
                        onClose={() => setEditing(null)}
                        onSave={onSave}
                    />
                ) : (
                    <PayloadRecordFormModal
                        key={editKey}
                        record={editRecord}
                        payloadColumn={payloadColumn}
                        extraFields={extraFields}
                        datasetLabel={datasetLabel}
                        companyLevel={companyLevel}
                        companies={companies}
                        ctxCompanyId={ctxCompanyId}
                        onClose={() => setEditing(null)}
                        onSave={onSave}
                    />
                )
            )}

            <AdminConfirmModal
                open={deleting !== null}
                title={`Delete record ${deleting?.id ?? ''}?`}
                description="The row will be removed from the database."
                confirmLabel="Delete"
                variant="destructive"
                onCancel={() => setDeleting(null)}
                onConfirm={onDelete}
            />
        </div>
    );
}

// ── Row ───────────────────────────────────────────────────────────────

function Row({ row, columns, tabularMode, onEdit, onDelete }) {
    const updated = row.updated_at;
    return (
        <tr className="hover:bg-slate-50/50">
            <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600">{row.id}</td>
            {tabularMode ? (
                columns.map((c) => (
                    <td key={c} className="px-3 py-2.5 text-xs">{formatValue(row[c])}</td>
                ))
            ) : (
                <>
                    <td className="px-3 py-2.5 text-xs">{row.domain || '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-mono text-slate-600">{row.company_id || '—'}</td>
                    {columns.slice(2).map((f) => (
                        <td key={f} className="px-3 py-2.5 text-xs">{formatValue(row[f])}</td>
                    ))}
                </>
            )}
            <td className="px-3 py-2.5 text-xs text-slate-500" title={updated}>
                {updated ? formatDistanceToNow(parseISO(updated), { addSuffix: true }) : '—'}
            </td>
            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                <button type="button" onClick={onEdit}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded">
                    <Edit size={11} /> Edit
                </button>
                <button type="button" onClick={onDelete}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 hover:bg-red-50 rounded ml-1">
                    <Trash2 size={11} /> Delete
                </button>
            </td>
        </tr>
    );
}

// ── Legacy single-payload form modal (BP / DS / AS) ──────────────────

function PayloadRecordFormModal({ record, payloadColumn, extraFields, datasetLabel, companyLevel = false, companies = [], ctxCompanyId = '', onClose, onSave }) {
    const isCreate = !record?.id;

    const [form, setForm] = useState(() => {
        const initial = {
            domain_id:  record?.domain_id  ?? '',
            company_id: record?.company_id ?? (companyLevel ? (ctxCompanyId || '') : ''),
            domain:     record?.domain     ?? '',
        };
        for (const f of extraFields) initial[f] = record?.[f] ?? '';
        // Payload as pretty JSON so the textarea is readable.
        initial[payloadColumn] = JSON.stringify(record?.[payloadColumn] ?? (isCreate ? {} : null), null, 2);
        return initial;
    });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async () => {
        setError(null);
        let parsedPayload;
        try {
            parsedPayload = form[payloadColumn] ? JSON.parse(form[payloadColumn]) : null;
        } catch (e) {
            setError(`The ${payloadColumn} field must be valid JSON: ${e.message}`);
            return;
        }
        // Company-level records must carry an explicit company; block submit
        // with a clear message rather than a server 422.
        if (companyLevel && !form.company_id) {
            setError('Please select a company.');
            return;
        }
        setBusy(true);
        try {
            const payload = { ...form, [payloadColumn]: parsedPayload };
            for (const f of extraFields) if (payload[f] === '') payload[f] = null;
            // Company-level: no domain; send the chosen company_id in the body
            // (body wins over the context header on the server).
            if (companyLevel) { payload.domain = null; payload.domain_id = null; }
            await onSave({ ...payload, id: record?.id });
        } finally {
            setBusy(false);
        }
    };

    return (
        <FormShell isCreate={isCreate} datasetLabel={datasetLabel} onClose={onClose} onSubmit={submit} busy={busy} error={error}>
            {companyLevel ? (
                <div>
                    <p className="text-[11px] text-slate-500 -mt-1 mb-2">
                        Applies to the whole company / brand — every domain shows the same brand-protection intel.
                    </p>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Company *</label>
                    <select
                        value={form.company_id}
                        onChange={(e) => setField('company_id', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20"
                    >
                        <option value="">— Select a company —</option>
                        {companies.map((c) => (
                            <option key={c.id} value={c.id}>{(c.name || 'Unnamed')} ({c.id})</option>
                        ))}
                    </select>
                </div>
            ) : (
                <>
                    <p className="text-[11px] text-slate-500 -mt-1 mb-1">
                        Company and domain are taken from the picker above — no need to enter IDs.
                    </p>
                    <Field label="Domain *" value={form.domain} onChange={(v) => setField('domain', v)} placeholder="example.com" />
                </>
            )}

            {extraFields.map((f) => (
                <Field key={f} label={humanizeField(f)} value={form[f] ?? ''} onChange={(v) => setField(f, v)} />
            ))}

            <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                    {humanizeField(payloadColumn)} (JSON)
                </label>
                <textarea value={form[payloadColumn] || ''} onChange={(e) => setField(payloadColumn, e.target.value)}
                    rows={12}
                    className="w-full font-mono text-xs p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20"
                    placeholder='{ ... }' />
                <p className="text-[10px] text-slate-500 mt-1">
                    Free-form JSON. The backend stores this column as a JSON array/object — keep the
                    structure consistent with what the Azure scanner emits if you want the Reports /
                    module pages to render correctly.
                </p>
            </div>
        </FormShell>
    );
}

// ── Tabular multi-field form modal (NS / CS / Compliance) ────────────

const JSONISH_HINT = /^(_| )*(details|payload|response|breakdown|findings|controls|ports|metadata|frameworks|results|resources|compliance|summary|raw_|service_|shodan_|nmap_)/i;
const JSONISH_SUFFIX = /(_details|_payload|_response|_breakdown|_results|_data|_metadata|_open|_in_shodan|_critical_open|_reported_ports|_confirmed_open)$/i;

function looksJsonish(field, currentValue) {
    if (Array.isArray(currentValue) || (currentValue !== null && typeof currentValue === 'object')) return true;
    if (JSONISH_SUFFIX.test(field)) return true;
    if (JSONISH_HINT.test(field)) return true;
    return false;
}

function TabularRecordFormModal({ record, listFields, fullFields, datasetLabel, onClose, onSave }) {
    const isCreate = !record?.id;
    const allFields = [...listFields, ...fullFields];

    const [form, setForm] = useState(() => {
        const initial = {};
        for (const f of allFields) {
            const v = record?.[f];
            if (looksJsonish(f, v)) {
                initial[f] = JSON.stringify(v ?? (isCreate ? null : null), null, 2);
            } else {
                initial[f] = v ?? '';
            }
        }
        return initial;
    });
    const [busy,  setBusy]  = useState(false);
    const [error, setError] = useState(null);

    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async () => {
        setError(null);
        const payload = {};
        for (const f of allFields) {
            const raw = form[f];
            const previous = record?.[f];
            if (looksJsonish(f, previous)) {
                if (raw === '' || raw == null) { payload[f] = null; continue; }
                try {
                    payload[f] = JSON.parse(raw);
                } catch (e) {
                    setError(`Field "${f}" must be valid JSON: ${e.message}`);
                    return;
                }
            } else if (raw === '') {
                payload[f] = null;
            } else {
                payload[f] = raw;
            }
        }
        setBusy(true);
        try {
            await onSave({ ...payload, id: record?.id });
        } finally {
            setBusy(false);
        }
    };

    return (
        <FormShell isCreate={isCreate} datasetLabel={datasetLabel} onClose={onClose} onSubmit={submit} busy={busy} error={error} wide>
            <p className="text-[11px] text-slate-500 -mt-1 mb-2">
                Fields are derived from the dataset config. JSON-shaped columns get a textarea; scalar
                columns get a single-line input. Leaving a field blank stores it as <code>null</code>.
            </p>

            {/* Scalar (list) fields first. company_id / domain_id are
                hidden — they come from the context picker. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {listFields.map((f) => {
                    if (f === 'domain_id' || f === 'company_id') return null;
                    const previous = record?.[f];
                    if (looksJsonish(f, previous)) return null;
                    return (
                        <Field key={f} label={humanizeField(f) + (isRequiredHint(f) ? ' *' : '')}
                            value={form[f] ?? ''} onChange={(v) => setField(f, v)}
                            mono={f.endsWith('_id')} />
                    );
                })}
            </div>

            {/* JSON-ish list fields */}
            {listFields.filter((f) => looksJsonish(f, record?.[f])).map((f) => (
                <JsonTextarea key={f} label={humanizeField(f) + ' (JSON)'} value={form[f] ?? ''}
                    onChange={(v) => setField(f, v)} rows={5} />
            ))}

            {/* Full (heavy) fields */}
            {fullFields.length > 0 && (
                <>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mt-3 mb-1">
                        Heavy payload fields
                    </div>
                    {fullFields.map((f) => (
                        looksJsonish(f, record?.[f]) ? (
                            <JsonTextarea key={f} label={humanizeField(f) + ' (JSON)'} value={form[f] ?? ''}
                                onChange={(v) => setField(f, v)} rows={8} />
                        ) : (
                            <div key={f}>
                                <label className="block text-xs font-medium text-slate-700 mb-1">{humanizeField(f)}</label>
                                <textarea value={form[f] ?? ''} onChange={(e) => setField(f, e.target.value)}
                                    rows={4}
                                    className="w-full text-xs p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20" />
                            </div>
                        )
                    ))}
                </>
            )}
        </FormShell>
    );
}

function isRequiredHint(field) {
    // Mirrors the controllers' `required` rules so the operator at least
    // sees which fields the backend will reject when blank. Not a hard
    // gate — the server-side validation is the truth.
    return ['domain_id', 'company_id', 'scan_id', 'cache_type', 'provider', 'severity', 'status', 'tool', 'title'].includes(field);
}

// ── Form shell + primitives ──────────────────────────────────────────

function FormShell({ isCreate, datasetLabel, onClose, onSubmit, busy, error, wide, children }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className={`w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} bg-white rounded-lg shadow-xl flex flex-col max-h-[90vh]`}>
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-base font-semibold">
                        {isCreate ? `Create ${datasetLabel} record` : `Edit ${datasetLabel} record`}
                    </h3>
                    <button type="button" onClick={onClose}
                        className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
                </div>

                <div className="px-5 py-4 overflow-y-auto space-y-3 flex-1">
                    {error && (
                        <div className="text-sm bg-red-50 border border-red-200 text-red-800 rounded p-2">{error}</div>
                    )}
                    {children}
                </div>

                <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 flex-shrink-0">
                    <button type="button" onClick={onClose}
                        className="px-3 py-1.5 text-sm text-slate-700 hover:text-slate-900">Cancel</button>
                    <button type="button" onClick={onSubmit} disabled={busy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50 text-white rounded-md">
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {isCreate ? 'Create' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function Field({ label, value, onChange, placeholder, mono }) {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                className={`w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md ${mono ? 'font-mono text-xs' : ''}`} />
        </div>
    );
}

function JsonTextarea({ label, value, onChange, rows = 6 }) {
    return (
        <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
            <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows}
                className="w-full font-mono text-xs p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20"
                placeholder='{ ... }' />
        </div>
    );
}

function FilterField({ label, value, onChange, placeholder }) {
    return (
        <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</label>
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md" />
        </div>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────

function humanizeModule(slug) {
    return (slug || '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function humanizeDataset(slug) {
    return (slug || '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function humanizeField(key) {
    return (key || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(v) {
    if (v == null || v === '') return '—';
    if (Array.isArray(v))      return `[${v.length}]`;
    if (typeof v === 'object') return '{…}';
    if (typeof v === 'string' && v.length > 64) return v.slice(0, 60) + '…';
    return String(v);
}

function stripIdentity(record) {
    // Drop fields the backend ignores or supplies itself. Empty
    // domain_id / company_id are dropped too so the admin.context
    // middleware can fill them from the X-Admin-*-Id headers.
    const { id, source, created_at, updated_at, ...rest } = record;
    if (rest.domain_id  === '' || rest.domain_id  == null) delete rest.domain_id;
    if (rest.company_id === '' || rest.company_id == null) delete rest.company_id;
    return rest;
}
