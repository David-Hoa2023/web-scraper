/**
 * Visualization Module
 * AI-powered data visualization for presentations
 */

// Chart selector and slide generation
export {
  selectChartType,
  generateSlides,
  prepareChartData,
  formatFieldName,
  COLOR_SCHEMES,
} from './chartSelector';

export type {
  ChartType,
  ChartRecommendation,
  ChartConfig,
  SlideData,
  SlideContent,
  TitleSlideContent,
  MetricsSlideContent,
  ChartSlideContent,
  TableSlideContent,
  SummarySlideContent,
} from './chartSelector';

// Presentation export
export {
  exportToPptx,
  exportToPdf,
} from './presentationExporter';

export type {
  ExportOptions,
  ExportResult,
} from './presentationExporter';

// Note: SlideGenerator.tsx is a React component that requires a React build setup.
// It can be used for in-browser preview when integrated with a React application.
// For the Chrome extension, use exportToPptx/exportToPdf for direct file export.
