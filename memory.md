# Web Scraper Pro - Project Memory

## Project Status: v2.0 - Hexus Integration Complete

**GitHub:** https://github.com/David-Hoa2023/web-scraper

## Overview

Chrome Extension (Manifest V3) for web scraping + tutorial generation. Records browser interactions and auto-generates instructional guides using LLM.

## Key Features

**Scraping (v1.0):**
- Hover detection with pattern highlighting
- Auto-scroll with retry logic
- JSON data export

**Tutorial Generation (v2.0 - Hexus):**
- DOM event capture (click, input, scroll, keypress)
- Screen video recording via MediaRecorder
- Cursor tracking with Bezier smoothing
- LLM content generation (OpenAI/Anthropic/custom)
- Export: Markdown, PDF (jsPDF), Video with cursor overlay

## Architecture

| Layer | Components |
|-------|------------|
| Content | Pattern detection, auto-scroller, recorder (DOM + video + cursor), tutorial generator |
| UI | Overlay, recording panel, tutorial preview, settings panel |
| Types | `recording.ts`, `tutorial.ts` |

## New Modules (v2.0)

```
src/content/recorder/       # Capture orchestration
src/content/tutorial/       # LLM + exporters
src/content/patternRefinement.ts
src/ui/recordingPanel.ts
src/ui/tutorialPreview.ts
src/ui/settingsPanel.ts
```

## Commands

```bash
bun install && bun run build
bun run typecheck && bun run lint
```

## Commits

- `d32649c` Stages 0-3 (types, DOM logger, cursor, video)
- `3a9b190` Stages 4, 7-8 (orchestrator, LLM, exports)
- `860c829` Stages 5-6, 9-10 (pattern refinement, UI)

## Stitch UI Implementation (v2.1)

**Phase 1-2: Complete**
- Updated `styles.css` with Stitch color palette (`#13ec5b`, `#102216`, `#f6f8f6`)
- Implemented Space Grotesk font throughout
- Sidebar + header layouts in popup
- Overlay updated with Extraction Wizard design

**Phase 3: Complete**
- Dashboard: 3-column stats (Total Tasks, Success Rate, Items Collected)
- Dashboard: Scheduled Tasks table with play/pause controls
- Settings: Webhooks & Integrations section (URL, toggles, test button)
- Task Creation Wizard (3 steps: General, Schedule, Export)
- History tab with pagination

See `docs/STITCH_UI_MAPPING.md` for design reference mapping.
