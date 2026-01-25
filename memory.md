# Web Scraper Pro - Project Memory

## Project Status: v1.0 Complete

**GitHub:** https://github.com/David-Hoa2023/web-scraper

## Overview

Chrome Extension (Manifest V3) that detects repeating DOM patterns, auto-scrolls to load content, and extracts data to JSON.

## Key Features

- **Hover to detect** - Green highlight shows repeating patterns with item count
- **Click to scrape** - Click highlighted area to start scraping
- **Auto-scroll** - Infinite scroll with retry logic and "load more" button detection
- **Data extraction** - Extracts text, links, images from detected elements
- **JSON export** - Download collected data via popup

## Architecture

| Layer | Components |
|-------|------------|
| Content Script | Pattern detection, auto-scroller, data extractor, in-page overlay |
| Background | Service worker for extension lifecycle |
| Popup | Dashboard with start/pause/export controls, settings tabs |

**Key decisions:**
- Shadow DOM for overlay (style isolation)
- MutationObserver for scroll detection
- WeakSet for deduplication of extracted elements

## Commands

```bash
bun install      # Install dependencies
bun run build    # Build to dist/
bun run test     # Run tests
```

## Load Extension

1. `bun run build`
2. Chrome → `chrome://extensions` → Developer mode → Load unpacked → select `dist/`
