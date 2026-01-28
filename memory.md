# Web Scraper Pro - Project Memory

**GitHub:** https://github.com/David-Hoa2023/web-scraper

## Overview

Chrome Extension (Manifest V3) for web scraping + tutorial generation. Records browser interactions and auto-generates instructional guides using LLM.

## Key Features

- **Scraping:** Pattern detection with locking, auto-scroll, JSON/CSV export
- **Preview:** Visual cards with image thumbnails + text
- **Scheduled Tasks:** Background scheduler with chrome.alarms, webhook notifications
- **UI:** Chrome Side Panel with Stitch design system

## Architecture

| Layer | Components |
|-------|------------|
| Content | `patternDetector`, `autoScroller`, `dataExtractor` |
| UI | `sidepanel` (dashboard, settings, history, preview cards) |
| Background | `service-worker` (scheduler, message forwarding, webhooks) |

## Commands

```bash
bun install && bun run build
bun run typecheck && bun run lint
bun run test
```

## Build Notes

- Post-build script fixes content script for Chrome compatibility
- Copies manifest.json and icons to dist/

## Documentation

- `docs/use-cases.md` - User stories and guides
- `docs/lesson.md` - Pattern detection lessons learned

## Recent Updates (Jan 2026)

- **Side Panel UI:** Full-height panel with preview cards showing images + text
- **Pattern Locking:** Click to lock pattern, then freely click Start Scanning
- **SPA Navigation:** Pattern detection works across paginated pages
- **Message Forwarding:** Service worker forwards preview updates to sidepanel
