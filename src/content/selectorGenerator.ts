/**
 * Selector Generator - Generates CSS selectors from detected patterns
 * Creates stable, reusable selectors for template saving
 */

import type { PatternMatch } from '../types';

export interface PatternSelectors {
  listContainerSelector: string;
  itemSelector: string;
  fullItemSelector: string; // `${container} > ${item}` or `${container} ${item}`
}

/**
 * CSS escape function for selector strings
 */
function cssEscape(s: string): string {
  // CSS.escape exists in modern Chrome
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(s);
  }
  // Fallback: escape special characters
  return s.replace(/([^\w-])/g, '\\$1');
}

/**
 * Check if a class name is stable (not a state/dynamic class)
 */
function isStableClass(c: string): boolean {
  // Filter out state classes
  const stateClasses = [
    'active', 'hover', 'focus', 'selected', 'disabled', 'open', 'close',
    'visible', 'hidden', 'show', 'hide', 'expanded', 'collapsed',
    'loading', 'loaded', 'error', 'success', 'warning',
  ];
  if (stateClasses.includes(c.toLowerCase())) return false;

  // Filter out framework-specific dynamic classes
  if (c.startsWith('ng-')) return false;  // Angular
  if (c.startsWith('css-')) return false; // Emotion/styled
  if (c.startsWith('sc-')) return false;  // Styled Components
  if (/^[a-z]{1,3}-[a-z0-9]{5,}$/i.test(c)) return false; // CSS modules hash

  // Must be at least 3 chars
  return c.length >= 3;
}

/**
 * Find common stable attribute across all elements
 */
function commonStableAttribute(
  el: Element,
  all: Element[]
): { name: string; value: string } | null {
  const candidates = [
    'data-testid', 'data-test', 'data-qa', 'data-id',
    'role', 'aria-label', 'data-type', 'data-category',
  ];

  for (const name of candidates) {
    const v = el.getAttribute(name);
    if (!v) continue;
    // Check if all items have the same attribute value (for role, etc.)
    // Or if they all have the attribute (for data-testid with different values)
    if (all.every(x => x.hasAttribute(name))) {
      // For attributes that vary per item, just check presence
      return { name, value: v };
    }
  }
  return null;
}

/**
 * Derive a selector that matches all sibling items
 */
function deriveItemSelector(items: Element[]): string {
  const first = items[0];
  if (!first) return '*';

  const tag = first.tagName.toLowerCase();

  // Find intersection of classes across all items
  let common = new Set<string>(Array.from(first.classList));
  for (const el of items.slice(1)) {
    const set = new Set(Array.from(el.classList));
    common = new Set(Array.from(common).filter(c => set.has(c)));
  }

  // Filter to stable classes and take up to 3
  const stable = Array.from(common).filter(isStableClass).slice(0, 3);
  if (stable.length) {
    return `${tag}.${stable.map(cssEscape).join('.')}`;
  }

  // Try stable attributes
  const attr = commonStableAttribute(first, items);
  if (attr) {
    // Check if attribute value varies (use just attribute presence)
    const values = items.map(x => x.getAttribute(attr.name));
    const allSame = values.every(v => v === values[0]);
    if (allSame) {
      return `${tag}[${attr.name}="${cssEscape(attr.value)}"]`;
    } else {
      return `${tag}[${attr.name}]`;
    }
  }

  // Last resort: tag only (works if container is correct)
  return tag;
}

/**
 * Generate a unique selector for a single element
 */
function uniqueSelector(el: Element): string {
  // Prefer unique id
  const id = el.getAttribute('id');
  if (id && !id.match(/^\d/) && !id.match(/^[a-z]{1,2}-[a-z0-9]{6,}$/i)) {
    const sel = `#${cssEscape(id)}`;
    try {
      if (document.querySelectorAll(sel).length === 1) return sel;
    } catch {
      // Invalid selector, continue
    }
  }

  // Prefer stable attributes
  const stableAttrs = ['data-testid', 'data-test', 'data-qa', 'data-id', 'role', 'aria-label'];
  for (const a of stableAttrs) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const sel = `${el.tagName.toLowerCase()}[${a}="${cssEscape(v)}"]`;
    try {
      if (document.querySelectorAll(sel).length === 1) return sel;
    } catch {
      // Invalid selector, continue
    }
  }

  // Build a path with nth-of-type
  const parts: string[] = [];
  let cur: Element | null = el;

  while (cur && cur !== document.documentElement) {
    let part = cur.tagName.toLowerCase();

    // Add stable classes
    const cls = Array.from(cur.classList).filter(isStableClass).slice(0, 2);
    if (cls.length) {
      part += '.' + cls.map(cssEscape).join('.');
    }

    // Add nth-of-type if needed
    const parentEl: Element | null = cur.parentElement;
    if (parentEl) {
      const sameTag = Array.from(parentEl.children).filter((x: Element) => x.tagName === cur!.tagName);
      if (sameTag.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(cur) + 1})`;
      }
    }

    parts.unshift(part);

    // Stop early if the path is already unique
    const candidate = parts.join(' > ');
    try {
      if (document.querySelectorAll(candidate).length === 1) return candidate;
    } catch {
      // Invalid selector, continue building
    }

    cur = parentEl;
  }

  return parts.join(' > ');
}

/**
 * Build selectors from a detected pattern
 */
export function buildSelectorsFromPattern(p: PatternMatch): PatternSelectors {
  const listContainerSelector = uniqueSelector(p.container);

  // Check if items are direct children of container
  const direct = p.siblings.every(s => s.parentElement === p.container);

  const itemSelector = deriveItemSelector(p.siblings);
  const fullItemSelector = direct
    ? `${listContainerSelector} > ${itemSelector}`
    : `${listContainerSelector} ${itemSelector}`;

  return { listContainerSelector, itemSelector, fullItemSelector };
}

/**
 * Validate that a selector works and returns expected count
 */
export function validateSelector(selector: string, expectedMin: number = 1): boolean {
  try {
    const elements = document.querySelectorAll(selector);
    return elements.length >= expectedMin;
  } catch {
    return false;
  }
}
