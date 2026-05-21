import { useState, useEffect } from 'react';
import { Shield, Globe, Layers, Wifi, Cloud, BookOpen, Target, Sword, Send, MessageSquare } from 'lucide-react';

/**
 * Module entitlement editor. Renders the canonical module list as a
 * toggleable grid; emits `onChange` with the full module → enabled map.
 *
 * Modules + icons mirror SCORING_MODULES in the frontend + the
 * CompanyModuleEntitlement::MODULES constant in PHP — keep both in sync
 * when adding a module.
 */

const MODULE_META = {
    brand_protection:     { label: 'Brand Protection',     icon: Shield,         color: 'text-purple-600 bg-purple-50' },
    domain_security:      { label: 'Domain Security',      icon: Globe,          color: 'text-sky-600 bg-sky-50' },
    application_security: { label: 'Application Security', icon: Layers,         color: 'text-indigo-600 bg-indigo-50' },
    network_security:     { label: 'Network Security',     icon: Wifi,           color: 'text-orange-600 bg-orange-50' },
    cloud_security:       { label: 'Cloud Security',       icon: Cloud,          color: 'text-cyan-600 bg-cyan-50' },
    compliance:           { label: 'Compliance',           icon: BookOpen,       color: 'text-emerald-600 bg-emerald-50' },
    takedowns:            { label: 'Takedowns',            icon: Sword,          color: 'text-red-600 bg-red-50' },
    mitre_attack:         { label: 'MITRE ATT&CK',         icon: Target,         color: 'text-rose-600 bg-rose-50' },
    integrations_jira:    { label: 'Jira Integration',     icon: Send,           color: 'text-blue-600 bg-blue-50' },
    integrations_slack:   { label: 'Slack Integration',    icon: MessageSquare,  color: 'text-violet-600 bg-violet-50' },
};

const DEFAULT_MODULES = Object.keys(MODULE_META);

export default function ModuleEntitlementsGrid({
    entitlements,            // [{ module, enabled, ... }]
    onChange,
    disabled = false,
}) {
    // Build a map keyed by module name, defaulting to false for modules
    // the company hasn't been given a row for yet.
    const [grid, setGrid] = useState(() => buildGrid(entitlements));

    useEffect(() => {
        setGrid(buildGrid(entitlements));
    }, [entitlements]);

    const toggle = (module) => {
        if (disabled) return;
        const next = { ...grid, [module]: !grid[module] };
        setGrid(next);
        onChange?.(next);
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DEFAULT_MODULES.map((m) => {
                const meta = MODULE_META[m];
                const Icon = meta.icon;
                const enabled = !!grid[m];
                return (
                    <button
                        key={m}
                        type="button"
                        onClick={() => toggle(m)}
                        disabled={disabled}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all
                            ${enabled
                                ? 'border-guardian-navy bg-guardian-navy/5 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300'}
                            ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                    >
                        <div className={`p-2 rounded-md ${meta.color}`}>
                            <Icon size={16} strokeWidth={2} />
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900">{meta.label}</div>
                            <div className="text-xs text-slate-500">
                                {enabled ? 'Enabled' : 'Not licensed'}
                            </div>
                        </div>
                        <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${enabled ? 'bg-guardian-navy' : 'bg-slate-300'}`}>
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : ''}`} />
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

function buildGrid(entitlements) {
    const map = {};
    DEFAULT_MODULES.forEach((m) => { map[m] = false; });
    (entitlements ?? []).forEach((e) => {
        if (e?.module && Object.prototype.hasOwnProperty.call(map, e.module)) {
            map[e.module] = !!e.enabled;
        }
    });
    return map;
}

export { MODULE_META, DEFAULT_MODULES };
