/**
 * IDS (Ideographic Description Sequence) Module
 *
 * Provides functionality for parsing and working with Chinese character
 * decomposition using the IDS standard.
 *
 * @example
 * ```typescript
 * import { parseIDS, extractComponents, getOperatorDescription } from '@/services/ids';
 *
 * // Parse IDS string for character 休 (rest)
 * const tree = parseIDS('⿰亻木');
 * // Result: { op: '⿰', children: [{ value: '亻' }, { value: '木' }] }
 *
 * // Extract components
 * const components = extractComponents(tree);
 * // Result: ['亻', '木']
 *
 * // Get operator description in Vietnamese
 * const desc = getOperatorDescription('⿰', 'vi');
 * // Result: 'Trái-Phải'
 * ```
 */

// Parser exports
export {
  parseIDS,
  extractComponents,
  getOperatorDescription,
  isIDSOperator,
  getOperatorArity,
  getAllOperators,
  isValidIDS,
  type IDSNode,
} from './idsParser';

// Data loader exports
export {
  loadIDSMap,
  loadComponentIndex,
  loadComponentMeta,
  getIDSForCharacter,
  getCharactersWithComponent,
  getComponentInfo,
  getVietnameseMeaning,
  hasVietnameseMeaning,
  preloadAllData,
  clearDataCaches,
  getCacheStatus,
  vietnameseMeanings,
  type ComponentMeta,
} from './dataLoader';
