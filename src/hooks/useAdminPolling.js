import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Generic polling hook. Re-runs `fetcher` every `intervalMs` while
 * the tab is visible. Pauses when hidden (no point hammering the
 * API for a tab the user isn't looking at).
 *
 * Pages that want real-time-feeling updates wrap their dispatch in
 * this hook. Examples already in the admin portal:
 *
 *   // Alerts queue, refresh every 10s
 *   useAdminPolling(
 *     () => dispatch(fetchAlerts(filters)),
 *     10_000,
 *     [filters],
 *   );
 *
 *   // System health snapshot, every 5s
 *   useAdminPolling(() => dispatch(fetchSystemSnapshot()), 5_000);
 *
 *   // Job summary, every 5s with toggle
 *   const [enabled, setEnabled] = useState(false);
 *   useAdminPolling(() => dispatch(fetchJobSummary()), 5_000, [], enabled);
 *
 * Returns { lastRunAt, runNow, paused } so the UI can show "last
 * updated 3s ago" indicators and force-refresh buttons.
 */
export default function useAdminPolling(fetcher, intervalMs, deps = [], enabled = true) {
    const [lastRunAt, setLastRunAt] = useState(null);
    const [paused,    setPaused]    = useState(false);
    const fetcherRef = useRef(fetcher);
    fetcherRef.current = fetcher;

    const run = useCallback(async () => {
        try {
            await fetcherRef.current();
            setLastRunAt(new Date());
        } catch (e) {
            // Fetcher errors are surfaced via its own toast/store mechanism.
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;

        // Initial run
        run();
        if (!intervalMs || intervalMs <= 0) return;

        let intervalId = null;
        const start = () => {
            if (intervalId) return;
            intervalId = setInterval(run, intervalMs);
            setPaused(false);
        };
        const stop = () => {
            if (!intervalId) return;
            clearInterval(intervalId);
            intervalId = null;
            setPaused(true);
        };
        const onVisibility = () => (document.hidden ? stop() : start());

        if (!document.hidden) start();
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            if (intervalId) clearInterval(intervalId);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, intervalMs, ...deps]);

    return { lastRunAt, runNow: run, paused };
}
