/**
 * Pattern Refinement Module
 * Provides UI for manual pattern adjustment and refinement
 */

import type { PatternMatch } from '../types';
import { detectPattern, defaultConfig } from './patternDetector';

// ============================================================================
// Types
// ============================================================================

export interface PatternRefinement {
  /** Add an element to the pattern */
  addToPattern(element: Element): void;
  /** Remove an element from the pattern */
  removeFromPattern(element: Element): void;
  /** Adjust pattern boundary */
  adjustBoundary(direction: 'expand' | 'contract'): void;
  /** Get the current adjusted pattern */
  getAdjustedPattern(): PatternMatch;
  /** Get original pattern */
  getOriginalPattern(): PatternMatch;
  /** Reset to original pattern */
  reset(): void;
  /** Check if pattern has been modified */
  isModified(): boolean;
  /** Get list of added elements */
  getAddedElements(): Element[];
  /** Get list of removed elements */
  getRemovedElements(): Element[];
}

export interface RefinementOverlayConfig {
  /** Color for included elements */
  includedColor: string;
  /** Color for excluded elements */
  excludedColor: string;
  /** Color for hover preview */
  hoverColor: string;
  /** Color for the main pattern boundary */
  boundaryColor: string;
  /** Show confidence score */
  showConfidence: boolean;
  /** Show element count */
  showCount: boolean;
  /** Allow manual element selection */
  allowManualSelection: boolean;
}

export const DEFAULT_REFINEMENT_CONFIG: RefinementOverlayConfig = {
  includedColor: '#22c55e', // Green
  excludedColor: '#ef4444', // Red
  hoverColor: '#3b82f6', // Blue
  boundaryColor: '#8b5cf6', // Purple
  showConfidence: true,
  showCount: true,
  allowManualSelection: true,
};

// ============================================================================
// Overlay IDs
// ============================================================================

const REFINEMENT_OVERLAY_ID = 'web-scraper-refinement-overlay';
const REFINEMENT_PANEL_ID = 'web-scraper-refinement-panel';
const ELEMENT_HIGHLIGHT_CLASS = 'web-scraper-element-highlight';

// ============================================================================
// Pattern Refinement Implementation
// ============================================================================

/**
 * Create a pattern refinement instance
 */
export function createPatternRefinement(
  initialMatch: PatternMatch
): PatternRefinement {
  const originalMatch = { ...initialMatch };
  let currentSiblings = [...initialMatch.siblings];
  const addedElements: Set<Element> = new Set();
  const removedElements: Set<Element> = new Set();

  function addToPattern(element: Element): void {
    if (!currentSiblings.includes(element)) {
      currentSiblings.push(element);
      addedElements.add(element);
      removedElements.delete(element);
    }
  }

  function removeFromPattern(element: Element): void {
    const index = currentSiblings.indexOf(element);
    if (index !== -1) {
      currentSiblings.splice(index, 1);
      removedElements.add(element);
      addedElements.delete(element);
    }
  }

  function adjustBoundary(direction: 'expand' | 'contract'): void {
    const parent = originalMatch.parent;
    if (!parent) return;

    if (direction === 'expand') {
      // Try to include more siblings with similar structure
      const signature = getSimplifiedSignature(currentSiblings[0]);
      for (const child of parent.children) {
        if (!currentSiblings.includes(child)) {
          const childSig = getSimplifiedSignature(child);
          if (childSig === signature) {
            currentSiblings.push(child);
            addedElements.add(child);
          }
        }
      }
    } else {
      // Contract: remove elements that are least similar
      if (currentSiblings.length > 2) {
        // Keep at least 2 elements
        const scores = currentSiblings.map((el) => ({
          element: el,
          score: calculateSimilarityScore(el, currentSiblings),
        }));
        scores.sort((a, b) => a.score - b.score);
        const toRemove = scores[0].element;
        removeFromPattern(toRemove);
      }
    }
  }

  function getAdjustedPattern(): PatternMatch {
    const confidence = calculateAdjustedConfidence(
      currentSiblings,
      originalMatch.confidence
    );

    return {
      ...originalMatch,
      siblings: [...currentSiblings],
      confidence,
    };
  }

  function getOriginalPattern(): PatternMatch {
    return { ...originalMatch };
  }

  function reset(): void {
    currentSiblings = [...originalMatch.siblings];
    addedElements.clear();
    removedElements.clear();
  }

  function isModified(): boolean {
    return addedElements.size > 0 || removedElements.size > 0;
  }

  function getAddedElements(): Element[] {
    return Array.from(addedElements);
  }

  function getRemovedElements(): Element[] {
    return Array.from(removedElements);
  }

  return {
    addToPattern,
    removeFromPattern,
    adjustBoundary,
    getAdjustedPattern,
    getOriginalPattern,
    reset,
    isModified,
    getAddedElements,
    getRemovedElements,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get simplified element signature for comparison
 */
function getSimplifiedSignature(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const classes = Array.from(element.classList).sort().join(',');
  return `${tag}:${classes}`;
}

/**
 * Calculate similarity score for an element within a group
 */
function calculateSimilarityScore(element: Element, group: Element[]): number {
  let score = 0;
  const signature = getSimplifiedSignature(element);

  for (const other of group) {
    if (other === element) continue;
    if (getSimplifiedSignature(other) === signature) {
      score += 1;
    }
  }

  return score / (group.length - 1);
}

/**
 * Calculate adjusted confidence after refinement
 */
function calculateAdjustedConfidence(
  elements: Element[],
  originalConfidence: number
): number {
  // More elements generally means higher confidence
  const countBonus = Math.min(elements.length / 20, 0.1);

  // Check structural consistency
  const signatures = elements.map(getSimplifiedSignature);
  const uniqueSignatures = new Set(signatures);
  const consistencyPenalty = (uniqueSignatures.size - 1) * 0.05;

  return Math.max(0, Math.min(1, originalConfidence + countBonus - consistencyPenalty));
}

// ============================================================================
// Refinement Overlay UI
// ============================================================================

let currentRefinement: PatternRefinement | null = null;
let overlayConfig = { ...DEFAULT_REFINEMENT_CONFIG };
let selectionMode: 'add' | 'remove' | null = null;
let onRefinementChange: ((pattern: PatternMatch) => void) | null = null;

/**
 * Show refinement overlay for a pattern
 */
export function showRefinementOverlay(
  match: PatternMatch,
  config?: Partial<RefinementOverlayConfig>
): PatternRefinement {
  overlayConfig = { ...DEFAULT_REFINEMENT_CONFIG, ...config };
  currentRefinement = createPatternRefinement(match);

  createOverlayUI();
  highlightPatternElements(match);
  updatePanel();

  return currentRefinement;
}

/**
 * Hide and remove the refinement overlay
 */
export function hideRefinementOverlay(): void {
  removeOverlayUI();
  removeElementHighlights();
  currentRefinement = null;
  selectionMode = null;
}

/**
 * Set callback for refinement changes
 */
export function onRefinementChanged(
  callback: ((pattern: PatternMatch) => void) | null
): void {
  onRefinementChange = callback;
}

/**
 * Create the overlay UI elements
 */
function createOverlayUI(): void {
  // Remove existing overlay
  removeOverlayUI();

  // Create main overlay container
  const overlay = document.createElement('div');
  overlay.id = REFINEMENT_OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 2147483646;
  `;

  // Create control panel
  const panel = document.createElement('div');
  panel.id = REFINEMENT_PANEL_ID;
  panel.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1a1a2e;
    color: #ffffff;
    padding: 16px;
    border-radius: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    pointer-events: auto;
    z-index: 2147483647;
    min-width: 280px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  `;

  panel.innerHTML = `
    <div style="margin-bottom: 12px; font-weight: bold; font-size: 16px;">
      Pattern Refinement
    </div>
    <div id="refinement-info" style="margin-bottom: 12px; color: #888;"></div>
    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
      <button id="refinement-add-btn" style="
        flex: 1; padding: 8px; border: none; border-radius: 6px;
        background: ${overlayConfig.includedColor}; color: white;
        cursor: pointer; font-weight: 500;
      ">+ Add</button>
      <button id="refinement-remove-btn" style="
        flex: 1; padding: 8px; border: none; border-radius: 6px;
        background: ${overlayConfig.excludedColor}; color: white;
        cursor: pointer; font-weight: 500;
      ">- Remove</button>
    </div>
    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
      <button id="refinement-expand-btn" style="
        flex: 1; padding: 8px; border: none; border-radius: 6px;
        background: #374151; color: white; cursor: pointer;
      ">Expand</button>
      <button id="refinement-contract-btn" style="
        flex: 1; padding: 8px; border: none; border-radius: 6px;
        background: #374151; color: white; cursor: pointer;
      ">Contract</button>
    </div>
    <div style="display: flex; gap: 8px;">
      <button id="refinement-reset-btn" style="
        flex: 1; padding: 8px; border: none; border-radius: 6px;
        background: #6b7280; color: white; cursor: pointer;
      ">Reset</button>
      <button id="refinement-done-btn" style="
        flex: 1; padding: 8px; border: none; border-radius: 6px;
        background: #8b5cf6; color: white; cursor: pointer; font-weight: bold;
      ">Done</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(panel);

  // Add event listeners
  setupPanelEventListeners();
}

/**
 * Setup event listeners for the panel
 */
function setupPanelEventListeners(): void {
  const addBtn = document.getElementById('refinement-add-btn');
  const removeBtn = document.getElementById('refinement-remove-btn');
  const expandBtn = document.getElementById('refinement-expand-btn');
  const contractBtn = document.getElementById('refinement-contract-btn');
  const resetBtn = document.getElementById('refinement-reset-btn');
  const doneBtn = document.getElementById('refinement-done-btn');

  addBtn?.addEventListener('click', () => {
    selectionMode = selectionMode === 'add' ? null : 'add';
    updateButtonStates();
  });

  removeBtn?.addEventListener('click', () => {
    selectionMode = selectionMode === 'remove' ? null : 'remove';
    updateButtonStates();
  });

  expandBtn?.addEventListener('click', () => {
    if (currentRefinement) {
      currentRefinement.adjustBoundary('expand');
      refreshHighlights();
      emitChange();
    }
  });

  contractBtn?.addEventListener('click', () => {
    if (currentRefinement) {
      currentRefinement.adjustBoundary('contract');
      refreshHighlights();
      emitChange();
    }
  });

  resetBtn?.addEventListener('click', () => {
    if (currentRefinement) {
      currentRefinement.reset();
      refreshHighlights();
      emitChange();
    }
  });

  doneBtn?.addEventListener('click', () => {
    if (currentRefinement && onRefinementChange) {
      onRefinementChange(currentRefinement.getAdjustedPattern());
    }
    hideRefinementOverlay();
  });

  // Add document click listener for element selection
  document.addEventListener('click', handleDocumentClick, true);
}

/**
 * Handle document clicks for element selection
 */
function handleDocumentClick(e: MouseEvent): void {
  if (!selectionMode || !currentRefinement) return;

  const target = e.target as Element;
  if (!target || target.closest(`#${REFINEMENT_PANEL_ID}`)) return;

  e.preventDefault();
  e.stopPropagation();

  if (selectionMode === 'add') {
    currentRefinement.addToPattern(target);
  } else if (selectionMode === 'remove') {
    currentRefinement.removeFromPattern(target);
  }

  refreshHighlights();
  emitChange();
}

/**
 * Update button visual states
 */
function updateButtonStates(): void {
  const addBtn = document.getElementById('refinement-add-btn');
  const removeBtn = document.getElementById('refinement-remove-btn');

  if (addBtn) {
    addBtn.style.opacity = selectionMode === 'add' ? '1' : '0.7';
    addBtn.style.transform = selectionMode === 'add' ? 'scale(1.05)' : 'scale(1)';
  }

  if (removeBtn) {
    removeBtn.style.opacity = selectionMode === 'remove' ? '1' : '0.7';
    removeBtn.style.transform = selectionMode === 'remove' ? 'scale(1.05)' : 'scale(1)';
  }
}

/**
 * Update the info panel
 */
function updatePanel(): void {
  const infoEl = document.getElementById('refinement-info');
  if (!infoEl || !currentRefinement) return;

  const pattern = currentRefinement.getAdjustedPattern();
  const added = currentRefinement.getAddedElements().length;
  const removed = currentRefinement.getRemovedElements().length;

  let html = `
    <div>Elements: <strong>${pattern.siblings.length}</strong></div>
  `;

  if (overlayConfig.showConfidence) {
    const confidencePercent = Math.round(pattern.confidence * 100);
    const confidenceColor = confidencePercent > 70 ? '#22c55e' :
      confidencePercent > 40 ? '#eab308' : '#ef4444';
    html += `
      <div>Confidence: <strong style="color: ${confidenceColor}">${confidencePercent}%</strong></div>
    `;
  }

  if (currentRefinement.isModified()) {
    html += `<div style="margin-top: 4px; font-size: 12px;">`;
    if (added > 0) {
      html += `<span style="color: ${overlayConfig.includedColor}">+${added} added</span> `;
    }
    if (removed > 0) {
      html += `<span style="color: ${overlayConfig.excludedColor}">-${removed} removed</span>`;
    }
    html += `</div>`;
  }

  infoEl.innerHTML = html;
}

/**
 * Emit refinement change event
 */
function emitChange(): void {
  updatePanel();
  if (currentRefinement && onRefinementChange) {
    // Don't emit on every change, only on done
  }
}

/**
 * Highlight pattern elements with distinct colors
 */
function highlightPatternElements(match: PatternMatch): void {
  removeElementHighlights();

  for (const element of match.siblings) {
    highlightElement(element, overlayConfig.includedColor, true);
  }
}

/**
 * Refresh all element highlights
 */
function refreshHighlights(): void {
  if (!currentRefinement) return;

  removeElementHighlights();

  const pattern = currentRefinement.getAdjustedPattern();
  const added = currentRefinement.getAddedElements();
  const removed = currentRefinement.getRemovedElements();

  // Highlight current pattern elements
  for (const element of pattern.siblings) {
    const isAdded = added.includes(element);
    const color = isAdded ? overlayConfig.hoverColor : overlayConfig.includedColor;
    highlightElement(element, color, true);
  }

  // Show removed elements with different color
  for (const element of removed) {
    highlightElement(element, overlayConfig.excludedColor, false);
  }
}

/**
 * Highlight a single element
 */
function highlightElement(
  element: Element,
  color: string,
  included: boolean
): void {
  const rect = element.getBoundingClientRect();

  const highlight = document.createElement('div');
  highlight.className = ELEMENT_HIGHLIGHT_CLASS;
  highlight.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    border: 2px solid ${color};
    background: ${color}${included ? '20' : '10'};
    pointer-events: none;
    z-index: 2147483645;
    box-sizing: border-box;
    transition: all 0.15s ease;
  `;

  document.body.appendChild(highlight);
}

/**
 * Remove all element highlights
 */
function removeElementHighlights(): void {
  const highlights = document.querySelectorAll(`.${ELEMENT_HIGHLIGHT_CLASS}`);
  highlights.forEach((el) => el.remove());
}

/**
 * Remove the overlay UI
 */
function removeOverlayUI(): void {
  const overlay = document.getElementById(REFINEMENT_OVERLAY_ID);
  const panel = document.getElementById(REFINEMENT_PANEL_ID);

  overlay?.remove();
  panel?.remove();

  document.removeEventListener('click', handleDocumentClick, true);
}

// ============================================================================
// Pattern Persistence
// ============================================================================

const STORAGE_KEY = 'web-scraper-pattern-adjustments';

export interface StoredPatternAdjustment {
  url: string;
  selector: string;
  addedSelectors: string[];
  removedSelectors: string[];
  timestamp: number;
}

/**
 * Save pattern adjustment to storage
 */
export async function savePatternAdjustment(
  refinement: PatternRefinement,
  url: string
): Promise<void> {
  const pattern = refinement.getAdjustedPattern();
  const selector = generatePatternSelector(pattern);

  const adjustment: StoredPatternAdjustment = {
    url,
    selector,
    addedSelectors: refinement.getAddedElements().map(el => generateElementSelector(el)),
    removedSelectors: refinement.getRemovedElements().map(el => generateElementSelector(el)),
    timestamp: Date.now(),
  };

  try {
    const stored = await getStoredAdjustments();
    // Remove existing adjustment for same URL/selector
    const filtered = stored.filter(
      (a) => !(a.url === url && a.selector === selector)
    );
    filtered.push(adjustment);

    // Keep only last 50 adjustments
    const trimmed = filtered.slice(-50);

    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    }
  } catch (error) {
    console.error('Failed to save pattern adjustment:', error);
  }
}

/**
 * Load stored adjustments
 */
export async function getStoredAdjustments(): Promise<StoredPatternAdjustment[]> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return result[STORAGE_KEY] || [];
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    }
  } catch (error) {
    console.error('Failed to load pattern adjustments:', error);
    return [];
  }
}

/**
 * Apply stored adjustments to a pattern
 */
export async function applyStoredAdjustments(
  match: PatternMatch,
  url: string
): Promise<PatternMatch> {
  const stored = await getStoredAdjustments();
  const selector = generatePatternSelector(match);

  const adjustment = stored.find(
    (a) => a.url === url && a.selector === selector
  );

  if (!adjustment) {
    return match;
  }

  // Apply adjustments
  const adjustedSiblings = [...match.siblings];

  // Remove elements
  for (const sel of adjustment.removedSelectors) {
    const index = adjustedSiblings.findIndex(
      (el) => generateElementSelector(el) === sel
    );
    if (index !== -1) {
      adjustedSiblings.splice(index, 1);
    }
  }

  // Add elements
  for (const sel of adjustment.addedSelectors) {
    const el = document.querySelector(sel);
    if (el && !adjustedSiblings.includes(el)) {
      adjustedSiblings.push(el);
    }
  }

  return {
    ...match,
    siblings: adjustedSiblings,
  };
}

/**
 * Generate a selector for a pattern
 */
function generatePatternSelector(match: PatternMatch): string {
  const parts: string[] = [match.tag];
  if (match.classes.length > 0) {
    parts.push(`.${match.classes.join('.')}`);
  }
  return parts.join('');
}

/**
 * Generate a unique selector for an element
 */
function generateElementSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).slice(0, 2);
      if (classes.length > 0 && classes[0]) {
        selector += `.${classes.join('.')}`;
      }
    }

    const parentEl: Element | null = current.parentElement;
    if (parentEl) {
      const currentTag = current.tagName;
      const siblings = Array.from(parentEl.children).filter(
        (c: Element) => c.tagName === currentTag
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = parentEl;
  }

  return path.join(' > ');
}

// ============================================================================
// Exports
// ============================================================================

export {
  detectPattern,
  defaultConfig,
};
