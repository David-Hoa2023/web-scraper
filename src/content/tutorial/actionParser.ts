/**
 * Action Parser
 * Converts DOM events to human-readable tutorial steps
 */

import type { DomEvent, ElementSnapshot } from '../../types/recording';
import type {
  TutorialStep,
  ActionType,
  ParsedAction,
  ActionParserConfig,
} from '../../types/tutorial';

export interface ActionParser {
  /** Parse DOM events into tutorial steps */
  parse(events: DomEvent[]): TutorialStep[];
  /** Parse with custom configuration */
  parseWithConfig(events: DomEvent[], config: ActionParserConfig): TutorialStep[];
  /** Get parsed actions (before step conversion) */
  getParsedActions(events: DomEvent[]): ParsedAction[];
}

/**
 * Create a new action parser instance
 */
export function createActionParser(
  _config?: Partial<ActionParserConfig>
): ActionParser {
  // TODO: Implement in Stage 7
  throw new Error('Not implemented - Stage 7');
}

/**
 * Convert a DOM event to a human-readable action description
 */
export function eventToDescription(_event: DomEvent): string {
  // TODO: Implement in Stage 7
  throw new Error('Not implemented - Stage 7');
}

/**
 * Determine the action type from a DOM event
 */
export function getActionType(event: DomEvent): ActionType {
  switch (event.type) {
    case 'click':
    case 'dblclick':
      return 'click';
    case 'input':
    case 'change':
      return 'type';
    case 'scroll':
      return 'scroll';
    case 'hover':
      return 'hover';
    case 'focus':
    case 'blur':
      return 'click'; // Focus usually follows a click
    case 'keypress':
    case 'keydown':
    case 'keyup':
      return 'type';
    default:
      return 'click';
  }
}

/**
 * Generate a human-readable description of an element
 */
export function describeElement(snapshot: ElementSnapshot): string {
  // Priority: aria-label > title > placeholder > text content > tag+class
  const { textContent, attributes, placeholder } = snapshot;

  // Check for accessible name
  if (attributes['aria-label']) {
    return `the "${attributes['aria-label']}" ${getElementType(snapshot)}`;
  }

  if (attributes['title']) {
    return `the "${attributes['title']}" ${getElementType(snapshot)}`;
  }

  if (placeholder) {
    return `the "${placeholder}" field`;
  }

  if (textContent && textContent.length <= 50) {
    const trimmed = textContent.trim();
    if (trimmed) {
      return `the "${trimmed}" ${getElementType(snapshot)}`;
    }
  }

  // Fallback to element type
  return `the ${getElementType(snapshot)}`;
}

/**
 * Get a human-readable element type from a snapshot
 */
export function getElementType(snapshot: ElementSnapshot): string {
  const { tagName, role, attributes } = snapshot;

  // Check role first
  if (role) {
    return role;
  }

  // Check for common input types
  if (tagName === 'input') {
    const type = attributes['type'] || 'text';
    switch (type) {
      case 'submit':
        return 'submit button';
      case 'checkbox':
        return 'checkbox';
      case 'radio':
        return 'radio button';
      case 'search':
        return 'search field';
      case 'email':
        return 'email field';
      case 'password':
        return 'password field';
      default:
        return 'input field';
    }
  }

  // Map common tags to friendly names
  const tagMap: Record<string, string> = {
    button: 'button',
    a: 'link',
    select: 'dropdown',
    textarea: 'text area',
    img: 'image',
    video: 'video',
    form: 'form',
    nav: 'navigation',
    header: 'header',
    footer: 'footer',
    main: 'main content',
    aside: 'sidebar',
    article: 'article',
    section: 'section',
    div: 'element',
    span: 'element',
  };

  return tagMap[tagName] || tagName;
}

/**
 * Group consecutive keystroke events into typing actions
 */
export function groupKeystrokes(
  _events: DomEvent[],
  _thresholdMs: number
): DomEvent[][] {
  // TODO: Implement in Stage 7
  throw new Error('Not implemented - Stage 7');
}

/**
 * Filter out insignificant events (tiny scrolls, rapid focus changes, etc.)
 */
export function filterInsignificantEvents(
  _events: DomEvent[],
  _config: ActionParserConfig
): DomEvent[] {
  // TODO: Implement in Stage 7
  throw new Error('Not implemented - Stage 7');
}

/**
 * Calculate the significance score of an event (0-1)
 */
export function calculateSignificance(_event: DomEvent): number {
  // TODO: Implement in Stage 7
  throw new Error('Not implemented - Stage 7');
}
