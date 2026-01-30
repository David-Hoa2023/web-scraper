# Web Scraper Pro - Project Memory

**GitHub:** https://github.com/David-Hoa2023/web-scraper

## Overview

Chrome Extension (Manifest V3) for web scraping with AI-powered analysis and multi-format export.

## Key Features

- **Scraping:** Pattern detection, auto-scroll, SPA support, templates
- **AI Analysis:** LLM integration (OpenAI, Anthropic, Gemini, DeepSeek) for data insights
- **Export:** JSON, CSV, Excel (with analysis sheet)
- **Arbitrage:** Cross-platform price comparison for 6 e-commerce sites

## Architecture

| Layer | Purpose |
|-------|---------|
| Content Scripts | Pattern detection, auto-scroll, data extraction |
| Sidepanel UI | Dashboard, extraction settings, templates, AI analysis |
| Service Worker | Message routing, export handlers, scheduler |
| Services | LLM gateway, price comparison, trend detection |

## Commands

```bash
bun install && bun run build
bun run typecheck && bun run test
```

## LLM Settings

- Per-provider API key storage (each provider has its own key)
- Supported: OpenAI, Anthropic, Gemini, DeepSeek
- AI Analysis in Extraction tab generates insights & recommendations

## Export Flow

- Service worker generates file data (base64)
- Sidepanel handles download via `chrome.downloads` API
- Supports JSON, CSV, Excel formats

## Key Files

| File | Purpose |
|------|---------|
| `src/ui/sidepanel.ts` | Main UI logic |
| `src/background/service-worker.ts` | Message handlers, export |
| `src/services/llmAnalysis.ts` | LLM-powered data analysis |
| `src/services/llmGateway.ts` | Multi-provider LLM client |

## Documentation

- `CLAUDE.md` - Build commands & architecture
- `docs/lesson.md` - Debugging lessons learned
- `docs/use-cases.md` - User stories (Vietnamese)
