import { describe, expect, it } from 'vitest';

import type { Finding } from './engagement';
import { actionItems, affectedHostsRoster, riskCellColor, riskRating, severityCounts, topVulnerabilities } from './theme';

const mk = (o: Partial<Finding>): Finding => ({
    affected: [],
    businessImpact: '',
    category: 'Web',
    cvss: 1,
    cwe: '—',
    description: '',
    id: 'T-1',
    impact: 1,
    likelihood: 1,
    phase: 'reporting',
    references: [],
    remediation: '',
    severity: 'low',
    status: 'confirmed',
    title: 't',
    ...o,
});

describe('riskRating', () => {
    it('maps score to the right band at the boundaries', () => {
        expect(riskRating(80).label).toBe('CRÍTICO');
        expect(riskRating(79).label).toBe('ALTO');
        expect(riskRating(60).label).toBe('ALTO');
        expect(riskRating(59).label).toBe('MÉDIO');
        expect(riskRating(40).label).toBe('MÉDIO');
        expect(riskRating(39).label).toBe('BAIXO');
        expect(riskRating(20).label).toBe('BAIXO');
        expect(riskRating(19).label).toBe('INFORMATIVO');
        expect(riskRating(0).label).toBe('INFORMATIVO');
    });
});

describe('riskCellColor', () => {
    it('bins likelihood×impact into severity colors', () => {
        expect(riskCellColor(5, 4)).toBe('#B91C1C'); // 20 -> critical
        expect(riskCellColor(4, 3)).toBe('#EA580C'); // 12 -> high
        expect(riskCellColor(3, 2)).toBe('#D97706'); // 6  -> medium
        expect(riskCellColor(3, 1)).toBe('#2563EB'); // 3  -> low
        expect(riskCellColor(1, 1)).toBe('#64748B'); // 1  -> info
    });
});

describe('topVulnerabilities', () => {
    it('orders by severity rank then CVSS desc, and respects the limit', () => {
        const fs = [
            mk({ id: 'a', severity: 'low', cvss: 9.9 }),
            mk({ id: 'b', severity: 'critical', cvss: 5 }),
            mk({ id: 'c', severity: 'high', cvss: 8 }),
            mk({ id: 'd', severity: 'critical', cvss: 9 }),
        ];
        expect(topVulnerabilities(fs).map((f) => f.id)).toEqual(['d', 'b', 'c', 'a']);
        expect(topVulnerabilities(fs, 2).map((f) => f.id)).toEqual(['d', 'b']);
    });
});

describe('affectedHostsRoster', () => {
    it('aggregates one row per (finding × distinct endpoint), severity-ordered, deduped', () => {
        const fs = [
            mk({ id: 'a', severity: 'low', title: 'Low vuln', affected: ['10.0.0.1', '10.0.0.1'] }),
            mk({
                id: 'b',
                severity: 'critical',
                title: 'Crit vuln',
                assets: [{ host: 'api.x', port: 443, service: 'https', url: 'https://api.x/login', sourceLogIds: [] }],
            }),
        ];
        const rows = affectedHostsRoster(fs);
        expect(rows[0]!.severity).toBe('critical'); // severity-ordered
        expect(rows[0]!.url).toBe('https://api.x/login'); // asset url preferred
        // low finding: duplicate affected host collapses to a single row
        const lowRows = rows.filter((r) => r.vuln === 'Low vuln');
        expect(lowRows).toHaveLength(1);
        expect(lowRows[0]!.url).toBe('10.0.0.1');
    });
});

describe('severityCounts', () => {
    it('counts findings per severity in canonical order', () => {
        const fs = [mk({ severity: 'critical' }), mk({ severity: 'critical' }), mk({ severity: 'low' })];
        const counts = severityCounts(fs);
        const byLabel = Object.fromEntries(counts.map((c) => [c.label, c.value]));
        expect(byLabel['Crítico']).toBe(2);
        expect(byLabel['Baixo']).toBe(1);
        expect(byLabel['Alto']).toBe(0);
    });
});

describe('actionItems quickWin', () => {
    it('flags high-impact low-effort items only', () => {
        const get = (f: Finding) => actionItems([f])[0]!;
        expect(get(mk({ id: 'q1', severity: 'critical', remediationEffort: 1 })).quickWin).toBe(true);
        expect(get(mk({ id: 'q2', severity: 'high', remediationEffort: 1 })).quickWin).toBe(true);
        expect(get(mk({ id: 'q3', severity: 'low', remediationEffort: 1 })).quickWin).toBe(false); // not high/critical
        expect(get(mk({ id: 'q4', severity: 'critical', remediationEffort: 3 })).quickWin).toBe(false); // effort != 1
    });
});
