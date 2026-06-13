// Browser-side chart rasterizer — keeps the DOCX/PPTX charts pixel-identical to the PDF.
//
// The same react-pdf <ChartSheet/> used by the flagship PDF is rendered to a PDF in the
// browser, then each page is rasterized to a PNG via pdf.js. This mirrors the Node pipeline
// (which used poppler's `pdftoppm`) so all three formats share one source of truth.
import { pdf } from '@react-pdf/renderer';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import type { Engagement } from './engagement';
import type { ChartImages } from './report-ptes-docx';

import { registerReportFonts } from './report-book-pdf';
import { CHART_SPECS, ChartSheet } from './report-charts-sheet';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Render every report chart to a PNG data URI, keyed by CHART_SPECS key.
 * `scale` controls the rasterization DPI (72 * scale); 3 ≈ 216 DPI, crisp for print.
 */
export async function rasterizeChartsInBrowser(engagement: Engagement, scale = 3): Promise<ChartImages> {
    registerReportFonts();

    const blob = await pdf(<ChartSheet engagement={engagement} />).toBlob();
    const data = new Uint8Array(await blob.arrayBuffer());
    const loadingTask = pdfjsLib.getDocument({ data });
    const doc = await loadingTask.promise;

    const images: ChartImages = {};
    try {
        const count = Math.min(doc.numPages, CHART_SPECS.length);
        for (let i = 0; i < count; i++) {
            const key = CHART_SPECS[i]!.key;
            const page = await doc.getPage(i + 1);
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('2D canvas context unavailable');
            }
            // Charts assume white paper — paint it before rendering the (transparent) PDF page.
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            await page.render({ canvas, canvasContext: ctx, viewport }).promise;
            images[key] = canvas.toDataURL('image/png');
            page.cleanup();
        }
    } finally {
        await loadingTask.destroy();
    }

    return images;
}
