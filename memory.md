# Web Scraper Pro - Project Memory

**GitHub:** https://github.com/David-Hoa2023/web-scraper

## Overview

Chrome Extension (Manifest V3) for web scraping with data analysis and Excel export.

## Key Features

- **Scraping:** Pattern detection with locking, auto-scroll, SPA navigation support
- **Preview:** Visual cards with image thumbnails + text
- **Export:** JSON, CSV, Excel (.xlsx) with analysis sheet
- **Analysis:** Statistics, aggregations, pivot tables, pattern detection
- **Scheduling:** Background tasks with webhooks

## Architecture

| Layer | Components |
|-------|------------|
| Content | `patternDetector`, `autoScroller`, `dataExtractor` |
| UI | `sidepanel` (dashboard, preview cards, settings) |
| Background | `service-worker` (scheduler, export, webhooks) |
| Export | `src/export/` (ExcelJS + simple-statistics) |

## Commands

```bash
bun install && bun run build
bun run typecheck && bun run test
```

## Claude Code Skills

| Skill | Purpose |
|-------|---------|
| `scraper-data-analysis` | Analyze data, generate insights, create reports |
| `frontend-slides` | Create HTML presentations from data |

## Key APIs

```typescript
// Export
await exportToExcel(items, { includeAnalysis: true });

// Analysis
const analysis = analyzeData(items);
const totals = aggregate(items, 'price', 'sum', 'category');
```

## Message Types

- `EXPORT_EXCEL` / `EXPORT_CSV` - Export data
- `ANALYZE_DATA` - Get statistics without export
- `UPDATE_PREVIEW` - Send preview to sidepanel
