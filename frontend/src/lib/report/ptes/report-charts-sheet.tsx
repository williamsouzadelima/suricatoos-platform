// Renders every report chart onto its own PDF page, so the exact same vector charts used in the
// PDF can be rasterized to PNG and embedded into the DOCX/PPTX — keeping all formats consistent.
import { Document, Page } from '@react-pdf/renderer';

import { AttackChainStrip, DonutChart, EffortTimeBars, HBarChart, PhaseStepper, QuickWinsQuadrant, RemediationRoadmap, RiskGauge, RiskMatrix } from './charts';
import { PTES_PHASES, type Engagement } from './engagement';
import { actionItems, categoryCounts, severityCounts } from './theme';

// key + point size of each chart page (order defines the rasterized page order)
export const CHART_SPECS: { key: string; w: number; h: number }[] = [
    { key: 'gauge', w: 232, h: 172 },
    { key: 'donut', w: 160, h: 160 },
    { key: 'matrix', w: 250, h: 250 },
    { key: 'categories', w: 250, h: 122 },
    { key: 'attackChain', w: 520, h: 54 },
    { key: 'quadrant', w: 240, h: 240 },
    { key: 'roadmap', w: 520, h: 56 },
    { key: 'timeBars', w: 260, h: 164 },
    { key: 'phaseStepper', w: 510, h: 32 },
];

export function ChartSheet({ engagement: e }: { engagement: Engagement }) {
    const items = actionItems(e.findings);
    const sev = severityCounts(e.findings);
    const cat = categoryCounts(e.findings);
    const page = (key: string, child: React.ReactNode) => {
        const spec = CHART_SPECS.find((c) => c.key === key)!;
        return (
            <Page key={key} size={[spec.w, spec.h]} style={{ padding: 0, backgroundColor: '#FFFFFF' }}>
                {child}
            </Page>
        );
    };
    return (
        <Document>
            {page('gauge', <RiskGauge score={e.riskScore} size={232} />)}
            {page('donut', <DonutChart data={sev} size={160} />)}
            {page('matrix', <RiskMatrix findings={e.findings} size={250} />)}
            {page('categories', <HBarChart data={cat} width={250} />)}
            {page('attackChain', <AttackChainStrip nodes={e.attackStory.map((st) => ({ n: st.n, label: st.title.split(' ')[0] }))} width={520} />)}
            {page('quadrant', <QuickWinsQuadrant items={items} size={240} />)}
            {page('roadmap', <RemediationRoadmap items={items} width={520} />)}
            {page('timeBars', <EffortTimeBars items={items} width={260} />)}
            {page('phaseStepper', <PhaseStepper phases={PTES_PHASES.map((p) => ({ n: p.n, name: p.short }))} width={510} />)}
        </Document>
    );
}
