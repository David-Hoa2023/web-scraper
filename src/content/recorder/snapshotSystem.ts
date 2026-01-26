/**
 * Snapshot System
 * Captures page layout snapshots at intervals for synchronization and context
 */

import type {
  PageSnapshot,
  Point,
  Dimensions,
  SnapshotCallback,
} from '../../types/recording';

export interface SnapshotSystem {
  /** Start taking periodic snapshots */
  start(intervalMs: number): void;
  /** Stop taking snapshots and return all captured */
  stop(): PageSnapshot[];
  /** Take an immediate snapshot */
  takeSnapshot(): Promise<PageSnapshot>;
  /** Get all snapshots */
  getSnapshots(): PageSnapshot[];
  /** Clear all snapshots */
  clear(): void;
  /** Subscribe to new snapshots */
  onSnapshot(callback: SnapshotCallback): () => void;
  /** Check if running */
  isRunning(): boolean;
}

/**
 * Create a new snapshot system instance
 */
export function createSnapshotSystem(): SnapshotSystem {
  let snapshots: PageSnapshot[] = [];
  const callbacks: Set<SnapshotCallback> = new Set();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let startTime = 0;

  function getTimestamp(): number {
    return Date.now() - startTime;
  }

  function emitSnapshot(snapshot: PageSnapshot): void {
    snapshots.push(snapshot);
    callbacks.forEach((cb) => cb(snapshot));
  }

  async function takeSnapshot(): Promise<PageSnapshot> {
    const snapshot: PageSnapshot = {
      timestamp: getTimestamp(),
      scrollPosition: getScrollPosition(),
      viewportSize: getViewportSize(),
      domHash: generateDomHash(),
      pageTitle: document.title,
      url: window.location.href,
    };

    emitSnapshot(snapshot);
    return snapshot;
  }

  function start(intervalMs: number): void {
    if (running) return;

    running = true;
    startTime = Date.now();
    snapshots = [];

    // Take initial snapshot
    takeSnapshot().catch(console.error);

    // Set up interval for periodic snapshots
    intervalId = setInterval(() => {
      takeSnapshot().catch(console.error);
    }, intervalMs);
  }

  function stop(): PageSnapshot[] {
    if (!running) return snapshots;

    running = false;

    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    // Take final snapshot
    takeSnapshot().catch(console.error);

    return snapshots;
  }

  function getSnapshots(): PageSnapshot[] {
    return [...snapshots];
  }

  function clear(): void {
    snapshots = [];
  }

  function onSnapshot(callback: SnapshotCallback): () => void {
    callbacks.add(callback);
    return () => callbacks.delete(callback);
  }

  function isRunning(): boolean {
    return running;
  }

  return {
    start,
    stop,
    takeSnapshot,
    getSnapshots,
    clear,
    onSnapshot,
    isRunning,
  };
}

/**
 * Generate a hash of the DOM content for change detection
 * Uses a simple hash based on structural properties
 */
export function generateDomHash(root: Element = document.body): string {
  const elements = root.querySelectorAll('*');
  const elementCount = elements.length;
  const textLength = root.textContent?.length || 0;
  const linkCount = root.querySelectorAll('a').length;
  const imageCount = root.querySelectorAll('img').length;
  const inputCount = root.querySelectorAll('input, textarea, select').length;

  // Simple hash combining structural metrics
  const hashInput = `${elementCount}-${textLength}-${linkCount}-${imageCount}-${inputCount}`;
  return simpleHash(hashInput);
}

/**
 * Simple string hash function (djb2)
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Get current scroll position
 */
export function getScrollPosition(): Point {
  return {
    x: window.scrollX || window.pageXOffset || 0,
    y: window.scrollY || window.pageYOffset || 0,
  };
}

/**
 * Get current viewport size
 */
export function getViewportSize(): Dimensions {
  return {
    width: window.innerWidth || document.documentElement.clientWidth,
    height: window.innerHeight || document.documentElement.clientHeight,
  };
}

/**
 * Get full page dimensions
 */
export function getPageSize(): Dimensions {
  const body = document.body;
  const html = document.documentElement;

  return {
    width: Math.max(
      body.scrollWidth,
      body.offsetWidth,
      html.clientWidth,
      html.scrollWidth,
      html.offsetWidth
    ),
    height: Math.max(
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    ),
  };
}

/**
 * Check if page content has changed since last snapshot
 */
export function hasContentChanged(
  previous: PageSnapshot,
  current: PageSnapshot
): boolean {
  // Check DOM hash
  if (previous.domHash !== current.domHash) {
    return true;
  }

  // Check URL (SPA navigation)
  if (previous.url !== current.url) {
    return true;
  }

  // Check title
  if (previous.pageTitle !== current.pageTitle) {
    return true;
  }

  return false;
}

/**
 * Calculate scroll percentage
 */
export function getScrollPercentage(): { x: number; y: number } {
  const pageSize = getPageSize();
  const viewport = getViewportSize();
  const scroll = getScrollPosition();

  const maxScrollX = Math.max(0, pageSize.width - viewport.width);
  const maxScrollY = Math.max(0, pageSize.height - viewport.height);

  return {
    x: maxScrollX > 0 ? (scroll.x / maxScrollX) * 100 : 0,
    y: maxScrollY > 0 ? (scroll.y / maxScrollY) * 100 : 0,
  };
}

/**
 * Check if element is in viewport
 */
export function isElementInViewport(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  const viewport = getViewportSize();

  return (
    rect.top < viewport.height &&
    rect.bottom > 0 &&
    rect.left < viewport.width &&
    rect.right > 0
  );
}

/**
 * Get visible elements of a certain type
 */
export function getVisibleElements(selector: string): Element[] {
  const elements = document.querySelectorAll(selector);
  return Array.from(elements).filter(isElementInViewport);
}
