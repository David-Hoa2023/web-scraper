/**
 * Platform Extractors - Auto-detection and product data extraction
 * Detects current e-commerce platform and extracts product data
 */

import type {
  PlatformConfig,
  PlatformId,
  PlatformField,
  PriceSnapshot,
  PlatformDetectionResult,
} from '../types/arbitrage';
import { platformConfigs, getParser } from './platformConfigs';

/**
 * Detect the current platform based on URL
 */
export function detectPlatform(): PlatformDetectionResult {
  const hostname = window.location.hostname.toLowerCase();
  const pathname = window.location.pathname.toLowerCase();
  const fullUrl = window.location.href;

  for (const config of Object.values(platformConfigs)) {
    for (const domain of config.domains) {
      // Check if hostname contains the domain
      if (hostname.includes(domain.replace('www.', ''))) {
        return {
          detected: true,
          platform: config,
          url: fullUrl,
          timestamp: Date.now(),
        };
      }
      // Check pathname for platforms like TikTok Shop
      if (pathname.includes(domain)) {
        return {
          detected: true,
          platform: config,
          url: fullUrl,
          timestamp: Date.now(),
        };
      }
    }
  }

  return {
    detected: false,
    platform: null,
    url: fullUrl,
    timestamp: Date.now(),
  };
}

/**
 * Get platform by ID
 */
export function getPlatformById(platformId: PlatformId): PlatformConfig | null {
  return platformConfigs[platformId] || null;
}

/**
 * Detect currency from regional domain
 */
export function detectCurrency(config: PlatformConfig): string {
  const hostname = window.location.hostname.toLowerCase();

  if (config.regionalDomains) {
    for (const [domain, currency] of Object.entries(config.regionalDomains)) {
      if (hostname.includes(domain)) {
        return currency;
      }
    }
  }

  return config.currency;
}

/**
 * Extract field value from element
 */
function extractFieldValue(
  element: Element,
  field: PlatformField
): string | null {
  // Try main selector first
  const selectors = [field.selector, ...(field.fallbackSelectors || [])];

  for (const selector of selectors) {
    try {
      const target = element.querySelector(selector);
      if (!target) continue;

      let value: string | null = null;

      switch (field.type) {
        case 'text':
          value = target.textContent?.trim() || null;
          break;
        case 'href':
          value = (target as HTMLAnchorElement).href || target.getAttribute('href');
          break;
        case 'src':
          value = (target as HTMLImageElement).src ||
                  target.getAttribute('src') ||
                  target.getAttribute('data-src');
          break;
        case 'attr':
          value = target.getAttribute(field.attrName || '') || null;
          break;
        case 'computed':
          // For computed fields, extract from data attributes or special handling
          value = target.getAttribute('data-value') || target.textContent?.trim() || null;
          break;
      }

      if (value) return value;
    } catch {
      // Continue to next selector
    }
  }

  return null;
}

/**
 * Generate a unique product ID from URL or element
 */
function generateProductId(element: Element, url: string | null): string {
  // Try to extract from URL first
  if (url) {
    // Common patterns: /product/123, /item/123, ?goods_id=123, /p-123.html
    const patterns = [
      /\/(?:product|item|goods|p)[/-](\d+)/i,
      /[?&](?:goods_id|item_id|product_id|id)=(\d+)/i,
      /-p-(\d+)/i,
      /\/(\d{10,})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
  }

  // Generate from element position as fallback
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);
    return `item_${Date.now()}_${index}`;
  }

  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Normalize URL to absolute
 */
function normalizeUrl(url: string | null): string {
  if (!url) return window.location.href;
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `${window.location.origin}${url}`;
  return `${window.location.origin}/${url}`;
}

/**
 * Extract product data from a single element
 */
export function extractProductData(
  element: Element,
  config: PlatformConfig
): PriceSnapshot | null {
  const fieldValues: Record<string, string | number | null> = {};

  // Extract all fields
  for (const field of config.fields) {
    const rawValue = extractFieldValue(element, field);

    if (rawValue && field.parser) {
      const parser = getParser(field.parser);
      fieldValues[field.name] = parser(rawValue);
    } else {
      fieldValues[field.name] = rawValue;
    }
  }

  // Validate required fields (title and price)
  const title = fieldValues.title as string;
  const price = fieldValues.price as number;

  if (!title || !price) {
    return null;
  }

  // Get URL and generate ID
  const url = normalizeUrl(fieldValues.url as string);
  const productId = (fieldValues.productId as string) || generateProductId(element, url);
  const currency = detectCurrency(config);
  const timestamp = Date.now();

  // Build PriceSnapshot
  const snapshot: PriceSnapshot = {
    id: `${config.id}_${productId}_${timestamp}`,
    platform: config.id,
    productId,
    title,
    price,
    currency,
    url,
    timestamp,
  };

  // Add optional fields
  if (fieldValues.originalPrice) {
    snapshot.originalPrice = fieldValues.originalPrice as number;
  }
  if (fieldValues.discount) {
    snapshot.discount = fieldValues.discount as number;
  }
  if (fieldValues.image) {
    snapshot.image = normalizeUrl(fieldValues.image as string);
  }
  if (fieldValues.rating) {
    snapshot.rating = fieldValues.rating as number;
  }
  if (fieldValues.sales) {
    snapshot.sales = fieldValues.sales as string;
    // Try to extract numeric sold count
    const soldMatch = (fieldValues.sales as string).match(/(\d+(?:[.,]\d+)?)\s*([km])?/i);
    if (soldMatch) {
      let count = parseFloat(soldMatch[1].replace(',', '.'));
      if (soldMatch[2]?.toLowerCase() === 'k') count *= 1000;
      if (soldMatch[2]?.toLowerCase() === 'm') count *= 1000000;
      snapshot.soldCount = Math.round(count);
    }
  }
  if (fieldValues.shipping) {
    snapshot.shipping = fieldValues.shipping as string;
  }
  if (fieldValues.seller) {
    snapshot.seller = fieldValues.seller as string;
  }
  if (fieldValues.location) {
    snapshot.location = fieldValues.location as string;
  }

  return snapshot;
}

/**
 * Find all product elements on the page
 */
export function findProductElements(config: PlatformConfig): Element[] {
  const selectors = [config.itemSelector, ...(config.itemSelectorFallbacks || [])];

  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    } catch {
      // Invalid selector, continue
    }
  }

  return [];
}

/**
 * Extract all products from the current page
 */
export function extractAllProducts(config: PlatformConfig): PriceSnapshot[] {
  const elements = findProductElements(config);
  const products: PriceSnapshot[] = [];

  for (const element of elements) {
    const product = extractProductData(element, config);
    if (product) {
      products.push(product);
    }
  }

  return products;
}

/**
 * Extract products from page with platform auto-detection
 */
export function extractProductsFromPage(): {
  platform: PlatformConfig | null;
  products: PriceSnapshot[];
} {
  const detection = detectPlatform();

  if (!detection.detected || !detection.platform) {
    return { platform: null, products: [] };
  }

  const products = extractAllProducts(detection.platform);
  return { platform: detection.platform, products };
}

// Re-export platform configs
export { platformConfigs, getAllPlatformIds, getAllPlatformConfigs } from './platformConfigs';
