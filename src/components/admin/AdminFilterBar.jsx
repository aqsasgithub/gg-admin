import { useState, useEffect } from 'react';
import { Filter, X } from 'lucide-react';

/**
 * Reusable filter bar driven by a declarative `filters` config.
 *
 *   <AdminFilterBar
 *     filters={[
 *       { key: 'status', type: 'select', label: 'Status', options: [...] },
 *       { key: 'search', type: 'text',   label: 'Search', placeholder: '...' },
 *     ]}
 *     value={...}
 *     onChange={(newValue) => ...}
 *     onClear={() => ...}
 *   />
 *
 * `text` fields debounce 300ms before firing onChange to avoid hammering
 * the backend on every keystroke.
 */
export default function AdminFilterBar({ filters, value, onChange, onClear }) {
    const hasAny = Object.values(value).some((v) => v !== '' && v != null);

    return (
        <div className="flex flex-wrap items-end gap-3 px-3 py-2.5 bg-white border border-slate-200 rounded-lg">
            <Filter size={14} className="text-slate-400 mb-2.5" />
            {filters.map((f) => (
                <FilterField key={f.key} field={f}
                    value={value[f.key] ?? ''}
                    onChange={(v) => onChange({ ...value, [f.key]: v })} />
            ))}
            {hasAny && (
                <button type="button" onClick={onClear}
                    className="ml-auto inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 mb-2.5">
                    <X size={12} /> Clear
                </button>
            )}
        </div>
    );
}

function FilterField({ field, value, onChange }) {
    if (field.type === 'select') {
        return (
            <div className="min-w-[140px]">
                <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">{field.label}</label>
                <select value={value} onChange={(e) => onChange(e.target.value || undefined)}
                    className="w-full p-1.5 text-sm border border-slate-300 rounded-md">
                    <option value="">All</option>
                    {field.options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            </div>
        );
    }
    return <DebouncedText field={field} value={value} onChange={onChange} />;
}

function DebouncedText({ field, value, onChange }) {
    const [local, setLocal] = useState(value);
    useEffect(() => { setLocal(value); }, [value]);
    useEffect(() => {
        if (local === value) return;
        const t = setTimeout(() => onChange(local || undefined), 300);
        return () => clearTimeout(t);
    }, [local, onChange, value]);

    return (
        <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">{field.label}</label>
            <input value={local ?? ''} onChange={(e) => setLocal(e.target.value)}
                placeholder={field.placeholder ?? ''}
                className="w-full p-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-guardian-navy/20" />
        </div>
    );
}
