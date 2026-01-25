/**
 * Shadow DOM Handler Module for Web Scraper Chrome Extension
 *
 * Provides utilities to detect, traverse, and interact with
 * Shadow DOM elements and web components.
 */

import type { PatternMatch, PatternDetectorConfig, ExtractionConfig, ExtractedItem } from '../types';
import { detectPattern } from './patternDetector';
import { extractData } from './dataExtractor';

/**
 * Checks if an element has a shadow root
 */
export function hasShadowRoot(element: Element): boolean {
  return element.shadowRoot !== null;
}

/**
 * Gets the shadow root of an element (if accessible)
 * Note: Closed shadow roots are not accessible
 */
export function getShadowRoot(element: Element): ShadowRoot | null {
  return element.shadowRoot;
}

/**
 * Recursively queries within shadow boundaries
 * Traverses both light DOM and shadow DOMs
 */
export function queryShadowRoot(
  root: Element | Document | ShadowRoot,
  selector: string
): Element[] {
  const results: Element[] = [];

  // Query in current scope
  const matches = root.querySelectorAll(selector);
  results.push(...Array.from(matches));

  // Recursively query shadow roots
  const allElements = root.querySelectorAll('*');
  allElements.forEach((element) => {
    const shadow = element.shadowRoot;
    if (shadow) {
      results.push(...queryShadowRoot(shadow, selector));
    }
  });

  return results;
}

/**
 * Finds all elements including those in shadow DOMs
 */
export function queryAllIncludingShadow(selector: string): Element[] {
  return queryShadowRoot(document, selector);
}

/**
 * Gets all shadow hosts in a document or container
 */
export function getShadowHosts(root: Element | Document | ShadowRoot = document): Element[] {
  const hosts: Element[] = [];

  const allElements = root.querySelectorAll('*');
  allElements.forEach((element) => {
    if (element.shadowRoot) {
      hosts.push(element);
      // Recursively find nested shadow hosts
      hosts.push(...getShadowHosts(element.shadowRoot));
    }
  });

  return hosts;
}

/**
 * Gets the composed path to an element (including shadow boundaries)
 */
export function getComposedPath(element: Element): Element[] {
  const path: Element[] = [];
  let current: Element | null = element;

  while (current) {
    path.push(current);

    // Check if we're in a shadow root
    const root = current.getRootNode();
    if (root instanceof ShadowRoot) {
      // Add the shadow host and continue up
      current = root.host;
    } else {
      current = current.parentElement;
    }
  }

  return path;
}

/**
 * Detects patterns within shadow DOMs
 */
export function detectPatternInShadow(
  element: Element,
  config?: PatternDetectorConfig
): PatternMatch | null {
  // First try regular detection
  let match = detectPattern(element, config);
  if (match) return match;

  // Check if element is inside a shadow root - still try normal detection
  // since the element itself is valid
  const root = element.getRootNode();
  if (root instanceof ShadowRoot) {
    // Element is inside shadow DOM, detection already attempted above
    // Try with parent if available
    const host = root.host;
    if (host) {
      match = detectPattern(host, config);
      if (match) return match;
    }
  }

  // Check if element has its own shadow root with patterns
  if (element.shadowRoot) {
    const shadowChildren = element.shadowRoot.querySelectorAll('*');
    for (const child of shadowChildren) {
      match = detectPattern(child, config);
      if (match) return match;
    }
  }

  return null;
}

/**
 * Extracts data from elements including shadow DOM content
 */
export function extractDataFromShadow(
  element: Element,
  config?: ExtractionConfig
): ExtractedItem {
  // Regular extraction first
  const item = extractData(element, config);

  // If element has shadow root, extract from there too
  if (element.shadowRoot) {
    const shadowContent = extractShadowContent(element.shadowRoot, config);
    if (Object.keys(shadowContent).length > 0) {
      item._shadowContent = shadowContent;
    }
  }

  return item;
}

/**
 * Extracts content from a shadow root
 */
function extractShadowContent(
  shadowRoot: ShadowRoot,
  config?: ExtractionConfig
): ExtractedItem {
  const item: ExtractedItem = {};

  // Find main content elements in shadow
  const contentElements = shadowRoot.querySelectorAll(
    'article, section, main, [role="main"], .content, .body'
  );

  if (contentElements.length > 0) {
    const extracted = extractData(contentElements[0], config);
    Object.assign(item, extracted);
  } else {
    // Fall back to first meaningful element
    const firstElement = shadowRoot.querySelector('div, span, p');
    if (firstElement) {
      const extracted = extractData(firstElement, config);
      Object.assign(item, extracted);
    }
  }

  return item;
}

/**
 * Queries using ::part() selectors for web components
 * Note: ::part() only works in CSS, this simulates the behavior
 */
export function queryByPart(
  element: Element,
  partName: string
): Element[] {
  const results: Element[] = [];

  if (element.shadowRoot) {
    const parted = element.shadowRoot.querySelectorAll(`[part="${partName}"], [part~="${partName}"]`);
    results.push(...Array.from(parted));
  }

  return results;
}

/**
 * Gets all elements with exposed parts in a shadow DOM
 */
export function getExposedParts(element: Element): Map<string, Element[]> {
  const parts = new Map<string, Element[]>();

  if (!element.shadowRoot) return parts;

  const partedElements = element.shadowRoot.querySelectorAll('[part]');
  partedElements.forEach((el) => {
    const partAttr = el.getAttribute('part');
    if (partAttr) {
      const partNames = partAttr.split(/\s+/);
      partNames.forEach((name) => {
        if (!parts.has(name)) {
          parts.set(name, []);
        }
        parts.get(name)!.push(el);
      });
    }
  });

  return parts;
}

/**
 * Checks if a custom element is defined
 */
export function isCustomElementDefined(tagName: string): boolean {
  return customElements.get(tagName) !== undefined;
}

/**
 * Waits for a custom element to be defined
 */
export async function waitForCustomElement(
  tagName: string,
  timeoutMs: number = 5000
): Promise<CustomElementConstructor | null> {
  if (isCustomElementDefined(tagName)) {
    return customElements.get(tagName) || null;
  }

  try {
    await Promise.race([
      customElements.whenDefined(tagName),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      ),
    ]);
    return customElements.get(tagName) || null;
  } catch {
    return null;
  }
}

/**
 * Finds all custom elements in a container
 */
export function findCustomElements(
  root: Element | Document = document
): Element[] {
  const customElements: Element[] = [];

  const allElements = root.querySelectorAll('*');
  allElements.forEach((element) => {
    // Custom elements have a hyphen in their tag name
    if (element.tagName.includes('-')) {
      customElements.push(element);
    }
  });

  return customElements;
}

/**
 * Observer for shadow DOM changes
 */
export function observeShadowChanges(
  element: Element,
  callback: (mutations: MutationRecord[]) => void
): MutationObserver | null {
  if (!element.shadowRoot) return null;

  const observer = new MutationObserver(callback);
  observer.observe(element.shadowRoot, {
    childList: true,
    subtree: true,
    attributes: true,
  });

  return observer;
}

/**
 * Fallback mechanism for heavily dynamic sites
 * Attempts multiple strategies to access content
 */
export function accessDynamicContent(element: Element): {
  content: string;
  method: 'direct' | 'shadow' | 'slot' | 'fallback';
} {
  // Strategy 1: Direct content
  if (element.textContent && element.textContent.trim()) {
    return { content: element.textContent.trim(), method: 'direct' };
  }

  // Strategy 2: Shadow DOM content
  if (element.shadowRoot) {
    const shadowText = element.shadowRoot.textContent?.trim();
    if (shadowText) {
      return { content: shadowText, method: 'shadow' };
    }
  }

  // Strategy 3: Slotted content
  const slots = element.querySelectorAll('slot');
  for (const slot of slots) {
    const slottedNodes = (slot as HTMLSlotElement).assignedNodes();
    const slotText = slottedNodes
      .map((node) => node.textContent?.trim())
      .filter(Boolean)
      .join(' ');
    if (slotText) {
      return { content: slotText, method: 'slot' };
    }
  }

  // Strategy 4: Fallback - get computed text
  const computedContent = window.getComputedStyle(element).content;
  if (computedContent && computedContent !== 'none' && computedContent !== 'normal') {
    return { content: computedContent.replace(/['"]/g, ''), method: 'fallback' };
  }

  return { content: '', method: 'fallback' };
}
