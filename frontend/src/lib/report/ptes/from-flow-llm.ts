// Map backend LLM-derived findings (the deriveFindings agent) into the report's Engagement
// Finding model. Honesty is preserved: AI-derived values carry 'inferred' provenance (never
// 'measured'); a CVSS with no score is 'estimated'. The report's existing badges render these.
import type { FindingFragmentFragment } from '@/graphql/types';

import type { FieldProvenance, Finding, FindingReference, PtesPhaseId, Provenance, RemediationWindow, Severity } from './engagement';

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
const CVSS_BY_SEVERITY: Record<Severity, number> = { critical: 9.1, high: 7.5, info: 0, low: 3.1, medium: 5.4 };
const LIKELIHOOD_BY_SEVERITY: Record<Severity, 1 | 2 | 3 | 4 | 5> = { critical: 4, high: 4, info: 1, low: 2, medium: 3 };
const IMPACT_BY_SEVERITY: Record<Severity, 1 | 2 | 3 | 4 | 5> = { critical: 5, high: 4, info: 1, low: 2, medium: 3 };
const EFFORT_BY_SEVERITY: Record<Severity, 1 | 2 | 3> = { critical: 3, high: 2, info: 1, low: 1, medium: 2 };
const WINDOW_BY_SEVERITY: Record<Severity, RemediationWindow> = {
    critical: 'Imediata',
    high: 'Imediata',
    info: 'Médio prazo',
    low: 'Médio prazo',
    medium: 'Curto prazo',
};
const ETA_BY_SEVERITY: Record<Severity, number> = { critical: 3, high: 7, info: 1, low: 5, medium: 10 };

const asSeverity = (s: string): Severity => (SEVERITIES.includes(s as Severity) ? (s as Severity) : 'info');

const clamp15 = (n: null | number | undefined, fallback: 1 | 2 | 3 | 4 | 5): 1 | 2 | 3 | 4 | 5 =>
    n != null && n >= 1 && n <= 5 ? (Math.round(n) as 1 | 2 | 3 | 4 | 5) : fallback;

const parseJSON = <T,>(s: null | string, fallback: T): T => {
    if (!s) return fallback;
    try {
        return JSON.parse(s) as T;
    } catch {
        return fallback;
    }
};

const PHASE_HINTS: { phase: PtesPhaseId; re: RegExp }[] = [
    { phase: 'post-exploitation', re: /(priv[- ]?esc|lateral|persist|post[- ]?explo|pós|domain ?admin|exfil|kerbero)/i },
    { phase: 'exploitation', re: /(explo|rce|inject|sqli|xss|ssrf|xxe|deserial|bypass|idor|payload|shell)/i },
    { phase: 'intelligence', re: /(recon|enumera|intellig|osint|scan|discovery)/i },
    { phase: 'vulnerability-analysis', re: /(vuln|cve|component|outdated|config|tls|header|misconfig)/i },
];
const phaseFromCategory = (category: null | string, hay: string): PtesPhaseId =>
    PHASE_HINTS.find((h) => h.re.test(`${category ?? ''} ${hay}`))?.phase ?? 'reporting';

const PROV_FIELDS: (keyof FieldProvenance)[] = ['severity', 'cvss', 'cwe', 'affected', 'remediation'];
const isProv = (v: unknown): v is Provenance => v === 'measured' || v === 'parsed' || v === 'inferred' || v === 'estimated';
const normProv = (raw: Record<string, unknown>): FieldProvenance => {
    const out: FieldProvenance = {};
    for (const f of PROV_FIELDS) out[f] = isProv(raw[f]) ? (raw[f] as Provenance) : 'inferred';
    return out;
};

/** Convert backend findings into the report's Finding model (LLM path; regex path is the fallback). */
export function transformLlmFindingsToEngagement(rows: FindingFragmentFragment[]): Finding[] {
    return rows.map((bf, i): Finding => {
        const sev = asSeverity(bf.severity);
        const refs = parseJSON<{ label: string; url?: string }[]>(bf.references, []);
        const provenance = normProv(parseJSON<Record<string, unknown>>(bf.provenance, {}));
        const cvssEstimated = bf.cvssScore == null;
        return {
            affected: bf.affected ?? [],
            businessImpact: bf.businessImpact ?? 'Impacto de negócio a confirmar pelo analista.',
            category: bf.category || 'Achado',
            cvss: bf.cvssScore ?? CVSS_BY_SEVERITY[sev],
            cwe: bf.cwe || '—',
            description: bf.description,
            estimatedNote: cvssEstimated
                ? 'CVSS inferido pela IA a partir da execução — calibre antes da entrega.'
                : 'Achado derivado por IA — revise antes da entrega.',
            etaDays: ETA_BY_SEVERITY[sev],
            evidence: bf.evidence ? { caption: 'Evidência (IA)', code: bf.evidence } : undefined,
            id: `F-${String(i + 1).padStart(2, '0')}`,
            impact: clamp15(bf.impact, IMPACT_BY_SEVERITY[sev]),
            likelihood: clamp15(bf.likelihood, LIKELIHOOD_BY_SEVERITY[sev]),
            phase: phaseFromCategory(bf.category, `${bf.title} ${bf.description}`),
            provenance: { ...provenance, cvss: cvssEstimated ? 'estimated' : provenance.cvss ?? 'inferred' },
            references: refs.filter((r) => r && r.label).map((r): FindingReference => ({ label: r.label, url: r.url })),
            remediation: bf.remediation ?? 'Definir e validar a correção a partir da análise do achado; reteste após a remediação.',
            remediationEffort: EFFORT_BY_SEVERITY[sev],
            remediationWindow: WINDOW_BY_SEVERITY[sev],
            severity: sev,
            sourceTaskIds: bf.sourceTaskIds ?? [],
            status: 'confirmed',
            title: bf.title || `Achado ${i + 1}`,
            vector: bf.cvssVector ?? undefined,
        };
    });
}
