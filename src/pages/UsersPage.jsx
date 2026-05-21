import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { UserPlus, Pause, Play, Key, ShieldPlus, MoreHorizontal, Mail, Trash2 } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
    fetchAdminUsers, inviteUser, suspendUser, reinstateUser, resetUserPassword,
    grantAdminRole, revokeAdminRole,
    selectAdminUsers, selectAdminUsersMeta, selectAdminUsersLoading, selectAdminUserWorking,
} from '../features/admin/adminUsersSlice';
import RoleBadge from '../components/admin/RoleBadge';
import AdminFilterBar from '../components/admin/AdminFilterBar';
import AdminConfirmModal from '../components/admin/AdminConfirmModal';
// Patch-7: lets a capable admin start a "view as customer" session.
// The button hides itself for admins without `impersonation.act`.
import ImpersonateButton from '../components/admin/ImpersonateButton';

/**
 * Cross-tenant user management page. Owner / support roles can invite,
 * suspend, reinstate, reset password, and grant/revoke admin roles.
 */

const STATUS_OPTIONS = [
    { value: 'active',    label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'invited',   label: 'Invited' },
];

const ROLE_OPTIONS = [
    { value: 'owner',    label: 'Owner' },
    { value: 'security', label: 'Security' },
    { value: 'support',  label: 'Support' },
    { value: 'dev',      label: 'Dev' },
    { value: 'viewer',   label: 'Viewer' },
];

export default function AdminUsers() {
    const dispatch = useDispatch();
    const users    = useSelector(selectAdminUsers);
    const meta     = useSelector(selectAdminUsersMeta);
    const loading  = useSelector(selectAdminUsersLoading);

    const [filters,  setFilters]   = useState({});
    const [page,     setPage]      = useState(1);
    const [showInvite, setShowInvite] = useState(false);
    const [confirm,  setConfirm]   = useState(null);    // {type, user}
    const [roleMenu, setRoleMenu]  = useState(null);    // user id whose dropdown is open

    useEffect(() => {
        dispatch(fetchAdminUsers({ ...filters, page, per_page: 25 }));
    }, [dispatch, filters, page]);

    const refresh = () => dispatch(fetchAdminUsers({ ...filters, page, per_page: 25 }));

    const doSuspend = async (reason) => {
        await dispatch(suspendUser({ userId: confirm.user.id, reason }));
        setConfirm(null);
        refresh();
    };
    const doReinstate = async () => {
        await dispatch(reinstateUser(confirm.user.id));
        setConfirm(null);
        refresh();
    };
    const doReset = async () => {
        await dispatch(resetUserPassword(confirm.user.id));
        setConfirm(null);
    };
    const doRevokeRole = async () => {
        await dispatch(revokeAdminRole({ userId: confirm.user.id, role: confirm.role }));
        setConfirm(null);
        refresh();
    };

    return (
        <div className="p-6 space-y-4">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-guardian-navy">Users</h1>
                    <p className="text-sm text-slate-600">Cross-tenant user administration.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowInvite(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-guardian-navy hover:bg-guardian-navy-800 text-white text-sm font-medium rounded-md"
                >
                    <UserPlus size={14} /> Invite User
                </button>
            </header>

            <AdminFilterBar
                filters={[
                    { key: 'search', type: 'text',   label: 'Search', placeholder: 'Name or email...' },
                    { key: 'status', type: 'select', label: 'Status', options: STATUS_OPTIONS },
                    { key: 'role',   type: 'select', label: 'Admin role', options: ROLE_OPTIONS },
                ]}
                value={filters}
                onChange={(v) => { setFilters(v); setPage(1); }}
                onClear={() => { setFilters({}); setPage(1); }}
            />

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">User</th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Roles</th>
                            <th className="px-3 py-2 text-left">Last Login</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && !users.length ? (
                            <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-500">Loading...</td></tr>
                        ) : !users.length ? (
                            <tr><td colSpan="5" className="px-3 py-8 text-center text-slate-500">No users found.</td></tr>
                        ) : users.map((u) => (
                            <UserRow
                                key={u.id}
                                user={u}
                                roleMenuOpen={roleMenu === u.id}
                                onToggleRoleMenu={() => setRoleMenu(roleMenu === u.id ? null : u.id)}
                                onGrantRole={async (role) => {
                                    await dispatch(grantAdminRole({ userId: u.id, role }));
                                    setRoleMenu(null);
                                    refresh();
                                }}
                                onAction={(type, role) => setConfirm({ type, user: u, role })}
                            />
                        ))}
                    </tbody>
                </table>

                {meta && meta.last_page > 1 && (
                    <Pagination meta={meta} onChange={setPage} />
                )}
            </div>

            <InviteModal
                open={showInvite}
                onClose={() => setShowInvite(false)}
                onSubmit={async (payload) => {
                    await dispatch(inviteUser(payload));
                    setShowInvite(false);
                    refresh();
                }}
            />

            <AdminConfirmModal
                open={confirm?.type === 'suspend'}
                title={`Suspend ${confirm?.user?.email}?`}
                description="The user will be signed out and unable to log in until reinstated."
                confirmLabel="Suspend"
                variant="destructive"
                requireReason
                onCancel={() => setConfirm(null)}
                onConfirm={doSuspend}
            />
            <AdminConfirmModal
                open={confirm?.type === 'reinstate'}
                title={`Reinstate ${confirm?.user?.email}?`}
                description="The user will be able to log in again."
                confirmLabel="Reinstate"
                onCancel={() => setConfirm(null)}
                onConfirm={doReinstate}
            />
            <AdminConfirmModal
                open={confirm?.type === 'reset'}
                title={`Send password reset to ${confirm?.user?.email}?`}
                description="An email with a reset link is delivered to the user."
                confirmLabel="Send reset email"
                onCancel={() => setConfirm(null)}
                onConfirm={doReset}
            />
            <AdminConfirmModal
                open={confirm?.type === 'revoke_role'}
                title={`Revoke '${confirm?.role}' from ${confirm?.user?.email}?`}
                confirmLabel="Revoke"
                variant="destructive"
                onCancel={() => setConfirm(null)}
                onConfirm={doRevokeRole}
            />
        </div>
    );
}

// ── Row -------------------------------------------------------------------

function UserRow({ user, onAction, onGrantRole, roleMenuOpen, onToggleRoleMenu }) {
    const working = useSelector((s) => selectAdminUserWorking(s, user.id));
    const isSuspended = user.status === 'suspended';

    return (
        <tr className={isSuspended ? 'bg-red-50/30' : ''}>
            <td className="px-3 py-2.5">
                <div className="font-medium text-slate-900">{user.name || '—'}</div>
                <div className="text-xs text-slate-500">{user.email}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{user.id}</div>
            </td>
            <td className="px-3 py-2.5">
                <StatusPill status={user.status ?? 'active'} />
            </td>
            <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                    {(user.admin_roles ?? []).map((r) => (
                        <button
                            key={r.id}
                            type="button"
                            onClick={() => onAction('revoke_role', r.role)}
                            title="Click to revoke"
                            className="group"
                        >
                            <RoleBadge role={r.role} className="group-hover:ring-2 group-hover:ring-red-400" />
                        </button>
                    ))}
                    {!user.admin_roles?.length && <span className="text-xs text-slate-400">none</span>}
                </div>
            </td>
            <td className="px-3 py-2.5 text-xs text-slate-600">
                {user.last_login_at
                    ? formatDistanceToNow(parseISO(user.last_login_at), { addSuffix: true })
                    : '—'}
            </td>
            <td className="px-3 py-2.5">
                <div className="flex items-center justify-end gap-1">
                    {/* Impersonate first — the most operationally significant
                        action and the one the docs call out specifically.
                        The component renders null if the current admin lacks
                        the impersonation.act capability. */}
                    <ImpersonateButton user={user} />
                    <IconAction
                        icon={Key}
                        title="Reset password"
                        onClick={() => onAction('reset')}
                    />
                    <div className="relative">
                        <IconAction
                            icon={ShieldPlus}
                            title="Grant admin role"
                            onClick={onToggleRoleMenu}
                        />
                        {roleMenuOpen && (
                            <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-md shadow-lg z-10">
                                {ROLE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => onGrantRole(opt.value)}
                                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {isSuspended ? (
                        <IconAction
                            icon={Play}
                            title="Reinstate"
                            color="text-emerald-600"
                            disabled={working === 'reinstate'}
                            onClick={() => onAction('reinstate')}
                        />
                    ) : (
                        <IconAction
                            icon={Pause}
                            title="Suspend"
                            color="text-red-600"
                            disabled={working === 'suspend'}
                            onClick={() => onAction('suspend')}
                        />
                    )}
                </div>
            </td>
        </tr>
    );
}

function StatusPill({ status }) {
    const map = {
        active:    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
        suspended: 'bg-red-50 text-red-700 ring-1 ring-red-200',
        invited:   'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
            {status}
        </span>
    );
}

function IconAction({ icon: Icon, title, onClick, disabled, color = 'text-slate-600' }) {
    return (
        <button
            type="button"
            title={title}
            disabled={disabled}
            onClick={onClick}
            className={`p-1.5 rounded hover:bg-slate-100 disabled:opacity-50 ${color}`}
        >
            <Icon size={14} />
        </button>
    );
}

function Pagination({ meta, onChange }) {
    return (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-sm">
            <div className="text-slate-600">
                Page {meta.current_page} of {meta.last_page} · {meta.total} total
            </div>
            <div className="flex gap-1">
                <button
                    type="button"
                    disabled={meta.current_page <= 1}
                    onClick={() => onChange(meta.current_page - 1)}
                    className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40"
                >
                    Previous
                </button>
                <button
                    type="button"
                    disabled={meta.current_page >= meta.last_page}
                    onClick={() => onChange(meta.current_page + 1)}
                    className="px-2 py-1 rounded hover:bg-slate-200 disabled:opacity-40"
                >
                    Next
                </button>
            </div>
        </div>
    );
}

// ── Invite modal ─────────────────────────────────────────────────────────

function InviteModal({ open, onClose, onSubmit }) {
    const [email, setEmail]   = useState('');
    const [appRole, setAppRole] = useState('analyst');
    const [adminRole, setAdminRole] = useState('');
    const [companyId, setCompanyId] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const send = async () => {
        setSubmitting(true);
        try {
            await onSubmit({
                email,
                company_id:          companyId || undefined,
                intended_role:       appRole,
                intended_admin_role: adminRole || undefined,
            });
            setEmail(''); setAdminRole(''); setCompanyId('');
        } finally { setSubmitting(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl">
                <div className="p-5 border-b border-slate-100">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                        <Mail size={16} className="text-guardian-navy" /> Invite User
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">An invitation email is sent. The recipient sets their own password.</p>
                </div>

                <div className="p-5 space-y-3">
                    <Field label="Email">
                        <input
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            type="email"
                            placeholder="user@example.com"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20"
                        />
                    </Field>
                    <Field label="Company ID (optional)">
                        <input
                            value={companyId}
                            onChange={(e) => setCompanyId(e.target.value)}
                            placeholder="cmp_xxx"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20"
                        />
                    </Field>
                    <Field label="App role">
                        <select
                            value={appRole}
                            onChange={(e) => setAppRole(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20"
                        >
                            <option value="analyst">Analyst</option>
                            <option value="manager">Manager</option>
                            <option value="viewer">Viewer</option>
                        </select>
                    </Field>
                    <Field label="Admin role (optional)">
                        <select
                            value={adminRole}
                            onChange={(e) => setAdminRole(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20"
                        >
                            <option value="">None</option>
                            {ROLE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </Field>
                </div>

                <div className="flex items-center justify-end gap-2 px-5 py-3 bg-slate-50 rounded-b-lg">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm text-slate-700 hover:text-slate-900">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={send}
                        disabled={!email || submitting}
                        className="px-3 py-1.5 text-sm font-medium bg-guardian-navy hover:bg-guardian-navy-800 disabled:opacity-50 text-white rounded-md"
                    >
                        {submitting ? 'Sending...' : 'Send invitation'}
                    </button>
                </div>
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
