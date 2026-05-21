import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import {
    selectIsAuthenticated, selectAdminCapabilities, selectAuthBootLoading,
} from '../../features/auth/authSlice';

/**
 * RequireAuth wraps the admin app. Two responsibilities:
 *
 *   1. Redirect unauthenticated users to /login.
 *   2. Optionally enforce a `requiredCapability` for the subtree —
 *      e.g. only show /licensing routes to roles that hold
 *      'licenses.update'.
 *
 * The backend enforces capability checks for real; this is UX so
 * non-privileged users don't see broken pages.
 */

export default function RequireAuth({ requiredCapability = null }) {
    const isAuthed   = useSelector(selectIsAuthenticated);
    const bootLoading = useSelector(selectAuthBootLoading);
    const caps       = useSelector(selectAdminCapabilities);
    const location   = useLocation();

    if (bootLoading) {
        return <BootScreen />;
    }

    if (!isAuthed) {
        const next = encodeURIComponent(location.pathname + location.search);
        return <Navigate to={`/login?next=${next}`} replace />;
    }

    if (requiredCapability) {
        const hasIt = caps.includes('*') || caps.includes(requiredCapability);
        if (!hasIt) return <DeniedScreen capability={requiredCapability} />;
    }

    return <Outlet />;
}

function BootScreen() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-sm text-slate-500">Loading admin session…</div>
        </div>
    );
}

function DeniedScreen({ capability }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="max-w-md text-center">
                <div className="inline-flex p-3 bg-red-50 rounded-full mb-4">
                    <ShieldOff size={28} className="text-red-600" />
                </div>
                <h1 className="text-xl font-semibold text-slate-900">Access denied</h1>
                <p className="mt-2 text-sm text-slate-600">
                    The capability <code className="px-1 py-0.5 bg-slate-100 rounded">{capability}</code> is required for this page.
                </p>
                <p className="mt-3 text-xs text-slate-400">
                    Contact an Owner to grant you the role you need.
                </p>
            </div>
        </div>
    );
}
