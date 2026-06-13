// Public entry point for the premium PTES report. Heavy dependencies (react-pdf, pdf.js,
// docx, pptxgenjs) are lazy-loaded so they never weigh on the main bundle — they only load
// when the user actually exports a report.
import type { FlowQuery } from '@/graphql/types';

import type { Branding, Engagement } from './engagement';
import type { FromFlowOptions } from './from-flow';

import { transformFlowToEngagement } from './from-flow';

export type PtesFormat = 'docx' | 'pdf' | 'pptx';

async function rasterizeCharts(engagement: Engagement) {
    const { rasterizeChartsInBrowser } = await import('./rasterize-charts.browser');
    return rasterizeChartsInBrowser(engagement);
}

/** Render a complete PTES report to a downloadable Blob in the requested format. */
export async function generatePtesBlob(engagement: Engagement, format: PtesFormat): Promise<Blob> {
    if (format === 'pdf') {
        const { generatePtesPdfBlob } = await import('./report-book-pdf');
        return generatePtesPdfBlob(engagement);
    }

    if (format === 'docx') {
        const [{ buildPtesDocx }, { Packer }] = await Promise.all([import('./report-ptes-docx'), import('docx')]);
        const images = await rasterizeCharts(engagement);
        return Packer.toBlob(buildPtesDocx(engagement, images));
    }

    // pptx — pptxgenjs returns the requested output type; 'blob' yields a browser Blob.
    const { buildPtesPptx } = await import('./report-ptes-pptx');
    const images = await rasterizeCharts(engagement);
    const pptx = buildPtesPptx(engagement, images);
    return (await pptx.write({ outputType: 'blob' })) as Blob;
}

/** Build the Engagement from a real flow (the full FlowQuery payload) and export it. */
export async function generatePtesReportFromFlow(
    data: FlowQuery,
    branding: Branding,
    format: PtesFormat,
    options?: FromFlowOptions,
): Promise<Blob> {
    const engagement = transformFlowToEngagement(data, branding, options);
    return generatePtesBlob(engagement, format);
}
