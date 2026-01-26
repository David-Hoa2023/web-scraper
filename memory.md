# Web Scraper Pro - Project Memory

**GitHub:** https://github.com/David-Hoa2023/web-scraper

## Overview

Chrome Extension (Manifest V3) for web scraping + tutorial generation. Records browser interactions and auto-generates instructional guides using LLM.

## Key Features

- **Scraping:** Pattern detection, auto-scroll, JSON/CSV export
- **Tutorial Generation:** DOM event capture, video recording, cursor tracking, LLM content generation
- **UI:** Stitch design system, task wizard, webhooks, scheduled tasks

## Architecture

| Layer | Components |
|-------|------------|
| Content | `patternDetector`, `autoScroller`, `recorder/*`, `tutorial/*` |
| UI | `popup`, `overlay`, `recordingPanel`, `settingsPanel` |
| Background | `service-worker` (message routing) |

## Commands

```bash
bun install && bun run build
bun run typecheck && bun run lint
bun run test
```

## Design Reference

See `docs/STITCH_UI_MAPPING.md` for UI component mapping to Stitch designs.
