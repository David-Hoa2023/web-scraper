/**
 * Data Extractor Module for Web Scraper Chrome Extension
 *
 * Provides flexible data extraction with user-customizable fields,
 * hierarchical data preservation, and normalization.
 */

import type { ExtractionConfig, ExtractionField, ExtractedItem } from '../types';

/**
 * Default heuristic extraction config
 * Used when no custom config is provided
 */
export const defaultExtractionConfig: ExtractionConfig = {
  fields: [],
  preserveHierarchy: false,
  normalize: true,
};

/**
 * Extracts a single field value from an element
 */
function extractFieldValue(
  element: Element,
  field: ExtractionField
): string {
  const target = field.selector ? element.querySelector(field.selector) : element;
  if (!target) return '';

  switch (field.type) {
    case 'text':
      return target.textContent?.trim() || '';
    case 'href':
      return (target as HTMLAnchorElement).href || target.getAttribute('href') || '';
    case 'src':
      return (target as HTMLImageElement).src || target.getAttribute('src') || '';
    case 'attr':
      return field.attrName ? target.getAttribute(field.attrName) || '' : '';
    default:
      return '';
  }
}

/**
 * Applies heuristic extraction when no custom fields are provided
 * Auto-detects images, links, headings, and text content
 */
function extractWithHeuristics(element: Element): ExtractedItem {
  const item: ExtractedItem = {};

  // Extract first image
  const img = element.querySelector('img');
  if (img) {
    item.image = img.src || img.getAttribute('data-src') || '';
    item.imageAlt = img.alt || '';
  }

  // Extract first link
  const link = element.querySelector('a');
  if (link) {
    item.link = link.href || '';
    item.linkText = link.textContent?.trim() || '';
  }

  // Extract heading (h1-h6)
  const heading = element.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    item.title = heading.textContent?.trim() || '';
  }

  // Extract main text content (excluding already extracted elements)
  const clonedElement = element.cloneNode(true) as Element;
  const toRemove = clonedElement.querySelectorAll('img, script, style, noscript');
  toRemove.forEach((el) => el.remove());
  const textContent = clonedElement.textContent?.trim().replace(/\s+/g, ' ') || '';
  if (textContent) {
    item.text = textContent.substring(0, 500); // Limit text length
  }

  // Extract data attributes
  const dataAttrs: Record<string, string> = {};
  Array.from(element.attributes).forEach((attr) => {
    if (attr.name.startsWith('data-')) {
      const key = attr.name.replace('data-', '');
      dataAttrs[key] = attr.value;
    }
  });
  if (Object.keys(dataAttrs).length > 0) {
    item.dataAttributes = dataAttrs;
  }

  return item;
}

/**
 * Extracts hierarchical data from an element
 * Preserves parent-child relationships
 */
function extractHierarchical(
  element: Element,
  fields: ExtractionField[],
  depth: number = 0,
  maxDepth: number = 3
): ExtractedItem {
  if (depth >= maxDepth) {
    return extractFlat(element, fields);
  }

  const item: ExtractedItem = {};

  // Extract fields at current level
  for (const field of fields) {
    const value = extractFieldValue(element, field);
    if (value) {
      item[field.name] = value;
    }
  }

  // Look for nested lists/containers
  const childContainers = element.querySelectorAll(':scope > ul, :scope > ol, :scope > div[class*="list"], :scope > div[class*="items"]');

  if (childContainers.length > 0) {
    const children: ExtractedItem[] = [];
    childContainers.forEach((container) => {
      const childElements = container.querySelectorAll(':scope > li, :scope > div, :scope > article');
      childElements.forEach((child) => {
        children.push(extractHierarchical(child, fields, depth + 1, maxDepth));
      });
    });
    if (children.length > 0) {
      item.children = children;
    }
  }

  return item;
}

/**
 * Extracts flat data from an element
 */
function extractFlat(element: Element, fields: ExtractionField[]): ExtractedItem {
  const item: ExtractedItem = {};

  for (const field of fields) {
    const value = extractFieldValue(element, field);
    item[field.name] = value;
  }

  return item;
}

/**
 * Normalizes extracted data
 * - Trims whitespace
 * - Normalizes URLs (absolute paths)
 * - Handles missing data gracefully
 */
export function normalizeData(item: ExtractedItem): ExtractedItem {
  const normalized: ExtractedItem = {};

  for (const [key, value] of Object.entries(item)) {
    if (value === undefined || value === null) {
      normalized[key] = '';
      continue;
    }

    if (typeof value === 'string') {
      let normalizedValue = value.trim();

      // Normalize URLs
      if (key.toLowerCase().includes('url') ||
          key.toLowerCase().includes('link') ||
          key.toLowerCase().includes('href') ||
          key.toLowerCase().includes('src') ||
          key.toLowerCase().includes('image')) {
        if (normalizedValue && !normalizedValue.startsWith('http') && !normalizedValue.startsWith('data:')) {
          try {
            normalizedValue = new URL(normalizedValue, window.location.origin).href;
          } catch {
            // Keep original if URL parsing fails
          }
        }
      }

      // Normalize whitespace
      normalizedValue = normalizedValue.replace(/\s+/g, ' ');

      normalized[key] = normalizedValue;
    } else if (Array.isArray(value)) {
      normalized[key] = value.map((v) =>
        typeof v === 'object' ? normalizeData(v as ExtractedItem) : v
      );
    } else if (typeof value === 'object') {
      normalized[key] = normalizeData(value as ExtractedItem);
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Main extraction function
 * Extracts data from an element based on configuration
 */
export function extractData(
  element: Element,
  config: ExtractionConfig = defaultExtractionConfig
): ExtractedItem {
  let item: ExtractedItem;

  // Use heuristics if no fields specified
  if (config.fields.length === 0) {
    item = extractWithHeuristics(element);
  } else if (config.preserveHierarchy) {
    item = extractHierarchical(element, config.fields);
  } else {
    item = extractFlat(element, config.fields);
  }

  // Normalize if requested
  if (config.normalize) {
    item = normalizeData(item);
  }

  return item;
}

/**
 * Batch extraction from multiple elements
 */
export function extractBatch(
  elements: Element[],
  config: ExtractionConfig = defaultExtractionConfig
): ExtractedItem[] {
  return elements.map((element) => extractData(element, config));
}

/**
 * Creates extraction config from field definitions
 */
export function createExtractionConfig(
  fields: Partial<ExtractionField>[],
  options: { preserveHierarchy?: boolean; normalize?: boolean } = {}
): ExtractionConfig {
  const normalizedFields: ExtractionField[] = fields.map((field) => ({
    name: field.name || 'unnamed',
    selector: field.selector || '',
    type: field.type || 'text',
    attrName: field.attrName,
  }));

  return {
    fields: normalizedFields,
    preserveHierarchy: options.preserveHierarchy ?? false,
    normalize: options.normalize ?? true,
  };
}

/**
 * Predefined field extractors for common patterns
 */
export const commonFields = {
  title: { name: 'title', selector: 'h1, h2, h3, [class*="title"]', type: 'text' as const },
  description: { name: 'description', selector: 'p, [class*="desc"]', type: 'text' as const },
  image: { name: 'image', selector: 'img', type: 'src' as const },
  link: { name: 'link', selector: 'a', type: 'href' as const },
  price: { name: 'price', selector: '[class*="price"]', type: 'text' as const },
  date: { name: 'date', selector: 'time, [class*="date"]', type: 'text' as const },
  author: { name: 'author', selector: '[class*="author"], [rel="author"]', type: 'text' as const },
};
