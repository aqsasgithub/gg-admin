import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { logout } from '../../features/auth/authSlice';
import { IDLE_TIMEOUT_MINUTES as IDLE_MIN } from '../../configs/environments';

/**
 * Admin shell. Drops the sidebar + topbar around the page content and
 * installs an idle-timeout watchdog. The watchdog interval is centralized
 * in configs/environments.js — admin portals warrant aggressive defaults;
 * lower it in production for security-sensitive accounts via the
 * VITE_IDLE_TIMEOUT_MINUTES env var.
 */

export default function Layout() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    useEffect(() => {
        if (IDLE_MIN <= 0) return;        // 0 disables — for dev convenience
        let lastActivity = Date.now();
        const bump = () => { lastActivity = Date.now(); };

        // Mouse + keyboard + visibility together cover every meaningful
        // "the user is still here" signal. We avoid scroll/touch on
        // purpose — they're easy to fire by accident.
        ['mousemove', 'mousedown', 'keydown', 'focus'].forEach((evt) =>
            window.addEventListener(evt, bump, { passive: true })
        );

        const timer = setInterval(() => {
            const minutesIdle = (Date.now() - lastActivity) / 60_000;
            if (minutesIdle >= IDLE_MIN) {
                dispatch(logout());
                navigate('/login?reason=idle', { replace: true });
            }
        }, 30_000);

        return () => {
            clearInterval(timer);
            ['mousemove', 'mousedown', 'keydown', 'focus'].forEach((evt) =>
                window.removeEventListener(evt, bump)
            );
        };
    }, [dispatch, navigate]);

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <TopBar />
                <main className="flex-1 overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
