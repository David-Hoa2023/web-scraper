# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Extension (Manifest V3) web scraper that detects repeating DOM patterns on a page, auto-scrolls to load more content, and extracts data. It runs client-side by injecting a content script into the active tab.

## Build & Development Commands

```bash
# Install dependencies
bun install

# Development build
bun run dev

# Production build (TypeScript compile + Vite build + copy manifest)
bun run build

# Type checking only
bun run typecheck

# Linting
bun run lint

# Run tests
bun run test

# Run tests in watch mode
bun run test:watch
```

## Loading the Extension

After running `bun run build`, load the `dist/` folder as an unpacked extension in Chrome:
1. Navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` directory

## Architecture

### Entry Points (configured in vite.config.ts)

- **Content Script** (`src/content/index.ts` → `dist/content.js`): Injected into every page. Initializes pattern detection on mouseover events.
- **Service Worker** (`src/background/service-worker.ts` → `dist/service-worker.js`): Handles Chrome extension lifecycle and message routing between popup and content scripts.
- **Popup** (`src/ui/popup.html` + `src/ui/popup.ts`): Extension popup UI for controlling scraping operations.

### Core Modules

| Module | Purpose |
|--------|---------|
| `src/content/patternDetector.ts` | Detects repeating sibling elements by matching tag, class, id, data-*, or aria-* attributes. Highlights matches with an overlay. |
| `src/content/autoScroller.ts` | Throttled scrolling with MutationObserver integration, retry logic with exponential backoff, and automatic "load more" button detection. |
| `src/content/dataExtractor.ts` | Extracts data using configurable field selectors or heuristic detection (auto-detects images, links, headings, text). |
| `src/content/shadowDomHandler.ts` | Utilities for traversing Shadow DOM boundaries and extracting content from web components. |
| `src/ui/overlay.ts` | In-page control panel using Shadow DOM isolation. Displays progress, status, preview, and error states. |
| `src/utils/errors.ts` | Custom `ScraperError` class with error codes and exponential backoff calculation. |
| `src/types.ts` | All TypeScript interfaces and types. |

### Module Communication Flow

```
Popup UI → Chrome Messages → Service Worker → Content Script
                                                    ↓
                                        Pattern Detector ←→ Overlay
                                                    ↓
                                        Auto Scroller + Data Extractor
```

### Key Type Interfaces

- `PatternMatch`: Detected pattern with tag, classes, parent element, siblings, and confidence score
- `ScrollerConfig`: Throttle timing, max items, retry count/delay
- `ExtractionConfig`: Field definitions, hierarchy preservation, normalization options
- `ScraperMessage`: Chrome message types (START_SCRAPE, PAUSE_SCRAPE, etc.)

## Testing

Tests use Vitest with jsdom environment. The Chrome API is mocked in `tests/setup.ts`.

```bash
# Run a specific test file
bunx vitest run tests/patternDetector.test.ts

# Run tests matching a pattern
bunx vitest run -t "detectPattern"
```

## Path Aliases

`@/*` maps to `src/*` (configured in both tsconfig.json and vite.config.ts).
