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
import { stripControlChars } from './from-flow-llm';
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

// Sanitize at the chokepoint: OOXML forbids control characters, and the `docx` library (unlike
// pptxgenjs, which sanitizes internally) writes run text into the XML VERBATIM. So strip ANSI/
// control chars from EVERY TextRun built here — no upstream field (terminal excerpts, AI text,
// titles, captions) can corrupt the .docx. `_TR` is the real constructor; every run is built
// through `txt(...)` instead of `new TextRun(...)`.
const _TR = TextRun;
const txt = (o: ConstructorParameters<typeof TextRun>[0]): TextRun => {
    if (typeof o === 'string') return new _TR(stripControlChars(o));
    if (typeof (o as { text?: unknown }).text === 'string') {
        return new _TR({ ...(o as object), text: stripControlChars((o as { text: string }).text) } as ConstructorParameters<typeof TextRun>[0]);
    }
    return new _TR(o);
};

const decode = (dataUri: string): Uint8Array => {
    try {
        const b64 = dataUri.split(',')[1] ?? '';
        const bin = atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    } catch {
        // Malformed/non-base64 data URI (e.g. a failed fetch returned a non-image). Return empty
        // so imageSize() rejects it and the caller degrades to a caption instead of throwing.
        return new Uint8Array(0);
    }
};

// Minimal PNG/JPEG intrinsic-size reader so embedded screenshots keep their aspect ratio.
function imageSize(bytes: Uint8Array): null | { w: number; h: number } {
    if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
        const w = ((bytes[16]! << 24) | (bytes[17]! << 16) | (bytes[18]! << 8) | bytes[19]!) >>> 0;
        const h = ((bytes[20]! << 24) | (bytes[21]! << 16) | (bytes[22]! << 8) | bytes[23]!) >>> 0;
        if (w > 0 && h > 0) return { h, w };
    }
    if (bytes.length > 10 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        let i = 2;
        while (i + 9 < bytes.length) {
            if (bytes[i] !== 0xff) {
                i++;
                continue;
            }
            const marker = bytes[i + 1]!;
            if (marker >= 0xc0 && marker <= 0xc3) {
                const h = (bytes[i + 5]! << 8) | bytes[i + 6]!;
                const w = (bytes[i + 7]! << 8) | bytes[i + 8]!;
                if (w > 0 && h > 0) return { h, w };
            }
            const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
            if (len <= 0) break;
            i += 2 + len;
        }
    }
    return null;
}

// Build an ImageRun only when the data URI decodes to a REAL PNG/JPEG. A failed image fetch (chart,
// logo, or screenshot) can return an HTML error page; embedding those bytes corrupts the .docx.
// Returns null so the caller can skip the embed.
function safeImage(dataUri: string | undefined, width: number, height: number): ImageRun | null {
    if (!dataUri || !dataUri.startsWith('data:')) return null;
    const data = decode(dataUri);
    const size = imageSize(data);
    if (!size) return null;
    const mime = dataUri.slice(5, Math.max(5, dataUri.indexOf(';')));
    const type: 'jpg' | 'png' = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';
    return new ImageRun({ type, data, transformation: { width, height } });
}

// Evidence plates for the DOCX: terminal/tool-output excerpts render as shaded code; screenshots
// embed the resolved image (aspect-preserved) or degrade to a caption when not resolved.
function figuresBlocks(e: Engagement): (Paragraph | Table)[] {
    const out: (Paragraph | Table)[] = [];
    for (const fig of e.figures ?? []) {
        out.push(new Paragraph({ spacing: { before: 160, after: 10 }, children: [txt({ text: `${fig.id} — ${fig.caption}`, bold: true, color: INK, size: 18 })] }));
        const links = [fig.findingIds.length ? `Referente a: ${fig.findingIds.join(', ')}` : '', fig.capturedUrl ? `URL: ${fig.capturedUrl}` : ''].filter(Boolean).join('   ·   ');
        if (links) out.push(new Paragraph({ spacing: { after: 30 }, children: [txt({ text: links, color: MUTED, size: 14 })] }));
        if (fig.kind === 'screenshot') {
            // ONLY embed when the bytes are a real PNG/JPEG (safeImage guards this). A failed
            // screenshot fetch can return an auth/error page (HTML); non-image bytes corrupt the
            // .docx. When it's not a valid image, fall back to the caption.
            const raw = fig.imageSrc?.startsWith('data:') ? decode(fig.imageSrc) : null;
            const size = raw ? imageSize(raw) : null;
            const w = size ? Math.min(460, size.w) : 0;
            const img = size ? safeImage(fig.imageSrc, w, Math.min(560, Math.round((w * size.h) / size.w))) : null;
            if (img) {
                out.push(new Paragraph({ spacing: { after: 80 }, children: [img] }));
            } else {
                out.push(new Paragraph({ spacing: { after: 60 }, children: [txt({ text: 'Captura de tela registrada durante a execução.', italics: true, color: MUTED, size: 15 })] }));
            }
        } else if (fig.code) {
            fig.code.split('\n').slice(0, 40).forEach((line) => out.push(new Paragraph({ shading: { type: ShadingType.CLEAR, fill: INK }, spacing: { after: 0 }, children: [txt({ text: line || ' ', font: 'Consolas', color: 'E2E8F0', size: 14 })] })));
            out.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        }
    }
    return out;
}

export function buildPtesDocx(e: Engagement, images: ChartImages): Document {
    const primary = e.branding.primary ?? BLUE;

    const aspect = (key: string) => {
        const c = CHART_SPECS.find((s) => s.key === key)!;
        return c.h / c.w;
    };
    const chartPara = (key: string, widthPx: number, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) => {
        const img = safeImage(images[key], widthPx, Math.round(widthPx * aspect(key)));
        return new Paragraph({ alignment: align, spacing: { before: 80, after: 80 }, children: img ? [img] : [] });
    };
    const twoCharts = (a: string, aw: number, b: string, bw: number) =>
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders(),
            rows: [new TableRow({ children: [cellPlain([chartPara(a, aw, AlignmentType.CENTER)]), cellPlain([chartPara(b, bw, AlignmentType.CENTER)])] })],
        });

    const heading = (n: number, title: string) => [
        new Paragraph({ spacing: { before: 220, after: 0 }, children: [txt({ text: `SEÇÃO ${n}`, bold: true, color: primary, size: 16 })] }),
        new Paragraph({
            spacing: { after: 60 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: primary, space: 4 } },
            children: [txt({ text: title, bold: true, color: INK, size: 30 })],
        }),
    ];
    const sub = (t: string) => new Paragraph({ spacing: { before: 120, after: 40 }, children: [txt({ text: t, bold: true, color: INK, size: 22 })] });
    const body = (t: string) => new Paragraph({ spacing: { after: 100 }, alignment: AlignmentType.JUSTIFIED, children: [txt({ text: t, color: SLATE, size: 19 })] });
    const bullet = (t: string) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 30 }, children: [txt({ text: t, color: SLATE, size: 19 })] });

    // ── Cover ──
    const appLogo = e.branding.appLogo ?? SURICATOOS_LOGO_BADGE;
    const logoImg = safeImage(appLogo, 72, 72);
    const cover: (Paragraph | Table)[] = [
        new Paragraph({ spacing: { before: 600, after: 0 }, children: logoImg ? [logoImg] : [] }),
        new Paragraph({ spacing: { before: 60, after: 0 }, children: [txt({ text: e.branding.appName.toUpperCase(), bold: true, color: primary, size: 44 })] }),
        new Paragraph({ spacing: { before: 200, after: 60 }, children: [txt({ text: 'RELATÓRIO DE PENTEST · PTES', bold: true, color: CORAL, size: 22 })] }),
        new Paragraph({ spacing: { after: 200 }, children: [txt({ text: e.title, bold: true, color: INK, size: 48 })] }),
        new Paragraph({ spacing: { after: 40 }, children: [txt({ text: `Preparado por ${e.branding.appName} para`, color: MUTED, size: 18 })] }),
        clientLockup(e),
        new Paragraph({ spacing: { before: 120, after: 300 }, children: [txt({ text: ` ${e.classification} `, bold: true, color: CORAL, size: 18 })] }),
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
                txt({ text: `${e.findings.length} achados   `, bold: true, color: INK, size: 22 }),
                txt({ text: `${e.findings.filter((f) => f.severity === 'critical').length} críticos   `, bold: true, color: SEVERITY.critical.color, size: 22 }),
                txt({ text: `${quickWins(e.findings).length} quick wins`, bold: true, color: '059669', size: 22 }),
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
                    txt({ text: `${st.n}. ${st.title}  `, bold: true, color: INK, size: 21 }),
                    ...(st.refs?.length ? [txt({ text: `[${st.refs.join(', ')}]`, bold: true, color: primary, size: 15 })] : []),
                ],
            }),
        );
        children.push(new Paragraph({ spacing: { after: 60 }, alignment: AlignmentType.JUSTIFIED, children: [txt({ text: st.text, color: SLATE, size: 19 })] }));
    });

    children.push(...heading(3, 'Visão Geral de Risco'));
    children.push(body('Distribuição de risco por probabilidade e impacto, e concentração por categoria de superfície avaliada.'));
    children.push(twoCharts('matrix', 280, 'categories', 300));
    children.push(
        new Paragraph({
            spacing: { before: 60 },
            children: SEVERITY_ORDER.flatMap((sv) => [txt({ text: '■ ', color: SEVERITY[sv].color, size: 18 }), txt({ text: `${SEVERITY[sv].label}    `, color: SLATE, size: 18 })]),
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
    children.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [txt({ text: 'Detalhamento dos achados', bold: true, color: INK, size: 22 })] }));
    [...e.findings].sort((a, b) => SEVERITY[b.severity].rank - SEVERITY[a.severity].rank || b.cvss - a.cvss).forEach((f) => children.push(...findingBlock(f)));

    children.push(...heading(6, 'Plano de Ação'));
    children.push(body('Roteiro priorizado por risco e esforço. Os quick wins (alto impacto, baixo esforço) vêm primeiro; o gráfico de prazos mostra o que leva mais e menos tempo.'));
    children.push(sub('Roteiro de remediação'));
    children.push(chartPara('roadmap', 600, AlignmentType.CENTER));
    children.push(twoCharts('quadrant', 270, 'timeBars', 300));
    children.push(sub('Itens de correção priorizados'));
    children.push(actionTable(items, primary));

    if ((e.figures?.length ?? 0) > 0) {
        children.push(...heading(7, 'Evidências'));
        children.push(body('Plano de evidências numerado: saídas reais de ferramentas e capturas de tela registradas durante a execução, vinculadas aos achados correspondentes.'));
        children.push(...figuresBlocks(e));
    }
    const apx = (e.figures?.length ?? 0) > 0 ? 8 : 7;
    children.push(...heading(apx, 'Apêndice'));
    children.push(sub('Recomendações estratégicas'));
    e.recommendations.forEach((r) =>
        children.push(
            new Paragraph({
                bullet: { level: 0 },
                spacing: { after: 30 },
                children: [txt({ text: `${r.priority}: `, bold: true, color: WINDOW_COLOR[r.priority] }), txt({ text: r.text, color: SLATE, size: 19 })],
            }),
        ),
    );
    children.push(sub('Aviso'));
    children.push(body(`Relatório gerado por ${e.branding.appName} a partir de um engajamento autorizado. Conteúdo confidencial; distribua apenas a partes autorizadas. As provas de conceito foram não destrutivas e limitadas ao escopo acordado.`));

    return new Document({
        creator: stripControlChars(e.branding.appName),
        title: stripControlChars(e.title),
        // Serif body to match the PDF's "book" voice (Georgia ships with Word everywhere).
        styles: { default: { document: { run: { font: 'Georgia' } } } },
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
                                children: [txt({ text: e.branding.appName.toUpperCase(), bold: true, color: primary, size: 16 }), txt({ text: `\t${e.client} · ${e.classification}`, color: MUTED, size: 14 })],
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
                                children: [txt({ text: e.title, color: MUTED, size: 13 }), txt({ children: ['\tPágina ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], color: MUTED, size: 13 })],
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
                    new TableCell({ width: { size: 14, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: hx(`#${e.branding.accent ?? CORAL}`) }, margins: { top: 80, bottom: 80, left: 80, right: 80 }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [txt({ text: initials, bold: true, color: 'FFFFFF', size: 28 })] })] }),
                    new TableCell({ verticalAlign: 'center', borders: noBorders(), children: [new Paragraph({ children: [txt({ text: `  ${e.branding.clientName}`, bold: true, color: INK, size: 28 })] })] }),
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
                        new TableCell({ width: { size: 26, type: WidthType.PERCENTAGE }, margins: { top: 60, bottom: 60, left: 40, right: 40 }, children: [new Paragraph({ children: [txt({ text: k, bold: true, color: MUTED, size: 18 })] })] }),
                        new TableCell({ margins: { top: 60, bottom: 60, left: 40, right: 40 }, children: [new Paragraph({ children: [txt({ text: v, color: SLATE, size: 18 })] })] }),
                    ],
                }),
        ),
    });
}
function hcell(t: string, primary: string, w: number) {
    return new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: primary }, margins: { top: 50, bottom: 50, left: 60, right: 60 }, children: [new Paragraph({ children: [txt({ text: t, bold: true, color: 'FFFFFF', size: 16 })] })] });
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
                        tcell([txt({ text: f.id, size: 16, color: SLATE })]),
                        tcell([txt({ text: f.title, size: 16, color: SLATE })]),
                        tcell([txt({ text: SEVERITY[f.severity].label, bold: true, size: 16, color: SEVERITY[f.severity].color })]),
                        tcell([txt({ text: f.cvss.toFixed(1), size: 16, color: SLATE })]),
                        tcell([txt({ text: f.category, size: 16, color: SLATE })]),
                    ],
                }),
            ),
        ],
    });
}
function findingBlock(f: Finding): Paragraph[] {
    const sv = SEVERITY[f.severity];
    const est = (p?: string) => p === 'estimated' || p === 'inferred';
    const cvssTag = est(f.provenance?.cvss) ? ' (est.)' : '';
    const sevTag = est(f.provenance?.severity) ? ' (est.)' : '';
    const out: Paragraph[] = [
        new Paragraph({
            spacing: { before: 140, after: 20 },
            border: { left: { style: BorderStyle.SINGLE, size: 24, color: sv.color, space: 8 } },
            children: [txt({ text: `${f.id} — ${f.title}  `, bold: true, color: INK, size: 22 }), txt({ text: `${sv.label.toUpperCase()}${sevTag}`, bold: true, color: sv.color, size: 16 })],
        }),
        new Paragraph({ spacing: { after: 40 }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: sv.color, space: 8 } }, children: [txt({ text: `CVSS ${f.cvss.toFixed(1)}${cvssTag} · ${f.cwe} · ${f.category} · Afetado: ${f.affected.join(', ')}`, color: MUTED, size: 15 })] }),
        new Paragraph({ spacing: { after: 40 }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: sv.color, space: 8 } }, alignment: AlignmentType.JUSTIFIED, children: [txt({ text: f.description, color: SLATE, size: 18 })] }),
    ];
    if (f.evidence) {
        out.push(new Paragraph({ spacing: { after: 0, before: 20 }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: sv.color, space: 8 } }, children: [txt({ text: f.evidence.caption, italics: true, color: MUTED, size: 15 })] }));
        f.evidence.code.split('\n').forEach((line) =>
            out.push(new Paragraph({ shading: { type: ShadingType.CLEAR, fill: INK }, spacing: { after: 0 }, children: [txt({ text: line || ' ', font: 'Consolas', color: 'E2E8F0', size: 15 })] })),
        );
    }
    out.push(new Paragraph({ spacing: { before: 40 }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: sv.color, space: 8 } }, children: [txt({ text: 'Impacto: ', bold: true, color: primaryOf(), size: 17 }), txt({ text: f.businessImpact, color: SLATE, size: 18 })] }));
    out.push(new Paragraph({ spacing: { after: 40 }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: sv.color, space: 8 } }, children: [txt({ text: 'Remediação: ', bold: true, color: primaryOf(), size: 17 }), txt({ text: f.remediation, color: SLATE, size: 18 })] }));
    if (f.estimatedNote) {
        out.push(new Paragraph({ spacing: { before: 20, after: 60 }, shading: { type: ShadingType.CLEAR, fill: 'FFFBEB' }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: 'F59E0B', space: 8 } }, children: [txt({ text: `Nota: ${f.estimatedNote}`, italics: true, color: '92400E', size: 15 })] }));
    }
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
                        new TableCell({ shading: { type: ShadingType.CLEAR, fill: hx(WINDOW_COLOR[a.window]) }, margins: { top: 40, bottom: 40, left: 60, right: 60 }, children: [new Paragraph({ children: [txt({ text: a.window, bold: true, color: 'FFFFFF', size: 14 })] })] }),
                        tcell([txt({ text: a.f.id, size: 15, color: SLATE })]),
                        tcell([txt({ text: a.f.remediation, size: 15, color: SLATE })]),
                        tcell([txt({ text: EFFORT[a.effort].label, bold: true, size: 15, color: EFFORT[a.effort].color })]),
                        tcell([txt({ text: `${a.etaDays}d`, size: 15, color: SLATE })]),
                        tcell([txt({ text: a.quickWin ? '★' : '—', bold: true, size: 15, color: '059669' })]),
                    ],
                }),
            ),
        ],
    });
}
