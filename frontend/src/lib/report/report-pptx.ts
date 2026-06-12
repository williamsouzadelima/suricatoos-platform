import { marked, type Token, type Tokens } from 'marked';
import pptxgen from 'pptxgenjs';

import type { FlowFragmentFragment, TaskFragmentFragment } from '@/graphql/types';

import { summarizeTaskStatuses } from './report';

// ── Brand ──────────────────────────────────────────────────────────────────
const BLUE = '194FE3';
const CORAL = 'FF7678';
const INK = '1B2433';
const MUTED = '6B7280';
const PANEL = 'F4F6FB';

const MAX_BULLETS_PER_SLIDE = 11;

function tokenText(token: Token): string {
    if ('tokens' in token && Array.isArray((token as { tokens?: Token[] }).tokens)) {
        return ((token as { tokens: Token[] }).tokens).map(tokenText).join('');
    }

    return 'text' in token ? (token as { text: string }).text : '';
}

function applyMaster(pptx: pptxgen): void {
    pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
    pptx.layout = 'WIDE';
    pptx.defineSlideMaster({
        title: 'SURI',
        background: { color: 'FFFFFF' },
        objects: [
            { rect: { x: 0, y: 7.18, w: '100%', h: 0.32, fill: { color: PANEL } } },
            { text: { text: 'Suricatoos', options: { x: 0.4, y: 7.16, w: 4, h: 0.32, fontSize: 9, color: MUTED, bold: true } } },
            { rect: { x: 0, y: 0, w: 0.18, h: '100%', fill: { color: BLUE } } },
        ],
    });
}

function coverSlide(pptx: pptxgen, kicker: string, title: string): void {
    const s = pptx.addSlide({ masterName: 'SURI' });
    s.background = { color: INK };
    s.addText('SURICATOOS', { x: 0.8, y: 2.0, w: 11.5, h: 0.6, fontSize: 22, bold: true, color: BLUE });
    s.addText(kicker, { x: 0.8, y: 2.7, w: 11.5, h: 0.5, fontSize: 16, color: CORAL, bold: true });
    s.addText(title, { x: 0.8, y: 3.2, w: 11.5, h: 1.6, fontSize: 34, bold: true, color: 'FFFFFF' });
    s.addText(new Date().toLocaleString(), { x: 0.8, y: 5.0, w: 11.5, h: 0.4, fontSize: 12, color: 'B8C0CC' });
}

function sectionSlide(pptx: pptxgen, title: string, bullets: { text: string; options?: object }[]): void {
    const s = pptx.addSlide({ masterName: 'SURI' });
    s.addText(title || 'Seção', { x: 0.5, y: 0.35, w: 12.3, h: 0.7, fontSize: 22, bold: true, color: INK });
    s.addShape(pptx.ShapeType.line, { x: 0.5, y: 1.05, w: 12.3, h: 0, line: { color: BLUE, width: 2 } });
    if (bullets.length) {
        s.addText(
            bullets.map((b) => ({ text: b.text, options: { bullet: { code: '2022' }, fontSize: 13, color: INK, paraSpaceAfter: 6, ...b.options } })),
            { x: 0.6, y: 1.3, w: 12.1, h: 5.7, valign: 'top' },
        );
    }
}

/** Technical deck: turn the markdown report into a slide per section. */
export async function generateTechnicalPPTXNew(markdown: string, fileName: string, meta: { title: string }): Promise<void> {
    const pptx = new pptxgen();
    pptx.author = 'Suricatoos';
    pptx.company = 'Suricatoos';
    applyMaster(pptx);
    coverSlide(pptx, 'Relatório Técnico', meta.title);

    const tokens = marked.lexer(markdown);
    let title = 'Visão geral';
    let bullets: { text: string; options?: object }[] = [];

    const flush = () => {
        if (bullets.length) {
            // paginate long sections
            for (let i = 0; i < bullets.length; i += MAX_BULLETS_PER_SLIDE) {
                const chunk = bullets.slice(i, i + MAX_BULLETS_PER_SLIDE);
                sectionSlide(pptx, i === 0 ? title : `${title} (cont.)`, chunk);
            }
        } else {
            sectionSlide(pptx, title, []);
        }
        bullets = [];
    };

    let first = true;
    for (const token of tokens) {
        if (token.type === 'heading') {
            const h = token as Tokens.Heading;
            if (!first) {
                flush();
            }
            first = false;
            title = h.text;
        } else if (token.type === 'paragraph') {
            const text = tokenText(token).trim();
            if (text) {
                bullets.push({ text });
            }
        } else if (token.type === 'list') {
            for (const item of (token as Tokens.List).items) {
                bullets.push({ text: item.text.trim(), options: { indentLevel: 1 } });
            }
        } else if (token.type === 'code') {
            for (const line of (token as Tokens.Code).text.split('\n')) {
                bullets.push({ text: line || ' ', options: { fontFace: 'Courier New', fontSize: 11, color: '334155', bullet: false } });
            }
        }
    }
    if (!first) {
        flush();
    }

    await pptx.writeFile({ fileName: `${fileName}.pptx` });
}

/** Executive deck: cover, summary with a status chart, task overview, next steps. */
export async function generateExecutivePPTXNew(
    tasks: TaskFragmentFragment[],
    flow: FlowFragmentFragment | null | undefined,
    fileName: string,
): Promise<void> {
    const pptx = new pptxgen();
    pptx.author = 'Suricatoos';
    applyMaster(pptx);

    const title = flow ? `${flow.id}. ${flow.title}` : 'Engajamento';
    const { failed, finished, ongoing, total } = summarizeTaskStatuses(tasks ?? []);

    coverSlide(pptx, 'Relatório Executivo', title);

    // Summary + chart
    const s2 = pptx.addSlide({ masterName: 'SURI' });
    s2.addText('Resumo do engajamento', { x: 0.5, y: 0.35, w: 12.3, h: 0.7, fontSize: 22, bold: true, color: INK });
    s2.addShape(pptx.ShapeType.line, { x: 0.5, y: 1.05, w: 12.3, h: 0, line: { color: BLUE, width: 2 } });
    s2.addText(
        [
            { text: `Status do engajamento: `, options: { bold: true } },
            { text: `${flow?.status ?? '—'}\n`, options: {} },
            { text: `${total} tarefa(s) executada(s) pela Suricatoos.`, options: {} },
        ],
        { x: 0.6, y: 1.4, w: 6.0, h: 1.5, fontSize: 15, color: INK, valign: 'top' },
    );
    s2.addChart(
        pptx.ChartType.doughnut,
        [{ name: 'Status', labels: ['Concluídas', 'Falhas', 'Em andamento'], values: [finished, failed, ongoing] }],
        { x: 7.0, y: 1.3, w: 5.6, h: 5.2, holeSize: 60, showLegend: true, legendPos: 'b', showValue: true, chartColors: [BLUE, CORAL, 'F59E0B'], dataLabelColor: 'FFFFFF', dataLabelFontSize: 12 },
    );
    s2.addText(
        [
            { text: `${finished}`, options: { fontSize: 30, bold: true, color: BLUE } },
            { text: '  concluídas      ', options: { fontSize: 13, color: MUTED } },
            { text: `${failed}`, options: { fontSize: 30, bold: true, color: CORAL } },
            { text: '  falhas      ', options: { fontSize: 13, color: MUTED } },
            { text: `${ongoing}`, options: { fontSize: 30, bold: true, color: 'F59E0B' } },
            { text: '  em andamento', options: { fontSize: 13, color: MUTED } },
        ],
        { x: 0.6, y: 3.4, w: 6.0, h: 1.2, valign: 'top' },
    );

    // Task overview table (paginated)
    const sorted = [...(tasks ?? [])].sort((a, b) => +a.id - +b.id);
    const headerRow = [
        { text: '#', options: { bold: true, color: 'FFFFFF', fill: { color: BLUE } } },
        { text: 'Tarefa', options: { bold: true, color: 'FFFFFF', fill: { color: BLUE } } },
        { text: 'Status', options: { bold: true, color: 'FFFFFF', fill: { color: BLUE } } },
    ];
    const rowsPerSlide = 12;
    for (let i = 0; i < Math.max(sorted.length, 1); i += rowsPerSlide) {
        const s = pptx.addSlide({ masterName: 'SURI' });
        s.addText(i === 0 ? 'Visão geral das tarefas' : 'Visão geral das tarefas (cont.)', { x: 0.5, y: 0.35, w: 12.3, h: 0.7, fontSize: 22, bold: true, color: INK });
        s.addShape(pptx.ShapeType.line, { x: 0.5, y: 1.05, w: 12.3, h: 0, line: { color: BLUE, width: 2 } });
        const rows = sorted.slice(i, i + rowsPerSlide).map((t) => [
            { text: String(t.id), options: {} },
            { text: t.title, options: {} },
            { text: String(t.status), options: {} },
        ]);
        s.addTable([headerRow, ...(rows.length ? rows : [[{ text: '—' }, { text: 'Sem tarefas' }, { text: '—' }]])], {
            x: 0.6, y: 1.3, w: 12.1, colW: [1.0, 9.0, 2.1], fontSize: 12, color: INK, border: { type: 'solid', color: 'E5E7EB', pt: 1 }, valign: 'middle', rowH: 0.4,
        });
    }

    // Next steps
    const sN = pptx.addSlide({ masterName: 'SURI' });
    sN.addText('Próximos passos', { x: 0.5, y: 0.35, w: 12.3, h: 0.7, fontSize: 22, bold: true, color: INK });
    sN.addShape(pptx.ShapeType.line, { x: 0.5, y: 1.05, w: 12.3, h: 0, line: { color: BLUE, width: 2 } });
    sN.addText(
        [
            'Revisar os achados de maior risco e validar o impacto.',
            'Priorizar a remediação conforme criticidade de negócio.',
            'Reexecutar o engajamento para confirmar as correções.',
            'Consultar o relatório técnico para evidências e PoCs detalhadas.',
        ].map((t) => ({ text: t, options: { bullet: { code: '2022' }, fontSize: 15, color: INK, paraSpaceAfter: 10 } })),
        { x: 0.6, y: 1.4, w: 12.1, h: 5.0, valign: 'top' },
    );

    await pptx.writeFile({ fileName: `${fileName}.pptx` });
}
