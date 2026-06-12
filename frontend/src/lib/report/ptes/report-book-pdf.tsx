// Premium "book-like" PTES report — PDF flagship.
// Storytelling narrative, action plan (quick wins + timeline), vector charts, whitelabel co-branding.
import { Document, Font, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';

import { AttackChainStrip, DonutChart, EffortTimeBars, HBarChart, PhaseStepper, QuickWinsQuadrant, RemediationRoadmap, RiskGauge, RiskMatrix } from './charts';
import { PTES_PHASES, type Engagement, type Finding, type Severity } from './engagement';
import { AppLogo, ClientLogo } from './report-logo';
import { actionItems, categoryCounts, COLORS, EFFORT, fmtDate, quickWins, riskRating, SEVERITY, SEVERITY_ORDER, severityCounts, WINDOW_COLOR, WINDOWS, type ActionItem } from './theme';

const FONT = 'NotoSans';
const MONO = 'NotoSansMono';

let fontsRegistered = false;
export function registerReportFonts(base = '/fonts'): void {
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
    page: { backgroundColor: COLORS.paper, color: COLORS.slate, fontFamily: FONT, fontSize: 9.5, lineHeight: 1.5, paddingTop: 58, paddingBottom: 46, paddingHorizontal: 44 },
    header: { position: 'absolute', top: 22, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingBottom: 6 },
    headerL: { flexDirection: 'row', alignItems: 'center' },
    headerBrand: { fontSize: 10, fontWeight: 'bold', color: COLORS.brand, letterSpacing: 0.5, marginLeft: 6 },
    headerMeta: { fontSize: 7.5, color: COLORS.muted },
    footer: { position: 'absolute', bottom: 22, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 6 },
    footerText: { fontSize: 7.5, color: COLORS.muted },
    // cover
    cover: { backgroundColor: COLORS.ink, color: COLORS.white, padding: 0 },
    coverBar: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 14, backgroundColor: COLORS.brand },
    coverInner: { paddingVertical: 64, paddingHorizontal: 54, height: '100%' },
    brandRow: { flexDirection: 'row', alignItems: 'center' },
    coverBrand: { fontSize: 22, fontWeight: 'bold', color: COLORS.brand, letterSpacing: 1, marginLeft: 10 },
    coverKicker: { fontSize: 12, color: COLORS.coral, fontWeight: 'bold', marginTop: 54, letterSpacing: 2 },
    coverTitle: { fontSize: 29, fontWeight: 'bold', color: COLORS.white, marginTop: 14, lineHeight: 1.25 },
    coverPrepared: { fontSize: 9, color: '#94A3B8', marginTop: 22, marginBottom: 8 },
    chip: { alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.coral, borderRadius: 3, paddingVertical: 3, paddingHorizontal: 8, marginTop: 22 },
    chipText: { fontSize: 9, color: COLORS.coral, fontWeight: 'bold', letterSpacing: 1 },
    coverMetaRow: { flexDirection: 'row', marginTop: 8 },
    coverMetaK: { fontSize: 9, color: '#94A3B8', width: 70 },
    coverMetaV: { fontSize: 9, color: '#E2E8F0' },
    // section
    sectionWrap: { marginTop: 6, marginBottom: 8 },
    sectionNum: { fontSize: 9, fontWeight: 'bold', color: COLORS.brand },
    sectionTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.ink, marginTop: 1 },
    sectionRule: { height: 2, backgroundColor: COLORS.brand, width: 38, marginTop: 5, marginBottom: 8 },
    h3: { fontSize: 11, fontWeight: 'bold', color: COLORS.ink, marginTop: 10, marginBottom: 4 },
    p: { fontSize: 9.5, color: COLORS.slate, marginBottom: 6, textAlign: 'justify', lineHeight: 1.55 },
    caption: { fontSize: 8, fontWeight: 'bold', color: COLORS.ink, marginBottom: 4, textAlign: 'center' },
    // panels / cards
    statRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
    stat: { flex: 1, backgroundColor: COLORS.panel, borderRadius: 6, paddingVertical: 11, paddingHorizontal: 6, alignItems: 'center' },
    statNum: { fontSize: 20, fontWeight: 'bold', color: COLORS.ink, lineHeight: 1.1 },
    statLbl: { fontSize: 7, color: COLORS.muted, marginTop: 5, textAlign: 'center', lineHeight: 1.2 },
    twoCol: { flexDirection: 'row', gap: 14, marginTop: 6 },
    panel: { backgroundColor: COLORS.panel, borderRadius: 6, padding: 10 },
    panelTitle: { fontSize: 9, fontWeight: 'bold', color: COLORS.ink, marginBottom: 4 },
    li: { flexDirection: 'row', marginBottom: 3 },
    liDot: { width: 10, fontSize: 9, color: COLORS.brand },
    liText: { flex: 1, fontSize: 9, color: COLORS.slate, lineHeight: 1.45 },
    kvRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.line, paddingVertical: 3 },
    kvK: { width: 120, fontSize: 8.5, color: COLORS.muted, fontWeight: 'bold' },
    kvV: { flex: 1, fontSize: 8.5, color: COLORS.slate },
    tocRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: COLORS.line },
    tocNum: { fontSize: 9.5, color: COLORS.brand, fontWeight: 'bold', width: 22 },
    tocName: { flex: 1, fontSize: 9.5, color: COLORS.slate },
    // story timeline
    storyStep: { flexDirection: 'row', marginBottom: 9 },
    storyNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.brand, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    storyNumText: { color: COLORS.white, fontSize: 10, fontWeight: 'bold' },
    storyHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 2, flexWrap: 'wrap' },
    storyTitle: { fontSize: 10.5, fontWeight: 'bold', color: COLORS.ink, marginRight: 6 },
    refPill: { backgroundColor: '#DBEAFE', color: COLORS.brand, fontSize: 7, fontWeight: 'bold', borderRadius: 3, paddingVertical: 1, paddingHorizontal: 4, marginRight: 3 },
    storyText: { fontSize: 9, color: COLORS.slate, lineHeight: 1.5, textAlign: 'justify' },
    // findings table
    tHead: { flexDirection: 'row', backgroundColor: COLORS.brand, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    tHeadCell: { color: COLORS.white, fontSize: 8, fontWeight: 'bold', padding: 5 },
    tRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.line },
    tCell: { fontSize: 8, color: COLORS.slate, padding: 5 },
    // finding card
    card: { borderWidth: 1, borderColor: COLORS.line, borderLeftWidth: 4, borderRadius: 5, padding: 10, marginBottom: 10 },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardId: { fontSize: 8, color: COLORS.muted, fontWeight: 'bold' },
    cardTitle: { fontSize: 11.5, fontWeight: 'bold', color: COLORS.ink, marginTop: 1, marginBottom: 4 },
    badge: { borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6 },
    badgeText: { fontSize: 7.5, fontWeight: 'bold', letterSpacing: 0.5 },
    metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 5 },
    metaPill: { backgroundColor: COLORS.panel, borderRadius: 3, paddingVertical: 2, paddingHorizontal: 6, fontSize: 7.5, color: COLORS.slate },
    fieldLbl: { fontSize: 8, fontWeight: 'bold', color: COLORS.brand, marginTop: 6, marginBottom: 2, textTransform: 'uppercase' },
    fieldText: { fontSize: 9, color: COLORS.slate, lineHeight: 1.45 },
    code: { backgroundColor: '#0F172A', color: '#E2E8F0', fontFamily: MONO, fontSize: 8, padding: 8, borderRadius: 4, marginTop: 4, lineHeight: 1.4 },
    codeCap: { fontSize: 7.5, color: COLORS.muted, fontStyle: 'italic', marginTop: 5 },
    // action plan table
    aHead: { flexDirection: 'row', backgroundColor: COLORS.brand, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    aHeadCell: { color: COLORS.white, fontSize: 7.5, fontWeight: 'bold', paddingVertical: 5, paddingHorizontal: 4 },
    aRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.line, alignItems: 'center' },
    aCell: { fontSize: 7.5, color: COLORS.slate, paddingVertical: 5, paddingHorizontal: 4 },
    winChip: { borderRadius: 3, paddingVertical: 2, paddingHorizontal: 4, alignSelf: 'flex-start' },
    winChipText: { color: COLORS.white, fontSize: 6.5, fontWeight: 'bold' },
    legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
    legendDot: { width: 9, height: 9, borderRadius: 2, marginRight: 6 },
    legendText: { fontSize: 8, color: COLORS.slate },
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
            <AppLogo branding={e.branding} size={13} color={COLORS.brand} />
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

const FindingCard = ({ f }: { f: Finding }) => {
    const sv = SEVERITY[f.severity];
    return (
        <View style={[s.card, { borderLeftColor: sv.color }]} wrap={false}>
            <View style={s.cardHead}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={s.cardId}>{f.id}</Text>
                    <Text style={s.cardTitle}>{f.title}</Text>
                </View>
                <Badge severity={f.severity} />
            </View>
            <View style={s.metaGrid}>
                <Text style={s.metaPill}>{`CVSS ${f.cvss.toFixed(1)}`}</Text>
                <Text style={s.metaPill}>{f.cwe}</Text>
                <Text style={s.metaPill}>{f.category}</Text>
                <Text style={s.metaPill}>{`Afetado: ${f.affected.join(', ')}`}</Text>
                <Text style={s.metaPill}>{`Status: ${f.status}`}</Text>
            </View>
            <Text style={s.fieldText}>{f.description}</Text>
            {f.evidence && (
                <View>
                    <Text style={s.codeCap}>{f.evidence.caption}</Text>
                    <Text style={s.code}>{f.evidence.code}</Text>
                </View>
            )}
            <Text style={s.fieldLbl}>Impacto ao negócio</Text>
            <Text style={s.fieldText}>{f.businessImpact}</Text>
            <Text style={s.fieldLbl}>Remediação</Text>
            <Text style={s.fieldText}>{f.remediation}</Text>
            {f.references.length > 0 && <Text style={[s.codeCap, { marginTop: 6 }]}>{`Referências: ${f.references.map((r) => r.label).join(' · ')}`}</Text>}
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

export function EngagementPdfDocument({ engagement: e }: { engagement: Engagement }) {
    const sevData = severityCounts(e.findings);
    const catData = categoryCounts(e.findings);
    const rating = riskRating(e.riskScore);
    const items = actionItems(e.findings);
    const qw = quickWins(e.findings);
    const BRAND = e.branding.primary ? `#${e.branding.primary}` : COLORS.brand;
    const tocItems = ['Sumário Executivo', 'Narrativa do Ataque', 'Visão Geral de Risco', 'Metodologia (PTES)', 'Achados Detalhados', 'Plano de Ação', 'Apêndice'];

    return (
        <Document title={e.title} author={e.branding.appName} creator={e.branding.appName}>
            {/* ── Cover ── */}
            <Page size="A4" style={[s.page, s.cover]}>
                <View style={s.coverBar} />
                <View style={s.coverInner}>
                    <View style={s.brandRow}>
                        <AppLogo branding={e.branding} size={34} color={COLORS.white} />
                        <Text style={[s.coverBrand, { color: BRAND }]}>{e.branding.appName.toUpperCase()}</Text>
                    </View>
                    <Text style={s.coverKicker}>RELATÓRIO DE PENTEST · PTES</Text>
                    <Text style={s.coverTitle}>{e.title}</Text>
                    <Text style={s.coverPrepared}>{`Preparado por ${e.branding.appName} para`}</Text>
                    <ClientLogo branding={e.branding} size={46} />
                    <View style={s.chip}>
                        <Text style={s.chipText}>{e.classification}</Text>
                    </View>
                    <View style={{ position: 'absolute', bottom: 64, left: 54 }}>
                        {[
                            ['Período', fmtDate(e)],
                            ['Versão', e.version],
                            ['Autor', e.author],
                            ['Contato', e.contact],
                            ['Risco geral', `${e.riskScore}/100 (${rating.label})`],
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

            {/* ── 7. Appendix ── */}
            <Page size="A4" style={s.page}>
                <Header e={e} />
                <Footer e={e} />
                <Section n={7} title="Apêndice" />
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
