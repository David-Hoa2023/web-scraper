/**
 * Unit tests for Pattern Detector module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  detectPattern,
  highlightPattern,
  hideHighlight,
  removeOverlay,
  defaultConfig,
  _internal,
} from '../src/content/patternDetector';
import type { PatternDetectorConfig, PatternMatch } from '../src/types';

// Mock DOM environment setup
function createMockElement(
  tag: string,
  options: {
    classes?: string[];
    id?: string;
    dataAttrs?: Record<string, string>;
    ariaAttrs?: Record<string, string>;
    children?: Element[];
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

  return el;
}

describe('patternDetector', () => {
  describe('_internal.getDataAttributes', () => {
    it('should extract data-* attributes', () => {
      const el = createMockElement('div', {
        dataAttrs: { testid: '123', value: 'abc' },
      });

      const result = _internal.getDataAttributes(el);

      expect(result).toEqual({ testid: '123', value: 'abc' });
    });

    it('should return empty object when no data attributes', () => {
      const el = createMockElement('div');

      const result = _internal.getDataAttributes(el);

      expect(result).toEqual({});
    });
  });

  describe('_internal.getAriaAttributes', () => {
    it('should extract aria-* attributes', () => {
      const el = createMockElement('div', {
        ariaAttrs: { label: 'Test Label', hidden: 'false' },
      });

      const result = _internal.getAriaAttributes(el);

      expect(result).toEqual({ label: 'Test Label', hidden: 'false' });
    });

    it('should return empty object when no aria attributes', () => {
      const el = createMockElement('div');

      const result = _internal.getAriaAttributes(el);

      expect(result).toEqual({});
    });
  });

  describe('_internal.getElementSignature', () => {
    it('should create signature based on tag', () => {
      const el = createMockElement('article');

      const signature = _internal.getElementSignature(el, ['tag']);

      expect(signature).toBe('tag:article');
    });

    it('should create signature based on classes', () => {
      const el = createMockElement('div', { classes: ['card', 'item'] });

      const signature = _internal.getElementSignature(el, ['class']);

      expect(signature).toBe('class:card,item');
    });

    it('should create signature with sorted classes', () => {
      const el = createMockElement('div', { classes: ['zebra', 'alpha', 'beta'] });

      const signature = _internal.getElementSignature(el, ['class']);

      expect(signature).toBe('class:alpha,beta,zebra');
    });

    it('should create signature based on id pattern', () => {
      const el = createMockElement('div', { id: 'item-123' });

      const signature = _internal.getElementSignature(el, ['id']);

      expect(signature).toBe('id:item-#');
    });

    it('should create signature based on data attributes', () => {
      const el = createMockElement('div', {
        dataAttrs: { testid: 'card', index: '0' },
      });

      const signature = _internal.getElementSignature(el, ['data']);

      expect(signature).toBe('data:index,testid');
    });

    it('should create combined signature with multiple criteria', () => {
      const el = createMockElement('div', {
        classes: ['card'],
        dataAttrs: { testid: 'item' },
      });

      const signature = _internal.getElementSignature(el, ['tag', 'class', 'data']);

      expect(signature).toBe('tag:div|class:card|data:testid');
    });
  });

  describe('_internal.findMatchingSiblings', () => {
    it('should find siblings with same signature', () => {
      const child1 = createMockElement('div', { classes: ['item'] });
      const child2 = createMockElement('div', { classes: ['item'] });
      const child3 = createMockElement('div', { classes: ['item'] });
      const parent = createMockElement('div', {
        children: [child1, child2, child3],
      });

      const signature = _internal.getElementSignature(child1, ['tag', 'class']);
      const siblings = _internal.findMatchingSiblings(
        parent,
        signature,
        ['tag', 'class'],
        child1
      );

      expect(siblings).toHaveLength(2);
      expect(siblings).toContain(child2);
      expect(siblings).toContain(child3);
      expect(siblings).not.toContain(child1);
    });

    it('should not include elements with different signature', () => {
      const child1 = createMockElement('div', { classes: ['item'] });
      const child2 = createMockElement('div', { classes: ['item'] });
      const child3 = createMockElement('div', { classes: ['other'] });
      const parent = createMockElement('div', {
        children: [child1, child2, child3],
      });

      const signature = _internal.getElementSignature(child1, ['tag', 'class']);
      const siblings = _internal.findMatchingSiblings(
        parent,
        signature,
        ['tag', 'class'],
        child1
      );

      expect(siblings).toHaveLength(1);
      expect(siblings).toContain(child2);
      expect(siblings).not.toContain(child3);
    });
  });

  describe('_internal.calculateConfidence', () => {
    it('should return score between 0 and 1', () => {
      const el = createMockElement('div', { classes: ['item'] });
      const siblings = [
        createMockElement('div', { classes: ['item'] }),
        createMockElement('div', { classes: ['item'] }),
      ];
      const config: PatternDetectorConfig = {
        matchBy: ['tag', 'class'],
        minSiblings: 2,
        depthLimit: 3,
      };

      const confidence = _internal.calculateConfidence(el, siblings, config);

      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should give higher score with more matching attributes', () => {
      // Element with more classes gets higher score with same config
      const el1 = createMockElement('div', { classes: ['item'] });
      const el2 = createMockElement('div', {
        classes: ['item', 'card', 'featured'],
      });
      const siblings = [createMockElement('div')];

      const config: PatternDetectorConfig = {
        matchBy: ['tag', 'class'],
        minSiblings: 1,
        depthLimit: 3,
      };

      const confidence1 = _internal.calculateConfidence(el1, siblings, config);
      const confidence2 = _internal.calculateConfidence(el2, siblings, config);

      // Element with more classes should have higher or equal confidence
      expect(confidence2).toBeGreaterThanOrEqual(confidence1);
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

    it('should detect pattern when siblings exist', () => {
      const child1 = createMockElement('div', { classes: ['item'] });
      const child2 = createMockElement('div', { classes: ['item'] });
      const child3 = createMockElement('div', { classes: ['item'] });
      const parent = createMockElement('div', {
        children: [child1, child2, child3],
      });
      document.body.appendChild(parent);

      const config: PatternDetectorConfig = {
        matchBy: ['tag', 'class'],
        minSiblings: 2,
        depthLimit: 3,
      };

      const match = detectPattern(child1, config);

      expect(match).not.toBeNull();
      expect(match?.tag).toBe('div');
      expect(match?.classes).toContain('item');
      expect(match?.siblings).toHaveLength(3);
      expect(match?.parent).toBe(parent);
    });

    it('should return null when not enough siblings', () => {
      const child1 = createMockElement('div', { classes: ['item'] });
      const child2 = createMockElement('div', { classes: ['other'] });
      const parent = createMockElement('div', {
        children: [child1, child2],
      });
      document.body.appendChild(parent);

      const config: PatternDetectorConfig = {
        matchBy: ['tag', 'class'],
        minSiblings: 2,
        depthLimit: 3,
      };

      const match = detectPattern(child1, config);

      expect(match).toBeNull();
    });

    it('should traverse up the DOM to find patterns', () => {
      const innerChild = createMockElement('span', { classes: ['text'] });
      const item1 = createMockElement('div', {
        classes: ['item'],
        children: [innerChild],
      });
      const item2 = createMockElement('div', { classes: ['item'] });
      const item3 = createMockElement('div', { classes: ['item'] });
      const parent = createMockElement('div', {
        children: [item1, item2, item3],
      });
      document.body.appendChild(parent);

      const config: PatternDetectorConfig = {
        matchBy: ['tag', 'class'],
        minSiblings: 2,
        depthLimit: 3,
      };

      const match = detectPattern(innerChild, config);

      expect(match).not.toBeNull();
      expect(match?.tag).toBe('div');
      expect(match?.classes).toContain('item');
    });

    it('should respect depthLimit', () => {
      const deepChild = createMockElement('span');
      const level2 = createMockElement('div', { children: [deepChild] });
      const level1 = createMockElement('div', { children: [level2] });
      const item1 = createMockElement('div', {
        classes: ['item'],
        children: [level1],
      });
      const item2 = createMockElement('div', { classes: ['item'] });
      const parent = createMockElement('div', {
        children: [item1, item2],
      });
      document.body.appendChild(parent);

      const config: PatternDetectorConfig = {
        matchBy: ['tag', 'class'],
        minSiblings: 1,
        depthLimit: 1, // Only check one level up
      };

      // With depth limit of 1, starting from deepChild, we won't reach the items
      const match = detectPattern(deepChild, config);

      // Should not find the pattern because depth limit prevents traversal
      expect(match).toBeNull();
    });

    it('should include data and aria attributes in match', () => {
      const child1 = createMockElement('div', {
        classes: ['item'],
        dataAttrs: { testid: 'card', index: '0' },
        ariaAttrs: { label: 'Item 1' },
      });
      const child2 = createMockElement('div', {
        classes: ['item'],
        dataAttrs: { testid: 'card', index: '1' },
        ariaAttrs: { label: 'Item 2' },
      });
      const parent = createMockElement('div', {
        children: [child1, child2],
      });
      document.body.appendChild(parent);

      const config: PatternDetectorConfig = {
        matchBy: ['tag', 'class', 'data', 'aria'],
        minSiblings: 1,
        depthLimit: 3,
      };

      const match = detectPattern(child1, config);

      expect(match).not.toBeNull();
      expect(match?.dataAttrs).toEqual({ testid: 'card', index: '0' });
      expect(match?.ariaAttrs).toEqual({ label: 'Item 1' });
    });
  });

  describe('highlightPattern and hideHighlight', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    afterEach(() => {
      removeOverlay();
    });

    it('should create overlay and badge elements', () => {
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
        toJSON: () => {},
      });
      vi.spyOn(child2, 'getBoundingClientRect').mockReturnValue({
        left: 10,
        top: 70,
        right: 110,
        bottom: 120,
        width: 100,
        height: 50,
        x: 10,
        y: 70,
        toJSON: () => {},
      });

      const match: PatternMatch = {
        tag: 'div',
        classes: ['item'],
        dataAttrs: {},
        ariaAttrs: {},
        parent: parent,
        siblings: [child1, child2],
        confidence: 0.8,
      };

      highlightPattern(match);

      const overlay = document.getElementById('web-scraper-pattern-overlay');
      const badge = document.getElementById('web-scraper-pattern-badge');

      expect(overlay).not.toBeNull();
      expect(badge).not.toBeNull();
      expect(overlay?.style.display).toBe('block');
      expect(badge?.style.display).toBe('block');
      expect(badge?.textContent).toBe('2 items');
    });

    it('should hide overlay and badge', () => {
      const child1 = createMockElement('div');
      const child2 = createMockElement('div');
      const parent = createMockElement('div', {
        children: [child1, child2],
      });
      document.body.appendChild(parent);

      vi.spyOn(child1, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 100,
        bottom: 50,
        width: 100,
        height: 50,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
      vi.spyOn(child2, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 50,
        right: 100,
        bottom: 100,
        width: 100,
        height: 50,
        x: 0,
        y: 50,
        toJSON: () => {},
      });

      const match: PatternMatch = {
        tag: 'div',
        classes: [],
        dataAttrs: {},
        ariaAttrs: {},
        parent: parent,
        siblings: [child1, child2],
        confidence: 0.5,
      };

      highlightPattern(match);
      hideHighlight();

      const overlay = document.getElementById('web-scraper-pattern-overlay');
      const badge = document.getElementById('web-scraper-pattern-badge');

      expect(overlay?.style.display).toBe('none');
      expect(badge?.style.display).toBe('none');
    });
  });

  describe('removeOverlay', () => {
    it('should remove overlay elements from DOM', () => {
      const child1 = createMockElement('div');
      const parent = createMockElement('div', {
        children: [child1],
      });
      document.body.appendChild(parent);

      vi.spyOn(child1, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 100,
        bottom: 50,
        width: 100,
        height: 50,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      const match: PatternMatch = {
        tag: 'div',
        classes: [],
        dataAttrs: {},
        ariaAttrs: {},
        parent: parent,
        siblings: [child1],
        confidence: 0.5,
      };

      highlightPattern(match);

      expect(document.getElementById('web-scraper-pattern-overlay')).not.toBeNull();
      expect(document.getElementById('web-scraper-pattern-badge')).not.toBeNull();

      removeOverlay();

      expect(document.getElementById('web-scraper-pattern-overlay')).toBeNull();
      expect(document.getElementById('web-scraper-pattern-badge')).toBeNull();
    });
  });

  describe('defaultConfig', () => {
    it('should have expected default values', () => {
      expect(defaultConfig.matchBy).toEqual(['tag', 'class']);
      expect(defaultConfig.minSiblings).toBe(2);
      expect(defaultConfig.depthLimit).toBe(3);
    });
  });
});
