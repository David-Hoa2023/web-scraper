// Content script entry point
// Integrates pattern detection, auto-scrolling, and UI overlay

import type {
  PatternMatch,
  ScrollerState,
  ExtractedItem,
  ScraperMessage,
  ScraperResponse,
  ScrollerConfig,
  ExtractionConfig
} from '../types';
import {
  detectPattern,
  highlightPattern,
  hideHighlight,
  defaultConfig as defaultPatternConfig,
  setOnPatternClick,
} from './patternDetector';
import * as AutoScroller from './autoScroller';
import {
  createOverlay,
  updateProgress,
  updateStatus,
  updatePreview,
  showError,
  setButtonHandlers,
  isOverlayVisible,
} from '../ui/overlay';
import { extractData } from './dataExtractor';

console.log('[Web Scraper] Content script loaded');

// --- State Management ---
let currentPattern: PatternMatch | null = null;
let isPatternDetectionEnabled = true;

// Default layouts
let appConfig = {
  patternConfig: { ...defaultPatternConfig },
  scrollerConfig: {
    throttleMs: 1000,
    maxItems: 0,
    retryCount: 3,
    retryDelayMs: 2000
  } as ScrollerConfig,
  extractionConfig: {
    fields: [],
    preserveHierarchy: false,
    normalize: true
  } as ExtractionConfig
};

// --- Helper Functions ---

function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// --- Pattern Detection Logic ---

const handleMouseOver = debounce((event: MouseEvent) => {
  if (!isPatternDetectionEnabled) return;

  const target = event.target as Element;
  if (!target || target.nodeType !== Node.ELEMENT_NODE) return;

  // Ignore overlay and badge
  if (target.closest('#web-scraper-pattern-overlay') || target.closest('#web-scraper-shadow-host')) {
    return;
  }

  const match = detectPattern(target, appConfig.patternConfig);

  if (match) {
    currentPattern = match;
    highlightPattern(match);
  } else {
    currentPattern = null;
    hideHighlight();
  }
}, 50);

function handleMouseOut(event: MouseEvent) {
  const relatedTarget = event.relatedTarget as Element | null;
  if (!relatedTarget || !document.body.contains(relatedTarget)) {
    hideHighlight();
  }
}

function initPatternDetection() {
  document.addEventListener('mouseover', handleMouseOver, { passive: true });
  document.addEventListener('mouseout', handleMouseOut, { passive: true });

  // Register click handler for pattern overlay
  setOnPatternClick(() => {
    if (currentPattern) {
      console.log('[Web Scraper] Pattern clicked, starting scrape');
      handleStartScrape();
    }
  });

  console.log('[Web Scraper] Pattern detection active');
}

function cleanupPatternDetection() {
  document.removeEventListener('mouseover', handleMouseOver);
  document.removeEventListener('mouseout', handleMouseOut);
  setOnPatternClick(null);
  hideHighlight();
  console.log('[Web Scraper] Pattern detection paused');
}

// --- Data Storage ---
let collectedData: ExtractedItem[] = [];
let seenElements = new WeakSet<Element>();

// --- Scraper Integration ---

function extractFromCurrentPattern() {
  if (!currentPattern) return;

  // Extract data from all siblings that haven't been processed yet
  for (const element of currentPattern.siblings) {
    if (!seenElements.has(element)) {
      seenElements.add(element);
      const extracted = extractData(element, appConfig.extractionConfig);
      collectedData.push(extracted);
    }
  }
}

function extractWithHeuristics() {
  // Use common item selectors to find elements
  const selectors = [
    'article',
    '[data-testid*="item"]',
    '[data-testid*="card"]',
    '.item',
    '.card',
    '.post',
    '.entry',
    'li:has(a)',
  ];

  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 3) {
        elements.forEach((el) => {
          if (!seenElements.has(el)) {
            seenElements.add(el);
            const extracted = extractData(el, appConfig.extractionConfig);
            if (extracted.text || extracted.link || extracted.title) {
              collectedData.push(extracted);
            }
          }
        });
        break; // Use first matching selector
      }
    } catch {
      // Continue to next selector
    }
  }
}

function onScrollerProgress(state: ScrollerState) {
  // Update UI
  updateStatus(state.status);
  updateProgress(state.itemsCollected, appConfig.scrollerConfig.maxItems || 0);

  if (state.errors.length > 0) {
    showError(state.errors[state.errors.length - 1]);
  }

  // Extract data based on pattern or heuristics
  if (currentPattern) {
    extractFromCurrentPattern();
  } else {
    extractWithHeuristics();
  }

  // Update preview with last 5 items
  updatePreview(collectedData.slice(-5));
}

// --- Message Handling ---

chrome.runtime.onMessage.addListener(
  (message: ScraperMessage, _sender, sendResponse: (response: ScraperResponse) => void) => {
    console.log('[Content] Received:', message.type, message.payload);

    try {
      switch (message.type) {
        case 'START_SCRAPE':
          handleStartScrape();
          sendResponse({ success: true, data: { status: 'running' } });
          break;

        case 'PAUSE_SCRAPE':
          AutoScroller.pauseScroll();
          sendResponse({ success: true, data: { status: 'paused' } });
          break;

        case 'RESUME_SCRAPE':
          AutoScroller.resumeScroll();
          sendResponse({ success: true, data: { status: 'running' } });
          break;

        case 'STOP_SCRAPE':
          handleStopScrape();
          sendResponse({ success: true, data: { status: 'idle' } });
          break;

        case 'GET_STATUS': {
          const state = AutoScroller.getState();
          sendResponse({
            success: true,
            data: {
              status: state.status,
              itemsCollected: state.itemsCollected
            }
          });
          break;
        }

        case 'UPDATE_CONFIG':
          if (message.payload) {
            appConfig = { ...appConfig, ...(message.payload as any) };
            console.log('[Content] Config updated', appConfig);
          }
          sendResponse({ success: true });
          break;

        case 'EXPORT_DATA':
          console.log('[Content] Exporting data:', collectedData.length, 'items');
          sendResponse({
            success: true,
            data: collectedData
          });
          break;

        case 'CLEAR_DATA':
          collectedData = [];
          seenElements = new WeakSet<Element>();
          console.log('[Content] Data cleared');
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (e: any) {
      console.error('[Content] Error handling message:', e);
      sendResponse({ success: false, error: e.message });
    }

    // Return true to indicate async response might be used (though we send immediately)
    return true;
  }
);

// --- Action Handlers ---

function handleStartScrape() {
  // Pattern is optional - can work with heuristics if not set
  if (currentPattern) {
    console.log('[Content] Starting scrape with pattern:', currentPattern);
  } else {
    console.log('[Content] Starting scrape with heuristic detection (no pattern selected)');
  }

  // 1. Disable hover detection so it doesn't interfere
  isPatternDetectionEnabled = false;
  cleanupPatternDetection();

  // 2. Initialize and show Overlay
  if (!isOverlayVisible()) {
    createOverlay();

    // Wire up Overlay Buttons to Logic
    setButtonHandlers({
      onStart: () => { }, // Disabled loops
      onPause: () => AutoScroller.pauseScroll(),
      onResume: () => AutoScroller.resumeScroll(),
      onStop: handleStopScrape
    });
  }

  updateStatus('running');

  // 3. Start Scroller
  // Hook up progress
  AutoScroller.onScrollProgress(onScrollerProgress);

  try {
    AutoScroller.startScroll(appConfig.scrollerConfig);
  } catch (e: any) {
    showError(e.message);
    updateStatus('error');
  }
}

function handleStopScrape() {
  AutoScroller.stopScroll();
  AutoScroller.offScrollProgress(onScrollerProgress); // Cleanup listeners

  // Re-enable pattern detection
  isPatternDetectionEnabled = true;
  initPatternDetection();

  console.log('[Content] Scrape stopped');
}

// --- Initialization ---

async function init() {
  // Load saved config
  const saved = await chrome.storage.local.get('scraperConfig');
  if (saved.scraperConfig) {
    appConfig = { ...appConfig, ...saved.scraperConfig };
  }

  initPatternDetection();
}

init();

// Cleanup on unload
window.addEventListener('unload', () => {
  cleanupPatternDetection();
  AutoScroller.stopScroll();
});
