import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Shield, Mail, KeyRound, Loader2, AlertOctagon } from 'lucide-react';
import {
    requestLoginOtp, verifyOtp,
    selectAwaitingOtp, selectOtpEmail, selectAuthLoading,
    selectAuthError, selectIsAuthenticated, clearAuthError,
} from '../features/auth/authSlice';

/**
 * Login flow: email/password → OTP → admin session.
 *
 * Note that verifyOtp will reject the session if the user has no
 * admin_roles. Customer accounts cannot sign in here even with a
 * valid password.
 */

export default function LoginPage() {
    const dispatch = useDispatch();
    const [searchParams] = useSearchParams();
    const next = searchParams.get('next') || '/';
    const reason = searchParams.get('reason');

    const isAuthed     = useSelector(selectIsAuthenticated);
    const awaitingOtp  = useSelector(selectAwaitingOtp);
    const otpEmail     = useSelector(selectOtpEmail);
    const loading      = useSelector(selectAuthLoading);
    const error        = useSelector(selectAuthError);

    const [email, setEmail]       = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp]           = useState('');

    useEffect(() => () => dispatch(clearAuthError()), [dispatch]);

    if (isAuthed) {
        // Use Navigate (not window.location) so the SPA cache survives.
        return <Navigate to={next} replace />;
    }

    const submitCredentials = (e) => {
        e.preventDefault();
        dispatch(requestLoginOtp({ email, password }));
    };
    const submitOtp = (e) => {
        e.preventDefault();
        dispatch(verifyOtp({ email: otpEmail || email, otp }));
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-guardian-navy-950 p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 backdrop-blur rounded-xl mb-3">
                        <Shield size={22} className="text-white" />
                    </div>
                    <h1 className="text-xl font-semibold text-white">GuardianGaze Admin</h1>
                    <p className="text-xs text-white/60 mt-1">Restricted access — admins only</p>
                </div>

                {reason === 'idle' && (
                    <div className="mb-4 px-3 py-2 bg-amber-500/10 border border-amber-400/30 text-amber-200 text-xs rounded-md flex items-center gap-2">
                        <AlertOctagon size={14} /> Signed out due to inactivity. Please sign in again.
                    </div>
                )}

                <div className="bg-white rounded-lg shadow-xl overflow-hidden">
                    {!awaitingOtp ? (
                        <form onSubmit={submitCredentials} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                                <div className="relative">
                                    <Mail size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        required autoFocus
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20 focus:border-guardian-navy"
                                        placeholder="admin@guardiangaze.com"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20 focus:border-guardian-navy"
                                />
                            </div>

                            {error && (
                                <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
                                    {error}
                                </div>
                            )}

                            <button type="submit" disabled={loading || !email || !password}
                                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-guardian-navy hover:bg-guardian-navy-800 text-white text-sm font-medium rounded-md disabled:opacity-50">
                                {loading && <Loader2 size={14} className="animate-spin" />}
                                Continue
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={submitOtp} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-700 mb-1">One-time code</label>
                                <div className="relative">
                                    <KeyRound size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        required autoFocus
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20 focus:border-guardian-navy font-mono tracking-widest"
                                        placeholder="123456"
                                    />
                                </div>
                                <p className="text-xs text-slate-500 mt-1">Code sent to {otpEmail}</p>
                            </div>

                            {error && (
                                <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
                                    {error}
                                </div>
                            )}

                            <button type="submit" disabled={loading || !otp}
                                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-guardian-navy hover:bg-guardian-navy-800 text-white text-sm font-medium rounded-md disabled:opacity-50">
                                {loading && <Loader2 size={14} className="animate-spin" />}
                                Verify & sign in
                            </button>
                        </form>
                    )}
                </div>

                <p className="text-center text-xs text-white/50 mt-4">
                    Customer app users → <a href="https://app.guardiangaze.com" className="underline hover:text-white/80">app.guardiangaze.com</a>
                </p>
            </div>
        </div>
    );
}
