// Hybrid mapping: a real Suricatoos flow (+ its tasks/subtasks) into the structured
// PTES Engagement the report engine consumes.
//
// Real data is used wherever the flow captures it (title, dates, scope from terminals,
// task results as finding evidence). Pentest-specific fields the tool does not capture
// (CVSS, CWE, calibrated severity) are filled with CLEARLY-LABELLED placeholders for the
// operator to refine — never presented as if they were measured.
import type { FlowFragmentFragment, SubtaskFragmentFragment, TaskFragmentFragment } from '@/graphql/types';

import type { Branding, Engagement, Finding, PtesPhaseId, Severity } from './engagement';

export const PLACEHOLDER_NOTE =
    '⚠️ Severidade/CVSS são estimativas iniciais geradas automaticamente a partir da execução — revise e calibre antes da entrega.';

const fmtDate = (value: unknown): string => {
    if (!value) {
        return '—';
    }
    const d = new Date(value as string);
    if (Number.isNaN(d.getTime())) {
        return String(value);
    }
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Lightweight keyword heuristic to seed a placeholder severity from free text.
const SEVERITY_HINTS: { severity: Severity; re: RegExp }[] = [
    {
        severity: 'critical',
        re: /\b(rce|remote code|execu[çc][ãa]o remota|sql ?inj|sqli|desserializ|deserializ|domain admin|domain ?admin|comprometimento total|ransom|cr[íi]tic)/i,
    },
    {
        severity: 'high',
        re: /\b(xss|ssrf|lfi|rfi|idor|auth(entication)? bypass|bypass de auth|escala[çc][ãa]o de privil[ée]gio|privilege escalation|credencial exposta|exposed credential|secret|alto)\b/i,
    },
    {
        severity: 'low',
        re: /\b(divulga[çc][ãa]o de informa|information disclosure|verbose|banner|missing header|cabe[çc]alho ausente|tlsv1\.0|baixo)\b/i,
    },
    { severity: 'info', re: /\b(informativ|informational|enumera[çc][ãa]o|recon|coleta)\b/i },
];

const CVSS_BY_SEVERITY: Record<Severity, number> = {
    critical: 9.1,
    high: 7.5,
    medium: 5.4,
    low: 3.1,
    info: 0,
};

const LIKELIHOOD_BY_SEVERITY: Record<Severity, 1 | 2 | 3 | 4 | 5> = {
    critical: 4,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
};

const IMPACT_BY_SEVERITY: Record<Severity, 1 | 2 | 3 | 4 | 5> = {
    critical: 5,
    high: 4,
    medium: 3,
    low: 2,
    info: 1,
};

// Spread derived findings across the "active" PTES phases for a coherent narrative.
const FINDING_PHASES: PtesPhaseId[] = ['vulnerability-analysis', 'exploitation', 'post-exploitation'];

const guessSeverity = (text: string): Severity => {
    for (const hint of SEVERITY_HINTS) {
        if (hint.re.test(text)) {
            return hint.severity;
        }
    }
    return 'medium';
};

const clip = (text: string, max = 900): string => {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
};

const riskScoreFromFindings = (findings: Finding[]): number => {
    if (findings.length === 0) {
        return 0;
    }
    const weight: Record<Severity, number> = { critical: 100, high: 78, medium: 52, low: 28, info: 10 };
    const top = Math.max(...findings.map((f) => weight[f.severity]));
    const avg = findings.reduce((sum, f) => sum + weight[f.severity], 0) / findings.length;
    // Bias toward the worst finding, tempered by the overall spread.
    return Math.round(top * 0.6 + avg * 0.4);
};

interface TaskLike {
    description: string;
    result: string;
    title: string;
}

const toTaskLike = (tasks: TaskFragmentFragment[]): TaskLike[] => {
    const out: TaskLike[] = [];
    for (const task of tasks) {
        const subtasks: SubtaskFragmentFragment[] = task.subtasks ?? [];
        const done = subtasks.filter((s) => s.status === 'finished' && (s.result?.trim() || s.description?.trim()));
        if (done.length > 0) {
            for (const st of done) {
                out.push({ description: st.description ?? '', result: st.result ?? '', title: st.title || task.title });
            }
        } else {
            out.push({ description: task.input ?? '', result: task.result ?? '', title: task.title });
        }
    }
    return out;
};

export interface FromFlowOptions {
    author?: string;
    classification?: string;
    contact?: string;
    version?: string;
}

/**
 * Build a complete Engagement from a flow, its tasks and the active branding.
 * Findings are derived from finished tasks/subtasks; missing pentest fields are placeholders.
 */
export function transformFlowToEngagement(
    flow: FlowFragmentFragment,
    tasks: TaskFragmentFragment[],
    branding: Branding,
    options: FromFlowOptions = {},
): Engagement {
    const sources = toTaskLike(tasks);

    const findings: Finding[] = sources.map((src, i) => {
        const haystack = `${src.title} ${src.description} ${src.result}`;
        const severity = guessSeverity(haystack);
        const body = clip(src.result || src.description || src.title);
        return {
            affected: flow.terminals?.map((t) => t.name).filter(Boolean).slice(0, 3) ?? [],
            businessImpact:
                'Impacto de negócio a confirmar pelo analista (confidencialidade, integridade ou disponibilidade dos ativos afetados).',
            category: 'Execução automatizada',
            cvss: CVSS_BY_SEVERITY[severity],
            cwe: '—',
            description: `${body}\n\n${PLACEHOLDER_NOTE}`,
            evidence: src.result?.trim() ? { caption: `Saída — ${clip(src.title, 80)}`, code: clip(src.result, 1400) } : undefined,
            id: `F-${String(i + 1).padStart(2, '0')}`,
            impact: IMPACT_BY_SEVERITY[severity],
            likelihood: LIKELIHOOD_BY_SEVERITY[severity],
            phase: FINDING_PHASES[i % FINDING_PHASES.length]!,
            references: [],
            remediation: 'Definir e validar a correção com base na análise do achado; reteste após a remediação.',
            severity,
            status: 'confirmed',
            title: clip(src.title, 120) || `Achado ${i + 1}`,
        };
    });

    // Guarantee a non-empty, honest report even when the flow produced no usable output.
    if (findings.length === 0) {
        findings.push({
            affected: flow.terminals?.map((t) => t.name).filter(Boolean) ?? [],
            businessImpact: 'A confirmar.',
            category: 'Execução automatizada',
            cvss: 0,
            cwe: '—',
            description: `Nenhum achado estruturado foi capturado automaticamente neste fluxo. ${PLACEHOLDER_NOTE}`,
            id: 'F-01',
            impact: 1,
            likelihood: 1,
            phase: 'reporting',
            references: [],
            remediation: 'Adicionar os achados manualmente a partir da análise da execução.',
            severity: 'info',
            status: 'open',
            title: 'Sem achados estruturados capturados',
        });
    }

    const attackStory = sources.slice(0, 6).map((src, i) => ({
        n: i + 1,
        phase: FINDING_PHASES[i % FINDING_PHASES.length]!,
        refs: [`F-${String(i + 1).padStart(2, '0')}`],
        text: clip(src.result || src.description || src.title, 320),
        title: clip(src.title, 60) || `Etapa ${i + 1}`,
    }));

    const riskScore = riskScoreFromFindings(findings);

    return {
        attackStory,
        author: options.author ?? `${branding.appName} — Equipe de Segurança Ofensiva`,
        branding,
        classification: options.classification ?? 'CONFIDENCIAL',
        client: branding.clientName || 'Cliente',
        contact: options.contact ?? 'security@' + branding.appName.toLowerCase().replace(/[^a-z0-9]+/g, '') + '.com',
        findings,
        methodology: [
            { activities: ['Definição de escopo, regras de engajamento e janelas de teste.'], phase: 'pre-engagement', title: 'Interações pré-engajamento' },
            { activities: ['Coleta de informações sobre os alvos e a superfície de ataque.'], phase: 'intelligence', title: 'Coleta de inteligência' },
            { activities: ['Mapeamento de ameaças e priorização de vetores.'], phase: 'threat-modeling', title: 'Modelagem de ameaças' },
            { activities: ['Identificação e validação de vulnerabilidades nos ativos em escopo.'], phase: 'vulnerability-analysis', title: 'Análise de vulnerabilidades' },
            { activities: ['Exploração controlada das vulnerabilidades confirmadas.'], phase: 'exploitation', title: 'Exploração' },
            { activities: ['Avaliação do impacto pós-comprometimento e movimentação.'], phase: 'post-exploitation', title: 'Pós-exploração' },
            { activities: ['Consolidação dos achados, plano de ação e este relatório.'], phase: 'reporting', title: 'Relatório' },
        ],
        period: { end: fmtDate(flow.updatedAt), start: fmtDate(flow.createdAt) },
        recommendations: [
            { priority: 'Imediata', text: 'Tratar os achados de maior severidade e os quick wins identificados no plano de ação.' },
            { priority: 'Curto prazo', text: 'Corrigir os achados de severidade média e revisar as configurações relacionadas.' },
            { priority: 'Médio prazo', text: 'Endereçar os achados residuais e incorporar testes recorrentes ao ciclo de segurança.' },
        ],
        riskScore,
        roe: [
            'Testes executados exclusivamente sobre os ativos em escopo.',
            'Ações potencialmente destrutivas evitadas ou previamente acordadas.',
            'Achados tratados como confidenciais entre as partes.',
        ],
        scope: {
            inScope: flow.terminals && flow.terminals.length > 0
                ? flow.terminals.map((t) => `${t.name} (${t.image})`)
                : ['Ambiente avaliado durante a execução do fluxo.'],
            outOfScope: ['Qualquer ativo não listado explicitamente no escopo.'],
        },
        summaryNarrative: [
            `Esta avaliação consolida a execução do fluxo "${flow.title}" na plataforma ${branding.appName}, no período de ${fmtDate(flow.createdAt)} a ${fmtDate(flow.updatedAt)}.`,
            `Foram derivados ${findings.length} achado(s) a partir das atividades executadas. As severidades e métricas CVSS são estimativas iniciais e devem ser calibradas pelo analista antes da entrega final ao cliente.`,
            'As seções seguintes descrevem a narrativa do ataque, a visão de risco e o plano de ação priorizado com quick wins.',
        ],
        title: `Relatório de Teste de Intrusão — ${flow.title}`,
        version: options.version ?? '1.0',
    };
}
