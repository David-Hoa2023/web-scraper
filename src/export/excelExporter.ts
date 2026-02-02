/**
 * Excel Exporter Module
 * Converts scraped data to Excel format with styling, charts, and analysis
 */

import ExcelJS from 'exceljs';
import type { ExtractedItem } from '../types';
import { analyzeData, type DataAnalysis } from './dataAnalysis';

// --- Types ---

export interface ExcelExportOptions {
  filename?: string;
  includeAnalysis?: boolean;
  includeCharts?: boolean;
  sheetName?: string;
  headerStyle?: Partial<ExcelJS.Style>;
  dateFormat?: string;
}

export interface ExcelExportResult {
  blob: Blob;
  filename: string;
  rowCount: number;
  columnCount: number;
}

// --- Default Styles ---

const DEFAULT_HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' },
  },
  alignment: { horizontal: 'center', vertical: 'middle' },
  border: {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  },
};

const DATA_CELL_STYLE: Partial<ExcelJS.Style> = {
  border: {
    top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
  },
};

const ALTERNATE_ROW_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF2F2F2' },
};

// --- Helper Functions ---

/**
 * Flatten nested ExtractedItem to a flat object
 */
function flattenItem(
  item: ExtractedItem,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(item)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value === undefined || value === null) {
      result[fullKey] = '';
    } else if (typeof value === 'string') {
      result[fullKey] = value;
    } else if (Array.isArray(value)) {
      // Handle array of nested items
      result[fullKey] = value.map((v) =>
        typeof v === 'string' ? v : JSON.stringify(v)
      ).join('; ');
    } else if (typeof value === 'object') {
      // Recursively flatten nested objects
      const nested = flattenItem(value as ExtractedItem, fullKey);
      Object.assign(result, nested);
    }
  }

  return result;
}

/**
 * Extract all unique headers from items
 */
function extractHeaders(items: ExtractedItem[]): string[] {
  const headerSet = new Set<string>();

  for (const item of items) {
    const flattened = flattenItem(item);
    for (const key of Object.keys(flattened)) {
      headerSet.add(key);
    }
  }

  return Array.from(headerSet).sort();
}

/**
 * Auto-fit column widths based on content
 */
function autoFitColumns(worksheet: ExcelJS.Worksheet): void {
  worksheet.columns.forEach((column) => {
    let maxLength = 10; // Minimum width

    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const cellValue = cell.value?.toString() || '';
      maxLength = Math.max(maxLength, Math.min(cellValue.length + 2, 50));
    });

    column.width = maxLength;
  });
}

/**
 * Detect if a value looks like a number
 */
function isNumericString(value: string): boolean {
  if (!value || value.trim() === '') return false;
  // Remove currency symbols and commas
  const cleaned = value.replace(/[$€£¥,\s]/g, '');
  return !isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned));
}

/**
 * Parse numeric value from string
 */
function parseNumericValue(value: string): number {
  const cleaned = value.replace(/[$€£¥,\s]/g, '');
  return parseFloat(cleaned);
}

// --- Main Export Function ---

/**
 * Export extracted items to Excel format
 */
export async function exportToExcel(
  items: ExtractedItem[],
  options: ExcelExportOptions = {}
): Promise<ExcelExportResult> {
  const {
    filename = `scrape-export-${Date.now()}.xlsx`,
    includeAnalysis = true,
    // includeCharts reserved for future chart embedding support
    sheetName = 'Scraped Data',
    headerStyle = DEFAULT_HEADER_STYLE,
  } = options;

  if (items.length === 0) {
    throw new Error('No items to export');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Web Scraper Pro';
  workbook.created = new Date();

  // --- Data Sheet ---
  const dataSheet = workbook.addWorksheet(sheetName);
  const headers = extractHeaders(items);
  const flattenedItems = items.map(item => flattenItem(item));

  // Add header row
  const headerRow = dataSheet.addRow(headers);
  headerRow.eachCell((cell) => {
    // Apply header style properties individually to avoid Object.assign issues
    if (headerStyle.font) cell.font = headerStyle.font;
    if (headerStyle.fill) cell.fill = headerStyle.fill as ExcelJS.Fill;
    if (headerStyle.alignment) cell.alignment = headerStyle.alignment;
    if (headerStyle.border) cell.border = headerStyle.border;
  });
  headerRow.height = 25;

  // Add data rows
  flattenedItems.forEach((item, index) => {
    const rowData = headers.map(header => item[header] || '');
    const row = dataSheet.addRow(rowData);

    // Apply alternating row colors
    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = ALTERNATE_ROW_FILL;
      });
    }

    // Apply data cell style
    row.eachCell((cell) => {
      // Set border directly (cell.border may be undefined initially)
      if (DATA_CELL_STYLE.border) {
        cell.border = DATA_CELL_STYLE.border;
      }

      // Auto-format numbers
      const value = cell.value?.toString() || '';
      if (isNumericString(value)) {
        cell.value = parseNumericValue(value);
        cell.numFmt = '#,##0.00';
      }
    });
  });

  // Auto-fit columns
  autoFitColumns(dataSheet);

  // Freeze header row
  dataSheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Add auto-filter
  dataSheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: items.length + 1, column: headers.length },
  };

  // --- Analysis Sheet ---
  if (includeAnalysis) {
    const analysis = analyzeData(items);
    addAnalysisSheet(workbook, analysis, headers);
  }

  // --- Generate Output ---
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  return {
    blob,
    filename,
    rowCount: items.length,
    columnCount: headers.length,
  };
}

/**
 * Add analysis sheet with summary statistics
 */
function addAnalysisSheet(
  workbook: ExcelJS.Workbook,
  analysis: DataAnalysis,
  _headers: string[] // Reserved for future column-specific analysis
): void {
  const sheet = workbook.addWorksheet('Analysis');

  // Title
  sheet.mergeCells('A1:D1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Data Analysis Summary';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF4472C4' } };
  titleCell.alignment = { horizontal: 'center' };

  // General Stats
  let currentRow = 3;
  sheet.getCell(`A${currentRow}`).value = 'General Statistics';
  sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
  currentRow++;

  const generalStats = [
    ['Total Records', analysis.totalRecords],
    ['Total Fields', analysis.totalFields],
    ['Completeness Rate', `${(analysis.completenessRate * 100).toFixed(1)}%`],
    ['Export Date', new Date().toLocaleString()],
  ];

  generalStats.forEach(([label, value]) => {
    sheet.getCell(`A${currentRow}`).value = label;
    sheet.getCell(`B${currentRow}`).value = value;
    currentRow++;
  });

  // Field Statistics
  currentRow += 2;
  sheet.getCell(`A${currentRow}`).value = 'Field Statistics';
  sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
  currentRow++;

  // Field stats header
  const fieldHeaders = ['Field', 'Fill Rate', 'Unique Values', 'Type'];
  fieldHeaders.forEach((header, index) => {
    const cell = sheet.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };
  });
  currentRow++;

  // Field stats data
  for (const [field, stats] of Object.entries(analysis.fieldStats)) {
    sheet.getCell(currentRow, 1).value = field;
    sheet.getCell(currentRow, 2).value = `${(stats.fillRate * 100).toFixed(1)}%`;
    sheet.getCell(currentRow, 3).value = stats.uniqueCount;
    sheet.getCell(currentRow, 4).value = stats.type;
    currentRow++;
  }

  // Numeric Field Analysis
  if (Object.keys(analysis.numericStats).length > 0) {
    currentRow += 2;
    sheet.getCell(`A${currentRow}`).value = 'Numeric Field Analysis';
    sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };
    currentRow++;

    const numHeaders = ['Field', 'Min', 'Max', 'Mean', 'Median', 'Std Dev'];
    numHeaders.forEach((header, index) => {
      const cell = sheet.getCell(currentRow, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };
    });
    currentRow++;

    for (const [field, stats] of Object.entries(analysis.numericStats)) {
      sheet.getCell(currentRow, 1).value = field;
      sheet.getCell(currentRow, 2).value = stats.min;
      sheet.getCell(currentRow, 3).value = stats.max;
      sheet.getCell(currentRow, 4).value = Number(stats.mean.toFixed(2));
      sheet.getCell(currentRow, 5).value = Number(stats.median.toFixed(2));
      sheet.getCell(currentRow, 6).value = Number(stats.stdDev.toFixed(2));
      currentRow++;
    }
  }

  // Auto-fit columns
  autoFitColumns(sheet);
}

/**
 * Export to Excel and trigger download via Chrome API
 */
export async function exportAndDownload(
  items: ExtractedItem[],
  options: ExcelExportOptions = {}
): Promise<void> {
  const result = await exportToExcel(items, options);

  // Convert blob to base64 for chrome.downloads API
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve) => {
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
  });
  reader.readAsDataURL(result.blob);
  const base64 = await base64Promise;

  // Trigger download via chrome.downloads API
  await chrome.downloads.download({
    url: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`,
    filename: result.filename,
    saveAs: true,
  });
}

/**
 * Export to CSV format (simpler alternative)
 */
export function exportToCSV(items: ExtractedItem[]): string {
  if (items.length === 0) return '';

  const headers = extractHeaders(items);
  const flattenedItems = items.map(item => flattenItem(item));

  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

  // Data rows
  for (const item of flattenedItems) {
    const row = headers.map(header => {
      const value = item[header] || '';
      return `"${value.replace(/"/g, '""')}"`;
    });
    csvRows.push(row.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Export CSV and trigger download
 */
export async function exportCSVAndDownload(
  items: ExtractedItem[],
  filename = `scrape-export-${Date.now()}.csv`
): Promise<void> {
  const csv = exportToCSV(items);
  const base64 = btoa(unescape(encodeURIComponent(csv)));

  await chrome.downloads.download({
    url: `data:text/csv;base64,${base64}`,
    filename,
    saveAs: true,
  });
}
