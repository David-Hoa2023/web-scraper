/**
 * Data loader for IDS (Ideographic Description Sequence) module
 * Loads IDS map and component metadata with caching support
 * Adapted for Chrome extension environment using fetch API
 */

export interface ComponentMeta {
  /** English meaning of the component */
  meaning: string;
  /** Vietnamese meaning (if available) */
  meaningVi?: string;
  /** Pinyin pronunciation */
  pinyin: string;
}

/**
 * Vietnamese translations for common radicals/components
 * Contains 130+ entries covering the most frequent Chinese radicals
 */
export const vietnameseMeanings: Record<string, string> = {
  // People and body parts
  '女': 'nữ, phụ nữ',
  '子': 'con, đứa trẻ',
  '人': 'người',
  '亻': 'người (bộ)',
  '口': 'miệng',
  '心': 'tim, tâm',
  '忄': 'tim (bộ)',
  '手': 'tay',
  '扌': 'tay (bộ)',
  '目': 'mắt',
  '耳': 'tai',
  '足': 'chân',
  '身': 'thân',
  '首': 'đầu',
  '面': 'mặt',
  '牙': 'răng',
  '齒': 'răng',
  '齿': 'răng',
  '舌': 'lưỡi',
  '骨': 'xương',
  '肉': 'thịt',
  '月': 'mặt trăng, tháng (hoặc thịt)',

  // Nature elements
  '日': 'mặt trời, ngày',
  '木': 'cây, gỗ',
  '水': 'nước',
  '氵': 'nước (bộ)',
  '火': 'lửa',
  '灬': 'lửa (bộ)',
  '土': 'đất',
  '金': 'vàng, kim loại',
  '钅': 'kim loại (bộ)',
  '山': 'núi',
  '石': 'đá',
  '田': 'ruộng',
  '雨': 'mưa',
  '風': 'gió',
  '风': 'gió',
  '雲': 'mây',
  '云': 'mây',
  '電': 'điện',
  '电': 'điện',
  '雪': 'tuyết',
  '霜': 'sương giá',
  '冰': 'băng',
  '川': 'sông',
  '海': 'biển',

  // Plants
  '禾': 'lúa',
  '米': 'gạo',
  '竹': 'tre',
  '草': 'cỏ',
  '艹': 'cỏ (bộ)',
  '花': 'hoa',
  '果': 'quả',
  '林': 'rừng nhỏ',
  '森': 'rừng',
  '葉': 'lá',
  '叶': 'lá',

  // Animals
  '走': 'đi, chạy',
  '馬': 'ngựa',
  '马': 'ngựa',
  '鳥': 'chim',
  '鸟': 'chim',
  '魚': 'cá',
  '鱼': 'cá',
  '虫': 'sâu bọ',
  '犬': 'chó',
  '犭': 'chó (bộ)',
  '牛': 'bò',
  '羊': 'dê, cừu',
  '豕': 'lợn',
  '龍': 'rồng',
  '龙': 'rồng',
  '龜': 'rùa',
  '龟': 'rùa',
  '鹿': 'hươu',
  '貓': 'mèo',
  '猫': 'mèo',

  // Objects and tools
  '刀': 'dao',
  '刂': 'dao (bộ)',
  '門': 'cửa',
  '门': 'cửa',
  '車': 'xe',
  '车': 'xe',
  '舟': 'thuyền',
  '食': 'thức ăn',
  '饣': 'thức ăn (bộ)',
  '衣': 'áo',
  '衤': 'áo (bộ)',
  '巾': 'khăn',
  '糸': 'tơ',
  '纟': 'tơ (bộ)',
  '弓': 'cung',
  '矢': 'tên (mũi tên)',
  '戈': 'giáo',
  '斤': 'rìu',
  '瓦': 'ngói',
  '缶': 'vò, hũ',
  '皿': 'bát đĩa',
  '鼎': 'vạc',
  '钟': 'chuông',
  '鐘': 'chuông',

  // Buildings and structures
  '宀': 'mái nhà',
  '广': 'nhà lớn',
  '厂': 'vách đá',
  '囗': 'bao quanh',
  '户': 'cửa hộ',
  '戶': 'cửa hộ',
  '穴': 'hang',

  // Abstract concepts
  '言': 'lời nói',
  '讠': 'lời nói (bộ)',
  '示': 'thần, lễ',
  '礻': 'thần (bộ)',
  '見': 'thấy',
  '见': 'thấy',
  '貝': 'vỏ sò, tiền',
  '贝': 'vỏ sò, tiền',
  '頁': 'trang, đầu',
  '页': 'trang, đầu',
  '力': 'sức mạnh',
  '又': 'lại, tay phải',
  '文': 'văn',
  '字': 'chữ',
  '書': 'sách',
  '书': 'sách',
  '語': 'ngữ',
  '语': 'ngữ',

  // Colors
  '白': 'trắng',
  '黑': 'đen',
  '赤': 'đỏ',
  '青': 'xanh',
  '黃': 'vàng',
  '黄': 'vàng',
  '紫': 'tím',
  '綠': 'xanh lá',
  '绿': 'xanh lá',

  // Numbers
  '一': 'một',
  '二': 'hai',
  '三': 'ba',
  '四': 'bốn',
  '五': 'năm',
  '六': 'sáu',
  '七': 'bảy',
  '八': 'tám',
  '九': 'chín',
  '十': 'mười',
  '百': 'trăm',
  '千': 'nghìn',
  '萬': 'vạn',
  '万': 'vạn',

  // Directions and positions
  '大': 'lớn',
  '小': 'nhỏ',
  '中': 'giữa, trung',
  '上': 'trên',
  '下': 'dưới',
  '左': 'trái',
  '右': 'phải',
  '東': 'đông',
  '东': 'đông',
  '西': 'tây',
  '南': 'nam',
  '北': 'bắc',

  // Royalty and social
  '王': 'vua',
  '玉': 'ngọc',
  '帝': 'đế',
  '臣': 'thần, bề tôi',
  '民': 'dân',
  '官': 'quan',

  // Actions and states
  '立': 'đứng',
  '生': 'sinh, sống',
  '學': 'học',
  '学': 'học',
  '相': 'lẫn nhau, tướng',
  '吾': 'ta, tôi',
  '好': 'tốt',
  '明': 'sáng',
  '休': 'nghỉ ngơi',
  '想': 'nghĩ',
  '愛': 'yêu',
  '爱': 'yêu',
  '知': 'biết',
  '能': 'có thể',
  '行': 'đi, hành',
  '止': 'dừng',
  '死': 'chết',
  '老': 'già',
  '新': 'mới',
};

// Cache storage
let idsMapCache: Record<string, string> | null = null;
let componentIndexCache: Record<string, string[]> | null = null;
let componentMetaCache: Record<string, ComponentMeta> | null = null;

/**
 * Get the base URL for data files
 * In Chrome extension, this uses chrome.runtime.getURL
 */
function getDataBaseUrl(): string {
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    return chrome.runtime.getURL('data/');
  }
  // Fallback for non-extension environments
  return '/data/';
}

/**
 * Load the IDS map (character -> IDS string mapping)
 * @returns Promise resolving to the IDS map
 */
export async function loadIDSMap(): Promise<Record<string, string>> {
  if (idsMapCache) return idsMapCache;

  try {
    const url = `${getDataBaseUrl()}ids_map.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    idsMapCache = await response.json();
    return idsMapCache!;
  } catch (e) {
    console.error('[IDS DataLoader] Failed to load IDS map:', e);
    return {};
  }
}

/**
 * Load the component index (component -> characters containing it)
 * @returns Promise resolving to the component index
 */
export async function loadComponentIndex(): Promise<Record<string, string[]>> {
  if (componentIndexCache) return componentIndexCache;

  try {
    const url = `${getDataBaseUrl()}component_index.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    componentIndexCache = await response.json();
    return componentIndexCache!;
  } catch (e) {
    console.error('[IDS DataLoader] Failed to load component index:', e);
    return {};
  }
}

/**
 * Load component metadata (meanings, pinyin)
 * @returns Promise resolving to component metadata
 */
export async function loadComponentMeta(): Promise<Record<string, ComponentMeta>> {
  if (componentMetaCache) return componentMetaCache;

  try {
    const url = `${getDataBaseUrl()}component_meta.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    componentMetaCache = await response.json();
    return componentMetaCache!;
  } catch (e) {
    console.error('[IDS DataLoader] Failed to load component meta:', e);
    return {};
  }
}

/**
 * Get IDS for a character
 * @param char - The Chinese character to look up
 * @returns Promise resolving to the IDS string or null if not found
 */
export async function getIDSForCharacter(char: string): Promise<string | null> {
  const map = await loadIDSMap();
  return map[char] || null;
}

/**
 * Get characters containing a specific component
 * @param component - The component to search for
 * @returns Promise resolving to array of characters containing the component
 */
export async function getCharactersWithComponent(component: string): Promise<string[]> {
  const index = await loadComponentIndex();
  return index[component] || [];
}

/**
 * Get metadata for a component (with Vietnamese translation if available)
 * @param component - The component to look up
 * @returns Promise resolving to component metadata or null if not found
 */
export async function getComponentInfo(component: string): Promise<ComponentMeta | null> {
  const meta = await loadComponentMeta();
  const baseMeta = meta[component];

  if (!baseMeta) {
    // Return Vietnamese meaning only if available
    const viMeaning = vietnameseMeanings[component];
    if (viMeaning) {
      return {
        meaning: viMeaning,
        meaningVi: viMeaning,
        pinyin: '',
      };
    }
    return null;
  }

  // Add Vietnamese meaning if available
  return {
    ...baseMeta,
    meaningVi: vietnameseMeanings[component] || baseMeta.meaning,
  };
}

/**
 * Get Vietnamese meaning for a component directly (synchronous)
 * @param component - The component to look up
 * @returns Vietnamese meaning or undefined
 */
export function getVietnameseMeaning(component: string): string | undefined {
  return vietnameseMeanings[component];
}

/**
 * Check if a component has Vietnamese meaning
 * @param component - The component to check
 * @returns True if Vietnamese meaning exists
 */
export function hasVietnameseMeaning(component: string): boolean {
  return component in vietnameseMeanings;
}

/**
 * Preload all data (useful for initialization)
 * @returns Promise resolving to all data structures
 */
export async function preloadAllData(): Promise<{
  idsMap: Record<string, string>;
  componentIndex: Record<string, string[]>;
  componentMeta: Record<string, ComponentMeta>;
}> {
  const [idsMap, componentIndex, componentMeta] = await Promise.all([
    loadIDSMap(),
    loadComponentIndex(),
    loadComponentMeta(),
  ]);
  return { idsMap, componentIndex, componentMeta };
}

/**
 * Clear all caches (useful for testing or forced reload)
 */
export function clearDataCaches(): void {
  idsMapCache = null;
  componentIndexCache = null;
  componentMetaCache = null;
}

/**
 * Check if data is cached
 * @returns Object indicating which data is cached
 */
export function getCacheStatus(): { idsMap: boolean; componentIndex: boolean; componentMeta: boolean } {
  return {
    idsMap: idsMapCache !== null,
    componentIndex: componentIndexCache !== null,
    componentMeta: componentMetaCache !== null,
  };
}
