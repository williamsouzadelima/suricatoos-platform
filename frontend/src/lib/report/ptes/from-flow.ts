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
import { t, tf } from '@/i18n';

import type {
    AffectedAsset,
    Branding,
    Contact,
    Engagement,
    Figure,
    FieldProvenance,
    Finding,
    PtesPhaseId,
    RemediationWindow,
    RetestStatus,
    Severity,
} from './engagement';

import { stripControlChars, transformLlmFindingsToEngagement } from './from-flow-llm';

// ---------------------------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------------------------

const fmtDate = (value: unknown): string => {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const clip = (text: string, max = 900): string => {
    const clean = stripControlChars(text ?? '').replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
};

// Evidence relevance scoring (mirrors the backend deriver). Terminal output is mostly noise —
// dumped JS bundles, file listings, base64. Ranking by LENGTH picked a 988 KB minified bundle as
// "evidence"; instead, favour excerpts that demonstrate an exploit (HTTP traffic, payloads,
// credentials, proof-of-impact) and discard noise.
const SIG_RE =
    /HTTP\/[12]|\b(?:GET|POST|PUT|DELETE|PATCH) \/|\bcurl\b|Authorization:|\bBearer |Set-Cookie|\bUNION\s+SELECT|SELECT\s.+\sFROM|'\s*OR\s|OR\s+1=1|sqlmap|<script|onerror=|javascript:|\.\.\/|%2e%2e|alg"?\s*:\s*"?none|eyJ[A-Za-z0-9_-]{8,}|vulnerab|\bpayload|\bbypass|\bexploit|flag\{|\bCVE-\d|\b(?:200|201|301|302|400|401|403|404|500)\b/gi;
const NOISE_RE = /=>\s*\{|\}\)\(\)|;var |function\s*\(|\{class |return [a-z]\}|webpackChunk|__webpack|sourceMappingURL/g;
const B64_RE = /[A-Za-z0-9+/]{400,}/;

const scoreEvidence = (raw: null | string | undefined): number => {
    const t = stripControlChars(raw ?? '').trim();
    const n = t.length;
    if (!n) return 0;
    let score = (t.match(SIG_RE)?.length ?? 0) * 6;
    score += (t.match(/\$ /g)?.length ?? 0) + (t.match(/\n# /g)?.length ?? 0); // shell prompts
    score -= (t.match(NOISE_RE)?.length ?? 0) * 5; // minified JS / bundles
    if (B64_RE.test(t)) score -= 8;
    const spaces = t.match(/[ \n]/g)?.length ?? 0;
    if (n > 400 && spaces * 40 < n) score -= 12; // <2.5% whitespace => minified/binary
    if (n > 20000) score -= 15;
    else if (n > 8000) score -= 5;
    return score;
};

// Return up to `max` chars centred on the first exploit signal (preserving line breaks), so a long
// log still surfaces the relevant request/response rather than its irrelevant head.
const evidenceWindow = (raw: null | string | undefined, max: number): string => {
    const t = stripControlChars(raw ?? '')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
    if (t.length <= max) return t;
    const idx = t.search(SIG_RE);
    let start = idx > 0 ? Math.max(0, idx - Math.floor(max / 3)) : 0;
    let end = start + max;
    if (end > t.length) {
        end = t.length;
        start = Math.max(0, end - max);
    }
    return `${start > 0 ? '…' : ''}${t.slice(start, end)}${end < t.length ? '…' : ''}`;
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
    // Typed contacts for the report's contact table (Strati parity).
    reviewer?: string; // reviewer name (CISO), shown as the "Revisor" contact
    reviewerContact?: string; // reviewer email/phone
    clientContact?: string; // client sponsor email/phone
    // Retest mode: render a per-finding Status column and the "— Retest" title suffix.
    retest?: boolean;
    retestStatuses?: Record<string, RetestStatus>; // keyed by backend finding id
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
        // Rank by exploit-RELEVANCE (not length) and DROP noise (JS bundles, listings, base64).
        const rankedTerms = terminals
            .map((tl) => ({ s: scoreEvidence(tl.text), tl }))
            .sort((a, b) => b.s - a.s || (a.tl.text?.length ?? 0) - (b.tl.text?.length ?? 0));
        const usefulTerms = rankedTerms.filter((x) => x.s > 0);
        const bestTerm = usefulTerms[0]?.tl;
        // up to 3 most-relevant terminal excerpts per task (only genuine evidence; noise is skipped)
        usefulTerms.slice(0, 3).forEach(({ tl }, ti) => {
            // strip ANSI/control chars BEFORE windowing so the excerpt is clean proof, not color codes
            const code = evidenceWindow(stripControlChars(tl.text), 3500);
            if (!code.trim()) return;
            figN += 1;
            const fig: Figure = {
                caption: `${t('Tool output')} — ${clip(task.title, 70)}${ti > 0 ? ` (${ti + 1})` : ''}`,
                code,
                findingIds: [],
                id: `FIG-${String(figN).padStart(2, '0')}`,
                kind: 'terminal',
                n: figN,
                taskId: tid,
            };
            figures.push(fig);
            taskFigureIds.push(fig.id);
        });
        for (const sc of (join.screenshotsByTask.get(tid) ?? []).slice(0, 8)) {
            figN += 1;
            const fig: Figure = {
                capturedUrl: sc.url ?? undefined,
                caption: clip(sc.name || `${t('Screenshot')} — ${task.title}`, 80),
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
                businessImpact: t('Business impact to be confirmed by the analyst (confidentiality, integrity, or availability of the affected assets).'),
                category: facts.nuclei.length ? t('Vulnerability (scanner)') : facts.cves.length ? t('Known CVE') : t('Test execution'),
                cvss: CVSS_BY_SEVERITY[severity],
                cwe: '—',
                description: body,
                estimatedNote:
                    provenance.cvss === 'estimated' || provenance.severity === 'estimated'
                        ? t('CVSS/severity estimated from execution — calibrate before delivery.')
                        : undefined,
                evidence: bestTerm?.text?.trim() ? { caption: `${t('Output')} — ${clip(src.title, 70)}`, code: evidenceWindow(bestTerm.text, 3500) } : undefined,
                evidenceRefs,
                id,
                impact: IMPACT_BY_SEVERITY[severity],
                likelihood: LIKELIHOOD_BY_SEVERITY[severity],
                phase: phaseForText(hay, FINDING_PHASES[fIdx % FINDING_PHASES.length]!),
                provenance,
                references: refsList,
                remediation: t('Define and validate the fix based on the finding analysis; retest after remediation.'),
                remediationEffort: EFFORT_BY_SEVERITY[severity],
                remediationWindow: WINDOW_BY_SEVERITY[severity],
                etaDays: ETA_BY_SEVERITY[severity],
                severity,
                sourceTaskIds: [tid],
                status: 'confirmed',
                title: clip(src.title, 120) || tf('Finding {n}', { n: fIdx + 1 }),
            });
            fIdx += 1;
        }
    }

    // Backend LLM-derived findings take precedence; the regex heuristics above are the fallback.
    const llmFindings =
        data.findings && data.findings.length > 0
            ? transformLlmFindingsToEngagement(data.findings, options.retest ? options.retestStatuses ?? {} : undefined)
            : [];

    if (findings.length === 0 && llmFindings.length === 0) {
        findings.push({
            affected: [],
            businessImpact: t('To be confirmed.'),
            category: t('Test execution'),
            cvss: 0,
            cwe: '—',
            description: t('No structured findings were automatically captured in this flow.'),
            estimatedNote: t('Add the findings manually from the execution analysis.'),
            id: 'F-01',
            impact: 1,
            likelihood: 1,
            phase: 'reporting',
            provenance: { severity: 'estimated' },
            references: [],
            remediation: t('Add the findings manually from the execution analysis.'),
            severity: 'info',
            status: 'open',
            title: t('No structured findings captured'),
        });
    }

    // Prefer the LLM findings when present. Figure↔finding cross-links were built against the
    // regex findings, so RE-LINK each figure to the LLM findings of the same task (by sourceTaskId)
    // instead of dropping the references — keeps the evidence plates cross-referenced correctly.
    const finalFindings = llmFindings.length > 0 ? llmFindings : findings;
    if (llmFindings.length > 0) {
        for (const fig of figures) {
            fig.findingIds = fig.taskId
                ? finalFindings.filter((f) => f.sourceTaskIds?.includes(fig.taskId!)).map((f) => f.id)
                : [];
        }
        // Strengthen each finding's inline evidence: show the REAL tool-output excerpt (the linked
        // numbered figure) as the proof, demoting the AI's prose evidence to the explanatory caption.
        // The report then carries verifiable request/response bytes instead of a summary sentence.
        for (const f of finalFindings) {
            const proof = figures.find((g) => g.kind !== 'screenshot' && g.code?.trim() && g.findingIds.includes(f.id));
            if (proof?.code) {
                const aiText = f.evidence?.code?.trim();
                f.evidence = { caption: aiText ? clip(aiText, 220) : proof.caption || t('Tool output (proof)'), code: proof.code };
            }
        }
    }

    // Attack narrative — one beat per task, prose from the `report` msglog when available.
    const attackStory = join.tasksOrdered.slice(0, 12).map((task, i) => {
        const tid = String(task.id);
        const reportLog = join.reportByTask.get(tid);
        const prose = reportLog?.result?.trim() || task.result?.trim() || task.input?.trim() || task.title;
        const beatFindings = finalFindings.filter((f) => f.sourceTaskIds?.includes(tid)).map((f) => f.id);
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
            title: clip(task.title, 70) || tf('Step {n}', { n: i + 1 }),
        };
    });

    const riskScore = riskScoreFromFindings(finalFindings);
    const appName = branding.appName;
    const author = options.author ?? tf('{app} — Offensive Security Team', { app: appName });
    const contact = options.contact ?? `security@${appName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`;
    const clientName = branding.clientName || t('Client');

    // Typed contact table (Strati parity). Always include the testing team; include the client
    // sponsor and reviewer rows only when their details were provided.
    const contacts: Contact[] = [];
    if (options.clientContact) contacts.push({ info: options.clientContact, name: clientName, role: t('Client') });
    contacts.push({ info: contact, name: author, role: t('Pentester') });
    if (options.reviewer) contacts.push({ info: options.reviewerContact ?? '', name: options.reviewer, role: t('Reviewer') });

    return {
        attackStory,
        author,
        branding,
        classification: options.classification ?? 'CONFIDENCIAL',
        client: clientName,
        contact,
        contacts,
        figures,
        findings: finalFindings,
        isRetest: options.retest ?? false,
        methodology: [
            { activities: [t('Scope definition, rules of engagement, and testing windows.')], phase: 'pre-engagement', title: t('Pre-engagement interactions') },
            { activities: [t('Gathering information about the targets and the attack surface.')], phase: 'intelligence', title: t('Intelligence gathering') },
            { activities: [t('Threat mapping and prioritization of vectors.')], phase: 'threat-modeling', title: t('Threat modeling') },
            { activities: [t('Identification and validation of vulnerabilities in the in-scope assets.')], phase: 'vulnerability-analysis', title: t('Vulnerability analysis') },
            { activities: [t('Controlled exploitation of the confirmed vulnerabilities.')], phase: 'exploitation', title: t('Exploitation') },
            { activities: [t('Assessment of post-compromise impact and movement.')], phase: 'post-exploitation', title: t('Post-exploitation') },
            { activities: [t('Consolidation of findings, action plan, and this report.')], phase: 'reporting', title: t('Reporting') },
        ],
        period: { end: fmtDate(flow.updatedAt), start: fmtDate(flow.createdAt) },
        recommendations: [
            { priority: 'Imediata', text: t('Address the highest-severity findings and the quick wins identified in the action plan.') },
            { priority: 'Curto prazo', text: t('Fix the medium-severity findings and review the related configurations.') },
            { priority: 'Médio prazo', text: t('Address the residual findings and incorporate recurring testing into the security cycle.') },
        ],
        riskScore,
        roe: [
            t('Tests executed exclusively against the in-scope assets.'),
            t('Potentially destructive actions avoided or agreed in advance.'),
            t('Findings treated as confidential between the parties.'),
        ],
        scope: {
            inScope:
                flow.terminals && flow.terminals.length > 0
                    ? flow.terminals.map((tm) => `${tm.name} (${tm.image})`)
                    : [t('Environment assessed during the flow execution.')],
            outOfScope: [t('Any asset not explicitly listed in scope.')],
        },
        summaryNarrative: [
            tf('This assessment consolidates the execution of the "{flow}" flow on the {app} platform, in the period from {start} to {end}.', { flow: flow.title, app: appName, start: fmtDate(flow.createdAt), end: fmtDate(flow.updatedAt) }),
            `${tf('{count} finding(s) were derived from the executed activities{aiNote}, with evidence extracted from the real tool output.', { count: finalFindings.length, aiNote: llmFindings.length > 0 ? ` ${t('(AI analysis)')}` : '' })} ${t('Severities/CVSS marked as estimated must be calibrated by the analyst before delivery.')}`,
            t('The following sections describe the attack narrative, the risk overview, and the prioritized action plan with quick wins.'),
        ],
        title: tf('Penetration Test Report — {flow}', { flow: flow.title }),
        version: options.version ?? '1.0',
    };
}
