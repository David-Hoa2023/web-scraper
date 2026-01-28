# Lessons Learned: Shopee Pattern Detection Issue

## Issue
**Single Item Capture**: The scraper fails to detect the list pattern on Shopee.vn, consistently capturing only the single hovered element (e.g., a product title or image) instead of the list of sibling products.

## Fixes Attempted

### 1. Event Propagation (Success)
*   **Issue**: Shopee blocks standard `mouseover` bubbling, so the scraper didn't see hovers at all.
*   **Fix**: Switched to `capture: true` for event listeners.
*   **Result**: Scraper can now "see" the hover, but pattern detection is poor.

### 2. MinSiblings Configuration (Success/Partial)
*   **Issue**: Default `minSiblings: 2` prevented selecting single items or small lists.
*   **Fix**: Forced `minSiblings: 0`.
*   **Result**: Allowed "Single Item" capture (which is what we have now), but didn't solve the "List" detection.

### 3. Fuzzy Class Matching (Failure)
*   **Issue**: Dynamic class names or state classes (e.g. `hover`, `active`) cause strict string matching to fail.
*   **Fix**: Implemented Jaccard Similarity (initially 0.5, then 0.3) to match elements with shared classes.
*   **Result**: Still only capturing single item. This suggests elements might share **zero** significantly named classes, or the structure is different (e.g. wrapper divs).

### 4. Deep Traversal & Best Match (Failure)
*   **Issue**: `detectPattern` might be stopping at the leaf node (title) which is unique.
*   **Fix**:
    *   Updated `detectPattern` to traverse up to `depthLimit`.
    *   Increased `depthLimit` from 3 to 5.
    *   Logic now prioritizes the match with the *most siblings*.
*   **Result**: Still single item. This implies that even 5 levels up, the "Parent" doesn't see "Siblings" that look like the "Current Element".

## Successes
*   Event capturing works reliably.
*   Selection UI (highlighting) works for single items.
*   Fuzzy matching logic is unit-tested and correct.

## Failure Analysis
Why does it still fail on Shopee?
1.  **DOM Structure**: The "Siblings" might not be true siblings.
    *   *Example*: `div.col > div.card` vs `div.row > div.col > div.card`. If we are at `div.card`, its parent is `div.col`. If `div.col` is the *only* child of a wrapper, then `div.card` has 0 siblings. The *true* pattern is `div.col` (siblings are other `div.col`s).
2.  **Class Randomization**: Shopee might use CSS Modules or atomic CSS where classes are completely unique or random (e.g. `_1x2y3z`), resulting in Jaccard Score of 0.
3.  **Strict Match Configuration**: The default config `matchBy: ['tag', 'class']` might be too strict. If classes don't match, it rejects the prompt. A "Tag Only" fallback might be needed.

## Lessons & Next Steps
1.  **Structural Matching**: We rely too much on `class`. We should implement a "Tag Structure" fallback.
    *   If Class Jaccard is 0, check check if `TAG > CHILD_TAG` structure matches.
2.  **Grandparent Checks**: If Parent has 0 siblings, we must check Grandparent patterns (e.g. "Cousins"). Currently we traverse up, but we look for *Siblings* of the ancestor.  
