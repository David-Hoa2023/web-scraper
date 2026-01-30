/**
 * AI Chart Type Selector
 * Automatically recommends optimal chart types based on data characteristics
 */

import type { FieldStats, NumericStats, DataPattern, DataAnalysis } from '../export/dataAnalysis';
import { analyzeWithLLM, type DataAnalysisResult } from '../services/llmAnalysis';

// --- Types ---

export type ChartType =
  | 'bar'
  | 'line'
  | 'pie'
  | 'donut'
  | 'area'
  | 'scatter'
  | 'histogram'
  | 'gauge'
  | 'sparkline'
  | 'heatmap'
  | 'treemap'
  | 'table';

export interface ChartRecommendation {
  field: string;
  suggestedType: ChartType;
  confidence: number; // 0-1
  reasoning: string;
  alternatives: ChartType[];
  config: ChartConfig;
}

export interface ChartConfig {
  title: string;
  xAxis?: string;
  yAxis?: string;
  colorScheme: string[];
  showLegend: boolean;
  showGrid: boolean;
  animated: boolean;
}

export interface SlideData {
  id: string;
  type: 'title' | 'metrics' | 'chart' | 'table' | 'summary';
  title: string;
  subtitle?: string;
  content: SlideContent;
}

export type SlideContent =
  | TitleSlideContent
  | MetricsSlideContent
  | ChartSlideContent
  | TableSlideContent
  | SummarySlideContent;

export interface TitleSlideContent {
  type: 'title';
  mainTitle: string;
  subtitle: string;
  date: string;
  recordCount: number;
}

export interface MetricsSlideContent {
  type: 'metrics';
  metrics: Array<{
    label: string;
    value: string | number;
    change?: number;
    status?: 'good' | 'warning' | 'critical';
  }>;
}

export interface ChartSlideContent {
  type: 'chart';
  chartType: ChartType;
  data: Array<Record<string, unknown>>;
  config: ChartConfig;
  recommendation: ChartRecommendation;
}

export interface TableSlideContent {
  type: 'table';
  headers: string[];
  rows: Array<Array<string | number>>;
  highlightRows?: number[];
}

export interface SummarySlideContent {
  type: 'summary';
  insights: string[];
  patterns: DataPattern[];
  nextSteps: string[];
  summary?: string; // Optional AI-generated summary
}

// --- Color Schemes ---

export const COLOR_SCHEMES = {
  default: ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00C49F'],
  categorical: ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#0891b2', '#be185d'],
  sequential: ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'],
  diverging: ['#dc2626', '#f97316', '#facc15', '#84cc16', '#22c55e'],
  status: ['#22c55e', '#eab308', '#ef4444'], // good, warning, critical
};

// --- Chart Selection Logic ---

/**
 * Determine the best chart type for a field based on its statistics
 */
export function selectChartType(
  fieldStats: FieldStats,
  numericStats?: NumericStats,
  pattern?: DataPattern
): ChartRecommendation {
  const { name, type, fillRate, uniqueCount } = fieldStats;

  let suggestedType: ChartType = 'table';
  let confidence = 0.5;
  let reasoning = '';
  let alternatives: ChartType[] = [];

  // Pattern-based selection first
  if (pattern) {
    const patternResult = selectByPattern(pattern, uniqueCount);
    if (patternResult) {
      return {
        field: name,
        ...patternResult,
        config: generateChartConfig(name, patternResult.suggestedType),
      };
    }
  }

  // Type-based selection
  if (type === 'number' && numericStats) {
    const result = selectForNumericField(fieldStats, numericStats);
    suggestedType = result.type;
    confidence = result.confidence;
    reasoning = result.reasoning;
    alternatives = result.alternatives;
  } else if (type === 'string') {
    const result = selectForCategoricalField(fieldStats);
    suggestedType = result.type;
    confidence = result.confidence;
    reasoning = result.reasoning;
    alternatives = result.alternatives;
  } else if (type === 'mixed') {
    suggestedType = 'table';
    confidence = 0.6;
    reasoning = 'Mixed data types work best in table format';
    alternatives = ['bar'];
  } else {
    // Empty field
    suggestedType = 'table';
    confidence = 0.3;
    reasoning = 'Field has no data, defaulting to table';
    alternatives = [];
  }

  // Adjust confidence based on fill rate
  if (fillRate < 0.5) {
    confidence *= 0.8;
    reasoning += ` (${((1 - fillRate) * 100).toFixed(0)}% missing data)`;
  }

  return {
    field: name,
    suggestedType,
    confidence,
    reasoning,
    alternatives,
    config: generateChartConfig(name, suggestedType),
  };
}

/**
 * Select chart type based on detected data pattern
 */
function selectByPattern(
  pattern: DataPattern,
  uniqueCount: number
): Omit<ChartRecommendation, 'field' | 'config'> | null {
  switch (pattern.pattern) {
    case 'ISO Date':
    case 'US Date':
      return {
        suggestedType: 'line',
        confidence: 0.9,
        reasoning: `Temporal data (${pattern.pattern}) is best visualized as a timeline`,
        alternatives: ['area', 'bar'],
      };

    case 'USD Currency':
    case 'EUR Currency':
      return {
        suggestedType: 'bar',
        confidence: 0.85,
        reasoning: `Currency values (${pattern.pattern}) work well in bar charts for comparison`,
        alternatives: ['line', 'table'],
      };

    case 'Percentage':
      if (uniqueCount <= 1) {
        return {
          suggestedType: 'gauge',
          confidence: 0.9,
          reasoning: 'Single percentage value best shown as gauge',
          alternatives: ['donut'],
        };
      }
      return {
        suggestedType: 'bar',
        confidence: 0.8,
        reasoning: 'Multiple percentages compare well in bar chart',
        alternatives: ['donut', 'line'],
      };

    case 'URL':
      return {
        suggestedType: 'table',
        confidence: 0.95,
        reasoning: 'URLs are best displayed in a table with clickable links',
        alternatives: [],
      };

    case 'Email':
      if (uniqueCount <= 20) {
        return {
          suggestedType: 'bar',
          confidence: 0.7,
          reasoning: 'Email domains can be grouped and compared',
          alternatives: ['pie', 'table'],
        };
      }
      return {
        suggestedType: 'table',
        confidence: 0.85,
        reasoning: 'Many unique emails best shown in table',
        alternatives: [],
      };

    case 'Phone':
      return {
        suggestedType: 'table',
        confidence: 0.9,
        reasoning: 'Phone numbers best displayed in table format',
        alternatives: [],
      };

    default:
      return null;
  }
}

/**
 * Select chart type for numeric fields
 */
function selectForNumericField(
  fieldStats: FieldStats,
  numericStats: NumericStats
): { type: ChartType; confidence: number; reasoning: string; alternatives: ChartType[] } {
  const { uniqueCount } = fieldStats;
  const { count, stdDev, mean } = numericStats;

  // Single value - use gauge
  if (count === 1 || uniqueCount === 1) {
    return {
      type: 'gauge',
      confidence: 0.9,
      reasoning: 'Single numeric value displayed as gauge',
      alternatives: ['sparkline'],
    };
  }

  // Low cardinality - categorical comparison
  if (uniqueCount <= 10) {
    return {
      type: 'bar',
      confidence: 0.85,
      reasoning: `${uniqueCount} unique values suitable for bar chart comparison`,
      alternatives: ['pie', 'donut'],
    };
  }

  // Check for distribution characteristics
  const coefficientOfVariation = mean !== 0 ? stdDev / Math.abs(mean) : 0;

  // High variance - histogram to show distribution
  if (coefficientOfVariation > 0.5 && count >= 20) {
    return {
      type: 'histogram',
      confidence: 0.8,
      reasoning: 'High variance data benefits from histogram distribution view',
      alternatives: ['scatter', 'bar'],
    };
  }

  // Many data points - line or scatter
  if (count >= 50) {
    return {
      type: 'line',
      confidence: 0.75,
      reasoning: `${count} data points work well as trend line`,
      alternatives: ['scatter', 'area'],
    };
  }

  // Default for numeric
  return {
    type: 'bar',
    confidence: 0.7,
    reasoning: 'Numeric data displayed as bar chart for comparison',
    alternatives: ['line', 'scatter'],
  };
}

/**
 * Select chart type for categorical/string fields
 */
function selectForCategoricalField(
  fieldStats: FieldStats
): { type: ChartType; confidence: number; reasoning: string; alternatives: ChartType[] } {
  const { uniqueCount } = fieldStats;

  // Very few categories - pie chart
  if (uniqueCount <= 5) {
    return {
      type: 'pie',
      confidence: 0.85,
      reasoning: `${uniqueCount} categories ideal for pie chart`,
      alternatives: ['donut', 'bar'],
    };
  }

  // Moderate categories - bar chart
  if (uniqueCount <= 15) {
    return {
      type: 'bar',
      confidence: 0.8,
      reasoning: `${uniqueCount} categories suitable for bar chart`,
      alternatives: ['donut', 'treemap'],
    };
  }

  // Many categories - treemap or table
  if (uniqueCount <= 50) {
    return {
      type: 'treemap',
      confidence: 0.7,
      reasoning: `${uniqueCount} categories shown as treemap for hierarchy`,
      alternatives: ['bar', 'table'],
    };
  }

  // Too many categories - table
  return {
    type: 'table',
    confidence: 0.85,
    reasoning: `${uniqueCount} unique values too many for chart, using table`,
    alternatives: [],
  };
}

/**
 * Generate chart configuration based on field name and type
 */
function generateChartConfig(fieldName: string, chartType: ChartType): ChartConfig {
  const title = formatFieldName(fieldName);

  const baseConfig: ChartConfig = {
    title,
    colorScheme: COLOR_SCHEMES.default,
    showLegend: chartType !== 'gauge' && chartType !== 'sparkline',
    showGrid: ['bar', 'line', 'area', 'scatter', 'histogram'].includes(chartType),
    animated: true,
  };

  // Add axis labels for applicable charts
  if (['bar', 'line', 'area', 'scatter', 'histogram'].includes(chartType)) {
    baseConfig.yAxis = title;
    baseConfig.xAxis = 'Category';
  }

  // Use status colors for specific field names
  if (fieldName.toLowerCase().includes('status') ||
      fieldName.toLowerCase().includes('state') ||
      fieldName.toLowerCase().includes('health')) {
    baseConfig.colorScheme = COLOR_SCHEMES.status;
  }

  return baseConfig;
}

/**
 * Format field name for display
 */
export function formatFieldName(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// --- Slide Generation ---

/**
 * Generate presentation slides from data analysis
 */
export function generateSlides(
  analysis: DataAnalysis,
  data: Array<Record<string, unknown>>,
  title: string = 'Data Analysis Report'
): SlideData[] {
  const slides: SlideData[] = [];

  // 1. Title slide
  slides.push(createTitleSlide(title, analysis));

  // 2. Summary metrics slide with actual data stats
  slides.push(createMetricsSlide(analysis));

  // 3. Data sample slide - show actual scraped items
  slides.push(createDataSampleSlide(data, analysis));

  // 4. Chart slides for each significant field (distributions, comparisons)
  const chartSlides = createChartSlides(analysis, data);
  slides.push(...chartSlides);

  // 5. Data insights slide
  if (analysis.patterns.length > 0 || Object.keys(analysis.numericStats).length > 0 || Object.keys(analysis.fieldStats).length > 0) {
    slides.push(createSummarySlide(analysis));
  }

  return slides;
}

/**
 * Generate presentation slides with LLM-enhanced insights
 */
export async function generateSlidesWithLLM(
  analysis: DataAnalysis,
  data: Array<Record<string, unknown>>,
  title: string = 'Data Analysis Report'
): Promise<SlideData[]> {
  const slides: SlideData[] = [];

  // 1. Title slide
  slides.push(createTitleSlide(title, analysis));

  // 2. Summary metrics slide with actual data stats
  slides.push(createMetricsSlide(analysis));

  // 3. Data sample slide - show actual scraped items
  slides.push(createDataSampleSlide(data, analysis));

  // 4. Chart slides for each significant field (distributions, comparisons)
  const chartSlides = createChartSlides(analysis, data);
  slides.push(...chartSlides);

  // 5. Try LLM-enhanced insights
  let llmAnalysis: DataAnalysisResult | null = null;
  try {
    llmAnalysis = await analyzeWithLLM(data as Array<Record<string, unknown>>);
  } catch (err) {
    console.warn('[ChartSelector] LLM analysis failed, falling back to basic insights:', err);
  }

  // 6. Data insights slide (LLM-enhanced or basic)
  if (llmAnalysis && (llmAnalysis.insights.length > 0 || llmAnalysis.recommendations.length > 0)) {
    slides.push(createLLMInsightsSlide(llmAnalysis));
  } else if (analysis.patterns.length > 0 || Object.keys(analysis.numericStats).length > 0 || Object.keys(analysis.fieldStats).length > 0) {
    slides.push(createSummarySlide(analysis));
  }

  return slides;
}

/**
 * Create LLM-enhanced insights slide
 */
function createLLMInsightsSlide(llmAnalysis: DataAnalysisResult): SlideData {
  return {
    id: 'llm-insights',
    type: 'summary',
    title: 'AI-Powered Insights',
    content: {
      type: 'summary',
      insights: llmAnalysis.insights.slice(0, 6),
      patterns: [],
      nextSteps: llmAnalysis.recommendations.slice(0, 4),
      summary: llmAnalysis.summary,
    },
  };
}

/**
 * Create data sample slide showing actual scraped items
 */
function createDataSampleSlide(data: Array<Record<string, unknown>>, analysis: DataAnalysis): SlideData {
  // Select key fields to display (prioritize title, name, price, etc.)
  const priorityFields = ['title', 'name', 'product', 'item', 'price', 'cost', 'rating', 'category', 'brand'];
  const allFields = Object.keys(analysis.fieldStats);

  // Sort fields by priority
  const sortedFields = allFields.sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aIndex = priorityFields.findIndex(p => aLower.includes(p));
    const bIndex = priorityFields.findIndex(p => bLower.includes(p));

    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return 0;
  });

  // Take top 4-5 fields that fit
  const displayFields = sortedFields.slice(0, 5);

  // Get sample rows (first 8 items)
  const rows: Array<Array<string | number>> = data.slice(0, 8).map(item => {
    return displayFields.map(field => {
      const value = item[field];
      if (value === undefined || value === null) return '';
      if (typeof value === 'string') {
        // Truncate long strings
        return value.length > 30 ? value.substring(0, 27) + '...' : value;
      }
      return String(value);
    });
  });

  // Format headers nicely
  const headers = displayFields.map(f => formatFieldName(f));

  return {
    id: 'data-sample',
    type: 'table',
    title: 'Sample Data',
    subtitle: `Showing ${rows.length} of ${data.length} items`,
    content: {
      type: 'table',
      headers,
      rows,
    },
  };
}

/**
 * Create title slide
 */
function createTitleSlide(title: string, analysis: DataAnalysis): SlideData {
  return {
    id: 'title',
    type: 'title',
    title: title,
    content: {
      type: 'title',
      mainTitle: title,
      subtitle: `${analysis.totalRecords} records across ${analysis.totalFields} fields`,
      date: new Date().toLocaleDateString(),
      recordCount: analysis.totalRecords,
    },
  };
}

/**
 * Create metrics overview slide with actual data insights
 */
function createMetricsSlide(analysis: DataAnalysis): SlideData {
  const metrics: MetricsSlideContent['metrics'] = [
    {
      label: 'Items Scraped',
      value: analysis.totalRecords,
      status: 'good',
    },
    {
      label: 'Data Fields',
      value: analysis.totalFields,
      status: 'good',
    },
  ];

  // Add key numeric field stats (e.g., price ranges)
  for (const [field, stats] of Object.entries(analysis.numericStats)) {
    const fieldLabel = formatFieldName(field);

    // Add average for price-like fields
    if (field.toLowerCase().includes('price') || field.toLowerCase().includes('cost')) {
      metrics.push({
        label: `Avg ${fieldLabel}`,
        value: `$${stats.mean.toFixed(2)}`,
        status: 'good',
      });
      metrics.push({
        label: `${fieldLabel} Range`,
        value: `$${stats.min.toFixed(0)} - $${stats.max.toFixed(0)}`,
        status: 'good',
      });
    } else if (metrics.length < 5) {
      metrics.push({
        label: `Avg ${fieldLabel}`,
        value: stats.mean.toFixed(2),
        status: 'good',
      });
    }

    if (metrics.length >= 5) break;
  }

  // Fill remaining slots with category counts
  if (metrics.length < 5) {
    for (const [field, stats] of Object.entries(analysis.fieldStats)) {
      if (stats.type === 'string' && stats.uniqueCount > 1 && stats.uniqueCount <= 50) {
        metrics.push({
          label: `Unique ${formatFieldName(field)}`,
          value: stats.uniqueCount,
          status: 'good',
        });
        if (metrics.length >= 5) break;
      }
    }
  }

  return {
    id: 'metrics',
    type: 'metrics',
    title: 'Key Metrics',
    content: {
      type: 'metrics',
      metrics,
    },
  };
}

/**
 * Create chart slides for significant fields
 */
function createChartSlides(
  analysis: DataAnalysis,
  data: Array<Record<string, unknown>>
): SlideData[] {
  const slides: SlideData[] = [];
  const processedFields = new Set<string>();

  // Prioritize fields with numeric stats
  for (const [fieldName, numericStats] of Object.entries(analysis.numericStats)) {
    if (processedFields.has(fieldName)) continue;
    processedFields.add(fieldName);

    const fieldStats = analysis.fieldStats[fieldName];
    if (!fieldStats) continue;

    const pattern = analysis.patterns.find(p => p.field === fieldName);
    const recommendation = selectChartType(fieldStats, numericStats, pattern);

    // Skip table recommendations for chart slides
    if (recommendation.suggestedType === 'table') continue;

    const chartData = prepareChartData(data, fieldName, recommendation.suggestedType);

    slides.push({
      id: `chart-${fieldName}`,
      type: 'chart',
      title: recommendation.config.title,
      subtitle: recommendation.reasoning,
      content: {
        type: 'chart',
        chartType: recommendation.suggestedType,
        data: chartData,
        config: recommendation.config,
        recommendation,
      },
    });
  }

  // Add categorical fields with low cardinality
  for (const [fieldName, fieldStats] of Object.entries(analysis.fieldStats)) {
    if (processedFields.has(fieldName)) continue;
    if (fieldStats.type !== 'string' || fieldStats.uniqueCount > 15) continue;
    if (fieldStats.fillRate < 0.5) continue;

    processedFields.add(fieldName);

    const pattern = analysis.patterns.find(p => p.field === fieldName);
    const recommendation = selectChartType(fieldStats, undefined, pattern);

    if (recommendation.suggestedType === 'table') continue;

    const chartData = prepareChartData(data, fieldName, recommendation.suggestedType);

    slides.push({
      id: `chart-${fieldName}`,
      type: 'chart',
      title: recommendation.config.title,
      subtitle: recommendation.reasoning,
      content: {
        type: 'chart',
        chartType: recommendation.suggestedType,
        data: chartData,
        config: recommendation.config,
        recommendation,
      },
    });
  }

  // Limit to 6 chart slides max
  return slides.slice(0, 6);
}

/**
 * Prepare data for chart rendering
 */
export function prepareChartData(
  data: Array<Record<string, unknown>>,
  fieldName: string,
  chartType: ChartType
): Array<Record<string, unknown>> {
  // Extract field values
  const values = data
    .map(item => item[fieldName])
    .filter(v => v !== undefined && v !== null && v !== '');

  if (chartType === 'pie' || chartType === 'donut' || chartType === 'bar' || chartType === 'treemap') {
    // Aggregate by value count
    const counts: Record<string, number> = {};
    for (const value of values) {
      const key = String(value);
      counts[key] = (counts[key] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20); // Limit to top 20
  }

  if (chartType === 'line' || chartType === 'area' || chartType === 'scatter') {
    // Return as indexed series
    return values.slice(0, 100).map((value, index) => ({
      index,
      value: typeof value === 'number' ? value : parseFloat(String(value)) || 0,
    }));
  }

  if (chartType === 'histogram') {
    // Create histogram bins
    const numericValues = values
      .map(v => typeof v === 'number' ? v : parseFloat(String(v)))
      .filter(v => !isNaN(v));

    if (numericValues.length === 0) return [];

    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const binCount = Math.min(10, Math.ceil(Math.sqrt(numericValues.length)));
    const binWidth = (max - min) / binCount || 1;

    const bins: Array<{ range: string; count: number }> = [];
    for (let i = 0; i < binCount; i++) {
      const binStart = min + i * binWidth;
      const binEnd = binStart + binWidth;
      const count = numericValues.filter(v => v >= binStart && (i === binCount - 1 ? v <= binEnd : v < binEnd)).length;
      bins.push({
        range: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`,
        count,
      });
    }
    return bins;
  }

  // Default: return raw values
  return values.slice(0, 50).map((value, index) => ({
    index,
    value,
  }));
}

/**
 * Create summary/insights slide with actual data insights
 */
function createSummarySlide(analysis: DataAnalysis): SlideData {
  const insights: string[] = [];

  // Numeric field insights - show actual values
  for (const [field, stats] of Object.entries(analysis.numericStats)) {
    const fieldLabel = formatFieldName(field);

    if (field.toLowerCase().includes('price') || field.toLowerCase().includes('cost')) {
      insights.push(`${fieldLabel}: ranges from $${stats.min.toFixed(2)} to $${stats.max.toFixed(2)} (avg: $${stats.mean.toFixed(2)})`);
    } else if (field.toLowerCase().includes('rating') || field.toLowerCase().includes('score')) {
      insights.push(`${fieldLabel}: average ${stats.mean.toFixed(1)} (${stats.min.toFixed(1)} - ${stats.max.toFixed(1)})`);
    } else if (field.toLowerCase().includes('count') || field.toLowerCase().includes('quantity') || field.toLowerCase().includes('sold')) {
      insights.push(`${fieldLabel}: total ${stats.sum.toLocaleString()}, average ${stats.mean.toFixed(0)} per item`);
    } else {
      insights.push(`${fieldLabel}: average ${stats.mean.toFixed(2)} (min: ${stats.min}, max: ${stats.max})`);
    }
  }

  // Categorical field insights - show variety
  for (const [field, stats] of Object.entries(analysis.fieldStats)) {
    if (stats.type === 'string' && stats.uniqueCount > 1 && stats.uniqueCount <= 20 && insights.length < 6) {
      const fieldLabel = formatFieldName(field);
      if (stats.sampleValues.length > 0) {
        const samples = stats.sampleValues.slice(0, 3).join(', ');
        insights.push(`${stats.uniqueCount} different ${fieldLabel.toLowerCase()}s found (e.g., ${samples})`);
      }
    }
  }

  // Pattern-based insights
  for (const pattern of analysis.patterns) {
    if (insights.length < 6) {
      insights.push(`${formatFieldName(pattern.field)} contains ${pattern.pattern.toLowerCase()} data`);
    }
  }

  const nextSteps: string[] = [
    'Export to Excel for detailed filtering and sorting',
    'Use charts to compare items by price or rating',
    'Filter by category to find specific products',
    'Sort by value to identify best deals',
  ];

  return {
    id: 'summary',
    type: 'summary',
    title: 'Data Insights',
    content: {
      type: 'summary',
      insights: insights.slice(0, 6),
      patterns: analysis.patterns,
      nextSteps: nextSteps.slice(0, 4),
    },
  };
}

