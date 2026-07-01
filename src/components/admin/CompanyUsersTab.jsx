import { useEffect, useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
    UserPlus, Trash2, Loader2, ShieldCheck, Crown, Eye, EyeOff, PencilLine,
    Plus, X, RefreshCw, Pencil,
} from 'lucide-react';
import apiRequest from '../../api/client';
import AdminConfirmModal from './AdminConfirmModal';

const CFG = { showSuccessToast: false, showErrorToast: false };
const errOf = (e) => e?.response?.data?.message || e?.message || 'Request failed';

const ROLE_META = {
    owner:   { label: 'Owner',   Icon: Crown,       cls: 'bg-amber-50 text-amber-800 ring-amber-200', hint: 'Full control, incl. adding domains' },
    manager: { label: 'Manager', Icon: PencilLine,  cls: 'bg-indigo-50 text-indigo-800 ring-indigo-200', hint: 'Can edit, but cannot add domains' },
    viewer:  { label: 'Viewer',  Icon: Eye,         cls: 'bg-slate-100 text-slate-700 ring-slate-200', hint: 'Read-only' },
};
const INVITE_ROLES = ['viewer', 'manager']; // owner is the creator / promoted later
const ALL_ROLES = ['viewer', 'manager', 'owner'];

/**
 * Company member-user management (single-company model). Admin-only; the
 * customer never manages this. Lists members + their per-company role, invites
 * new members by email (sends the branded invite email), changes roles, and
 * removes members. The company creator is always an owner and is locked.
 *
 * Task 01: alongside the email-invite flow, admins can now ALSO add a user
 * directly (the "Add user" button → AddMemberModal). That creates a real,
 * login-ready users row mapped to THIS company (company_id + company_role),
 * so when the new user logs in the customer app shows this same company.
 */
export default function CompanyUsersTab({ companyId }) {
    const [data, setData] = useState({ members: [], pending_invites: [] });
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('viewer');
    const [inviting, setInviting] = useState(false);
    const [confirm, setConfirm] = useState(null); // { member }
    const [showAdd, setShowAdd] = useState(false);
    const [editTarget, setEditTarget] = useState(null); // member being edited

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiRequest.get(`/admin/companies/${companyId}/members`, CFG);
            setData(res.data?.data ?? { members: [], pending_invites: [] });
        } catch (e) { toast.error(errOf(e)); }
        finally { setLoading(false); }
    }, [companyId]);

    useEffect(() => { load(); }, [load]);

    const invite = async (e) => {
        e.preventDefault();
        if (!inviteEmail.trim()) return;
        setInviting(true);
        try {
            const res = await apiRequest.post(`/admin/companies/${companyId}/members`, { email: inviteEmail.trim(), role: inviteRole }, CFG);
            toast.success(res.data?.message || 'Invitation sent.');
            setInviteEmail('');
            await load();
        } catch (e) { toast.error(errOf(e)); }
        finally { setInviting(false); }
    };

    // Task 01: create a real user directly and map to this company. We send
    // company_id explicitly in the payload (the route param stays authoritative
    // server-side) per the agreed contract.
    const addUser = async (payload) => {
        const res = await apiRequest.post(
            `/admin/companies/${companyId}/members/add`,
            { ...payload, company_id: companyId },
            CFG,
        );
        toast.success(res.data?.message || 'User added.');
        setShowAdd(false);
        await load();
    };

    const changeRole = async (member, role) => {
        try {
            await apiRequest.put(`/admin/companies/${companyId}/members/${member.id}/role`, { role }, CFG);
            toast.success(`${member.email} is now ${role}.`);
            await load();
        } catch (e) { toast.error(errOf(e)); }
    };

    // Edit a member's profile (name + email). Role has its own dropdown.
    const editMember = async (data) => {
        const res = await apiRequest.put(`/admin/companies/${companyId}/members/${editTarget.id}`, data, CFG);
        toast.success(res.data?.message || 'Member updated.');
        setEditTarget(null);
        await load();
    };

    const remove = async (member) => {
        try {
            await apiRequest.delete(`/admin/companies/${companyId}/members/${member.id}`, CFG);
            toast.success(`${member.email} removed.`);
            setConfirm(null);
            await load();
        } catch (e) { toast.error(errOf(e)); }
    };

    // Re-invite: re-send a fresh link to someone who missed/lost their invite.
    const resend = async (inv) => {
        try {
            const res = await apiRequest.post(`/admin/invitations/${inv.id}/resend`, {}, CFG);
            toast.success(res.data?.message || 'Invitation re-sent.');
            await load();
        } catch (e) { toast.error(errOf(e)); }
    };

    return (
        <div className="space-y-6">
            {/* Invite + Add user */}
            <form onSubmit={invite} className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-1">
                    <div>
                        <div className="text-sm font-semibold text-slate-800">Invite a member</div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Sends a branded invitation email. The recipient sets their own password and joins this company. A user can belong to only one company.
                        </p>
                    </div>
                    {/* Task 01: second action — add a user directly (no email round-trip). */}
                    <button type="button" onClick={() => setShowAdd(true)}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 border border-guardian-navy text-guardian-navy text-sm font-medium rounded-md hover:bg-guardian-navy/5">
                        <Plus size={14} /> Add user
                    </button>
                </div>
                <div className="flex flex-wrap items-end gap-2 mt-3">
                    <div className="flex-1 min-w-[220px]">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                        <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="user@example.com"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                            className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20">
                            {INVITE_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                        </select>
                    </div>
                    <button type="submit" disabled={inviting}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-guardian-navy text-white text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-50">
                        {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Invite
                    </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                    Owner can add domains. Manager can edit but not add domains. Viewer is read-only. Promote to Owner from the table below after they join.
                    <span className="text-slate-500"> Use <span className="font-medium">Add user</span> to create a login-ready account immediately instead of emailing an invite.</span>
                </p>
            </form>

            {/* Members */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 text-sm font-semibold text-slate-800 flex items-center gap-2">
                    <ShieldCheck size={15} /> Members {loading ? '' : `(${data.members.length})`}
                </div>
                {loading ? (
                    <div className="py-10 text-center text-slate-400 text-sm"><Loader2 className="animate-spin inline" size={18} /></div>
                ) : data.members.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-sm">No members yet.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                                <th className="px-4 py-2 font-semibold">User</th>
                                <th className="px-4 py-2 font-semibold">Role</th>
                                <th className="px-4 py-2 font-semibold">Status</th>
                                <th className="px-4 py-2 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.members.map((m) => {
                                const meta = ROLE_META[m.role] || ROLE_META.viewer;
                                return (
                                    <tr key={m.id} className="border-b border-slate-50 last:border-0">
                                        <td className="px-4 py-2.5">
                                            <div className="font-medium text-slate-800">{m.name || '-'}</div>
                                            <div className="text-xs text-slate-500">{m.email}</div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${meta.cls}`} title={meta.hint}>
                                                <meta.Icon size={12} /> {meta.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-500 capitalize">{m.status || 'active'}</td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => setEditTarget(m)} title="Edit name & email"
                                                    className="p-1.5 text-slate-400 hover:text-guardian-navy rounded-md hover:bg-slate-100">
                                                    <Pencil size={14} />
                                                </button>
                                                {m.is_creator ? (
                                                    <span className="text-[11px] text-slate-400">Creator · locked</span>
                                                ) : (
                                                    <>
                                                        <select value={m.role || 'viewer'} onChange={(e) => changeRole(m, e.target.value)}
                                                            className="text-xs border border-slate-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-guardian-navy/20">
                                                            {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
                                                        </select>
                                                        <button onClick={() => setConfirm({ member: m })} title="Remove from company"
                                                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pending invites */}
            {data.pending_invites?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-slate-100 text-sm font-semibold text-slate-800">Pending invitations ({data.pending_invites.length})</div>
                    <ul className="divide-y divide-slate-50">
                        {data.pending_invites.map((i) => (
                            <li key={i.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                                <span className="text-slate-700 truncate">{i.email}</span>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className="text-xs text-slate-400">invited as {i.role} · expires {i.expires_at ? new Date(i.expires_at).toLocaleDateString() : '-'}</span>
                                    <button onClick={() => resend(i)} title="Re-send a fresh invitation link"
                                        className="text-xs font-semibold text-guardian-navy hover:underline">Resend</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {showAdd && (
                <AddMemberModal
                    onClose={() => setShowAdd(false)}
                    onSubmit={addUser}
                />
            )}

            {editTarget && (
                <EditMemberModal
                    member={editTarget}
                    onClose={() => setEditTarget(null)}
                    onSubmit={editMember}
                />
            )}

            {confirm && (
                <AdminConfirmModal
                    open
                    title="Remove member"
                    description={`Remove ${confirm.member.email} from this company? They will lose access immediately.`}
                    confirmLabel="Remove"
                    variant="danger"
                    onCancel={() => setConfirm(null)}
                    onConfirm={() => remove(confirm.member)}
                />
            )}
        </div>
    );
}

// ── Add-user-directly modal ──────────────────────────────────────────────────
// Creates a real, login-ready user mapped to this company. Collects everything
// the backend requires: name, email, a strong password, and the company role.
// Mirrors the server password policy (min 12, mixed case, letter, number,
// symbol) so the Add button only enables on a valid payload.

const PW_MIN = 12;
const pwChecks = (pw) => ({
    len:    pw.length >= PW_MIN,
    lower:  /[a-z]/.test(pw),
    upper:  /[A-Z]/.test(pw),
    digit:  /\d/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
});

function generatePassword() {
    const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const L = 'abcdefghijkmnpqrstuvwxyz';
    const D = '23456789';
    const S = '!@#$%^&*?-_';
    const all = U + L + D + S;
    const rand = (n) => {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n;
        }
        return Math.floor(Math.random() * n);
    };
    const pick = (set) => set[rand(set.length)];
    const chars = [pick(U), pick(L), pick(D), pick(S)];
    for (let i = chars.length; i < 16; i++) chars.push(pick(all));
    // Fisher–Yates shuffle so the guaranteed-class chars aren't always leading.
    for (let i = chars.length - 1; i > 0; i--) {
        const j = rand(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}

function AddMemberModal({ onClose, onSubmit }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('viewer');
    const [showPw, setShowPw] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const checks = useMemo(() => pwChecks(password), [password]);
    const passwordValid = Object.values(checks).every(Boolean);
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const valid = name.trim() && emailValid && passwordValid;

    const submit = async (e) => {
        e.preventDefault();
        if (!valid || submitting) return;
        setSubmitting(true);
        try {
            await onSubmit({ name: name.trim(), email: email.trim(), password, role });
        } catch (err) {
            toast.error(err?.response?.data?.message || err?.message || 'Could not add the user.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
            <form onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}
                className="w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-200">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <UserPlus size={16} /> Add user to this company
                    </div>
                    <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-4 space-y-3">
                    <p className="text-xs text-slate-500">
                        Creates an active account mapped to this company. The user can sign in immediately with the password you set — share it securely.
                    </p>

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Full name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                            placeholder="Jane Doe"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20" />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                            placeholder="user@example.com"
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20" />
                        {email && !emailValid && <p className="text-[11px] text-red-500 mt-1">Enter a valid email address.</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <input type={showPw ? 'text' : 'password'} value={password}
                                    onChange={(e) => setPassword(e.target.value)} required
                                    placeholder="Min 12 chars"
                                    className="w-full px-3 py-2 pr-9 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20" />
                                <button type="button" onClick={() => setShowPw((v) => !v)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                            <button type="button" onClick={() => { setPassword(generatePassword()); setShowPw(true); }}
                                title="Generate a strong password"
                                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs border border-slate-300 rounded-md text-slate-600 hover:bg-slate-50">
                                <RefreshCw size={13} /> Generate
                            </button>
                        </div>
                        {password && !passwordValid && (
                            <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                                <Req ok={checks.len}>12+ characters</Req>
                                <Req ok={checks.upper}>Uppercase</Req>
                                <Req ok={checks.lower}>Lowercase</Req>
                                <Req ok={checks.digit}>Number</Req>
                                <Req ok={checks.symbol}>Symbol</Req>
                            </ul>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                        <select value={role} onChange={(e) => setRole(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20">
                            {INVITE_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label} — {ROLE_META[r].hint}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100">
                    <button type="button" onClick={onClose}
                        className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md">Cancel</button>
                    <button type="submit" disabled={!valid || submitting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-guardian-navy text-white rounded-md hover:opacity-90 disabled:opacity-50">
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Add user
                    </button>
                </div>
            </form>
        </div>
    );
}

// ── Edit-member modal ────────────────────────────────────────────────────────
// Edits a member's name + email. Role is managed by the inline dropdown, so it
// isn't repeated here. Email is editable and validated unique server-side.
function EditMemberModal({ member, onClose, onSubmit }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (member) { setName(member.name ?? ''); setEmail(member.email ?? ''); }
    }, [member]);

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const dirty = name !== (member.name ?? '') || email !== (member.email ?? '');
    const valid = name.trim() && emailValid && dirty;

    const submit = async (e) => {
        e.preventDefault();
        if (!valid || submitting) return;
        setSubmitting(true);
        try {
            const data = {};
            if (name !== (member.name ?? ''))   data.name  = name.trim();
            if (email !== (member.email ?? '')) data.email = email.trim();
            await onSubmit(data);
        } catch (err) {
            toast.error(err?.response?.data?.message || err?.message || 'Could not update the member.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onClose}>
            <form onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}
                className="w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-200">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <Pencil size={16} /> Edit member
                    </div>
                    <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                        <X size={16} />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Full name</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20" />
                        {email && !emailValid && <p className="text-[11px] text-red-500 mt-1">Enter a valid email address.</p>}
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100">
                    <button type="button" onClick={onClose}
                        className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md">Cancel</button>
                    <button type="submit" disabled={!valid || submitting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-guardian-navy text-white rounded-md hover:opacity-90 disabled:opacity-50">
                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />} Save changes
                    </button>
                </div>
            </form>
        </div>
    );
}

function Req({ ok, children }) {
    return (
        <li className={`flex items-center gap-1 ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            {children}
        </li>
    );
}
