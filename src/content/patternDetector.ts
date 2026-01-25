/**
 * Enhanced Pattern Detection Module
 * Detects repeating patterns in DOM elements based on configurable matching criteria
 */

import type { PatternMatch, PatternDetectorConfig } from '../types';

// Constants for overlay styling
const OVERLAY_ID = 'web-scraper-pattern-overlay';
const BADGE_ID = 'web-scraper-pattern-badge';
const OVERLAY_BORDER_COLOR = '#22c55e'; // Green
const OVERLAY_BORDER_WIDTH = '2px';
const OVERLAY_BACKGROUND = 'rgba(34, 197, 94, 0.1)';
const BADGE_BACKGROUND = '#22c55e';
const BADGE_TEXT_COLOR = '#ffffff';

/**
 * Default configuration for pattern detection
 */
export const defaultConfig: PatternDetectorConfig = {
  matchBy: ['tag', 'class'],
  minSiblings: 2,
  depthLimit: 3,
};

/**
 * Extracts element signature based on configured matching criteria
 */
function getElementSignature(
  element: Element,
  matchBy: PatternDetectorConfig['matchBy']
): string {
  const parts: string[] = [];

  for (const criterion of matchBy) {
    switch (criterion) {
      case 'tag':
        parts.push(`tag:${element.tagName.toLowerCase()}`);
        break;
      case 'class':
        if (element.classList.length > 0) {
          const sortedClasses = Array.from(element.classList).sort();
          parts.push(`class:${sortedClasses.join(',')}`);
        }
        break;
      case 'id':
        // ID matching checks for patterns (e.g., item-1, item-2)
        if (element.id) {
          const idPattern = element.id.replace(/\d+/g, '#');
          parts.push(`id:${idPattern}`);
        }
        break;
      case 'data':
        const dataAttrs = getDataAttributes(element);
        if (Object.keys(dataAttrs).length > 0) {
          const dataKeys = Object.keys(dataAttrs).sort();
          parts.push(`data:${dataKeys.join(',')}`);
        }
        break;
      case 'aria':
        const ariaAttrs = getAriaAttributes(element);
        if (Object.keys(ariaAttrs).length > 0) {
          const ariaKeys = Object.keys(ariaAttrs).sort();
          parts.push(`aria:${ariaKeys.join(',')}`);
        }
        break;
    }
  }

  return parts.join('|');
}

/**
 * Extracts all data-* attributes from an element
 */
function getDataAttributes(element: Element): Record<string, string> {
  const dataAttrs: Record<string, string> = {};
  for (const attr of element.attributes) {
    if (attr.name.startsWith('data-')) {
      const key = attr.name.slice(5); // Remove 'data-' prefix
      dataAttrs[key] = attr.value;
    }
  }
  return dataAttrs;
}

/**
 * Extracts all aria-* attributes from an element
 */
function getAriaAttributes(element: Element): Record<string, string> {
  const ariaAttrs: Record<string, string> = {};
  for (const attr of element.attributes) {
    if (attr.name.startsWith('aria-')) {
      const key = attr.name.slice(5); // Remove 'aria-' prefix
      ariaAttrs[key] = attr.value;
    }
  }
  return ariaAttrs;
}

/**
 * Calculates confidence score based on match quality
 * @returns Score between 0 and 1
 */
function calculateConfidence(
  element: Element,
  siblings: Element[],
  config: PatternDetectorConfig
): number {
  let score = 0;
  const maxScore = config.matchBy.length * 2;

  // Base score for each matching criterion
  for (const criterion of config.matchBy) {
    switch (criterion) {
      case 'tag':
        // Tag match is most reliable
        score += 2;
        break;
      case 'class':
        // Class match depends on number of classes
        if (element.classList.length > 0) {
          score += Math.min(element.classList.length, 2);
        }
        break;
      case 'id':
        // ID pattern match is valuable
        if (element.id) {
          score += 1.5;
        }
        break;
      case 'data':
        // Data attributes indicate semantic structure
        const dataCount = Object.keys(getDataAttributes(element)).length;
        if (dataCount > 0) {
          score += Math.min(dataCount * 0.5, 1.5);
        }
        break;
      case 'aria':
        // ARIA attributes indicate interactive elements
        const ariaCount = Object.keys(getAriaAttributes(element)).length;
        if (ariaCount > 0) {
          score += Math.min(ariaCount * 0.5, 1);
        }
        break;
    }
  }

  // Bonus for more siblings (capped)
  const siblingBonus = Math.min(siblings.length / 10, 0.3);
  score += siblingBonus * maxScore;

  // Normalize to 0-1 range
  return Math.min(score / maxScore, 1);
}

/**
 * Finds sibling elements with the same signature
 */
function findMatchingSiblings(
  parent: Element,
  signature: string,
  matchBy: PatternDetectorConfig['matchBy'],
  originalElement: Element
): Element[] {
  const siblings: Element[] = [];

  for (const child of parent.children) {
    if (child === originalElement) continue;

    const childSignature = getElementSignature(child, matchBy);
    if (childSignature === signature) {
      siblings.push(child);
    }
  }

  return siblings;
}

/**
 * Detects a repeating pattern for the given element
 * @param element - The element to analyze
 * @param config - Pattern detection configuration
 * @returns PatternMatch if a pattern is found, null otherwise
 */
export function detectPattern(
  element: Element,
  config: PatternDetectorConfig = defaultConfig
): PatternMatch | null {
  // Skip non-element nodes and special elements
  if (
    !element ||
    element.nodeType !== Node.ELEMENT_NODE ||
    element.tagName === 'BODY' ||
    element.tagName === 'HTML' ||
    element.tagName === 'HEAD'
  ) {
    return null;
  }

  // Try to find patterns at increasing depth levels
  let currentElement = element;
  let depth = 0;

  while (currentElement && depth < config.depthLimit) {
    const parent = currentElement.parentElement;
    if (!parent || parent.tagName === 'BODY' || parent.tagName === 'HTML') {
      // Try current element's parent one more time before giving up
      if (parent && parent.children.length > 1) {
        const signature = getElementSignature(currentElement, config.matchBy);
        const siblings = findMatchingSiblings(
          parent,
          signature,
          config.matchBy,
          currentElement
        );

        if (siblings.length >= config.minSiblings) {
          const confidence = calculateConfidence(
            currentElement,
            siblings,
            config
          );

          return {
            tag: currentElement.tagName.toLowerCase(),
            classes: Array.from(currentElement.classList),
            id: currentElement.id || undefined,
            dataAttrs: getDataAttributes(currentElement),
            ariaAttrs: getAriaAttributes(currentElement),
            parent: parent,
            siblings: [currentElement, ...siblings],
            confidence,
          };
        }
      }
      break;
    }

    const signature = getElementSignature(currentElement, config.matchBy);
    const siblings = findMatchingSiblings(
      parent,
      signature,
      config.matchBy,
      currentElement
    );

    if (siblings.length >= config.minSiblings) {
      const confidence = calculateConfidence(currentElement, siblings, config);

      return {
        tag: currentElement.tagName.toLowerCase(),
        classes: Array.from(currentElement.classList),
        id: currentElement.id || undefined,
        dataAttrs: getDataAttributes(currentElement),
        ariaAttrs: getAriaAttributes(currentElement),
        parent: parent,
        siblings: [currentElement, ...siblings],
        confidence,
      };
    }

    // Move up the DOM tree
    currentElement = parent;
    depth++;
  }

  return null;
}

// Click handler callback
let onPatternClickCallback: (() => void) | null = null;

/**
 * Sets a callback to be called when the pattern overlay is clicked
 */
export function setOnPatternClick(callback: (() => void) | null): void {
  onPatternClickCallback = callback;
}

/**
 * Creates or gets the overlay element
 */
function getOrCreateOverlay(): HTMLDivElement {
  let overlay = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = `
      position: fixed;
      pointer-events: auto;
      cursor: pointer;
      border: ${OVERLAY_BORDER_WIDTH} solid ${OVERLAY_BORDER_COLOR};
      background: ${OVERLAY_BACKGROUND};
      z-index: 2147483647;
      transition: all 0.15s ease-out;
      box-sizing: border-box;
    `;

    // Add click handler
    overlay.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onPatternClickCallback) {
        onPatternClickCallback();
      }
    });

    document.body.appendChild(overlay);
  }

  return overlay;
}

/**
 * Creates or gets the badge element
 */
function getOrCreateBadge(): HTMLDivElement {
  let badge = document.getElementById(BADGE_ID) as HTMLDivElement | null;

  if (!badge) {
    badge = document.createElement('div');
    badge.id = BADGE_ID;
    badge.style.cssText = `
      position: fixed;
      pointer-events: auto;
      cursor: pointer;
      background: ${BADGE_BACKGROUND};
      color: ${BADGE_TEXT_COLOR};
      padding: 4px 12px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: bold;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 2147483647;
      transition: all 0.15s ease-out;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;

    // Add click handler
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onPatternClickCallback) {
        onPatternClickCallback();
      }
    });

    document.body.appendChild(badge);
  }

  return badge;
}

/**
 * Calculates the bounding rect that encompasses all matched elements
 */
function getCombinedBounds(elements: Element[]): DOMRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    minX = Math.min(minX, rect.left);
    minY = Math.min(minY, rect.top);
    maxX = Math.max(maxX, rect.right);
    maxY = Math.max(maxY, rect.bottom);
  }

  return new DOMRect(minX, minY, maxX - minX, maxY - minY);
}

/**
 * Highlights the detected pattern with an overlay and count badge
 * @param match - The pattern match to highlight
 */
export function highlightPattern(match: PatternMatch): void {
  const overlay = getOrCreateOverlay();
  const badge = getOrCreateBadge();

  // Get bounds of all matched elements
  const bounds = getCombinedBounds(match.siblings);

  // Position overlay
  overlay.style.left = `${bounds.left}px`;
  overlay.style.top = `${bounds.top}px`;
  overlay.style.width = `${bounds.width}px`;
  overlay.style.height = `${bounds.height}px`;
  overlay.style.display = 'block';

  // Update and position badge
  const count = match.siblings.length;
  badge.textContent = `▶ Scrape ${count} items`;
  badge.style.left = `${bounds.right - 120}px`;
  badge.style.top = `${bounds.top - 28}px`;
  badge.style.display = 'block';

  // Ensure badge stays in viewport
  const badgeRect = badge.getBoundingClientRect();
  if (badgeRect.top < 0) {
    badge.style.top = `${bounds.top + 4}px`;
  }
  if (badgeRect.right > window.innerWidth) {
    badge.style.left = `${window.innerWidth - 130}px`;
  }
  if (badgeRect.left < 0) {
    badge.style.left = '10px';
  }
}

/**
 * Hides the pattern highlight overlay
 */
export function hideHighlight(): void {
  const overlay = document.getElementById(OVERLAY_ID);
  const badge = document.getElementById(BADGE_ID);

  if (overlay) {
    overlay.style.display = 'none';
  }
  if (badge) {
    badge.style.display = 'none';
  }
}

/**
 * Removes the overlay elements from the DOM
 */
export function removeOverlay(): void {
  const overlay = document.getElementById(OVERLAY_ID);
  const badge = document.getElementById(BADGE_ID);

  if (overlay) {
    overlay.remove();
  }
  if (badge) {
    badge.remove();
  }
}

// Export for testing
export const _internal = {
  getElementSignature,
  getDataAttributes,
  getAriaAttributes,
  calculateConfidence,
  findMatchingSiblings,
  getCombinedBounds,
};
