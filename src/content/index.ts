// Content script entry point
// Integrates pattern detection, auto-scrolling, UI overlay, and recording

import type {
  PatternMatch,
  ScrollerState,
  ExtractedItem,
  ScraperMessage,
  ScraperResponse,
  ScrollerConfig,
  ExtractionConfig,
} from '../types';
import {
  detectPattern,
  highlightPattern,
  hideHighlight,
  defaultConfig as defaultPatternConfig,
  setOnPatternClick,
  lockPattern,
  unlockPattern,
  isLocked,
} from './patternDetector';
import * as AutoScroller from './autoScroller';
// Overlay imports removed
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

// --- Recording State ---
// Recording logic temporarily disabled during refactor
// let captureOrchestrator: CaptureOrchestrator | null = null;
// let currentRecordingSession: RecordingSession | null = null;

// --- Helper Functions ---

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

  // Don't change highlight if pattern is locked
  if (isLocked()) return;

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
  // Don't hide if pattern is locked
  if (isLocked()) return;

  const relatedTarget = event.relatedTarget as Element | null;
  if (!relatedTarget || !document.body.contains(relatedTarget)) {
    hideHighlight();
  }
}

function initPatternDetection() {
  document.addEventListener('mouseover', handleMouseOver, { passive: true, capture: true });
  document.addEventListener('mouseout', handleMouseOut, { passive: true, capture: true });

  // Register click handler for pattern overlay - locks the pattern
  setOnPatternClick(() => {
    if (currentPattern) {
      if (isLocked()) {
        // Already locked - unlock it
        console.log('[Web Scraper] Pattern unlocked');
        unlockPattern();
        hideHighlight(true);
        currentPattern = null;
      } else {
        // Lock the current pattern
        console.log('[Web Scraper] Pattern locked! Click "Start Scanning" in sidepanel or right-click for context menu.');
        lockPattern();
      }
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

// --- Scraper Integration ---

import { _internal } from './patternDetector';
const { getFingerprint, calculateSimilarity } = _internal;

/**
 * Re-finds items in the container that match the fingerprint.
 * Critical for handling dynamic DOM updates during scrolling.
 */
function getCurrentItemsFromPattern(pattern: PatternMatch): Element[] {
  if (!pattern?.container) return [];

  // Re-query children to get current state of DOM
  const children = Array.from(pattern.container.children).filter((node): node is Element => {
    const el = node as Element;
    // Filter invisible or irrelevant elements
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return false;
    return true;
  });

  const items: Element[] = [];
  const fpTarget = pattern.fingerprint;

  for (const child of children) {
    const fpChild = getFingerprint(child);
    const sim = calculateSimilarity(fpTarget, fpChild);
    // Use same threshold as detection
    if (sim >= (appConfig.patternConfig.simThreshold || 0.62)) {
      items.push(child);
    }
  }
  return items;
}

function extractFromCurrentPattern() {
  if (!currentPattern) return;

  // Dynamic re-query of items
  const currentItems = getCurrentItemsFromPattern(currentPattern);
  const seenKeys = new Set(collectedData.map(item => item.link || item.title || JSON.stringify(item)));
  let newItemsAdded = false;

  for (const element of currentItems) {
    const extracted = extractData(element, appConfig.extractionConfig);

    // Deduplication key: prefer stable identifiers
    const key = (extracted.link as string) || (extracted.image as string) || (extracted.text as string) || JSON.stringify(extracted);

    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);
      collectedData.push(extracted);
      newItemsAdded = true;
    }
  }

  // Send preview update if new items were added
  if (newItemsAdded) {
    console.log('[Web Scraper] Extracted', collectedData.length, 'total items');
    chrome.runtime.sendMessage({
      type: 'UPDATE_PREVIEW',
      payload: { items: collectedData.slice(-5) }
    }).catch(() => {});
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
          const extracted = extractData(el, appConfig.extractionConfig);
          if (extracted.text || extracted.link || extracted.title) {
            // Simple dedupe
            const key = JSON.stringify(extracted);
            if (!collectedData.some(d => JSON.stringify(d) === key)) {
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
  // Update UI via Messages
  chrome.runtime.sendMessage({
    type: 'UPDATE_STATUS',
    payload: { status: state.status }
  }).catch(() => { });

  chrome.runtime.sendMessage({
    type: 'UPDATE_PROGRESS',
    payload: {
      current: collectedData.length, // Report unique items collected
      max: appConfig.scrollerConfig.maxItems || 0
    }
  }).catch(() => { });

  if (state.errors.length > 0) {
    chrome.runtime.sendMessage({
      type: 'SHOW_ERROR',
      payload: { message: state.errors[state.errors.length - 1] }
    }).catch(() => { });
  }

  // Extract data based on pattern or heuristics
  if (currentPattern) {
    extractFromCurrentPattern();
  } else {
    extractWithHeuristics();
  }

  // Update preview with last 5 items
  chrome.runtime.sendMessage({
    type: 'UPDATE_PREVIEW',
    payload: { items: collectedData.slice(-5) }
  }).catch(() => { });
}

// --- Message Handling ---

chrome.runtime.onMessage.addListener(
  (message: ScraperMessage, _sender, sendResponse: (response: ScraperResponse) => void) => {
    console.log('[Content] Received:', message.type, message.payload);

    try {
      switch (message.type) {
        case 'START_SCRAPE_SELECTION':
          console.log('[Content] Received context menu scrape command');
          if (currentPattern) {
            handleStartScrape();
            sendResponse({ success: true, data: { status: 'running' } });
          } else {
            console.warn('[Content] No pattern selected when context menu clicked');
            sendResponse({ success: false, error: 'No pattern selected' });
          }
          break;

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

  // 1. Unlock pattern and disable hover detection
  unlockPattern();
  hideHighlight(true);
  isPatternDetectionEnabled = false;
  cleanupPatternDetection();

  // 2. Notify UI
  chrome.runtime.sendMessage({
    type: 'UPDATE_STATUS',
    payload: { status: 'running' }
  }).catch(() => { });

  // 3. Start Scroller
  // Hook up progress
  AutoScroller.onScrollProgress(onScrollerProgress);

  try {
    AutoScroller.startScroll(appConfig.scrollerConfig);
  } catch (e: any) {
    chrome.runtime.sendMessage({
      type: 'SHOW_ERROR',
      payload: { message: e.message }
    }).catch(() => { });

    chrome.runtime.sendMessage({
      type: 'UPDATE_STATUS',
      payload: { status: 'error' }
    }).catch(() => { });
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
    appConfig = {
      ...appConfig,
      ...saved.scraperConfig,
      patternConfig: {
        ...appConfig.patternConfig,
        ...(saved.scraperConfig.patternConfig || {}),
        minListItems: 3, // Default for lists
        allowSingleFallback: true // Allow single items too
      }
    };
  }

  initPatternDetection();
}

// Ensure init is called after DOMContentLoaded if not already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Cleanup on unload
window.addEventListener('unload', () => {
  cleanupPatternDetection();
  AutoScroller.stopScroll();
});

// --- SPA Navigation Detection ---
// Handle URL changes in Single Page Applications (e.g., pagination)

let lastUrl = location.href;

function handleUrlChange() {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    console.log('[Web Scraper] URL changed, re-initializing pattern detection');
    lastUrl = currentUrl;

    // Reset state for new page
    unlockPattern();
    currentPattern = null;
    hideHighlight(true);

    // Re-enable pattern detection if it was disabled
    if (!isPatternDetectionEnabled) {
      isPatternDetectionEnabled = true;
      initPatternDetection();
    }

    // Notify UI of URL change
    chrome.runtime.sendMessage({
      type: 'UPDATE_STATUS',
      payload: { status: 'idle', message: 'New page detected' }
    }).catch(() => {});
  }
}

// Listen for popstate (browser back/forward)
window.addEventListener('popstate', handleUrlChange);

// Observe URL changes via History API (pushState/replaceState)
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function(...args) {
  originalPushState.apply(this, args);
  handleUrlChange();
};

history.replaceState = function(...args) {
  originalReplaceState.apply(this, args);
  handleUrlChange();
};

// Also check periodically for hash changes or other modifications
setInterval(handleUrlChange, 1000);
