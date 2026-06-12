import {
    AlignmentType,
    BorderStyle,
    Document,
    HeadingLevel,
    LevelFormat,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
} from 'docx';
import { marked, type Token, type Tokens } from 'marked';

import { downloadBlob } from './report';

// ── Brand ────────────────────────────────────────────────────────────────
const BRAND = '194FE3'; // Suricatoos blue
const CORAL = 'FF7678';
const MUTED = '6B7280';
const CODE_BG = 'F3F4F6';
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

// ── Inline rendering (bold / italic / code / links) ───────────────────────
function inlineRuns(tokens: Token[] | undefined, fallback = ''): TextRun[] {
    if (!tokens || tokens.length === 0) {
        return fallback ? [new TextRun({ text: fallback })] : [];
    }

    const runs: TextRun[] = [];
    const walk = (toks: Token[], opts: { bold?: boolean; italics?: boolean }) => {
        for (const tk of toks) {
            switch (tk.type) {
                case 'codespan':
                    runs.push(
                        new TextRun({ text: (tk as Tokens.Codespan).text, font: 'Courier New', shading: { type: ShadingType.CLEAR, fill: CODE_BG } }),
                    );
                    break;
                case 'em':
                    walk((tk as Tokens.Em).tokens ?? [], { ...opts, italics: true });
                    break;
                case 'link': {
                    const lk = tk as Tokens.Link;
                    runs.push(new TextRun({ text: lk.text || lk.href, color: BRAND, underline: {}, ...opts }));
                    break;
                }
                case 'strong':
                    walk((tk as Tokens.Strong).tokens ?? [], { ...opts, bold: true });
                    break;
                default: {
                    const text = 'text' in tk ? (tk as { text: string }).text : '';
                    if (text) {
                        runs.push(new TextRun({ text, ...opts }));
                    }
                }
            }
        }
    };
    walk(tokens, {});

    return runs.length ? runs : fallback ? [new TextRun({ text: fallback })] : [];
}

// ── Block rendering ────────────────────────────────────────────────────────
function listParagraphs(list: Tokens.List, depth: number): Paragraph[] {
    const out: Paragraph[] = [];
    list.items.forEach((item, idx) => {
        const text = inlineRuns(item.tokens?.find((t) => t.type === 'text')?.tokens, item.text);
        out.push(
            new Paragraph({
                children: text,
                bullet: list.ordered ? undefined : { level: Math.min(depth, 2) },
                numbering: list.ordered ? { reference: 'ordered', level: Math.min(depth, 2) } : undefined,
                spacing: { after: 40 },
            }),
        );
        // nested lists
        item.tokens?.filter((t) => t.type === 'list').forEach((nested) => out.push(...listParagraphs(nested as Tokens.List, depth + 1)));
        // ordered fallback (no numbering ref): prefix the index
        if (list.ordered && out.length) {
            // keep simple — numbering reference handles it; idx unused intentionally
            void idx;
        }
    });

    return out;
}

function tokenToBlocks(token: Token): (Paragraph | Table)[] {
    switch (token.type) {
        case 'blockquote': {
            const bq = token as Tokens.Blockquote;
            return [
                new Paragraph({
                    children: inlineRuns(undefined, bq.text),
                    indent: { left: 360 },
                    border: { left: { style: BorderStyle.SINGLE, size: 18, color: CORAL, space: 12 } },
                    spacing: { after: 120 },
                }),
            ];
        }
        case 'code': {
            const code = token as Tokens.Code;
            return code.text.split('\n').map(
                (line, i, arr) =>
                    new Paragraph({
                        children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 18 })],
                        shading: { type: ShadingType.CLEAR, fill: CODE_BG },
                        spacing: { after: i === arr.length - 1 ? 120 : 0, before: i === 0 ? 60 : 0 },
                    }),
            );
        }
        case 'heading': {
            const h = token as Tokens.Heading;
            return [
                new Paragraph({
                    children: inlineRuns(h.tokens, h.text),
                    heading: HEADINGS[Math.min(h.depth - 1, 5)],
                    spacing: { after: 120, before: 200 },
                }),
            ];
        }
        case 'hr':
            return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D1D5DB', space: 1 } }, spacing: { after: 160 } })];
        case 'list':
            return listParagraphs(token as Tokens.List, 0);
        case 'paragraph': {
            const p = token as Tokens.Paragraph;
            return [new Paragraph({ children: inlineRuns(p.tokens, p.text), spacing: { after: 120 } })];
        }
        case 'space':
            return [];
        case 'table': {
            const tb = token as Tokens.Table;
            const header = new TableRow({
                tableHeader: true,
                children: tb.header.map(
                    (c) =>
                        new TableCell({
                            shading: { type: ShadingType.CLEAR, fill: BRAND },
                            children: [new Paragraph({ children: [new TextRun({ text: c.text, bold: true, color: 'FFFFFF' })] })],
                        }),
                ),
            });
            const rows = tb.rows.map(
                (r) =>
                    new TableRow({
                        children: r.map((c) => new TableCell({ children: [new Paragraph({ children: inlineRuns(c.tokens, c.text) })] })),
                    }),
            );
            return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] })];
        }
        default: {
            const text = 'text' in token ? (token as { text: string }).text : '';
            return text ? [new Paragraph({ children: [new TextRun({ text })], spacing: { after: 120 } })] : [];
        }
    }
}

export interface DocxMeta {
    title: string;
    subtitle?: string;
}

export async function generateDOCXFromMarkdownNew(markdown: string, fileName: string, meta: DocxMeta): Promise<void> {
    const tokens = marked.lexer(markdown);
    const body: (Paragraph | Table)[] = [];

    // Cover block
    body.push(
        new Paragraph({ children: [new TextRun({ text: 'SURICATOOS', bold: true, color: BRAND, size: 28 })], alignment: AlignmentType.CENTER, spacing: { after: 80, before: 400 } }),
        new Paragraph({ children: [new TextRun({ text: meta.subtitle ?? 'Relatório', color: MUTED, size: 22 })], alignment: AlignmentType.CENTER, spacing: { after: 40 } }),
        new Paragraph({ children: [new TextRun({ text: meta.title, bold: true, size: 40 })], alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
        new Paragraph({ children: [new TextRun({ text: new Date().toLocaleString(), color: MUTED, size: 18 })], alignment: AlignmentType.CENTER, spacing: { after: 320 } }),
        new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D1D5DB', space: 1 } }, spacing: { after: 240 } }),
    );

    for (const token of tokens) {
        body.push(...tokenToBlocks(token));
    }

    const doc = new Document({
        creator: 'Suricatoos',
        title: meta.title,
        numbering: {
            config: [
                {
                    reference: 'ordered',
                    levels: [0, 1, 2].map((lvl) => ({ level: lvl, format: LevelFormat.DECIMAL, text: `%${lvl + 1}.`, alignment: AlignmentType.START })),
                },
            ],
        },
        sections: [{ children: body.length ? body : [new Paragraph({ children: [new TextRun({ text: 'Sem conteúdo.' })] })] }],
    });

    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, `${fileName}.docx`);
}
