/**
 * Data Analysis Utilities
 * Statistical analysis and data profiling for scraped data
 */

import * as ss from 'simple-statistics';
import type { ExtractedItem } from '../types';

// --- Types ---

export interface FieldStats {
  name: string;
  type: 'string' | 'number' | 'mixed' | 'empty';
  fillRate: number;
  uniqueCount: number;
  sampleValues: string[];
}

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  sum: number;
  count: number;
  quartiles: [number, number, number]; // Q1, Q2 (median), Q3
}

export interface DataAnalysis {
  totalRecords: number;
  totalFields: number;
  completenessRate: number;
  fieldStats: Record<string, FieldStats>;
  numericStats: Record<string, NumericStats>;
  duplicates: {
    count: number;
    fields: string[];
  };
  patterns: DataPattern[];
}

export interface DataPattern {
  field: string;
  pattern: string;
  matchRate: number;
  description: string;
}

export interface AggregationResult {
  field: string;
  operation: AggregationOperation;
  value: number | string;
  groupBy?: string;
  groups?: Record<string, number | string>;
}

export type AggregationOperation =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'distinct'
  | 'median'
  | 'stddev';

// --- Helper Functions ---

/**
 * Flatten nested item to string values
 */
function flattenToStrings(item: ExtractedItem): Record<string, string> {
  const result: Record<string, string> = {};

  function flatten(obj: ExtractedItem, prefix = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value === undefined || value === null) {
        result[fullKey] = '';
      } else if (typeof value === 'string') {
        result[fullKey] = value;
      } else if (Array.isArray(value)) {
        result[fullKey] = value.map(v =>
          typeof v === 'string' ? v : JSON.stringify(v)
        ).join('; ');
      } else if (typeof value === 'object') {
        flatten(value as ExtractedItem, fullKey);
      }
    }
  }

  flatten(item);
  return result;
}

/**
 * Check if string looks like a number
 */
function isNumericString(value: string): boolean {
  if (!value || value.trim() === '') return false;
  const cleaned = value.replace(/[$€£¥,\s%]/g, '');
  return !isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned));
}

/**
 * Parse number from string
 */
function parseNumber(value: string): number {
  const cleaned = value.replace(/[$€£¥,\s%]/g, '');
  return parseFloat(cleaned);
}

/**
 * Detect common patterns in string values
 */
function detectPattern(values: string[]): DataPattern | null {
  const patterns = [
    { regex: /^\d{4}-\d{2}-\d{2}$/, name: 'ISO Date', desc: 'Date in YYYY-MM-DD format' },
    { regex: /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, name: 'US Date', desc: 'Date in MM/DD/YYYY format' },
    { regex: /^[\w.+-]+@[\w.-]+\.\w+$/, name: 'Email', desc: 'Email address' },
    { regex: /^https?:\/\//, name: 'URL', desc: 'HTTP/HTTPS URL' },
    { regex: /^\+?[\d\s()-]{10,}$/, name: 'Phone', desc: 'Phone number' },
    { regex: /^\$[\d,.]+$/, name: 'USD Currency', desc: 'US Dollar amount' },
    { regex: /^€[\d,.]+$/, name: 'EUR Currency', desc: 'Euro amount' },
    { regex: /^[\d,.]+%$/, name: 'Percentage', desc: 'Percentage value' },
  ];

  const nonEmptyValues = values.filter(v => v && v.trim());
  if (nonEmptyValues.length === 0) return null;

  for (const { regex, name, desc } of patterns) {
    const matches = nonEmptyValues.filter(v => regex.test(v));
    const matchRate = matches.length / nonEmptyValues.length;

    if (matchRate >= 0.8) { // 80% threshold
      return {
        field: '',
        pattern: name,
        matchRate,
        description: desc,
      };
    }
  }

  return null;
}

// --- Main Analysis Function ---

/**
 * Analyze extracted data and generate statistics
 */
export function analyzeData(items: ExtractedItem[]): DataAnalysis {
  if (items.length === 0) {
    return {
      totalRecords: 0,
      totalFields: 0,
      completenessRate: 0,
      fieldStats: {},
      numericStats: {},
      duplicates: { count: 0, fields: [] },
      patterns: [],
    };
  }

  // Flatten all items
  const flattenedItems = items.map(flattenToStrings);

  // Get all unique fields
  const allFields = new Set<string>();
  flattenedItems.forEach(item => {
    Object.keys(item).forEach(key => allFields.add(key));
  });
  const fields = Array.from(allFields);

  // Calculate field stats
  const fieldStats: Record<string, FieldStats> = {};
  const numericStats: Record<string, NumericStats> = {};
  const patterns: DataPattern[] = [];

  let totalFilledCells = 0;
  const totalCells = items.length * fields.length;

  for (const field of fields) {
    const values = flattenedItems.map(item => item[field] || '');
    const nonEmptyValues = values.filter(v => v.trim() !== '');
    const uniqueValues = new Set(values);

    // Count filled cells
    totalFilledCells += nonEmptyValues.length;

    // Determine type
    const numericValues = nonEmptyValues.filter(isNumericString);
    let type: FieldStats['type'] = 'empty';

    if (nonEmptyValues.length === 0) {
      type = 'empty';
    } else if (numericValues.length === nonEmptyValues.length) {
      type = 'number';
    } else if (numericValues.length > 0) {
      type = 'mixed';
    } else {
      type = 'string';
    }

    fieldStats[field] = {
      name: field,
      type,
      fillRate: nonEmptyValues.length / items.length,
      uniqueCount: uniqueValues.size,
      sampleValues: Array.from(uniqueValues).slice(0, 5),
    };

    // Calculate numeric stats if applicable
    if (type === 'number' && numericValues.length >= 2) {
      const numbers = numericValues.map(parseNumber);

      numericStats[field] = {
        min: ss.min(numbers),
        max: ss.max(numbers),
        mean: ss.mean(numbers),
        median: ss.median(numbers),
        stdDev: ss.standardDeviation(numbers),
        sum: ss.sum(numbers),
        count: numbers.length,
        quartiles: [
          ss.quantile(numbers, 0.25),
          ss.quantile(numbers, 0.5),
          ss.quantile(numbers, 0.75),
        ],
      };
    }

    // Detect patterns
    const pattern = detectPattern(nonEmptyValues);
    if (pattern) {
      patterns.push({ ...pattern, field });
    }
  }

  // Detect duplicates
  const duplicateCheck = detectDuplicates(flattenedItems, fields);

  return {
    totalRecords: items.length,
    totalFields: fields.length,
    completenessRate: totalCells > 0 ? totalFilledCells / totalCells : 0,
    fieldStats,
    numericStats,
    duplicates: duplicateCheck,
    patterns,
  };
}

/**
 * Detect duplicate records
 */
function detectDuplicates(
  items: Record<string, string>[],
  fields: string[]
): { count: number; fields: string[] } {
  // Check for exact duplicates
  const seen = new Set<string>();
  let duplicateCount = 0;

  for (const item of items) {
    const key = JSON.stringify(item);
    if (seen.has(key)) {
      duplicateCount++;
    } else {
      seen.add(key);
    }
  }

  // Find fields with duplicate values
  const duplicateFields: string[] = [];
  for (const field of fields) {
    const values = items.map(item => item[field]).filter(v => v);
    const uniqueValues = new Set(values);
    if (uniqueValues.size < values.length * 0.5) { // More than 50% duplicates
      duplicateFields.push(field);
    }
  }

  return {
    count: duplicateCount,
    fields: duplicateFields,
  };
}

// --- Aggregation Functions ---

/**
 * Perform aggregation on data
 */
export function aggregate(
  items: ExtractedItem[],
  field: string,
  operation: AggregationOperation,
  groupByField?: string
): AggregationResult {
  const flattenedItems = items.map(flattenToStrings);

  if (groupByField) {
    // Group by aggregation
    const groups: Record<string, number[]> = {};

    for (const item of flattenedItems) {
      const groupValue = item[groupByField] || 'Unknown';
      const fieldValue = item[field];

      if (!groups[groupValue]) {
        groups[groupValue] = [];
      }

      if (fieldValue && isNumericString(fieldValue)) {
        groups[groupValue].push(parseNumber(fieldValue));
      }
    }

    const groupResults: Record<string, number | string> = {};
    for (const [group, values] of Object.entries(groups)) {
      groupResults[group] = calculateAggregation(values, operation);
    }

    return {
      field,
      operation,
      value: Object.values(groupResults).length,
      groupBy: groupByField,
      groups: groupResults,
    };
  } else {
    // Simple aggregation
    const values: number[] = [];

    for (const item of flattenedItems) {
      const fieldValue = item[field];
      if (fieldValue && isNumericString(fieldValue)) {
        values.push(parseNumber(fieldValue));
      }
    }

    return {
      field,
      operation,
      value: calculateAggregation(values, operation),
    };
  }
}

/**
 * Calculate aggregation value
 */
function calculateAggregation(
  values: number[],
  operation: AggregationOperation
): number | string {
  if (values.length === 0) return 0;

  switch (operation) {
    case 'sum':
      return ss.sum(values);
    case 'avg':
      return Number(ss.mean(values).toFixed(2));
    case 'min':
      return ss.min(values);
    case 'max':
      return ss.max(values);
    case 'count':
      return values.length;
    case 'distinct':
      return new Set(values).size;
    case 'median':
      return Number(ss.median(values).toFixed(2));
    case 'stddev':
      return Number(ss.standardDeviation(values).toFixed(2));
    default:
      return 0;
  }
}

/**
 * Pivot data by two fields
 */
export function pivotData(
  items: ExtractedItem[],
  rowField: string,
  columnField: string,
  valueField: string,
  operation: AggregationOperation = 'sum'
): Record<string, Record<string, number>> {
  const flattenedItems = items.map(flattenToStrings);
  const pivot: Record<string, Record<string, number[]>> = {};

  for (const item of flattenedItems) {
    const rowValue = item[rowField] || 'Unknown';
    const colValue = item[columnField] || 'Unknown';
    const value = item[valueField];

    if (!pivot[rowValue]) {
      pivot[rowValue] = {};
    }
    if (!pivot[rowValue][colValue]) {
      pivot[rowValue][colValue] = [];
    }

    if (value && isNumericString(value)) {
      pivot[rowValue][colValue].push(parseNumber(value));
    }
  }

  // Calculate aggregations
  const result: Record<string, Record<string, number>> = {};
  for (const [row, cols] of Object.entries(pivot)) {
    result[row] = {};
    for (const [col, values] of Object.entries(cols)) {
      result[row][col] = calculateAggregation(values, operation) as number;
    }
  }

  return result;
}

/**
 * Get top N values for a field
 */
export function getTopValues(
  items: ExtractedItem[],
  field: string,
  n = 10,
  descending = true
): Array<{ value: string; count: number }> {
  const flattenedItems = items.map(flattenToStrings);
  const counts: Record<string, number> = {};

  for (const item of flattenedItems) {
    const value = item[field] || '';
    counts[value] = (counts[value] || 0) + 1;
  }

  const sorted = Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => descending ? b.count - a.count : a.count - b.count);

  return sorted.slice(0, n);
}

/**
 * Generate summary report as text
 */
export function generateTextReport(analysis: DataAnalysis): string {
  const lines: string[] = [
    '═══════════════════════════════════════════',
    '           DATA ANALYSIS REPORT',
    '═══════════════════════════════════════════',
    '',
    '📊 GENERAL STATISTICS',
    '───────────────────────────────────────────',
    `  Total Records:      ${analysis.totalRecords}`,
    `  Total Fields:       ${analysis.totalFields}`,
    `  Completeness Rate:  ${(analysis.completenessRate * 100).toFixed(1)}%`,
    `  Duplicate Records:  ${analysis.duplicates.count}`,
    '',
  ];

  if (Object.keys(analysis.fieldStats).length > 0) {
    lines.push('📋 FIELD STATISTICS');
    lines.push('───────────────────────────────────────────');

    for (const [field, stats] of Object.entries(analysis.fieldStats)) {
      lines.push(`  ${field}:`);
      lines.push(`    Type: ${stats.type} | Fill: ${(stats.fillRate * 100).toFixed(0)}% | Unique: ${stats.uniqueCount}`);
    }
    lines.push('');
  }

  if (Object.keys(analysis.numericStats).length > 0) {
    lines.push('🔢 NUMERIC FIELD ANALYSIS');
    lines.push('───────────────────────────────────────────');

    for (const [field, stats] of Object.entries(analysis.numericStats)) {
      lines.push(`  ${field}:`);
      lines.push(`    Min: ${stats.min} | Max: ${stats.max} | Mean: ${stats.mean.toFixed(2)}`);
      lines.push(`    Median: ${stats.median.toFixed(2)} | StdDev: ${stats.stdDev.toFixed(2)}`);
    }
    lines.push('');
  }

  if (analysis.patterns.length > 0) {
    lines.push('🔍 DETECTED PATTERNS');
    lines.push('───────────────────────────────────────────');

    for (const pattern of analysis.patterns) {
      lines.push(`  ${pattern.field}: ${pattern.pattern} (${(pattern.matchRate * 100).toFixed(0)}%)`);
      lines.push(`    ${pattern.description}`);
    }
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════');
  lines.push(`  Generated: ${new Date().toLocaleString()}`);
  lines.push('═══════════════════════════════════════════');

  return lines.join('\n');
}
