import { useDispatch, useSelector } from 'react-redux';
import { LogOut, ChevronDown, AlertOctagon } from 'lucide-react';
import { useState } from 'react';
import { logout, selectAuthUser } from '../../features/auth/authSlice';
import NotificationBell from './NotificationBell';

/**
 * Top bar — environment banner (in non-prod), current user, logout.
 * The environment banner is loud on purpose: misclicking "production"
 * vs "staging" in the admin portal is unacceptable.
 */

export default function TopBar() {
    const dispatch = useDispatch();
    const user     = useSelector(selectAuthUser);
    const [open, setOpen] = useState(false);

    const envLabel = import.meta.env.VITE_ENV_LABEL || 'development';
    const isProd = envLabel.toLowerCase() === 'production';

    return (
        <div className="flex flex-col">
            {!isProd && (
                <div className="bg-amber-500 text-amber-950 px-4 py-1 text-xs font-medium flex items-center gap-2">
                    <AlertOctagon size={12} />
                    <span>{envLabel.toUpperCase()} environment — production data may differ.</span>
                </div>
            )}

            <header className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-slate-200">
                <div className="text-sm text-slate-500">
                    Signed in as <span className="text-slate-800 font-medium">{user?.email}</span>
                </div>

                <div className="flex items-center gap-1.5">
                    <NotificationBell />

                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setOpen(!open)}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 text-sm"
                        >
                            <div className="w-7 h-7 rounded-full bg-guardian-navy text-white flex items-center justify-center text-xs font-semibold">
                                {(user?.name?.[0] || user?.email?.[0] || 'A').toUpperCase()}
                            </div>
                            <ChevronDown size={14} className="text-slate-400" />
                        </button>

                        {open && (
                            <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-md shadow-lg z-20">
                                <div className="p-3 border-b border-slate-100">
                                    <div className="text-sm font-medium text-slate-900 truncate">{user?.name}</div>
                                    <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setOpen(false); dispatch(logout()); }}
                                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                    <LogOut size={14} /> Sign out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>
        </div>
    );
}
