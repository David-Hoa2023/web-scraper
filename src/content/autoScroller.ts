/**
 * Auto-Scroller Module for Web Scraper Chrome Extension
 *
 * Provides throttled scrolling with MutationObserver integration,
 * retry logic with exponential backoff, and "load more" button detection.
 */

import type {
  ScrollerConfig,
  ScrollerState,
  ScrollerStatus,
  ScrollProgressCallback,
} from '../types';
import {
  ScraperError,
  ErrorCodes,
  formatError,
  calculateBackoff,
} from '../utils/errors';

// Module state
let currentConfig: ScrollerConfig | null = null;
let currentState: ScrollerState = createInitialState();
let progressCallbacks: ScrollProgressCallback[] = [];
let scrollIntervalId: ReturnType<typeof setTimeout> | null = null;
let mutationObserver: MutationObserver | null = null;
let retryAttempt = 0;
let lastScrollHeight = 0;
let noChangeCount = 0;

// Constants
const LOAD_MORE_SELECTORS = [
  'button[class*="load-more"]',
  'button[class*="loadmore"]',
  'button[class*="load_more"]',
  'a[class*="load-more"]',
  'a[class*="loadmore"]',
  '[data-testid*="load-more"]',
  '[data-testid*="loadmore"]',
  '.load-more',
  '.loadmore',
  '#load-more',
  '#loadmore',
  'button:has-text("Load More")',
  'button:has-text("Show More")',
  'button:has-text("View More")',
];

const MAX_NO_CHANGE_ITERATIONS = 3;

/**
 * Creates the initial scroller state
 */
function createInitialState(): ScrollerState {
  return {
    status: 'idle',
    itemsCollected: 0,
    errors: [],
  };
}

/**
 * Updates the current state and notifies all registered callbacks
 */
function updateState(updates: Partial<ScrollerState>): void {
  currentState = { ...currentState, ...updates };
  notifyProgress();
}

/**
 * Notifies all registered progress callbacks with the current state
 */
function notifyProgress(): void {
  const stateCopy = { ...currentState };
  progressCallbacks.forEach((callback) => {
    try {
      callback(stateCopy);
    } catch (error) {
      console.error('[AutoScroller] Error in progress callback:', error);
    }
  });
}

/**
 * Adds an error to the state
 */
function addError(error: unknown): void {
  const formattedError = formatError(error);
  updateState({
    errors: [...currentState.errors, formattedError],
  });
}

/**
 * Attempts to find and click a "load more" button
 * @returns true if a button was found and clicked
 */
function tryClickLoadMore(): boolean {
  for (const selector of LOAD_MORE_SELECTORS) {
    try {
      // Handle :has-text pseudo-selector manually
      if (selector.includes(':has-text')) {
        const textMatch = selector.match(/:has-text\("([^"]+)"\)/);
        if (textMatch) {
          const buttonText = textMatch[1].toLowerCase();
          const tagType = selector.split(':')[0] || 'button';
          const elements = document.querySelectorAll(tagType);

          for (const el of elements) {
            if (
              el.textContent?.toLowerCase().includes(buttonText) &&
              isElementVisible(el as HTMLElement)
            ) {
              (el as HTMLElement).click();
              console.log(
                `[AutoScroller] Clicked load more button with text: ${buttonText}`
              );
              return true;
            }
          }
        }
      } else {
        const element = document.querySelector(selector) as HTMLElement | null;
        if (element && isElementVisible(element)) {
          element.click();
          console.log(
            `[AutoScroller] Clicked load more button: ${selector}`
          );
          return true;
        }
      }
    } catch (error) {
      // Continue to next selector
      console.debug(`[AutoScroller] Selector failed: ${selector}`, error);
    }
  }
  return false;
}

/**
 * Checks if an element is visible in the viewport
 */
function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0'
  ) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Counts the number of item elements on the page
 * Uses common patterns for list items
 */
function countItems(): number {
  const commonItemSelectors = [
    '[data-testid*="item"]',
    '[data-testid*="card"]',
    '[data-testid*="row"]',
    '.item',
    '.card',
    '.list-item',
    'article',
    'li',
    'tr',
  ];

  let maxCount = 0;
  for (const selector of commonItemSelectors) {
    try {
      const count = document.querySelectorAll(selector).length;
      if (count > maxCount) {
        maxCount = count;
      }
    } catch {
      // Continue to next selector
    }
  }

  return maxCount;
}

/**
 * Performs a single scroll iteration
 */
async function scrollIteration(): Promise<void> {
  if (currentState.status !== 'running' || !currentConfig) {
    return;
  }

  try {
    const currentScrollHeight = document.documentElement.scrollHeight;
    const currentScrollTop = window.scrollY;
    const windowHeight = window.innerHeight;

    // Check if we've reached the maximum items (0 means unlimited)
    const currentItems = countItems();
    if (
      currentConfig.maxItems !== undefined &&
      currentConfig.maxItems > 0 &&
      currentItems >= currentConfig.maxItems
    ) {
      console.log(
        `[AutoScroller] Reached max items: ${currentItems}/${currentConfig.maxItems}`
      );
      stopScroll();
      return;
    }

    // Update items collected
    updateState({ itemsCollected: currentItems });

    // Check if scroll height hasn't changed
    if (currentScrollHeight === lastScrollHeight) {
      noChangeCount++;

      // Try clicking load more button
      if (tryClickLoadMore()) {
        noChangeCount = 0;
        // Wait for content to load
        await delay(currentConfig.throttleMs);
        return;
      }

      // If no change after multiple iterations, attempt retry
      if (noChangeCount >= MAX_NO_CHANGE_ITERATIONS) {
        if (retryAttempt < currentConfig.retryCount) {
          retryAttempt++;
          const backoffDelay = calculateBackoff(
            retryAttempt - 1,
            currentConfig.retryDelayMs
          );
          console.log(
            `[AutoScroller] Retry ${retryAttempt}/${currentConfig.retryCount}, waiting ${backoffDelay}ms`
          );
          await delay(backoffDelay);
          noChangeCount = 0;
          return;
        } else {
          // Max retries exceeded, stop scrolling
          console.log('[AutoScroller] Max retries exceeded, stopping');
          addError(
            new ScraperError(
              'No new content detected after maximum retries',
              ErrorCodes.MAX_RETRIES_EXCEEDED,
              false
            )
          );
          stopScroll();
          return;
        }
      }
    } else {
      // Content changed, reset counters
      noChangeCount = 0;
      retryAttempt = 0;
      lastScrollHeight = currentScrollHeight;
    }

    // Check if we're at the bottom
    const isAtBottom =
      currentScrollTop + windowHeight >= currentScrollHeight - 10;

    if (!isAtBottom) {
      // Scroll down
      window.scrollBy({
        top: windowHeight * 0.8,
        behavior: 'smooth',
      });
    } else {
      // At bottom, try load more or wait
      if (!tryClickLoadMore()) {
        noChangeCount++;
      }
    }

    // Schedule next iteration
    scheduleNextIteration();
  } catch (error) {
    addError(error);
    console.error('[AutoScroller] Error during scroll iteration:', error);

    // Handle retry for errors
    if (retryAttempt < (currentConfig?.retryCount ?? 0)) {
      retryAttempt++;
      const backoffDelay = calculateBackoff(
        retryAttempt - 1,
        currentConfig?.retryDelayMs ?? 1000
      );
      await delay(backoffDelay);
      scheduleNextIteration();
    } else {
      updateState({ status: 'error' });
      cleanup();
    }
  }
}

/**
 * Schedules the next scroll iteration
 */
function scheduleNextIteration(): void {
  if (currentState.status !== 'running' || !currentConfig) {
    return;
  }

  scrollIntervalId = setTimeout(() => {
    void scrollIteration();
  }, currentConfig.throttleMs);
}

/**
 * Sets up the MutationObserver to detect new DOM nodes
 */
function setupMutationObserver(): void {
  if (mutationObserver) {
    mutationObserver.disconnect();
  }

  mutationObserver = new MutationObserver((mutations) => {
    let hasNewNodes = false;

    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        hasNewNodes = true;
        break;
      }
    }

    if (hasNewNodes) {
      // Reset no-change counter when new nodes are detected
      noChangeCount = 0;
      retryAttempt = 0;

      // Update item count
      const currentItems = countItems();
      if (currentItems !== currentState.itemsCollected) {
        updateState({ itemsCollected: currentItems });
      }
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('[AutoScroller] MutationObserver started');
}

/**
 * Cleans up all resources
 */
function cleanup(): void {
  if (scrollIntervalId !== null) {
    clearTimeout(scrollIntervalId);
    scrollIntervalId = null;
  }

  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }

  retryAttempt = 0;
  noChangeCount = 0;
  lastScrollHeight = 0;

  console.log('[AutoScroller] Cleanup complete');
}

/**
 * Utility function to create a delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== PUBLIC API ====================

/**
 * Starts auto-scrolling with the provided configuration
 * @param config - Scroller configuration
 * @throws ScraperError if already running or config is invalid
 */
export function startScroll(config: ScrollerConfig): void {
  if (currentState.status === 'running') {
    throw new ScraperError(
      'Scroller is already running',
      ErrorCodes.ALREADY_RUNNING
    );
  }

  if (config.throttleMs < 0 || config.retryCount < 0 || config.retryDelayMs < 0) {
    throw new ScraperError(
      'Invalid configuration: values must be non-negative',
      ErrorCodes.INVALID_CONFIG
    );
  }

  console.log('[AutoScroller] Starting with config:', config);

  currentConfig = { ...config };
  currentState = createInitialState();
  lastScrollHeight = document.documentElement.scrollHeight;

  updateState({
    status: 'running',
    itemsCollected: countItems(),
  });

  setupMutationObserver();
  scheduleNextIteration();
}

/**
 * Pauses scrolling without losing state
 */
export function pauseScroll(): void {
  if (currentState.status !== 'running') {
    console.warn('[AutoScroller] Cannot pause: not running');
    return;
  }

  console.log('[AutoScroller] Pausing');

  if (scrollIntervalId !== null) {
    clearTimeout(scrollIntervalId);
    scrollIntervalId = null;
  }

  updateState({ status: 'paused' });
}

/**
 * Resumes scrolling from paused state
 */
export function resumeScroll(): void {
  if (currentState.status !== 'paused') {
    console.warn('[AutoScroller] Cannot resume: not paused');
    return;
  }

  if (!currentConfig) {
    throw new ScraperError(
      'No configuration available',
      ErrorCodes.INVALID_CONFIG
    );
  }

  console.log('[AutoScroller] Resuming');

  updateState({ status: 'running' });
  scheduleNextIteration();
}

/**
 * Stops scrolling and performs complete cleanup
 */
export function stopScroll(): void {
  if (currentState.status === 'idle') {
    console.warn('[AutoScroller] Already stopped');
    return;
  }

  console.log('[AutoScroller] Stopping');

  const finalStatus: ScrollerStatus =
    currentState.status === 'error' ? 'error' : 'idle';
  cleanup();
  updateState({ status: finalStatus });
  currentConfig = null;
}

/**
 * Registers a callback to receive progress updates
 * @param callback - Function to call with ScrollerState on each update
 */
export function onScrollProgress(callback: ScrollProgressCallback): void {
  progressCallbacks.push(callback);
}

/**
 * Removes a previously registered progress callback
 * @param callback - The callback to remove
 */
export function offScrollProgress(callback: ScrollProgressCallback): void {
  const index = progressCallbacks.indexOf(callback);
  if (index !== -1) {
    progressCallbacks.splice(index, 1);
  }
}

/**
 * Gets the current scroller state
 * @returns A copy of the current state
 */
export function getState(): ScrollerState {
  return { ...currentState };
}

/**
 * Resets the scroller to initial state
 * Useful for testing or reinitialization
 */
export function reset(): void {
  cleanup();
  currentConfig = null;
  currentState = createInitialState();
  progressCallbacks = [];
}
