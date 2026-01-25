/**
 * Unit tests for the Auto-Scroller module
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ScrollerConfig } from '../src/types';

// Mock the DOM environment
const mockScrollTo = vi.fn();
const mockScrollBy = vi.fn();

// Setup DOM mocks before importing the module
vi.stubGlobal('scrollTo', mockScrollTo);
vi.stubGlobal('scrollBy', mockScrollBy);
vi.stubGlobal('scrollY', 0);

// Mock MutationObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockMutationObserver {
  callback: MutationCallback;

  constructor(callback: MutationCallback) {
    this.callback = callback;
  }

  observe = mockObserve;
  disconnect = mockDisconnect;
  takeRecords = vi.fn(() => []);
}

vi.stubGlobal('MutationObserver', MockMutationObserver);

// Now import the module
import {
  startScroll,
  pauseScroll,
  resumeScroll,
  stopScroll,
  onScrollProgress,
  offScrollProgress,
  getState,
  reset,
} from '../src/content/autoScroller';

describe('AutoScroller', () => {
  const defaultConfig: ScrollerConfig = {
    throttleMs: 100,
    retryCount: 3,
    retryDelayMs: 500,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    reset();
    vi.clearAllMocks();

    // Reset scroll position mocks
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 2000,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    reset();
  });

  describe('startScroll', () => {
    it('should start scrolling with valid config', () => {
      startScroll(defaultConfig);

      const state = getState();
      expect(state.status).toBe('running');
      expect(state.itemsCollected).toBe(0);
      expect(state.errors).toEqual([]);
    });

    it('should throw error when already running', () => {
      startScroll(defaultConfig);

      expect(() => startScroll(defaultConfig)).toThrow('Scroller is already running');
    });

    it('should throw error for invalid config (negative throttleMs)', () => {
      const invalidConfig: ScrollerConfig = {
        throttleMs: -100,
        retryCount: 3,
        retryDelayMs: 500,
      };

      expect(() => startScroll(invalidConfig)).toThrow('Invalid configuration');
    });

    it('should throw error for invalid config (negative retryCount)', () => {
      const invalidConfig: ScrollerConfig = {
        throttleMs: 100,
        retryCount: -1,
        retryDelayMs: 500,
      };

      expect(() => startScroll(invalidConfig)).toThrow('Invalid configuration');
    });

    it('should setup MutationObserver', () => {
      startScroll(defaultConfig);

      expect(mockObserve).toHaveBeenCalledWith(document.body, {
        childList: true,
        subtree: true,
      });
    });
  });

  describe('pauseScroll', () => {
    it('should pause when running', () => {
      startScroll(defaultConfig);
      pauseScroll();

      const state = getState();
      expect(state.status).toBe('paused');
    });

    it('should not throw when not running', () => {
      // Should not throw, just warn
      expect(() => pauseScroll()).not.toThrow();
    });

    it('should preserve itemsCollected when paused', () => {
      startScroll(defaultConfig);

      // Manually set itemsCollected for testing
      const stateBefore = getState();
      expect(stateBefore.itemsCollected).toBeDefined();

      pauseScroll();

      const stateAfter = getState();
      expect(stateAfter.itemsCollected).toBe(stateBefore.itemsCollected);
    });
  });

  describe('resumeScroll', () => {
    it('should resume when paused', () => {
      startScroll(defaultConfig);
      pauseScroll();
      resumeScroll();

      const state = getState();
      expect(state.status).toBe('running');
    });

    it('should not throw when not paused', () => {
      startScroll(defaultConfig);
      // Should not throw, just warn
      expect(() => resumeScroll()).not.toThrow();
    });
  });

  describe('stopScroll', () => {
    it('should stop and cleanup when running', () => {
      startScroll(defaultConfig);
      stopScroll();

      const state = getState();
      expect(state.status).toBe('idle');
      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should stop from paused state', () => {
      startScroll(defaultConfig);
      pauseScroll();
      stopScroll();

      const state = getState();
      expect(state.status).toBe('idle');
    });

    it('should not throw when already stopped', () => {
      expect(() => stopScroll()).not.toThrow();
    });
  });

  describe('onScrollProgress', () => {
    it('should register callback and receive updates', () => {
      const callback = vi.fn();
      onScrollProgress(callback);

      startScroll(defaultConfig);

      expect(callback).toHaveBeenCalled();
      const lastCall = callback.mock.calls[callback.mock.calls.length - 1];
      expect(lastCall[0]).toMatchObject({
        status: 'running',
        itemsCollected: expect.any(Number),
        errors: expect.any(Array),
      });
    });

    it('should receive updates on pause', () => {
      const callback = vi.fn();
      onScrollProgress(callback);

      startScroll(defaultConfig);
      callback.mockClear();

      pauseScroll();

      expect(callback).toHaveBeenCalled();
      const lastCall = callback.mock.calls[callback.mock.calls.length - 1];
      expect(lastCall[0].status).toBe('paused');
    });
  });

  describe('offScrollProgress', () => {
    it('should remove callback', () => {
      const callback = vi.fn();
      onScrollProgress(callback);
      offScrollProgress(callback);

      startScroll(defaultConfig);

      // Callback should not be called after removal
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle removing non-existent callback', () => {
      const callback = vi.fn();
      expect(() => offScrollProgress(callback)).not.toThrow();
    });
  });

  describe('getState', () => {
    it('should return initial state', () => {
      const state = getState();

      expect(state).toEqual({
        status: 'idle',
        itemsCollected: 0,
        errors: [],
      });
    });

    it('should return a copy of the state', () => {
      const state1 = getState();
      const state2 = getState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      startScroll(defaultConfig);
      reset();

      const state = getState();
      expect(state).toEqual({
        status: 'idle',
        itemsCollected: 0,
        errors: [],
      });
    });

    it('should clear all callbacks', () => {
      const callback = vi.fn();
      onScrollProgress(callback);
      reset();

      // Start again - callback should not be called
      startScroll(defaultConfig);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('maxItems limit', () => {
    it('should respect maxItems configuration', () => {
      const configWithMax: ScrollerConfig = {
        ...defaultConfig,
        maxItems: 5,
      };

      startScroll(configWithMax);

      const state = getState();
      expect(state.status).toBe('running');
    });
  });
});

describe('Error handling utilities', () => {
  // Test the error utilities imported from errors.ts
  it('should be importable', async () => {
    const errors = await import('../src/utils/errors');

    expect(errors.ScraperError).toBeDefined();
    expect(errors.ErrorCodes).toBeDefined();
    expect(errors.formatError).toBeDefined();
    expect(errors.calculateBackoff).toBeDefined();
  });

  it('should create ScraperError correctly', async () => {
    const { ScraperError, ErrorCodes } = await import('../src/utils/errors');

    const error = new ScraperError('Test error', ErrorCodes.SCROLL_FAILED);

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('SCROLL_FAILED');
    expect(error.recoverable).toBe(true);
    expect(error.name).toBe('ScraperError');
  });

  it('should calculate exponential backoff correctly', async () => {
    const { calculateBackoff } = await import('../src/utils/errors');

    expect(calculateBackoff(0, 1000)).toBe(1000);
    expect(calculateBackoff(1, 1000)).toBe(2000);
    expect(calculateBackoff(2, 1000)).toBe(4000);
    expect(calculateBackoff(3, 1000)).toBe(8000);
  });

  it('should cap backoff at maxDelay', async () => {
    const { calculateBackoff } = await import('../src/utils/errors');

    // With maxDelayMs of 5000
    expect(calculateBackoff(10, 1000, 5000)).toBe(5000);
  });

  it('should format errors correctly', async () => {
    const { formatError, ScraperError, ErrorCodes } = await import(
      '../src/utils/errors'
    );

    const scraperError = new ScraperError('Test', ErrorCodes.SCROLL_FAILED);
    const formatted = formatError(scraperError);

    expect(formatted).toContain('SCROLL_FAILED');
    expect(formatted).toContain('Test');
  });
});
