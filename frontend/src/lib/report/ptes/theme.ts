// Shared design tokens + chart-data derivation for the premium PTES report.
import { REMEDIATION } from './engagement';
import type { Engagement, Finding, RemediationWindow, Severity } from './engagement';

export const COLORS = {
    brand: '#194FE3',
    brandDark: '#0B2A7A',
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
        const r = REMEDIATION[f.id] ?? { effort: 2 as const, etaDays: 7, window: 'Curto prazo' as const };
        const quickWin = r.effort === 1 && (f.severity === 'critical' || f.severity === 'high');
        return { f, effort: r.effort, etaDays: r.etaDays, window: r.window, quickWin };
    });

export const quickWins = (findings: Finding[]): ActionItem[] => actionItems(findings).filter((a) => a.quickWin);
