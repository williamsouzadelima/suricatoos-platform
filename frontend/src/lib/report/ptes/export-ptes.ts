// Public entry point for the premium PTES report. Heavy dependencies (react-pdf, pdf.js,
// docx, pptxgenjs) are lazy-loaded so they never weigh on the main bundle — they only load
// when the user actually exports a report.
import type { FlowQuery } from '@/graphql/types';

import { baseUrl } from '@/models/api';

import type { Branding, Engagement } from './engagement';
import type { FromFlowOptions } from './from-flow';

import { transformFlowToEngagement } from './from-flow';

export type PtesFormat = 'docx' | 'pdf' | 'pptx';

const blobToDataUri = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
    });

// Screenshots are referenced as `screenshot:<flowId>:<id>` placeholders by from-flow. Resolve them
// to embedded data URIs (authenticated fetch from the flow file endpoint) so the renderers can
// inline the real captures. Failures degrade gracefully to a captioned reference box.
async function resolveFigureImages(engagement: Engagement): Promise<void> {
    const figures = engagement.figures ?? [];
    await Promise.all(
        figures.map(async (fig) => {
            if (fig.kind !== 'screenshot' || !fig.imageSrc?.startsWith('screenshot:')) return;
            const [, flowId, screenshotId] = fig.imageSrc.split(':');
            if (!flowId || !screenshotId) {
                fig.imageSrc = undefined;
                return;
            }
            try {
                const res = await fetch(`${baseUrl}/flows/${flowId}/screenshots/${screenshotId}/file`, { credentials: 'include' });
                if (!res.ok) {
                    fig.imageSrc = undefined;
                    return;
                }
                fig.imageSrc = await blobToDataUri(await res.blob());
            } catch {
                fig.imageSrc = undefined; // network/auth failure -> reference box fallback
            }
        }),
    );
}

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
    await resolveFigureImages(engagement);
    return generatePtesBlob(engagement, format);
}
