/**
 * Unit tests for Pattern Detector module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  detectPattern,
  highlightPattern,
  hideHighlight,
  defaultConfig,
  _internal,
} from '../src/content/patternDetector';
import type { PatternDetectorConfig, PatternMatch, Fingerprint } from '../src/types';

// Mock DOM environment setup
function createMockElement(
  tag: string,
  options: {
    classes?: string[];
    id?: string;
    dataAttrs?: Record<string, string>;
    ariaAttrs?: Record<string, string>;
    children?: Element[];
    parentElement?: Element;
  } = {}
): Element {
  const el = document.createElement(tag);

  if (options.classes) {
    el.className = options.classes.join(' ');
  }

  if (options.id) {
    el.id = options.id;
  }

  if (options.dataAttrs) {
    for (const [key, value] of Object.entries(options.dataAttrs)) {
      el.setAttribute(`data-${key}`, value);
    }
  }

  if (options.ariaAttrs) {
    for (const [key, value] of Object.entries(options.ariaAttrs)) {
      el.setAttribute(`aria-${key}`, value);
    }
  }

  if (options.children) {
    for (const child of options.children) {
      el.appendChild(child);
    }
  }

  // Mock parentElement manually if needed for traversing up without appending to body
  if (options.parentElement) {
    Object.defineProperty(el, 'parentElement', {
      get: () => options.parentElement,
      configurable: true
    });
  }

  return el;
}

describe('patternDetector', () => {
  describe('getFingerprint', () => {
    it('should generate correct fingerprint for simple element', () => {
      const el = createMockElement('div', { classes: ['card', 'item'] });
      const fp = _internal.getFingerprint(el);

      expect(fp.tag).toBe('div');
      expect(fp.classes).toContain('card');
      expect(fp.classes).toContain('item');
      expect(fp.childCount).toBe(0);
      expect(fp.depth).toBe(0);
    });

    it('should include stable attributes', () => {
      const el = createMockElement('div', {
        dataAttrs: { testid: 'product-card' },
        ariaAttrs: { label: 'Product' }
      });
      const fp = _internal.getFingerprint(el);

      expect(fp.attrs['data-testid']).toBe('product-card');
      expect(fp.attrs['aria-label']).toBe('Product');
    });

    it('should count children', () => {
      const child1 = createMockElement('span');
      const child2 = createMockElement('img');
      const el = createMockElement('div', { children: [child1, child2] });

      const fp = _internal.getFingerprint(el);
      expect(fp.childCount).toBe(2);
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 0 for different tags', () => {
      const fp1: Fingerprint = { tag: 'div', classes: [], attrs: {}, childCount: 0, depth: 0 };
      const fp2: Fingerprint = { tag: 'span', classes: [], attrs: {}, childCount: 0, depth: 0 };
      expect(_internal.calculateSimilarity(fp1, fp2)).toBe(0);
    });

    it('should return 1 for identical elements', () => {
      const fp1: Fingerprint = { tag: 'div', classes: ['a', 'b'], attrs: { id: '1' }, childCount: 5, depth: 2 };
      const fp2: Fingerprint = { tag: 'div', classes: ['a', 'b'], attrs: { id: '1' }, childCount: 5, depth: 2 };
      expect(_internal.calculateSimilarity(fp1, fp2)).toBe(1);
    });

    it('should calculate partial similarity for overlapping classes (Jaccard)', () => {
      const fp1: Fingerprint = { tag: 'div', classes: ['a', 'b'], attrs: {}, childCount: 0, depth: 0 };
      const fp2: Fingerprint = { tag: 'div', classes: ['a', 'c'], attrs: {}, childCount: 0, depth: 0 };

      // Class similarity: intersect(1) / union(3) = 0.33
      // Weight 0.6. Score ~= 0.6 * 0.33 + 0.4 (other factors empty/equal)
      const sim = _internal.calculateSimilarity(fp1, fp2);
      expect(sim).toBeGreaterThan(0.3);
      expect(sim).toBeLessThan(1);
    });
  });

  describe('detectPattern', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('should return null for invalid elements', () => {
      expect(detectPattern(null as unknown as Element)).toBeNull();
      expect(detectPattern(document.body)).toBeNull();
      expect(detectPattern(document.documentElement)).toBeNull();
    });

    it('should detect list container with similar children', () => {
      const child1 = createMockElement('div', { classes: ['product-item'] });
      const child2 = createMockElement('div', { classes: ['product-item'] });
      const child3 = createMockElement('div', { classes: ['product-item'] });
      const container = createMockElement('div', { children: [child1, child2, child3] });
      document.body.appendChild(container);

      const config: PatternDetectorConfig = {
        matchBy: ['tag', 'class'],
        minListItems: 3,
        allowSingleFallback: false,
        depthLimit: 5,
        simThreshold: 0.6
      };

      const match = detectPattern(child1, config);

      expect(match).not.toBeNull();
      expect(match?.container).toBe(container);
      expect(match?.siblings.length).toBe(3);
      expect(match?.isSingle).toBe(false);
    });

    it('should fallback to single item if configured', () => {
      const child1 = createMockElement('div', { classes: ['unique-header'] });
      const container = createMockElement('div', { children: [child1] });
      document.body.appendChild(container);

      const config: PatternDetectorConfig = {
        matchBy: ['tag', 'class'],
        minListItems: 3,
        allowSingleFallback: true,
        depthLimit: 2,
        simThreshold: 0.6
      };

      const match = detectPattern(child1, config);

      expect(match).not.toBeNull();
      expect(match?.container).toBe(container);
      expect(match?.isSingle).toBe(true);
      expect(match?.siblings.length).toBe(1);
    });

    it('should respect simThreshold', () => {
      const child1 = createMockElement('div', { classes: ['a'] });
      const child2 = createMockElement('div', { classes: ['b'] }); // Completely different class
      const container = createMockElement('div', { children: [child1, child2] });
      document.body.appendChild(container); // Needed for parent traversal

      const config: PatternDetectorConfig = {
        matchBy: ['tag', 'class'],
        minListItems: 2,
        allowSingleFallback: false,
        depthLimit: 5,
        simThreshold: 0.9 // Very strict
      };

      // Jaccard for {a} vs {b} is 0. Similarity will be low.
      const match = detectPattern(child1, config);

      // Should capture only child1 as single fallback matches nothing else if threshold high
      // If allowSingleFallback is false, it should return null
      expect(match).toBeNull();
    });
  });

  describe('highlightPattern and hideHighlight', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    afterEach(() => {
      hideHighlight();
    });

    it('should style matched elements and show badge', () => {
      const child1 = createMockElement('div', { classes: ['item'] });
      const child2 = createMockElement('div', { classes: ['item'] });
      const parent = createMockElement('div', {
        children: [child1, child2],
      });
      document.body.appendChild(parent);

      // Mock getBoundingClientRect
      vi.spyOn(child1, 'getBoundingClientRect').mockReturnValue({
        left: 10,
        top: 10,
        right: 110,
        bottom: 60,
        width: 100,
        height: 50,
        x: 10,
        y: 10,
        toJSON: () => { },
      });

      // Fingerprint mock not needed for styling, but PatternMatch requires it
      const fp: Fingerprint = { tag: 'div', classes: ['item'], attrs: {}, childCount: 0, depth: 0 };

      const match: PatternMatch = {
        container: parent,
        fingerprint: fp,
        siblings: [child1, child2],
        isSingle: false,
        confidence: 0.8,
      };

      highlightPattern(match);

      const badge = document.getElementById('web-scraper-pattern-badge');

      expect(badge).not.toBeNull();
      expect(badge?.textContent).toContain('Scrape 2 items');

      // Check if element was highlighted
      const el = child1 as HTMLElement;
      expect(el.style.outline).toContain('solid');
    });

    it('should remove highlights and badge', () => {
      const child1 = createMockElement('div');
      const parent = createMockElement('div', { children: [child1] });
      document.body.appendChild(parent);

      // Mock BB for badge placement
      vi.spyOn(child1, 'getBoundingClientRect').mockReturnValue({
        left: 0, top: 0, right: 100, bottom: 50, width: 100, height: 50, x: 0, y: 0, toJSON: () => { }
      });

      const fp: Fingerprint = { tag: 'div', classes: [], attrs: {}, childCount: 0, depth: 0 };
      const match: PatternMatch = {
        container: parent,
        fingerprint: fp,
        siblings: [child1],
        isSingle: true,
        confidence: 0.5,
      };

      highlightPattern(match);
      hideHighlight();

      const badge = document.getElementById('web-scraper-pattern-badge');
      const el = child1 as HTMLElement;

      expect(badge).toBeNull();
      expect(el.style.outline).toBe('');
    });
  });

  describe('defaultConfig', () => {
    it('should have expected default values', () => {
      expect(defaultConfig.minListItems).toBe(3);
      expect(defaultConfig.allowSingleFallback).toBe(true);
      expect(defaultConfig.depthLimit).toBe(12);
    });
  });
});
