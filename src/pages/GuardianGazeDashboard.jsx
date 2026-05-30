import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip as RTooltip } from 'recharts';
import {
  ShieldCheck, Globe, AppWindow, Server, Cloud, FileCheck2, Activity, Radar,
  Bell, RefreshCw, ChevronDown, Building2, Sparkles, Crosshair, Boxes, Search,
  Check, AlertOctagon, Clock, Target, ListChecks, Layers, Network, Mail, Flame,
  LayoutGrid, Wrench, ShieldAlert,
} from 'lucide-react';

/* ============================================================================
   GuardianGaze dashboard — scoring engine v2.6.4 + PHP portfolio aggregator.

   TWO risk scores, both 0–100 where HIGHER = WORSE, same tier bands:
     • Company  = aggregate_portfolio(domains, 'floor_then_mean')  [PHP]
     • Domain   = overall.risk_score from POST /api/score          [engine]
   See DASHBOARD_INTEGRATION_MAP.md §5.
   ========================================================================== */

const BRAND = { navy: '#1a1f4e', primary: '#6060A6' };

const SEV = {
  critical: { c: '#c2362f', tint: '#fbe9e7', label: 'Critical' },
  high:     { c: '#dd6b4d', tint: '#fcefe8', label: 'High' },
  medium:   { c: '#c79212', tint: '#fbf3da', label: 'Medium' },
  low:      { c: '#1f9d57', tint: '#e6f5ec', label: 'Low' },
};
const TIER = {
  HEALTHY:  { c: SEV.low.c,      tint: SEV.low.tint },
  MODERATE: { c: SEV.medium.c,   tint: SEV.medium.tint },
  HIGH:     { c: SEV.high.c,     tint: SEV.high.tint },
  CRITICAL: { c: SEV.critical.c, tint: SEV.critical.tint },
  UNKNOWN:  { c: '#8d92b4',      tint: '#eef0f6' },
};
const tierFor = (risk) =>
  risk >= 75 ? 'CRITICAL' : risk >= 50 ? 'HIGH' : risk >= 25 ? 'MODERATE' : 'HEALTHY';

const ASSET = {
  critical: { c: '#7c2d2d', label: 'Critical' },
  high:     { c: '#b4531f', label: 'High' },
  medium:   { c: '#7a6a1f', label: 'Medium' },
  low:      { c: '#566', label: 'Low' },
};

const MODULES = [
  { key: 'brand_protection',     label: 'Brand Protection',     short: 'Brand',      color: '#8B5CF6', Icon: ShieldAlert },
  { key: 'domain_security',      label: 'Domain Security',      short: 'Domain',     color: '#2563EB', Icon: Globe },
  { key: 'application_security', label: 'Application Security', short: 'AppSec',     color: '#0891B2', Icon: AppWindow },
  { key: 'network_security',     label: 'Network Security',     short: 'Network',    color: '#059669', Icon: Server },
  { key: 'cloud_security',       label: 'Cloud Security',       short: 'Cloud',      color: '#0EA5E9', Icon: Cloud },
  { key: 'compliance',           label: 'Compliance',           short: 'Compliance', color: '#D97706', Icon: FileCheck2 },
];
const MOD = Object.fromEntries(MODULES.map((m) => [m.key, m]));
const WEIGHTS = { brand_protection: 0.10, domain_security: 0.15, application_security: 0.25, network_security: 0.20, cloud_security: 0.20, compliance: 0.10 };
const TIER_WEIGHTS = { critical: 4, high: 3, medium: 2, low: 1 };

const PRIORITY = {
  critical: { low: 'P2', medium: 'P1', high: 'P0_PATCH', critical: 'P0_PATCH_NOW' },
  high:     { low: 'P3', medium: 'P1', high: 'P1',       critical: 'P0_PATCH' },
  medium:   { low: 'P3', medium: 'P2', high: 'P1',       critical: 'P1' },
  low:      { low: 'P3', medium: 'P3', high: 'P2',       critical: 'P2' },
};
const PRIORITY_META = {
  P0_PATCH_NOW: { c: '#7f1d1d', label: 'P0 · now', action: 'Remediate immediately; engage on-call.' },
  P0_PATCH:     { c: SEV.critical.c, label: 'P0',   action: 'Patch within 24 hours.' },
  P1:           { c: SEV.high.c, label: 'P1',       action: 'Plan within current sprint.' },
  P2:           { c: SEV.medium.c, label: 'P2',     action: 'Plan within next sprint.' },
  P3:           { c: '#6b7099', label: 'P3',        action: 'Backlog; monitor.' },
};

/* ---------- helpers ---------- */
const round2 = (x) => Math.round(x * 100) / 100;
const rng = (seed) => { let x = seed * 9301 + 49297; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; };
const makeHistory = (end, seed, n = 14) => {
  const r = rng(seed); const out = []; let v = end + 8 + r() * 6;
  for (let i = 0; i < n; i++) { v += (r() - 0.55) * 4; out.push({ i, v: Math.max(4, Math.min(99, Math.round(v))) }); }
  out[n - 1].v = Math.round(end); return out;
};

/* ============================================================================
   mockEngineResponse() — REAL /api/score output shape (one domain)
   ========================================================================== */
function mockEngineResponse(domain, assetValue, riskBase, seed, withMitre) {
  const r = rng(seed);
  const sevPick = () => { const x = r(); return x > 0.88 ? 'critical' : x > 0.66 ? 'high' : x > 0.36 ? 'medium' : 'low'; };
  const module_scores = {};
  MODULES.forEach((m) => {
    const risk = Math.max(2, Math.min(100, round2(riskBase + (r() - 0.5) * 40)));
    const sb = { critical: 0, high: 0, medium: 0, low: 0 };
    const n = Math.round(1 + r() * 6);
    for (let k = 0; k < n; k++) sb[sevPick()]++;
    module_scores[m.key] = { status: 'checked', status_label: 'Completed', included_in_score: true, risk, active_findings: n, weight: WEIGHTS[m.key], severity_breakdown: sb, coverage_pct: round2(70 + r() * 30), last_scanned_at: null };
  });
  const risk_score = round2(MODULES.reduce((a, m) => a + module_scores[m.key].risk * WEIGHTS[m.key], 0));
  const tier = tierFor(risk_score);

  const F = {}; const setFlag = (k, p) => (F[k] = r() < p);
  const h = (k) => module_scores[k].risk / 100;
  ['spf_missing', 'spf_softfail', 'spf_lookup_risk', 'spf_multiple_records', 'dkim_missing', 'dkim_weak_key', 'dmarc_not_enforced', 'mta_sts_missing', 'tls_rpt_missing', 'dnssec_unsigned', 'mx_missing', 'mail_provider_unknown'].forEach((k) => setFlag(k, h('domain_security') * 0.7));
  ['cloud_critical_findings', 'cloud_high_findings', 'cloud_iam_misconfiguration', 'cloud_logging_missing', 'cloud_public_exposure', 'cloud_storage_misconfiguration'].forEach((k) => setFlag(k, h('cloud_security') * 0.7));
  ['cookie_security_issues', 'cors_misconfiguration', 'missing_security_headers', 'sensitive_paths_exposed', 'sri_issues', 'outdated_technology', 'subdomain_exposed'].forEach((k) => setFlag(k, h('application_security') * 0.7));
  ['legacy_tls_enabled', 'weak_cipher_suites', 'unsecure_open_ports'].forEach((k) => setFlag(k, h('network_security') * 0.7));
  ['critical_cves', 'high_cves', 'medium_cves', 'actively_exploited_cves'].forEach((k) => setFlag(k, h('application_security') * 0.6));
  ['typo_domains_registered', 'homoglyph_domains_registered', 'generated_tlds_registered', 'darkweb_findings_present', 'abuse_reports_present'].forEach((k) => setFlag(k, h('brand_protection') * 0.7));
  ['certificate_expired', 'certificate_expiring', 'domain_expired', 'domain_expiring_soon'].forEach((k) => setFlag(k, h('domain_security') * 0.4));

  const TPL = [
    ['sensitive_paths_exposed', 'application_security', 'Sensitive paths reachable', 'Block /admin & /.git at the WAF or origin.'],
    ['critical_cves', 'application_security', 'Critical CVE on internet-facing asset', 'Patch the affected component to a fixed release.'],
    ['actively_exploited_cves', 'network_security', 'Actively-exploited CVE exposed', 'Emergency-patch; isolate until remediated.'],
    ['dmarc_not_enforced', 'domain_security', 'DMARC policy not enforced (p=none)', 'Move DMARC to p=quarantine then p=reject.'],
    ['cloud_storage_misconfiguration', 'cloud_security', 'Public object storage bucket', 'Make the bucket private; block public access.'],
    ['typo_domains_registered', 'brand_protection', 'Typosquat serving login page', 'File a takedown; monitor for harvesting.'],
    ['dnssec_unsigned', 'domain_security', 'DNSSEC not enabled', 'Sign the zone and publish DS records.'],
    ['legacy_tls_enabled', 'network_security', 'Legacy TLS still accepted', 'Disable TLS 1.0/1.1; require 1.2+.'],
    ['cors_misconfiguration', 'application_security', 'Permissive CORS policy', 'Restrict Allow-Origin to trusted hosts.'],
    ['cloud_iam_misconfiguration', 'cloud_security', 'IAM principal without MFA', 'Enforce MFA on all human principals.'],
    ['missing_security_headers', 'application_security', 'Missing security headers', 'Add CSP, HSTS, X-Content-Type-Options.'],
    ['generated_tlds_registered', 'brand_protection', 'Brand TLD permutations registered', 'Defensively register high-value TLDs.'],
  ];
  const BASE = { critical: 9, high: 6, medium: 3.4, low: 2.2 };
  const SLA = { critical: 24, high: 72, medium: 240, low: 720 };
  const slaState = () => { const x = r(); return x > 0.82 ? 'breached' : x > 0.6 ? 'warning' : 'on_track'; };
  const scored = TPL.filter(() => r() > 0.18).map((t) => {
    const sev = /critical|actively|sensitive|typo/.test(t[0]) ? (r() > 0.4 ? 'critical' : 'high') : sevPick();
    return {
      finding_key: t[0], module: t[1], severity: sev, title: t[2], description: t[2], evidence: {},
      affected_asset: domain, confidence: r() > 0.3 ? 'high' : 'medium', remediation: t[3],
      base_score: BASE[sev], final_score: round2(BASE[sev] * (0.7 + r() * 0.6)),
      correlation_group: null, is_correlation_primary: true, status: 'open', source_module: t[1],
      sla: { state: slaState(), target_hours: SLA[sev], elapsed_hours: Math.round(r() * SLA[sev]) },
      matrix_cell: { severity: sev, asset_value: assetValue, priority: PRIORITY[sev][assetValue], action: PRIORITY_META[PRIORITY[sev][assetValue]].action },
      lifecycle: { first_seen: null }, mitre: [],
    };
  }).sort((a, b) => b.final_score - a.final_score);
  const top_risks = scored.slice(0, 10);

  const yAxis = ['critical', 'high', 'medium', 'low']; const xAxis = ['low', 'medium', 'high', 'critical'];
  const cells = [];
  yAxis.forEach((sev) => xAxis.forEach((av) => {
    const pri = PRIORITY[sev][av];
    const keys = av === assetValue ? scored.filter((f) => f.severity === sev).map((f) => f.finding_key) : [];
    cells.push({ severity: sev, asset_value: av, finding_count: keys.length, priority: pri, action: PRIORITY_META[pri].action, finding_keys: keys });
  }));
  const matrix_summary = cells.filter((c) => c.finding_count > 0);

  const recommendations = scored.filter((f) => ['P0_PATCH_NOW', 'P0_PATCH', 'P1'].includes(f.matrix_cell.priority)).slice(0, 6)
    .map((f) => ({ finding_key: f.finding_key, module: f.module, severity: f.severity, priority: f.matrix_cell.priority, remediation: f.remediation }));

  const completed = MODULES.reduce((a, m) => a + Math.round(module_scores[m.key].coverage_pct / 25), 0) + 13;
  const coverage = { coverage_pct: round2(Math.min(24, completed) / 24 * 100), active_modules: 6, completed_checks: Math.min(24, completed), expected_checks: 24, unavailable_modules: [], optional_modules_excluded: [] };

  const FW = [['SOC 2', 'AICPA'], ['ISO 27001', 'ISO'], ['PCI DSS', 'PCI SSC'], ['NIST CSF', 'NIST'], ['GDPR', 'EU']];
  const by_framework = FW.map(([fw, pub]) => {
    const mapped = 40 + Math.round(r() * 90);
    const violated = Math.round(mapped * (module_scores.compliance.risk / 180) * (0.5 + r()));
    const passed = mapped - violated; const pct = round2(passed / mapped * 100);
    return { framework: fw, version: null, publisher: pub, violated_count: violated, passed_count: passed, not_assessed_count: 0, partial_count: 0, mapped_count: mapped, highest_severity: violated > mapped * 0.25 ? 'critical' : violated > mapped * 0.1 ? 'high' : 'medium', risk_score: round2(violated / mapped * 100), compliance_score_pct: pct, coverage_pct: 100, failed_severity_breakdown: { critical: Math.round(violated * 0.3), high: Math.round(violated * 0.3), medium: Math.round(violated * 0.4), low: 0 }, controls: [] };
  });
  const total_mapped = by_framework.reduce((a, f) => a + f.mapped_count, 0);
  const total_violations = by_framework.reduce((a, f) => a + f.violated_count, 0);
  const total_passed = total_mapped - total_violations;
  const compliance = { scope: 'microservice', tier: tierFor(module_scores.compliance.risk), risk: module_scores.compliance.risk, compliance_score_pct: round2(total_passed / total_mapped * 100), coverage_pct: 100, total_mapped, total_passed, total_violations, total_partial: 0, total_not_assessed: 0, needs_evidence: 0, failed_severity_breakdown: { critical: Math.round(total_violations * 0.2), high: Math.round(total_violations * 0.3), medium: Math.round(total_violations * 0.4), low: Math.round(total_violations * 0.1) }, by_framework, by_module: [], coverage_heatmap: null, remediation_priorities: [], notes: [] };

  let attack_coverage = null;
  if (withMitre) {
    const TACTICS = [['TA0001', 'Initial Access'], ['TA0002', 'Execution'], ['TA0003', 'Persistence'], ['TA0005', 'Defense Evasion'], ['TA0006', 'Credential Access'], ['TA0007', 'Discovery'], ['TA0008', 'Lateral Movement'], ['TA0010', 'Exfiltration'], ['TA0011', 'Command & Control'], ['TA0040', 'Impact']];
    const by_tactic = {}; let tech = 0;
    TACTICS.forEach(([id, name]) => { const fc = Math.round(r() * r() * 9); if (fc === 0 && r() > 0.4) return; const tc = Math.max(1, Math.round(fc * 0.6)); tech += tc; by_tactic[id] = { tactic_name: name, technique_count: tc, finding_count: fc, techniques: {} }; });
    attack_coverage = { by_tactic, tactic_count: Object.keys(by_tactic).length, technique_count: tech, version: '1.0', attack_version: 'v15' };
  }

  return {
    rubric: { version: '2.1.0', content_hash: 'mock' }, domain, asset_value: assetValue, status: 'ok', generated_at: new Date().toISOString(),
    overall: { risk_score, tier, scoring_basis: '6 active modules', optional_modules_excluded: [],
      floor: F.actively_exploited_cves ? { triggered: true, floor_score: Math.max(risk_score, 75), reason: 'Actively exploited CVE on an internet-facing asset', rule_name: 'actively_exploited_internet_facing' } : { triggered: false, floor_score: null, reason: null, rule_name: null },
      executive_summary: `Risk ${risk_score} (${tier}) · ${scored.length} active findings across 6 modules.` },
    module_scores, findings: F, scored_findings: scored, top_risks, matrix_summary,
    risk_matrix: { x_axis: xAxis, y_axis: yAxis, cells }, coverage, recommendations, compliance, attack_coverage,
  };
}

/* ---------- PHP aggregate_portfolio() port (floor_then_mean) ---------- */
function aggregatePortfolio(domains) {
  const inc = domains.filter((d) => d.included !== false);
  const per = inc.map((d) => { const w = TIER_WEIGHTS[d.assetValue]; return { domain: d.domain, risk_score: round2(d.riskScore), asset_value: d.assetValue, weight: w, weighted: round2(d.riskScore * w) }; });
  const totalW = per.reduce((a, x) => a + x.weight, 0);
  const baseline = totalW ? per.reduce((a, x) => a + x.weighted, 0) / totalW : 0;
  const floors = [];
  const cc = inc.find((d) => d.assetValue === 'critical' && d.riskScore >= 75); if (cc) floors.push({ min: 75, by: cc.domain, reason: 'Critical-tier asset in CRITICAL posture (risk ≥ 75)' });
  const ch = inc.find((d) => d.assetValue === 'critical' && d.riskScore >= 50); if (ch) floors.push({ min: 60, by: ch.domain, reason: 'Critical-tier asset in HIGH or worse (risk ≥ 50)' });
  const hc = inc.find((d) => d.assetValue === 'high' && d.riskScore >= 75); if (hc) floors.push({ min: 55, by: hc.domain, reason: 'High-tier asset in CRITICAL posture (risk ≥ 75)' });
  if (inc.length && inc.filter((d) => d.riskScore >= 50).length / inc.length >= 0.30) floors.push({ min: 50, by: '__portfolio__', reason: '30%+ of portfolio in HIGH or worse (risk ≥ 50)' });
  let top = null; floors.forEach((f) => { if (!top || f.min > top.min) top = f; });
  const final = top && baseline < top.min ? top.min : baseline;
  const floored = !!(top && final > baseline);
  return { orgRiskScore: round2(final), tier: inc.length ? tierFor(final) : 'UNKNOWN', strategy: 'floor_then_mean', domainsIncluded: inc.length, domainsExcluded: domains.length - inc.length, baselineScore: round2(baseline), floorTriggeredBy: floored ? top.by : null, floorReason: floored ? `${top.reason} — baseline ${baseline.toFixed(1)} → ${top.min.toFixed(1)}` : null, perDomain: per };
}

/* ---------- view model + company builder ---------- */
function toViewModel(res, history) {
  return {
    domain: res.domain, risk: res.overall.risk_score, tier: res.overall.tier, summary: res.overall.executive_summary,
    floor: res.overall.floor, assetValue: res.asset_value, coverage: res.coverage,
    modules: MODULES.map((m) => ({ ...m, ...res.module_scores[m.key] })),
    flags: res.findings, findings: res.scored_findings, topRisks: res.top_risks, matrix: res.risk_matrix,
    recommendations: res.recommendations, compliance: res.compliance, attack: res.attack_coverage, history,
    totals: MODULES.reduce((a, m) => { const sb = res.module_scores[m.key].severity_breakdown; return { critical: a.critical + sb.critical, high: a.high + sb.high, medium: a.medium + sb.medium, low: a.low + sb.low }; }, { critical: 0, high: 0, medium: 0, low: 0 }),
  };
}
function buildCompany(name, spec) {
  const domains = spec.map((d, i) => {
    const res = mockEngineResponse(d.domain, d.av, d.risk, d.seed, d.mitre);
    return { domain: d.domain, assetValue: d.av, riskScore: res.overall.risk_score, included: true, res, vm: toViewModel(res, makeHistory(res.overall.risk_score, d.seed * 3 + i)) };
  });
  const portfolio = aggregatePortfolio(domains);
  return { name, domains, portfolio, history: makeHistory(portfolio.orgRiskScore, name.length * 31), connectors: [{ name: 'Slack', status: 'ok' }, { name: 'Jira', status: 'ok' }, { name: 'AWS', status: 'ok' }, { name: 'GCP', status: 'ok' }, { name: 'Cloudflare', status: 'ok' }] };
}

const COMPANIES = [
  buildCompany('Northwind Trading', [
    { domain: 'northwind.com', av: 'critical', risk: 41, seed: 7, mitre: true },
    { domain: 'shop.northwind.com', av: 'high', risk: 58, seed: 12 },
    { domain: 'mail.northwind.com', av: 'medium', risk: 34, seed: 19 },
    { domain: 'careers.northwind.com', av: 'low', risk: 22, seed: 26 },
  ]),
  buildCompany('Acme Robotics', [
    { domain: 'acme.io', av: 'critical', risk: 79, seed: 23, mitre: true },
    { domain: 'api.acme.io', av: 'critical', risk: 66, seed: 31 },
    { domain: 'docs.acme.io', av: 'low', risk: 28, seed: 38 },
    { domain: 'status.acme.io', av: 'medium', risk: 44, seed: 44 },
    { domain: 'go.acme.io', av: 'high', risk: 71, seed: 50 },
  ]),
  buildCompany('Helios Bank', [
    { domain: 'heliosbank.com', av: 'critical', risk: 19, seed: 41, mitre: true },
    { domain: 'secure.heliosbank.com', av: 'critical', risk: 27, seed: 47 },
    { domain: 'blog.heliosbank.com', av: 'low', risk: 33, seed: 53 },
  ]),
];

/* ============================================================================
   Animated gauge
   ========================================================================== */
function useCountUp(target, run) {
  const [val, setVal] = useState(0); const raf = useRef();
  useEffect(() => {
    cancelAnimationFrame(raf.current); const start = performance.now(), dur = 1100;
    const tick = (now) => { const t = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - t, 3); setVal(target * e); if (t < 1) raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current);
  }, [target, run]);
  return val;
}
function Gauge({ risk, tier, run, size = 210 }) {
  const STROKE = 15, PAD = 15, R = (size - STROKE) / 2 - PAD, C = size / 2, START = 135, SWEEP = 270;
  const animated = useCountUp(risk, run); const frac = animated / 100; const col = TIER[tier].c;
  const polar = (a, r = R) => { const rad = ((a - 90) * Math.PI) / 180; return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) }; };
  const arc = (from, to, r = R) => { const large = Math.abs(to - from) > 180 ? 1 : 0, s = polar(from, r), e = polar(to, r); return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`; };
  const ticks = Array.from({ length: 26 });
  const gid = useMemo(() => 'g' + Math.random().toString(36).slice(2, 6), []);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={col} stopOpacity="0.55" /><stop offset="100%" stopColor={col} /></linearGradient>
          <filter id={gid + 's'} x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="4" stdDeviation="6" floodColor={col} floodOpacity="0.28" /></filter>
        </defs>
        {ticks.map((_, i) => { const a = START + (SWEEP / (ticks.length - 1)) * i, on = i / (ticks.length - 1) <= frac, p1 = polar(a, R + 12), p2 = polar(a, R + 18); return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={on ? col : '#dfe1ee'} strokeWidth="2" strokeLinecap="round" />; })}
        <path d={arc(START, START + SWEEP)} fill="none" stroke="#ececf4" strokeWidth={STROKE} strokeLinecap="round" />
        <path d={arc(START, START + SWEEP * frac)} fill="none" stroke={`url(#${gid})`} strokeWidth={STROKE} strokeLinecap="round" filter={`url(#${gid}s)`} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 4 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 50, fontWeight: 700, lineHeight: 1, color: 'var(--ink)', letterSpacing: '-0.04em' }}>{animated.toFixed(animated < 100 ? 1 : 0)}</div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: '#fff', background: col, borderRadius: 7, padding: '2px 9px', letterSpacing: '0.04em', marginTop: 8 }}>{tier}</span>
      </div>
    </div>
  );
}

/* ---------- atoms ---------- */
function Spark({ data, color, height = 38 }) {
  const gid = useMemo(() => 'sp' + Math.random().toString(36).slice(2, 7), []);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.28} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gid})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
const SevDot = ({ sev, size = 8 }) => <span style={{ width: size, height: size, borderRadius: 999, background: SEV[sev].c, display: 'inline-block', boxShadow: `0 0 0 3px ${SEV[sev].tint}` }} />;
const AssetChip = ({ av }) => <span style={{ fontSize: 10, fontWeight: 700, color: ASSET[av].c, background: ASSET[av].c + '14', border: `1px solid ${ASSET[av].c}22`, borderRadius: 6, padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{ASSET[av].label} value</span>;
const PlatformTag = () => <span title="Computed by the PHP portfolio aggregator / persisted by the platform — not a single /score field" style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-3)', background: 'var(--canvas)', border: '1px solid var(--line)', borderRadius: 6, padding: '1px 6px', letterSpacing: '0.03em' }}>platform</span>;

function Panel({ title, subtitle, right, children, delay = 0, pad = 18, big = false, icon: Ic, style }) {
  return (
    <div className="gg-rise" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: pad, boxShadow: big ? 'var(--shadow)' : 'var(--shadow-sm)', animationDelay: `${delay}s`, display: 'flex', flexDirection: 'column', ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {Ic && <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'rgba(96,96,166,0.10)', color: 'var(--primary)' }}><Ic size={16} /></span>}
          <div>
            <h3 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, margin: 0 }}>{title}</h3>
            {subtitle && <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '1px 0 0' }}>{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

/* ---------- gauge card (company / domain) ---------- */
function GaugeCard({ kind, title, sub, risk, tier, run, history, floor, footer, accent }) {
  const KIcon = kind === 'company' ? Building2 : Globe;
  return (
    <div className="gg-rise" style={{ position: 'relative', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 22, padding: 20, boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', background: accent + '18', color: accent }}><KIcon size={17} strokeWidth={2.2} /></span>
          <div>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, fontFamily: 'var(--mono)' }}>{sub}</div>
          </div>
        </div>
        <span style={{ fontSize: 10, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{kind === 'company' ? 'Portfolio' : 'Domain'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}><Gauge risk={risk} tier={tier} run={run} /></div>
      {floor}
      <div style={{ marginTop: 'auto' }}>
        <div style={{ height: 34, marginTop: 8 }}><Spark data={history} color={TIER[tier].c} height={34} /></div>
        {footer}
      </div>
    </div>
  );
}

/* ---------- portfolio composition / domain selector ---------- */
function DomainInventory({ company, selectedIdx, onSelect }) {
  const { portfolio } = company;
  const totalWeighted = portfolio.perDomain.reduce((a, p) => a + p.weighted, 0) || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {company.domains.map((d, i) => {
        const tier = d.vm.tier; const sel = i === selectedIdx;
        const contrib = Math.round((round2(d.riskScore * TIER_WEIGHTS[d.assetValue]) / totalWeighted) * 100);
        const triggers = portfolio.floorTriggeredBy === d.domain;
        return (
          <button key={d.domain} onClick={() => onSelect(i)} className="gg-btn" style={{
            display: 'grid', gridTemplateColumns: '14px 1.5fr 92px 1fr 54px 64px', alignItems: 'center', gap: 12,
            textAlign: 'left', cursor: 'pointer', width: '100%', borderRadius: 12, padding: '10px 12px',
            border: sel ? `1px solid ${BRAND.primary}55` : '1px solid transparent',
            background: sel ? 'rgba(96,96,166,0.06)' : 'transparent', transition: 'background .15s, border-color .15s',
            boxShadow: sel ? `inset 3px 0 0 ${BRAND.primary}` : 'none' }}>
            <span style={{ width: 9, height: 9, borderRadius: 9, background: TIER[tier].c }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {d.domain}
                {triggers && <span title={portfolio.floorReason} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: SEV.critical.c, background: SEV.critical.tint, borderRadius: 5, padding: '1px 5px' }}><AlertOctagon size={9} />sets floor</span>}
              </span>
            </span>
            <span><AssetChip av={d.assetValue} /></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, height: 6, borderRadius: 9, background: 'var(--canvas)', overflow: 'hidden' }}>
                <span style={{ display: 'block', width: `${d.riskScore}%`, height: '100%', background: TIER[tier].c, borderRadius: 9 }} />
              </span>
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: TIER[tier].c, textAlign: 'right' }}>{d.riskScore}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'right' }}>{contrib}% wt</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- module card ---------- */
function ModuleCard({ m, active, onClick, idx, history }) {
  const tier = tierFor(m.risk); const tcol = TIER[tier].c;
  return (
    <button onClick={onClick} className="gg-card gg-rise" style={{ textAlign: 'left', border: active ? `1.5px solid ${m.color}` : '1px solid var(--line)', background: 'var(--card)', borderRadius: 16, padding: 16, cursor: 'pointer', animationDelay: `${0.04 * idx + 0.12}s`, boxShadow: active ? `0 12px 28px -14px ${m.color}66` : 'var(--shadow-sm)', transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: m.color + '15', color: m.color }}><m.Icon size={17} strokeWidth={2.1} /></span>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{m.label}</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 600 }}>weight {Math.round(m.weight * 100)}% · {m.coverage_pct}% cov</div>
          </div>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: tcol, background: TIER[tier].tint, borderRadius: 6, padding: '2px 7px' }}>{tier}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.03em', lineHeight: 1 }}>{m.risk}<span style={{ fontSize: 13, color: 'var(--ink-3)' }}> risk</span></div>
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', fontWeight: 600, marginTop: 3 }}>{m.active_findings} active findings</div>
        </div>
        <div style={{ width: 92, height: 38 }}><Spark data={history} color={tcol} /></div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        {['critical', 'high', 'medium', 'low'].map((s) => (
          <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--mono)', color: SEV[s].c, background: SEV[s].tint, borderRadius: 6, padding: '2px 6px' }}><span style={{ width: 5, height: 5, borderRadius: 9, background: SEV[s].c }} />{m.severity_breakdown[s]}</span>
        ))}
      </div>
    </button>
  );
}

/* ---------- attack surface ---------- */
function SurfaceGraph({ vm, runKey, highlightModule }) {
  const W = 560, H = 360; const [pos, setPos] = useState(null); const [hover, setHover] = useState(null);
  const graph = useMemo(() => {
    const r = rng(runKey + 5);
    const nodes = [{ id: 'root', label: vm.domain, kind: 'company', r: 16 }]; const links = [];
    const subs = ['app', 'www', 'mail', 'api'].slice(0, 3 + Math.round(r()));
    const domIds = subs.map((s, i) => { const id = `dom-${i}`; nodes.push({ id, label: `${s}.${vm.domain}`, kind: 'domain', r: 9 }); links.push({ s: 'root', t: id }); return id; });
    vm.findings.slice(0, 12).forEach((f, i) => { const id = `f-${i}`, did = domIds[i % domIds.length]; nodes.push({ id, label: f.title, kind: 'finding', module: f.module, sev: f.severity, r: f.severity === 'critical' ? 7 : 5 }); links.push({ s: did, t: id }); });
    return { nodes, links };
  }, [vm, runKey]);
  useEffect(() => {
    const r = rng(runKey + 3);
    const nodes = graph.nodes.map((n) => ({ ...n, x: W / 2 + (r() - 0.5) * 240, y: H / 2 + (r() - 0.5) * 190, vx: 0, vy: 0, fixed: n.kind === 'company' }));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n])); const links = graph.links.map((l) => ({ s: byId[l.s], t: byId[l.t] }));
    let alpha = 1, frame;
    const step = () => {
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const a = nodes[i], b = nodes[j]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy || 0.01; const f = (2500 / d2) * alpha, d = Math.sqrt(d2), ux = dx / d, uy = dy / d; a.vx += ux * f; a.vy += uy * f; b.vx -= ux * f; b.vy -= uy * f; }
      links.forEach(({ s, t }) => { const tgt = s.kind === 'company' ? 90 : 62; let dx = t.x - s.x, dy = t.y - s.y; const d = Math.sqrt(dx * dx + dy * dy) || 0.01, f = (d - tgt) * 0.045 * alpha, ux = dx / d, uy = dy / d; s.vx += ux * f; s.vy += uy * f; t.vx -= ux * f; t.vy -= uy * f; });
      nodes.forEach((n) => { n.vx += (W / 2 - n.x) * 0.006 * alpha; n.vy += (H / 2 - n.y) * 0.006 * alpha; if (n.fixed) { n.x = W / 2; n.y = H / 2; n.vx = 0; n.vy = 0; return; } n.vx *= 0.86; n.vy *= 0.86; n.x += n.vx; n.y += n.vy; n.x = Math.max(24, Math.min(W - 24, n.x)); n.y = Math.max(24, Math.min(H - 24, n.y)); });
      alpha *= 0.974; setPos({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ s: l.s.id, t: l.t.id })) });
      if (alpha > 0.02) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step); return () => cancelAnimationFrame(frame);
  }, [graph, runKey]);
  if (!pos) return <div style={{ height: H }} />;
  const byId = Object.fromEntries(pos.nodes.map((n) => [n.id, n]));
  const colorOf = (n) => n.kind === 'company' ? BRAND.navy : n.kind === 'domain' ? BRAND.primary : SEV[n.sev].c;
  const dim = (n) => highlightModule && n.kind === 'finding' && n.module !== highlightModule;
  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {pos.links.map((l, i) => { const s = byId[l.s], t = byId[l.t]; return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={BRAND.navy} strokeOpacity={dim(t) ? 0.04 : 0.12} strokeWidth="1.2" />; })}
        {pos.nodes.map((n) => {
          const col = colorOf(n), faded = dim(n), isC = n.kind === 'finding' && n.sev === 'critical';
          return (
            <g key={n.id} opacity={faded ? 0.25 : 1} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
              {isC && <circle cx={n.x} cy={n.y} r={n.r + 6} fill={col} opacity="0.16"><animate attributeName="r" values={`${n.r + 3};${n.r + 9};${n.r + 3}`} dur="2.2s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.22;0.05;0.22" dur="2.2s" repeatCount="indefinite" /></circle>}
              <circle cx={n.x} cy={n.y} r={n.r + 3} fill="#fff" /><circle cx={n.x} cy={n.y} r={n.r} fill={col} stroke="#fff" strokeWidth="1.5" />
              {n.kind !== 'finding' && <text x={n.x} y={n.y + n.r + 13} textAnchor="middle" style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 600 }} fill="var(--ink-2)">{n.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover && <div style={{ position: 'absolute', left: `${(byId[hover.id].x / W) * 100}%`, top: `${(byId[hover.id].y / H) * 100}%`, transform: 'translate(-50%, -135%)', background: 'var(--ink)', color: '#fff', borderRadius: 9, padding: '7px 10px', fontSize: 11.5, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5, boxShadow: '0 10px 24px -8px rgba(20,22,48,0.5)' }}>
        <div style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{hover.label}</div>
        <div style={{ opacity: 0.7, fontSize: 10.5, marginTop: 1, textTransform: 'capitalize' }}>{hover.kind === 'finding' ? `${hover.sev} · ${MOD[hover.module]?.label}` : hover.kind}</div>
      </div>}
    </div>
  );
}

/* ---------- compliance ---------- */
function ComplianceBars({ compliance }) {
  const tone = (pct) => (pct >= 90 ? SEV.low : pct >= 70 ? SEV.medium : SEV.critical);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {compliance.by_framework.map((f) => { const pct = f.compliance_score_pct, t = tone(pct); return (
        <div key={f.framework}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{f.framework}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{f.passed_count}/{f.mapped_count}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: SEV[f.highest_severity].c, background: SEV[f.highest_severity].tint, borderRadius: 6, padding: '2px 6px' }}>{f.violated_count} failed</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--ink)', width: 44, textAlign: 'right' }}>{pct}%</span>
            </span>
          </div>
          <div style={{ height: 7, borderRadius: 9, background: 'var(--canvas)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', borderRadius: 9, background: `linear-gradient(90deg, ${t.c}aa, ${t.c})`, transition: 'width .8s ease' }} /></div>
        </div>
      ); })}
    </div>
  );
}

/* ---------- DNS posture ---------- */
const DNS_STATE = { pass: SEV.low, warn: SEV.medium, fail: SEV.critical };
function DnsGrid({ flags }) {
  const COLS = [
    ['SPF', () => flags.spf_missing ? 'fail' : (flags.spf_softfail || flags.spf_lookup_risk || flags.spf_multiple_records) ? 'warn' : 'pass'],
    ['DKIM', () => flags.dkim_missing ? 'fail' : flags.dkim_weak_key ? 'warn' : 'pass'],
    ['DMARC', () => flags.dmarc_not_enforced ? 'fail' : 'pass'],
    ['MTA-STS', () => flags.mta_sts_missing ? 'warn' : 'pass'],
    ['TLS-RPT', () => flags.tls_rpt_missing ? 'warn' : 'pass'],
    ['DNSSEC', () => flags.dnssec_unsigned ? 'fail' : 'pass'],
    ['MX', () => flags.mx_missing ? 'fail' : 'pass'],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
      {COLS.map(([label, fn]) => { const s = fn(), st = DNS_STATE[s]; return (
        <div key={label} style={{ textAlign: 'center' }}>
          <div style={{ margin: '0 auto', width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', background: st.tint, color: st.c, fontWeight: 800, fontSize: 16 }}>{s === 'pass' ? '✓' : s === 'warn' ? '!' : '✕'}</div>
          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--ink-3)', marginTop: 6 }}>{label}</div>
        </div>
      ); })}
    </div>
  );
}

/* ---------- top risks ---------- */
function TopRisks({ items }) {
  const max = Math.max(...items.map((i) => i.final_score), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {items.slice(0, 6).map((it, idx) => { const mod = MOD[it.module]; return (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', width: 14 }}>{idx + 1}</span>
          <SevDot sev={it.severity} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</div>
            <div style={{ height: 4, borderRadius: 9, background: 'var(--canvas)', marginTop: 4, overflow: 'hidden' }}><div style={{ width: `${(it.final_score / max) * 100}%`, height: '100%', background: SEV[it.severity].c, borderRadius: 9 }} /></div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: mod.color, background: mod.color + '14', borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap' }}>{mod.short}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: SEV[it.severity].c, width: 36, textAlign: 'right' }}>{it.final_score.toFixed(1)}</span>
        </div>
      ); })}
    </div>
  );
}

/* ---------- priority matrix ---------- */
function PriorityMatrix({ matrix }) {
  const { x_axis, y_axis, cells } = matrix;
  const get = (sev, av) => cells.find((c) => c.severity === sev && c.asset_value === av);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '52px repeat(4, 1fr)', gap: 6, alignItems: 'center' }}>
        <div />{x_axis.map((av) => <div key={av} style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'capitalize' }}>{av}</div>)}
        {y_axis.map((sev) => (
          <React.Fragment key={sev}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'capitalize', textAlign: 'right', paddingRight: 4 }}>{sev}</div>
            {x_axis.map((av) => { const c = get(sev, av), pm = PRIORITY_META[c.priority], has = c.finding_count > 0; return (
              <div key={av} title={`${pm.label} — ${pm.action}`} style={{ aspectRatio: '1.7', borderRadius: 9, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: has ? pm.c : 'var(--canvas)', border: '1px solid var(--line)', color: has ? '#fff' : 'var(--ink-3)' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: has ? 15 : 12, fontWeight: 700 }}>{has ? c.finding_count : '·'}</span>
                {has && <span style={{ fontSize: 8, fontWeight: 700, opacity: 0.9 }}>{pm.label}</span>}
              </div>
            ); })}
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9.5, color: 'var(--ink-3)' }}><span>↑ severity</span><span>asset value →</span></div>
    </div>
  );
}

/* ---------- SLA posture ---------- */
function SlaPosture({ findings }) {
  const counts = { on_track: 0, warning: 0, breached: 0 };
  findings.forEach((f) => { counts[f.sla.state]++; });
  const total = findings.length || 1;
  const META = { breached: { c: SEV.critical.c, label: 'Breached' }, warning: { c: SEV.medium.c, label: 'Warning' }, on_track: { c: SEV.low.c, label: 'On track' } };
  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 9, overflow: 'hidden', background: 'var(--canvas)', marginBottom: 12 }}>
        {['breached', 'warning', 'on_track'].map((k) => counts[k] ? <div key={k} style={{ width: `${(counts[k] / total) * 100}%`, background: META[k].c }} /> : null)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {['breached', 'warning', 'on_track'].map((k) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 9, height: 9, borderRadius: 9, background: META[k].c }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', flex: 1 }}>{META[k].label}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{counts[k]}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10.5, color: 'var(--ink-3)', margin: '12px 0 0', lineHeight: 1.4 }}>From <code style={{ fontFamily: 'var(--mono)' }}>scored_findings[].sla.state</code>.</p>
    </div>
  );
}

/* ---------- recommendations ---------- */
function Recommendations({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {items.map((it, i) => { const mod = MOD[it.module], pm = PRIORITY_META[it.priority]; return (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < items.length - 1 ? '1px solid var(--line)' : 'none' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 700, color: '#fff', background: pm.c, borderRadius: 6, padding: '2px 6px', marginTop: 1, whiteSpace: 'nowrap' }}>{pm.label}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', fontWeight: 600 }}>{it.remediation}</div>
            <div style={{ fontSize: 10.5, color: mod.color, fontWeight: 700, marginTop: 2 }}>{mod.label}</div>
          </div>
        </div>
      ); })}
    </div>
  );
}

/* ---------- MITRE ---------- */
function MitrePanel({ attack }) {
  if (!attack || !attack.by_tactic || !Object.keys(attack.by_tactic).length) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
      <Target size={22} style={{ opacity: 0.5 }} /><p style={{ fontSize: 12.5, margin: '10px 0 0', maxWidth: 280 }}>MITRE mapping not enabled for this scan. Supply the mapping to populate <code style={{ fontFamily: 'var(--mono)' }}>attack_coverage</code>.</p>
    </div>
  );
  const tactics = Object.entries(attack.by_tactic).map(([id, t]) => ({ id, ...t }));
  const max = Math.max(...tactics.map((t) => t.finding_count), 1);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {tactics.map((t) => { const intensity = t.finding_count / max, bg = t.finding_count === 0 ? 'var(--canvas)' : `rgba(96,96,166,${0.12 + intensity * 0.78})`, fg = intensity > 0.5 ? '#fff' : 'var(--ink-2)'; return (
          <div key={t.id} title={`${t.tactic_name}: ${t.finding_count} findings · ${t.technique_count} techniques`} style={{ background: bg, borderRadius: 10, padding: '9px 8px', minHeight: 56, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--line)' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: fg, lineHeight: 1.15 }}>{t.tactic_name}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: fg }}>{t.finding_count}</span>
          </div>
        ); })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 11, color: 'var(--ink-3)' }}>
        <span>{attack.technique_count} techniques · ATT&CK {attack.attack_version}</span><div style={{ flex: 1 }} /><span>Less</span>
        <div style={{ width: 90, height: 7, borderRadius: 9, background: `linear-gradient(90deg, var(--canvas), ${BRAND.primary})` }} /><span>More</span>
      </div>
    </div>
  );
}

/* ---------- threat tiles ---------- */
function ThreatTiles({ flags }) {
  const tiles = [
    { label: 'Dark-web exposure', on: flags.darkweb_findings_present, Icon: Search, sev: 'critical' },
    { label: 'Typosquat domains', on: flags.typo_domains_registered || flags.homoglyph_domains_registered, Icon: Crosshair, sev: 'high' },
    { label: 'Brand TLD permutations', on: flags.generated_tlds_registered, Icon: Globe, sev: 'medium' },
    { label: 'Abuse reports', on: flags.abuse_reports_present, Icon: AlertOctagon, sev: 'high' },
    { label: 'Cert expiring / expired', on: flags.certificate_expiring || flags.certificate_expired, Icon: Clock, sev: flags.certificate_expired ? 'critical' : 'medium' },
    { label: 'Domain expiring / expired', on: flags.domain_expiring_soon || flags.domain_expired, Icon: Clock, sev: flags.domain_expired ? 'critical' : 'medium' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      {tiles.map((t) => { const sv = t.on ? SEV[t.sev] : SEV.low; return (
        <div key={t.label} style={{ background: 'var(--canvas)', borderRadius: 12, padding: 11, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: t.on ? sv.tint : SEV.low.tint, color: t.on ? sv.c : SEV.low.c }}><t.Icon size={15} /></span>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>{t.label}</div><div style={{ fontSize: 11, fontWeight: 700, color: t.on ? sv.c : SEV.low.c }}>{t.on ? 'Detected' : 'Clear'}</div></div>
        </div>
      ); })}
    </div>
  );
}

/* ---------- connector strip ---------- */
function ConnectorStrip({ connectors, scans }) {
  const dot = { ok: SEV.low.c, sync: SEV.medium.c, error: SEV.critical.c };
  return (
    <div className="gg-rise" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '12px 16px', boxShadow: 'var(--shadow-sm)', animationDelay: '0.1s' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Connectors</span><PlatformTag />
      {connectors.map((c) => (
        <span key={c.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}><span style={{ width: 7, height: 7, borderRadius: 9, background: dot[c.status] }} />{c.name}</span>
      ))}
      <div style={{ flex: 1 }} />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}><Activity size={14} color="var(--primary)" /> {scans} scans / 24h · queue healthy</span>
    </div>
  );
}

const TrendTip = ({ active, payload }) => active && payload?.length ? <div style={{ background: 'var(--ink)', color: '#fff', borderRadius: 8, padding: '5px 9px', fontSize: 11.5, fontFamily: 'var(--mono)', fontWeight: 700 }}>{payload[0].value}</div> : null;

/* ---------- dropdown ---------- */
function Dropdown({ icon: Ic, label, sub, items, activeIdx, onPick, render }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button className="gg-btn" onClick={() => setOpen((o) => !o)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 11, padding: '8px 12px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', color: 'var(--ink)' }}>
        <Ic size={15} color="var(--ink-3)" /><span style={{ fontWeight: 700, fontSize: 13 }}>{label}</span>
        {sub && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{sub}</span>}
        <ChevronDown size={15} color="var(--ink-3)" />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, boxShadow: 'var(--shadow)', padding: 6, minWidth: 248 }}>
          {items.map((it, i) => (
            <button key={i} className="gg-btn" onClick={() => { onPick(i); setOpen(false); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10, background: i === activeIdx ? 'var(--canvas)' : 'transparent', border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: 'var(--ink)', fontSize: 13, fontWeight: 600 }}>
              {render(it)}{i === activeIdx && <Check size={14} color="var(--primary)" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   Main
   ========================================================================== */
export default function GuardianGazeDashboard() {
  const [companyIdx, setCompanyIdx] = useState(0);
  const company = COMPANIES[companyIdx];
  const defaultDomain = useMemo(() => company.domains.reduce((m, d, i, arr) => (d.riskScore > arr[m].riskScore ? i : m), 0), [company]);
  const [domainIdx, setDomainIdx] = useState(defaultDomain);
  const [run, setRun] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [activeModule, setActiveModule] = useState(null);

  const dom = company.domains[Math.min(domainIdx, company.domains.length - 1)];
  const vm = dom.vm; const pf = company.portfolio;

  const runScan = useCallback(() => { setScanning(true); setRun((x) => x + 1); setTimeout(() => setScanning(false), 1300); }, []);
  const switchCompany = (i) => { setCompanyIdx(i); const c = COMPANIES[i]; const dd = c.domains.reduce((m, d, idx, arr) => (d.riskScore > arr[m].riskScore ? idx : m), 0); setDomainIdx(dd); setActiveModule(null); setRun((x) => x + 1); };
  const selectDomain = (i) => { setDomainIdx(i); setActiveModule(null); setRun((x) => x + 1); };

  const stats = [
    { label: 'Scan coverage', value: `${vm.coverage.coverage_pct}%`, sub: `${vm.coverage.completed_checks}/${vm.coverage.expected_checks} checks`, Icon: ListChecks },
    { label: 'Active findings', value: vm.findings.length, sub: `${vm.totals.critical} critical · ${vm.totals.high} high`, Icon: Radar },
    { label: 'Asset value', value: dom.assetValue, sub: 'auto-classified', Icon: Boxes, cap: true },
    { label: 'Compliance', value: `${vm.compliance.compliance_score_pct}%`, sub: `${vm.compliance.total_violations} violations`, Icon: FileCheck2 },
  ];

  return (
    <div style={{ fontFamily: 'var(--body)', color: 'var(--ink)', background: 'var(--canvas)', minHeight: '100%', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap');
        :root{ --canvas:#f5f6fb; --card:#ffffff; --ink:#16183a; --ink-2:#43476e; --ink-3:#8d92b4; --line:#e9eaf3; --primary:${BRAND.primary}; --navy:${BRAND.navy};
          --display:'Bricolage Grotesque', sans-serif; --body:'Hanken Grotesk', sans-serif; --mono:'JetBrains Mono', ui-monospace, monospace;
          --shadow-sm:0 1px 2px rgba(22,24,58,.04), 0 8px 24px -16px rgba(22,24,58,.18); --shadow:0 1px 2px rgba(22,24,58,.05), 0 22px 48px -24px rgba(22,24,58,.22); }
        *{box-sizing:border-box}
        .gg-card:hover{ transform:translateY(-2px); }
        .gg-rise{ opacity:0; animation:ggRise .55s cubic-bezier(.2,.7,.3,1) forwards; }
        @keyframes ggRise{ from{opacity:0; transform:translateY(10px)} to{opacity:1; transform:translateY(0)} }
        .gg-btn{ font-family:var(--body); } .gg-spin{ animation:ggSpin 1s linear infinite; } @keyframes ggSpin{ to{ transform:rotate(360deg) } }
        .gg-feed::-webkit-scrollbar{ width:6px } .gg-feed::-webkit-scrollbar-thumb{ background:var(--line); border-radius:9px } code{ font-size:.92em }
      `}</style>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `radial-gradient(900px 420px at 12% -8%, ${BRAND.primary}14, transparent 60%), radial-gradient(700px 360px at 96% 4%, ${BRAND.navy}0e, transparent 55%)` }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5, backgroundImage: `radial-gradient(var(--line) 1px, transparent 1px)`, backgroundSize: '26px 26px', maskImage: 'linear-gradient(#000, transparent 70%)' }} />

      <div style={{ position: 'relative', maxWidth: 1240, margin: '0 auto', padding: '22px 26px 40px' }}>
        {/* top bar */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 11, background: BRAND.navy, display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-sm)' }}><ShieldCheck size={20} color="#fff" strokeWidth={2.2} /></span>
            <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', color: 'var(--ink)' }}>GuardianGaze</span>
          </div>
          <Dropdown icon={Building2} label={company.name} items={COMPANIES} activeIdx={companyIdx} onPick={switchCompany}
            render={(c) => <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: 9, background: TIER[c.portfolio.tier].c }} />{c.name}<span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{c.portfolio.orgRiskScore}</span></span>} />
          <Dropdown icon={Globe} label={dom.domain} sub={`${domainIdx + 1}/${company.domains.length}`} items={company.domains} activeIdx={domainIdx} onPick={selectDomain}
            render={(d) => <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 7, height: 7, borderRadius: 9, background: TIER[d.vm.tier].c }} /><span style={{ fontFamily: 'var(--mono)' }}>{d.domain}</span></span>} />
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ink-3)', fontSize: 12, fontWeight: 600 }}><Activity size={14} /> Last scan 2m ago</div>
          <button className="gg-btn" style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--card)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', cursor: 'pointer', position: 'relative', boxShadow: 'var(--shadow-sm)' }}>
            <Bell size={16} color="var(--ink-2)" /><span style={{ position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 9, background: SEV.critical.c, boxShadow: '0 0 0 2px var(--card)' }} />
          </button>
          <button className="gg-btn" onClick={runScan} disabled={scanning} style={{ display: 'flex', alignItems: 'center', gap: 8, background: BRAND.navy, color: '#fff', border: 'none', borderRadius: 11, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: scanning ? 'default' : 'pointer', boxShadow: `0 10px 24px -10px ${BRAND.navy}99`, opacity: scanning ? 0.85 : 1 }}>
            <RefreshCw size={15} className={scanning ? 'gg-spin' : ''} />{scanning ? 'Scoring…' : 'Run scan'}
          </button>
        </header>

        {/* dual gauges + composition */}
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.15fr', gap: 16, marginBottom: 16 }}>
          <GaugeCard kind="company" title={company.name} sub={`portfolio · ${pf.strategy}`} risk={pf.orgRiskScore} tier={pf.tier} run={run} history={company.history} accent={BRAND.navy}
            floor={pf.floorTriggeredBy && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 10.5, fontWeight: 700, color: SEV.critical.c, background: SEV.critical.tint, borderRadius: 8, padding: '5px 9px', justifyContent: 'center', textAlign: 'center' }}><AlertOctagon size={12} /> Floor raised by {pf.floorTriggeredBy === '__portfolio__' ? 'broad degradation' : pf.floorTriggeredBy}</div>}
            footer={<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-3)', fontWeight: 600, marginTop: 6 }}><span>{pf.domainsIncluded} domains</span><span>baseline <b style={{ color: 'var(--ink-2)', fontFamily: 'var(--mono)' }}>{pf.baselineScore}</b></span></div>} />

          <GaugeCard kind="domain" title={dom.domain} sub={`asset value: ${dom.assetValue}`} risk={vm.risk} tier={vm.tier} run={run} history={vm.history} accent={BRAND.primary}
            floor={vm.floor.triggered && <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 10.5, fontWeight: 700, color: SEV.critical.c, background: SEV.critical.tint, borderRadius: 8, padding: '5px 9px', justifyContent: 'center', textAlign: 'center' }}><AlertOctagon size={12} /> Floor: {vm.floor.rule_name}</div>}
            footer={<p style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', margin: '6px 2px 0', lineHeight: 1.35 }}>{vm.summary}</p>} />

          <Panel title="Portfolio composition" subtitle={`${pf.domainsIncluded} domains · weighted by asset value`} delay={0.05} icon={Layers} big
            right={<PlatformTag />}>
            <DomainInventory company={company} selectedIdx={Math.min(domainIdx, company.domains.length - 1)} onSelect={selectDomain} />
          </Panel>
        </section>

        {/* stat tiles for selected domain */}
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
          {stats.map((s, i) => (
            <div key={s.label} className="gg-card gg-rise" style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 16, boxShadow: 'var(--shadow-sm)', animationDelay: `${0.05 * i + 0.05}s`, transition: 'transform .18s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'rgba(96,96,166,0.10)', color: 'var(--primary)' }}><s.Icon size={15} /></span>
                <span style={{ fontSize: 9.5, color: 'var(--ink-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>domain</span>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.03em', marginTop: 12, lineHeight: 1, textTransform: s.cap ? 'capitalize' : 'none' }}>{s.value}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginTop: 6 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{s.sub}</div>
            </div>
          ))}
        </section>

        <div style={{ marginBottom: 16 }}><ConnectorStrip connectors={company.connectors} scans={18 + (companyIdx + 1) * 7} /></div>

        {/* module cards */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 2px 12px' }}>
          <h2 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15, margin: 0 }}>Security modules <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>· {dom.domain}</span></h2>
          {activeModule && <button className="gg-btn" onClick={() => setActiveModule(null)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>Clear filter ✕</button>}
        </div>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
          {vm.modules.map((m, i) => <ModuleCard key={m.key} m={m} idx={i} history={makeHistory(m.risk, m.risk * 13 + i)} active={activeModule === m.key} onClick={() => setActiveModule((a) => (a === m.key ? null : m.key))} />)}
        </section>

        {/* attack surface + findings */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16 }}>
          <Panel title="Attack surface" subtitle={`Findings on ${dom.domain}${activeModule ? ` · ${MOD[activeModule].label}` : ''}`} delay={0.3} big icon={Network}
            right={<div style={{ display: 'flex', gap: 12 }}>{[['Domain', BRAND.primary], ['Asset', BRAND.navy], ['Critical', SEV.critical.c]].map(([l, c]) => <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}><span style={{ width: 8, height: 8, borderRadius: 9, background: c }} />{l}</span>)}</div>}>
            <SurfaceGraph vm={vm} runKey={run + companyIdx * 100 + domainIdx} highlightModule={activeModule} />
          </Panel>
          <Panel title="Findings" subtitle="Sorted by score" delay={0.35} big icon={Radar}>
            <div style={{ display: 'flex', height: 8, borderRadius: 9, overflow: 'hidden', margin: '0 0 12px', background: 'var(--canvas)' }}>
              {['critical', 'high', 'medium', 'low'].map((s) => vm.totals[s] ? <div key={s} title={`${SEV[s].label}: ${vm.totals[s]}`} style={{ width: `${(vm.totals[s] / (vm.findings.length || 1)) * 100}%`, background: SEV[s].c }} /> : null)}
            </div>
            <div className="gg-feed" style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', maxHeight: 300, margin: '0 -6px', paddingRight: 4 }}>
              {vm.findings.filter((f) => !activeModule || f.module === activeModule).map((f, i) => { const mod = MOD[f.module], slaC = { breached: SEV.critical.c, warning: SEV.medium.c, on_track: SEV.low.c }[f.sla.state]; return (
                <div key={i} className="gg-rise" style={{ display: 'flex', gap: 11, padding: '10px 8px', borderRadius: 11, alignItems: 'flex-start' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--canvas)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ marginTop: 4 }}><SevDot sev={f.severity} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{f.title}</div><div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.affected_asset}</div></div>
                  <div style={{ textAlign: 'right' }}><span style={{ fontSize: 10, fontWeight: 700, color: mod.color, background: mod.color + '14', borderRadius: 6, padding: '2px 6px' }}>{mod.short}</span><div style={{ fontSize: 9.5, color: slaC, marginTop: 3, fontFamily: 'var(--mono)', fontWeight: 700, textTransform: 'capitalize' }}>{f.sla.state.replace('_', ' ')}</div></div>
                </div>
              ); })}
            </div>
          </Panel>
        </section>

        {/* compliance + DNS/threat */}
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <Panel title="Compliance readiness" subtitle={`${vm.compliance.scope} · ${vm.compliance.total_passed}/${vm.compliance.total_mapped} passed`} delay={0.4} icon={ShieldCheck}>
            <ComplianceBars compliance={vm.compliance} />
          </Panel>
          <Panel title="Email & DNS posture" subtitle="From engine signal flags" delay={0.42} icon={Mail}
            right={<span style={{ display: 'flex', gap: 10 }}>{[['pass', '✓'], ['warn', '!'], ['fail', '✕']].map(([k, g]) => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}><span style={{ width: 16, height: 16, borderRadius: 5, display: 'grid', placeItems: 'center', background: DNS_STATE[k].tint, color: DNS_STATE[k].c, fontWeight: 800, fontSize: 10 }}>{g}</span>{DNS_STATE[k].label}</span>)}</span>}>
            <DnsGrid flags={vm.flags} />
            <div style={{ height: 14 }} />
            <h4 style={{ fontFamily: 'var(--display)', fontSize: 12.5, fontWeight: 700, margin: '4px 0 10px', color: 'var(--ink-2)' }}>Threat & domain exposure</h4>
            <ThreatTiles flags={vm.flags} />
          </Panel>
        </section>

        {/* top risks + matrix + sla */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr 1fr', gap: 16, marginTop: 16 }}>
          <Panel title="Top risk contributors" subtitle="Ranked by final_score" delay={0.46} icon={Flame}><TopRisks items={vm.topRisks} /></Panel>
          <Panel title="Priority matrix" subtitle="Severity × asset value" delay={0.5} icon={LayoutGrid}><PriorityMatrix matrix={vm.matrix} /></Panel>
          <Panel title="SLA posture" subtitle="Remediation windows" delay={0.54} icon={Clock}><SlaPosture findings={vm.findings} /></Panel>
        </section>

        {/* MITRE + recommendations */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginTop: 16 }}>
          <Panel title="MITRE ATT&CK exposure" subtitle="Findings mapped to tactics (attack_coverage)" delay={0.58} big icon={Target}><MitrePanel attack={vm.attack} /></Panel>
          <Panel title="Recommended actions" subtitle="Engine-ranked remediation" delay={0.62} icon={Wrench}><Recommendations items={vm.recommendations} /></Panel>
        </section>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--ink-3)', marginTop: 22 }}>
          Company = aggregate_portfolio(floor_then_mean) · Domain = /api/score · both 0–100, higher = worse · v2.6.4
        </p>
      </div>
    </div>
  );
}
