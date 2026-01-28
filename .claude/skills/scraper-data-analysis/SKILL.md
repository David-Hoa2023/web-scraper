---
name: scraper-data-analysis
description: Analyzes scraped web data with word cloud, sentiment analysis, thematic analysis, statistical insights, and report generation. Use when the user wants to analyze scraped data, create word clouds, detect sentiment, extract themes/brands, generate Excel reports, visualize insights, or create presentations from data.
---

# Scraper Data Analysis Skill

Comprehensive data analysis, insight extraction, and visualization for web-scraped data from the Web Scraper Pro extension.

## Core Philosophy

1. **Automated Insights** — Detect patterns, outliers, and trends automatically
2. **Visual First** — Generate charts, presentations, and visual reports
3. **Actionable Output** — Focus on findings that drive decisions
4. **Zero Config** — Works out-of-the-box with sensible defaults

---

## Phase 0: Detect Mode

Determine what the user wants:

**Mode A: Analyze Live Data**
- Data is in the extension (just scraped)
- Use `ANALYZE_DATA` message to service worker
- Proceed to Phase 2

**Mode B: Analyze Downloaded File**
- User has Excel/CSV/JSON file
- Load and parse the file
- Proceed to Phase 1

**Mode C: Generate Report/Presentation**
- User wants visual output from analysis
- Proceed to Phase 4

---

## Phase 1: Load External Data

### Step 1.1: Detect File Format

```typescript
function detectFormat(filePath: string): 'excel' | 'csv' | 'json' {
  const ext = filePath.toLowerCase().split('.').pop();
  if (ext === 'xlsx' || ext === 'xls') return 'excel';
  if (ext === 'csv') return 'csv';
  if (ext === 'json') return 'json';
  throw new Error(`Unsupported format: ${ext}`);
}
```

### Step 1.2: Load Excel Files

```typescript
import * as XLSX from 'xlsx';

function loadExcel(filePath: string): ExtractedItem[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet);
}
```

### Step 1.3: Load CSV Files

```typescript
function loadCSV(content: string): ExtractedItem[] {
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const item: ExtractedItem = {};
    headers.forEach((header, i) => {
      item[header] = values[i];
    });
    return item;
  });
}
```

### Step 1.4: Load JSON Files

```typescript
function loadJSON(content: string): ExtractedItem[] {
  const data = JSON.parse(content);
  return Array.isArray(data) ? data : [data];
}
```

---

## Phase 2: Data Analysis

### Step 2.1: Profile Data Structure

```typescript
import { analyzeData } from './src/export';

const analysis = analyzeData(items);

// Returns:
interface DataAnalysis {
  totalRecords: number;
  totalFields: number;
  completenessRate: number;
  fieldStats: FieldStat[];      // Fill rate, unique values, type
  numericStats: NumericStat[];  // Min, max, mean, median, stddev
  patterns: PatternMatch[];     // Emails, URLs, dates, currencies
  duplicates: DuplicateInfo;
}
```

### Step 2.2: Extract Key Insights

Automatically detect and report:

| Insight Type | Detection Method |
|--------------|------------------|
| **Volume** | `totalRecords`, unique vs duplicates |
| **Completeness** | Fields with <80% fill rate flagged |
| **Price Range** | Min/max/avg for numeric fields |
| **Top Categories** | `getTopValues(items, field, 10)` |
| **Patterns** | Regex detection (emails, URLs, phones) |
| **Outliers** | Values outside 2 standard deviations |
| **Trends** | Date-based grouping if dates detected |

### Step 2.3: Generate Aggregations

```typescript
import { aggregate, pivotData, getTopValues } from './src/export';

// Supported aggregation functions:
// 'sum', 'avg', 'min', 'max', 'count', 'distinct', 'median', 'stddev'

// Sum prices by category
const byCategory = aggregate(items, 'price', 'sum', 'category');

// Average rating by brand
const byBrand = aggregate(items, 'rating', 'avg', 'brand');

// Pivot table: category × month × sales
const pivot = pivotData(items, 'category', 'month', 'sales', 'sum');

// Top 10 most common values
const topSellers = getTopValues(items, 'product', 10);
```

---

## Phase 3: Report Generation

### Step 3.1: Text Report

```typescript
import { generateTextReport } from './src/export';

const report = generateTextReport(analysis);
console.log(report);
```

Output format:
```
═══════════════════════════════════════════
           DATA ANALYSIS REPORT
═══════════════════════════════════════════

📊 GENERAL STATISTICS
───────────────────────────────────────────
  Total Records:      150
  Total Fields:       8
  Completeness Rate:  94.5%
  Duplicate Records:  3 (2.0%)

📋 FIELD STATISTICS
───────────────────────────────────────────
  Field          Fill%   Unique   Type
  ─────────────────────────────────────
  title          100%    147      string
  price          98%     45       number
  category       95%     12       string
  image          87%     142      url

📈 NUMERIC ANALYSIS
───────────────────────────────────────────
  price:
    Range: $12.99 - $499.99
    Average: $89.45
    Median: $64.99

🔍 KEY INSIGHTS
───────────────────────────────────────────
  • 3 duplicate records detected
  • 13% of items missing images
  • Price outlier: $499.99 (3.2σ above mean)
  • Top category: "Electronics" (34%)
```

### Step 3.2: Excel Report

```typescript
import { exportToExcel } from './src/export';

const result = await exportToExcel(items, {
  filename: 'analysis-report.xlsx',
  includeAnalysis: true,
  sheetName: 'Scraped Data',
});

// Creates Excel with:
// - Sheet 1: Formatted data with styling
// - Sheet 2: Analysis summary and statistics
```

---

## Phase 4: Visual Presentation

### Step 4.1: Choose Visualization Style

Based on data type, recommend a style:

| Data Type | Recommended Style | Why |
|-----------|-------------------|-----|
| E-commerce (products + prices) | **Warm Editorial** | Image-heavy, price cards |
| API/Tech data | **Terminal Green** | Code-like, structured |
| Business metrics | **Midnight Executive** | Charts, KPIs |
| General scrape | **Swiss Modern** | Clean, data-focused |
| Trend analysis | **Deep Space** | Timeline, cinematic |

### Step 4.2: Generate Insight Slides

Use the `frontend-slides` skill to create presentations:

**Slide Structure:**

```
Slide 1: Title
   - "[Data Source] Analysis"
   - Date, total items, source URL

Slide 2: Overview Stats
   - Total items collected
   - Completeness rate
   - Date range (if applicable)

Slide 3: Distribution Analysis
   - Price/value distribution chart
   - Category breakdown pie chart

Slide 4: Top Items
   - Top 5-10 by key metric
   - With images if available

Slide 5: Key Findings
   - 3-5 bullet points
   - Outliers, patterns, anomalies

Slide 6: Data Quality
   - Missing fields summary
   - Duplicate detection results

Slide 7: Recommendations
   - Actionable next steps
   - Data improvement suggestions
```

### Step 4.3: Chart Generation

For HTML presentations, use inline Chart.js:

```html
<canvas id="priceChart"></canvas>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
const ctx = document.getElementById('priceChart').getContext('2d');
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Electronics', 'Clothing', 'Home', 'Sports'],
    datasets: [{
      label: 'Average Price',
      data: [89.99, 45.50, 67.25, 52.00],
      backgroundColor: 'rgba(0, 255, 204, 0.6)'
    }]
  }
});
</script>
```

---

## Phase 5: Export & Delivery

### Output Options

| Format | Use Case | Command |
|--------|----------|---------|
| Excel (.xlsx) | Spreadsheet analysis | `exportToExcel(items, options)` |
| CSV | Data interchange | `exportToCSV(items)` |
| JSON | API/programmatic | `JSON.stringify(items)` |
| HTML Report | Shareable report | Generate with template |
| HTML Slides | Presentations | Use `frontend-slides` skill |
| Text | Console/logs | `generateTextReport(analysis)` |

### Chrome Extension Integration

```typescript
// Export via sidepanel
ui.exportBtn.addEventListener('click', async () => {
  const response = await sendToContentScript({ type: 'EXPORT_DATA' });
  const items = response.data as ExtractedItem[];

  // Excel with analysis
  await chrome.runtime.sendMessage({
    type: 'EXPORT_EXCEL',
    payload: { items, options: { includeAnalysis: true } }
  });

  // Or get analysis only
  const analysisResponse = await chrome.runtime.sendMessage({
    type: 'ANALYZE_DATA',
    payload: { items }
  });
  console.log(analysisResponse.data.textReport);
});
```

---

## Quick Reference

### Message Types

| Message | Payload | Response |
|---------|---------|----------|
| `EXPORT_EXCEL` | `{ items, options }` | `{ filename, rowCount }` |
| `EXPORT_CSV` | `{ items, filename }` | `{ filename, rowCount }` |
| `ANALYZE_DATA` | `{ items }` | `{ analysis, textReport }` |

### Aggregation Functions

```typescript
aggregate(items, field, func, groupBy?)
// func: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'distinct' | 'median' | 'stddev'
```

### File Locations

```
src/export/
├── index.ts           # Module exports
├── excelExporter.ts   # Excel generation (ExcelJS)
└── dataAnalysis.ts    # Statistics (simple-statistics)
```

### Dependencies

```bash
bun add exceljs simple-statistics
```

---

## Example Session Flow

1. User: "Analyze the scraped data and show me insights"
2. Skill gets data via `EXPORT_DATA` message
3. Skill runs `analyzeData(items)`
4. Skill generates text report with key findings
5. User: "Export to Excel with charts"
6. Skill calls `EXPORT_EXCEL` with `includeAnalysis: true`
7. User: "Create a presentation from this data"
8. Skill invokes `frontend-slides` skill with insights
9. Generates HTML slides with charts and findings

---

---

## Phase 6: Word Cloud Analysis

Generate word clouds from scraped text data to visualize keyword frequency and prominence.

### Step 6.1: Text Preprocessing

```typescript
interface WordCloudConfig {
  field: string;              // Field to analyze (e.g., 'text', 'imageAlt')
  minWordLength: number;      // Minimum word length (default: 2)
  maxWords: number;           // Maximum words in cloud (default: 100)
  stopWords: string[];        // Words to exclude
  language: 'vi' | 'en';      // Language for preprocessing
}

function preprocessText(text: string, config: WordCloudConfig): string[] {
  // Normalize Vietnamese diacritics
  let normalized = text.normalize('NFC');

  // Remove URLs, prices, numbers
  normalized = normalized
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/[\d.,]+₫/g, '')
    .replace(/\d+%/g, '')
    .replace(/\d+k\+?/g, '');

  // Tokenize (Vietnamese uses spaces between words)
  const words = normalized
    .toLowerCase()
    .split(/[\s,\.\-\(\)\[\]]+/)
    .filter(w => w.length >= config.minWordLength);

  // Remove stop words
  return words.filter(w => !config.stopWords.includes(w));
}
```

### Step 6.2: Vietnamese Stop Words

```typescript
const VIETNAMESE_STOP_WORDS = [
  // Common particles
  'và', 'của', 'cho', 'với', 'trong', 'từ', 'đến', 'để', 'là', 'có',
  'được', 'không', 'này', 'đó', 'như', 'cũng', 'thì', 'nên', 'khi',
  // E-commerce specific
  'sản', 'phẩm', 'tương', 'tự', 'tìm', 'mua', 'bán', 'giá', 'đã',
  'ngày', 'mai', 'hàng', 'mới', 'về', 'chính', 'hãng', 'shop',
  // Location fragments
  'tp', 'hồ', 'chí', 'minh', 'hà', 'nội', 'nước', 'ngoài',
];
```

### Step 6.3: Word Frequency Calculation

```typescript
interface WordFrequency {
  word: string;
  count: number;
  weight: number;  // Normalized 0-1
}

function calculateWordFrequency(
  items: ExtractedItem[],
  config: WordCloudConfig
): WordFrequency[] {
  const wordCounts = new Map<string, number>();

  for (const item of items) {
    const text = item[config.field] as string || '';
    const words = preprocessText(text, config);

    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  // Sort by frequency
  const sorted = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, config.maxWords);

  // Normalize weights
  const maxCount = sorted[0]?.[1] || 1;

  return sorted.map(([word, count]) => ({
    word,
    count,
    weight: count / maxCount,
  }));
}
```

### Step 6.4: Generate Word Cloud HTML

```typescript
function generateWordCloudHTML(frequencies: WordFrequency[]): string {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];

  const wordElements = frequencies.map((f, i) => {
    const fontSize = 12 + Math.floor(f.weight * 48);
    const color = colors[i % colors.length];
    const rotation = Math.random() > 0.7 ? 'transform: rotate(-15deg);' : '';

    return `<span style="font-size: ${fontSize}px; color: ${color};
      padding: 4px 8px; display: inline-block; ${rotation}">${f.word}</span>`;
  }).join('\n');

  return `
    <div class="word-cloud" style="
      display: flex; flex-wrap: wrap; gap: 8px;
      justify-content: center; align-items: center;
      padding: 24px; background: #1a1a2e; border-radius: 12px;
    ">
      ${wordElements}
    </div>
  `;
}
```

### Step 6.5: Word Cloud Chart.js Integration

```html
<canvas id="wordCloudChart"></canvas>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-chart-wordcloud"></script>
<script>
const ctx = document.getElementById('wordCloudChart').getContext('2d');
new Chart(ctx, {
  type: 'wordCloud',
  data: {
    labels: ['Son', 'Môi', 'Lì', 'Mịn', 'Dưỡng', 'Ẩm', 'Màu', 'Hồng'],
    datasets: [{
      data: [80, 70, 60, 55, 50, 45, 40, 35],
      color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4']
    }]
  }
});
</script>
```

---

## Phase 7: Sentiment Analysis

Analyze product descriptions to detect marketing sentiment, quality indicators, and buyer confidence signals.

### Step 7.1: Sentiment Lexicon (Vietnamese E-commerce)

```typescript
interface SentimentLexicon {
  positive: Map<string, number>;  // word -> weight (0-1)
  negative: Map<string, number>;
  intensifiers: string[];
  negators: string[];
}

const VIETNAMESE_ECOMMERCE_LEXICON: SentimentLexicon = {
  positive: new Map([
    // Quality indicators
    ['chính hãng', 1.0], ['cao cấp', 0.9], ['siêu', 0.8], ['hoàn hảo', 0.9],
    ['mịn', 0.7], ['mượt', 0.7], ['mềm', 0.6], ['nhẹ', 0.5], ['tốt', 0.7],
    // Benefit words
    ['dưỡng', 0.6], ['ẩm', 0.5], ['căng', 0.6], ['mọng', 0.7], ['trắng', 0.5],
    // Trust signals
    ['bán chạy', 0.8], ['hot', 0.7], ['yêu thích', 0.8], ['xinh', 0.6],
    // Performance
    ['lâu trôi', 0.8], ['bền màu', 0.8], ['không dính', 0.7], ['chống nước', 0.7],
  ]),
  negative: new Map([
    ['lỗi', -0.9], ['hỏng', -0.8], ['kém', -0.7], ['xấu', -0.6],
    ['phai', -0.5], ['trôi', -0.4], ['khô', -0.4], ['nứt', -0.6],
  ]),
  intensifiers: ['siêu', 'cực', 'rất', 'quá', 'vô cùng'],
  negators: ['không', 'chẳng', 'chưa', 'đừng'],
};
```

### Step 7.2: Sentiment Score Calculation

```typescript
interface SentimentResult {
  score: number;        // -1 to 1
  label: 'positive' | 'neutral' | 'negative';
  confidence: number;   // 0 to 1
  signals: SentimentSignal[];
}

interface SentimentSignal {
  text: string;
  type: 'positive' | 'negative' | 'intensifier' | 'negator';
  weight: number;
}

function analyzeSentiment(
  text: string,
  lexicon: SentimentLexicon
): SentimentResult {
  const normalized = text.toLowerCase().normalize('NFC');
  const signals: SentimentSignal[] = [];
  let totalScore = 0;
  let matchCount = 0;

  // Check positive words
  for (const [word, weight] of lexicon.positive) {
    if (normalized.includes(word)) {
      signals.push({ text: word, type: 'positive', weight });
      totalScore += weight;
      matchCount++;
    }
  }

  // Check negative words
  for (const [word, weight] of lexicon.negative) {
    if (normalized.includes(word)) {
      signals.push({ text: word, type: 'negative', weight });
      totalScore += weight;  // Already negative
      matchCount++;
    }
  }

  // Apply intensifiers (boost by 30%)
  for (const intensifier of lexicon.intensifiers) {
    if (normalized.includes(intensifier)) {
      totalScore *= 1.3;
      signals.push({ text: intensifier, type: 'intensifier', weight: 0.3 });
    }
  }

  // Apply negators (flip sentiment)
  for (const negator of lexicon.negators) {
    const pattern = new RegExp(`${negator}\\s+\\w+`, 'g');
    if (pattern.test(normalized)) {
      totalScore *= -0.5;
      signals.push({ text: negator, type: 'negator', weight: -0.5 });
    }
  }

  // Normalize score to -1 to 1
  const normalizedScore = Math.max(-1, Math.min(1, totalScore / Math.max(matchCount, 1)));

  return {
    score: normalizedScore,
    label: normalizedScore > 0.2 ? 'positive' : normalizedScore < -0.2 ? 'negative' : 'neutral',
    confidence: matchCount / 10,  // More matches = higher confidence
    signals,
  };
}
```

### Step 7.3: Batch Sentiment Analysis

```typescript
interface SentimentSummary {
  overall: SentimentResult;
  distribution: { positive: number; neutral: number; negative: number };
  topPositiveSignals: string[];
  topNegativeSignals: string[];
  averageConfidence: number;
}

function analyzeBatchSentiment(
  items: ExtractedItem[],
  field: string,
  lexicon: SentimentLexicon
): SentimentSummary {
  const results = items.map(item =>
    analyzeSentiment(item[field] as string || '', lexicon)
  );

  const distribution = {
    positive: results.filter(r => r.label === 'positive').length,
    neutral: results.filter(r => r.label === 'neutral').length,
    negative: results.filter(r => r.label === 'negative').length,
  };

  // Aggregate signals
  const signalCounts = new Map<string, number>();
  for (const result of results) {
    for (const signal of result.signals) {
      const key = `${signal.type}:${signal.text}`;
      signalCounts.set(key, (signalCounts.get(key) || 0) + 1);
    }
  }

  const sortedSignals = [...signalCounts.entries()].sort((a, b) => b[1] - a[1]);

  return {
    overall: {
      score: results.reduce((sum, r) => sum + r.score, 0) / results.length,
      label: distribution.positive > distribution.negative ? 'positive' :
             distribution.negative > distribution.positive ? 'negative' : 'neutral',
      confidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
      signals: [],
    },
    distribution,
    topPositiveSignals: sortedSignals
      .filter(([k]) => k.startsWith('positive:'))
      .slice(0, 5)
      .map(([k]) => k.split(':')[1]),
    topNegativeSignals: sortedSignals
      .filter(([k]) => k.startsWith('negative:'))
      .slice(0, 5)
      .map(([k]) => k.split(':')[1]),
    averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length,
  };
}
```

### Step 7.4: Sentiment Visualization

```typescript
function generateSentimentChart(summary: SentimentSummary): string {
  const total = summary.distribution.positive +
                summary.distribution.neutral +
                summary.distribution.negative;

  return `
    <div class="sentiment-dashboard">
      <h3>Sentiment Analysis</h3>

      <!-- Overall Score Gauge -->
      <div class="gauge" style="text-align: center; padding: 20px;">
        <div style="font-size: 48px; font-weight: bold;
          color: ${summary.overall.score > 0 ? '#4CAF50' : summary.overall.score < 0 ? '#F44336' : '#FFC107'}">
          ${(summary.overall.score * 100).toFixed(0)}%
        </div>
        <div style="font-size: 14px; color: #888;">
          ${summary.overall.label.toUpperCase()} SENTIMENT
        </div>
      </div>

      <!-- Distribution Bar -->
      <div class="distribution-bar" style="display: flex; height: 24px; border-radius: 12px; overflow: hidden;">
        <div style="width: ${summary.distribution.positive / total * 100}%; background: #4CAF50;"></div>
        <div style="width: ${summary.distribution.neutral / total * 100}%; background: #FFC107;"></div>
        <div style="width: ${summary.distribution.negative / total * 100}%; background: #F44336;"></div>
      </div>

      <!-- Legend -->
      <div style="display: flex; justify-content: space-around; margin-top: 12px;">
        <span>✓ Positive: ${summary.distribution.positive}</span>
        <span>○ Neutral: ${summary.distribution.neutral}</span>
        <span>✗ Negative: ${summary.distribution.negative}</span>
      </div>

      <!-- Top Signals -->
      <div style="margin-top: 20px;">
        <h4>Top Positive Signals</h4>
        <ul>${summary.topPositiveSignals.map(s => `<li>${s}</li>`).join('')}</ul>
      </div>
    </div>
  `;
}
```

---

## Phase 8: Thematic Analysis

Discover themes, categories, and patterns in scraped data through clustering and topic modeling.

### Step 8.1: Theme Extraction Rules

```typescript
interface ThemeRule {
  name: string;
  patterns: RegExp[];
  keywords: string[];
  priority: number;
}

const COSMETIC_THEMES: ThemeRule[] = [
  {
    name: 'Matte/Lì',
    patterns: [/l[ìi]\s*(m[ềe]m)?/i, /matte/i, /velvet/i],
    keywords: ['lì', 'matte', 'velvet', 'nhung'],
    priority: 1,
  },
  {
    name: 'Moisturizing/Dưỡng Ẩm',
    patterns: [/d[ưu][ỡo]ng\s*[ẩa]m/i, /m[ềe]m\s*m[ịi]n/i],
    keywords: ['dưỡng', 'ẩm', 'mềm', 'mịn', 'mượt'],
    priority: 2,
  },
  {
    name: 'Long-lasting/Lâu Trôi',
    patterns: [/l[aâ]u\s*tr[oô]i/i, /b[ềe]n\s*m[àa]u/i, /ch[ốo]ng\s*n[ưu][ớo]c/i],
    keywords: ['lâu trôi', 'bền màu', 'chống nước', 'không dính'],
    priority: 3,
  },
  {
    name: 'Korean/Hàn Quốc',
    patterns: [/h[àa]n\s*qu[ốo]c/i, /romand/i, /3ce/i],
    keywords: ['hàn quốc', 'romand', '3ce', 'korean'],
    priority: 4,
  },
  {
    name: 'Premium/Cao Cấp',
    patterns: [/cao\s*c[ấa]p/i, /ch[íi]nh\s*h[ãa]ng/i, /ysl|mac|nars|dior/i],
    keywords: ['cao cấp', 'chính hãng', 'luxury', 'premium'],
    priority: 5,
  },
  {
    name: 'Budget/Giá Rẻ',
    patterns: [/gi[áa]\s*r[ẻe]/i, /sale/i, /gi[ảa]m/i],
    keywords: ['giá rẻ', 'sale', 'giảm giá', 'khuyến mãi'],
    priority: 6,
  },
];
```

### Step 8.2: Theme Detection

```typescript
interface ThemeMatch {
  theme: string;
  matchCount: number;
  matchedKeywords: string[];
  items: ExtractedItem[];
}

function detectThemes(
  items: ExtractedItem[],
  field: string,
  rules: ThemeRule[]
): ThemeMatch[] {
  const themeMatches = new Map<string, ThemeMatch>();

  for (const item of items) {
    const text = (item[field] as string || '').toLowerCase();

    for (const rule of rules) {
      let matched = false;
      const matchedKeywords: string[] = [];

      // Check patterns
      for (const pattern of rule.patterns) {
        if (pattern.test(text)) {
          matched = true;
          break;
        }
      }

      // Check keywords
      for (const keyword of rule.keywords) {
        if (text.includes(keyword)) {
          matched = true;
          matchedKeywords.push(keyword);
        }
      }

      if (matched) {
        const existing = themeMatches.get(rule.name) || {
          theme: rule.name,
          matchCount: 0,
          matchedKeywords: [],
          items: [],
        };

        existing.matchCount++;
        existing.matchedKeywords.push(...matchedKeywords);
        existing.items.push(item);
        themeMatches.set(rule.name, existing);
      }
    }
  }

  return [...themeMatches.values()].sort((a, b) => b.matchCount - a.matchCount);
}
```

### Step 8.3: Brand Extraction

```typescript
interface BrandInfo {
  name: string;
  count: number;
  avgPrice?: number;
  avgRating?: number;
}

const KNOWN_BRANDS = [
  'romand', '3ce', 'mac', 'ysl', 'nars', 'dior', 'chanel',
  'maybelline', 'loreal', 'innisfree', 'etude', 'peripera',
  'herorange', 'firin', 'beana', 'pinkcoco', 'gegebear',
  'm.o.i', 'embisu', 'kiko',
];

function extractBrands(items: ExtractedItem[], textField: string): BrandInfo[] {
  const brandCounts = new Map<string, ExtractedItem[]>();

  for (const item of items) {
    const text = (item[textField] as string || '').toLowerCase();

    for (const brand of KNOWN_BRANDS) {
      if (text.includes(brand)) {
        const existing = brandCounts.get(brand) || [];
        existing.push(item);
        brandCounts.set(brand, existing);
      }
    }
  }

  return [...brandCounts.entries()]
    .map(([name, brandItems]) => ({
      name,
      count: brandItems.length,
      // Extract price if available
      avgPrice: calculateAvgPrice(brandItems),
      avgRating: calculateAvgRating(brandItems),
    }))
    .sort((a, b) => b.count - a.count);
}

function calculateAvgPrice(items: ExtractedItem[]): number | undefined {
  const prices = items
    .map(item => {
      const text = item.text as string || '';
      const match = text.match(/([\d.,]+)₫/);
      return match ? parseFloat(match[1].replace(/\./g, '').replace(',', '.')) : null;
    })
    .filter((p): p is number => p !== null);

  return prices.length > 0
    ? prices.reduce((a, b) => a + b, 0) / prices.length
    : undefined;
}
```

### Step 8.4: Thematic Analysis Report

```typescript
interface ThematicReport {
  themes: ThemeMatch[];
  brands: BrandInfo[];
  priceSegments: { segment: string; count: number; range: string }[];
  locationDistribution: { location: string; count: number }[];
}

function generateThematicReport(items: ExtractedItem[]): ThematicReport {
  const themes = detectThemes(items, 'text', COSMETIC_THEMES);
  const brands = extractBrands(items, 'text');

  // Price segmentation
  const priceSegments = [
    { segment: 'Budget (<50k)', count: 0, range: '< 50,000₫' },
    { segment: 'Mid-range (50k-200k)', count: 0, range: '50,000₫ - 200,000₫' },
    { segment: 'Premium (200k-500k)', count: 0, range: '200,000₫ - 500,000₫' },
    { segment: 'Luxury (>500k)', count: 0, range: '> 500,000₫' },
  ];

  for (const item of items) {
    const price = extractPrice(item.text as string);
    if (price !== null) {
      if (price < 50000) priceSegments[0].count++;
      else if (price < 200000) priceSegments[1].count++;
      else if (price < 500000) priceSegments[2].count++;
      else priceSegments[3].count++;
    }
  }

  // Location distribution
  const locations = new Map<string, number>();
  const LOCATION_PATTERNS = [
    'Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Bắc Ninh',
    'Hưng Yên', 'Đồng Nai', 'Nước ngoài'
  ];

  for (const item of items) {
    const text = item.text as string || '';
    for (const loc of LOCATION_PATTERNS) {
      if (text.includes(loc)) {
        locations.set(loc, (locations.get(loc) || 0) + 1);
      }
    }
  }

  return {
    themes,
    brands,
    priceSegments,
    locationDistribution: [...locations.entries()]
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count),
  };
}
```

### Step 8.5: Thematic Visualization

```html
<!-- Theme Treemap -->
<div id="themeTreemap"></div>
<script>
const themeData = {
  name: 'Themes',
  children: [
    { name: 'Matte/Lì', value: 85, color: '#FF6B6B' },
    { name: 'Moisturizing', value: 62, color: '#4ECDC4' },
    { name: 'Long-lasting', value: 54, color: '#45B7D1' },
    { name: 'Korean', value: 38, color: '#96CEB4' },
    { name: 'Premium', value: 25, color: '#FFEAA7' },
    { name: 'Budget', value: 42, color: '#DDA0DD' },
  ]
};

// Render with D3.js treemap or Chart.js
</script>

<!-- Brand Pie Chart -->
<canvas id="brandChart"></canvas>
<script>
new Chart(document.getElementById('brandChart'), {
  type: 'doughnut',
  data: {
    labels: ['Romand', '3CE', 'Herorange', 'MAC', 'Others'],
    datasets: [{
      data: [28, 18, 15, 12, 27],
      backgroundColor: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#CCC']
    }]
  }
});
</script>
```

---

## Phase 9: Combined Text Analysis Dashboard

### Step 9.1: Full Analysis Pipeline

```typescript
interface FullTextAnalysis {
  wordCloud: WordFrequency[];
  sentiment: SentimentSummary;
  thematic: ThematicReport;
  metadata: {
    totalItems: number;
    analyzedAt: string;
    dataSource: string;
  };
}

async function runFullTextAnalysis(
  items: ExtractedItem[],
  config: {
    textField: string;
    language: 'vi' | 'en';
    dataSource?: string;
  }
): Promise<FullTextAnalysis> {
  const wordCloudConfig: WordCloudConfig = {
    field: config.textField,
    minWordLength: 2,
    maxWords: 100,
    stopWords: config.language === 'vi' ? VIETNAMESE_STOP_WORDS : [],
    language: config.language,
  };

  return {
    wordCloud: calculateWordFrequency(items, wordCloudConfig),
    sentiment: analyzeBatchSentiment(items, config.textField, VIETNAMESE_ECOMMERCE_LEXICON),
    thematic: generateThematicReport(items),
    metadata: {
      totalItems: items.length,
      analyzedAt: new Date().toISOString(),
      dataSource: config.dataSource || 'unknown',
    },
  };
}
```

### Step 9.2: Dashboard HTML Template

```typescript
function generateTextAnalysisDashboard(analysis: FullTextAnalysis): string {
  return `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Text Analysis Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background: #0f0f23; color: #fff; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; padding: 24px; }
    .card { background: #1a1a2e; border-radius: 12px; padding: 24px; }
    .card h3 { margin-top: 0; color: #00ffc8; }
  </style>
</head>
<body>
  <h1 style="text-align: center; padding: 24px;">📊 Text Analysis: ${analysis.metadata.dataSource}</h1>
  <p style="text-align: center; color: #888;">
    ${analysis.metadata.totalItems} items analyzed • ${analysis.metadata.analyzedAt}
  </p>

  <div class="grid">
    <!-- Word Cloud -->
    <div class="card">
      <h3>☁️ Word Cloud</h3>
      ${generateWordCloudHTML(analysis.wordCloud)}
    </div>

    <!-- Sentiment -->
    <div class="card">
      <h3>💬 Sentiment Analysis</h3>
      ${generateSentimentChart(analysis.sentiment)}
    </div>

    <!-- Themes -->
    <div class="card">
      <h3>🏷️ Thematic Breakdown</h3>
      <ul>
        ${analysis.thematic.themes.slice(0, 6).map(t =>
          `<li><strong>${t.theme}</strong>: ${t.matchCount} items</li>`
        ).join('')}
      </ul>
    </div>

    <!-- Brands -->
    <div class="card">
      <h3>🏢 Brand Distribution</h3>
      <canvas id="brandChart"></canvas>
    </div>
  </div>

  <script>
    new Chart(document.getElementById('brandChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(analysis.thematic.brands.slice(0, 8).map(b => b.name))},
        datasets: [{
          label: 'Products',
          data: ${JSON.stringify(analysis.thematic.brands.slice(0, 8).map(b => b.count))},
          backgroundColor: '#00ffc8'
        }]
      },
      options: { indexAxis: 'y' }
    });
  </script>
</body>
</html>
  `;
}
```

---

## Quick Reference: Text Analysis Commands

| Analysis | Function | Output |
|----------|----------|--------|
| Word Cloud | `calculateWordFrequency(items, config)` | `WordFrequency[]` |
| Sentiment | `analyzeBatchSentiment(items, field, lexicon)` | `SentimentSummary` |
| Themes | `detectThemes(items, field, rules)` | `ThemeMatch[]` |
| Brands | `extractBrands(items, field)` | `BrandInfo[]` |
| Full Analysis | `runFullTextAnalysis(items, config)` | `FullTextAnalysis` |
| Dashboard | `generateTextAnalysisDashboard(analysis)` | HTML string |

---

## Example Session: Text Analysis

1. User: "Analyze the sentiment of scraped product descriptions"
2. Skill loads CSV data from file
3. Skill runs `analyzeBatchSentiment(items, 'text', VIETNAMESE_ECOMMERCE_LEXICON)`
4. Returns sentiment distribution: 78% positive, 18% neutral, 4% negative
5. User: "Generate a word cloud"
6. Skill runs `calculateWordFrequency(items, config)`
7. Returns top words: Son (182), Lì (98), Mịn (76), Dưỡng (65)...
8. User: "Show me the full text analysis dashboard"
9. Skill runs `runFullTextAnalysis()` and generates HTML dashboard
10. Opens interactive dashboard with all visualizations

---

## Related Skills

- **frontend-slides** — Create visual presentations from insights
- **frontend-design** — Build custom dashboards for data
