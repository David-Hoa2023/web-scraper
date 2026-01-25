# BLUEPRINT: Web Scraper Chrome Extension Enhancement

**Run ID:** web-scraper-b1
**Source:** docs/backlog/backlog-1.yaml
**Created:** 2026-01-25

## Overview

Enhance the SuperDev Pro-style client-side DOM scraper Chrome Extension with improved pattern detection, auto-scrolling, data extraction, and user experience.

## Goals

1. **Enhanced Pattern Detection** - Match elements by tag, class, id, data-*, aria-* attributes
2. **Robust Auto-Scrolling** - Throttled scrolling with error handling and "load more" support
3. **Flexible Data Extraction** - User-customizable fields, hierarchical data, normalization
4. **Shadow DOM Support** - Detect and interact with web components
5. **Improved UX** - Progress bar, real-time preview, pause/resume, error notifications
6. **Error Resilience** - Retries, graceful network handling, resume capability
7. **Efficiency** - Throttling, optimized DOM parsing, batched storage

## Non-Goals

- Server-side crawling (Scrapy, Selenium)
- Cross-origin scraping (limited to current tab)
- Data persistence to external databases (export only)

## Hard Constraints

- Chrome Extension Manifest V3 compliance
- No external dependencies beyond Chrome APIs
- Must work on virtualized lists (React/Vue sites)
- UI must use Shadow DOM isolation

## Architecture

```
web-scraper/
  src/
    manifest.json           # MV3 manifest
    background/
      service-worker.ts     # Background service worker
    content/
      index.ts              # Content script entry
      patternDetector.ts    # Pattern matching logic
      autoScroller.ts       # Scroll engine
      dataExtractor.ts      # Data mapping/extraction
      shadowDomHandler.ts   # Shadow DOM utilities
    ui/
      popup.html            # Extension popup
      popup.ts              # Popup logic
      overlay.ts            # In-page overlay UI
      styles.css            # UI styles
    utils/
      storage.ts            # Chrome storage helpers
      messaging.ts          # Message passing
      errors.ts             # Error handling utilities
  tests/
    patternDetector.test.ts
    autoScroller.test.ts
    dataExtractor.test.ts
```

## API/Interface Contracts

### PatternDetector

```typescript
interface PatternMatch {
  tag: string;
  classes: string[];
  id?: string;
  dataAttrs: Record<string, string>;
  ariaAttrs: Record<string, string>;
  parent: Element;
  siblings: Element[];
  confidence: number;
}

interface PatternDetectorConfig {
  matchBy: ('tag' | 'class' | 'id' | 'data' | 'aria')[];
  minSiblings: number;
  depthLimit: number;
}

function detectPattern(element: Element, config: PatternDetectorConfig): PatternMatch | null;
function highlightPattern(match: PatternMatch): void;
```

### AutoScroller

```typescript
interface ScrollerConfig {
  throttleMs: number;
  maxItems?: number;
  retryCount: number;
  retryDelayMs: number;
}

interface ScrollerState {
  status: 'idle' | 'running' | 'paused' | 'error';
  itemsCollected: number;
  errors: string[];
}

function startScroll(config: ScrollerConfig): void;
function pauseScroll(): void;
function resumeScroll(): void;
function stopScroll(): void;
function onScrollProgress(callback: (state: ScrollerState) => void): void;
```

### DataExtractor

```typescript
interface ExtractionField {
  name: string;
  selector: string;
  type: 'text' | 'href' | 'src' | 'attr';
  attrName?: string;
}

interface ExtractionConfig {
  fields: ExtractionField[];
  preserveHierarchy: boolean;
  normalize: boolean;
}

interface ExtractedItem {
  [key: string]: string | ExtractedItem | ExtractedItem[];
}

function extractData(element: Element, config: ExtractionConfig): ExtractedItem;
function normalizeData(item: ExtractedItem): ExtractedItem;
```

## Staged Plan

### Stage 0: Contracts & Project Setup
- Initialize TypeScript project with Chrome Extension structure
- Define all interfaces/types in `src/types.ts`
- Create manifest.json for MV3
- Set up build tooling (esbuild/vite)

### Stage 1: Core Pattern Detection
- Implement attribute-based pattern matching
- Add visual feedback overlay for matched elements
- User toggle for match criteria (tag/class/id)

### Stage 2: Auto-Scroller Enhancement
- Implement throttled scrolling with configurable delays
- Add retry logic with exponential backoff
- Support "load more" button detection and clicking
- Error handling with user notifications

### Stage 3: Data Extraction
- User-customizable field definitions
- Hierarchical data preservation
- Data normalization for varying formats

### Stage 4: Shadow DOM Support
- Shadow DOM element detection
- ::part selector support
- Fallback for heavily dynamic sites

### Stage 5: UI/UX Improvements
- Progress bar in overlay
- Real-time data preview
- Pause/resume controls
- Live item count display
- Error notifications

### Stage 6: Efficiency & Polish
- Scroll throttling optimization
- Batched storage to prevent memory overflow
- DOM parsing optimization

## Acceptance Criteria

- [ ] Pattern detection matches elements by tag, class, id, data-*, aria-*
- [ ] User can toggle which attributes to match on
- [ ] Auto-scroller respects throttle configuration
- [ ] Auto-scroller retries on failure (max 3 attempts)
- [ ] "Load more" buttons are detected and clicked
- [ ] Users can define custom extraction fields
- [ ] Extracted data preserves parent-child relationships
- [ ] Shadow DOM elements are detected and extractable
- [ ] Progress bar shows scraping progress
- [ ] Real-time preview updates as items are collected
- [ ] Pause/resume works without data loss
- [ ] Errors display user-friendly messages
- [ ] Memory usage stays bounded with batched storage

## Verification Protocol

```bash
# Fast check (after each stage)
bun run typecheck
bun run lint

# Full verify (before completion)
bun test
bun run build
# Manual test in Chrome with test pages
```

## Test Pages

- Reddit (infinite scroll, virtualized)
- Twitter/X (dynamic classes, virtualized)
- Hacker News (simple list)
- GitHub Issues (load more button)
- Custom test page with Shadow DOM components
