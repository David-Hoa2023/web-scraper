/**
 * Event Bus - Internal event system for cross-module communication
 * ARCH-1: Typed events with priority handlers, error isolation, wildcard subscriptions
 */

/**
 * Event types for the web scraper extension
 */
export type EventType =
  // Recording events
  | 'recording:started'
  | 'recording:stopped'
  | 'recording:paused'
  | 'recording:resumed'
  | 'step:captured'
  | 'step:updated'
  // Export events
  | 'export:started'
  | 'export:completed'
  | 'export:failed'
  // Scraping events
  | 'scrape:started'
  | 'scrape:progress'
  | 'scrape:completed'
  | 'scrape:failed'
  | 'scrape:paused'
  // Pattern detection events
  | 'pattern:detected'
  | 'pattern:refined'
  | 'pattern:cleared'
  // AI events
  | 'ai:request'
  | 'ai:response'
  | 'ai:error'
  | 'ai:ratelimited'
  // Storage events
  | 'storage:quota:warning'
  | 'storage:quota:exceeded'
  | 'storage:cleaned'
  // Arbitrage events
  | 'arbitrage:price:recorded'
  | 'arbitrage:match:found'
  | 'arbitrage:opportunity:detected'
  | 'arbitrage:opportunity:dismissed'
  | 'arbitrage:trend:updated'
  | 'arbitrage:anomaly:detected'
  | 'arbitrage:platform:detected'
  | 'arbitrage:settings:updated'
  // System events
  | 'system:error'
  | 'system:warning'
  | '*'; // Wildcard for all events

/**
 * Base event interface
 */
export interface BaseEvent<T extends EventType = EventType> {
  type: T;
  payload: Record<string, unknown>;
  timestamp: number;
  source?: string;
}

/**
 * Event handler function type
 */
export type EventHandler<T extends EventType = EventType> = (
  event: BaseEvent<T>
) => void | Promise<void>;

/**
 * Handler registration with priority
 */
interface HandlerRegistration {
  handler: EventHandler;
  priority: number;
  once: boolean;
  id: string;
}

/**
 * Event bus options
 */
export interface EventBusOptions {
  maxListeners?: number;
  errorHandler?: (error: Error, event: BaseEvent) => void;
  debug?: boolean;
}

/**
 * Event Bus implementation with priority handlers and error isolation
 */
export class EventBus {
  private handlers = new Map<EventType, HandlerRegistration[]>();
  private wildcardHandlers: HandlerRegistration[] = [];
  private eventHistory: BaseEvent[] = [];
  private maxHistory = 100;
  private handlerIdCounter = 0;
  private readonly options: Required<EventBusOptions>;

  constructor(options: EventBusOptions = {}) {
    this.options = {
      maxListeners: options.maxListeners ?? 100,
      errorHandler: options.errorHandler ?? this.defaultErrorHandler.bind(this),
      debug: options.debug ?? false,
    };
  }

  /**
   * Subscribe to an event type
   * @param type - Event type or '*' for all events
   * @param handler - Handler function
   * @param priority - Higher priority handlers run first (default: 0)
   * @returns Unsubscribe function
   */
  on<T extends EventType>(
    type: T,
    handler: EventHandler<T>,
    priority = 0
  ): () => void {
    return this.addHandler(type, handler as EventHandler, priority, false);
  }

  /**
   * Subscribe to an event type (one-time)
   */
  once<T extends EventType>(
    type: T,
    handler: EventHandler<T>,
    priority = 0
  ): () => void {
    return this.addHandler(type, handler as EventHandler, priority, true);
  }

  /**
   * Unsubscribe from an event type
   */
  off<T extends EventType>(type: T, handler: EventHandler<T>): void {
    if (type === '*') {
      this.wildcardHandlers = this.wildcardHandlers.filter(
        (h) => h.handler !== handler
      );
      return;
    }

    const handlers = this.handlers.get(type);
    if (handlers) {
      const index = handlers.findIndex((h) => h.handler === handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event
   */
  async emit<T extends EventType>(
    type: T,
    payload: Record<string, unknown> = {},
    source?: string
  ): Promise<void> {
    const event: BaseEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
      source,
    };

    if (this.options.debug) {
      console.log(`[EventBus] Emitting: ${type}`, payload);
    }

    // Store in history
    this.eventHistory.push(event as BaseEvent);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    // Get handlers sorted by priority (high to low)
    const typeHandlers = this.handlers.get(type) || [];
    const allHandlers = [...typeHandlers, ...this.wildcardHandlers].sort(
      (a, b) => b.priority - a.priority
    );

    // Execute handlers with error isolation
    const toRemove: string[] = [];

    for (const registration of allHandlers) {
      try {
        await registration.handler(event as BaseEvent);
        if (registration.once) {
          toRemove.push(registration.id);
        }
      } catch (error) {
        this.options.errorHandler(
          error instanceof Error ? error : new Error(String(error)),
          event as BaseEvent
        );
      }
    }

    // Remove one-time handlers
    for (const id of toRemove) {
      this.removeById(id);
    }
  }

  /**
   * Emit event synchronously (no await)
   */
  emitSync<T extends EventType>(
    type: T,
    payload: Record<string, unknown> = {},
    source?: string
  ): void {
    this.emit(type, payload, source).catch((error) => {
      this.options.errorHandler(
        error instanceof Error ? error : new Error(String(error)),
        { type, payload, timestamp: Date.now(), source }
      );
    });
  }

  /**
   * Get event history
   */
  getHistory(type?: EventType, limit = 10): BaseEvent[] {
    let history = this.eventHistory;
    if (type && type !== '*') {
      history = history.filter((e) => e.type === type);
    }
    return history.slice(-limit);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get handler count for an event type
   */
  listenerCount(type: EventType): number {
    if (type === '*') {
      return this.wildcardHandlers.length;
    }
    return (this.handlers.get(type)?.length || 0) + this.wildcardHandlers.length;
  }

  /**
   * Remove all handlers for an event type
   */
  removeAllListeners(type?: EventType): void {
    if (type === undefined) {
      this.handlers.clear();
      this.wildcardHandlers = [];
    } else if (type === '*') {
      this.wildcardHandlers = [];
    } else {
      this.handlers.delete(type);
    }
  }

  /**
   * Get all registered event types
   */
  eventTypes(): EventType[] {
    return Array.from(this.handlers.keys());
  }

  private addHandler(
    type: EventType,
    handler: EventHandler,
    priority: number,
    once: boolean
  ): () => void {
    const id = `handler_${++this.handlerIdCounter}`;
    const registration: HandlerRegistration = { handler, priority, once, id };

    if (type === '*') {
      if (this.wildcardHandlers.length >= this.options.maxListeners) {
        console.warn('[EventBus] Max wildcard listeners reached');
      }
      this.wildcardHandlers.push(registration);
    } else {
      if (!this.handlers.has(type)) {
        this.handlers.set(type, []);
      }
      const handlers = this.handlers.get(type)!;
      if (handlers.length >= this.options.maxListeners) {
        console.warn(`[EventBus] Max listeners reached for ${type}`);
      }
      handlers.push(registration);
    }

    return () => this.removeById(id);
  }

  private removeById(id: string): void {
    // Check wildcard handlers
    const wildcardIndex = this.wildcardHandlers.findIndex((h) => h.id === id);
    if (wildcardIndex !== -1) {
      this.wildcardHandlers.splice(wildcardIndex, 1);
      return;
    }

    // Check type handlers
    for (const [, handlers] of this.handlers) {
      const index = handlers.findIndex((h) => h.id === id);
      if (index !== -1) {
        handlers.splice(index, 1);
        return;
      }
    }
  }

  private defaultErrorHandler(error: Error, event: BaseEvent): void {
    console.error(`[EventBus] Error in handler for ${event.type}:`, error);
  }
}

// Singleton instance
let eventBusInstance: EventBus | null = null;

/**
 * Get the global event bus instance
 */
export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}

/**
 * Create event helper for typed events
 */
export function createEvent<T extends EventType>(
  type: T,
  payload: Record<string, unknown> = {},
  source?: string
): BaseEvent<T> {
  return {
    type,
    payload,
    timestamp: Date.now(),
    source,
  };
}
