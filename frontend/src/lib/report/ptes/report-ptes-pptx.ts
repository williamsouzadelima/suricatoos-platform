// Premium PTES report — PowerPoint deck (Direction 3: modern magazine, light, indigo accent).
// An executive deck that carries the same visual system as the PDF flagship (report-book-pdf.tsx):
// a light cover with an indigo left rail + display title + 4 KPI tiles, a risk slide with the
// severity breakdown + OWASP Top 10 (2021) coverage + observed MITRE techniques, per-finding
// slides with the FindingCard anatomy (severity rail + taxonomy chips + kill-chain mini-path +
// evidence + Impacto/Remediação), and a closing remediation-roadmap slide.
// Charts are embedded as the exact same images rasterized from the PDF's vector charts.
import pptxgen from 'pptxgenjs';

import { t, tf } from '@/i18n';

import { CHART_SPECS } from './report-charts-sheet';
import { highlightSegments, HOT_BG_HEX, HOT_FG_HEX } from './report-highlight';
import { SURICATOOS_LOGO_BADGE } from './report-logo-assets';
import { type Engagement, type Finding, type RemediationWindow, type Severity } from './engagement';
import { actionItems, COLORS, EFFORT, quickWins, RETEST_STATUS, SEVERITY, SEVERITY_ORDER, topVulnerabilities, WINDOW_COLOR, WINDOWS } from './theme';

export type ChartImages = Record<string, string>; // key -> PNG data URI

// theme.ts SEVERITY/EFFORT/WINDOW/riskRating labels are hardcoded pt-BR source-of-truth; the map
// keys must stay intact, so localize at the render site by mapping the key → English source → t().
const SEV_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };
const sevLabel = (sev: Severity): string => t(SEV_LABEL[sev]);
const EFFORT_LABEL: Record<1 | 2 | 3, string> = { 1: 'Low', 2: 'Medium', 3: 'High' };
const effortLabel = (e: 1 | 2 | 3): string => t(EFFORT_LABEL[e]);
const WINDOW_LABEL: Record<RemediationWindow, string> = { Imediata: 'Immediate', 'Curto prazo': 'Short term', 'Médio prazo': 'Medium term' };
const windowLabel = (w: RemediationWindow): string => t(WINDOW_LABEL[w]);
// riskRating().label is an uppercase pt-BR rating; map score → English source string → t().
const riskRatingLabel = (score: number): string => {
    if (score >= 80) return t('CRITICAL');
    if (score >= 60) return t('HIGH');
    if (score >= 40) return t('MEDIUM');
    if (score >= 20) return t('LOW');
    return t('INFORMATIONAL');
};

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
            { text: { text: e.branding.appName.toUpperCase(), options: { x: 0.5, y: 7.14, w: 6, h: 0.32, fontSize: 9, color: primary, bold: true, charSpacing: 1, valign: 'middle' } } },
            { text: { text: `${e.client} · ${e.classification}`, options: { x: 7.0, y: 7.14, w: 5.83, h: 0.32, fontSize: 9, color: MUTED, align: 'right', valign: 'middle' } } },
        ],
    });

    const img = (s: pptxgen.Slide, key: string, x: number, y: number, w: number) => {
        if (!images[key]) return;
        s.addImage({ data: images[key], x, y, w, h: w * aspect(key) });
    };
    // Section opener (kicker + display title + short indigo rule), mirrors the PDF Section.
    const section = (s: pptxgen.Slide, kicker: string, title: string) => {
        s.addText(kicker.toUpperCase(), { x: 0.5, y: 0.4, w: 12, h: 0.32, fontSize: 13, bold: true, color: primary, charSpacing: 1 });
        s.addText(title, { x: 0.5, y: 0.74, w: 12.3, h: 0.7, fontSize: 30, bold: true, color: INK });
        s.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.46, w: 0.7, h: 0.04, fill: { color: primary } });
    };
    // A small pill/chip used for taxonomy + MITRE listings.
    const chip = (s: pptxgen.Slide, text: string, x: number, y: number, w: number, opts?: { filled?: boolean; mono?: boolean }) => {
        const filled = opts?.filled ?? false;
        s.addText(text, {
            x, y, w, h: 0.34,
            fontSize: 11,
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
    c.addText(e.branding.appName.toUpperCase(), { x: 1.55, y: 0.62, w: 7, h: 0.62, fontSize: 20, bold: true, color: primary, charSpacing: 1, valign: 'middle' });
    // classification chip (coral outline), top-right
    c.addText(e.classification, { x: 10.3, y: 0.64, w: 2.4, h: 0.4, fontSize: 11, bold: true, color: CORAL, align: 'center', valign: 'middle', charSpacing: 1, line: { color: CORAL, width: 1 }, rectRadius: 0.03, shape: pptx.ShapeType.roundRect });

    c.addText(t('PENTEST REPORT · PTES'), { x: 0.8, y: 1.92, w: 11.5, h: 0.38, fontSize: 13, bold: true, color: MUTED, charSpacing: 3 });
    const coverTitle = e.isRetest ? `${e.title} — ${t('Retest')}` : e.title;
    c.addText(coverTitle, { x: 0.78, y: 2.34, w: 11.8, h: 1.7, fontSize: 36, bold: true, color: INK, valign: 'top' });
    c.addText(tf('Prepared by {author} for {client}', { author: e.branding.appName, client: e.client }), { x: 0.8, y: 4.08, w: 11.5, h: 0.42, fontSize: 15, color: MUTED });

    // 4 KPI tiles — same metrics/tints as the PDF cover.
    const kpiY = 4.75;
    const kpiW = 2.92;
    const kpiGap = 0.18;
    const kpis: { lbl: string; val: string; suffix?: string; fill: string; lblColor: string; numColor: string }[] = [
        { lbl: t('Overall risk'), val: `${e.riskScore}`, suffix: '/100', fill: KPI_RISK, lblColor: '6663C9', numColor: primary },
        { lbl: t('Critical'), val: `${critCount}`, fill: KPI_CRIT, lblColor: PATH_HOT_INK, numColor: 'E0483D' },
        { lbl: t('Findings'), val: `${e.findings.length}`, fill: PANEL, lblColor: MUTED, numColor: INK },
        { lbl: t('Quick wins'), val: `${qw.length}`, fill: PANEL, lblColor: MUTED, numColor: INK },
    ];
    kpis.forEach((k, i) => {
        const x = 0.8 + i * (kpiW + kpiGap);
        c.addShape(pptx.ShapeType.roundRect, { x, y: kpiY, w: kpiW, h: 1.25, rectRadius: 0.08, fill: { color: k.fill } });
        c.addText(k.lbl, { x: x + 0.22, y: kpiY + 0.16, w: kpiW - 0.4, h: 0.32, fontSize: 12, color: k.lblColor });
        c.addText(
            [
                { text: k.val, options: { fontSize: 32, bold: true, color: k.numColor } },
                ...(k.suffix ? [{ text: k.suffix, options: { fontSize: 14, color: MUTED } }] : []),
            ],
            { x: x + 0.2, y: kpiY + 0.5, w: kpiW - 0.4, h: 0.64, valign: 'middle' },
        );
    });

    // meta line (period / version / risk rating)
    c.addText(
        [
            { text: `${t('Period')}: `, options: { bold: true, color: SLATE } }, { text: `${e.period.start} – ${e.period.end}      `, options: { color: MUTED } },
            { text: `${t('Version')}: `, options: { bold: true, color: SLATE } }, { text: `${e.version}      `, options: { color: MUTED } },
            { text: `${t('Risk')}: `, options: { bold: true, color: SLATE } }, { text: `${e.riskScore}/100 (${riskRatingLabel(e.riskScore)})`, options: { color: MUTED } },
        ],
        { x: 0.8, y: 6.5, w: 12, h: 0.4, fontSize: 12 },
    );

    // Confidentiality notice — small print, bottom-left of the cover (Direction 3 furniture).
    c.addText(
        [
            { text: `${t('Confidentiality notice')} — `, options: { bold: true, color: SLATE } },
            { text: `${e.classification} · ${e.client}`, options: { color: MUTED } },
        ],
        { x: 0.8, y: 6.98, w: 11.7, h: 0.34, fontSize: 9, valign: 'middle' },
    );

    // ── 2. Risk slide ── severity breakdown + OWASP coverage + MITRE techniques ──
    const s2 = pptx.addSlide({ masterName: 'BASE' });
    section(s2, t('Risk Overview'), t('Risk and Coverage'));

    // Severity donut + breakdown legend (left column, side by side to free the lower-left band)
    s2.addText(t('Finding severity'), { x: 0.5, y: 1.7, w: 4, h: 0.32, fontSize: 13, bold: true, color: INK });
    img(s2, 'donut', 0.55, 2.12, 1.55);
    SEVERITY_ORDER.forEach((sv, i) => {
        const y = 2.18 + i * 0.33;
        s2.addShape(pptx.ShapeType.rect, { x: 2.3, y: y + 0.07, w: 0.16, h: 0.16, fill: { color: hex(SEVERITY[sv].color) } });
        s2.addText(
            [
                { text: `${sevLabel(sv)}  `, options: { color: SLATE, bold: true } },
                { text: `${e.findings.filter((f) => f.severity === sv).length}`, options: { color: MUTED } },
            ],
            { x: 2.55, y, w: 1.3, h: 0.3, fontSize: 12, valign: 'middle' },
        );
    });

    // Top vulnerabilities — compact ranked table (ID / Vulnerability / Criticality), lower-left.
    const topVulns = topVulnerabilities(e.findings, 8);
    if (topVulns.length > 0) {
        const tvX = 0.5;
        const tvY = 4.05;
        const tvW = 3.4;
        const idW = 0.62;
        const critW = 0.92;
        const vulnW = tvW - idW - critW;
        s2.addText(t('Top vulnerabilities'), { x: tvX, y: tvY, w: tvW, h: 0.3, fontSize: 13, bold: true, color: INK });
        // header row
        const headY = tvY + 0.36;
        s2.addText('#ID', { x: tvX, y: headY, w: idW, h: 0.22, fontSize: 8, bold: true, color: MUTED, charSpacing: 0.5, valign: 'middle' });
        s2.addText(t('Vulnerability'), { x: tvX + idW, y: headY, w: vulnW, h: 0.22, fontSize: 8, bold: true, color: MUTED, charSpacing: 0.5, valign: 'middle' });
        s2.addText(t('Criticality'), { x: tvX + idW + vulnW, y: headY, w: critW, h: 0.22, fontSize: 8, bold: true, color: MUTED, charSpacing: 0.5, align: 'center', valign: 'middle' });
        const rowH = 0.2;
        topVulns.forEach((f, i) => {
            const ry = headY + 0.24 + i * rowH;
            s2.addShape(pptx.ShapeType.rect, { x: tvX, y: ry + rowH - 0.012, w: tvW, h: 0.008, fill: { color: LINE } });
            s2.addText(f.id, { x: tvX, y: ry, w: idW, h: rowH, fontSize: 8.5, bold: true, color: SLATE, fontFace: 'Consolas', valign: 'middle' });
            const title = f.title.length > 34 ? `${f.title.slice(0, 33)}…` : f.title;
            s2.addText(title, { x: tvX + idW, y: ry, w: vulnW, h: rowH, fontSize: 8.5, color: SLATE, valign: 'middle' });
            s2.addText(sevLabel(f.severity), { x: tvX + idW + vulnW, y: ry, w: critW, h: rowH, fontSize: 8.5, bold: true, color: hex(SEVERITY[f.severity].color), align: 'center', valign: 'middle' });
        });
    }

    // OWASP Top 10 (2021) coverage grid (covered = indigo tint w/ count) — middle/right.
    const hay = (f: Finding) => `${f.owasp ?? ''} ${f.references.map((r) => r.label).join(' ')}`;
    const owaspHits = (code: string) => e.findings.filter((f) => hay(f).includes(code)).length;
    s2.addText(t('Coverage — OWASP Top 10 (2021)'), { x: 4.0, y: 1.7, w: 9, h: 0.32, fontSize: 13, bold: true, color: INK });
    const gx = 4.0;
    const gy = 2.08;
    const cellW = 4.35;
    const cellH = 0.54;
    const colGap = 0.18;
    const rowGap: number = 0.12;
    OWASP_2021.forEach(([code, name], i) => {
        const col = i < 5 ? 0 : 1;
        const row = i % 5;
        const x = gx + col * (cellW + colGap);
        const y = gy + row * (cellH + rowGap);
        const n = owaspHits(code);
        const on = n > 0;
        s2.addShape(pptx.ShapeType.roundRect, { x, y, w: cellW, h: cellH, rectRadius: 0.05, fill: { color: on ? CHIP_FILL : PAPER }, line: { color: on ? COV_BORDER : LINE, width: 1 } });
        s2.addText(code, { x: x + 0.14, y, w: 0.64, h: cellH, fontSize: 12, bold: true, color: on ? CHIP_INK : MUTED, valign: 'middle' });
        s2.addText(name, { x: x + 0.74, y, w: cellW - 1.2, h: cellH, fontSize: 11, color: on ? SLATE : MUTED, valign: 'middle' });
        if (on) s2.addText(`${n}`, { x: x + cellW - 0.52, y, w: 0.4, h: cellH, fontSize: 13, bold: true, color: CHIP_INK, align: 'center', valign: 'middle' });
    });

    // Observed MITRE ATT&CK techniques (chips), bottom band.
    const mitreObserved = Array.from(
        new Set(e.findings.map((f) => f.mitre ?? (hay(f).match(/T\d{4}(?:\.\d+)?/)?.[0] ?? '')).filter(Boolean)),
    );
    if (mitreObserved.length > 0) {
        // Right column, beneath the OWASP grid (the lower-left band now holds the top-vulns table).
        s2.addText(t('Observed MITRE ATT&CK techniques'), { x: 4.0, y: 5.6, w: 8.7, h: 0.32, fontSize: 13, bold: true, color: INK });
        mitreObserved.slice(0, 7).forEach((t, i) => chip(s2, t, 4.0 + i * 1.22, 6.04, 1.12, { mono: true }));
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
        sf.addText(`${tf('FINDING {n} OF {total}', { n: idx + 1, total: topFindings.length })} · ${f.id}`, { x: 0.62, y: 0.34, w: 8, h: 0.3, fontSize: 12, bold: true, color: primary, charSpacing: 1 });
        sf.addText(f.title, { x: 0.62, y: 0.66, w: 10.2, h: 0.86, fontSize: 20, bold: true, color: INK, valign: 'top' });
        // severity badge top-right
        sf.addText(sevLabel(f.severity).toUpperCase(), { x: 10.9, y: 0.68, w: 1.8, h: 0.4, fontSize: 12, bold: true, color: 'FFFFFF', fill: { color: svColor }, align: 'center', valign: 'middle', rectRadius: 0.04, shape: pptx.ShapeType.roundRect });

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
        // Retest status chip (only on retest engagements) — soft fill + status color, styled like
        // the taxonomy chips but with the per-status palette from RETEST_STATUS.
        if (e.isRetest) {
            const rs = RETEST_STATUS[f.retestStatus ?? 'open'];
            const statusText = `${t('Status')}: ${t(rs.key)}`;
            const rsW = Math.min(2.8, 1.05 + statusText.length * 0.075);
            sf.addText(statusText, {
                x: cx, y: chipY, w: rsW, h: 0.34,
                fontSize: 11, bold: true,
                color: hex(rs.color),
                fill: { color: hex(rs.soft) },
                align: 'center', valign: 'middle',
                rectRadius: 0.04, shape: pptx.ShapeType.roundRect,
            });
            cx += rsW + 0.12;
        }

        // kill-chain mini-path (from finding.attackPath) — last two beats are "hot".
        // Beats are scaled to fit the content width: at fixed width a 5+ beat chain ran off the
        // right edge of the slide. We compute natural widths, then shrink them proportionally (and
        // drop the font a notch when compressed) so the whole chain always stays within the margin.
        const path = f.attackPath ?? [];
        let py = 2.18;
        if (path.length > 0) {
            const START_X = 0.72;
            const RIGHT_X = 12.6; // content right edge (matches the description/remediation blocks)
            const ARROW_W = 0.22;
            const ARROW_SLOT = ARROW_W + 0.06; // arrow + gaps around it
            const arrowsTotal = path.length > 1 ? (path.length - 1) * ARROW_SLOT : 0;
            const natural = path.map((b) => Math.min(2.6, 0.6 + b.length * 0.085));
            const naturalSum = natural.reduce((a, b) => a + b, 0);
            const budget = RIGHT_X - START_X - arrowsTotal;
            const scale = naturalSum > budget ? budget / naturalSum : 1;
            const widths = natural.map((w) => Math.max(0.45, w * scale));
            const fontSize = scale < 0.85 ? 7.5 : 8.5;
            let px = START_X;
            path.forEach((beat, i) => {
                const hot = i >= path.length - 2;
                const w = widths[i]!;
                sf.addText(beat, { x: px, y: 2.16, w, h: 0.3, fontSize, color: hot ? PATH_HOT_INK : MUTED, fill: { color: hot ? PATH_HOT_FILL : PATH_FILL }, align: 'center', valign: 'middle', rectRadius: 0.06, shape: pptx.ShapeType.roundRect });
                px += w + 0.03;
                if (i < path.length - 1) {
                    sf.addText('→', { x: px, y: 2.16, w: ARROW_W, h: 0.3, fontSize: 11, color: 'C8CBD2', align: 'center', valign: 'middle' });
                    px += ARROW_SLOT - 0.03;
                }
            });
            py = 2.6;
        }

        // description (tighter so the evidence block below can show real proof and still fit the slide)
        const descH = 0.86;
        sf.addText(t('Description'), { x: 0.72, y: py, w: 6, h: 0.26, fontSize: 9, bold: true, color: primary, charSpacing: 0.5 });
        sf.addText(f.description, { x: 0.72, y: py + 0.28, w: 11.8, h: descH, fontSize: 10.5, color: SLATE, valign: 'top', lineSpacingMultiple: 1.0 });

        // evidence snippet (dark code box) — the REAL tool-output proof, capped to 6 lines so the
        // Impacto/Remediação row below still clears the footer (slide bottom rule at y≈7.12).
        let twoColY = py + 0.28 + descH + 0.16;
        if (f.evidence) {
            const evY = twoColY;
            const codeLines = f.evidence.code.split('\n').slice(0, 6);
            sf.addText(f.evidence.caption, { x: 0.72, y: evY, w: 11.8, h: 0.26, fontSize: 8.5, italic: true, color: MUTED });
            // Highlight the vuln-proving payload in yellow within the dark code box.
            const codeRuns = highlightSegments(codeLines.join('\n')).map((seg) => ({
                text: seg.text,
                options: { fontFace: 'Consolas', fontSize: 8.5, color: seg.hot ? HOT_FG_HEX : 'E2E8F0', highlight: seg.hot ? HOT_BG_HEX : undefined },
            }));
            const codeH = 0.14 + codeLines.length * 0.18;
            sf.addText(codeRuns, { x: 0.72, y: evY + 0.26, w: 11.8, h: codeH, fill: { color: INK }, valign: 'top', margin: 6, lineSpacingMultiple: 1.0 });
            twoColY = evY + 0.26 + codeH + 0.12;
        }

        // Impacto / Remediação two-column
        const colW = 5.78;
        const colH = 1.15;
        sf.addText(t('Business impact'), { x: 0.72, y: twoColY, w: colW, h: 0.26, fontSize: 9, bold: true, color: primary, charSpacing: 0.5 });
        sf.addText(f.businessImpact, { x: 0.72, y: twoColY + 0.28, w: colW, h: colH, fontSize: 10, color: SLATE, valign: 'top', lineSpacingMultiple: 1.0 });
        sf.addText(t('Remediation'), { x: 0.72 + colW + 0.3, y: twoColY, w: colW, h: 0.26, fontSize: 9, bold: true, color: '1F9E6E', charSpacing: 0.5 });
        sf.addText(f.remediation, { x: 0.72 + colW + 0.3, y: twoColY + 0.28, w: colW, h: colH, fontSize: 10, color: SLATE, valign: 'top', lineSpacingMultiple: 1.0 });
    });

    // ── 4. Closing remediation-roadmap slide ──
    const sr = pptx.addSlide({ masterName: 'BASE' });
    section(sr, t('Action Plan'), t('Remediation Roadmap'));
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
        sr.addText(windowLabel(win).toUpperCase(), { x: x + 0.15, y: colTop, w: colW2 - 0.3, h: 0.42, fontSize: 11, bold: true, color: 'FFFFFF', valign: 'middle', charSpacing: 1 });
        // Cap at 5 rows with a tighter step so the column never runs into the footer note at y=6.55
        // (6 rows × 0.72 starting at 3.08 reached y≈6.68 and overlapped it). Extra items roll up
        // into a "+N more" line.
        const MAX_ROWS = 5;
        const STEP = 0.62;
        let ly = colTop + 0.58;
        winItems.slice(0, MAX_ROWS).forEach((a) => {
            const lines = a.f.remediation.length > 80 ? `${a.f.remediation.slice(0, 79)}…` : a.f.remediation;
            sr.addText(
                [
                    { text: `${a.f.id}  `, options: { bold: true, color: hex(SEVERITY[a.f.severity].color), fontFace: 'Consolas' } },
                    { text: a.quickWin ? '★ ' : '', options: { bold: true, color: GREEN } },
                    { text: lines, options: { color: SLATE } },
                    { text: `   ${effortLabel(a.effort)} · ${a.etaDays}d`, options: { color: MUTED, italic: true } },
                ],
                { x, y: ly, w: colW2, h: 0.56, fontSize: 9, valign: 'top', lineSpacingMultiple: 1.0 },
            );
            ly += STEP;
        });
        if (winItems.length > MAX_ROWS) {
            sr.addText(tf('+{count} more', { count: winItems.length - MAX_ROWS }), { x, y: ly, w: colW2, h: 0.28, fontSize: 9, italic: true, color: MUTED });
        }
        if (winItems.length === 0) sr.addText('—', { x, y: ly, w: colW2, h: 0.3, fontSize: 9, color: MUTED });
    });
    // strategic recommendation footer line
    sr.addText(
        [
            { text: `${t('Quick wins first')}: `, options: { bold: true, color: GREEN } },
            { text: tf('{count} high-impact, low-effort fixes accelerate risk reduction. A retest is recommended after remediating the critical findings.', { count: qw.length }), options: { color: SLATE } },
        ],
        { x: 0.5, y: 6.55, w: 12.3, h: 0.45, fontSize: 10, valign: 'middle' },
    );

    // ── 5. Closing slide ── contacts roster + trace-cleanup attestation ──
    // Only rendered when there is something to show (typed contacts or a retest engagement always
    // carries the cleanup attestation). Keeps the deck legible by isolating the closing furniture.
    const contacts = e.contacts ?? [];
    const sc = pptx.addSlide({ masterName: 'BASE' });
    section(sc, t('Confidentiality notice'), e.isRetest ? `${t('Retest')} · ${t('Trace cleanup')}` : t('Trace cleanup'));

    // Contacts roster (left column) — "name — role — info", styled like a compact card list.
    if (contacts.length > 0) {
        const cX = 0.5;
        const cW = 6.0;
        sc.addText(t('Contacts'), { x: cX, y: 1.8, w: cW, h: 0.3, fontSize: 13, bold: true, color: INK });
        // header row
        const hY = 2.16;
        sc.addText(t('Name'), { x: cX, y: hY, w: 1.9, h: 0.24, fontSize: 8, bold: true, color: MUTED, charSpacing: 0.5, valign: 'middle' });
        sc.addText(t('Role'), { x: cX + 1.9, y: hY, w: 1.7, h: 0.24, fontSize: 8, bold: true, color: MUTED, charSpacing: 0.5, valign: 'middle' });
        sc.addText(t('Contact information'), { x: cX + 3.6, y: hY, w: cW - 3.6, h: 0.24, fontSize: 8, bold: true, color: MUTED, charSpacing: 0.5, valign: 'middle' });
        let cy = hY + 0.3;
        contacts.slice(0, 8).forEach((ct) => {
            sc.addShape(pptx.ShapeType.rect, { x: cX, y: cy + 0.42, w: cW, h: 0.008, fill: { color: LINE } });
            sc.addText(ct.name, { x: cX, y: cy, w: 1.9, h: 0.42, fontSize: 10, bold: true, color: INK, valign: 'middle' });
            sc.addText(ct.role, { x: cX + 1.9, y: cy, w: 1.7, h: 0.42, fontSize: 10, color: SLATE, valign: 'middle' });
            sc.addText(ct.info, { x: cX + 3.6, y: cy, w: cW - 3.6, h: 0.42, fontSize: 9.5, color: MUTED, valign: 'middle' });
            cy += 0.5;
        });
    }

    // Trace-cleanup attestation (right column, or full width when no contacts).
    const tcX = contacts.length > 0 ? 6.9 : 0.5;
    const tcW = contacts.length > 0 ? 5.9 : 12.3;
    sc.addShape(pptx.ShapeType.roundRect, { x: tcX, y: 1.8, w: tcW, h: 0.5, rectRadius: 0.06, fill: { color: PANEL } });
    sc.addText(t('Trace cleanup'), { x: tcX + 0.2, y: 1.8, w: tcW - 0.4, h: 0.5, fontSize: 12, bold: true, color: primary, valign: 'middle', charSpacing: 0.5 });
    sc.addText(
        e.cleanupAttestation ?? t('After collecting the information and evidence shown above, the systems were restored exactly as found: any accounts created for the proof of concept were removed, and the exploits used during testing were properly deleted.'),
        { x: tcX, y: 2.5, w: tcW, h: 2.6, fontSize: 11, color: SLATE, valign: 'top', lineSpacingMultiple: 1.15 },
    );

    return pptx;
}
