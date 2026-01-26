/**
 * DOM Event Logger
 * Captures user interactions with the page (clicks, inputs, scrolls, etc.)
 */

import type {
  DomEvent,
  DomEventType,
  ElementSnapshot,
  DomEventCallback,
  Point,
  ClickEventData,
  InputEventData,
  ScrollEventData,
  KeyEventData,
  FocusEventData,
  HoverEventData,
} from '../../types/recording';

// DomEventType is used in type assertions throughout the file

export interface DomEventLogger {
  /** Start capturing DOM events */
  start(): void;
  /** Stop capturing and return all events */
  stop(): DomEvent[];
  /** Get all captured events so far */
  getEvents(): DomEvent[];
  /** Clear all captured events */
  clear(): void;
  /** Subscribe to new events */
  onEvent(callback: DomEventCallback): () => void;
  /** Check if currently logging */
  isLogging(): boolean;
}

/** Sensitive input types to mask */
const SENSITIVE_INPUT_TYPES = ['password', 'credit-card', 'cc-number', 'cc-csc'];

/** Sensitive autocomplete values */
const SENSITIVE_AUTOCOMPLETE = [
  'cc-name',
  'cc-number',
  'cc-exp',
  'cc-csc',
  'new-password',
  'current-password',
];

/** Maximum text content length to capture */
const MAX_TEXT_CONTENT_LENGTH = 100;

/** Hover tracking state */
interface HoverState {
  element: Element;
  enterTime: number;
  timeout: ReturnType<typeof setTimeout> | null;
}

/**
 * Create a new DOM event logger instance
 */
export function createDomEventLogger(): DomEventLogger {
  let events: DomEvent[] = [];
  const callbacks: Set<DomEventCallback> = new Set();
  let isRunning = false;
  let startTime = 0;
  let hoverState: HoverState | null = null;
  let lastCursorPosition: Point = { x: 0, y: 0 };

  // Event handler references for cleanup
  const handlers: Map<string, EventListener> = new Map();

  function getTimestamp(): number {
    return Date.now() - startTime;
  }

  function emitEvent(event: DomEvent): void {
    events.push(event);
    callbacks.forEach((cb) => cb(event));
  }

  function handleClick(e: MouseEvent): void {
    const target = e.target as Element;
    if (!target) return;

    lastCursorPosition = { x: e.clientX, y: e.clientY };

    const eventData: ClickEventData = {
      type: e.type === 'dblclick' ? 'dblclick' : 'click',
      button: e.button,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
    };

    emitEvent({
      type: e.type === 'dblclick' ? 'dblclick' : 'click',
      timestamp: getTimestamp(),
      target: createElementSnapshot(target),
      data: eventData,
      cursorPosition: lastCursorPosition,
    });
  }

  function handleInput(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target) return;

    const eventData: InputEventData = {
      type: e.type as 'input' | 'change',
      inputType: (e as InputEvent).inputType,
      value: sanitizeInputValue(target),
      previousValue: undefined,
    };

    emitEvent({
      type: e.type as DomEventType,
      timestamp: getTimestamp(),
      target: createElementSnapshot(target),
      data: eventData,
      cursorPosition: lastCursorPosition,
    });
  }

  function handleScroll(e: Event): void {
    const target = e.target;
    const scrollTarget = (target === document || target === document.documentElement)
      ? document.documentElement
      : (target as Element);

    const eventData: ScrollEventData = {
      type: 'scroll',
      scrollTop: scrollTarget.scrollTop,
      scrollLeft: scrollTarget.scrollLeft,
      scrollHeight: scrollTarget.scrollHeight,
      scrollWidth: scrollTarget.scrollWidth,
    };

    emitEvent({
      type: 'scroll',
      timestamp: getTimestamp(),
      target: createElementSnapshot(scrollTarget),
      data: eventData,
      cursorPosition: lastCursorPosition,
    });
  }

  function handleKeyEvent(e: KeyboardEvent): void {
    const target = e.target as Element;
    if (!target) return;

    // Don't log individual keystrokes for text inputs (captured via input event)
    // Only log special keys or non-input contexts
    const isTextInput =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target as HTMLElement).isContentEditable;

    // Skip regular character keys in text inputs
    if (isTextInput && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      return;
    }

    const eventData: KeyEventData = {
      type: e.type as 'keypress' | 'keydown' | 'keyup',
      key: e.key,
      code: e.code,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
    };

    emitEvent({
      type: e.type as DomEventType,
      timestamp: getTimestamp(),
      target: createElementSnapshot(target),
      data: eventData,
      cursorPosition: lastCursorPosition,
    });
  }

  function handleFocus(e: FocusEvent): void {
    const target = e.target as Element;
    if (!target) return;

    const eventData: FocusEventData = {
      type: e.type as 'focus' | 'blur',
      relatedTarget: e.relatedTarget
        ? createElementSnapshot(e.relatedTarget as Element)
        : undefined,
    };

    emitEvent({
      type: e.type as DomEventType,
      timestamp: getTimestamp(),
      target: createElementSnapshot(target),
      data: eventData,
      cursorPosition: lastCursorPosition,
    });
  }

  function handleMouseMove(e: MouseEvent): void {
    lastCursorPosition = { x: e.clientX, y: e.clientY };
  }

  function handleMouseEnter(e: MouseEvent): void {
    const target = e.target as Element;
    if (!target || target === document.body || target === document.documentElement) {
      return;
    }

    // Clear existing hover tracking
    if (hoverState?.timeout) {
      clearTimeout(hoverState.timeout);
    }

    hoverState = {
      element: target,
      enterTime: getTimestamp(),
      timeout: setTimeout(() => {
        // Only log if still hovering over same element
        if (hoverState?.element === target) {
          const duration = getTimestamp() - hoverState.enterTime;
          if (duration >= 500) {
            // Min 500ms hover
            const eventData: HoverEventData = {
              type: 'hover',
              enterTime: hoverState.enterTime,
              duration,
            };

            emitEvent({
              type: 'hover',
              timestamp: getTimestamp(),
              target: createElementSnapshot(target),
              data: eventData,
              cursorPosition: lastCursorPosition,
            });
          }
        }
      }, 500),
    };
  }

  function handleMouseLeave(): void {
    if (hoverState?.timeout) {
      clearTimeout(hoverState.timeout);
      hoverState = null;
    }
  }

  function start(): void {
    if (isRunning) return;

    isRunning = true;
    startTime = Date.now();
    events = [];

    // Register event handlers
    const clickHandler = handleClick as EventListener;
    const inputHandler = handleInput as EventListener;
    const scrollHandler = handleScroll as EventListener;
    const keydownHandler = handleKeyEvent as EventListener;
    const keyupHandler = handleKeyEvent as EventListener;
    const focusHandler = handleFocus as EventListener;
    const blurHandler = handleFocus as EventListener;
    const mousemoveHandler = handleMouseMove as EventListener;
    const mouseenterHandler = handleMouseEnter as EventListener;
    const mouseleaveHandler = handleMouseLeave as EventListener;

    handlers.set('click', clickHandler);
    handlers.set('dblclick', clickHandler);
    handlers.set('input', inputHandler);
    handlers.set('change', inputHandler);
    handlers.set('scroll', scrollHandler);
    handlers.set('keydown', keydownHandler);
    handlers.set('keyup', keyupHandler);
    handlers.set('focus', focusHandler);
    handlers.set('blur', blurHandler);
    handlers.set('mousemove', mousemoveHandler);
    handlers.set('mouseenter', mouseenterHandler);
    handlers.set('mouseleave', mouseleaveHandler);

    // Add listeners with capture for focus/blur to catch all elements
    document.addEventListener('click', clickHandler, true);
    document.addEventListener('dblclick', clickHandler, true);
    document.addEventListener('input', inputHandler, true);
    document.addEventListener('change', inputHandler, true);
    document.addEventListener('scroll', scrollHandler, true);
    document.addEventListener('keydown', keydownHandler, true);
    document.addEventListener('keyup', keyupHandler, true);
    document.addEventListener('focus', focusHandler, true);
    document.addEventListener('blur', blurHandler, true);
    document.addEventListener('mousemove', mousemoveHandler, { passive: true });
    document.addEventListener('mouseenter', mouseenterHandler, true);
    document.addEventListener('mouseleave', mouseleaveHandler, true);
  }

  function stop(): DomEvent[] {
    if (!isRunning) return events;

    isRunning = false;

    // Clean up hover state
    if (hoverState?.timeout) {
      clearTimeout(hoverState.timeout);
      hoverState = null;
    }

    // Remove all event listeners
    handlers.forEach((handler, eventType) => {
      document.removeEventListener(eventType, handler, true);
      document.removeEventListener(eventType, handler);
    });
    handlers.clear();

    return events;
  }

  function getEvents(): DomEvent[] {
    return [...events];
  }

  function clear(): void {
    events = [];
  }

  function onEvent(callback: DomEventCallback): () => void {
    callbacks.add(callback);
    return () => callbacks.delete(callback);
  }

  function isLogging(): boolean {
    return isRunning;
  }

  return {
    start,
    stop,
    getEvents,
    clear,
    onEvent,
    isLogging,
  };
}

/**
 * Generate a unique CSS selector for an element
 * Produces the most specific selector that uniquely identifies the element
 */
export function generateUniqueSelector(element: Element): string {
  // If element has a unique ID, use it
  if (element.id && document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1) {
    return `#${CSS.escape(element.id)}`;
  }

  // Build path from element to root
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    // Try to add unique identifier
    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break; // ID is unique, stop here
    }

    // Add classes if they help narrow down
    if (current.classList.length > 0) {
      const classes = Array.from(current.classList)
        .filter((c) => !c.match(/^(active|selected|hover|focus|disabled)$/i))
        .slice(0, 2) // Limit to 2 classes
        .map((c) => `.${CSS.escape(c)}`)
        .join('');
      selector += classes;
    }

    // Check if selector is unique among siblings
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.matches(selector)
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  // Optimize path - remove unnecessary intermediate elements
  const fullSelector = path.join(' > ');

  // Verify uniqueness
  try {
    const matches = document.querySelectorAll(fullSelector);
    if (matches.length === 1 && matches[0] === element) {
      return fullSelector;
    }
  } catch {
    // Invalid selector, return basic path
  }

  // Fallback: nth-child path from body
  return buildNthChildPath(element);
}

/**
 * Build an nth-child path from body to element (fallback selector)
 */
function buildNthChildPath(element: Element): string {
  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    const parentEl: Element | null = current.parentElement;
    if (parentEl) {
      const index = Array.from(parentEl.children).indexOf(current) + 1;
      path.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`);
    } else {
      path.unshift(current.tagName.toLowerCase());
    }
    current = parentEl;
  }

  return path.join(' > ');
}

/**
 * Create an ElementSnapshot from a DOM element
 */
export function createElementSnapshot(element: Element): ElementSnapshot {
  const rect = element.getBoundingClientRect();
  const tagName = element.tagName.toLowerCase();

  // Get text content (truncated)
  let textContent: string | undefined;
  const text = element.textContent?.trim();
  if (text && text.length > 0) {
    textContent =
      text.length > MAX_TEXT_CONTENT_LENGTH
        ? text.substring(0, MAX_TEXT_CONTENT_LENGTH) + '...'
        : text;
  }

  // Get relevant attributes
  const attributes: Record<string, string> = {};
  const relevantAttrs = ['data-testid', 'data-id', 'aria-label', 'title', 'name', 'type', 'role', 'href'];
  for (const attr of relevantAttrs) {
    const value = element.getAttribute(attr);
    if (value) {
      attributes[attr] = value;
    }
  }

  // Get placeholder for inputs
  let placeholder: string | undefined;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    placeholder = element.placeholder || undefined;
  }

  // Get value for form elements (sanitized)
  let value: string | undefined;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (!isSensitiveElement(element)) {
      value = element.value;
    }
  } else if (element instanceof HTMLSelectElement) {
    value = element.options[element.selectedIndex]?.text;
  }

  return {
    tagName,
    id: element.id || undefined,
    classes: Array.from(element.classList),
    textContent,
    selector: generateUniqueSelector(element),
    boundingRect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    },
    attributes,
    role: element.getAttribute('role') || undefined,
    placeholder,
    value,
  };
}

/**
 * Sanitize input value (remove sensitive data like passwords)
 */
export function sanitizeInputValue(
  element: HTMLInputElement | HTMLTextAreaElement
): string {
  if (isSensitiveElement(element)) {
    return '[REDACTED]';
  }
  return element.value;
}

/**
 * Check if an element contains potentially sensitive data
 */
export function isSensitiveElement(element: Element): boolean {
  if (element instanceof HTMLInputElement) {
    // Check input type
    if (SENSITIVE_INPUT_TYPES.includes(element.type)) {
      return true;
    }

    // Check autocomplete attribute
    const autocomplete = element.getAttribute('autocomplete');
    if (autocomplete && SENSITIVE_AUTOCOMPLETE.includes(autocomplete)) {
      return true;
    }

    // Check name/id for common patterns
    const name = element.name?.toLowerCase() || '';
    const id = element.id?.toLowerCase() || '';
    const sensitivePatterns = ['password', 'passwd', 'secret', 'credit', 'card', 'cvv', 'cvc', 'ssn'];
    if (sensitivePatterns.some((p) => name.includes(p) || id.includes(p))) {
      return true;
    }
  }

  return false;
}
