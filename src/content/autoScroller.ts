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

// Progress estimation state
let scrollStartTime = 0;
let initialItemCount = 0;
let itemsPerSecond = 0;
let estimatedTotalItems = 0;
let scrollType: 'infinite' | 'pagination' | 'unknown' = 'unknown';

// Resource optimization state
let isThrottled = false;
let pendingMutations = 0;
const MUTATION_BATCH_THRESHOLD = 50;
const THROTTLE_RECOVERY_MS = 100;

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

const NEXT_PAGE_SELECTORS = [
  '[rel="next"]',
  '[aria-label="Next"]',
  '[aria-label="Next Page"]',
  '.next-page',
  '.pagination-next',
  'li.next a',
  '.next',
  'a[class*="next"]',
  'button[class*="next"]'
];

/**
 * Attempts to find and click a "Next Page" button/link
 * @returns true if a button was found and clicked
 */
function tryClickNextPage(): boolean {
  // 1. Try generic text matching first (often most reliable)
  const links = Array.from(document.querySelectorAll('a, button'));
  for (const link of links) {
    const text = link.textContent?.trim().toLowerCase();
    if (text === 'next' || text === '>' || text === 'next page' || text === 'next >') {
      if (isElementVisible(link as HTMLElement)) {
        console.log(`[AutoScroller] Clicked next page by text: "${text}"`);
        (link as HTMLElement).click();
        return true;
      }
    }
  }

  // 2. Try selectors
  for (const selector of NEXT_PAGE_SELECTORS) {
    const element = document.querySelector(selector) as HTMLElement | null;
    if (element && isElementVisible(element)) {
      console.log(`[AutoScroller] Clicked next page by selector: ${selector}`);
      element.click();
      return true;
    }
  }

  return false;
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

      // 1. Try clicking "Load More"
      if (tryClickLoadMore()) {
        noChangeCount = 0;
        await delay(currentConfig.throttleMs);
        return;
      }

      // 2. Try clicking "Next Page" (Fallback)
      // Only try next page if we've tried scrolling a few times with no result
      // This prevents premature page jumping if network is just slow
      if (noChangeCount >= 2) {
        if (tryClickNextPage()) {
          noChangeCount = 0;
          // Wait longer for full page navigation/load
          await delay(3000);
          // Reset scroll mechanics for new page
          lastScrollHeight = 0;
          return;
        }
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

    console.log(`[AutoScroller] Scroll position: ${currentScrollTop}/${currentScrollHeight}, isAtBottom: ${isAtBottom}`);

    if (!isAtBottom) {
      // Scroll down
      const scrollAmount = windowHeight * 0.8;
      console.log(`[AutoScroller] Scrolling down by ${scrollAmount}px`);
      window.scrollBy({
        top: scrollAmount,
        behavior: 'smooth',
      });
    } else {
      // At bottom, try load more -> next page -> wait
      if (!tryClickLoadMore()) {
        // Don't immediately click next page at bottom, invoke wait loop to confirm no infinite scroll
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
 * Includes throttling and batching for resource optimization
 */
function setupMutationObserver(): void {
  if (mutationObserver) {
    mutationObserver.disconnect();
  }

  mutationObserver = new MutationObserver((mutations) => {
    // Track pending mutations for throttling
    pendingMutations += mutations.length;

    // If we're receiving too many mutations, throttle processing
    if (pendingMutations > MUTATION_BATCH_THRESHOLD && !isThrottled) {
      isThrottled = true;
      console.log(`[AutoScroller] Throttling: ${pendingMutations} pending mutations`);

      // Schedule recovery
      setTimeout(() => {
        isThrottled = false;
        pendingMutations = 0;
        console.log('[AutoScroller] Throttle recovered');
      }, THROTTLE_RECOVERY_MS);
      return;
    }

    // Skip processing if throttled
    if (isThrottled) {
      return;
    }

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
      pendingMutations = 0;

      // Update item count
      const currentItems = countItems();
      if (currentItems !== currentState.itemsCollected) {
        updateState({ itemsCollected: currentItems });

        // Update items per second for progress estimation
        if (scrollStartTime > 0) {
          const elapsedMs = Date.now() - scrollStartTime;
          if (elapsedMs > 0) {
            itemsPerSecond = (currentItems - initialItemCount) / (elapsedMs / 1000);
          }
        }
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
  scrollStartTime = 0;
  initialItemCount = 0;
  itemsPerSecond = 0;
  estimatedTotalItems = 0;
  scrollType = 'unknown';
  isThrottled = false;
  pendingMutations = 0;

  console.log('[AutoScroller] Cleanup complete');
}

/**
 * Utility function to create a delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==================== PROGRESS ESTIMATION ====================

/**
 * Estimates scroll progress as a percentage
 * @returns Progress percentage (0-100) or -1 if unknown
 */
export function estimateProgress(): number {
  if (currentState.status !== 'running' || !currentConfig) {
    return -1;
  }

  // If max items is set, use that for progress
  if (currentConfig.maxItems && currentConfig.maxItems > 0) {
    return Math.min(100, (currentState.itemsCollected / currentConfig.maxItems) * 100);
  }

  // Estimate based on scroll position
  const scrollHeight = document.documentElement.scrollHeight;
  const scrollTop = window.scrollY;
  const windowHeight = window.innerHeight;

  if (scrollHeight <= windowHeight) {
    return 100; // Content fits in viewport
  }

  return Math.min(100, ((scrollTop + windowHeight) / scrollHeight) * 100);
}

/**
 * Estimates remaining time in seconds
 * @returns Estimated seconds remaining or -1 if unknown
 */
export function estimateRemainingTime(): number {
  if (scrollStartTime === 0 || currentState.itemsCollected <= initialItemCount) {
    return -1;
  }

  const elapsedMs = Date.now() - scrollStartTime;
  const itemsCollected = currentState.itemsCollected - initialItemCount;

  if (itemsCollected === 0 || elapsedMs < 1000) {
    return -1;
  }

  // Calculate items per second
  itemsPerSecond = itemsCollected / (elapsedMs / 1000);

  // If we have a max items target
  if (currentConfig?.maxItems && currentConfig.maxItems > 0) {
    const remaining = currentConfig.maxItems - currentState.itemsCollected;
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / itemsPerSecond);
  }

  // Estimate based on scroll progress
  const progress = estimateProgress();
  if (progress <= 0 || progress >= 100) {
    return -1;
  }

  const elapsedSeconds = elapsedMs / 1000;
  const totalEstimatedSeconds = (elapsedSeconds / progress) * 100;
  return Math.ceil(totalEstimatedSeconds - elapsedSeconds);
}

/**
 * Detects the type of scrolling mechanism on the page
 */
function detectScrollType(): 'infinite' | 'pagination' | 'unknown' {
  // Check for pagination links
  const paginationSelectors = [
    '.pagination',
    '[class*="pagination"]',
    '[class*="pager"]',
    'nav[aria-label*="pagination"]',
    '.page-numbers',
  ];

  for (const selector of paginationSelectors) {
    if (document.querySelector(selector)) {
      return 'pagination';
    }
  }

  // Check for infinite scroll indicators
  const infiniteScrollSelectors = [
    '[data-infinite-scroll]',
    '[class*="infinite"]',
    '.load-more',
    '.loadmore',
  ];

  for (const selector of infiniteScrollSelectors) {
    if (document.querySelector(selector)) {
      return 'infinite';
    }
  }

  return 'unknown';
}

/**
 * Gets detailed progress information
 */
export function getProgressInfo(): {
  progress: number;
  itemsCollected: number;
  itemsPerSecond: number;
  estimatedRemaining: number;
  estimatedTotal: number;
  scrollType: string;
  elapsedTime: number;
} {
  const elapsedTime = scrollStartTime > 0 ? (Date.now() - scrollStartTime) / 1000 : 0;

  // Estimate total items if not set by config
  let totalEstimate = estimatedTotalItems;
  if (totalEstimate === 0 && itemsPerSecond > 0) {
    // Rough estimate based on scroll position
    const progress = estimateProgress();
    if (progress > 0 && progress < 100) {
      totalEstimate = Math.round((currentState.itemsCollected / progress) * 100);
    }
  }

  return {
    progress: estimateProgress(),
    itemsCollected: currentState.itemsCollected,
    itemsPerSecond: Math.round(itemsPerSecond * 10) / 10,
    estimatedRemaining: estimateRemainingTime(),
    estimatedTotal: totalEstimate,
    scrollType,
    elapsedTime: Math.round(elapsedTime),
  };
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

  // Initialize progress estimation
  scrollStartTime = Date.now();
  initialItemCount = countItems();
  scrollType = detectScrollType();
  estimatedTotalItems = config.maxItems && config.maxItems > 0 ? config.maxItems : 0;

  console.log(`[AutoScroller] Detected scroll type: ${scrollType}, initial items: ${initialItemCount}`);

  updateState({
    status: 'running',
    itemsCollected: initialItemCount,
  });

  setupMutationObserver();

  // Start scrolling immediately, then continue with throttled iterations
  void scrollIteration();
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
