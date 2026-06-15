// Premium PTES report — PowerPoint deck (Direction 3: modern magazine, light, indigo accent).
// An executive deck that carries the same visual system as the PDF flagship (report-book-pdf.tsx):
// a light cover with an indigo left rail + display title + 4 KPI tiles, a risk slide with the
// severity breakdown + OWASP Top 10 (2021) coverage + observed MITRE techniques, per-finding
// slides with the FindingCard anatomy (severity rail + taxonomy chips + kill-chain mini-path +
// evidence + Impacto/Remediação), and a closing remediation-roadmap slide.
// Charts are embedded as the exact same images rasterized from the PDF's vector charts.
import pptxgen from 'pptxgenjs';

import { CHART_SPECS } from './report-charts-sheet';
import { highlightSegments, HOT_BG_HEX, HOT_FG_HEX } from './report-highlight';
import { SURICATOOS_LOGO_BADGE } from './report-logo-assets';
import { type Engagement, type Finding } from './engagement';
import { actionItems, COLORS, EFFORT, quickWins, riskRating, SEVERITY, SEVERITY_ORDER, WINDOW_COLOR, WINDOWS } from './theme';

export type ChartImages = Record<string, string>; // key -> PNG data URI

// Direction-3 palette (hex without '#', as pptxgenjs expects). Mirrors COLORS + the PDF's
// per-tile/per-chip tints so all three formats look like one product.
const hex = (c: string) => c.replace('#', '');
const BRAND = hex(COLORS.brand); // indigo #4F46E5
const BRAND_DARK = hex(COLORS.brandDark); // #3730A3
const CORAL = hex(COLORS.coral);
const INK = hex(COLORS.ink);
const SLATE = hex(COLORS.slate);
const MUTED = hex(COLORS.muted);
const LINE = hex(COLORS.line);
const PANEL = hex(COLORS.panel);
const PAPER = 'FFFFFF';
const GREEN = '059669';
// indigo chip/coverage tints (same as report-book-pdf.tsx)
const CHIP_FILL = 'EEF0FF';
const CHIP_INK = '3730A3';
const COV_BORDER = 'C7C2F0';
const KPI_RISK = 'EEF0FF';
const KPI_CRIT = 'FBEDEC';
// kill-chain mini-path tints
const PATH_FILL = 'EEF0F3';
const PATH_HOT_FILL = 'FBEDEC';
const PATH_HOT_INK = 'C04A40';

const aspect = (key: string) => {
    const c = CHART_SPECS.find((s) => s.key === key)!;
    return c.h / c.w;
};

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

// Derive OWASP / MITRE / CVE from a finding's explicit fields, falling back to scanning
// references[].label — exactly like report-book-pdf.tsx (refMatch + CoverageMatrix).
const refMatch = (f: Finding, re: RegExp) => f.references.map((r) => r.label).find((l) => re.test(l));
const taxonomy = (f: Finding) => {
    const owasp = f.owasp ?? refMatch(f, /owasp/i)?.replace(/^owasp\s*/i, '').trim();
    const mitre = f.mitre ?? refMatch(f, /mitre|\bT\d{4}/i)?.replace(/^mitre att&ck\s*/i, '').replace(/^mitre\s*/i, '').trim();
    const cwe = f.cwe && f.cwe !== '—' && !/^MITRE/i.test(f.cwe) ? f.cwe : undefined;
    const cves = f.cve ?? [];
    const a0 = f.assets?.[0];
    const primaryAsset = a0 ? a0.url || (a0.port ? `${a0.host}:${a0.port}` : a0.host) : f.affected[0];
    return { owasp, mitre, cwe, cves, primaryAsset };
};

export function buildPtesPptx(e: Engagement, images: ChartImages): pptxgen {
    const pptx = new pptxgen();
    pptx.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
    pptx.layout = 'W';
    pptx.author = e.branding.appName;
    pptx.company = e.branding.appName;
    const primary = e.branding.primary ?? BRAND;

    // Light base master with an indigo left rail + footer furniture (Direction 3).
    pptx.defineSlideMaster({
        title: 'BASE',
        background: { color: PAPER },
        objects: [
            { rect: { x: 0, y: 0, w: 0.16, h: '100%', fill: { color: primary } } },
            { rect: { x: 0, y: 7.12, w: '100%', h: 0.005, fill: { color: LINE } } },
            { text: { text: e.branding.appName.toUpperCase(), options: { x: 0.45, y: 7.14, w: 6, h: 0.32, fontSize: 8, color: primary, bold: true, charSpacing: 1, valign: 'middle' } } },
            { text: { text: `${e.client} · ${e.classification}`, options: { x: 7.3, y: 7.14, w: 5.6, h: 0.32, fontSize: 8, color: MUTED, align: 'right', valign: 'middle' } } },
        ],
    });

    const img = (s: pptxgen.Slide, key: string, x: number, y: number, w: number) => {
        if (!images[key]) return;
        s.addImage({ data: images[key], x, y, w, h: w * aspect(key) });
    };
    // Section opener (kicker + display title + short indigo rule), mirrors the PDF Section.
    const section = (s: pptxgen.Slide, kicker: string, title: string) => {
        s.addText(kicker.toUpperCase(), { x: 0.5, y: 0.34, w: 12, h: 0.3, fontSize: 11, bold: true, color: primary, charSpacing: 1 });
        s.addText(title, { x: 0.5, y: 0.62, w: 12.3, h: 0.62, fontSize: 26, bold: true, color: INK });
        s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.3, w: 0.62, h: 0.035, fill: { color: primary } });
    };
    // A small pill/chip used for taxonomy + MITRE listings.
    const chip = (s: pptxgen.Slide, text: string, x: number, y: number, w: number, opts?: { filled?: boolean; mono?: boolean }) => {
        const filled = opts?.filled ?? false;
        s.addText(text, {
            x, y, w, h: 0.28,
            fontSize: 8.5,
            bold: filled,
            color: filled ? CHIP_INK : SLATE,
            fill: { color: filled ? CHIP_FILL : PAPER },
            line: filled ? undefined : { color: LINE, width: 0.75 },
            align: 'center',
            valign: 'middle',
            fontFace: opts?.mono ? 'Consolas' : undefined,
            rectRadius: 0.04,
            shape: pptx.ShapeType.roundRect,
        });
    };

    const qw = quickWins(e.findings);
    const critCount = e.findings.filter((f) => f.severity === 'critical').length;

    // ── 1. Title slide ── light, indigo rail, display title, 4 KPI tiles ──
    const c = pptx.addSlide();
    c.background = { color: PAPER };
    c.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: '100%', fill: { color: primary } });
    const appLogo = e.branding.appLogo ?? SURICATOOS_LOGO_BADGE;
    c.addImage({ data: appLogo, x: 0.8, y: 0.62, w: 0.62, h: 0.62 });
    c.addText(e.branding.appName.toUpperCase(), { x: 1.55, y: 0.62, w: 7, h: 0.62, fontSize: 18, bold: true, color: primary, charSpacing: 1, valign: 'middle' });
    // classification chip (coral outline), top-right
    c.addText(e.classification, { x: 10.4, y: 0.66, w: 2.3, h: 0.36, fontSize: 10, bold: true, color: CORAL, align: 'center', valign: 'middle', charSpacing: 1, line: { color: CORAL, width: 1 }, rectRadius: 0.03, shape: pptx.ShapeType.roundRect });

    c.addText('RELATÓRIO DE PENTEST · PTES', { x: 0.8, y: 1.95, w: 11.5, h: 0.35, fontSize: 12, bold: true, color: MUTED, charSpacing: 3 });
    c.addText(e.title, { x: 0.78, y: 2.32, w: 11.8, h: 1.7, fontSize: 33, bold: true, color: INK, valign: 'top' });
    c.addText(`Preparado por ${e.branding.appName} para ${e.client}`, { x: 0.8, y: 4.05, w: 11.5, h: 0.4, fontSize: 14, color: MUTED });

    // 4 KPI tiles — same metrics/tints as the PDF cover.
    const kpiY = 4.75;
    const kpiW = 2.92;
    const kpiGap = 0.18;
    const kpis: { lbl: string; val: string; suffix?: string; fill: string; lblColor: string; numColor: string }[] = [
        { lbl: 'Risco geral', val: `${e.riskScore}`, suffix: '/100', fill: KPI_RISK, lblColor: '6663C9', numColor: primary },
        { lbl: 'Críticos', val: `${critCount}`, fill: KPI_CRIT, lblColor: PATH_HOT_INK, numColor: 'E0483D' },
        { lbl: 'Achados', val: `${e.findings.length}`, fill: PANEL, lblColor: MUTED, numColor: INK },
        { lbl: 'Quick wins', val: `${qw.length}`, fill: PANEL, lblColor: MUTED, numColor: INK },
    ];
    kpis.forEach((k, i) => {
        const x = 0.8 + i * (kpiW + kpiGap);
        c.addShape(pptx.ShapeType.roundRect, { x, y: kpiY, w: kpiW, h: 1.25, rectRadius: 0.08, fill: { color: k.fill } });
        c.addText(k.lbl, { x: x + 0.22, y: kpiY + 0.18, w: kpiW - 0.4, h: 0.3, fontSize: 11, color: k.lblColor });
        c.addText(
            [
                { text: k.val, options: { fontSize: 30, bold: true, color: k.numColor } },
                ...(k.suffix ? [{ text: k.suffix, options: { fontSize: 13, color: MUTED } }] : []),
            ],
            { x: x + 0.2, y: kpiY + 0.52, w: kpiW - 0.4, h: 0.62, valign: 'middle' },
        );
    });

    // meta line (period / version / risk rating)
    c.addText(
        [
            { text: 'Período: ', options: { bold: true, color: SLATE } }, { text: `${e.period.start} – ${e.period.end}      `, options: { color: MUTED } },
            { text: 'Versão: ', options: { bold: true, color: SLATE } }, { text: `${e.version}      `, options: { color: MUTED } },
            { text: 'Risco: ', options: { bold: true, color: SLATE } }, { text: `${e.riskScore}/100 (${riskRating(e.riskScore).label})`, options: { color: MUTED } },
        ],
        { x: 0.8, y: 6.5, w: 12, h: 0.4, fontSize: 11 },
    );

    // ── 2. Risk slide ── severity breakdown + OWASP coverage + MITRE techniques ──
    const s2 = pptx.addSlide({ masterName: 'BASE' });
    section(s2, 'Visão Geral de Risco', 'Risco e Cobertura');

    // Severity donut + breakdown legend (left column)
    s2.addText('Severidade dos achados', { x: 0.5, y: 1.5, w: 4, h: 0.3, fontSize: 12, bold: true, color: INK });
    img(s2, 'donut', 0.7, 1.85, 2.0);
    SEVERITY_ORDER.forEach((sv, i) => {
        const y = 4.15 + i * 0.34;
        s2.addShape(pptx.ShapeType.rect, { x: 0.55, y: y + 0.05, w: 0.14, h: 0.14, fill: { color: hex(SEVERITY[sv].color) } });
        s2.addText(
            [
                { text: `${SEVERITY[sv].label}  `, options: { color: SLATE, bold: true } },
                { text: `${e.findings.filter((f) => f.severity === sv).length}`, options: { color: MUTED } },
            ],
            { x: 0.78, y, w: 2.5, h: 0.28, fontSize: 10.5, valign: 'middle' },
        );
    });

    // OWASP Top 10 (2021) coverage grid (covered = indigo tint w/ count) — middle/right.
    const hay = (f: Finding) => `${f.owasp ?? ''} ${f.references.map((r) => r.label).join(' ')}`;
    const owaspHits = (code: string) => e.findings.filter((f) => hay(f).includes(code)).length;
    s2.addText('Cobertura — OWASP Top 10 (2021)', { x: 4.0, y: 1.5, w: 9, h: 0.3, fontSize: 12, bold: true, color: INK });
    const gx = 4.0;
    const gy = 1.9;
    const cellW = 4.35;
    const cellH = 0.46;
    const colGap = 0.18;
    const rowGap = 0.1;
    OWASP_2021.forEach(([code, name], i) => {
        const col = i < 5 ? 0 : 1;
        const row = i % 5;
        const x = gx + col * (cellW + colGap);
        const y = gy + row * (cellH + rowGap);
        const n = owaspHits(code);
        const on = n > 0;
        s2.addShape(pptx.ShapeType.roundRect, { x, y, w: cellW, h: cellH, rectRadius: 0.05, fill: { color: on ? CHIP_FILL : PAPER }, line: { color: on ? COV_BORDER : LINE, width: 1 } });
        s2.addText(code, { x: x + 0.12, y, w: 0.6, h: cellH, fontSize: 11, bold: true, color: on ? CHIP_INK : MUTED, valign: 'middle' });
        s2.addText(name, { x: x + 0.68, y, w: cellW - 1.1, h: cellH, fontSize: 9, color: on ? SLATE : MUTED, valign: 'middle' });
        if (on) s2.addText(`${n}`, { x: x + cellW - 0.5, y, w: 0.38, h: cellH, fontSize: 12, bold: true, color: CHIP_INK, align: 'center', valign: 'middle' });
    });

    // Observed MITRE ATT&CK techniques (chips), bottom band.
    const mitreObserved = Array.from(
        new Set(e.findings.map((f) => f.mitre ?? (hay(f).match(/T\d{4}(?:\.\d+)?/)?.[0] ?? '')).filter(Boolean)),
    );
    if (mitreObserved.length > 0) {
        s2.addText('Técnicas MITRE ATT&CK observadas', { x: 0.5, y: 5.95, w: 9, h: 0.3, fontSize: 12, bold: true, color: INK });
        mitreObserved.slice(0, 10).forEach((t, i) => chip(s2, t, 0.5 + i * 1.22, 6.35, 1.1, { mono: true }));
    }

    // ── 3. Findings — one slide per top finding (cap at most severe ~8) ──
    const topFindings = [...e.findings]
        .sort((a, b) => SEVERITY[b.severity].rank - SEVERITY[a.severity].rank || b.cvss - a.cvss)
        .slice(0, 8);
    topFindings.forEach((f, idx) => {
        const sf = pptx.addSlide({ masterName: 'BASE' });
        const sv = SEVERITY[f.severity];
        const svColor = hex(sv.color);
        const { owasp, mitre, cwe, cves, primaryAsset } = taxonomy(f);

        // kicker + title
        sf.addText(`ACHADO ${idx + 1} DE ${topFindings.length} · ${f.id}`, { x: 0.62, y: 0.34, w: 8, h: 0.3, fontSize: 10, bold: true, color: primary, charSpacing: 1 });
        sf.addText(f.title, { x: 0.62, y: 0.62, w: 10.5, h: 0.9, fontSize: 21, bold: true, color: INK, valign: 'top' });
        // severity badge top-right
        sf.addText(sv.label.toUpperCase(), { x: 11.0, y: 0.66, w: 1.7, h: 0.36, fontSize: 11, bold: true, color: 'FFFFFF', fill: { color: svColor }, align: 'center', valign: 'middle', rectRadius: 0.04, shape: pptx.ShapeType.roundRect });

        // severity left rail spanning the body
        const bodyY = 1.7;
        const bodyH = 5.2;
        sf.addShape(pptx.ShapeType.rect, { x: 0.5, y: bodyY, w: 0.07, h: bodyH, fill: { color: svColor } });

        // taxonomy chips line (CVSS, CWE, OWASP, MITRE, CVE, asset)
        const chips: { text: string; filled?: boolean; mono?: boolean; w: number }[] = [];
        chips.push({ text: `CVSS ${f.cvss.toFixed(1)}`, filled: true, w: 1.25 });
        if (cwe) chips.push({ text: cwe, w: 1.25 });
        if (owasp) chips.push({ text: `OWASP ${owasp}`, w: 1.7 });
        if (mitre) chips.push({ text: `MITRE ${mitre}`, w: 1.7 });
        cves.slice(0, 2).forEach((cv) => chips.push({ text: cv, w: 1.6 }));
        if (primaryAsset) chips.push({ text: primaryAsset, mono: true, w: Math.min(3.2, 0.95 + primaryAsset.length * 0.085) });
        let cx = 0.72;
        const chipY = 1.72;
        chips.forEach((ch) => {
            chip(sf, ch.text, cx, chipY, ch.w, { filled: ch.filled, mono: ch.mono });
            cx += ch.w + 0.12;
        });

        // kill-chain mini-path (from finding.attackPath) — last two beats are "hot"
        const path = f.attackPath ?? [];
        let py = 2.18;
        if (path.length > 0) {
            let px = 0.72;
            path.forEach((beat, i) => {
                const hot = i >= path.length - 2;
                const w = Math.min(2.6, 0.6 + beat.length * 0.085);
                sf.addText(beat, { x: px, y: 2.16, w, h: 0.3, fontSize: 8.5, color: hot ? PATH_HOT_INK : MUTED, fill: { color: hot ? PATH_HOT_FILL : PATH_FILL }, align: 'center', valign: 'middle', rectRadius: 0.06, shape: pptx.ShapeType.roundRect });
                px += w + 0.04;
                if (i < path.length - 1) {
                    sf.addText('→', { x: px, y: 2.16, w: 0.22, h: 0.3, fontSize: 11, color: 'C8CBD2', align: 'center', valign: 'middle' });
                    px += 0.24;
                }
            });
            py = 2.6;
        }

        // description
        sf.addText('Descrição', { x: 0.72, y: py, w: 6, h: 0.26, fontSize: 9, bold: true, color: primary, charSpacing: 0.5 });
        sf.addText(f.description, { x: 0.72, y: py + 0.28, w: 11.8, h: 1.05, fontSize: 11, color: SLATE, valign: 'top', lineSpacingMultiple: 1.05 });

        // evidence snippet (dark code box) — keep concise for a deck
        let twoColY = py + 1.45;
        if (f.evidence) {
            const evY = py + 1.4;
            const codeLines = f.evidence.code.split('\n').slice(0, 5);
            sf.addText(f.evidence.caption, { x: 0.72, y: evY, w: 11.8, h: 0.26, fontSize: 8.5, italic: true, color: MUTED });
            // Highlight the vuln-proving payload in yellow within the dark code box.
            const codeRuns = highlightSegments(codeLines.join('\n')).map((seg) => ({
                text: seg.text,
                options: { fontFace: 'Consolas', fontSize: 9, color: seg.hot ? HOT_FG_HEX : 'E2E8F0', highlight: seg.hot ? HOT_BG_HEX : undefined },
            }));
            sf.addText(codeRuns, { x: 0.72, y: evY + 0.28, w: 11.8, h: 0.16 + codeLines.length * 0.2, fill: { color: INK }, valign: 'top', margin: 6, lineSpacingMultiple: 1.0 });
            twoColY = evY + 0.32 + codeLines.length * 0.2 + 0.14;
        }

        // Impacto / Remediação two-column
        const colW = 5.78;
        sf.addText('Impacto ao negócio', { x: 0.72, y: twoColY, w: colW, h: 0.26, fontSize: 9, bold: true, color: primary, charSpacing: 0.5 });
        sf.addText(f.businessImpact, { x: 0.72, y: twoColY + 0.28, w: colW, h: 1.4, fontSize: 10.5, color: SLATE, valign: 'top', lineSpacingMultiple: 1.05 });
        sf.addText('Remediação', { x: 0.72 + colW + 0.3, y: twoColY, w: colW, h: 0.26, fontSize: 9, bold: true, color: '1F9E6E', charSpacing: 0.5 });
        sf.addText(f.remediation, { x: 0.72 + colW + 0.3, y: twoColY + 0.28, w: colW, h: 1.4, fontSize: 10.5, color: SLATE, valign: 'top', lineSpacingMultiple: 1.05 });
    });

    // ── 4. Closing remediation-roadmap slide ──
    const sr = pptx.addSlide({ masterName: 'BASE' });
    section(sr, 'Plano de Ação', 'Roteiro de Remediação');
    img(sr, 'roadmap', 0.6, 1.55, 12.1);

    const items = actionItems(e.findings).sort(
        (a, b) => WINDOWS.indexOf(a.window) - WINDOWS.indexOf(b.window) || SEVERITY[b.f.severity].rank - SEVERITY[a.f.severity].rank,
    );
    // Three columns by remediation window; each lists its prioritized items as compact lines.
    const colW2 = 4.05;
    const colGap2 = 0.18;
    const startX = 0.5;
    const colTop = 2.5;
    WINDOWS.forEach((win, ci) => {
        const x = startX + ci * (colW2 + colGap2);
        const winItems = items.filter((a) => a.window === win);
        sr.addShape(pptx.ShapeType.roundRect, { x, y: colTop, w: colW2, h: 0.42, rectRadius: 0.05, fill: { color: hex(WINDOW_COLOR[win]) } });
        sr.addText(win.toUpperCase(), { x: x + 0.15, y: colTop, w: colW2 - 0.3, h: 0.42, fontSize: 11, bold: true, color: 'FFFFFF', valign: 'middle', charSpacing: 1 });
        let ly = colTop + 0.58;
        winItems.slice(0, 6).forEach((a) => {
            const lines = a.f.remediation.length > 92 ? `${a.f.remediation.slice(0, 91)}…` : a.f.remediation;
            sr.addText(
                [
                    { text: `${a.f.id}  `, options: { bold: true, color: hex(SEVERITY[a.f.severity].color), fontFace: 'Consolas' } },
                    { text: a.quickWin ? '★ ' : '', options: { bold: true, color: GREEN } },
                    { text: lines, options: { color: SLATE } },
                    { text: `   ${EFFORT[a.effort].label} · ${a.etaDays}d`, options: { color: MUTED, italic: true } },
                ],
                { x, y: ly, w: colW2, h: 0.62, fontSize: 9, valign: 'top', lineSpacingMultiple: 1.0 },
            );
            ly += 0.72;
        });
        if (winItems.length === 0) sr.addText('—', { x, y: ly, w: colW2, h: 0.3, fontSize: 9, color: MUTED });
    });
    // strategic recommendation footer line
    sr.addText(
        [
            { text: 'Quick wins primeiro: ', options: { bold: true, color: GREEN } },
            { text: `${qw.length} correções de alto impacto e baixo esforço aceleram a redução de risco. Recomenda-se reteste após a remediação dos achados críticos.`, options: { color: SLATE } },
        ],
        { x: 0.5, y: 6.55, w: 12.3, h: 0.45, fontSize: 10, valign: 'middle' },
    );

    return pptx;
}
