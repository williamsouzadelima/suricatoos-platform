// Premium "book-like" PTES report — PDF flagship.
// Storytelling narrative, action plan (quick wins + timeline), vector charts, whitelabel co-branding.
// Typography is a book pairing: a serif (Noto Serif) for running text + headings — the "book" voice —
// a humanist sans for furniture (chips, tables, headers/footers), and a mono for code/evidence.
import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';

import { t, tf } from '@/i18n';

import { AttackChainStrip, DonutChart, EffortTimeBars, HBarChart, PhaseStepper, QuickWinsQuadrant, RemediationRoadmap, RiskGauge, RiskMatrix } from './charts';
import { PTES_PHASES, type Engagement, type Figure, type Finding, type RemediationWindow, type Severity } from './engagement';
import { AppLogo, ClientLogo } from './report-logo';
import { highlightSegments, HOT_BG, HOT_FG } from './report-highlight';
import { actionItems, categoryCounts, COLORS, EFFORT, findingIsEstimated, fmtDate, isEstimated, quickWins, riskRating, SEVERITY, SEVERITY_ORDER, severityCounts, WINDOW_COLOR, WINDOWS, type ActionItem } from './theme';

// theme.ts SEVERITY/EFFORT/WINDOW labels are the source of truth but hardcoded pt-BR; the map keys
// must stay intact (they index the maps), so localize at the RENDER site by mapping the key →
// English source string → t(). Effort levels reuse the severity Low/Medium/High translations.
const SEV_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Info' };
const sevLabel = (sev: Severity): string => t(SEV_LABEL[sev]);
const EFFORT_LABEL: Record<1 | 2 | 3, string> = { 1: 'Low', 2: 'Medium', 3: 'High' };
const effortLabel = (e: 1 | 2 | 3): string => t(EFFORT_LABEL[e]);
const WINDOW_LABEL: Record<RemediationWindow, string> = { Imediata: 'Immediate', 'Curto prazo': 'Short term', 'Médio prazo': 'Medium term' };
const windowLabel = (w: RemediationWindow): string => t(WINDOW_LABEL[w]);

const SERIF = 'NotoSerif';
const SANS = 'NotoSans';
const MONO = 'NotoSansMono';

let fontsRegistered = false;
export function registerReportFonts(base = '/fonts'): void {
    Font.register({
        family: 'NotoSerif',
        fonts: [
            { fontStyle: 'normal', fontWeight: 'normal', src: `${base}/NotoSerif-Regular.ttf` },
            { fontStyle: 'normal', fontWeight: 'bold', src: `${base}/NotoSerif-Bold.ttf` },
            { fontStyle: 'italic', fontWeight: 'normal', src: `${base}/NotoSerif-Italic.ttf` },
        ],
    });
    Font.register({
        family: 'NotoSans',
        fonts: [
            { fontStyle: 'normal', fontWeight: 'normal', src: `${base}/NotoSans-Regular.ttf` },
            { fontStyle: 'normal', fontWeight: 'bold', src: `${base}/NotoSans-Bold.ttf` },
            { fontStyle: 'italic', fontWeight: 'normal', src: `${base}/NotoSans-Italic.ttf` },
        ],
    });
    Font.register({ family: 'NotoSansMono', fonts: [{ fontStyle: 'normal', fontWeight: 'normal', src: `${base}/NotoSansMono-Regular.ttf` }] });
    // Break long UNBROKEN tokens (URLs, hashes, payloads from real findings) into chunks so they
    // wrap. Leaving them unbreakable lets a token wider than its container blow up @react-pdf's
    // layout math → "unsupported number" crash on export. Short words pass through untouched.
    Font.registerHyphenationCallback((word) => (word.length > 18 ? (word.match(/.{1,14}/g) ?? [word]) : [word]));
    fontsRegistered = true;
}

const s = StyleSheet.create({
    page: { backgroundColor: COLORS.paper, color: COLORS.slate, fontFamily: SANS, fontSize: 11.5, lineHeight: 1.6, paddingTop: 66, paddingBottom: 56, paddingHorizontal: 56 },
    header: { position: 'absolute', top: 22, left: 56, right: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6 },
    headerL: { flexDirection: 'row', alignItems: 'center' },
    headerBrand: { fontFamily: SANS, fontSize: 10, fontWeight: 'bold', color: COLORS.brand, letterSpacing: 0.5, marginLeft: 6 },
    headerMeta: { fontFamily: SANS, fontSize: 7.5, color: COLORS.muted },
    footer: { position: 'absolute', bottom: 22, left: 56, right: 56, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 },
    footerText: { fontFamily: SANS, fontSize: 7.5, color: COLORS.muted },
    // cover — Direction 3: light, indigo rail, display title, KPI cards
    cover: { backgroundColor: COLORS.paper, color: COLORS.ink, padding: 0 },
    coverBar: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 14, backgroundColor: COLORS.brand },
    coverInner: { paddingVertical: 60, paddingHorizontal: 50, height: '100%' },
    brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    coverBrand: { fontFamily: SANS, fontSize: 13, fontWeight: 'bold', color: COLORS.brand, letterSpacing: 1, marginLeft: 8 },
    coverKicker: { fontFamily: SANS, fontSize: 11, color: COLORS.muted, fontWeight: 'bold', marginTop: 64, letterSpacing: 2.5 },
    coverTitle: { fontSize: 33, fontWeight: 'bold', color: COLORS.ink, marginTop: 12, lineHeight: 1.12, letterSpacing: -0.5 },
    coverSub: { fontFamily: SANS, fontSize: 13, color: COLORS.muted, marginTop: 10 },
    kpiRow: { flexDirection: 'row', gap: 9, marginTop: 40 },
    kpi: { flex: 1, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 13 },
    kpiLbl: { fontFamily: SANS, fontSize: 10 },
    kpiNum: { fontFamily: SANS, fontSize: 21, fontWeight: 'bold', marginTop: 2 },
    coverPrepared: { fontFamily: SANS, fontSize: 9, color: COLORS.muted, marginTop: 22, marginBottom: 8 },
    chip: { alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.coral, borderRadius: 3, paddingVertical: 3, paddingHorizontal: 8, marginTop: 22 },
    chipText: { fontFamily: SANS, fontSize: 9, color: COLORS.coral, fontWeight: 'bold', letterSpacing: 1 },
    coverMetaRow: { flexDirection: 'row', marginTop: 8 },
    coverMetaK: { fontFamily: SANS, fontSize: 10, color: COLORS.muted, width: 70 },
    coverMetaV: { fontFamily: SANS, fontSize: 10, color: COLORS.slate },
    // section / chapter opener
    sectionWrap: { marginTop: 8, marginBottom: 11 },
    sectionNum: { fontFamily: SANS, fontSize: 9.5, fontWeight: 'bold', color: COLORS.brand, letterSpacing: 1.5 },
    sectionTitle: { fontSize: 23, fontWeight: 'bold', color: COLORS.ink, marginTop: 3 },
    sectionRule: { height: 2, backgroundColor: COLORS.brand, width: 38, marginTop: 8, marginBottom: 11 },
    h3: { fontSize: 14, fontWeight: 'bold', color: COLORS.ink, marginTop: 14, marginBottom: 6 },
    p: { fontSize: 12, color: COLORS.slate, marginBottom: 10, textAlign: 'justify', lineHeight: 1.7 },
    caption: { fontFamily: SANS, fontSize: 9.5, fontWeight: 'bold', color: COLORS.ink, marginBottom: 6, textAlign: 'center' },
    // panels / cards
    statRow: { flexDirection: 'row', gap: 11, marginTop: 6 },
    stat: { flex: 1, backgroundColor: COLORS.panel, borderRadius: 6, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center' },
    statNum: { fontFamily: SANS, fontSize: 20, fontWeight: 'bold', color: COLORS.ink, lineHeight: 1.1 },
    statLbl: { fontFamily: SANS, fontSize: 9, color: COLORS.muted, marginTop: 6, textAlign: 'center', lineHeight: 1.2 },
    twoCol: { flexDirection: 'row', gap: 16, marginTop: 8 },
    panel: { backgroundColor: COLORS.panel, borderRadius: 6, padding: 12 },
    panelTitle: { fontFamily: SANS, fontSize: 11, fontWeight: 'bold', color: COLORS.ink, marginBottom: 6 },
    li: { flexDirection: 'row', marginBottom: 5 },
    liDot: { width: 11, fontSize: 11.5, color: COLORS.brand },
    liText: { flex: 1, fontSize: 11.5, color: COLORS.slate, lineHeight: 1.6 },
    kvRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingVertical: 4 },
    kvK: { fontFamily: SANS, width: 120, fontSize: 9.5, color: COLORS.muted, fontWeight: 'bold' },
    kvV: { flex: 1, fontSize: 11, color: COLORS.slate },
    tocRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: COLORS.line },
    tocNum: { fontFamily: SANS, fontSize: 11, color: COLORS.brand, fontWeight: 'bold', width: 22 },
    tocName: { flex: 1, fontSize: 11.5, color: COLORS.slate },
    // story timeline
    storyStep: { flexDirection: 'row', marginBottom: 13 },
    storyNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    storyNumText: { fontFamily: SANS, color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
    storyHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' },
    storyTitle: { fontSize: 13, fontWeight: 'bold', color: COLORS.ink, marginRight: 6 },
    refPill: { fontFamily: SANS, backgroundColor: '#DBEAFE', color: COLORS.brand, fontSize: 8, fontWeight: 'bold', borderRadius: 3, paddingVertical: 1, paddingHorizontal: 4, marginRight: 3 },
    storyText: { fontSize: 11.5, color: COLORS.slate, lineHeight: 1.6, textAlign: 'justify' },
    // findings table
    tHead: { flexDirection: 'row', backgroundColor: COLORS.brand, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    tHeadCell: { fontFamily: SANS, color: COLORS.white, fontSize: 9.5, fontWeight: 'bold', padding: 6 },
    tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.line },
    tCell: { fontSize: 9.5, color: COLORS.slate, padding: 6 },
    // finding card
    // No border: a bordered View crashes @react-pdf's clipBorderTop when it wraps across pages.
    // The severity is shown by a top color bar (a background fill, which wraps safely) + the pill.
    cardHeadBlock: { marginTop: 8 },
    cardGap: { marginBottom: 18 },
    cardBar: { height: 4, marginBottom: 10 },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardId: { fontFamily: SANS, fontSize: 9, color: COLORS.muted, fontWeight: 'bold' },
    cardTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.ink, marginTop: 2, marginBottom: 6 },
    badge: { borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6 },
    badgeText: { fontFamily: SANS, fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
    metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 7, alignItems: 'center' },
    metaPill: { fontFamily: SANS, backgroundColor: COLORS.panel, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6, fontSize: 9, color: COLORS.slate },
    fieldLbl: { fontFamily: SANS, fontSize: 9.5, fontWeight: 'bold', color: COLORS.brand, marginTop: 8, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4 },
    fieldText: { fontSize: 11.5, color: COLORS.slate, lineHeight: 1.6 },
    code: { backgroundColor: '#0F172A', color: '#E2E8F0', fontFamily: MONO, fontSize: 9.5, padding: 9, marginTop: 5, lineHeight: 1.45 },
    codeCap: { fontFamily: SANS, fontSize: 9, color: COLORS.muted, fontStyle: 'italic', marginTop: 6 },
    // estimated / honesty
    estBadge: { backgroundColor: '#FEF3C7', borderRadius: 3, paddingVertical: 2, paddingHorizontal: 5 },
    estBadgeText: { fontFamily: SANS, fontSize: 8, fontWeight: 'bold', color: '#92400E', letterSpacing: 0.3 },
    callout: { flexDirection: 'row', backgroundColor: '#FEF3C7', borderRadius: 3, paddingVertical: 7, paddingHorizontal: 9, marginTop: 8 },
    calloutText: { fontFamily: SANS, flex: 1, fontSize: 9, color: '#92400E', lineHeight: 1.5 },
    assetLine: { flexDirection: 'row', marginBottom: 3, alignItems: 'baseline' },
    assetMono: { fontFamily: MONO, fontSize: 9.5, color: COLORS.ink },
    assetMeta: { fontFamily: SANS, fontSize: 9, color: COLORS.muted, marginLeft: 4 },
    // Direction 3 — taxonomy chips, kill-chain mini path, reproduction, two-tone fields
    chipFilled: { fontFamily: SANS, backgroundColor: '#EEF0FF', color: '#3730A3', borderRadius: 4, paddingVertical: 3, paddingHorizontal: 7, fontSize: 9 },
    chipOut: { fontFamily: SANS, backgroundColor: '#EEF0F3', color: '#334155', borderRadius: 4, paddingVertical: 3, paddingHorizontal: 7, fontSize: 9 },
    chipMono: { fontFamily: MONO, backgroundColor: '#EEF0F3', color: COLORS.ink, borderRadius: 4, paddingVertical: 3, paddingHorizontal: 7, fontSize: 9 },
    pathRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 7, marginBottom: 5 },
    pathPill: { fontFamily: SANS, backgroundColor: '#EEF0F3', color: COLORS.muted, borderRadius: 9, paddingVertical: 2, paddingHorizontal: 8, fontSize: 7.5, marginRight: 3, marginBottom: 2 },
    pathHot: { fontFamily: SANS, backgroundColor: '#FBEDEC', color: '#C04A40', borderRadius: 9, paddingVertical: 2, paddingHorizontal: 8, fontSize: 7.5, marginRight: 3, marginBottom: 2 },
    pathArr: { color: '#C8CBD2', fontSize: 8, marginRight: 3 },
    sevPill: { borderRadius: 9, paddingVertical: 2, paddingHorizontal: 9 },
    reproRow: { flexDirection: 'row', marginBottom: 2 },
    reproNum: { fontFamily: SANS, width: 13, fontSize: 8.5, color: COLORS.brand, fontWeight: 'bold' },
    reproText: { flex: 1, fontSize: 8.7, color: COLORS.slate, lineHeight: 1.45 },
    fieldLblGreen: { fontFamily: SANS, fontSize: 8, fontWeight: 'bold', color: '#1F9E6E', marginTop: 6, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
    covGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
    covCell: { width: 152, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
    covOn: { backgroundColor: '#EEF0FF' },
    covOff: { backgroundColor: COLORS.panel },
    covCode: { fontFamily: SANS, fontSize: 8.5, fontWeight: 'bold', width: 26 },
    covName: { fontFamily: SANS, fontSize: 7.5, flex: 1, lineHeight: 1.25 },
    covN: { fontFamily: SANS, fontSize: 8.5, fontWeight: 'bold', color: '#3730A3', marginLeft: 4 },
    // evidence / figures
    figure: { marginBottom: 12 },
    figCap: { fontFamily: SANS, fontSize: 8.5, fontWeight: 'bold', color: COLORS.ink, marginBottom: 3 },
    figLinks: { fontFamily: SANS, fontSize: 7, color: COLORS.muted, marginBottom: 3 },
    figImg: { width: '100%', maxHeight: 320, objectFit: 'contain', borderWidth: 1, borderColor: COLORS.line, borderRadius: 4 },
    figRef: { backgroundColor: COLORS.panel, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.line, borderRadius: 4, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center' },
    figRefText: { fontFamily: SANS, fontSize: 8, color: COLORS.muted, textAlign: 'center' },
    // action plan table
    aHead: { flexDirection: 'row', backgroundColor: COLORS.brand, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    aHeadCell: { fontFamily: SANS, color: COLORS.white, fontSize: 7.5, fontWeight: 'bold', paddingVertical: 5, paddingHorizontal: 4 },
    aRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.line, alignItems: 'center' },
    aCell: { fontFamily: SANS, fontSize: 7.5, color: COLORS.slate, paddingVertical: 5, paddingHorizontal: 4 },
    winChip: { borderRadius: 3, paddingVertical: 2, paddingHorizontal: 4, alignSelf: 'flex-start' },
    winChipText: { fontFamily: SANS, color: COLORS.white, fontSize: 6.5, fontWeight: 'bold' },
    legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
    legendDot: { width: 9, height: 9, borderRadius: 2, marginRight: 6 },
    legendText: { fontFamily: SANS, fontSize: 8, color: COLORS.slate },
});

const Badge = ({ severity }: { severity: Severity }) => {
    const sv = SEVERITY[severity];
    return (
        <View style={[s.badge, { backgroundColor: sv.soft }]}>
            <Text style={[s.badgeText, { color: sv.color }]}>{sevLabel(severity).toUpperCase()}</Text>
        </View>
    );
};

// NOTE: @react-pdf `fixed` elements (running header/footer + page numbers) crash with
// "unsupported number" on documents beyond ~12 pages (real reports with many findings).
// Until @react-pdf is upgraded, the per-page header/footer are disabled so long reports render.
// Branding lives on the cover + section headers instead.
const Header = (_: { e: Engagement }) => null;
const Footer = (_: { e: Engagement }) => null;

const Section = ({ n, title }: { n: number; title: string }) => (
    <View style={s.sectionWrap}>
        <Text style={s.sectionNum}>{`${t('SECTION')} ${n}`}</Text>
        <Text style={s.sectionTitle}>{title}</Text>
        <View style={s.sectionRule} />
    </View>
);

const Bullets = ({ items }: { items: string[] }) => (
    <View>
        {items.map((it, i) => (
            <View key={i} style={s.li}>
                <Text style={s.liDot}>•</Text>
                <Text style={s.liText}>{it}</Text>
            </View>
        ))}
    </View>
);

const StoryStep = ({ step }: { step: Engagement['attackStory'][number] }) => (
    <View style={s.storyStep} wrap={false}>
        <View style={s.storyNum}>
            <Text style={s.storyNumText}>{String(step.n)}</Text>
        </View>
        <View style={{ flex: 1 }}>
            <View style={s.storyHead}>
                <Text style={s.storyTitle}>{step.title}</Text>
                {step.refs?.map((r) => (
                    <Text key={r} style={s.refPill}>{r}</Text>
                ))}
            </View>
            <Text style={s.storyText}>{step.text}</Text>
        </View>
    </View>
);

// "estimated" marker — honest signalling that a value was inferred, not measured.
const EstBadge = ({ label = t('ESTIMATED') }: { label?: string }) => (
    <View style={s.estBadge}>
        <Text style={s.estBadgeText}>{label}</Text>
    </View>
);

// Honesty callout (estimatedNote): tells the analyst to calibrate before delivery.
const Callout = ({ text }: { text: string }) => (
    <View style={s.callout} wrap={false}>
        <Text style={s.calloutText}>{text}</Text>
    </View>
);

// Structured affected assets (host[:port] (service) + url), pulled from the finding's own logs.
const AssetList = ({ f }: { f: Finding }) => {
    if (f.assets && f.assets.length > 0) {
        return (
            <View>
                {f.assets.slice(0, 8).map((a, i) => (
                    <View key={i} style={s.assetLine}>
                        <Text style={s.assetMono}>{a.port ? `${a.host}:${a.port}` : a.host}</Text>
                        {(a.service || a.url) && <Text style={s.assetMeta}>{[a.service, a.url].filter(Boolean).join(' · ')}</Text>}
                    </View>
                ))}
            </View>
        );
    }
    return <Text style={s.fieldText}>{f.affected.length ? f.affected.join(', ') : '—'}</Text>;
};

// Dark code/evidence block with the vuln-proving payload highlighted in yellow.
const CodeBlock = ({ code }: { code: string }) => (
    <Text style={s.code}>
        {highlightSegments(code).map((seg, i) =>
            seg.hot ? (
                <Text key={i} style={{ backgroundColor: HOT_BG, color: HOT_FG }}>{seg.text}</Text>
            ) : (
                seg.text
            ),
        )}
    </Text>
);

// Parse OWASP / MITRE / CVE chips from the references list when the explicit fields are absent.
const refMatch = (f: Finding, re: RegExp) => f.references.map((r) => r.label).find((l) => re.test(l));
const FindingCard = ({ f }: { f: Finding }) => {
    const sv = SEVERITY[f.severity];
    const cvssEst = isEstimated(f.provenance?.cvss);
    const sevEst = isEstimated(f.provenance?.severity);
    const owasp = f.owasp ?? refMatch(f, /owasp/i)?.replace(/^owasp\s*/i, '').trim();
    const mitre = f.mitre ?? refMatch(f, /mitre|\bT\d{4}/i)?.replace(/^mitre att&ck\s*/i, '').replace(/^mitre\s*/i, '').trim();
    const cwe = f.cwe && f.cwe !== '—' && !/^MITRE/i.test(f.cwe) ? f.cwe : undefined;
    const cves = f.cve ?? [];
    const a0 = f.assets?.[0];
    const primaryAsset = a0 ? a0.url || (a0.port ? `${a0.host}:${a0.port}` : a0.host) : f.affected[0];
    const path = f.attackPath ?? [];
    return (
        // No outer wrapping <View>: a View that wraps across pages crashes @react-pdf's layout.
        // Return a Fragment of sibling blocks — each dense block is its own wrap={false} unit
        // (atomic, fits a page); the running description is a <Text> (flows across pages safely).
        // Page breaks fall BETWEEN blocks, never inside one.
        <>
            <View wrap={false} style={s.cardHeadBlock}>
                <View style={[s.cardBar, { backgroundColor: sv.color }]} />
                <View style={s.cardHead}>
                    <Text style={s.cardId}>{f.id}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {sevEst && <EstBadge label={t('SEV. EST.')} />}
                        <View style={[s.sevPill, { backgroundColor: sv.soft }]}>
                            <Text style={[s.badgeText, { color: sv.color }]}>{sevLabel(f.severity)}</Text>
                        </View>
                    </View>
                </View>
                <Text style={s.cardTitle}>{f.title}</Text>
                <View style={s.metaGrid}>
                    <Text style={s.chipFilled}>{`CVSS ${f.cvss.toFixed(1)}`}</Text>
                    {cvssEst && <EstBadge label={t('EST.')} />}
                    {cwe && <Text style={s.chipOut}>{cwe}</Text>}
                    {owasp && <Text style={s.chipOut}>{`OWASP ${owasp}`}</Text>}
                    {mitre && <Text style={s.chipOut}>{`MITRE ${mitre}`}</Text>}
                    {cves.map((c) => (
                        <Text key={c} style={s.chipOut}>{c}</Text>
                    ))}
                    {primaryAsset && <Text style={s.chipMono}>{primaryAsset}</Text>}
                </View>
                {path.length > 0 && (
                    <View style={s.pathRow}>
                        {path.map((b, i) => (
                            <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={i >= path.length - 2 ? s.pathHot : s.pathPill}>{b}</Text>
                                {i < path.length - 1 && <Text style={s.pathArr}>→</Text>}
                            </View>
                        ))}
                    </View>
                )}
            </View>
            <View wrap={false}>
                <Text style={s.fieldText}>{f.description}</Text>
            </View>
            {f.evidence && (
                <View wrap={false}>
                    <Text style={s.codeCap}>{f.evidence.caption}</Text>
                    <CodeBlock code={f.evidence.code} />
                </View>
            )}
            {f.reproSteps && f.reproSteps.length > 0 && (
                <View wrap={false}>
                    <Text style={s.fieldLbl}>{t('Reproduction')}</Text>
                    {f.reproSteps.slice(0, 8).map((st, i) => (
                        <View key={i} style={s.reproRow}>
                            <Text style={s.reproNum}>{`${i + 1}.`}</Text>
                            <Text style={s.reproText}>{st}</Text>
                        </View>
                    ))}
                </View>
            )}
            <View style={s.twoCol} wrap={false}>
                <View style={{ flex: 1 }}>
                    <Text style={s.fieldLbl}>{t('Business impact')}</Text>
                    <Text style={s.fieldText}>{f.businessImpact}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={s.fieldLblGreen}>{t('Remediation')}</Text>
                    <Text style={s.fieldText}>{f.remediation}</Text>
                </View>
            </View>
            <View wrap={false}>
                <Text style={s.fieldLbl}>{t('Affected assets')}</Text>
                <AssetList f={f} />
                {f.references.length > 0 && (
                    <Text style={[s.codeCap, { marginTop: 6 }]}>{`${t('References')}: ${f.references.map((r) => r.label).join(' · ')}`}</Text>
                )}
            </View>
            {f.estimatedNote && <Callout text={f.estimatedNote} />}
            <View style={s.cardGap} />
        </>
    );
};

// Numbered evidence plate — terminal/tool-output excerpts render inline; screenshots render the
// resolved image (data URI) or, when unavailable, a captioned reference box.
const FigurePlate = ({ fig }: { fig: Figure }) => {
    const links = fig.findingIds.length ? `${t('Related to')}: ${fig.findingIds.join(', ')}` : '';
    return (
        <View style={s.figure}>
            <Text style={s.figCap}>{`${fig.id} — ${fig.caption}`}</Text>
            {(links || fig.capturedUrl) && (
                <Text style={s.figLinks}>{[links, fig.capturedUrl ? `URL: ${fig.capturedUrl}` : ''].filter(Boolean).join('   ·   ')}</Text>
            )}
            {fig.kind === 'screenshot' ? (
                fig.imageSrc && fig.imageSrc.startsWith('data:') ? (
                    <Image src={fig.imageSrc} style={s.figImg} />
                ) : (
                    <View style={s.figRef}>
                        <Text style={s.figRefText}>{`${t('Screenshot captured during execution')}${fig.capturedUrl ? `\n${fig.capturedUrl}` : ''}`}</Text>
                    </View>
                )
            ) : fig.code ? (
                <CodeBlock code={fig.code} />
            ) : null}
        </View>
    );
};

const ActionTable = ({ items }: { items: ActionItem[] }) => {
    const sorted = [...items].sort((a, b) => WINDOWS.indexOf(a.window) - WINDOWS.indexOf(b.window) || SEVERITY[b.f.severity].rank - SEVERITY[a.f.severity].rank);
    // Fragment, not a wrapping <View>: a container View holding many rows crashes @react-pdf when
    // it spans a page break. The header + wrap=false rows flow directly as page siblings instead.
    return (
        <>
            <View style={s.aHead} wrap={false}>
                <Text style={[s.aHeadCell, { width: 74 }]}>{t('Window')}</Text>
                <Text style={[s.aHeadCell, { width: 30 }]}>ID</Text>
                <Text style={[s.aHeadCell, { flex: 1 }]}>{t('Remediation action')}</Text>
                <Text style={[s.aHeadCell, { width: 48 }]}>{t('Effort')}</Text>
                <Text style={[s.aHeadCell, { width: 38 }]}>{t('Deadline')}</Text>
                <Text style={[s.aHeadCell, { width: 28 }]}>QW</Text>
            </View>
            {sorted.map((a) => (
                <View key={a.f.id} style={[s.aRow, a.quickWin ? { backgroundColor: '#ECFDF5' } : {}]} wrap={false}>
                    <View style={{ width: 74, paddingVertical: 4, paddingHorizontal: 4 }}>
                        <View style={[s.winChip, { backgroundColor: WINDOW_COLOR[a.window] }]}>
                            <Text style={s.winChipText}>{windowLabel(a.window)}</Text>
                        </View>
                    </View>
                    <Text style={[s.aCell, { width: 30, fontFamily: MONO }]}>{a.f.id}</Text>
                    <Text style={[s.aCell, { flex: 1 }]}>{a.f.remediation.length > 96 ? `${a.f.remediation.slice(0, 95)}…` : a.f.remediation}</Text>
                    <Text style={[s.aCell, { width: 48, color: EFFORT[a.effort].color, fontWeight: 'bold' }]}>{effortLabel(a.effort)}</Text>
                    <Text style={[s.aCell, { width: 38 }]}>{`${a.etaDays}d`}</Text>
                    <Text style={[s.aCell, { width: 28, color: '#059669', fontWeight: 'bold' }]}>{a.quickWin ? '★' : '—'}</Text>
                </View>
            ))}
        </>
    );
};

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

// OWASP Top 10 (2021) coverage + observed MITRE ATT&CK techniques, derived from the findings.
const CoverageMatrix = ({ findings }: { findings: Finding[] }) => {
    const hay = (f: Finding) => `${f.owasp ?? ''} ${f.references.map((r) => r.label).join(' ')}`;
    const owaspHits = (code: string) => findings.filter((f) => hay(f).includes(code)).length;
    const mitre = Array.from(
        new Set(findings.map((f) => f.mitre ?? (hay(f).match(/T\d{4}(?:\.\d+)?/)?.[0] ?? '')).filter(Boolean)),
    );
    return (
        <View wrap={false}>
            <Text style={s.h3}>{t('Coverage — OWASP Top 10 (2021)')}</Text>
            <View style={s.covGrid}>
                {OWASP_2021.map(([code, name]) => {
                    const n = owaspHits(code);
                    return (
                        <View key={code} style={[s.covCell, n > 0 ? s.covOn : s.covOff]}>
                            <Text style={[s.covCode, { color: n > 0 ? '#3730A3' : COLORS.muted }]}>{code}</Text>
                            <Text style={[s.covName, { color: n > 0 ? COLORS.slate : COLORS.muted }]}>{name}</Text>
                            {n > 0 && <Text style={s.covN}>{String(n)}</Text>}
                        </View>
                    );
                })}
            </View>
            {mitre.length > 0 && (
                <View>
                    <Text style={[s.h3, { marginTop: 10 }]}>{t('Observed MITRE ATT&CK techniques')}</Text>
                    <View style={s.metaGrid}>
                        {mitre.map((t) => (
                            <Text key={t} style={s.chipOut}>{t}</Text>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
};

export function EngagementPdfDocument({ engagement: e }: { engagement: Engagement }) {
    const sevData = severityCounts(e.findings);
    const catData = categoryCounts(e.findings);
    const rating = riskRating(e.riskScore);
    const items = actionItems(e.findings);
    const qw = quickWins(e.findings);
    const BRAND = e.branding.primary ? `#${e.branding.primary}` : COLORS.brand;
    const figures = e.figures ?? [];
    const hasFigures = figures.length > 0;
    const estimatedCount = e.findings.filter(findingIsEstimated).length;
    const figuresN = 7;
    const appendixN = hasFigures ? 8 : 7;
    const tocItems = [t('Executive Summary'), t('Methodology (PTES)'), t('Attack Narrative'), t('Risk Overview'), t('Detailed Findings'), t('Action Plan'), ...(hasFigures ? [t('Evidence')] : []), t('Appendix')];

    return (
        <Document title={e.title} author={e.branding.appName} creator={e.branding.appName}>
            {/* ── Cover ── */}
            <Page size="A4" style={[s.page, s.cover]}>
                <View style={s.coverBar} />
                <View style={s.coverInner}>
                    <View style={s.brandRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <AppLogo branding={e.branding} size={24} />
                            <Text style={[s.coverBrand, { color: BRAND }]}>{e.branding.appName.toUpperCase()}</Text>
                        </View>
                        <View style={[s.chip, { marginTop: 0 }]}>
                            <Text style={s.chipText}>{e.classification}</Text>
                        </View>
                    </View>
                    <Text style={s.coverKicker}>{t('PENTEST REPORT · PTES')}</Text>
                    <Text style={s.coverTitle}>{e.title}</Text>
                    <Text style={s.coverSub}>{tf('Prepared by {author} for {client}', { author: e.branding.appName, client: e.client })}</Text>
                    <View style={s.kpiRow}>
                        <View style={[s.kpi, { backgroundColor: '#EEF0FF' }]}>
                            <Text style={[s.kpiLbl, { color: '#6663C9' }]}>{t('Overall risk')}</Text>
                            <Text style={[s.kpiNum, { color: BRAND }]}>{`${e.riskScore}`}<Text style={{ fontSize: 11, color: COLORS.muted }}>/100</Text></Text>
                        </View>
                        <View style={[s.kpi, { backgroundColor: '#FBEDEC' }]}>
                            <Text style={[s.kpiLbl, { color: '#C04A40' }]}>{t('Critical')}</Text>
                            <Text style={[s.kpiNum, { color: '#E0483D' }]}>{`${e.findings.filter((f) => f.severity === 'critical').length}`}</Text>
                        </View>
                        <View style={[s.kpi, { backgroundColor: COLORS.panel }]}>
                            <Text style={[s.kpiLbl, { color: COLORS.muted }]}>{t('Findings')}</Text>
                            <Text style={[s.kpiNum, { color: COLORS.ink }]}>{`${e.findings.length}`}</Text>
                        </View>
                        <View style={[s.kpi, { backgroundColor: COLORS.panel }]}>
                            <Text style={[s.kpiLbl, { color: COLORS.muted }]}>{t('Quick wins')}</Text>
                            <Text style={[s.kpiNum, { color: COLORS.ink }]}>{`${qw.length}`}</Text>
                        </View>
                    </View>
                    <View style={{ position: 'absolute', bottom: 56, left: 50 }}>
                        {[
                            [t('Period'), fmtDate(e)],
                            [t('Version'), e.version],
                            [t('Author'), e.author],
                            [t('Contact'), e.contact],
                            [t('Methodology'), 'PTES'],
                        ].map(([k, v]) => (
                            <View key={k} style={s.coverMetaRow}>
                                <Text style={s.coverMetaK}>{k}</Text>
                                <Text style={s.coverMetaV}>{v}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </Page>

            {/* ── Document control + TOC ── */}
            <Page size="A4" style={s.page}>
                <Header e={e} />
                <Footer e={e} />
                <Section n={0} title={t('Document Control')} />
                {[
                    [t('Client'), e.client],
                    [t('Title'), e.title],
                    [t('Classification'), e.classification],
                    [t('Version'), e.version],
                    [t('Testing period'), fmtDate(e)],
                    [t('Authorship'), e.author],
                    [t('Methodology'), 'PTES — Penetration Testing Execution Standard'],
                ].map(([k, v]) => (
                    <View key={k} style={s.kvRow}>
                        <Text style={s.kvK}>{k}</Text>
                        <Text style={s.kvV}>{v}</Text>
                    </View>
                ))}
                <Text style={s.h3}>{t('Scope')}</Text>
                <View style={s.twoCol}>
                    <View style={[s.panel, { flex: 1 }]}>
                        <Text style={s.panelTitle}>{t('In scope')}</Text>
                        <Bullets items={e.scope.inScope} />
                    </View>
                    <View style={[s.panel, { flex: 1 }]}>
                        <Text style={s.panelTitle}>{t('Out of scope')}</Text>
                        <Bullets items={e.scope.outOfScope} />
                    </View>
                </View>
                <Text style={s.h3}>{t('Rules of engagement')}</Text>
                <Bullets items={e.roe} />
                <Text style={s.h3}>{t('Contents')}</Text>
                {tocItems.map((t, i) => (
                    <View key={t} style={s.tocRow}>
                        <Text style={s.tocNum}>{String(i + 1)}</Text>
                        <Text style={s.tocName}>{t}</Text>
                    </View>
                ))}
            </Page>

            {/* ── 1. Executive summary ── */}
            <Page size="A4" style={s.page}>
                <Header e={e} />
                <Footer e={e} />
                <Section n={1} title={t('Executive Summary')} />
                {e.summaryNarrative.map((para, i) => (
                    <Text key={i} style={s.p}>{para}</Text>
                ))}
                {estimatedCount > 0 && (
                    <Callout text={tf('{count} finding(s) have severity/CVSS estimated from automated execution and must be calibrated by an analyst before final delivery.', { count: estimatedCount })} />
                )}
                <View style={[s.twoCol, { alignItems: 'center', marginTop: 8 }]}>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <RiskGauge score={e.riskScore} size={210} />
                    </View>
                    <View style={{ alignItems: 'center', flex: 1 }}>
                        <DonutChart data={sevData} size={148} />
                        <View style={{ marginTop: 6 }}>
                            {SEVERITY_ORDER.map((sev) => (
                                <View key={sev} style={s.legendRow}>
                                    <View style={[s.legendDot, { backgroundColor: SEVERITY[sev].color }]} />
                                    <Text style={s.legendText}>{`${sevLabel(sev)}: ${e.findings.filter((f) => f.severity === sev).length}`}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
                <View style={s.statRow}>
                    <View style={s.stat}>
                        <Text style={s.statNum}>{String(e.findings.length)}</Text>
                        <Text style={s.statLbl}>{t('Total findings')}</Text>
                    </View>
                    <View style={s.stat}>
                        <Text style={[s.statNum, { color: SEVERITY.critical.color }]}>{String(e.findings.filter((f) => f.severity === 'critical').length)}</Text>
                        <Text style={s.statLbl}>{t('Critical')}</Text>
                    </View>
                    <View style={s.stat}>
                        <Text style={[s.statNum, { color: '#059669' }]}>{String(qw.length)}</Text>
                        <Text style={s.statLbl}>{t('Quick wins')}</Text>
                    </View>
                    <View style={s.stat}>
                        <Text style={[s.statNum, { color: COLORS.brand }]}>{String(new Set(e.findings.map((f) => f.category)).size)}</Text>
                        <Text style={s.statLbl}>{t('Categories')}</Text>
                    </View>
                </View>
            </Page>

            {/* ── 2. Methodology ── */}
            <Page size="A4" style={s.page}>
                <Header e={e} />
                <Footer e={e} />
                <Section n={2} title={t('Methodology (PTES)')} />
                <Text style={s.p}>{t('The engagement followed the seven phases of the Penetration Testing Execution Standard (PTES), ensuring consistent coverage from pre-engagement to reporting.')}</Text>
                <View style={{ alignItems: 'center', marginVertical: 8 }}>
                    <PhaseStepper phases={PTES_PHASES.map((p) => ({ n: p.n, name: p.short }))} width={500} />
                </View>
                {e.methodology.map((m) => {
                    const ph = PTES_PHASES.find((p) => p.id === m.phase);
                    return (
                        <View key={m.phase} style={{ marginBottom: 6 }} wrap={false}>
                            <Text style={s.h3}>{`${ph?.n}. ${m.title}`}</Text>
                            <Bullets items={m.activities} />
                        </View>
                    );
                })}
            </Page>

            {/* ── 3. Attack narrative (storytelling) ── */}
            <Page size="A4" style={s.page}>
                <Header e={e} />
                <Footer e={e} />
                <Section n={3} title={t('Attack Narrative')} />
                <Text style={s.p}>{t('How the assessment unfolded, in plain language: from reconnaissance to impact, showing how isolated findings chain into a real path to compromise.')}</Text>
                <View style={{ marginVertical: 8 }}>
                    <AttackChainStrip nodes={e.attackStory.map((st) => ({ n: st.n, label: st.title.split(' ')[0] }))} width={507} />
                </View>
                {e.attackStory.map((step) => (
                    <StoryStep key={step.n} step={step} />
                ))}
            </Page>

            {/* ── 4. Risk overview ── */}
            <Page size="A4" style={s.page}>
                <Header e={e} />
                <Footer e={e} />
                <Section n={4} title={t('Risk Overview')} />
                <Text style={s.p}>{t('Risk distribution of findings by likelihood and impact, and concentration by category of the assessed surface.')}</Text>
                <View style={[s.twoCol, { alignItems: 'flex-start' }]}>
                    <View style={{ alignItems: 'center', width: 240 }}>
                        <Text style={s.caption}>{t('Risk matrix (likelihood × impact)')}</Text>
                        <RiskMatrix findings={e.findings} size={235} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.panelTitle}>{t('Findings by category')}</Text>
                        <HBarChart data={catData} width={240} />
                        <Text style={[s.panelTitle, { marginTop: 12 }]}>{t('Severity legend')}</Text>
                        {SEVERITY_ORDER.map((sev) => (
                            <View key={sev} style={s.legendRow}>
                                <View style={[s.legendDot, { backgroundColor: SEVERITY[sev].color }]} />
                                <Text style={s.legendText}>{sevLabel(sev)}</Text>
                            </View>
                        ))}
                    </View>
                </View>
                <View style={{ marginTop: 12 }}>
                    <CoverageMatrix findings={e.findings} />
                </View>
            </Page>

            {/* ── 5. Findings ── */}
            <Page size="A4" style={s.page}>
                <Header e={e} />
                <Footer e={e} />
                <Section n={5} title={t('Detailed Findings')} />
                <View style={s.tHead}>
                    <Text style={[s.tHeadCell, { width: 34 }]}>ID</Text>
                    <Text style={[s.tHeadCell, { flex: 1 }]}>{t('Finding')}</Text>
                    <Text style={[s.tHeadCell, { width: 60 }]}>{t('Severity')}</Text>
                    <Text style={[s.tHeadCell, { width: 38 }]}>CVSS</Text>
                    <Text style={[s.tHeadCell, { width: 86 }]}>{t('Category')}</Text>
                </View>
                {[...e.findings]
                    .sort((a, b) => b.cvss - a.cvss)
                    .map((f) => (
                        <View key={f.id} style={s.tRow} wrap={false}>
                            <Text style={[s.tCell, { width: 34, fontFamily: MONO }]}>{f.id}</Text>
                            <Text style={[s.tCell, { flex: 1 }]}>{f.title}</Text>
                            <Text style={[s.tCell, { width: 60, color: SEVERITY[f.severity].color, fontWeight: 'bold' }]}>{sevLabel(f.severity)}</Text>
                            <Text style={[s.tCell, { width: 38 }]}>{f.cvss.toFixed(1)}</Text>
                            <Text style={[s.tCell, { width: 86 }]}>{f.category}</Text>
                        </View>
                    ))}
                <Text style={[s.h3, { marginTop: 14 }]} break>{t('Finding details')}</Text>
                {[...e.findings]
                    .sort((a, b) => SEVERITY[b.severity].rank - SEVERITY[a.severity].rank || b.cvss - a.cvss)
                    .map((f) => (
                        <FindingCard key={f.id} f={f} />
                    ))}
            </Page>

            {/* ── 6. Action plan ── */}
            <Page size="A4" style={s.page}>
                <Header e={e} />
                <Footer e={e} />
                <Section n={6} title={t('Action Plan')} />
                <Text style={s.p}>{t('Remediation roadmap prioritized by risk and effort. Quick wins (high impact, low effort) should be executed first; the timeline chart shows what takes the most and least time.')}</Text>
                <Text style={s.caption}>{t('Remediation roadmap')}</Text>
                <View style={{ alignItems: 'center', marginBottom: 6 }}>
                    <RemediationRoadmap items={items} width={507} />
                </View>
                <View style={[s.twoCol, { alignItems: 'flex-start', marginTop: 2 }]}>
                    <View style={{ alignItems: 'center', width: 235 }}>
                        <Text style={s.caption}>{t('Quick wins (impact × effort)')}</Text>
                        <QuickWinsQuadrant items={items} size={232} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.caption}>{t('Time to fix per finding')}</Text>
                        <EffortTimeBars items={items} width={240} />
                    </View>
                </View>
                <Text style={[s.h3, { marginTop: 10 }]} break>{t('Prioritized remediation items')}</Text>
                <ActionTable items={items} />
            </Page>

            {/* ── 7. Evidence (figures) ── */}
            {hasFigures && (
                <Page size="A4" style={s.page}>
                    <Header e={e} />
                    <Footer e={e} />
                    <Section n={figuresN} title={t('Evidence')} />
                    <Text style={s.p}>{t('Numbered evidence plan: real tool outputs and screenshots captured during execution, linked to the corresponding findings.')}</Text>
                    {figures.map((fig) => (
                        <FigurePlate key={fig.id} fig={fig} />
                    ))}
                </Page>
            )}

            {/* ── Appendix ── */}
            <Page size="A4" style={s.page}>
                <Header e={e} />
                <Footer e={e} />
                <Section n={appendixN} title={t('Appendix')} />
                <Text style={s.h3}>{t('Strategic recommendations')}</Text>
                {e.recommendations.map((r, i) => (
                    <View key={i} style={s.li}>
                        <Text style={s.liDot}>•</Text>
                        <Text style={s.liText}>
                            <Text style={{ fontWeight: 'bold', color: WINDOW_COLOR[r.priority] }}>{`${windowLabel(r.priority)}: `}</Text>
                            {r.text}
                        </Text>
                    </View>
                ))}
                <Text style={s.h3}>{t('Severity classification')}</Text>
                {SEVERITY_ORDER.map((sev) => (
                    <View key={sev} style={s.legendRow}>
                        <View style={[s.legendDot, { backgroundColor: SEVERITY[sev].color }]} />
                        <Text style={s.legendText}>{`${sevLabel(sev)} — ${t('risk guidance and treatment priority.')}`}</Text>
                    </View>
                ))}
                <View style={{ marginTop: 4 }}>
                    <CoverageMatrix findings={e.findings} />
                </View>
                <Text style={s.h3}>{t('Notice')}</Text>
                <Text style={s.p}>{tf('Report generated by {app} from an authorized engagement. Confidential content; distribute only to authorized parties. Proofs of concept were non-destructive and limited to the agreed scope.', { app: e.branding.appName })}</Text>
            </Page>
        </Document>
    );
}

export async function generatePtesPdfBlob(engagement: Engagement): Promise<Blob> {
    if (!fontsRegistered) registerReportFonts();
    return pdf(<EngagementPdfDocument engagement={engagement} />).toBlob();
}
