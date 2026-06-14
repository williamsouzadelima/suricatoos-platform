// Premium PTES report — PowerPoint deck. Mirrors the PDF: co-branded cover, executive summary,
// attack narrative, risk overview, methodology, findings, action plan. Charts are embedded as the
// exact same images rasterized from the PDF's vector charts, so all formats stay consistent.
import pptxgen from 'pptxgenjs';

import { CHART_SPECS } from './report-charts-sheet';
import { SURICATOOS_LOGO_BADGE } from './report-logo-assets';
import { PTES_PHASES, type Engagement } from './engagement';
import { actionItems, categoryCounts, EFFORT, quickWins, riskRating, SEVERITY, SEVERITY_ORDER, WINDOW_COLOR, WINDOWS } from './theme';

export type ChartImages = Record<string, string>; // key -> PNG data URI

const BLUE = '194FE3';
const CORAL = 'FF7678';
const INK = '0F172A';
const SLATE = '334155';
const MUTED = '64748B';
const PANEL = 'F4F6FB';
const LINE = 'E2E8F0';

const aspect = (key: string) => {
    const c = CHART_SPECS.find((s) => s.key === key)!;
    return c.h / c.w;
};
const hex = (c: string) => c.replace('#', '');

export function buildPtesPptx(e: Engagement, images: ChartImages): pptxgen {
    const pptx = new pptxgen();
    pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
    pptx.layout = 'W';
    pptx.author = e.branding.appName;
    pptx.company = e.branding.appName;
    const primary = e.branding.primary ?? BLUE;

    pptx.defineSlideMaster({
        title: 'BASE',
        background: { color: 'FFFFFF' },
        objects: [
            { rect: { x: 0, y: 0, w: 0.16, h: '100%', fill: { color: primary } } },
            { rect: { x: 0, y: 7.16, w: '100%', h: 0.34, fill: { color: PANEL } } },
            { text: { text: e.branding.appName, options: { x: 0.45, y: 7.16, w: 5, h: 0.34, fontSize: 8, color: MUTED, bold: true, valign: 'middle' } } },
            { text: { text: `${e.client} · ${e.classification}`, options: { x: 7.9, y: 7.16, w: 5, h: 0.34, fontSize: 8, color: MUTED, align: 'right', valign: 'middle' } } },
        ],
    });

    const img = (s: pptxgen.Slide, key: string, x: number, y: number, w: number) => {
        if (!images[key]) return;
        s.addImage({ data: images[key], x, y, w, h: w * aspect(key) });
    };
    const section = (s: pptxgen.Slide, kicker: string, title: string) => {
        s.addText(kicker.toUpperCase(), { x: 0.5, y: 0.32, w: 12, h: 0.3, fontSize: 11, bold: true, color: primary });
        s.addText(title, { x: 0.5, y: 0.6, w: 12.3, h: 0.6, fontSize: 26, bold: true, color: INK });
        s.addShape(pptx.ShapeType.line, { x: 0.5, y: 1.28, w: 12.3, h: 0, line: { color: primary, width: 2 } });
    };

    // ── Cover ──
    const c = pptx.addSlide();
    c.background = { color: INK };
    c.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: '100%', fill: { color: primary } });
    const appLogo = e.branding.appLogoOnDark ?? e.branding.appLogo ?? SURICATOOS_LOGO_BADGE;
    c.addImage({ data: appLogo, x: 0.8, y: 0.56, w: 0.72, h: 0.72 });
    c.addText(e.branding.appName.toUpperCase(), { x: 1.65, y: 0.56, w: 8, h: 0.72, fontSize: 24, bold: true, color: primary, valign: 'middle' });
    c.addText('RELATÓRIO DE PENTEST · PTES', { x: 0.8, y: 2.0, w: 11, h: 0.4, fontSize: 14, bold: true, color: CORAL, charSpacing: 2 });
    c.addText(e.title, { x: 0.8, y: 2.5, w: 11.6, h: 1.5, fontSize: 32, bold: true, color: 'FFFFFF' });
    c.addText(`Preparado por ${e.branding.appName} para`, { x: 0.8, y: 4.2, w: 11, h: 0.3, fontSize: 11, color: '94A3B8' });
    // client logo or monogram
    if (e.branding.clientLogo) {
        c.addImage({ data: e.branding.clientLogo, x: 0.8, y: 4.55, w: 1.0, h: 0.7 });
        c.addText(e.branding.clientName, { x: 1.95, y: 4.55, w: 8, h: 0.7, fontSize: 18, bold: true, color: 'E2E8F0', valign: 'middle' });
    } else {
        const initials = e.branding.clientName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
        c.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 4.55, w: 0.7, h: 0.7, rectRadius: 0.1, fill: { color: hex(`#${e.branding.accent ?? CORAL}`) } });
        c.addText(initials, { x: 0.8, y: 4.55, w: 0.7, h: 0.7, fontSize: 20, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
        c.addText(e.branding.clientName, { x: 1.65, y: 4.55, w: 8, h: 0.7, fontSize: 18, bold: true, color: 'E2E8F0', valign: 'middle' });
    }
    c.addText(e.classification, { x: 0.8, y: 5.6, w: 2.2, h: 0.4, fontSize: 11, bold: true, color: CORAL, align: 'center', charSpacing: 1, line: { color: CORAL, width: 1 } });
    c.addText(
        [
            { text: `Período: `, options: { bold: true } }, { text: `${e.period.start} – ${e.period.end}    ` },
            { text: `Versão: `, options: { bold: true } }, { text: `${e.version}    ` },
            { text: `Risco: `, options: { bold: true } }, { text: `${e.riskScore}/100 (${riskRating(e.riskScore).label})` },
        ],
        { x: 0.8, y: 6.5, w: 11.5, h: 0.4, fontSize: 11, color: 'CBD5E1' },
    );

    // ── Executive summary ──
    const s1 = pptx.addSlide({ masterName: 'BASE' });
    section(s1, 'Sumário Executivo', 'Sumário Executivo');
    s1.addText(e.summaryNarrative.join('\n\n'), { x: 0.5, y: 1.5, w: 7.0, h: 4.6, fontSize: 12, color: SLATE, valign: 'top', paraSpaceAfter: 8, lineSpacingMultiple: 1.1 });
    img(s1, 'gauge', 8.0, 1.5, 3.0);
    img(s1, 'donut', 9.6, 3.6, 1.9);
    const qw = quickWins(e.findings);
    s1.addText(
        [
            { text: `${e.findings.length}`, options: { fontSize: 26, bold: true, color: INK } }, { text: '  achados      ', options: { fontSize: 11, color: MUTED } },
            { text: `${e.findings.filter((f) => f.severity === 'critical').length}`, options: { fontSize: 26, bold: true, color: SEVERITY.critical.color.replace('#', '') } }, { text: '  críticos      ', options: { fontSize: 11, color: MUTED } },
            { text: `${qw.length}`, options: { fontSize: 26, bold: true, color: '059669' } }, { text: '  quick wins', options: { fontSize: 11, color: MUTED } },
        ],
        { x: 0.5, y: 6.2, w: 7.2, h: 0.7, valign: 'middle' },
    );

    // ── Attack narrative ──
    const s2 = pptx.addSlide({ masterName: 'BASE' });
    section(s2, 'Narrativa do Ataque', 'Narrativa do Ataque');
    img(s2, 'attackChain', 0.7, 1.5, 12.0);
    const storyRows = e.attackStory.map((st) => [
        { text: String(st.n), options: { color: 'FFFFFF', fill: { color: primary }, bold: true, align: 'center', valign: 'middle', fontSize: 12 } },
        { text: st.title, options: { bold: true, color: INK, valign: 'middle', fontSize: 11 } },
        { text: `${st.text}${st.refs?.length ? `  [${st.refs.join(', ')}]` : ''}`, options: { color: SLATE, valign: 'middle', fontSize: 10 } },
    ]);
    s2.addTable(storyRows, { x: 0.5, y: 2.95, w: 12.3, colW: [0.5, 2.4, 9.4], border: { type: 'solid', color: LINE, pt: 1 }, rowH: 0.56, valign: 'middle' });

    // ── Risk overview ──
    const s3 = pptx.addSlide({ masterName: 'BASE' });
    section(s3, 'Visão Geral de Risco', 'Visão Geral de Risco');
    s3.addText('Matriz de risco (probabilidade × impacto)', { x: 0.5, y: 1.5, w: 5, h: 0.3, fontSize: 11, bold: true, color: INK });
    img(s3, 'matrix', 0.9, 1.9, 4.4);
    s3.addText('Achados por categoria', { x: 6.6, y: 1.5, w: 5, h: 0.3, fontSize: 11, bold: true, color: INK });
    img(s3, 'categories', 6.6, 1.9, 5.0);
    s3.addText(
        SEVERITY_ORDER.map((sv) => ({ text: `● ${SEVERITY[sv].label}\n`, options: { color: SEVERITY[sv].color.replace('#', ''), fontSize: 11, bold: true } })),
        { x: 6.6, y: 4.6, w: 6, h: 1.8, valign: 'top' },
    );

    // ── Methodology ──
    const s4 = pptx.addSlide({ masterName: 'BASE' });
    section(s4, 'Metodologia (PTES)', 'Metodologia (PTES)');
    img(s4, 'phaseStepper', 0.6, 1.5, 12.1);
    const methRows = e.methodology.map((m) => {
        const ph = PTES_PHASES.find((p) => p.id === m.phase);
        return [
            { text: `${ph?.n}`, options: { bold: true, color: 'FFFFFF', fill: { color: primary }, align: 'center', valign: 'middle', fontSize: 12 } },
            { text: m.title, options: { bold: true, color: INK, valign: 'middle', fontSize: 11 } },
            { text: m.activities.join('  ·  '), options: { color: SLATE, valign: 'middle', fontSize: 10 } },
        ];
    });
    s4.addTable(methRows, { x: 0.5, y: 2.3, w: 12.3, colW: [0.5, 3.0, 8.8], border: { type: 'solid', color: LINE, pt: 1 }, rowH: 0.5, valign: 'middle' });

    // ── Findings index ──
    const s5 = pptx.addSlide({ masterName: 'BASE' });
    section(s5, 'Achados', 'Achados Detalhados');
    const head = ['ID', 'Achado', 'Severidade', 'CVSS', 'Categoria'].map((t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: primary }, fontSize: 11 } }));
    const fRows = [...e.findings].sort((a, b) => b.cvss - a.cvss).map((f) => [
        { text: f.id, options: { fontSize: 10 } },
        { text: f.title, options: { fontSize: 10 } },
        { text: SEVERITY[f.severity].label, options: { fontSize: 10, bold: true, color: SEVERITY[f.severity].color.replace('#', '') } },
        { text: f.cvss.toFixed(1), options: { fontSize: 10 } },
        { text: f.category, options: { fontSize: 10 } },
    ]);
    s5.addTable([head, ...fRows], { x: 0.5, y: 1.5, w: 12.3, colW: [1.0, 6.2, 1.6, 1.0, 2.5], border: { type: 'solid', color: LINE, pt: 1 }, rowH: 0.42, valign: 'middle' });

    // ── Findings detail (criticals/highs) ──
    const detail = [...e.findings].filter((f) => f.severity === 'critical' || f.severity === 'high').sort((a, b) => b.cvss - a.cvss);
    for (let i = 0; i < detail.length; i += 2) {
        const sd = pptx.addSlide({ masterName: 'BASE' });
        section(sd, 'Achados', 'Achado em detalhe');
        detail.slice(i, i + 2).forEach((f, j) => {
            const x = 0.5 + j * 6.3;
            const sv = SEVERITY[f.severity];
            sd.addShape(pptx.ShapeType.rect, { x, y: 1.5, w: 6.0, h: 5.3, fill: { color: 'FFFFFF' }, line: { color: LINE, width: 1 } });
            sd.addShape(pptx.ShapeType.rect, { x, y: 1.5, w: 0.08, h: 5.3, fill: { color: sv.color.replace('#', '') } });
            sd.addText(`${f.id} — ${f.title}`, { x: x + 0.25, y: 1.65, w: 5.0, h: 0.6, fontSize: 13, bold: true, color: INK });
            sd.addText(sv.label.toUpperCase(), { x: x + 5.0, y: 1.65, w: 0.85, h: 0.3, fontSize: 9, bold: true, color: 'FFFFFF', fill: { color: sv.color.replace('#', '') }, align: 'center' });
            const est = (p?: string) => p === 'estimated' || p === 'inferred';
            const cvssTag = est(f.provenance?.cvss) ? ' (est.)' : '';
            sd.addText(`CVSS ${f.cvss.toFixed(1)}${cvssTag} · ${f.cwe} · ${f.category}`, { x: x + 0.25, y: 2.35, w: 5.5, h: 0.3, fontSize: 9.5, color: MUTED });
            sd.addText(
                [
                    { text: 'Descrição\n', options: { bold: true, color: primary, fontSize: 9 } }, { text: `${f.description}\n\n`, options: { color: SLATE, fontSize: 10 } },
                    { text: 'Impacto\n', options: { bold: true, color: primary, fontSize: 9 } }, { text: `${f.businessImpact}\n\n`, options: { color: SLATE, fontSize: 10 } },
                    { text: 'Remediação\n', options: { bold: true, color: primary, fontSize: 9 } }, { text: `${f.remediation}${f.estimatedNote ? `\n\nNota: ${f.estimatedNote}` : ''}`, options: { color: SLATE, fontSize: 10 } },
                ],
                { x: x + 0.25, y: 2.75, w: 5.5, h: 3.9, valign: 'top', lineSpacingMultiple: 1.05 },
            );
        });
    }

    // ── Action plan (charts) ──
    const s6 = pptx.addSlide({ masterName: 'BASE' });
    section(s6, 'Plano de Ação', 'Plano de Ação');
    s6.addText('Roteiro de remediação', { x: 0.5, y: 1.45, w: 6, h: 0.3, fontSize: 11, bold: true, color: INK });
    img(s6, 'roadmap', 0.6, 1.8, 12.1);
    s6.addText('Quick wins (impacto × esforço)', { x: 0.5, y: 3.5, w: 6, h: 0.3, fontSize: 11, bold: true, color: INK });
    img(s6, 'quadrant', 1.2, 3.85, 3.0);
    s6.addText('Tempo de correção por achado', { x: 6.8, y: 3.5, w: 6, h: 0.3, fontSize: 11, bold: true, color: INK });
    img(s6, 'timeBars', 6.8, 3.85, 3.2);

    // ── Action plan (table) ──
    const s7 = pptx.addSlide({ masterName: 'BASE' });
    section(s7, 'Plano de Ação', 'Itens de correção priorizados');
    const items = actionItems(e.findings).sort((a, b) => WINDOWS.indexOf(a.window) - WINDOWS.indexOf(b.window) || SEVERITY[b.f.severity].rank - SEVERITY[a.f.severity].rank);
    const aHead = ['Janela', 'ID', 'Ação de correção', 'Esforço', 'Prazo', 'QW'].map((t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: primary }, fontSize: 10 } }));
    const aRows = items.map((a) => [
        { text: a.window, options: { fontSize: 9, color: 'FFFFFF', fill: { color: WINDOW_COLOR[a.window].replace('#', '') }, bold: true } },
        { text: a.f.id, options: { fontSize: 9 } },
        { text: a.f.remediation, options: { fontSize: 9 } },
        { text: EFFORT[a.effort].label, options: { fontSize: 9, bold: true, color: EFFORT[a.effort].color.replace('#', '') } },
        { text: `${a.etaDays}d`, options: { fontSize: 9 } },
        { text: a.quickWin ? '★' : '—', options: { fontSize: 9, bold: true, color: '059669', align: 'center' } },
    ]);
    s7.addTable([aHead, ...aRows], { x: 0.5, y: 1.5, w: 12.3, colW: [1.3, 0.7, 7.0, 1.1, 0.8, 1.4], border: { type: 'solid', color: LINE, pt: 1 }, rowH: 0.4, valign: 'middle' });

    return pptx;
}
