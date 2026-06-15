// Shared design tokens + chart-data derivation for the premium PTES report.
import { REMEDIATION } from './engagement';
import type { Engagement, Finding, Provenance, RemediationWindow, Severity } from './engagement';

// Book typography: a serif for running text + headings (the "book" voice), a humanist sans
// for furniture (chips, tables, headers/footers) and a mono for code/evidence. The families
// are registered in report-book-pdf.tsx; these names are the single source of truth.
export const FONT = {
    serif: 'NotoSerif',
    sans: 'NotoSans',
    mono: 'NotoSansMono',
} as const;

export const COLORS = {
    brand: '#4F46E5',
    brandDark: '#3730A3',
    coral: '#FF7678',
    ink: '#0F172A',
    slate: '#334155',
    muted: '#64748B',
    line: '#E2E8F0',
    panel: '#F4F6FB',
    paper: '#FFFFFF',
    white: '#FFFFFF',
};

export const SEVERITY: Record<Severity, { label: string; color: string; soft: string; rank: number }> = {
    critical: { label: 'Crítico', color: '#B91C1C', soft: '#FEE2E2', rank: 5 },
    high: { label: 'Alto', color: '#EA580C', soft: '#FFEDD5', rank: 4 },
    medium: { label: 'Médio', color: '#D97706', soft: '#FEF3C7', rank: 3 },
    low: { label: 'Baixo', color: '#2563EB', soft: '#DBEAFE', rank: 2 },
    info: { label: 'Info', color: '#64748B', soft: '#F1F5F9', rank: 1 },
};

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export interface ChartDatum {
    label: string;
    value: number;
    color: string;
}

export const severityCounts = (findings: Finding[]): ChartDatum[] =>
    SEVERITY_ORDER.map((s) => ({
        label: SEVERITY[s].label,
        value: findings.filter((f) => f.severity === s).length,
        color: SEVERITY[s].color,
    }));

export const categoryCounts = (findings: Finding[]): ChartDatum[] => {
    const map = new Map<string, number>();
    findings.forEach((f) => map.set(f.category, (map.get(f.category) ?? 0) + 1));
    const palette = [COLORS.brand, COLORS.coral, '#0EA5E9', '#8B5CF6', '#10B981', '#F59E0B'];
    return [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));
};

export const riskRating = (score: number): { label: string; color: string } => {
    if (score >= 80) return { label: 'CRÍTICO', color: SEVERITY.critical.color };
    if (score >= 60) return { label: 'ALTO', color: SEVERITY.high.color };
    if (score >= 40) return { label: 'MÉDIO', color: SEVERITY.medium.color };
    if (score >= 20) return { label: 'BAIXO', color: SEVERITY.low.color };
    return { label: 'INFORMATIVO', color: SEVERITY.info.color };
};

// Risk matrix cell color (likelihood 1-5 × impact 1-5).
export const riskCellColor = (likelihood: number, impact: number): string => {
    const score = likelihood * impact;
    if (score >= 17) return '#B91C1C'; // critical
    if (score >= 11) return '#EA580C'; // high
    if (score >= 6) return '#D97706'; // medium
    if (score >= 3) return '#2563EB'; // low
    return '#64748B'; // info
};

export const fmtDate = (engagement: Engagement): string =>
    `${engagement.period.start} – ${engagement.period.end}`;

// ── Action plan: effort / time-to-fix / quick wins ──────────────────────────
export const EFFORT: Record<1 | 2 | 3, { label: string; color: string }> = {
    1: { label: 'Baixo', color: '#10B981' },
    2: { label: 'Médio', color: '#F59E0B' },
    3: { label: 'Alto', color: '#EF4444' },
};

export const WINDOWS: RemediationWindow[] = ['Imediata', 'Curto prazo', 'Médio prazo'];
export const WINDOW_COLOR: Record<RemediationWindow, string> = {
    Imediata: SEVERITY.critical.color,
    'Curto prazo': SEVERITY.high.color,
    'Médio prazo': SEVERITY.low.color,
};

export interface ActionItem {
    f: Finding;
    effort: 1 | 2 | 3;
    etaDays: number;
    window: RemediationWindow;
    quickWin: boolean;
}

export const actionItems = (findings: Finding[]): ActionItem[] =>
    findings.map((f) => {
        // Real flows carry per-finding effort/eta/window (from-flow); fall back to the static
        // map only for fixtures/legacy findings that don't. (The static map is keyed F-01.. and
        // would otherwise silently override real, derived values that share those ids.)
        const fb = REMEDIATION[f.id] ?? { effort: 2 as const, etaDays: 7, window: 'Curto prazo' as const };
        const effort = f.remediationEffort ?? fb.effort;
        const etaDays = f.etaDays ?? fb.etaDays;
        const window = f.remediationWindow ?? fb.window;
        const quickWin = effort === 1 && (f.severity === 'critical' || f.severity === 'high');
        return { f, effort, etaDays, window, quickWin };
    });

export const quickWins = (findings: Finding[]): ActionItem[] => actionItems(findings).filter((a) => a.quickWin);

// ── Provenance / honesty ────────────────────────────────────────────────────
// The report must never pass a guess off as a measurement. Fields the flow could not measure
// are flagged 'estimated'/'inferred'; renderers badge them so the reader (and analyst) knows.
export const isEstimated = (p?: Provenance): boolean => p === 'estimated' || p === 'inferred';

// True when a finding's CVSS or severity is not a measured/parsed value.
export const findingIsEstimated = (f: Finding): boolean =>
    isEstimated(f.provenance?.cvss) || isEstimated(f.provenance?.severity);
