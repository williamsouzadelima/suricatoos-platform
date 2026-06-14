// Build the structured PTES Engagement from a REAL Suricatoos flow.
//
// Findings, the attack narrative, affected assets and evidence are derived from the flow's
// ACTUAL data — tasks/subtasks, `report`-type message logs (per-task LLM summaries), terminal
// output, and screenshots — joined by taskId/subtaskId. Every value carries a provenance flag:
// fields are only marked "estimated" when the flow genuinely cannot measure them (e.g. a CVSS
// score that no tool emitted), so the report never passes off a guess as a measurement.
import type {
    FlowQuery,
    MessageLogFragmentFragment,
    ScreenshotFragmentFragment,
    SubtaskFragmentFragment,
    TaskFragmentFragment,
    TerminalLogFragmentFragment,
} from '@/graphql/types';
import { MessageLogType } from '@/graphql/types';

import type {
    AffectedAsset,
    Branding,
    Engagement,
    Figure,
    FieldProvenance,
    Finding,
    PtesPhaseId,
    RemediationWindow,
    Severity,
} from './engagement';

// ---------------------------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------------------------

const fmtDate = (value: unknown): string => {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const clip = (text: string, max = 900): string => {
    const clean = (text ?? '').replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
};

const key = (taskId?: null | string, subtaskId?: null | string): string =>
    subtaskId ? `${taskId ?? ''}:${subtaskId}` : `${taskId ?? ''}`;

// ---------------------------------------------------------------------------------------------
// 1. JOIN — index every log by its step (task / subtask)
// ---------------------------------------------------------------------------------------------

interface FlowJoin {
    tasksOrdered: TaskFragmentFragment[];
    reportByTask: Map<string, MessageLogFragmentFragment>; // type === Report, latest per task
    terminalByTask: Map<string, TerminalLogFragmentFragment[]>;
    screenshotsByTask: Map<string, ScreenshotFragmentFragment[]>;
}

const push = <T>(m: Map<string, T[]>, k: string, v: T): void => {
    const arr = m.get(k);
    if (arr) arr.push(v);
    else m.set(k, [v]);
};

const buildJoin = (data: FlowQuery): FlowJoin => {
    const tasksOrdered = [...(data.tasks ?? [])].sort(
        (a, b) => new Date(a.createdAt as string).getTime() - new Date(b.createdAt as string).getTime(),
    );
    const reportByTask = new Map<string, MessageLogFragmentFragment>();
    for (const log of data.messageLogs ?? []) {
        if (log.type === MessageLogType.Report && log.taskId && (log.result?.trim() || log.message?.trim())) {
            reportByTask.set(String(log.taskId), log); // later logs overwrite — keep the latest
        }
    }
    const terminalByTask = new Map<string, TerminalLogFragmentFragment[]>();
    for (const log of data.terminalLogs ?? []) {
        if (log.taskId && log.text?.trim()) push(terminalByTask, String(log.taskId), log);
    }
    const screenshotsByTask = new Map<string, ScreenshotFragmentFragment[]>();
    for (const sc of data.screenshots ?? []) {
        if (sc.taskId) push(screenshotsByTask, String(sc.taskId), sc);
    }
    return { reportByTask, screenshotsByTask, tasksOrdered, terminalByTask };
};

// ---------------------------------------------------------------------------------------------
// 2. EXTRACT — deterministic parser over real tool output (zero hallucination)
// ---------------------------------------------------------------------------------------------

interface ParsedFacts {
    cves: string[]; // CVE-YYYY-NNNN
    hosts: Set<string>; // ip / hostname
    nuclei: { matched: string; severity: Severity; templateId: string }[];
    ports: { host?: string; port: number; service?: string }[];
    urls: string[];
}

const SEVERITY_WORDS: Record<string, Severity> = {
    critical: 'critical',
    high: 'high',
    info: 'info',
    informational: 'info',
    low: 'low',
    medium: 'medium',
};

const isNoiseHost = (h: string): boolean => /^(127\.|0\.0\.0\.0|localhost$)/.test(h);

const parseFacts = (texts: string[]): ParsedFacts => {
    const facts: ParsedFacts = { cves: [], hosts: new Set(), nuclei: [], ports: [], urls: [] };
    const cveSet = new Set<string>();
    const urlSet = new Set<string>();
    const blob = texts.join('\n');

    for (const m of blob.matchAll(/CVE-\d{4}-\d{4,7}/gi)) cveSet.add(m[0].toUpperCase());
    for (const m of blob.matchAll(/https?:\/\/[^\s"'<>)\]]+/gi)) urlSet.add(m[0].replace(/[.,]+$/, ''));

    for (const line of blob.split('\n')) {
        // nmap: "443/tcp  open  https   nginx 1.18"
        const port = line.match(/^\s*(\d{1,5})\/(?:tcp|udp)\s+open\s+(\S+)?/i);
        if (port) facts.ports.push({ port: Number(port[1]), service: port[2] });
        // nuclei: "[template-id] [protocol] [severity] http://host  ..."
        const nuc = line.match(/\[([a-z0-9][a-z0-9._-]+)\]\s*\[[a-z]+\]\s*\[(critical|high|medium|low|info|informational)\]\s*(\S+)?/i);
        if (nuc) facts.nuclei.push({ matched: nuc[3] ?? '', severity: SEVERITY_WORDS[nuc[2]!.toLowerCase()] ?? 'info', templateId: nuc[1]! });
        // ipv4 hosts
        for (const ip of line.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)) {
            if (!isNoiseHost(ip[0])) facts.hosts.add(ip[0]);
        }
    }
    facts.cves = [...cveSet];
    facts.urls = [...urlSet].slice(0, 12);
    for (const u of facts.urls) {
        try {
            const h = new URL(u).hostname;
            if (h && !isNoiseHost(h)) facts.hosts.add(h);
        } catch {
            /* ignore malformed urls */
        }
    }
    return facts;
};

// ---------------------------------------------------------------------------------------------
// derived scoring helpers (only used when the flow gives no measured value)
// ---------------------------------------------------------------------------------------------

const SEVERITY_HINTS: { re: RegExp; severity: Severity }[] = [
    { re: /\b(rce|remote code|execu[çc][ãa]o remota|sql ?inj|sqli|desserializ|deserializ|domain ?admin|comprometimento total|cr[íi]tic)/i, severity: 'critical' },
    { re: /\b(xss|ssrf|lfi|rfi|idor|auth(entication)? bypass|bypass de auth|escala[çc][ãa]o de privil[ée]gio|privilege escalation|credencial exposta|exposed credential|secret|alto)\b/i, severity: 'high' },
    { re: /\b(divulga[çc][ãa]o de informa|information disclosure|verbose|banner|missing header|cabe[çc]alho ausente|tlsv1\.0|baixo)\b/i, severity: 'low' },
    { re: /\b(informativ|informational|enumera[çc][ãa]o|recon|coleta)\b/i, severity: 'info' },
];
const guessSeverity = (text: string): Severity => SEVERITY_HINTS.find((h) => h.re.test(text))?.severity ?? 'medium';

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

const FINDING_PHASES: PtesPhaseId[] = ['vulnerability-analysis', 'exploitation', 'post-exploitation'];

const phaseForText = (text: string, ordinalFallback: PtesPhaseId): PtesPhaseId => {
    if (/\b(recon|enumera|scan|nmap|subdomain|osint|coleta)\b/i.test(text)) return 'intelligence';
    if (/\b(priv[ -]?esc|escala|lateral|persist|pós|post[- ]?exploit|dump|mimikatz|domain ?admin)\b/i.test(text)) return 'post-exploitation';
    if (/\b(exploit|explora|payload|rce|shell|sqlmap|metasploit|reverse)\b/i.test(text)) return 'exploitation';
    if (/\b(vuln|cve|nuclei|nikto|análise|analysis)\b/i.test(text)) return 'vulnerability-analysis';
    return ordinalFallback;
};

const riskScoreFromFindings = (findings: Finding[]): number => {
    const real = findings.filter((f) => f.severity !== 'info');
    if (real.length === 0) return findings.length ? 10 : 0;
    const weight: Record<Severity, number> = { critical: 100, high: 78, info: 10, low: 28, medium: 52 };
    const top = Math.max(...real.map((f) => weight[f.severity]));
    const avg = real.reduce((s, f) => s + weight[f.severity], 0) / real.length;
    return Math.round(top * 0.6 + avg * 0.4);
};

// ---------------------------------------------------------------------------------------------
// 3. ASSETS — affected assets from a finding's OWN step logs (not the container roster)
// ---------------------------------------------------------------------------------------------

const assetsFromFacts = (facts: ParsedFacts, sourceLogIds: string[]): AffectedAsset[] => {
    const out: AffectedAsset[] = [];
    const hosts = [...facts.hosts].slice(0, 6);
    for (const host of hosts) {
        const port = facts.ports[0]; // best-effort: plain nmap output rarely ties a port to a host
        out.push({ host, port: port?.port, service: port?.service, sourceLogIds });
    }
    if (out.length === 0 && facts.urls.length) {
        for (const url of facts.urls.slice(0, 4)) {
            let host = url;
            try {
                host = new URL(url).hostname;
            } catch {
                /* keep raw */
            }
            out.push({ host, sourceLogIds, url });
        }
    }
    return out;
};

// ---------------------------------------------------------------------------------------------
// orchestrator
// ---------------------------------------------------------------------------------------------

export interface FromFlowOptions {
    author?: string;
    classification?: string;
    contact?: string;
    version?: string;
}

interface FindingSource {
    description: string;
    result: string;
    taskId?: null | string;
    title: string;
}

const sourcesForTask = (task: TaskFragmentFragment): FindingSource[] => {
    const subtasks: SubtaskFragmentFragment[] = task.subtasks ?? [];
    const done = subtasks.filter((s) => s.status === 'finished' && (s.result?.trim() || s.description?.trim()));
    if (done.length > 0) {
        return done.map((st) => ({ description: st.description ?? '', result: st.result ?? '', taskId: task.id, title: st.title || task.title }));
    }
    return [{ description: task.input ?? '', result: task.result ?? '', taskId: task.id, title: task.title }];
};

/** Build a complete Engagement from a real flow (the full FlowQuery payload) and branding. */
export function transformFlowToEngagement(data: FlowQuery, branding: Branding, options: FromFlowOptions = {}): Engagement {
    const flow = data.flow!;
    const join = buildJoin(data);
    const figures: Figure[] = [];
    let figN = 0;

    const findings: Finding[] = [];
    let fIdx = 0;

    for (const task of join.tasksOrdered) {
        const tid = String(task.id);
        const terminals = join.terminalByTask.get(tid) ?? [];
        const termTexts = terminals.map((tl) => tl.text ?? '');
        const facts = parseFacts(termTexts);
        const reportLog = join.reportByTask.get(tid);

        // task-level evidence figures: created ONCE per task (richest terminal excerpt +
        // screenshots) and shared by every finding derived from this task — avoids duplicate
        // plates when a task has multiple finished subtasks/sources.
        const taskFigureIds: string[] = [];
        const bestTerm = terminals.slice().sort((a, b) => (b.text?.length ?? 0) - (a.text?.length ?? 0))[0];
        if (bestTerm?.text?.trim()) {
            figN += 1;
            const fig: Figure = {
                caption: `Saída de ferramenta — ${clip(task.title, 70)}`,
                code: clip(bestTerm.text, 1400),
                findingIds: [],
                id: `FIG-${String(figN).padStart(2, '0')}`,
                kind: 'terminal',
                n: figN,
                taskId: tid,
            };
            figures.push(fig);
            taskFigureIds.push(fig.id);
        }
        for (const sc of (join.screenshotsByTask.get(tid) ?? []).slice(0, 2)) {
            figN += 1;
            const fig: Figure = {
                capturedUrl: sc.url ?? undefined,
                caption: clip(sc.name || `Captura — ${task.title}`, 80),
                findingIds: [],
                id: `FIG-${String(figN).padStart(2, '0')}`,
                imageSrc: sc.id ? `screenshot:${flow.id}:${sc.id}` : undefined,
                kind: 'screenshot',
                n: figN,
                subtaskId: sc.subtaskId ?? undefined,
                taskId: tid,
            };
            figures.push(fig);
            taskFigureIds.push(fig.id);
        }

        for (const src of sourcesForTask(task)) {
            const hay = `${src.title} ${src.description} ${src.result}`;
            // severity: measured from nuclei when present, else keyword-inferred (estimated).
            const nucMax = facts.nuclei.sort((a, b) => IMPACT_BY_SEVERITY[b.severity] - IMPACT_BY_SEVERITY[a.severity])[0];
            const severity: Severity = nucMax?.severity ?? guessSeverity(hay);
            const sevMeasured = Boolean(nucMax);
            const provenance: FieldProvenance = {
                affected: facts.hosts.size || facts.urls.length ? 'parsed' : 'estimated',
                cvss: 'estimated',
                cwe: 'estimated',
                severity: sevMeasured ? 'parsed' : 'estimated',
            };
            const sourceLogIds = terminals.map((tl) => String(tl.id));
            const assets = assetsFromFacts(facts, sourceLogIds);

            // every finding from this task references the same shared task-level figures
            const evidenceRefs = [...taskFigureIds];

            const id = `F-${String(fIdx + 1).padStart(2, '0')}`;
            for (const figId of taskFigureIds) figures.find((f) => f.id === figId)!.findingIds.push(id);

            const refsList = [...facts.cves.map((cve) => ({ label: cve, url: `https://nvd.nist.gov/vuln/detail/${cve}` })), ...facts.nuclei.slice(0, 3).map((n) => ({ label: `nuclei: ${n.templateId}` }))];

            // prefer the LLM-written `report` summary as the finding body when this is the task's
            // sole source; otherwise use the subtask result.
            const body = clip(src.result || reportLog?.result || src.description || src.title);

            findings.push({
                affected: assets.map((a) => (a.port ? `${a.host}:${a.port}${a.service ? ` (${a.service})` : ''}` : a.host)),
                assets,
                businessImpact: 'Impacto de negócio a confirmar pelo analista (confidencialidade, integridade ou disponibilidade dos ativos afetados).',
                category: facts.nuclei.length ? 'Vulnerabilidade (scanner)' : facts.cves.length ? 'CVE conhecida' : 'Execução de teste',
                cvss: CVSS_BY_SEVERITY[severity],
                cwe: '—',
                description: body,
                estimatedNote:
                    provenance.cvss === 'estimated' || provenance.severity === 'estimated'
                        ? 'CVSS/severidade estimados a partir da execução — calibre antes da entrega.'
                        : undefined,
                evidence: bestTerm?.text?.trim() ? { caption: `Saída — ${clip(src.title, 70)}`, code: clip(bestTerm.text, 1400) } : undefined,
                evidenceRefs,
                id,
                impact: IMPACT_BY_SEVERITY[severity],
                likelihood: LIKELIHOOD_BY_SEVERITY[severity],
                phase: phaseForText(hay, FINDING_PHASES[fIdx % FINDING_PHASES.length]!),
                provenance,
                references: refsList,
                remediation: 'Definir e validar a correção com base na análise do achado; reteste após a remediação.',
                remediationEffort: EFFORT_BY_SEVERITY[severity],
                remediationWindow: WINDOW_BY_SEVERITY[severity],
                etaDays: ETA_BY_SEVERITY[severity],
                severity,
                sourceTaskIds: [tid],
                status: 'confirmed',
                title: clip(src.title, 120) || `Achado ${fIdx + 1}`,
            });
            fIdx += 1;
        }
    }

    if (findings.length === 0) {
        findings.push({
            affected: [],
            businessImpact: 'A confirmar.',
            category: 'Execução de teste',
            cvss: 0,
            cwe: '—',
            description: 'Nenhum achado estruturado foi capturado automaticamente neste fluxo.',
            estimatedNote: 'Adicione os achados manualmente a partir da análise da execução.',
            id: 'F-01',
            impact: 1,
            likelihood: 1,
            phase: 'reporting',
            provenance: { severity: 'estimated' },
            references: [],
            remediation: 'Adicionar os achados manualmente a partir da análise da execução.',
            severity: 'info',
            status: 'open',
            title: 'Sem achados estruturados capturados',
        });
    }

    // Attack narrative — one beat per task, prose from the `report` msglog when available.
    const attackStory = join.tasksOrdered.slice(0, 12).map((task, i) => {
        const tid = String(task.id);
        const reportLog = join.reportByTask.get(tid);
        const prose = reportLog?.result?.trim() || task.result?.trim() || task.input?.trim() || task.title;
        const beatFindings = findings.filter((f) => f.sourceTaskIds?.includes(tid)).map((f) => f.id);
        const figRefs = figures.filter((f) => f.taskId === tid).map((f) => f.id);
        return {
            estimated: !reportLog,
            figureRefs: figRefs,
            n: i + 1,
            phase: phaseForText(`${task.title} ${prose}`, FINDING_PHASES[i % FINDING_PHASES.length]!),
            refs: beatFindings,
            sourceMsgLogId: reportLog?.id ? String(reportLog.id) : undefined,
            sourceTaskId: tid,
            text: clip(prose, 360),
            timestamp: task.createdAt ? String(task.createdAt) : undefined,
            title: clip(task.title, 70) || `Etapa ${i + 1}`,
        };
    });

    const riskScore = riskScoreFromFindings(findings);
    const appName = branding.appName;

    return {
        attackStory,
        author: options.author ?? `${appName} — Equipe de Segurança Ofensiva`,
        branding,
        classification: options.classification ?? 'CONFIDENCIAL',
        client: branding.clientName || 'Cliente',
        contact: options.contact ?? `security@${appName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
        figures,
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
            inScope:
                flow.terminals && flow.terminals.length > 0
                    ? flow.terminals.map((tm) => `${tm.name} (${tm.image})`)
                    : ['Ambiente avaliado durante a execução do fluxo.'],
            outOfScope: ['Qualquer ativo não listado explicitamente no escopo.'],
        },
        summaryNarrative: [
            `Esta avaliação consolida a execução do fluxo "${flow.title}" na plataforma ${appName}, no período de ${fmtDate(flow.createdAt)} a ${fmtDate(flow.updatedAt)}.`,
            `Foram derivados ${findings.length} achado(s) a partir das atividades executadas, com evidências extraídas da saída real das ferramentas. Severidades/CVSS marcados como estimados devem ser calibrados pelo analista antes da entrega.`,
            'As seções seguintes descrevem a narrativa do ataque, a visão de risco e o plano de ação priorizado com quick wins.',
        ],
        title: `Relatório de Teste de Intrusão — ${flow.title}`,
        version: options.version ?? '1.0',
    };
}
