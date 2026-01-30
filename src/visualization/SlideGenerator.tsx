/**
 * SlideGenerator - React component for rendering presentation slides
 * Uses Recharts for data visualization
 */

import React, { useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type {
  SlideData,
  ChartType,
  ChartConfig,
  TitleSlideContent,
  MetricsSlideContent,
  ChartSlideContent,
  TableSlideContent,
  SummarySlideContent,
  COLOR_SCHEMES,
} from './chartSelector';

// --- Types ---

interface SlideGeneratorProps {
  slides: SlideData[];
  onExport?: (format: 'pptx' | 'pdf' | 'html') => void;
  theme?: 'light' | 'dark';
}

interface SlideNavigationProps {
  currentSlide: number;
  totalSlides: number;
  onNavigate: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}

// --- Styles ---

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#1a1a2e',
    color: '#eee',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  slideContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    overflow: 'hidden',
  },
  slide: {
    width: '100%',
    maxWidth: '900px',
    aspectRatio: '16/9',
    backgroundColor: '#16213e',
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  navigation: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#0f0f23',
    borderTop: '1px solid #333',
  },
  navButton: {
    padding: '8px 16px',
    backgroundColor: '#4a4e69',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'background-color 0.2s',
  },
  navButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  slideCounter: {
    fontSize: '14px',
    color: '#888',
    minWidth: '80px',
    textAlign: 'center' as const,
  },
  exportButtons: {
    display: 'flex',
    gap: '8px',
    marginLeft: 'auto',
  },
  exportButton: {
    padding: '8px 12px',
    backgroundColor: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 600,
  },
};

// --- Chart Colors ---

const CHART_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00C49F', '#FFBB28', '#FF8042'];

// --- Slide Components ---

/**
 * Title Slide
 */
function TitleSlide({ content }: { content: TitleSlideContent }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      textAlign: 'center',
    }}>
      <h1 style={{
        fontSize: '36px',
        fontWeight: 700,
        marginBottom: '16px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        {content.mainTitle}
      </h1>
      <p style={{
        fontSize: '20px',
        color: '#aaa',
        marginBottom: '32px',
      }}>
        {content.subtitle}
      </p>
      <div style={{
        display: 'flex',
        gap: '32px',
        fontSize: '14px',
        color: '#666',
      }}>
        <span>{content.date}</span>
        <span>|</span>
        <span>{content.recordCount.toLocaleString()} records</span>
      </div>
    </div>
  );
}

/**
 * Metrics Slide
 */
function MetricsSlide({ content }: { content: MetricsSlideContent }) {
  const statusColors = {
    good: '#22c55e',
    warning: '#eab308',
    critical: '#ef4444',
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <h2 style={{
        fontSize: '24px',
        fontWeight: 600,
        marginBottom: '24px',
        color: '#fff',
      }}>
        Data Overview
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '16px',
        flex: 1,
        alignContent: 'center',
      }}>
        {content.metrics.map((metric, index) => (
          <div
            key={index}
            style={{
              backgroundColor: '#1e2a4a',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'center',
              borderLeft: `4px solid ${metric.status ? statusColors[metric.status] : '#4a4e69'}`,
            }}
          >
            <div style={{
              fontSize: '28px',
              fontWeight: 700,
              color: metric.status ? statusColors[metric.status] : '#fff',
              marginBottom: '8px',
            }}>
              {metric.value}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {metric.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Chart Slide
 */
function ChartSlide({ content, title, subtitle }: {
  content: ChartSlideContent;
  title: string;
  subtitle?: string;
}) {
  const { chartType, data, config } = content;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{
          fontSize: '22px',
          fontWeight: 600,
          color: '#fff',
          marginBottom: '4px',
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{
            fontSize: '13px',
            color: '#888',
          }}>
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(chartType, data, config)}
        </ResponsiveContainer>
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: '8px',
        fontSize: '11px',
        color: '#666',
      }}>
        <span style={{
          backgroundColor: '#1e2a4a',
          padding: '4px 8px',
          borderRadius: '4px',
        }}>
          Confidence: {(content.recommendation.confidence * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

/**
 * Render appropriate chart based on type
 */
function renderChart(
  chartType: ChartType,
  data: Array<Record<string, unknown>>,
  config: ChartConfig
): JSX.Element {
  const commonProps = {
    data,
    margin: { top: 20, right: 30, left: 20, bottom: 20 },
  };

  switch (chartType) {
    case 'bar':
      return (
        <BarChart {...commonProps}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#333" />}
          <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 11 }} />
          <YAxis tick={{ fill: '#888', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e2a4a', border: '1px solid #333' }}
            labelStyle={{ color: '#fff' }}
          />
          {config.showLegend && <Legend />}
          <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      );

    case 'line':
      return (
        <LineChart {...commonProps}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#333" />}
          <XAxis dataKey="index" tick={{ fill: '#888', fontSize: 11 }} />
          <YAxis tick={{ fill: '#888', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e2a4a', border: '1px solid #333' }}
            labelStyle={{ color: '#fff' }}
          />
          {config.showLegend && <Legend />}
          <Line
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS[0]}
            strokeWidth={2}
            dot={{ fill: CHART_COLORS[0], r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      );

    case 'area':
      return (
        <AreaChart {...commonProps}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#333" />}
          <XAxis dataKey="index" tick={{ fill: '#888', fontSize: 11 }} />
          <YAxis tick={{ fill: '#888', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e2a4a', border: '1px solid #333' }}
            labelStyle={{ color: '#fff' }}
          />
          {config.showLegend && <Legend />}
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.8} />
              <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS[0]}
            fillOpacity={1}
            fill="url(#colorValue)"
          />
        </AreaChart>
      );

    case 'pie':
    case 'donut':
      const innerRadius = chartType === 'donut' ? 60 : 0;
      return (
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            labelLine={{ stroke: '#666' }}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#1e2a4a', border: '1px solid #333' }}
            labelStyle={{ color: '#fff' }}
          />
          {config.showLegend && <Legend />}
        </PieChart>
      );

    case 'scatter':
      return (
        <ScatterChart {...commonProps}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#333" />}
          <XAxis dataKey="index" tick={{ fill: '#888', fontSize: 11 }} />
          <YAxis dataKey="value" tick={{ fill: '#888', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e2a4a', border: '1px solid #333' }}
            labelStyle={{ color: '#fff' }}
          />
          {config.showLegend && <Legend />}
          <Scatter name="Values" data={data} fill={CHART_COLORS[0]} />
        </ScatterChart>
      );

    case 'histogram':
      return (
        <BarChart {...commonProps}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#333" />}
          <XAxis dataKey="range" tick={{ fill: '#888', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
          <YAxis tick={{ fill: '#888', fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1e2a4a', border: '1px solid #333' }}
            labelStyle={{ color: '#fff' }}
          />
          <Bar dataKey="count" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
        </BarChart>
      );

    default:
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#666',
        }}>
          Chart type "{chartType}" not supported
        </div>
      );
  }
}

/**
 * Table Slide
 */
function TableSlide({ content, title }: { content: TableSlideContent; title: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <h2 style={{
        fontSize: '22px',
        fontWeight: 600,
        color: '#fff',
        marginBottom: '16px',
      }}>
        {title}
      </h2>
      <div style={{
        flex: 1,
        overflow: 'auto',
        borderRadius: '8px',
        border: '1px solid #333',
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px',
        }}>
          <thead>
            <tr style={{ backgroundColor: '#1e2a4a' }}>
              {content.headers.map((header, index) => (
                <th
                  key={index}
                  style={{
                    padding: '12px',
                    textAlign: 'left',
                    borderBottom: '1px solid #333',
                    color: '#aaa',
                    fontWeight: 600,
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {content.rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                style={{
                  backgroundColor: content.highlightRows?.includes(rowIndex) ? '#2a3f5f' : 'transparent',
                }}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid #333',
                      color: '#ddd',
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Summary Slide
 */
function SummarySlide({ content }: { content: SummarySlideContent }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <h2 style={{
        fontSize: '22px',
        fontWeight: 600,
        color: '#fff',
        marginBottom: '24px',
      }}>
        Key Insights & Next Steps
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px',
        flex: 1,
      }}>
        {/* Insights */}
        <div>
          <h3 style={{
            fontSize: '14px',
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '12px',
          }}>
            Insights
          </h3>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}>
            {content.insights.map((insight, index) => (
              <li
                key={index}
                style={{
                  padding: '8px 0',
                  paddingLeft: '20px',
                  position: 'relative',
                  fontSize: '13px',
                  color: '#ccc',
                  lineHeight: 1.5,
                }}
              >
                <span style={{
                  position: 'absolute',
                  left: 0,
                  color: '#22c55e',
                }}>
                  →
                </span>
                {insight}
              </li>
            ))}
          </ul>
        </div>

        {/* Next Steps */}
        <div>
          <h3 style={{
            fontSize: '14px',
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '12px',
          }}>
            Next Steps
          </h3>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
          }}>
            {content.nextSteps.map((step, index) => (
              <li
                key={index}
                style={{
                  padding: '8px 0',
                  paddingLeft: '28px',
                  position: 'relative',
                  fontSize: '13px',
                  color: '#ccc',
                  lineHeight: 1.5,
                }}
              >
                <span style={{
                  position: 'absolute',
                  left: 0,
                  width: '20px',
                  height: '20px',
                  backgroundColor: '#4a4e69',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  color: '#fff',
                }}>
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Patterns detected */}
      {content.patterns.length > 0 && (
        <div style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#1e2a4a',
          borderRadius: '8px',
        }}>
          <h3 style={{
            fontSize: '12px',
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '8px',
          }}>
            Detected Patterns
          </h3>
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
          }}>
            {content.patterns.map((pattern, index) => (
              <span
                key={index}
                style={{
                  padding: '4px 8px',
                  backgroundColor: '#2a3f5f',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#aaa',
                }}
              >
                {pattern.field}: {pattern.pattern} ({(pattern.matchRate * 100).toFixed(0)}%)
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Slide Navigation Component
 */
function SlideNavigation({
  currentSlide,
  totalSlides,
  onNavigate,
  onPrevious,
  onNext,
}: SlideNavigationProps) {
  return (
    <div style={styles.navigation}>
      <button
        style={{
          ...styles.navButton,
          ...(currentSlide === 0 ? styles.navButtonDisabled : {}),
        }}
        onClick={onPrevious}
        disabled={currentSlide === 0}
      >
        ← Previous
      </button>

      <div style={styles.slideCounter}>
        {currentSlide + 1} / {totalSlides}
      </div>

      <button
        style={{
          ...styles.navButton,
          ...(currentSlide === totalSlides - 1 ? styles.navButtonDisabled : {}),
        }}
        onClick={onNext}
        disabled={currentSlide === totalSlides - 1}
      >
        Next →
      </button>
    </div>
  );
}

/**
 * Main SlideGenerator Component
 */
export function SlideGenerator({ slides, onExport, theme = 'dark' }: SlideGeneratorProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const handlePrevious = useCallback(() => {
    setCurrentSlideIndex(prev => Math.max(0, prev - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1));
  }, [slides.length]);

  const handleNavigate = useCallback((index: number) => {
    setCurrentSlideIndex(Math.max(0, Math.min(slides.length - 1, index)));
  }, [slides.length]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        handlePrevious();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        handleNext();
      } else if (e.key === 'Home') {
        handleNavigate(0);
      } else if (e.key === 'End') {
        handleNavigate(slides.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrevious, handleNext, handleNavigate, slides.length]);

  if (slides.length === 0) {
    return (
      <div style={{
        ...styles.container,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p style={{ color: '#666' }}>No slides to display</p>
      </div>
    );
  }

  const currentSlide = slides[currentSlideIndex];

  const renderSlideContent = () => {
    switch (currentSlide.type) {
      case 'title':
        return <TitleSlide content={currentSlide.content as TitleSlideContent} />;
      case 'metrics':
        return <MetricsSlide content={currentSlide.content as MetricsSlideContent} />;
      case 'chart':
        return (
          <ChartSlide
            content={currentSlide.content as ChartSlideContent}
            title={currentSlide.title}
            subtitle={currentSlide.subtitle}
          />
        );
      case 'table':
        return (
          <TableSlide
            content={currentSlide.content as TableSlideContent}
            title={currentSlide.title}
          />
        );
      case 'summary':
        return <SummarySlide content={currentSlide.content as SummarySlideContent} />;
      default:
        return <div>Unknown slide type</div>;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.slideContainer}>
        <div style={styles.slide}>
          {renderSlideContent()}
        </div>
      </div>

      <div style={styles.navigation}>
        <button
          style={{
            ...styles.navButton,
            ...(currentSlideIndex === 0 ? styles.navButtonDisabled : {}),
          }}
          onClick={handlePrevious}
          disabled={currentSlideIndex === 0}
        >
          ← Previous
        </button>

        <div style={styles.slideCounter}>
          {currentSlideIndex + 1} / {slides.length}
        </div>

        <button
          style={{
            ...styles.navButton,
            ...(currentSlideIndex === slides.length - 1 ? styles.navButtonDisabled : {}),
          }}
          onClick={handleNext}
          disabled={currentSlideIndex === slides.length - 1}
        >
          Next →
        </button>

        {onExport && (
          <div style={styles.exportButtons}>
            <button
              style={styles.exportButton}
              onClick={() => onExport('pptx')}
            >
              Export PPTX
            </button>
            <button
              style={{ ...styles.exportButton, backgroundColor: '#3b82f6' }}
              onClick={() => onExport('pdf')}
            >
              Export PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SlideGenerator;
