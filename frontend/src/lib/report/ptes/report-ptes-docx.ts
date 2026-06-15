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
import { highlightSegments, HOT_FG_HEX } from './report-highlight';
import { SURICATOOS_LOGO_BADGE } from './report-logo-assets';
import { PTES_PHASES, type Engagement, type Finding } from './engagement';
import { actionItems, EFFORT, quickWins, SEVERITY, SEVERITY_ORDER, WINDOW_COLOR, WINDOWS } from './theme';

export type ChartImages = Record<string, string>; // key -> PNG data URI

// Direction 3 palette (indigo). COLORS.brand is the indigo; these hex-without-# tokens mirror
// theme.ts so the DOCX matches the PDF element-for-element.
const BLUE = '4F46E5'; // brand indigo (was the legacy blue; renamed value, kept the constant)
const INDIGO = '4F46E5';
const INDIGO_DARK = '3730A3';
const INDIGO_SOFT = 'EEF0FF'; // filled indigo chip / KPI / coverage-on background
const INDIGO_BORDER = 'C7C2F0';
const CORAL = 'FF7678';
const INK = '0F172A';
const SLATE = '334155';
const MUTED = '64748B';
const LINE = 'E2E8F0';
const PANEL = 'F4F6FB';
const PATH_BG = 'EEF0F3'; // kill-chain pill (cool/neutral)
const PATH_HOT_BG = 'FBEDEC'; // kill-chain pill — last two beats (coral-tinted)
const PATH_HOT_FG = 'C04A40';
const GREEN = '1F9E6E'; // remediation label
const CODE_FG = 'E2E8F0';
const SANS = 'Helvetica'; // Direction 3 is sans; Word maps Helvetica → Arial-like furniture
const MONO = 'Consolas';
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

// Render one code line as runs, highlighting the vuln-proving payload in yellow (Word highlight).
const codeRuns = (line: string): TextRun[] =>
    highlightSegments(line.length ? line : ' ').map((seg) =>
        txt({
            text: seg.text.length ? seg.text : ' ',
            font: MONO,
            size: 15,
            color: seg.hot ? HOT_FG_HEX : CODE_FG,
            highlight: seg.hot ? 'yellow' : undefined,
        }),
    );

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

// ── Direction 3 taxonomy derivation (mirrors report-book-pdf.tsx `refMatch`) ──
// Parse OWASP / MITRE / CVE from the references list when the explicit fields are absent.
const refMatch = (f: Finding, re: RegExp) => f.references.map((r) => r.label).find((l) => re.test(l));
const est = (p?: string) => p === 'estimated' || p === 'inferred';

interface FindingTaxonomy {
    owasp?: string;
    mitre?: string;
    cwe?: string;
    cves: string[];
    primaryAsset?: string;
    path: string[];
}
function findingTaxonomy(f: Finding): FindingTaxonomy {
    const owasp = f.owasp ?? refMatch(f, /owasp/i)?.replace(/^owasp\s*/i, '').trim();
    const mitre = f.mitre ?? refMatch(f, /mitre|\bT\d{4}/i)?.replace(/^mitre att&ck\s*/i, '').replace(/^mitre\s*/i, '').trim();
    const cwe = f.cwe && f.cwe !== '—' && !/^MITRE/i.test(f.cwe) ? f.cwe : undefined;
    const cves = f.cve ?? [];
    const a0 = f.assets?.[0];
    const primaryAsset = a0 ? a0.url || (a0.port ? `${a0.host}:${a0.port}` : a0.host) : f.affected[0];
    return { owasp, mitre, cwe, cves, primaryAsset, path: f.attackPath ?? [] };
}

// OWASP Top 10 (2021) — identical list/order to report-book-pdf.tsx.
const OWASP_2021: [string, string][] = [
    ['A01', 'Broken Access Control'],
    ['A02', 'Cryptographic Failures'],
    ['A03', 'Injection'],
    ['A04', 'Insecure Design'],
    ['A05', 'Security Misconfiguration'],
    ['A06', 'Vulnerable & Outdated Components'],
    ['A07', 'Identification & Auth Failures'],
    ['A08', 'Software & Data Integrity'],
    ['A09', 'Logging & Monitoring Failures'],
    ['A10', 'Server-Side Request Forgery'],
];

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
            fig.code.split('\n').slice(0, 40).forEach((line) => out.push(new Paragraph({ shading: { type: ShadingType.CLEAR, fill: INK }, spacing: { after: 0 }, children: codeRuns(line) })));
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

    // ── Cover — Direction 3: light/white, indigo left rail, display title, KPI cards ──
    const appLogo = e.branding.appLogo ?? SURICATOOS_LOGO_BADGE;
    const logoImg = safeImage(appLogo, 26, 26);
    // Brand row: app logo + name (left), classification pill (right).
    const brandRow = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders(),
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        borders: noBorders(),
                        verticalAlign: 'center',
                        children: [new Paragraph({ children: [...(logoImg ? [logoImg, txt({ text: '  ' })] : []), txt({ text: e.branding.appName.toUpperCase(), bold: true, color: primary, size: 26 })] })],
                    }),
                    new TableCell({
                        borders: { top: { style: BorderStyle.SINGLE, size: 4, color: CORAL }, bottom: { style: BorderStyle.SINGLE, size: 4, color: CORAL }, left: { style: BorderStyle.SINGLE, size: 4, color: CORAL }, right: { style: BorderStyle.SINGLE, size: 4, color: CORAL } },
                        verticalAlign: 'center',
                        margins: { top: 40, bottom: 40, left: 80, right: 80 },
                        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [txt({ text: e.classification, bold: true, color: CORAL, size: 16 })] })],
                    }),
                ],
            }),
        ],
    });

    // The cover's content column (everything to the right of the indigo rail).
    const coverContent: (Paragraph | Table)[] = [
        brandRow,
        new Paragraph({ spacing: { before: 520, after: 60 }, children: [txt({ text: 'RELATÓRIO DE PENTEST · PTES', bold: true, color: MUTED, size: 22 })] }),
        new Paragraph({ spacing: { after: 80 }, children: [txt({ text: e.title, bold: true, color: INK, size: 56 })] }),
        new Paragraph({ spacing: { after: 260 }, children: [txt({ text: `Preparado por ${e.branding.appName} para ${e.client}`, color: MUTED, size: 24 })] }),
        kpiCardsTable(e),
        new Paragraph({ spacing: { before: 320, after: 0 }, children: [] }),
        kvTable([
            ['Período', `${e.period.start} – ${e.period.end}`],
            ['Versão', e.version],
            ['Autor', e.author],
            ['Contato', e.contact],
            ['Metodologia', 'PTES — Penetration Testing Execution Standard'],
        ]),
        // OOXML requires a paragraph after a table inside a cell — keeps the nested layout valid.
        new Paragraph({ children: [] }),
    ];

    // Indigo left rail + content, as a 2-column table (the rail is a thin filled cell).
    const cover: (Paragraph | Table)[] = [
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders(),
            rows: [
                new TableRow({
                    children: [
                        new TableCell({ width: { size: 2, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: INDIGO }, borders: noBorders(), children: [new Paragraph({ spacing: { before: 600 }, children: [txt({ text: ' ' })] })] }),
                        new TableCell({ borders: noBorders(), margins: { top: 200, bottom: 200, left: 280, right: 80 }, children: coverContent }),
                    ],
                }),
            ],
        }),
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
    children.push(...coverageBlocks(e.findings));

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
        // Direction 3 is a sans report: a clean sans body (Helvetica → Arial-like on Word) replaces
        // the old Georgia serif; code/evidence keeps a mono (Consolas).
        styles: { default: { document: { run: { font: SANS } } } },
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

// One KPI card: label (small) over a big number. Optional `/100` suffix for the risk score.
function kpiCardCell(label: string, value: string, opts: { bg: string; lblColor: string; numColor: string; suffix?: string }) {
    return new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: opts.bg },
        margins: { top: 120, bottom: 120, left: 130, right: 130 },
        children: [
            new Paragraph({ spacing: { after: 30 }, children: [txt({ text: label, color: opts.lblColor, size: 18 })] }),
            new Paragraph({
                children: [
                    txt({ text: value, bold: true, color: opts.numColor, size: 40 }),
                    ...(opts.suffix ? [txt({ text: opts.suffix, color: MUTED, size: 20 })] : []),
                ],
            }),
        ],
    });
}

// Direction-3 cover KPI row: Risco geral / Críticos / Achados / Quick wins — mirrors the PDF.
function kpiCardsTable(e: Engagement) {
    const crit = e.findings.filter((f) => f.severity === 'critical').length;
    const qw = quickWins(e.findings).length;
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: { ...noBorders(), insideVertical: { style: BorderStyle.SINGLE, size: 6, color: 'FFFFFF' } },
        rows: [
            new TableRow({
                children: [
                    kpiCardCell('Risco geral', `${e.riskScore}`, { bg: INDIGO_SOFT, lblColor: '6663C9', numColor: INDIGO, suffix: '/100' }),
                    kpiCardCell('Críticos', `${crit}`, { bg: 'FBEDEC', lblColor: 'C04A40', numColor: 'E0483D' }),
                    kpiCardCell('Achados', `${e.findings.length}`, { bg: PANEL, lblColor: MUTED, numColor: INK }),
                    kpiCardCell('Quick wins', `${qw}`, { bg: PANEL, lblColor: MUTED, numColor: INK }),
                ],
            }),
        ],
    });
}

// A single taxonomy/severity "chip" run set rendered inside a shaded table cell, so the DOCX
// reproduces the PDF's pill look (rounded look approximated by tight padding + soft fill).
function chipCell(text: string, opts: { bg?: string; border?: string; color: string; mono?: boolean }) {
    const cellBorder = opts.border ? { style: BorderStyle.SINGLE, size: 4, color: opts.border } : { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    return new TableCell({
        shading: opts.bg ? { type: ShadingType.CLEAR, fill: opts.bg } : undefined,
        borders: { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder },
        margins: { top: 20, bottom: 20, left: 70, right: 70 },
        children: [new Paragraph({ children: [txt({ text, color: opts.color, size: 15, font: opts.mono ? MONO : SANS })] })],
    });
}

// A horizontal row of chips (taxonomy or path). Each chip is its own auto-width cell; the row is
// borderless so the chips read as inline pills. Spacer cell at the end absorbs remaining width.
function chipRowTable(cells: TableCell[]) {
    if (cells.length === 0) return new Paragraph({ children: [] });
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: 'autofit',
        borders: noBorders(),
        rows: [new TableRow({ children: [...cells, new TableCell({ borders: noBorders(), children: [new Paragraph({ children: [] })] })] })],
    });
}
function cellPlain(children: (Paragraph | Table)[]) {
    return new TableCell({ children, margins: { top: 40, bottom: 40, left: 40, right: 40 } });
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
// OWASP Top 10 (2021) coverage grid + observed MITRE ATT&CK technique chips — mirrors the PDF's
// CoverageMatrix. Covered cells are filled indigo with a count; MITRE techniques render as chips.
function coverageBlocks(findings: Finding[]): (Paragraph | Table)[] {
    const hay = (f: Finding) => `${f.owasp ?? ''} ${f.references.map((r) => r.label).join(' ')}`;
    const owaspHits = (code: string) => findings.filter((f) => hay(f).includes(code)).length;
    const mitre = Array.from(new Set(findings.map((f) => f.mitre ?? (hay(f).match(/T\d{4}(?:\.\d+)?/)?.[0] ?? '')).filter(Boolean)));

    const covCell = (code: string, name: string) => {
        const n = owaspHits(code);
        const on = n > 0;
        const cb = { style: BorderStyle.SINGLE, size: 4, color: on ? INDIGO_BORDER : LINE };
        return new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill: on ? INDIGO_SOFT : 'FFFFFF' },
            borders: { top: cb, bottom: cb, left: cb, right: cb },
            margins: { top: 50, bottom: 50, left: 70, right: 70 },
            children: [
                new Paragraph({ spacing: { after: 0 }, children: [txt({ text: `${code}${on ? `  ·  ${n}` : ''}`, bold: true, color: on ? INDIGO_DARK : MUTED, size: 16 })] }),
                new Paragraph({ children: [txt({ text: name, color: on ? SLATE : MUTED, size: 13 })] }),
            ],
        });
    };
    const rows: TableRow[] = [];
    for (let i = 0; i < OWASP_2021.length; i += 5) {
        rows.push(new TableRow({ children: OWASP_2021.slice(i, i + 5).map(([c, nm]) => covCell(c, nm)) }));
    }

    const out: (Paragraph | Table)[] = [
        new Paragraph({ spacing: { before: 180, after: 40 }, children: [txt({ text: 'Cobertura — OWASP Top 10 (2021)', bold: true, color: INK, size: 22 })] }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { ...noBorders(), insideHorizontal: { style: BorderStyle.SINGLE, size: 8, color: 'FFFFFF' }, insideVertical: { style: BorderStyle.SINGLE, size: 8, color: 'FFFFFF' } }, rows }),
    ];
    if (mitre.length > 0) {
        out.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [txt({ text: 'Técnicas MITRE ATT&CK observadas', bold: true, color: INK, size: 22 })] }));
        out.push(chipRowTable(mitre.map((t) => chipCell(t, { border: LINE, color: SLATE }))));
    }
    return out;
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
// Direction-3 FindingCard for the DOCX: a single bordered card (thick severity left rail) holding
// the header (id + severity pill), title, taxonomy chips, kill-chain path, description, evidence
// code, numbered "Reprodução", and a two-column Impacto / Remediação. Mirrors report-book-pdf.tsx.
function findingBlock(f: Finding): (Paragraph | Table)[] {
    const sv = SEVERITY[f.severity];
    const cvssEst = est(f.provenance?.cvss);
    const sevEst = est(f.provenance?.severity);
    const tax = findingTaxonomy(f);
    const inner: (Paragraph | Table)[] = [];

    // Header: ID (muted) + severity pill (with optional "SEV. EST." marker).
    inner.push(
        new Paragraph({
            spacing: { after: 20 },
            children: [
                txt({ text: f.id, bold: true, color: MUTED, size: 15 }),
                txt({ text: '    ' }),
                ...(sevEst ? [txt({ text: 'SEV. EST.  ', bold: true, color: '92400E', size: 13 })] : []),
                txt({ text: ` ${sv.label} `, bold: true, color: sv.color, size: 15, shading: { type: ShadingType.CLEAR, fill: sv.soft } }),
            ],
        }),
    );
    inner.push(new Paragraph({ spacing: { after: 60 }, children: [txt({ text: f.title, bold: true, color: INK, size: 25 })] }));

    // Taxonomy chips: CVSS (filled indigo), CWE, OWASP, MITRE, each CVE, primary asset (mono).
    const chips: TableCell[] = [];
    chips.push(chipCell(`CVSS ${f.cvss.toFixed(1)}${cvssEst ? ' (est.)' : ''}`, { bg: INDIGO_SOFT, color: INDIGO_DARK }));
    if (tax.cwe) chips.push(chipCell(tax.cwe, { border: LINE, color: SLATE }));
    if (tax.owasp) chips.push(chipCell(`OWASP ${tax.owasp}`, { border: LINE, color: SLATE }));
    if (tax.mitre) chips.push(chipCell(`MITRE ${tax.mitre}`, { border: LINE, color: SLATE }));
    tax.cves.forEach((c) => chips.push(chipCell(c, { border: LINE, color: SLATE })));
    if (tax.primaryAsset) chips.push(chipCell(tax.primaryAsset, { border: LINE, color: INK, mono: true }));
    inner.push(chipRowTable(chips));

    // Kill-chain mini-path: pills with arrows; the last two beats are emphasized (coral-tinted).
    if (tax.path.length > 0) {
        const pathCells: TableCell[] = [];
        tax.path.forEach((b, i) => {
            const hot = i >= tax.path.length - 2;
            pathCells.push(chipCell(b, hot ? { bg: PATH_HOT_BG, color: PATH_HOT_FG } : { bg: PATH_BG, color: MUTED }));
            if (i < tax.path.length - 1) {
                pathCells.push(new TableCell({ borders: noBorders(), verticalAlign: 'center', margins: { left: 30, right: 30 }, children: [new Paragraph({ children: [txt({ text: '→', color: 'C8CBD2', size: 16 })] })] }));
            }
        });
        inner.push(new Paragraph({ spacing: { before: 60, after: 0 }, children: [] }));
        inner.push(chipRowTable(pathCells));
    }

    inner.push(new Paragraph({ spacing: { before: 80, after: 40 }, alignment: AlignmentType.JUSTIFIED, children: [txt({ text: f.description, color: SLATE, size: 18 })] }));

    // Evidence code block.
    if (f.evidence) {
        inner.push(new Paragraph({ spacing: { before: 40, after: 0 }, children: [txt({ text: f.evidence.caption, italics: true, color: MUTED, size: 14 })] }));
        f.evidence.code.split('\n').forEach((line) =>
            inner.push(new Paragraph({ shading: { type: ShadingType.CLEAR, fill: INK }, spacing: { after: 0 }, children: codeRuns(line) })),
        );
    }

    // Numbered "Reprodução".
    if (f.reproSteps && f.reproSteps.length > 0) {
        inner.push(new Paragraph({ spacing: { before: 100, after: 30 }, children: [txt({ text: 'REPRODUÇÃO', bold: true, color: INDIGO, size: 15 })] }));
        f.reproSteps.slice(0, 8).forEach((st, i) =>
            inner.push(new Paragraph({ spacing: { after: 20 }, children: [txt({ text: `${i + 1}. `, bold: true, color: INDIGO, size: 17 }), txt({ text: st, color: SLATE, size: 17 })] })),
        );
    }

    // Two-column Impacto ao negócio / Remediação.
    inner.push(
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { ...noBorders(), insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'FFFFFF' } },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 50, type: WidthType.PERCENTAGE },
                            borders: noBorders(),
                            margins: { top: 120, bottom: 40, left: 0, right: 80 },
                            children: [
                                new Paragraph({ spacing: { after: 30 }, children: [txt({ text: 'IMPACTO AO NEGÓCIO', bold: true, color: INDIGO, size: 15 })] }),
                                new Paragraph({ children: [txt({ text: f.businessImpact, color: SLATE, size: 18 })] }),
                            ],
                        }),
                        new TableCell({
                            width: { size: 50, type: WidthType.PERCENTAGE },
                            borders: noBorders(),
                            margins: { top: 120, bottom: 40, left: 80, right: 0 },
                            children: [
                                new Paragraph({ spacing: { after: 30 }, children: [txt({ text: 'REMEDIAÇÃO', bold: true, color: GREEN, size: 15 })] }),
                                new Paragraph({ children: [txt({ text: f.remediation, color: SLATE, size: 18 })] }),
                            ],
                        }),
                    ],
                }),
            ],
        }),
    );

    // Affected assets + references + estimated note.
    inner.push(new Paragraph({ spacing: { before: 80, after: 20 }, children: [txt({ text: 'ATIVOS AFETADOS', bold: true, color: INDIGO, size: 15 })] }));
    if (f.assets && f.assets.length > 0) {
        f.assets.slice(0, 8).forEach((a) =>
            inner.push(new Paragraph({ spacing: { after: 10 }, children: [txt({ text: a.port ? `${a.host}:${a.port}` : a.host, font: MONO, color: INK, size: 15 }), ...((a.service || a.url) ? [txt({ text: `  ${[a.service, a.url].filter(Boolean).join(' · ')}`, color: MUTED, size: 14 })] : [])] })),
        );
    } else {
        inner.push(new Paragraph({ spacing: { after: 10 }, children: [txt({ text: f.affected.length ? f.affected.join(', ') : '—', color: SLATE, size: 17 })] }));
    }
    if (f.references.length > 0) {
        inner.push(new Paragraph({ spacing: { before: 60 }, children: [txt({ text: `Referências: ${f.references.map((r) => r.label).join(' · ')}`, italics: true, color: MUTED, size: 14 })] }));
    }
    if (f.estimatedNote) {
        inner.push(new Paragraph({ spacing: { before: 60, after: 0 }, shading: { type: ShadingType.CLEAR, fill: 'FFFBEB' }, border: { left: { style: BorderStyle.SINGLE, size: 24, color: 'F59E0B', space: 8 } }, children: [txt({ text: `Nota: ${f.estimatedNote}`, italics: true, color: '92400E', size: 14 })] }));
    }

    // Card frame: thick severity left rail + thin grey border on the other three sides.
    const thin = { style: BorderStyle.SINGLE, size: 4, color: LINE };
    return [
        new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders(),
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            borders: { top: thin, bottom: thin, right: thin, left: { style: BorderStyle.SINGLE, size: 24, color: sv.color } },
                            margins: { top: 140, bottom: 140, left: 160, right: 160 },
                            children: inner,
                        }),
                    ],
                }),
            ],
        }),
        new Paragraph({ spacing: { after: 140 }, children: [] }),
    ];
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
