# Web Scraper Pro - Project Memory

**GitHub:** https://github.com/David-Hoa2023/web-scraper

## Overview

Chrome Extension (Manifest V3) for web scraping + tutorial generation. Records browser interactions and auto-generates instructional guides using LLM.

## Key Features

- **Scraping:** Pattern detection, auto-scroll, JSON/CSV export
- **Tutorial Generation:** DOM event capture, video recording, cursor tracking, LLM content generation
- **Scheduled Tasks:** Background scheduler with chrome.alarms, webhook notifications
- **UI:** Stitch design system, task wizard, webhooks panel

## Architecture

| Layer | Components |
|-------|------------|
| Content | `patternDetector`, `autoScroller`, `recorder/*`, `tutorial/*` |
| UI | `popup`, `overlay`, `recordingPanel`, `settingsPanel` |
| Background | `service-worker` (scheduler, task execution, webhooks) |

## Commands

```bash
bun install && bun run build
bun run typecheck && bun run lint
bun run test
```

## Build Notes

- Post-build script (`scripts/post-build.js`) fixes content script for Chrome compatibility
- Removes `import.meta.url` and ES module exports (not allowed in content scripts)
- Copies manifest.json and icons to dist/

## Documentation

- `docs/use-cases.md` - User stories and step-by-step guides
- `docs/STITCH_UI_MAPPING.md` - UI component mapping to Stitch designs
- `docs/backlog/` - Feature backlogs and demo gaps plan

## Recent Updates (Jan 2026)

- **UI Unification:** Merged Popup and Overlay into a single **Chrome Side Panel**. Removed `overlay.ts` and updated `manifest.json`.
- **Pattern Detection:**
  - Enhanced with **Fuzzy Matching** (Jaccard similarity > 0.3) for dynamic classes.
  - Implemented **Deep Traversal** (depth 5) with "Best Match" prioritization.
  - **Status:** working for single items, but "List Detection" still failing on complex sites like Shopee (see `docs/lesson.md`).
