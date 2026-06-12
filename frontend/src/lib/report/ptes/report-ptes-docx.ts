// Premium PTES report — Word document. Mirrors the PDF: co-branded cover, executive summary,
// attack narrative, risk overview, methodology, findings, action plan. Embeds the exact same
// rasterized charts as the PDF/PPTX, plus colored severity tables, for consistent output.
import {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    Header,
    HeadingLevel,
    ImageRun,
    PageBreak,
    PageNumber,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
} from 'docx';

import { CHART_SPECS } from './report-charts-sheet';
import { SURICATOOS_LOGO_BADGE } from './report-logo-assets';
import { PTES_PHASES, type Engagement, type Finding } from './engagement';
import { actionItems, categoryCounts, EFFORT, quickWins, riskRating, SEVERITY, SEVERITY_ORDER, WINDOW_COLOR, WINDOWS } from './theme';

export type ChartImages = Record<string, string>; // key -> PNG data URI

const BLUE = '194FE3';
const CORAL = 'FF7678';
const INK = '0F172A';
const SLATE = '334155';
const MUTED = '64748B';
const LINE = 'E2E8F0';
const PANEL = 'F4F6FB';
const hx = (c: string) => c.replace('#', '');

const decode = (dataUri: string): Uint8Array => {
    const b64 = dataUri.split(',')[1] ?? '';
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
};

export function buildPtesDocx(e: Engagement, images: ChartImages): Document {
    const primary = e.branding.primary ?? BLUE;

    const aspect = (key: string) => {
        const c = CHART_SPECS.find((s) => s.key === key)!;
        return c.h / c.w;
    };
    const chartPara = (key: string, widthPx: number, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) =>
        new Paragraph({
            alignment: align,
            spacing: { before: 80, after: 80 },
            children: images[key]
                ? [new ImageRun({ type: 'png', data: decode(images[key]), transformation: { width: widthPx, height: Math.round(widthPx * aspect(key)) } })]
                : [],
        });
    const twoCharts = (a: string, aw: number, b: string, bw: number) =>
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders(),
            rows: [new TableRow({ children: [cellPlain([chartPara(a, aw, AlignmentType.CENTER)]), cellPlain([chartPara(b, bw, AlignmentType.CENTER)])] })],
        });

    const heading = (n: number, title: string) => [
        new Paragraph({ spacing: { before: 220, after: 0 }, children: [new TextRun({ text: `SEÇÃO ${n}`, bold: true, color: primary, size: 16 })] }),
        new Paragraph({
            spacing: { after: 60 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: primary, space: 4 } },
            children: [new TextRun({ text: title, bold: true, color: INK, size: 30 })],
        }),
    ];
    const sub = (t: string) => new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: t, bold: true, color: INK, size: 22 })] });
    const body = (t: string) => new Paragraph({ spacing: { after: 100 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: t, color: SLATE, size: 19 })] });
    const bullet = (t: string) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 30 }, children: [new TextRun({ text: t, color: SLATE, size: 19 })] });

    // ── Cover ──
    const appLogo = e.branding.appLogo ?? SURICATOOS_LOGO_BADGE;
    const cover: (Paragraph | Table)[] = [
        new Paragraph({ spacing: { before: 600, after: 0 }, children: [new ImageRun({ type: 'png', data: decode(appLogo), transformation: { width: 72, height: 72 } })] }),
        new Paragraph({ spacing: { before: 60, after: 0 }, children: [new TextRun({ text: e.branding.appName.toUpperCase(), bold: true, color: primary, size: 44 })] }),
        new Paragraph({ spacing: { before: 200, after: 60 }, children: [new TextRun({ text: 'RELATÓRIO DE PENTEST · PTES', bold: true, color: CORAL, size: 22 })] }),
        new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: e.title, bold: true, color: INK, size: 48 })] }),
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `Preparado por ${e.branding.appName} para`, color: MUTED, size: 18 })] }),
        clientLockup(e),
        new Paragraph({ spacing: { before: 120, after: 300 }, children: [new TextRun({ text: ` ${e.classification} `, bold: true, color: CORAL, size: 18 })] }),
        kvTable([
            ['Período', `${e.period.start} – ${e.period.end}`],
            ['Versão', e.version],
            ['Autor', e.author],
            ['Contato', e.contact],
            ['Risco geral', `${e.riskScore}/100 (${riskRating(e.riskScore).label})`],
            ['Metodologia', 'PTES — Penetration Testing Execution Standard'],
        ]),
        new Paragraph({ children: [new PageBreak()] }),
    ];

    // ── Sections ──
    const items = actionItems(e.findings);
    const children: (Paragraph | Table)[] = [...cover];

    children.push(...heading(1, 'Sumário Executivo'));
    e.summaryNarrative.forEach((p) => children.push(body(p)));
    children.push(twoCharts('gauge', 230, 'donut', 150));
    children.push(
        new Paragraph({
            spacing: { before: 60 },
            children: [
                new TextRun({ text: `${e.findings.length} achados   `, bold: true, color: INK, size: 22 }),
                new TextRun({ text: `${e.findings.filter((f) => f.severity === 'critical').length} críticos   `, bold: true, color: SEVERITY.critical.color, size: 22 }),
                new TextRun({ text: `${quickWins(e.findings).length} quick wins`, bold: true, color: '059669', size: 22 }),
            ],
        }),
    );

    children.push(...heading(2, 'Narrativa do Ataque'));
    children.push(body('Do reconhecimento ao impacto: como achados isolados se encadeiam em um caminho real de comprometimento.'));
    children.push(chartPara('attackChain', 600, AlignmentType.CENTER));
    e.attackStory.forEach((st) => {
        children.push(
            new Paragraph({
                spacing: { before: 80, after: 20 },
                children: [
                    new TextRun({ text: `${st.n}. ${st.title}  `, bold: true, color: INK, size: 21 }),
                    ...(st.refs?.length ? [new TextRun({ text: `[${st.refs.join(', ')}]`, bold: true, color: primary, size: 15 })] : []),
                ],
            }),
        );
        children.push(new Paragraph({ spacing: { after: 60 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: st.text, color: SLATE, size: 19 })] }));
    });

    children.push(...heading(3, 'Visão Geral de Risco'));
    children.push(body('Distribuição de risco por probabilidade e impacto, e concentração por categoria de superfície avaliada.'));
    children.push(twoCharts('matrix', 280, 'categories', 300));
    children.push(
        new Paragraph({
            spacing: { before: 60 },
            children: SEVERITY_ORDER.flatMap((sv) => [new TextRun({ text: '■ ', color: SEVERITY[sv].color, size: 18 }), new TextRun({ text: `${SEVERITY[sv].label}    `, color: SLATE, size: 18 })]),
        }),
    );

    children.push(...heading(4, 'Metodologia (PTES)'));
    children.push(body('O engajamento seguiu as sete fases do Penetration Testing Execution Standard (PTES).'));
    children.push(chartPara('phaseStepper', 600, AlignmentType.CENTER));
    e.methodology.forEach((m) => {
        const ph = PTES_PHASES.find((p) => p.id === m.phase);
        children.push(sub(`${ph?.n}. ${m.title}`));
        m.activities.forEach((a) => children.push(bullet(a)));
    });

    children.push(...heading(5, 'Achados Detalhados'));
    children.push(findingsIndexTable(e.findings, primary));
    children.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [new TextRun({ text: 'Detalhamento dos achados', bold: true, color: INK, size: 22 })] }));
    [...e.findings].sort((a, b) => SEVERITY[b.severity].rank - SEVERITY[a.severity].rank || b.cvss - a.cvss).forEach((f) => children.push(...findingBlock(f)));

    children.push(...heading(6, 'Plano de Ação'));
    children.push(body('Roteiro priorizado por risco e esforço. Os quick wins (alto impacto, baixo esforço) vêm primeiro; o gráfico de prazos mostra o que leva mais e menos tempo.'));
    children.push(sub('Roteiro de remediação'));
    children.push(chartPara('roadmap', 600, AlignmentType.CENTER));
    children.push(twoCharts('quadrant', 270, 'timeBars', 300));
    children.push(sub('Itens de correção priorizados'));
    children.push(actionTable(items, primary));

    children.push(...heading(7, 'Apêndice'));
    children.push(sub('Recomendações estratégicas'));
    e.recommendations.forEach((r) =>
        children.push(
            new Paragraph({
                bullet: { level: 0 },
                spacing: { after: 30 },
                children: [new TextRun({ text: `${r.priority}: `, bold: true, color: WINDOW_COLOR[r.priority] }), new TextRun({ text: r.text, color: SLATE, size: 19 })],
            }),
        ),
    );
    children.push(sub('Aviso'));
    children.push(body(`Relatório gerado por ${e.branding.appName} a partir de um engajamento autorizado. Conteúdo confidencial; distribua apenas a partes autorizadas. As provas de conceito foram não destrutivas e limitadas ao escopo acordado.`));

    return new Document({
        creator: e.branding.appName,
        title: e.title,
        styles: { default: { document: { run: { font: 'Calibri' } } } },
        sections: [
            {
                properties: { titlePage: true, page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
                headers: {
                    first: new Header({ children: [new Paragraph({ children: [] })] }),
                    default: new Header({
                        children: [
                            new Paragraph({
                                tabStops: [{ type: 'right', position: 9360 }],
                                border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 2 } },
                                children: [new TextRun({ text: e.branding.appName.toUpperCase(), bold: true, color: primary, size: 16 }), new TextRun({ text: `\t${e.client} · ${e.classification}`, color: MUTED, size: 14 })],
                            }),
                        ],
                    }),
                },
                footers: {
                    first: new Footer({ children: [new Paragraph({ children: [] })] }),
                    default: new Footer({
                        children: [
                            new Paragraph({
                                tabStops: [{ type: 'right', position: 9360 }],
                                border: { top: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 2 } },
                                children: [new TextRun({ text: e.title, color: MUTED, size: 13 }), new TextRun({ children: ['\tPágina ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], color: MUTED, size: 13 })],
                            }),
                        ],
                    }),
                },
                children,
            },
        ],
    });
}

// ── helpers ─────────────────────────────────────────────────────────────────
function noBorders() {
    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    return { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
}
function cellPlain(children: (Paragraph | Table)[]) {
    return new TableCell({ children, margins: { top: 40, bottom: 40, left: 40, right: 40 } });
}
function clientLockup(e: Engagement) {
    const initials = e.branding.clientName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
    return new Table({
        width: { size: 50, type: WidthType.PERCENTAGE },
        borders: noBorders(),
        rows: [
            new TableRow({
                children: [
                    new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: hx(`#${e.branding.accent ?? CORAL}`) }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: initials, bold: true, color: 'FFFFFF', size: 28 })] })] }),
                    new TableCell({ verticalAlign: 'center', borders: noBorders(), children: [new Paragraph({ children: [new TextRun({ text: `  ${e.branding.clientName}`, bold: true, color: INK, size: 28 })] })] }),
                ],
            }),
        ],
    });
}
function kvTable(rows: [string, string][]) {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { ...noBorders(), insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LINE } },
        rows: rows.map(
            ([k, v]) =>
                new TableRow({
                    children: [
                        new TableCell({ width: { size: 26, type: WidthType.PERCENTAGE }, margins: { top: 60, bottom: 60, left: 40, right: 40 }, children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, color: MUTED, size: 18 })] })] }),
                        new TableCell({ margins: { top: 60, bottom: 60, left: 40, right: 40 }, children: [new Paragraph({ children: [new TextRun({ text: v, color: SLATE, size: 18 })] })] }),
                    ],
                }),
        ),
    });
}
function hcell(t: string, primary: string, w: number) {
    return new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: primary }, margins: { top: 50, bottom: 50, left: 60, right: 60 }, children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: 'FFFFFF', size: 16 })] })] });
}
function tcell(runs: TextRun[], w?: number) {
    return new TableCell({ width: w ? { size: w, type: WidthType.PERCENTAGE } : undefined, margins: { top: 40, bottom: 40, left: 60, right: 60 }, children: [new Paragraph({ children: runs })] });
}
function findingsIndexTable(findings: Finding[], primary: string) {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { ...noBorders(), insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LINE } },
        rows: [
            new TableRow({ tableHeader: true, children: [hcell('ID', primary, 8), hcell('Achado', primary, 56), hcell('Severidade', primary, 14), hcell('CVSS', primary, 8), hcell('Categoria', primary, 14)] }),
            ...[...findings].sort((a, b) => b.cvss - a.cvss).map((f) =>
                new TableRow({
                    children: [
                        tcell([new TextRun({ text: f.id, size: 16, color: SLATE })]),
                        tcell([new TextRun({ text: f.title, size: 16, color: SLATE })]),
                        tcell([new TextRun({ text: SEVERITY[f.severity].label, bold: true, size: 16, color: SEVERITY[f.severity].color })]),
                        tcell([new TextRun({ text: f.cvss.toFixed(1), size: 16, color: SLATE })]),
                        tcell([new TextRun({ text: f.category, size: 16, color: SLATE })]),
                    ],
                }),
            ),
        ],
    });
}
function findingBlock(f: Finding): Paragraph[] {
    const sv = SEVERITY[f.severity];
    const out: Paragraph[] = [
        new Paragraph({
            spacing: { before: 140, after: 20 },
            border: { left: { style: BorderStyle.SINGLE, size: 24, color: sv.color, space: 8 } },
            children: [new TextRun({ text: `${f.id} — ${f.title}  `, bold: true, color: INK, size: 22 }), new TextRun({ text: sv.label.toUpperCase(), bold: true, color: sv.color, size: 16 })],
        }),
        new Paragraph({ spacing: { after: 40 }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: sv.color, space: 8 } }, children: [new TextRun({ text: `CVSS ${f.cvss.toFixed(1)} · ${f.cwe} · ${f.category} · Afetado: ${f.affected.join(', ')}`, color: MUTED, size: 15 })] }),
        new Paragraph({ spacing: { after: 40 }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: sv.color, space: 8 } }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: f.description, color: SLATE, size: 18 })] }),
    ];
    if (f.evidence) {
        out.push(new Paragraph({ spacing: { after: 0, before: 20 }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: sv.color, space: 8 } }, children: [new TextRun({ text: f.evidence.caption, italics: true, color: MUTED, size: 15 })] }));
        f.evidence.code.split('\n').forEach((line) =>
            out.push(new Paragraph({ shading: { type: ShadingType.CLEAR, fill: INK }, spacing: { after: 0 }, children: [new TextRun({ text: line || ' ', font: 'Consolas', color: 'E2E8F0', size: 15 })] })),
        );
    }
    out.push(new Paragraph({ spacing: { before: 40 }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: sv.color, space: 8 } }, children: [new TextRun({ text: 'Impacto: ', bold: true, color: primaryOf(), size: 17 }), new TextRun({ text: f.businessImpact, color: SLATE, size: 18 })] }));
    out.push(new Paragraph({ spacing: { after: 40 }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: sv.color, space: 8 } }, children: [new TextRun({ text: 'Remediação: ', bold: true, color: primaryOf(), size: 17 }), new TextRun({ text: f.remediation, color: SLATE, size: 18 })] }));
    return out;
}
function primaryOf() {
    return BLUE;
}
function actionTable(items: ReturnType<typeof actionItems>, primary: string) {
    const sorted = [...items].sort((a, b) => WINDOWS.indexOf(a.window) - WINDOWS.indexOf(b.window) || SEVERITY[b.f.severity].rank - SEVERITY[a.f.severity].rank);
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { ...noBorders(), insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LINE } },
        rows: [
            new TableRow({ tableHeader: true, children: [hcell('Janela', primary, 16), hcell('ID', primary, 7), hcell('Ação de correção', primary, 51), hcell('Esforço', primary, 11), hcell('Prazo', primary, 8), hcell('QW', primary, 7)] }),
            ...sorted.map((a) =>
                new TableRow({
                    children: [
                        new TableCell({ shading: { type: ShadingType.CLEAR, fill: hx(WINDOW_COLOR[a.window]) }, margins: { top: 40, bottom: 40, left: 60, right: 60 }, children: [new Paragraph({ children: [new TextRun({ text: a.window, bold: true, color: 'FFFFFF', size: 14 })] })] }),
                        tcell([new TextRun({ text: a.f.id, size: 15, color: SLATE })]),
                        tcell([new TextRun({ text: a.f.remediation, size: 15, color: SLATE })]),
                        tcell([new TextRun({ text: EFFORT[a.effort].label, bold: true, size: 15, color: EFFORT[a.effort].color })]),
                        tcell([new TextRun({ text: `${a.etaDays}d`, size: 15, color: SLATE })]),
                        tcell([new TextRun({ text: a.quickWin ? '★' : '—', bold: true, size: 15, color: '059669' })]),
                    ],
                }),
            ),
        ],
    });
}
