# Web Scraper Pro - Project Memory

## Project Status: MVP Complete

## What Was Built

Chrome Extension (Manifest V3) for DOM pattern detection and data extraction.

### Core Modules

| Module | Purpose |
|--------|---------|
| `patternDetector.ts` | Detects repeating DOM patterns by tag/class/id/data/aria attributes |
| `autoScroller.ts` | Infinite scroll with MutationObserver, retry logic, load-more detection |
| `dataExtractor.ts` | Heuristic field extraction with normalization |
| `shadowDomHandler.ts` | Shadow DOM traversal and extraction |
| `overlay.ts` | Shadow DOM isolated visual overlay |
| `errors.ts` | Error codes, backoff calculation |

### Key Interfaces

- `PatternMatch` - Detected pattern with siblings, confidence score
- `ScrollerConfig` - Throttle, retry, maxItems settings
- `ExtractionConfig` - Fields, hierarchy, normalization options
- `ScrollerState` - Status (idle/running/paused), itemsCollected, errors

## Verification

- TypeScript: PASS
- Tests: 51/51 PASS
- Build: SUCCESS (dist/ folder ready)

## Architecture Decisions

1. **Shadow DOM for overlay** - Prevents style conflicts with host pages
2. **MutationObserver for scrolling** - Efficient new content detection
3. **Configurable pattern matching** - Flexible criteria (tag, class, id, data-*, aria-*)
4. **Heuristic extraction fallback** - Auto-detects images, links, headings when no config

## Files Structure

```
src/
  content/   - Pattern detection, scrolling, extraction
  background/ - Service worker
  ui/        - Popup, overlay, styles
  utils/     - Error handling
  types.ts   - TypeScript interfaces
tests/       - Vitest with jsdom
dist/        - Built extension
```

## To Load Extension

1. `bun run build`
2. Chrome > `chrome://extensions/` > Developer mode > Load unpacked > select `dist/`
