/**
 * IDS (Ideographic Description Sequence) Parser
 * Supports Unicode IDS operators for Chinese character decomposition
 *
 * IDS is a standardized way to describe how Chinese characters are composed
 * from smaller components using structural operators.
 */

export interface IDSNode {
  /** IDC operator (e.g., ⿰, ⿱) - undefined for leaf nodes */
  op?: string;
  /** Child nodes if op is present */
  children?: IDSNode[];
  /** Character value for leaf nodes */
  value?: string;
}

/** Binary operators (2 children) */
const BINARY_OPS = new Set(['⿰', '⿱', '⿴', '⿵', '⿶', '⿷', '⿸', '⿹', '⿺', '⿻']);

/** Ternary operators (3 children) */
const TERNARY_OPS = new Set(['⿲', '⿳']);

/**
 * Parse an IDS string into a tree structure
 * @param ids - The IDS string to parse (e.g., "⿰亻本" for 体)
 * @returns Parsed IDS tree or null if parsing fails
 */
export function parseIDS(ids: string): IDSNode | null {
  if (!ids || ids.length === 0) return null;

  try {
    const result = parseIDSInternal(ids, 0);
    return result.node;
  } catch (e) {
    console.error('[IDS Parser] Parse error:', e);
    return null;
  }
}

function parseIDSInternal(ids: string, pos: number): { node: IDSNode; nextPos: number } {
  if (pos >= ids.length) {
    throw new Error('Unexpected end of IDS string');
  }

  const char = ids[pos];

  if (BINARY_OPS.has(char)) {
    // Binary operator - parse 2 children
    const child1 = parseIDSInternal(ids, pos + 1);
    const child2 = parseIDSInternal(ids, child1.nextPos);
    return {
      node: { op: char, children: [child1.node, child2.node] },
      nextPos: child2.nextPos,
    };
  }

  if (TERNARY_OPS.has(char)) {
    // Ternary operator - parse 3 children
    const child1 = parseIDSInternal(ids, pos + 1);
    const child2 = parseIDSInternal(ids, child1.nextPos);
    const child3 = parseIDSInternal(ids, child2.nextPos);
    return {
      node: { op: char, children: [child1.node, child2.node, child3.node] },
      nextPos: child3.nextPos,
    };
  }

  // Leaf node (regular character)
  return {
    node: { value: char },
    nextPos: pos + 1,
  };
}

/**
 * Extract all leaf components from an IDS tree
 * @param node - The IDS tree node to extract from
 * @returns Array of component characters
 */
export function extractComponents(node: IDSNode | null): string[] {
  if (!node) return [];

  if (node.value) {
    return [node.value];
  }

  if (node.children) {
    return node.children.flatMap(extractComponents);
  }

  return [];
}

/**
 * Get operator description for UI (supports Vietnamese and English)
 * @param op - The IDS operator character
 * @param lang - Language code ('vi' or 'en')
 * @returns Human-readable description of the operator
 */
export function getOperatorDescription(op: string, lang: 'vi' | 'en' = 'en'): string {
  const descriptions: Record<string, { vi: string; en: string }> = {
    '⿰': { vi: 'Trái-Phải', en: 'Left-Right' },
    '⿱': { vi: 'Trên-Dưới', en: 'Top-Bottom' },
    '⿲': { vi: 'Trái-Giữa-Phải', en: 'Left-Middle-Right' },
    '⿳': { vi: 'Trên-Giữa-Dưới', en: 'Top-Middle-Bottom' },
    '⿴': { vi: 'Bao quanh', en: 'Surround' },
    '⿵': { vi: 'Bao từ trên', en: 'Surround from above' },
    '⿶': { vi: 'Bao từ dưới', en: 'Surround from below' },
    '⿷': { vi: 'Bao từ trái', en: 'Surround from left' },
    '⿸': { vi: 'Bao từ trên-trái', en: 'Surround from upper-left' },
    '⿹': { vi: 'Bao từ trên-phải', en: 'Surround from upper-right' },
    '⿺': { vi: 'Bao từ dưới-trái', en: 'Surround from lower-left' },
    '⿻': { vi: 'Chồng lên', en: 'Overlaid' },
  };
  const desc = descriptions[op];
  return desc ? desc[lang] : lang === 'vi' ? 'Không rõ' : 'Unknown';
}

/**
 * Check if a character is an IDS operator
 * @param char - The character to check
 * @returns True if the character is an IDS operator
 */
export function isIDSOperator(char: string): boolean {
  return BINARY_OPS.has(char) || TERNARY_OPS.has(char);
}

/**
 * Get the arity (number of children) for an operator
 * @param op - The IDS operator character
 * @returns Number of children the operator expects (2 or 3), or 0 if not an operator
 */
export function getOperatorArity(op: string): number {
  if (BINARY_OPS.has(op)) return 2;
  if (TERNARY_OPS.has(op)) return 3;
  return 0;
}

/**
 * Get all IDS operators
 * @returns Array of all supported IDS operator characters
 */
export function getAllOperators(): string[] {
  return Array.from(BINARY_OPS).concat(Array.from(TERNARY_OPS));
}

/**
 * Validate an IDS string
 * @param ids - The IDS string to validate
 * @returns True if the IDS string is valid
 */
export function isValidIDS(ids: string): boolean {
  if (!ids || ids.length === 0) return false;
  try {
    const result = parseIDSInternal(ids, 0);
    // Valid if we consumed the entire string
    return result.nextPos === ids.length;
  } catch {
    return false;
  }
}
