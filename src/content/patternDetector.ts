/**
 * Enhanced Pattern Detection Module with Fingerprinting
 * Detects structural list patterns robustly, refactored for dynamic sites.
 */

import type { PatternMatch, PatternDetectorConfig, Fingerprint } from '../types';

// Constants for overlay styling
const OVERLAY_ID = 'web-scraper-pattern-overlay';
const BADGE_ID = 'web-scraper-pattern-badge';

// Configuration
export const defaultConfig: PatternDetectorConfig = {
  matchBy: ['tag', 'class'], // kept for compat, moving towards fingerprint
  minListItems: 3,
  allowSingleFallback: true,
  simThreshold: 0.62,
  depthLimit: 12,
};

// --- Fingerprinting Logic ---

/**
 * Generates a structural fingerprint for an element
 */
function getFingerprint(element: Element): Fingerprint {
  return {
    tag: element.tagName.toLowerCase(),
    classes: Array.from(element.classList),
    attrs: getStableAttributes(element),
    depth: 0, // Assigned relative to container later
    childCount: element.children.length
  };
}

/**
 * Extracts attributes likely to be stable (data-*, aria-*, etc)
 */
function getStableAttributes(element: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of element.attributes) {
    if (attr.name.startsWith('data-') || attr.name.startsWith('aria-') || attr.name === 'role') {
      attrs[attr.name] = attr.value;
    }
  }
  return attrs;
}

/**
 * Calculates similarity between two fingerprints (0 to 1)
 */
function calculateSimilarity(fp1: Fingerprint, fp2: Fingerprint): number {
  if (fp1.tag !== fp2.tag) return 0;

  // Jaccard for structure/classes (classes not strict)
  const classSim = getJaccardSimilarity(fp1.classes, fp2.classes);

  // Attribute match score
  const attrs1 = Object.keys(fp1.attrs);
  const attrs2 = Object.keys(fp2.attrs);
  const attrSim = getJaccardSimilarity(attrs1, attrs2);

  // Child count similarity (allow small variance)
  const childSim = Math.min(fp1.childCount, fp2.childCount) / (Math.max(fp1.childCount, fp2.childCount) || 1);

  // Weighted score: Tag is mandatory (already checked). Structure matters most.
  // 30% Class, 30% Attr keys, 40% Child Structure
  return (classSim * 0.3) + (attrSim * 0.3) + (childSim * 0.4);
}

function getJaccardSimilarity(set1: string[], set2: string[]): number {
  if (set1.length === 0 && set2.length === 0) return 1;
  const intersection = set1.filter(x => set2.includes(x));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.length / union.size;
}

// --- Detection Logic ---

/**
 * Detects patterns starting from the hovered element
 */
export function detectPattern(
  target: Element, // Was 'element'
  config: PatternDetectorConfig = defaultConfig
): PatternMatch | null {
  if (!(target instanceof Element)) return null;

  let currentElement: Element | null = target;
  let depth = 0;
  let bestMatch: PatternMatch | null = null;

  while (currentElement && depth < config.depthLimit) {
    const container = currentElement.parentElement as Element | null;
    if (!container || container.tagName === 'BODY' || container.tagName === 'HTML') break;

    const fpTarget = getFingerprint(currentElement);
    const siblings = Array.from(container.children).filter((node): node is Element => {
      const el = node as Element;
      if (el === currentElement) return true; // Include self
      if (el.id === OVERLAY_ID || el.id === BADGE_ID) return false;
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return false;

      const fpSib = getFingerprint(el);
      return calculateSimilarity(fpTarget, fpSib) >= config.simThreshold;
    });

    const isList = siblings.length >= config.minListItems;

    // We found a list OR we allow single item fallback
    if (isList || config.allowSingleFallback) {
      const match: PatternMatch = {
        container: container,
        fingerprint: fpTarget,
        siblings: siblings,
        isSingle: !isList,
        confidence: isList ? 0.9 : 0.5
      };

      // Prioritize lists over single items, then deeper (more specific) lists
      if (isList) {
        if (!bestMatch || bestMatch.isSingle || siblings.length > bestMatch.siblings.length) {
          bestMatch = match;
        }
      } else if (!bestMatch) {
        bestMatch = match;
      }
    }

    currentElement = container;
    depth++;
  }

  return bestMatch;
}

// --- Highlighting ---

let lastHighlighted: HTMLElement[] = [];
let isPatternLocked = false;

export function isLocked(): boolean {
  return isPatternLocked;
}

export function lockPattern(): void {
  isPatternLocked = true;
  // Update badge to show locked state
  const badge = document.getElementById(BADGE_ID);
  if (badge) {
    badge.style.backgroundColor = '#3b82f6'; // Blue for locked
    badge.textContent = '✓ Pattern Locked - Click Start Scanning';
  }
  // Update highlight style to show locked
  for (const el of lastHighlighted) {
    el.style.setProperty('outline', '3px solid #3b82f6', 'important');
    el.style.setProperty('background-color', 'rgba(59, 130, 246, 0.15)', 'important');
  }
}

export function unlockPattern(): void {
  isPatternLocked = false;
}

export function highlightPattern(match: PatternMatch): void {
  // Clear old
  hideHighlight();

  const outline = match.isSingle ? "2px solid #facc15" : "2px solid #22c55e"; // Yellow vs Green
  const bg = match.isSingle ? "rgba(250, 204, 21, 0.08)" : "rgba(34, 197, 94, 0.08)";

  for (const el of match.siblings) {
    if (el instanceof HTMLElement) {
      // Use setProperty with !important to ensure styles are applied
      el.style.setProperty('outline', outline, 'important');
      el.style.setProperty('background-color', bg, 'important');
      el.style.setProperty('cursor', 'pointer', 'important');
      // Add data-attribute to mark as scraped candidate
      el.setAttribute('data-scraper-highlight', 'true');
      lastHighlighted.push(el);
    }
  }

  // Show Badge on first item
  const first = match.siblings[0];
  if (first) {
    showBadge(first, match.siblings.length);
  }
}

export function hideHighlight(force: boolean = false): void {
  // Don't hide if pattern is locked (unless forced)
  if (isPatternLocked && !force) return;

  for (const el of lastHighlighted) {
    el.style.removeProperty('outline');
    el.style.removeProperty('background-color');
    el.style.removeProperty('cursor');
    el.removeAttribute('data-scraper-highlight');
  }
  lastHighlighted = [];
  isPatternLocked = false;
  const badge = document.getElementById(BADGE_ID);
  if (badge) badge.remove();
}

function showBadge(anchor: Element, count: number) {
  let badge = document.getElementById(BADGE_ID);
  if (!badge) {
    badge = document.createElement('div');
    badge.id = BADGE_ID;
    Object.assign(badge.style, {
      position: 'fixed',
      zIndex: '2147483647',
      padding: '4px 8px',
      backgroundColor: '#22c55e',
      color: 'white',
      borderRadius: '4px',
      fontSize: '12px',
      pointerEvents: 'none',
      fontWeight: 'bold'
    });
    document.body.appendChild(badge);
  }

  const rect = anchor.getBoundingClientRect();
  badge.textContent = `Scrape ${count} items`;
  badge.style.top = `${Math.max(0, rect.top - 30)}px`;
  badge.style.left = `${rect.left}px`;
}

// Click Handler State
let onPatternClickCallback: (() => void) | null = null;

// Allow click on highlighted items to trigger
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (onPatternClickCallback && target.hasAttribute('data-scraper-highlight')) {
    e.preventDefault();
    e.stopPropagation();
    onPatternClickCallback();
  }
}, true);

export function setOnPatternClick(callback: (() => void) | null): void {
  onPatternClickCallback = callback;
}

// Exports for testing
export const _internal = {
  getFingerprint,
  calculateSimilarity,
  getJaccardSimilarity
};
