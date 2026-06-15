// Premium "book-like" PTES report — PDF flagship.
// Storytelling narrative, action plan (quick wins + timeline), vector charts, whitelabel co-branding.
// Typography is a book pairing: a serif (Noto Serif) for running text + headings — the "book" voice —
// a humanist sans for furniture (chips, tables, headers/footers), and a mono for code/evidence.
import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';

import { AttackChainStrip, DonutChart, EffortTimeBars, HBarChart, PhaseStepper, QuickWinsQuadrant, RemediationRoadmap, RiskGauge, RiskMatrix } from './charts';
import { PTES_PHASES, type Engagement, type Figure, type Finding, type Severity } from './engagement';
import { AppLogo, ClientLogo } from './report-logo';
import { actionItems, categoryCounts, COLORS, EFFORT, findingIsEstimated, fmtDate, isEstimated, quickWins, riskRating, SEVERITY, SEVERITY_ORDER, severityCounts, WINDOW_COLOR, WINDOWS, type ActionItem } from './theme';

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
    Font.registerHyphenationCallback((w) => [w]);
    fontsRegistered = true;
}

const s = StyleSheet.create({
    page: { backgroundColor: COLORS.paper, color: COLORS.slate, fontFamily: SANS, fontSize: 9.5, lineHeight: 1.5, paddingTop: 58, paddingBottom: 46, paddingHorizontal: 44 },
    header: { position: 'absolute', top: 22, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingBottom: 6 },
    headerL: { flexDirection: 'row', alignItems: 'center' },
    headerBrand: { fontFamily: SANS, fontSize: 10, fontWeight: 'bold', color: COLORS.brand, letterSpacing: 0.5, marginLeft: 6 },
    headerMeta: { fontFamily: SANS, fontSize: 7.5, color: COLORS.muted },
    footer: { position: 'absolute', bottom: 22, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 6 },
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
    kpiLbl: { fontFamily: SANS, fontSize: 9 },
    kpiNum: { fontFamily: SANS, fontSize: 21, fontWeight: 'bold', marginTop: 2 },
    coverPrepared: { fontFamily: SANS, fontSize: 9, color: COLORS.muted, marginTop: 22, marginBottom: 8 },
    chip: { alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.coral, borderRadius: 3, paddingVertical: 3, paddingHorizontal: 8, marginTop: 22 },
    chipText: { fontFamily: SANS, fontSize: 9, color: COLORS.coral, fontWeight: 'bold', letterSpacing: 1 },
    coverMetaRow: { flexDirection: 'row', marginTop: 8 },
    coverMetaK: { fontFamily: SANS, fontSize: 9, color: COLORS.muted, width: 70 },
    coverMetaV: { fontFamily: SANS, fontSize: 9, color: COLORS.slate },
    // section / chapter opener
    sectionWrap: { marginTop: 6, marginBottom: 8 },
    sectionNum: { fontFamily: SANS, fontSize: 9, fontWeight: 'bold', color: COLORS.brand, letterSpacing: 1.5 },
    sectionTitle: { fontSize: 19, fontWeight: 'bold', color: COLORS.ink, marginTop: 2 },
    sectionRule: { height: 2, backgroundColor: COLORS.brand, width: 38, marginTop: 6, marginBottom: 8 },
    h3: { fontSize: 12, fontWeight: 'bold', color: COLORS.ink, marginTop: 10, marginBottom: 4 },
    p: { fontSize: 9.5, color: COLORS.slate, marginBottom: 6, textAlign: 'justify', lineHeight: 1.6 },
    caption: { fontFamily: SANS, fontSize: 8, fontWeight: 'bold', color: COLORS.ink, marginBottom: 4, textAlign: 'center' },
    // panels / cards
    statRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    stat: { flex: 1, backgroundColor: COLORS.panel, borderRadius: 6, paddingVertical: 11, paddingHorizontal: 6, alignItems: 'center' },
    statNum: { fontFamily: SANS, fontSize: 20, fontWeight: 'bold', color: COLORS.ink, lineHeight: 1.1 },
    statLbl: { fontFamily: SANS, fontSize: 7, color: COLORS.muted, marginTop: 5, textAlign: 'center', lineHeight: 1.2 },
    twoCol: { flexDirection: 'row', gap: 14, marginTop: 6 },
    panel: { backgroundColor: COLORS.panel, borderRadius: 6, padding: 10 },
    panelTitle: { fontFamily: SANS, fontSize: 9, fontWeight: 'bold', color: COLORS.ink, marginBottom: 4 },
    li: { flexDirection: 'row', marginBottom: 3 },
    liDot: { width: 10, fontSize: 9, color: COLORS.brand },
    liText: { flex: 1, fontSize: 9.5, color: COLORS.slate, lineHeight: 1.5 },
    kvRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingVertical: 3 },
    kvK: { fontFamily: SANS, width: 120, fontSize: 8.5, color: COLORS.muted, fontWeight: 'bold' },
    kvV: { flex: 1, fontSize: 9, color: COLORS.slate },
    tocRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLORS.line },
    tocNum: { fontFamily: SANS, fontSize: 9.5, color: COLORS.brand, fontWeight: 'bold', width: 22 },
    tocName: { flex: 1, fontSize: 10, color: COLORS.slate },
    // story timeline
    storyStep: { flexDirection: 'row', marginBottom: 9 },
    storyNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    storyNumText: { fontFamily: SANS, color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
    storyHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, flexWrap: 'wrap' },
    storyTitle: { fontSize: 11.5, fontWeight: 'bold', color: COLORS.ink, marginRight: 6 },
    refPill: { fontFamily: SANS, backgroundColor: '#DBEAFE', color: COLORS.brand, fontSize: 7, fontWeight: 'bold', borderRadius: 3, paddingVertical: 1, paddingHorizontal: 4, marginRight: 3 },
    storyText: { fontSize: 9.5, color: COLORS.slate, lineHeight: 1.55, textAlign: 'justify' },
    // findings table
    tHead: { flexDirection: 'row', backgroundColor: COLORS.brand, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    tHeadCell: { fontFamily: SANS, color: COLORS.white, fontSize: 8, fontWeight: 'bold', padding: 5 },
    tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.line },
    tCell: { fontSize: 8.5, color: COLORS.slate, padding: 5 },
    // finding card
    card: { borderWidth: 1, borderColor: COLORS.line, borderLeftWidth: 4, borderRadius: 5, padding: 10, marginBottom: 10 },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardId: { fontFamily: SANS, fontSize: 8, color: COLORS.muted, fontWeight: 'bold' },
    cardTitle: { fontSize: 12.5, fontWeight: 'bold', color: COLORS.ink, marginTop: 1, marginBottom: 4 },
    badge: { borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6 },
    badgeText: { fontFamily: SANS, fontSize: 7.5, fontWeight: 'bold', letterSpacing: 0.5 },
    metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 5, alignItems: 'center' },
    metaPill: { fontFamily: SANS, backgroundColor: COLORS.panel, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6, fontSize: 7.5, color: COLORS.slate },
    fieldLbl: { fontFamily: SANS, fontSize: 8, fontWeight: 'bold', color: COLORS.brand, marginTop: 6, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
    fieldText: { fontSize: 9.5, color: COLORS.slate, lineHeight: 1.5 },
    code: { backgroundColor: '#0F172A', color: '#E2E8F0', fontFamily: MONO, fontSize: 8, padding: 8, borderRadius: 4, marginTop: 4, lineHeight: 1.4 },
    codeCap: { fontFamily: SANS, fontSize: 7.5, color: COLORS.muted, fontStyle: 'italic', marginTop: 5 },
    // estimated / honesty
    estBadge: { backgroundColor: '#FEF3C7', borderRadius: 3, paddingVertical: 2, paddingHorizontal: 5 },
    estBadgeText: { fontFamily: SANS, fontSize: 6.5, fontWeight: 'bold', color: '#92400E', letterSpacing: 0.3 },
    callout: { flexDirection: 'row', backgroundColor: '#FFFBEB', borderLeftWidth: 3, borderLeftColor: '#F59E0B', borderRadius: 3, paddingVertical: 5, paddingHorizontal: 7, marginTop: 6 },
    calloutText: { fontFamily: SANS, flex: 1, fontSize: 7.5, color: '#92400E', lineHeight: 1.4 },
    assetLine: { flexDirection: 'row', marginBottom: 2, alignItems: 'baseline' },
    assetMono: { fontFamily: MONO, fontSize: 8, color: COLORS.ink },
    assetMeta: { fontFamily: SANS, fontSize: 7.5, color: COLORS.muted, marginLeft: 4 },
    // Direction 3 — taxonomy chips, kill-chain mini path, reproduction, two-tone fields
    chipFilled: { fontFamily: SANS, backgroundColor: '#EEF0FF', color: '#3730A3', borderRadius: 4, paddingVertical: 2, paddingHorizontal: 7, fontSize: 7.5 },
    chipOut: { fontFamily: SANS, borderWidth: 1, borderColor: COLORS.line, color: COLORS.slate, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 7, fontSize: 7.5 },
    chipMono: { fontFamily: MONO, borderWidth: 1, borderColor: COLORS.line, color: COLORS.ink, borderRadius: 4, paddingVertical: 2, paddingHorizontal: 7, fontSize: 7.5 },
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
    covCell: { width: 152, borderRadius: 6, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
    covOn: { backgroundColor: '#EEF0FF', borderColor: '#C7C2F0' },
    covOff: { backgroundColor: COLORS.paper, borderColor: COLORS.line },
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
            <Text style={[s.badgeText, { color: sv.color }]}>{sv.label.toUpperCase()}</Text>
        </View>
    );
};

const Header = ({ e }: { e: Engagement }) => (
    <View style={s.header} fixed>
        <View style={s.headerL}>
            <AppLogo branding={e.branding} size={15} />
            <Text style={s.headerBrand}>{e.branding.appName.toUpperCase()}</Text>
        </View>
        <Text style={s.headerMeta}>{`${e.client} · ${e.classification}`}</Text>
    </View>
);
const Footer = ({ e }: { e: Engagement }) => (
    <View style={s.footer} fixed>
        <Text style={s.footerText}>{e.title}</Text>
        <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
);

const Section = ({ n, title }: { n: number; title: string }) => (
    <View style={s.sectionWrap}>
        <Text style={s.sectionNum}>{`SEÇÃO ${n}`}</Text>
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
const EstBadge = ({ label = 'ESTIMADO' }: { label?: string }) => (
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
        <View style={[s.card, { borderLeftColor: sv.color, borderLeftWidth: 6 }]} wrap={false}>
            <View style={s.cardHead}>
                <Text style={s.cardId}>{f.id}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {sevEst && <EstBadge label="SEV. EST." />}
                    <View style={[s.sevPill, { backgroundColor: sv.soft }]}>
                        <Text style={[s.badgeText, { color: sv.color }]}>{sv.label}</Text>
                    </View>
                </View>
            </View>
            <Text style={s.cardTitle}>{f.title}</Text>
            <View style={s.metaGrid}>
                <Text style={s.chipFilled}>{`CVSS ${f.cvss.toFixed(1)}`}</Text>
                {cvssEst && <EstBadge label="EST." />}
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
            <Text style={s.fieldText}>{f.description}</Text>
            {f.evidence && (
                <View>
                    <Text style={s.codeCap}>{f.evidence.caption}</Text>
                    <Text style={s.code}>{f.evidence.code}</Text>
                </View>
            )}
            {f.reproSteps && f.reproSteps.length > 0 && (
                <View>
                    <Text style={s.fieldLbl}>Reprodução</Text>
                    {f.reproSteps.slice(0, 8).map((st, i) => (
                        <View key={i} style={s.reproRow}>
                            <Text style={s.reproNum}>{`${i + 1}.`}</Text>
                            <Text style={s.reproText}>{st}</Text>
                        </View>
                    ))}
                </View>
            )}
            <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                    <Text style={s.fieldLbl}>Impacto ao negócio</Text>
                    <Text style={s.fieldText}>{f.businessImpact}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={s.fieldLblGreen}>Remediação</Text>
                    <Text style={s.fieldText}>{f.remediation}</Text>
                </View>
            </View>
            <Text style={s.fieldLbl}>Ativos afetados</Text>
            <AssetList f={f} />
            {f.references.length > 0 && (
                <Text style={[s.codeCap, { marginTop: 6 }]}>{`Referências: ${f.references.map((r) => r.label).join(' · ')}`}</Text>
            )}
            {f.estimatedNote && <Callout text={f.estimatedNote} />}
        </View>
    );
};

// Numbered evidence plate — terminal/tool-output excerpts render inline; screenshots render the
// resolved image (data URI) or, when unavailable, a captioned reference box.
const FigurePlate = ({ fig }: { fig: Figure }) => {
    const links = fig.findingIds.length ? `Referente a: ${fig.findingIds.join(', ')}` : '';
    return (
        <View style={s.figure} wrap={false}>
            <Text style={s.figCap}>{`${fig.id} — ${fig.caption}`}</Text>
            {(links || fig.capturedUrl) && (
                <Text style={s.figLinks}>{[links, fig.capturedUrl ? `URL: ${fig.capturedUrl}` : ''].filter(Boolean).join('   ·   ')}</Text>
            )}
            {fig.kind === 'screenshot' ? (
                fig.imageSrc && fig.imageSrc.startsWith('data:') ? (
                    <Image src={fig.imageSrc} style={s.figImg} />
                ) : (
                    <View style={s.figRef}>
                        <Text style={s.figRefText}>{`Captura de tela registrada durante a execução${fig.capturedUrl ? `\n${fig.capturedUrl}` : ''}`}</Text>
                    </View>
                )
            ) : fig.code ? (
                <Text style={s.code}>{fig.code}</Text>
            ) : null}
        </View>
    );
};

const ActionTable = ({ items }: { items: ActionItem[] }) => {
    const sorted = [...items].sort((a, b) => WINDOWS.indexOf(a.window) - WINDOWS.indexOf(b.window) || SEVERITY[b.f.severity].rank - SEVERITY[a.f.severity].rank);
    return (
        <View>
            <View style={s.aHead}>
                <Text style={[s.aHeadCell, { width: 74 }]}>Janela</Text>
                <Text style={[s.aHeadCell, { width: 30 }]}>ID</Text>
                <Text style={[s.aHeadCell, { flex: 1 }]}>Ação de correção</Text>
                <Text style={[s.aHeadCell, { width: 48 }]}>Esforço</Text>
                <Text style={[s.aHeadCell, { width: 38 }]}>Prazo</Text>
                <Text style={[s.aHeadCell, { width: 28 }]}>QW</Text>
            </View>
            {sorted.map((a) => (
                <View key={a.f.id} style={[s.aRow, a.quickWin ? { backgroundColor: '#ECFDF5' } : {}]} wrap={false}>
                    <View style={{ width: 74, paddingVertical: 4, paddingHorizontal: 4 }}>
                        <View style={[s.winChip, { backgroundColor: WINDOW_COLOR[a.window] }]}>
                            <Text style={s.winChipText}>{a.window}</Text>
                        </View>
                    </View>
                    <Text style={[s.aCell, { width: 30, fontFamily: MONO }]}>{a.f.id}</Text>
                    <Text style={[s.aCell, { flex: 1 }]}>{a.f.remediation.length > 96 ? `${a.f.remediation.slice(0, 95)}…` : a.f.remediation}</Text>
                    <Text style={[s.aCell, { width: 48, color: EFFORT[a.effort].color, fontWeight: 'bold' }]}>{EFFORT[a.effort].label}</Text>
                    <Text style={[s.aCell, { width: 38 }]}>{`${a.etaDays}d`}</Text>
                    <Text style={[s.aCell, { width: 28, color: '#059669', fontWeight: 'bold' }]}>{a.quickWin ? '★' : '—'}</Text>
                </View>
            ))}
        </View>
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
        <View>
            <Text style={s.h3}>Cobertura — OWASP Top 10 (2021)</Text>
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
                    <Text style={[s.h3, { marginTop: 10 }]}>Técnicas MITRE ATT&CK observadas</Text>
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
    const tocItems = ['Sumário Executivo', 'Narrativa do Ataque', 'Visão Geral de Risco', 'Metodologia (PTES)', 'Achados Detalhados', 'Plano de Ação', ...(hasFigures ? ['Evidências'] : []), 'Apêndice'];

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
                    <Text style={s.coverKicker}>RELATÓRIO DE PENTEST · PTES</Text>
                    <Text style={s.coverTitle}>{e.title}</Text>
                    <Text style={s.coverSub}>{`Preparado por ${e.branding.appName} para ${e.client}`}</Text>
                    <View style={s.kpiRow}>
                        <View style={[s.kpi, { backgroundColor: '#EEF0FF' }]}>
                            <Text style={[s.kpiLbl, { color: '#6663C9' }]}>Risco geral</Text>
                            <Text style={[s.kpiNum, { color: BRAND }]}>{`${e.riskScore}`}<Text style={{ fontSize: 11, color: COLORS.muted }}>/100</Text></Text>
                        </View>
                        <View style={[s.kpi, { backgroundColor: '#FBEDEC' }]}>
                            <Text style={[s.kpiLbl, { color: '#C04A40' }]}>Críticos</Text>
                            <Text style={[s.kpiNum, { color: '#E0483D' }]}>{`${e.findings.filter((f) => f.severity === 'critical').length}`}</Text>
                        </View>
                        <View style={[s.kpi, { backgroundColor: COLORS.panel }]}>
                            <Text style={[s.kpiLbl, { color: COLORS.muted }]}>Achados</Text>
                            <Text style={[s.kpiNum, { color: COLORS.ink }]}>{`${e.findings.length}`}</Text>
                        </View>
                        <View style={[s.kpi, { backgroundColor: COLORS.panel }]}>
                            <Text style={[s.kpiLbl, { color: COLORS.muted }]}>Quick wins</Text>
                            <Text style={[s.kpiNum, { color: COLORS.ink }]}>{`${qw.length}`}</Text>
                        </View>
                    </View>
                    <View style={{ position: 'absolute', bottom: 56, left: 50 }}>
                        {[
                            ['Período', fmtDate(e)],
                            ['Versão', e.version],
                            ['Autor', e.author],
                            ['Contato', e.contact],
                            ['Metodologia', 'PTES'],
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
                <Section n={0} title="Controle do Documento" />
                {[
                    ['Cliente', e.client],
                    ['Título', e.title],
                    ['Classificação', e.classification],
                    ['Versão', e.version],
                    ['Período de testes', fmtDate(e)],
                    ['Autoria', e.author],
                    ['Metodologia', 'PTES — Penetration Testing Execution Standard'],
                ].map(([k, v]) => (
                    <View key={k} style={s.kvRow}>
                        <Text style={s.kvK}>{k}</Text>
                        <Text style={s.kvV}>{v}</Text>
                    </View>
                ))}
                <Text style={s.h3}>Escopo</Text>
                <View style={s.twoCol}>
                    <View style={[s.panel, { flex: 1 }]}>
                        <Text style={s.panelTitle}>No escopo</Text>
                        <Bullets items={e.scope.inScope} />
                    </View>
                    <View style={[s.panel, { flex: 1 }]}>
                        <Text style={s.panelTitle}>Fora do escopo</Text>
                        <Bullets items={e.scope.outOfScope} />
                    </View>
                </View>
                <Text style={s.h3}>Regras de engajamento</Text>
                <Bullets items={e.roe} />
                <Text style={s.h3}>Índice</Text>
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
                <Section n={1} title="Sumário Executivo" />
                {e.summaryNarrative.map((para, i) => (
                    <Text key={i} style={s.p}>{para}</Text>
                ))}
                {estimatedCount > 0 && (
                    <Callout text={`${estimatedCount} achado(s) têm severidade/CVSS estimados a partir da execução automatizada e devem ser calibrados por um analista antes da entrega final.`} />
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
                                    <Text style={s.legendText}>{`${SEVERITY[sev].label}: ${e.findings.filter((f) => f.severity === sev).length}`}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
                <View style={s.statRow}>
                    <View style={s.stat}>
                        <Text style={s.statNum}>{String(e.findings.length)}</Text>
                        <Text style={s.statLbl}>Achados totais</Text>
                    </View>
                    <View style={s.stat}>
                        <Text style={[s.statNum, { color: SEVERITY.critical.color }]}>{String(e.findings.filter((f) => f.severity === 'critical').length)}</Text>
                        <Text style={s.statLbl}>Críticos</Text>
                    </View>
                    <View style={s.stat}>
                        <Text style={[s.statNum, { color: '#059669' }]}>{String(qw.length)}</Text>
                        <Text style={s.statLbl}>Quick wins</Text>
                    </View>
                    <View style={s.stat}>
                        <Text style={[s.statNum, { color: COLORS.brand }]}>{String(new Set(e.findings.map((f) => f.category)).size)}</Text>
                        <Text style={s.statLbl}>Categorias</Text>
                    </View>
                </View>
            </Page>

            {/* ── 2. Attack narrative (storytelling) ── */}
            <Page size="A4" style={s.page}>
                <Header e={e} />
                <Footer e={e} />
                <Section n={2} title="Narrativa do Ataque" />
                <Text style={s.p}>Como a avaliação evoluiu, em linguagem acessível: do reconhecimento ao impacto, mostrando como achados isolados se encadeiam em um caminho real de comprometimento.</Text>
                <View style={{ marginVertical: 8 }}>
                    <AttackChainStrip nodes={e.attackStory.map((st) => ({ n: st.n, label: st.title.split(' ')[0] }))} width={507} />
                </View>
                {e.attackStory.map((step) => (
                    <StoryStep key={step.n} step={step} />
                ))}
            </Page>

            {/* ── 3. Risk overview ── */}
            <Page size="A4" style={s.page}>
                <Header e={e} />
                <Footer e={e} />
                <Section n={3} title="Visão Geral de Risco" />
                <Text style={s.p}>Distribuição de risco dos achados por probabilidade e impacto, e concentração por categoria de superfície avaliada.</Text>
                <View style={[s.twoCol, { alignItems: 'flex-start' }]}>
                    <View style={{ alignItems: 'center', width: 240 }}>
                        <Text style={s.caption}>Matriz de risco (probabilidade × impacto)</Text>
                        <RiskMatrix findings={e.findings} size={235} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.panelTitle}>Achados por categoria</Text>
                        <HBarChart data={catData} width={240} />
                        <Text style={[s.panelTitle, { marginTop: 12 }]}>Legenda de severidade</Text>
                        {SEVERITY_ORDER.map((sev) => (
                            <View key={sev} style={s.legendRow}>
                                <View style={[s.legendDot, { backgroundColor: SEVERITY[sev].color }]} />
                                <Text style={s.legendText}>{SEVERITY[sev].label}</Text>
                            </View>
                        ))}
                    </View>
                </View>
                <View style={{ marginTop: 12 }}>
                    <CoverageMatrix findings={e.findings} />
                </View>
            </Page>

            {/* ── 4. Methodology ── */}
            <Page size="A4" style={s.page}>
                <Header e={e} />
                <Footer e={e} />
                <Section n={4} title="Metodologia (PTES)" />
                <Text style={s.p}>O engajamento seguiu as sete fases do Penetration Testing Execution Standard (PTES), garantindo cobertura consistente do pré-engajamento ao relatório.</Text>
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

            {/* ── 5. Findings ── */}
            <Page size="A4" style={s.page}>
                <Header e={e} />
                <Footer e={e} />
                <Section n={5} title="Achados Detalhados" />
                <View style={s.tHead}>
                    <Text style={[s.tHeadCell, { width: 34 }]}>ID</Text>
                    <Text style={[s.tHeadCell, { flex: 1 }]}>Achado</Text>
                    <Text style={[s.tHeadCell, { width: 60 }]}>Severidade</Text>
                    <Text style={[s.tHeadCell, { width: 38 }]}>CVSS</Text>
                    <Text style={[s.tHeadCell, { width: 86 }]}>Categoria</Text>
                </View>
                {[...e.findings]
                    .sort((a, b) => b.cvss - a.cvss)
                    .map((f) => (
                        <View key={f.id} style={s.tRow} wrap={false}>
                            <Text style={[s.tCell, { width: 34, fontFamily: MONO }]}>{f.id}</Text>
                            <Text style={[s.tCell, { flex: 1 }]}>{f.title}</Text>
                            <Text style={[s.tCell, { width: 60, color: SEVERITY[f.severity].color, fontWeight: 'bold' }]}>{SEVERITY[f.severity].label}</Text>
                            <Text style={[s.tCell, { width: 38 }]}>{f.cvss.toFixed(1)}</Text>
                            <Text style={[s.tCell, { width: 86 }]}>{f.category}</Text>
                        </View>
                    ))}
                <Text style={[s.h3, { marginTop: 14 }]} break>Detalhamento dos achados</Text>
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
                <Section n={6} title="Plano de Ação" />
                <Text style={s.p}>Roteiro de remediação priorizado por risco e esforço. Os quick wins (alto impacto, baixo esforço) devem ser executados primeiro; o gráfico de prazos mostra o que leva mais e menos tempo.</Text>
                <Text style={s.caption}>Roteiro de remediação</Text>
                <View style={{ alignItems: 'center', marginBottom: 6 }}>
                    <RemediationRoadmap items={items} width={507} />
                </View>
                <View style={[s.twoCol, { alignItems: 'flex-start', marginTop: 2 }]}>
                    <View style={{ alignItems: 'center', width: 235 }}>
                        <Text style={s.caption}>Quick wins (impacto × esforço)</Text>
                        <QuickWinsQuadrant items={items} size={232} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.caption}>Tempo de correção por achado</Text>
                        <EffortTimeBars items={items} width={240} />
                    </View>
                </View>
                <Text style={[s.h3, { marginTop: 10 }]} break>Itens de correção priorizados</Text>
                <ActionTable items={items} />
            </Page>

            {/* ── 7. Evidence (figures) ── */}
            {hasFigures && (
                <Page size="A4" style={s.page}>
                    <Header e={e} />
                    <Footer e={e} />
                    <Section n={figuresN} title="Evidências" />
                    <Text style={s.p}>Plano de evidências numerado: saídas reais de ferramentas e capturas de tela registradas durante a execução, vinculadas aos achados correspondentes.</Text>
                    {figures.map((fig) => (
                        <FigurePlate key={fig.id} fig={fig} />
                    ))}
                </Page>
            )}

            {/* ── Appendix ── */}
            <Page size="A4" style={s.page}>
                <Header e={e} />
                <Footer e={e} />
                <Section n={appendixN} title="Apêndice" />
                <Text style={s.h3}>Recomendações estratégicas</Text>
                {e.recommendations.map((r, i) => (
                    <View key={i} style={s.li}>
                        <Text style={s.liDot}>•</Text>
                        <Text style={s.liText}>
                            <Text style={{ fontWeight: 'bold', color: WINDOW_COLOR[r.priority] }}>{`${r.priority}: `}</Text>
                            {r.text}
                        </Text>
                    </View>
                ))}
                <Text style={s.h3}>Classificação de severidade</Text>
                {SEVERITY_ORDER.map((sev) => (
                    <View key={sev} style={s.legendRow}>
                        <View style={[s.legendDot, { backgroundColor: SEVERITY[sev].color }]} />
                        <Text style={s.legendText}>{`${SEVERITY[sev].label} — orientação de risco e prioridade de tratamento.`}</Text>
                    </View>
                ))}
                <Text style={s.h3}>Aviso</Text>
                <Text style={s.p}>{`Relatório gerado por ${e.branding.appName} a partir de um engajamento autorizado. Conteúdo confidencial; distribua apenas a partes autorizadas. As provas de conceito foram não destrutivas e limitadas ao escopo acordado.`}</Text>
            </Page>
        </Document>
    );
}

export async function generatePtesPdfBlob(engagement: Engagement): Promise<Blob> {
    if (!fontsRegistered) registerReportFonts();
    return pdf(<EngagementPdfDocument engagement={engagement} />).toBlob();
}
