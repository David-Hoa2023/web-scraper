# Web Scraper Pro - Project Memory

**GitHub:** https://github.com/David-Hoa2023/web-scraper

## Overview

Chrome Extension (Manifest V3) for web scraping with data analysis, visualization, and Excel export.

## Key Features

- **Scraping:** Pattern detection, auto-scroll, SPA support
- **Analysis:** Statistics, aggregations, insights extraction
- **Export:** JSON, CSV, Excel with analysis sheet
- **Visualization:** HTML reports with Chart.js

## Architecture

| Layer | Components |
|-------|------------|
| Content | `patternDetector`, `autoScroller`, `dataExtractor` |
| UI | `sidepanel` (dashboard, preview, settings) |
| Background | `service-worker` (scheduler, export) |
| Export | `src/export/` (ExcelJS + simple-statistics) |

## Commands

```bash
bun install && bun run build
bun run typecheck && bun run test
```

## Claude Code Skills

| Skill | Purpose |
|-------|---------|
| `scraper-data-analysis` | Text analysis (word cloud, sentiment, themes), statistics & reports |
| `frontend-slides` | Create HTML presentations from data |

### Text Analysis Capabilities (New)

| Analysis | Description |
|----------|-------------|
| **Word Cloud** | Vietnamese text preprocessing, stop words, frequency visualization |
| **Sentiment** | E-commerce lexicon (30+ terms), intensifiers/negators, batch scoring |
| **Thematic** | 6 theme rules, brand extraction (20+ brands), price/location segmentation |
| **Dashboard** | Combined HTML dashboard with Chart.js visualizations |

## Documentation

| Doc | Description |
|-----|-------------|
| `docs/use-cases.md` | User stories & pain points (Vietnamese) |
| `CLAUDE.md` | Build commands & architecture reference |

## Recent Updates

- **Text Analysis Skill** - Word cloud, sentiment analysis, thematic analysis with Vietnamese NLP support
- Vietnamese user stories covering 8 use cases (scraping, analysis, visualization)
- HTML report generator with Chart.js (dark mode, responsive)
- Shopee e-commerce data analysis example
