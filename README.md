# Web Scraper Pro

A Chrome Extension for intelligent DOM pattern detection and data extraction with auto-scrolling capabilities.

## Features

- **Pattern Detection**: Automatically detects repeating DOM patterns based on configurable matching criteria (tag, class, id, data-*, aria-* attributes)
- **Auto-Scrolling**: Intelligent infinite scroll handling with MutationObserver, retry logic, and "load more" button detection
- **Data Extraction**: Flexible extraction with heuristic-based field detection and normalization
- **Shadow DOM Support**: Full traversal and extraction from Shadow DOM elements and web components
- **Visual Overlay**: Real-time highlighting of detected patterns with item count badges

## Installation

### From Source

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd web-scraper
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Build the extension:
   ```bash
   bun run build
   ```

4. Load in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `dist` folder

## Usage

1. Navigate to any webpage with repeating content (product listings, search results, feeds, etc.)
2. Hover over items to see pattern detection in action - matching elements will be highlighted with a green overlay
3. Click the extension icon to open the popup and configure:
   - Pattern matching criteria
   - Auto-scroll settings
   - Data extraction fields

### Pattern Detection

The extension automatically detects repeating patterns by analyzing:
- **Tag names**: Elements with the same HTML tag
- **CSS classes**: Elements sharing class names
- **ID patterns**: IDs with numeric patterns (e.g., `item-1`, `item-2`)
- **Data attributes**: Elements with matching `data-*` attributes
- **ARIA attributes**: Elements with matching `aria-*` attributes

### Auto-Scrolling

Configure auto-scroll behavior:
- **Throttle**: Control scroll speed (ms between scrolls)
- **Retry count**: Number of retries when no new content loads
- **Max items**: Stop after collecting N items
- **Load more detection**: Automatically clicks "load more" buttons

### Data Extraction

Extract data from detected patterns:
- Automatic field detection (images, links, headings, text)
- Custom field selectors
- Hierarchical data preservation
- URL normalization

## Development

### Scripts

```bash
bun run dev        # Start development server
bun run build      # Build for production
bun run typecheck  # Run TypeScript type checking
bun run test       # Run tests
bun run test:watch # Run tests in watch mode
bun run lint       # Run ESLint
```

### Project Structure

```
src/
├── content/
│   ├── index.ts           # Content script entry point
│   ├── patternDetector.ts # Pattern detection logic
│   ├── autoScroller.ts    # Auto-scroll functionality
│   ├── dataExtractor.ts   # Data extraction utilities
│   └── shadowDomHandler.ts # Shadow DOM support
├── background/
│   └── service-worker.ts  # Background service worker
├── ui/
│   ├── popup.html         # Extension popup
│   ├── popup.ts           # Popup logic
│   ├── overlay.ts         # Visual overlay component
│   └── styles.css         # Overlay styles
├── utils/
│   └── errors.ts          # Error handling utilities
├── types.ts               # TypeScript type definitions
└── manifest.json          # Chrome Extension manifest
```

### Testing

Tests use Vitest with jsdom environment:

```bash
bun run test
```

Test coverage includes:
- Pattern detection algorithms
- Auto-scroller state management
- Error handling utilities

## Architecture

### Manifest V3

This extension uses Chrome's Manifest V3 architecture:
- **Service Worker**: Background script for extension lifecycle
- **Content Scripts**: Injected into web pages for DOM interaction
- **Popup**: User interface for configuration

### Shadow DOM Isolation

The visual overlay uses Shadow DOM to:
- Prevent style conflicts with host pages
- Ensure consistent appearance across websites
- Isolate extension UI from page manipulation

## API

### Pattern Detector

```typescript
import { detectPattern, highlightPattern, hideHighlight } from './patternDetector';

// Detect pattern from an element
const match = detectPattern(element, {
  matchBy: ['tag', 'class'],
  minSiblings: 2,
  depthLimit: 3,
});

// Highlight detected pattern
if (match) {
  highlightPattern(match);
}

// Hide highlight
hideHighlight();
```

### Auto-Scroller

```typescript
import { startScroll, pauseScroll, stopScroll, onScrollProgress } from './autoScroller';

// Start auto-scrolling
startScroll({
  throttleMs: 100,
  retryCount: 3,
  retryDelayMs: 500,
  maxItems: 100,
});

// Listen for progress updates
onScrollProgress((state) => {
  console.log(`Collected: ${state.itemsCollected}`);
});

// Control scrolling
pauseScroll();
stopScroll();
```

### Data Extractor

```typescript
import { extractData, extractBatch } from './dataExtractor';

// Extract data from element
const item = extractData(element, {
  fields: [
    { name: 'title', selector: 'h2', type: 'text' },
    { name: 'link', selector: 'a', type: 'href' },
    { name: 'image', selector: 'img', type: 'src' },
  ],
  normalize: true,
});

// Batch extraction
const items = extractBatch(elements);
```

## License

MIT
