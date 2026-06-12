import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { UserPlus, Trash2, Loader2, ShieldCheck, Crown, Eye, PencilLine } from 'lucide-react';
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
 */
export default function CompanyUsersTab({ companyId }) {
    const [data, setData] = useState({ members: [], pending_invites: [] });
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('viewer');
    const [inviting, setInviting] = useState(false);
    const [confirm, setConfirm] = useState(null); // { member }

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

    const changeRole = async (member, role) => {
        try {
            await apiRequest.put(`/admin/companies/${companyId}/members/${member.id}/role`, { role }, CFG);
            toast.success(`${member.email} is now ${role}.`);
            await load();
        } catch (e) { toast.error(errOf(e)); }
    };

    const remove = async (member) => {
        try {
            await apiRequest.delete(`/admin/companies/${companyId}/members/${member.id}`, CFG);
            toast.success(`${member.email} removed.`);
            setConfirm(null);
            await load();
        } catch (e) { toast.error(errOf(e)); }
    };

    return (
        <div className="space-y-6">
            {/* Invite */}
            <form onSubmit={invite} className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="text-sm font-semibold text-slate-800 mb-1">Invite a member</div>
                <p className="text-xs text-slate-500 mb-3">
                    Sends a branded invitation email. The recipient sets their own password and joins this company. A user can belong to only one company.
                </p>
                <div className="flex flex-wrap items-end gap-2">
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
                            <li key={i.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                                <span className="text-slate-700">{i.email}</span>
                                <span className="text-xs text-slate-400">invited as {i.role} · expires {i.expires_at ? new Date(i.expires_at).toLocaleDateString() : '-'}</span>
                            </li>
                        ))}
                    </ul>
                </div>
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
