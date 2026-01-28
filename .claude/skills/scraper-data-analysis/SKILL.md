---
name: scraper-data-analysis
description: Analyzes scraped web data, extracts key insights, and generates reports/presentations. Use when the user wants to analyze scraped data, create Excel reports, generate statistics, visualize insights, or create presentations from data.
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

## Related Skills

- **frontend-slides** — Create visual presentations from insights
- **frontend-design** — Build custom dashboards for data
