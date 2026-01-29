# Web Scraper Pro - Project Memory

**GitHub:** https://github.com/David-Hoa2023/web-scraper

## Overview

Chrome Extension (Manifest V3) for web scraping with AI-powered pattern detection, data analysis, and visualization.

## Key Features

- **Scraping:** Pattern detection, auto-scroll, SPA support, ON/OFF toggle
- **AI:** LLM-powered pattern detection, voiceover, multi-provider gateway
- **Analysis:** Statistics, aggregations, insights extraction
- **Export:** JSON, CSV, Excel with analysis sheet
- **Visualization:** HTML reports with Chart.js

## Architecture

| Layer | Components |
|-------|------------|
| Content | `patternDetector`, `aiPatternDetector`, `autoScroller`, `dataExtractor` |
| UI | `sidepanel` (dashboard, preview, settings, master toggle) |
| Background | `service-worker` (scheduler, export) |
| Core | `eventBus`, `jobQueue`, `storageManager` |
| Services | `llmGateway`, `voiceover` |
| Utils | `encryption`, `rateLimiter`, `redaction`, `retry` |

## Commands

```bash
bun install && bun run build
bun run typecheck && bun run test
```

## Claude Code Skills

| Skill | Purpose |
|-------|---------|
| `scraper-data-analysis` | Analyze CSV/JSON, generate insights & reports |
| `frontend-slides` | Create HTML presentations from data |

## Documentation

| Doc | Description |
|-----|-------------|
| `docs/use-cases.md` | User stories & pain points (Vietnamese) |
| `docs/BLUEPRINT-ai-phase1.md` | AI features roadmap |
| `CLAUDE.md` | Build commands & architecture reference |

## E-Commerce Arbitrage Module

**Supported Platforms:** Temu, Shein, AliExpress, Shopee, Lazada, TikTok Shop

| Component | Purpose |
|-----------|---------|
| `extractors/platformConfigs` | Platform-specific field extractors |
| `extractors/index` | Auto-detection & product extraction |
| `services/priceComparison` | Cross-platform matching (Jaccard similarity) |
| `services/trendDetection` | Price trends (linear regression, Z-score) |
| `services/arbitrageAnalyzer` | Opportunity detection & AI analysis |

**Features:**
- Platform auto-detection from URL
- Product extraction (title, price, image, rating, sales)
- Cross-platform price comparison & matching
- Profit margin calculations
- Price trend analysis & anomaly detection
- AI-powered opportunity recommendations (buy/hold/avoid)

## Recent Updates

- **E-commerce arbitrage** for 6 platforms with price comparison & trend analysis
- Master ON/OFF toggle in sidepanel sidebar
- AI pattern detector with LLM integration
- Core infrastructure (eventBus, jobQueue, storageManager)
- i18n internationalization support
- Removed legacy popup/overlay (sidepanel-only architecture)
- Vietnamese user stories and HTML report generator
