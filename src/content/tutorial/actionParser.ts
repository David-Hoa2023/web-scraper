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

import { DEFAULT_ACTION_PARSER_CONFIG } from '../../types/tutorial';

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
  config?: Partial<ActionParserConfig>
): ActionParser {
  const parserConfig: ActionParserConfig = {
    ...DEFAULT_ACTION_PARSER_CONFIG,
    ...config,
  };

  function parse(events: DomEvent[]): TutorialStep[] {
    return parseWithConfig(events, parserConfig);
  }

  function parseWithConfig(events: DomEvent[], cfg: ActionParserConfig): TutorialStep[] {
    // Filter insignificant events
    const significant = filterInsignificantEvents(events, cfg);

    // Group keystrokes if enabled
    const grouped = cfg.groupKeystrokes
      ? groupAndMergeKeystrokes(significant, cfg.keystrokeGroupingThreshold)
      : significant;

    // Convert to parsed actions
    const parsedActions = grouped.map((event) => ({
      event,
      description: eventToDescription(event),
      type: getActionType(event),
      targetDescription: describeElement(event.target),
      isSignificant: true,
      groupedWith: undefined,
    } as ParsedAction));

    // Convert to tutorial steps
    return parsedActions.map((action, index) => ({
      stepNumber: index + 1,
      action: action.description,
      actionType: action.type,
      target: action.targetDescription,
      targetSelector: action.event.target.selector,
      timestamp: action.event.timestamp,
      inputValue: getInputValue(action.event),
    }));
  }

  function getParsedActions(events: DomEvent[]): ParsedAction[] {
    const significant = filterInsignificantEvents(events, parserConfig);
    return significant.map((event) => ({
      event,
      description: eventToDescription(event),
      type: getActionType(event),
      targetDescription: describeElement(event.target),
      isSignificant: true,
    }));
  }

  return {
    parse,
    parseWithConfig,
    getParsedActions,
  };
}

/**
 * Convert a DOM event to a human-readable action description
 */
export function eventToDescription(event: DomEvent): string {
  const target = describeElement(event.target);

  switch (event.type) {
    case 'click':
      return `Click on ${target}`;

    case 'dblclick':
      return `Double-click on ${target}`;

    case 'input':
    case 'change': {
      const inputData = event.data as { value?: string };
      if (inputData.value) {
        const truncatedValue = inputData.value.length > 30
          ? inputData.value.substring(0, 30) + '...'
          : inputData.value;
        return `Type "${truncatedValue}" in ${target}`;
      }
      return `Enter text in ${target}`;
    }

    case 'scroll':
      return `Scroll the page`;

    case 'focus':
      return `Focus on ${target}`;

    case 'blur':
      return `Click away from ${target}`;

    case 'hover':
      return `Hover over ${target}`;

    case 'keydown':
    case 'keyup':
    case 'keypress': {
      const keyData = event.data as { key?: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean };
      const modifiers: string[] = [];
      if (keyData.ctrlKey) modifiers.push('Ctrl');
      if (keyData.altKey) modifiers.push('Alt');
      if (keyData.metaKey) modifiers.push('Cmd');

      const keyName = formatKeyName(keyData.key || '');
      const combo = modifiers.length > 0
        ? `${modifiers.join('+')}+${keyName}`
        : keyName;

      return `Press ${combo}`;
    }

    case 'select':
      return `Select text in ${target}`;

    case 'submit':
      return `Submit the form`;

    default:
      return `Interact with ${target}`;
  }
}

/**
 * Format key name for display
 */
function formatKeyName(key: string): string {
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    'Enter': 'Enter',
    'Tab': 'Tab',
    'Escape': 'Escape',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
    'ArrowUp': 'Up Arrow',
    'ArrowDown': 'Down Arrow',
    'ArrowLeft': 'Left Arrow',
    'ArrowRight': 'Right Arrow',
  };

  return keyMap[key] || key;
}

/**
 * Get input value from event if applicable
 */
function getInputValue(event: DomEvent): string | undefined {
  if (event.type === 'input' || event.type === 'change') {
    const data = event.data as { value?: string };
    return data.value;
  }
  return undefined;
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
      return 'click';
    case 'keypress':
    case 'keydown':
    case 'keyup':
      return 'type';
    case 'select':
      return 'select';
    case 'submit':
      return 'click';
    default:
      return 'click';
  }
}

/**
 * Generate a human-readable description of an element
 */
export function describeElement(snapshot: ElementSnapshot): string {
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

  // Check for name attribute (forms)
  if (attributes['name']) {
    return `the "${attributes['name']}" field`;
  }

  if (textContent && textContent.length <= 50) {
    const trimmed = textContent.trim();
    if (trimmed && !trimmed.includes('\n')) {
      return `the "${trimmed}" ${getElementType(snapshot)}`;
    }
  }

  // Fallback to element type with context
  const elementType = getElementType(snapshot);
  if (snapshot.classes.length > 0) {
    const mainClass = snapshot.classes[0];
    if (!mainClass.match(/^[a-z]{2,4}-/)) { // Skip utility classes
      return `the ${mainClass} ${elementType}`;
    }
  }

  return `the ${elementType}`;
}

/**
 * Get a human-readable element type from a snapshot
 */
export function getElementType(snapshot: ElementSnapshot): string {
  const { tagName, role, attributes } = snapshot;

  // Check role first
  if (role) {
    const roleMap: Record<string, string> = {
      button: 'button',
      link: 'link',
      textbox: 'text field',
      checkbox: 'checkbox',
      radio: 'radio button',
      combobox: 'dropdown',
      listbox: 'list',
      menu: 'menu',
      menuitem: 'menu item',
      tab: 'tab',
      tabpanel: 'tab panel',
      dialog: 'dialog',
      alert: 'alert',
      navigation: 'navigation',
      search: 'search',
    };
    if (roleMap[role]) return roleMap[role];
  }

  // Check for common input types
  if (tagName === 'input') {
    const type = attributes['type'] || 'text';
    const inputTypeMap: Record<string, string> = {
      submit: 'submit button',
      button: 'button',
      checkbox: 'checkbox',
      radio: 'radio button',
      search: 'search field',
      email: 'email field',
      password: 'password field',
      number: 'number field',
      tel: 'phone field',
      url: 'URL field',
      date: 'date picker',
      file: 'file upload',
      text: 'text field',
    };
    return inputTypeMap[type] || 'input field';
  }

  // Map common tags to friendly names
  const tagMap: Record<string, string> = {
    button: 'button',
    a: 'link',
    select: 'dropdown',
    textarea: 'text area',
    img: 'image',
    video: 'video',
    audio: 'audio player',
    form: 'form',
    nav: 'navigation',
    header: 'header',
    footer: 'footer',
    main: 'main content',
    aside: 'sidebar',
    article: 'article',
    section: 'section',
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
    h4: 'heading',
    h5: 'heading',
    h6: 'heading',
    p: 'paragraph',
    li: 'list item',
    table: 'table',
    tr: 'table row',
    td: 'table cell',
    th: 'table header',
    label: 'label',
    span: 'element',
    div: 'element',
  };

  return tagMap[tagName] || tagName;
}

/**
 * Group consecutive keystroke events into typing actions
 */
export function groupKeystrokes(
  events: DomEvent[],
  thresholdMs: number
): DomEvent[][] {
  const groups: DomEvent[][] = [];
  let currentGroup: DomEvent[] = [];

  for (const event of events) {
    if (event.type !== 'keydown' && event.type !== 'keyup' && event.type !== 'keypress') {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      groups.push([event]);
      continue;
    }

    if (currentGroup.length === 0) {
      currentGroup.push(event);
    } else {
      const lastEvent = currentGroup[currentGroup.length - 1];
      if (event.timestamp - lastEvent.timestamp <= thresholdMs) {
        currentGroup.push(event);
      } else {
        groups.push(currentGroup);
        currentGroup = [event];
      }
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Group keystrokes and merge into single events
 */
function groupAndMergeKeystrokes(
  events: DomEvent[],
  thresholdMs: number
): DomEvent[] {
  const groups = groupKeystrokes(events, thresholdMs);
  return groups.map((group) => {
    if (group.length === 1) return group[0];

    // Merge keystroke group into single event
    // Use the first event as base, combine keys
    const first = group[0];
    const keys = group
      .filter((e) => e.type === 'keydown')
      .map((e) => {
        const data = e.data as { key?: string };
        return data.key || '';
      })
      .filter((k) => k.length === 1) // Only single characters
      .join('');

    if (keys.length > 0) {
      return {
        ...first,
        type: 'input' as const,
        data: {
          type: 'input',
          value: keys,
        },
      };
    }

    return first;
  });
}

/**
 * Filter out insignificant events
 */
export function filterInsignificantEvents(
  events: DomEvent[],
  config: ActionParserConfig
): DomEvent[] {
  return events.filter((event) => {
    // Filter minor scrolls
    if (config.filterMinorScrolls && event.type === 'scroll') {
      const scrollData = event.data as { scrollTop?: number; scrollLeft?: number };
      const distance = Math.abs(scrollData.scrollTop || 0) + Math.abs(scrollData.scrollLeft || 0);
      if (distance < config.minScrollDistance) {
        return false;
      }
    }

    // Filter short hovers
    if (event.type === 'hover') {
      const hoverData = event.data as { duration?: number };
      if ((hoverData.duration || 0) < config.minHoverDuration) {
        return false;
      }
    }

    // Filter focus events that immediately precede clicks on same element
    // (usually redundant)
    if (event.type === 'focus' || event.type === 'blur') {
      return false; // Generally skip these as they're implied by clicks
    }

    return true;
  });
}

/**
 * Calculate the significance score of an event (0-1)
 */
export function calculateSignificance(event: DomEvent): number {
  let score = 0.5;

  // Clicks are generally significant
  if (event.type === 'click' || event.type === 'dblclick') {
    score = 0.9;
  }

  // Input events are significant
  if (event.type === 'input' || event.type === 'change') {
    score = 0.85;
  }

  // Key events depend on the key
  if (event.type === 'keydown' || event.type === 'keyup') {
    const data = event.data as { key?: string; ctrlKey?: boolean; altKey?: boolean };
    if (data.ctrlKey || data.altKey) {
      score = 0.8; // Keyboard shortcuts are significant
    } else if (data.key === 'Enter' || data.key === 'Tab' || data.key === 'Escape') {
      score = 0.7;
    } else {
      score = 0.3; // Regular typing is less significant individually
    }
  }

  // Scrolls are less significant
  if (event.type === 'scroll') {
    score = 0.4;
  }

  // Hovers are least significant
  if (event.type === 'hover') {
    score = 0.2;
  }

  return score;
}
