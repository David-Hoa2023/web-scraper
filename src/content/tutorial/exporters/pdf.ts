/**
 * PDF Exporter
 * Exports tutorials to PDF format using jsPDF
 */

import type {
  GeneratedTutorial,
  ExportConfig,
  ExportResult,
  TutorialStep,
} from '../../../types/tutorial';

import { EXPORT_MIME_TYPES } from '../../../types/tutorial';
import { jsPDF } from 'jspdf';

/**
 * Export a tutorial to PDF format
 */
export async function exportToPdf(
  tutorial: GeneratedTutorial,
  config: ExportConfig
): Promise<ExportResult> {
  const blob = await generatePdf(tutorial, config);
  const filename = generateFilename(tutorial.title, 'pdf');

  return {
    format: 'pdf',
    content: blob,
    mimeType: EXPORT_MIME_TYPES.pdf,
    filename,
    size: blob.size,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Generate PDF document from tutorial
 */
export async function generatePdf(
  tutorial: GeneratedTutorial,
  config: ExportConfig
): Promise<Blob> {

  const pdfConfig = DEFAULT_PDF_CONFIG;
  const pageSize = config.pdfPageSize || pdfConfig.pageSize;
  const dimensions = getPageDimensions(pageSize);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: pageSize,
  });

  const margin = pdfConfig.margin;
  const contentWidth = dimensions.width - margin.left - margin.right;
  let y = margin.top;

  // Title
  pdf.setFontSize(pdfConfig.fontSize.title);
  pdf.setFont('helvetica', 'bold');
  const titleLines = pdf.splitTextToSize(tutorial.title, contentWidth);
  pdf.text(titleLines, margin.left, y);
  y += titleLines.length * pdfConfig.fontSize.title * 0.4 + 5;

  // Description
  if (tutorial.description) {
    pdf.setFontSize(pdfConfig.fontSize.body);
    pdf.setFont('helvetica', 'normal');
    const descLines = pdf.splitTextToSize(tutorial.description, contentWidth);
    pdf.text(descLines, margin.left, y);
    y += descLines.length * pdfConfig.fontSize.body * 0.4 + 3;
  }

  // Metadata
  pdf.setFontSize(pdfConfig.fontSize.caption);
  pdf.setTextColor(100, 100, 100);
  const metadata: string[] = [];
  if (tutorial.estimatedTime) {
    metadata.push(`Estimated time: ${tutorial.estimatedTime} min`);
  }
  if (tutorial.difficulty) {
    metadata.push(`Difficulty: ${capitalize(tutorial.difficulty)}`);
  }
  if (metadata.length > 0) {
    pdf.text(metadata.join('  |  '), margin.left, y);
    y += 8;
  }
  pdf.setTextColor(0, 0, 0);

  // Horizontal line
  pdf.setDrawColor(200, 200, 200);
  pdf.line(margin.left, y, dimensions.width - margin.right, y);
  y += 8;

  // Steps
  for (const step of tutorial.steps) {
    // Check if we need a new page
    const estimatedHeight = estimateStepHeight(step, contentWidth, pdfConfig, config);
    if (y + estimatedHeight > dimensions.height - margin.bottom) {
      pdf.addPage();
      y = margin.top;
    }

    y = renderStep(pdf, step, y, margin.left, contentWidth, pdfConfig, config);
    y += 5;
  }

  // Footer on last page
  y = Math.max(y, dimensions.height - margin.bottom - 15);
  pdf.setFontSize(pdfConfig.fontSize.caption);
  pdf.setTextColor(150, 150, 150);
  pdf.text(`Generated on ${formatDate(tutorial.generatedAt)}`, margin.left, y);
  y += 4;
  if (tutorial.llmModel) {
    pdf.text(`Powered by ${tutorial.llmModel}`, margin.left, y);
  }

  return pdf.output('blob');
}

/**
 * Render a single step to PDF
 */
function renderStep(
  pdf: InstanceType<typeof import('jspdf').jsPDF>,
  step: TutorialStep,
  y: number,
  x: number,
  maxWidth: number,
  pdfConfig: PdfPageConfig,
  config: ExportConfig
): number {
  // Step number and action
  pdf.setFontSize(pdfConfig.fontSize.heading);
  pdf.setFont('helvetica', 'bold');

  const stepHeader = config.includeStepNumbers
    ? `Step ${step.stepNumber}: ${step.action}`
    : step.action;
  const headerLines = pdf.splitTextToSize(stepHeader, maxWidth);
  pdf.text(headerLines, x, y);
  y += headerLines.length * pdfConfig.fontSize.heading * 0.4 + 3;

  // Target element
  if (step.target) {
    pdf.setFontSize(pdfConfig.fontSize.body);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(80, 80, 80);
    const targetText = `Target: ${step.target}`;
    const targetLines = pdf.splitTextToSize(targetText, maxWidth);
    pdf.text(targetLines, x, y);
    y += targetLines.length * pdfConfig.fontSize.body * 0.4 + 2;
    pdf.setTextColor(0, 0, 0);
  }

  // Input value
  if (step.inputValue) {
    pdf.setFontSize(pdfConfig.fontSize.body);
    pdf.setFont('helvetica', 'italic');
    const inputText = `Enter: "${step.inputValue}"`;
    const inputLines = pdf.splitTextToSize(inputText, maxWidth);
    pdf.text(inputLines, x, y);
    y += inputLines.length * pdfConfig.fontSize.body * 0.4 + 2;
    pdf.setFont('helvetica', 'normal');
  }

  // Details
  if (step.details) {
    pdf.setFontSize(pdfConfig.fontSize.body);
    pdf.setFont('helvetica', 'normal');
    const detailLines = pdf.splitTextToSize(step.details, maxWidth);
    pdf.text(detailLines, x, y);
    y += detailLines.length * pdfConfig.fontSize.body * 0.4 + 2;
  }

  // Note
  if (step.note) {
    pdf.setFontSize(pdfConfig.fontSize.caption);
    pdf.setTextColor(100, 100, 100);
    const noteText = `Note: ${step.note}`;
    const noteLines = pdf.splitTextToSize(noteText, maxWidth - 5);
    pdf.text(noteLines, x + 5, y);
    y += noteLines.length * pdfConfig.fontSize.caption * 0.4 + 2;
    pdf.setTextColor(0, 0, 0);
  }

  // Timestamp
  if (config.includeTimestamps && step.timestamp) {
    pdf.setFontSize(pdfConfig.fontSize.caption);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Timestamp: ${formatTimestamp(step.timestamp)}`, x, y);
    y += pdfConfig.fontSize.caption * 0.4 + 2;
    pdf.setTextColor(0, 0, 0);
  }

  // Screenshot placeholder (actual image handling would require more work)
  if (config.includeScreenshots && step.screenshot) {
    pdf.setFontSize(pdfConfig.fontSize.caption);
    pdf.setTextColor(100, 100, 100);
    pdf.text('[Screenshot available in web export]', x, y);
    y += pdfConfig.fontSize.caption * 0.4 + 2;
    pdf.setTextColor(0, 0, 0);
  }

  return y;
}

/**
 * Estimate height needed for a step
 */
function estimateStepHeight(
  step: TutorialStep,
  maxWidth: number,
  pdfConfig: PdfPageConfig,
  config: ExportConfig
): number {
  let height = 15; // Base height for step header

  // Add height for each optional field
  if (step.target) height += 8;
  if (step.inputValue) height += 8;
  if (step.details) {
    height += calculateTextHeight(step.details, maxWidth, pdfConfig.fontSize.body, pdfConfig.lineHeight);
  }
  if (step.note) height += 10;
  if (config.includeTimestamps && step.timestamp) height += 6;
  if (config.includeScreenshots && step.screenshot) height += 8;

  return height;
}

/**
 * Generate filename from title
 */
function generateFilename(title: string, extension: string): string {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  return `${sanitized || 'tutorial'}.${extension}`;
}

/**
 * Format a timestamp in milliseconds to mm:ss format
 */
function formatTimestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format ISO date string to readable format
 */
function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * PDF page configuration
 */
export interface PdfPageConfig {
  pageSize: 'a4' | 'letter' | 'legal';
  margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  fontSize: {
    title: number;
    heading: number;
    body: number;
    caption: number;
  };
  lineHeight: number;
}

export const DEFAULT_PDF_CONFIG: PdfPageConfig = {
  pageSize: 'a4',
  margin: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },
  fontSize: {
    title: 24,
    heading: 14,
    body: 11,
    caption: 9,
  },
  lineHeight: 1.5,
};

/**
 * Get page dimensions for a given page size (in mm)
 */
export function getPageDimensions(
  pageSize: PdfPageConfig['pageSize']
): { width: number; height: number } {
  const dimensions: Record<string, { width: number; height: number }> = {
    a4: { width: 210, height: 297 },
    letter: { width: 215.9, height: 279.4 },
    legal: { width: 215.9, height: 355.6 },
  };
  return dimensions[pageSize] || dimensions.a4;
}

/**
 * Calculate text height for wrapping
 */
export function calculateTextHeight(
  text: string,
  maxWidth: number,
  fontSize: number,
  lineHeight: number
): number {
  // Rough estimate: characters per line based on average character width
  const charsPerLine = Math.floor(maxWidth / (fontSize * 0.4));
  const lines = Math.ceil(text.length / charsPerLine);
  return lines * fontSize * lineHeight * 0.4;
}

/**
 * Add image to PDF with proper scaling
 */
export async function addImageToPdf(
  pdf: InstanceType<typeof import('jspdf').jsPDF>,
  dataUrl: string,
  x: number,
  y: number,
  maxWidth: number,
  maxHeight: number
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate scaled dimensions
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = height * ratio;
      }

      if (height > maxHeight) {
        const ratio = maxHeight / height;
        height = maxHeight;
        width = width * ratio;
      }

      // Convert to mm (assuming 96 DPI)
      const mmWidth = width * 0.264583;
      const mmHeight = height * 0.264583;

      try {
        pdf.addImage(dataUrl, 'PNG', x, y, mmWidth, mmHeight);
        resolve({ width: mmWidth, height: mmHeight });
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
