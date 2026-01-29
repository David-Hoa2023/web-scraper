/**
 * Platform Configurations - Field extractors for 6 e-commerce platforms
 * Temu, Shein, AliExpress, Shopee, Lazada, TikTok Shop
 */

import type { PlatformConfig, PlatformId } from '../types/arbitrage';

/**
 * Parse price string to number
 * Handles various formats: $12.99, 12,99€, ¥99.00, etc.
 */
export function parsePrice(value: string): number {
  if (!value) return 0;
  // Remove currency symbols and whitespace
  const cleaned = value.replace(/[^\d.,]/g, '').trim();
  // Handle comma as decimal separator (European format)
  const normalized = cleaned.includes(',') && !cleaned.includes('.')
    ? cleaned.replace(',', '.')
    : cleaned.replace(/,/g, '');
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse percentage string to number
 * Handles: -50%, 50% off, Save 50%, etc.
 */
export function parsePercent(value: string): number {
  if (!value) return 0;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Parse rating string to number
 * Handles: 4.5, 4.5/5, ★★★★☆, etc.
 */
export function parseRating(value: string): number {
  if (!value) return 0;
  // Count stars if present
  const stars = (value.match(/★|⭐/g) || []).length;
  if (stars > 0) return stars;
  // Extract numeric rating
  const match = value.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Parse sales count string to number
 * Handles: 1.2k sold, 500+ sold, 10,000 orders, etc.
 */
export function parseSalesCount(value: string): number {
  if (!value) return 0;
  const cleaned = value.toLowerCase();
  const match = cleaned.match(/(\d+(?:[.,]\d+)?)\s*([km])?/);
  if (!match) return 0;
  let num = parseFloat(match[1].replace(',', '.'));
  if (match[2] === 'k') num *= 1000;
  if (match[2] === 'm') num *= 1000000;
  return Math.round(num);
}

/**
 * Get parser function by name
 */
export function getParser(parserName: string): (value: string) => number {
  switch (parserName) {
    case 'price':
      return parsePrice;
    case 'percent':
      return parsePercent;
    case 'rating':
      return parseRating;
    case 'number':
    case 'sales':
      return parseSalesCount;
    default:
      return (v) => parseFloat(v) || 0;
  }
}

/**
 * Platform configurations for 6 e-commerce platforms
 */
export const platformConfigs: Record<PlatformId, PlatformConfig> = {
  temu: {
    name: 'Temu',
    id: 'temu',
    domains: ['temu.com', 'www.temu.com'],
    itemSelector: '[class*="ProductCard"], [data-testid*="product"], [class*="product-card"]',
    itemSelectorFallbacks: [
      '[class*="_2xT4M"]', // Common Temu class pattern
      '[class*="goods-item"]',
      'div[data-tracking]',
    ],
    rateLimit: 3000, // 3s delay - Temu has strict anti-bot
    currency: 'USD',
    currencySymbol: '$',
    fields: [
      {
        name: 'productId',
        selector: '[data-product-id], [data-goods-id], a[href*="/product"]',
        type: 'attr',
        attrName: 'data-product-id',
        fallbackSelectors: ['a[href*="goods_id"]'],
      },
      {
        name: 'title',
        selector: '[class*="title"], [class*="name"], [class*="goods-title"]',
        type: 'text',
        fallbackSelectors: ['h3', 'h4', '[class*="desc"]'],
      },
      {
        name: 'price',
        selector: '[class*="price"]:not([class*="original"]):not([class*="del"]), [class*="sale-price"]',
        type: 'text',
        parser: 'price',
        fallbackSelectors: ['[class*="current"]', 'span[class*="num"]'],
      },
      {
        name: 'originalPrice',
        selector: '[class*="original"], [class*="del-price"], [class*="market"]',
        type: 'text',
        parser: 'price',
      },
      {
        name: 'discount',
        selector: '[class*="discount"], [class*="off"], [class*="save"]',
        type: 'text',
        parser: 'percent',
      },
      {
        name: 'sales',
        selector: '[class*="sold"], [class*="sales"], [class*="bought"]',
        type: 'text',
      },
      {
        name: 'rating',
        selector: '[class*="rating"], [class*="star"], [class*="score"]',
        type: 'text',
        parser: 'rating',
      },
      {
        name: 'image',
        selector: 'img[src*="img"], img[data-src]',
        type: 'src',
        fallbackSelectors: ['img'],
      },
      {
        name: 'url',
        selector: 'a[href*="/product"], a[href*="goods_id"]',
        type: 'href',
        fallbackSelectors: ['a'],
      },
    ],
  },

  shein: {
    name: 'Shein',
    id: 'shein',
    domains: ['shein.com', 'www.shein.com', 'us.shein.com', 'uk.shein.com', 'de.shein.com', 'fr.shein.com'],
    itemSelector: '[class*="goods-item"], [class*="product-item"], [class*="S-product-item"]',
    itemSelectorFallbacks: [
      '[class*="product-card"]',
      '[data-goods-id]',
      'section[class*="product"]',
    ],
    rateLimit: 2000, // 2s delay
    currency: 'USD',
    currencySymbol: '$',
    fields: [
      {
        name: 'productId',
        selector: '[data-goods-id], [data-product-id]',
        type: 'attr',
        attrName: 'data-goods-id',
      },
      {
        name: 'title',
        selector: '[class*="goods-title"], [class*="product-name"], [class*="title-text"]',
        type: 'text',
        fallbackSelectors: ['a[title]', '[class*="name"]'],
      },
      {
        name: 'price',
        selector: '[class*="price-num"], [class*="normal-price"], [class*="sale-price"]',
        type: 'text',
        parser: 'price',
        fallbackSelectors: ['[class*="price"]:not([class*="del"])'],
      },
      {
        name: 'originalPrice',
        selector: '[class*="del-price"], [class*="origin-price"], [class*="retail-price"]',
        type: 'text',
        parser: 'price',
      },
      {
        name: 'discount',
        selector: '[class*="discount"], [class*="off-tag"], [class*="save"]',
        type: 'text',
        parser: 'percent',
      },
      {
        name: 'sales',
        selector: '[class*="sold"], [class*="sales-volume"]',
        type: 'text',
      },
      {
        name: 'rating',
        selector: '[class*="star-rating"], [class*="rate-num"]',
        type: 'text',
        parser: 'rating',
      },
      {
        name: 'image',
        selector: 'img[src*="img.ltwebstatic"], img.crop-image-container__img',
        type: 'src',
        fallbackSelectors: ['img[data-src]', 'img'],
      },
      {
        name: 'url',
        selector: 'a[href*="/product"], a[href*="-p-"]',
        type: 'href',
        fallbackSelectors: ['a'],
      },
    ],
  },

  aliexpress: {
    name: 'AliExpress',
    id: 'aliexpress',
    domains: ['aliexpress.com', 'www.aliexpress.com', 'aliexpress.ru', 'aliexpress.us'],
    itemSelector: '[class*="search-item-card"], [class*="product-card"], [class*="list-item"]',
    itemSelectorFallbacks: [
      '[class*="SearchProduct"], [class*="_1OUGS"]',
      '[data-product-id]',
      'div[class*="card"]',
    ],
    rateLimit: 2000, // 2s delay
    currency: 'USD',
    currencySymbol: '$',
    fields: [
      {
        name: 'productId',
        selector: '[data-product-id], [data-item-id]',
        type: 'attr',
        attrName: 'data-product-id',
        fallbackSelectors: ['a[href*="/item/"]'],
      },
      {
        name: 'title',
        selector: '[class*="title"], [class*="name"], h1, h3',
        type: 'text',
        fallbackSelectors: ['a[title]', '[class*="desc"]'],
      },
      {
        name: 'price',
        selector: '[class*="price"]:not([class*="del"]):not([class*="origin"]), [class*="sale-price"]',
        type: 'text',
        parser: 'price',
        fallbackSelectors: ['[class*="current-price"]'],
      },
      {
        name: 'originalPrice',
        selector: '[class*="origin-price"], [class*="del-price"], [class*="retail"]',
        type: 'text',
        parser: 'price',
      },
      {
        name: 'discount',
        selector: '[class*="discount"], [class*="off"]',
        type: 'text',
        parser: 'percent',
      },
      {
        name: 'sales',
        selector: '[class*="sold"], [class*="orders"]',
        type: 'text',
      },
      {
        name: 'rating',
        selector: '[class*="evaluation"], [class*="star"], [class*="rating"]',
        type: 'text',
        parser: 'rating',
      },
      {
        name: 'shipping',
        selector: '[class*="shipping"], [class*="delivery"]',
        type: 'text',
      },
      {
        name: 'image',
        selector: 'img[src*="alicdn"], img[src*="ae01"]',
        type: 'src',
        fallbackSelectors: ['img'],
      },
      {
        name: 'url',
        selector: 'a[href*="/item/"], a[href*="aliexpress.com/item"]',
        type: 'href',
        fallbackSelectors: ['a'],
      },
    ],
  },

  shopee: {
    name: 'Shopee',
    id: 'shopee',
    domains: [
      'shopee.com',
      'shopee.sg',
      'shopee.vn',
      'shopee.co.th',
      'shopee.ph',
      'shopee.co.id',
      'shopee.com.my',
      'shopee.tw',
      'shopee.com.br',
    ],
    itemSelector: '[data-sqe="item"], [class*="shopee-search-item"], [class*="product-item"]',
    itemSelectorFallbacks: [
      '[class*="col-xs-2-4"]',
      'div[data-item-id]',
      '[class*="search-item"]',
    ],
    rateLimit: 2000,
    currency: 'SGD', // Varies by region
    currencySymbol: '$',
    regionalDomains: {
      'shopee.sg': 'SGD',
      'shopee.vn': 'VND',
      'shopee.co.th': 'THB',
      'shopee.ph': 'PHP',
      'shopee.co.id': 'IDR',
      'shopee.com.my': 'MYR',
      'shopee.tw': 'TWD',
      'shopee.com.br': 'BRL',
    },
    fields: [
      {
        name: 'productId',
        selector: '[data-item-id], [data-sqe="item"]',
        type: 'attr',
        attrName: 'data-item-id',
      },
      {
        name: 'title',
        selector: '[data-sqe="name"], [class*="product-name"], [class*="ie3A"]',
        type: 'text',
        fallbackSelectors: ['[class*="title"]', 'div[class*="name"]'],
      },
      {
        name: 'price',
        selector: '[class*="price"]:not([class*="original"]), [class*="ooOxS"]',
        type: 'text',
        parser: 'price',
        fallbackSelectors: ['span[class*="current"]'],
      },
      {
        name: 'originalPrice',
        selector: '[class*="original"], [class*="ZEgDH"]',
        type: 'text',
        parser: 'price',
      },
      {
        name: 'discount',
        selector: '[class*="discount"], [class*="percent"], [data-sqe="discount"]',
        type: 'text',
        parser: 'percent',
      },
      {
        name: 'sales',
        selector: '[class*="sold"], [data-sqe="sold"]',
        type: 'text',
      },
      {
        name: 'rating',
        selector: '[class*="rating"], [class*="star"]',
        type: 'text',
        parser: 'rating',
      },
      {
        name: 'location',
        selector: '[class*="location"], [data-sqe="location"]',
        type: 'text',
      },
      {
        name: 'image',
        selector: 'img[src*="shopee"], img[class*="product-image"]',
        type: 'src',
        fallbackSelectors: ['img'],
      },
      {
        name: 'url',
        selector: 'a[href*="/product/"], a[data-sqe="link"]',
        type: 'href',
        fallbackSelectors: ['a'],
      },
    ],
  },

  lazada: {
    name: 'Lazada',
    id: 'lazada',
    domains: [
      'lazada.com',
      'lazada.sg',
      'lazada.vn',
      'lazada.co.th',
      'lazada.com.ph',
      'lazada.co.id',
      'lazada.com.my',
    ],
    itemSelector: '[data-qa-locator="product-item"], [class*="product-card"], [class*="Bm3ON"]',
    itemSelectorFallbacks: [
      '[data-tracking="product-card"]',
      '[class*="qmXQo"]',
      'div[data-item-id]',
    ],
    rateLimit: 2000,
    currency: 'SGD',
    currencySymbol: '$',
    regionalDomains: {
      'lazada.sg': 'SGD',
      'lazada.vn': 'VND',
      'lazada.co.th': 'THB',
      'lazada.com.ph': 'PHP',
      'lazada.co.id': 'IDR',
      'lazada.com.my': 'MYR',
    },
    fields: [
      {
        name: 'productId',
        selector: '[data-item-id], [data-sku-id]',
        type: 'attr',
        attrName: 'data-item-id',
      },
      {
        name: 'title',
        selector: '[data-qa-locator="product-title"], [class*="title"], [class*="RfADt"]',
        type: 'text',
        fallbackSelectors: ['a[title]', '[class*="name"]'],
      },
      {
        name: 'price',
        selector: '[data-qa-locator="product-price"], [class*="ooOxS"], [class*="price"]:not([class*="del"])',
        type: 'text',
        parser: 'price',
      },
      {
        name: 'originalPrice',
        selector: '[class*="WNoq3"], [class*="original"], [class*="del-price"]',
        type: 'text',
        parser: 'price',
      },
      {
        name: 'discount',
        selector: '[data-qa-locator="product-discount"], [class*="discount"], [class*="IcOsH"]',
        type: 'text',
        parser: 'percent',
      },
      {
        name: 'sales',
        selector: '[class*="sold"], [data-qa-locator="product-sold"]',
        type: 'text',
      },
      {
        name: 'rating',
        selector: '[data-qa-locator="product-rating"], [class*="rating"], [class*="oa6ri"]',
        type: 'text',
        parser: 'rating',
      },
      {
        name: 'location',
        selector: '[class*="location"], [data-qa-locator="product-location"]',
        type: 'text',
      },
      {
        name: 'shipping',
        selector: '[class*="shipping"], [class*="delivery"]',
        type: 'text',
      },
      {
        name: 'image',
        selector: 'img[src*="lazcdn"], img[class*="product-image"]',
        type: 'src',
        fallbackSelectors: ['img'],
      },
      {
        name: 'url',
        selector: 'a[href*="/products/"], a[data-qa-locator="product-link"]',
        type: 'href',
        fallbackSelectors: ['a'],
      },
    ],
  },

  tiktokshop: {
    name: 'TikTok Shop',
    id: 'tiktokshop',
    domains: [
      'tiktok.com/shop',
      'shop.tiktok.com',
      'seller.tiktok.com',
    ],
    itemSelector: '[data-e2e="product-card"], [class*="ProductCard"], [class*="product-item"]',
    itemSelectorFallbacks: [
      '[class*="DivProductCard"]',
      '[class*="goods-card"]',
      'div[data-product-id]',
    ],
    rateLimit: 3000, // 3s delay - TikTok has strict anti-bot
    currency: 'USD',
    currencySymbol: '$',
    fields: [
      {
        name: 'productId',
        selector: '[data-product-id], [data-e2e="product-id"]',
        type: 'attr',
        attrName: 'data-product-id',
      },
      {
        name: 'title',
        selector: '[data-e2e="product-title"], [class*="title"], [class*="DivProductTitle"]',
        type: 'text',
        fallbackSelectors: ['[class*="name"]', 'h3'],
      },
      {
        name: 'price',
        selector: '[data-e2e="product-price"], [class*="price"]:not([class*="original"])',
        type: 'text',
        parser: 'price',
      },
      {
        name: 'originalPrice',
        selector: '[data-e2e="original-price"], [class*="original"], [class*="line-through"]',
        type: 'text',
        parser: 'price',
      },
      {
        name: 'discount',
        selector: '[data-e2e="discount"], [class*="discount"], [class*="save"]',
        type: 'text',
        parser: 'percent',
      },
      {
        name: 'sales',
        selector: '[data-e2e="sold-count"], [class*="sold"]',
        type: 'text',
      },
      {
        name: 'rating',
        selector: '[data-e2e="product-rating"], [class*="rating"]',
        type: 'text',
        parser: 'rating',
      },
      {
        name: 'seller',
        selector: '[data-e2e="seller-name"], [class*="seller"]',
        type: 'text',
      },
      {
        name: 'image',
        selector: 'img[src*="tiktokcdn"], img[data-e2e="product-image"]',
        type: 'src',
        fallbackSelectors: ['img'],
      },
      {
        name: 'url',
        selector: 'a[href*="/product/"], a[data-e2e="product-link"]',
        type: 'href',
        fallbackSelectors: ['a'],
      },
    ],
  },
};

/**
 * Get platform config by ID
 */
export function getPlatformConfig(platformId: PlatformId): PlatformConfig {
  return platformConfigs[platformId];
}

/**
 * Get all platform IDs
 */
export function getAllPlatformIds(): PlatformId[] {
  return Object.keys(platformConfigs) as PlatformId[];
}

/**
 * Get all platform configs
 */
export function getAllPlatformConfigs(): PlatformConfig[] {
  return Object.values(platformConfigs);
}
