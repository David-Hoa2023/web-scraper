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

---

# Lessons Learned: Content Script Not Loading (Green Rectangles Missing)

## Issue
**Content script fails to load**: After adding the Scraping Templates feature, the pattern detection stopped working entirely. No green rectangles appear on hover, and the console shows no `[Web Scraper]` log messages - indicating the content script isn't executing at all.

## Root Cause Identified
**ES Module imports in content scripts**: Vite's build was splitting shared code into chunks (e.g., `errors.js`). The built `content.js` started with:
```javascript
import{S as N,E as _,c as K,f as Se}from"./errors.js";
```

Chrome extension content scripts **cannot use ES module imports** - they must be completely self-contained. The browser silently fails to load the script when it encounters the import statement.

## Fixes Attempted

### 1. Event Listener Cleanup (Failure)
*   **Issue**: Suspected duplicate event listeners or improper cleanup.
*   **Fix**:
    - Added `{ capture: true }` to `removeEventListener` calls (must match `addEventListener`)
    - Added `patternDetectionInitialized` flag to prevent duplicate listeners
    - Reset state in `init()` function
*   **Result**: Build succeeded, but content script still not loading. Issue was elsewhere.

### 2. CSS Style Priority (Failure)
*   **Issue**: Suspected page CSS overriding highlight styles.
*   **Fix**: Changed from `el.style.outline = ...` to `el.style.setProperty('outline', ..., 'important')`
*   **Result**: Build succeeded, but content script still not loading. Issue was elsewhere.

### 3. Vite manualChunks Configuration (Failure)
*   **Issue**: Vite creating shared chunks that content scripts can't import.
*   **Fix**: Added `manualChunks(id) { return undefined; }` to rollupOptions.output
*   **Result**: Vite still created `errors.js` chunk. `manualChunks` returning undefined doesn't prevent default chunking.

### 4. Post-Build Script Inlining (Partial Success)
*   **Issue**: Need to inline imported chunks into content.js
*   **Fix**: Enhanced `scripts/post-build.js` to:
    - Detect `import{...}from"./filename.js"` statements
    - Read the chunk file content
    - Rename exported variables to match import aliases
    - Prepend chunk content to content.js
    - Remove import statements
    - Delete the inlined chunk file
*   **Result**:
    - Build log shows: `inlined 1 chunks (errors.js)`
    - content.js now starts with `class R extends Error{...}` instead of import
    - **Still not working** - cause unknown

## Successes
*   Identified the ES module import issue via build output inspection
*   Post-build script successfully inlines chunk imports
*   content.js is now self-contained (verified: no import statements at start)

## Failure Analysis
Why does it still not work after inlining?
1.  **Variable name collision**: The post-build renaming (`S` -> `N`, etc.) may not be complete. Minified variable names could collide or be incorrectly replaced.
2.  **Order of inlined code**: Prepending chunk code may cause issues if it references variables defined later.
3.  **Other syntax issues**: There may be other ES module artifacts (dynamic imports, top-level await) that aren't being handled.
4.  **Chrome caching**: The extension may be loading a cached version despite reload.
5.  **Manifest issue**: The content_scripts configuration may have issues not visible in the manifest file.

## Lessons
1.  **Chrome extension content scripts are NOT ES modules**: They cannot use `import`/`export` syntax. This is a fundamental constraint.
2.  **Vite code splitting is incompatible with content scripts**: Need to either:
    - Use a separate build for content scripts with `inlineDynamicImports: true`
    - Use a bundler plugin that forces all code into a single file
    - Build content scripts separately from the rest of the extension
3.  **Silent failures are hard to debug**: Content scripts that fail to parse don't show errors - they simply don't run.
4.  **Post-build transforms are fragile**: Trying to fix module issues after build is error-prone. Better to configure the build correctly upfront.

## Final Fix (Success)

### Solution: Build content script separately with esbuild as IIFE

The fix was to use esbuild to build the content script as a **single self-contained IIFE bundle**, completely separate from Vite's build.

**Files created/modified:**

1. **`scripts/build-content.mjs`** (new):
```javascript
import { build } from "esbuild";

await build({
  entryPoints: ["src/content/index.ts"],
  outfile: "dist/content.js",
  bundle: true,
  format: "iife",  // Classic script; no imports/exports
  platform: "browser",
  target: ["chrome114"],
  sourcemap: true,
  minify: true,
});
```

2. **`package.json`** - Updated build script:
```json
"build": "tsc && vite build && node scripts/build-content.mjs && node scripts/post-build.js"
```
Added `esbuild` as dev dependency.

3. **`vite.config.ts`** - Removed content script from Vite inputs:
```typescript
input: {
  sidepanel: resolve(__dirname, 'src/ui/sidepanel.html'),
  // content script is built separately by esbuild
  'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
},
```

4. **`scripts/post-build.js`** - Simplified to just copy manifest and icons (removed fragile chunk inliner).

**Result:**
- content.js now starts with `"use strict";(()=>{...` (IIFE wrapper)
- Zero import statements
- Content script loads and executes correctly
- Green rectangles appear on hover

## Key Lessons

1. **Chrome content scripts are classic scripts, not ES modules**: They cannot use `import`/`export` syntax. The browser silently fails to load scripts with module syntax.

2. **Vite code splitting is incompatible with content scripts**: Vite/Rollup will create shared chunks by default, which breaks content scripts.

3. **Use esbuild with `format: "iife"` for content scripts**: This guarantees a single bundled file with no module syntax.

4. **Build content scripts separately**: Don't try to make Vite produce content scripts alongside the rest of the extension. Use a dedicated build step.

5. **Post-build transforms are fragile**: Trying to fix module issues after the build (inlining chunks, renaming variables) is error-prone. Configure the build correctly from the start.

6. **Silent failures are the worst**: Content scripts that fail to parse don't show errors in the console - they simply don't run. Always verify the script is loading with a boot log.

---

# Lessons Learned: Template Apply Not Working (containerSelector Empty)

## Issue
**Apply Template does nothing**: After saving a template and clicking "Apply", the content script receives the message but `containerSelector` is empty (`""`), so no elements are found or highlighted.

## Console Evidence
```
[Content] Received: APPLY_TEMPLATE {containerSelector: '', extractionConfig: {...}, patternConfig: {...}}
```

The `containerSelector: ""` shows the template was saved without capturing the actual CSS selector.

## Root Cause Analysis

### Template Save Flow
When saving a template, the code uses `currentContainerSelector` variable:
```typescript
const template: ScrapingTemplate = {
  containerSelector: currentContainerSelector,
  // ...
};
```

### The Bug
`currentContainerSelector` is **never set** when a pattern is detected via mouse hover. The pattern detection flow:
1. User hovers over element → `detectPattern()` finds siblings
2. Pattern is stored in `currentPattern` (PatternMatch object with `container`, `fingerprint`, `siblings`)
3. User clicks "Save Template"
4. Template is saved with `containerSelector: currentContainerSelector` (which is still `""`)

**Missing step**: There's no code that converts the detected `currentPattern` into a CSS selector string and stores it in `currentContainerSelector`.

## Why Apply Template Was "Fixed" But Still Broken
The apply template logic was correct:
1. Sidepanel sends `APPLY_TEMPLATE` with `containerSelector` to content script ✓
2. Content script uses `document.querySelectorAll(selector)` to find elements ✓
3. Content script creates pattern and highlights ✓

But since `containerSelector` was never populated during save, it's always empty.

## Required Fix (Not Implemented)

### Option A: Generate CSS Selector on Save
When saving a template, generate a CSS selector from the current pattern:
```typescript
function generateSelector(element: Element): string {
  // Generate unique selector: tag + id + classes + nth-child
  // e.g., "div.product-card" or "[data-testid='product-item']"
}

// In saveCurrentTemplate():
if (currentPattern?.siblings[0]) {
  currentContainerSelector = generateSelector(currentPattern.siblings[0]);
}
```

### Option B: Store Pattern Fingerprint Instead
Instead of CSS selector, store the fingerprint and use similarity matching on apply:
```typescript
interface ScrapingTemplate {
  // Instead of containerSelector: string
  patternFingerprint: Fingerprint;
}
```

### Option C: Prompt User for Selector
Ask user to provide/confirm the CSS selector when saving template.

## Lessons

1. **Trace the full data flow**: The save→apply cycle involves multiple variables (`currentPattern`, `currentContainerSelector`, template storage). A bug in any step breaks the whole flow.

2. **Empty strings are silent failures**: `containerSelector: ""` doesn't throw an error - it just finds zero elements. Always validate critical data before saving.

3. **Test the round-trip**: Save a template, close the page, reopen, apply template. This reveals whether data persists correctly.

4. **Console logging is essential**: The `[Content] Received: APPLY_TEMPLATE {containerSelector: ''}` log immediately showed the problem.

## Final Fix (Success)

### Solution: Generate CSS selectors when pattern is locked

**New file created:** `src/content/selectorGenerator.ts`

This utility generates stable CSS selectors from a detected pattern:
- `uniqueSelector(el)` - Creates a unique selector for the container element
- `deriveItemSelector(items)` - Creates a selector matching all repeated items
- `buildSelectorsFromPattern(p)` - Returns `{ listContainerSelector, itemSelector, fullItemSelector }`

**Key algorithms:**
```typescript
// Derive item selector from common classes across siblings
function deriveItemSelector(items: Element[]): string {
  // Find intersection of classes across all items
  let common = new Set(Array.from(first.classList));
  for (const el of items.slice(1)) {
    common = new Set([...common].filter(c => el.classList.contains(c)));
  }
  // Filter to stable classes (not state classes like 'active', 'hover')
  const stable = Array.from(common).filter(isStableClass).slice(0, 3);
  if (stable.length) return `${tag}.${stable.join('.')}`;
  // Fallback to data attributes or tag only
}

// Generate unique container selector
function uniqueSelector(el: Element): string {
  // 1. Try unique ID
  // 2. Try stable data attributes (data-testid, data-qa, etc.)
  // 3. Build path with nth-of-type until unique
}
```

**Integration changes:**

1. **Content script** (`content/index.ts`):
   - When pattern is **locked**: generates selectors, sends `PATTERN_SELECTORS_UPDATED` to sidepanel
   - When pattern is **unlocked**: clears selectors
   - Added `GET_PATTERN_SELECTORS` message handler

2. **Sidepanel** (`sidepanel.ts`):
   - Listens for `PATTERN_SELECTORS_UPDATED` to receive selectors
   - `saveCurrentAsTemplate()` now requests selectors if not set
   - **Blocks saving if no pattern selected** (shows alert)

**Console output when working:**
```
[Web Scraper] Pattern locked!
[Web Scraper] Generated selectors: {
  listContainerSelector: "div.product-grid",
  itemSelector: "div.product-card",
  fullItemSelector: "div.product-grid > div.product-card"
}
[Sidepanel] Pattern selectors updated: div.product-grid > div.product-card
```

## Status
**Fixed**. Templates now save with valid CSS selectors and Apply Template works correctly.

## Key Lessons

1. **Generate selectors at lock time, not save time**: The pattern detection already has access to the DOM elements. Generate and cache selectors immediately when the user locks a pattern.

2. **Use stable class intersection**: Dynamic/state classes (`hover`, `active`, `css-xxx`) vary per element. Only use classes that appear on ALL siblings.

3. **Fallback strategy matters**: `id` → `data-testid` → `stable classes` → `nth-of-type path` → `tag only`

4. **Block invalid saves**: Don't save templates with empty selectors. Show clear error message.

5. **Message-based state sync**: Content script generates selectors, sidepanel stores them. Use Chrome messaging to keep them in sync.

---

# Lessons Learned: Progress Bar & Export Issues

**Date:** 2026-01-30
**Status:** UNRESOLVED

## Issue 1: Progress Bar Not Updating in Extraction Tab

### Symptoms
- Added "Progress" section to Extraction tab with progress bar and item count
- Progress bar always shows "0" and never updates during scraping
- Console shows `[Content] Received: GET_STATUS undefined` (messages flowing TO content script)
- No `[Sidepanel] UPDATE_PROGRESS received:` logs appear in sidepanel console
- Data IS being collected (21 items confirmed via export log)

### Architecture

```
Content Script                    Service Worker                 Sidepanel
     |                                  |                            |
     |-- UPDATE_PROGRESS ------------->|                            |
     |                                  |-- forward message ------->|
     |                                  |                            |
     |                                  |                      [NOT RECEIVING]
```

### Code Locations
- Content script sends: `src/content/index.ts:306-312`
- Service worker forwards: `src/background/service-worker.ts:913-920`
- Sidepanel listens: `src/ui/sidepanel.ts:2371-2391`

### Service Worker Forwarding Code
```typescript
if (sender.tab && ['UPDATE_STATUS', 'UPDATE_PROGRESS', 'UPDATE_PREVIEW', 'SHOW_ERROR'].includes(message.type)) {
  chrome.runtime.sendMessage(message).catch(() => {});
  sendResponse({ success: true });
  return true;
}
```

### Attempted Fixes (ALL FAILED)

| # | Fix Attempted | Result |
|---|---------------|--------|
| 1 | Made progress section always visible (removed `display: none`) | Section visible but never updates |
| 2 | Moved extraction BEFORE sending UPDATE_PROGRESS | No change - collectedData was correct |
| 3 | Added logging `[Content] Progress: X/Y items` | Never saw this log, suggesting callback not firing |
| 4 | Simplified UI to just progress bar and count | Still not updating |
| 5 | Added `console.log` in UPDATE_PROGRESS handler | Never triggered |

### Root Cause (Suspected)

The issue is **NOT** in the UI code. The messages never reach the sidepanel.

**Possible causes:**
1. `chrome.runtime.sendMessage()` in service worker doesn't reach sidepanel context
2. Sidepanel may need `chrome.runtime.connect()` for persistent port connection
3. The sidepanel's `onMessage` listener may not be registered in time
4. Messages from service worker to extension pages may need different API

### Evidence
- `[Content] Received: GET_STATUS` works (sidepanel → content via service worker) ✓
- `[Content] Exporting data: 21 items` works (data returns from content) ✓
- `UPDATE_PROGRESS` never logged in sidepanel (content → sidepanel) ✗

This proves **one-way communication works, return path is broken**.

---

## Issue 2: Export Not Downloading File

### Symptoms
- Click "Export" button in Extraction tab
- Console shows: `[Content] Exporting data: 21 items`
- No file download occurs
- No error messages

### Code Flow
```
Sidepanel: exportBtn.click()
    ↓
sendToContentScript({ type: 'EXPORT_DATA' })
    ↓
Content: returns { success: true, data: collectedData }
    ↓
Sidepanel: [should receive response and trigger download]
    ↓
[FAILS SILENTLY]
```

### Suspected Issues
1. `sendToContentScript` may not properly await or return the response
2. The download logic may have an exception that's being swallowed
3. Response from content script may not include the data

---

## Files Modified (To Be Reverted or Completed)

| File | Changes Made |
|------|--------------|
| `src/ui/sidepanel.html:505-514` | Added progress bar section |
| `src/ui/sidepanel.ts:248-250` | Added UI element refs |
| `src/ui/sidepanel.ts:2355-2391` | Added message handlers |
| `src/ui/styles.css:1124-1135` | Added indeterminate animation |
| `src/content/index.ts:280-318` | Reordered extraction, added logging |

---

## Key Lessons

### 1. Verify Infrastructure Before Building Features
Built entire progress bar UI assuming message flow worked. Should have:
1. Added `console.log` to verify UPDATE_PROGRESS reaches sidepanel
2. Then built the UI
3. Not assumed 60+ lines of UI code would "just work"

### 2. Chrome Extension Messaging is NOT Symmetric
- `content → service worker`: Works via `chrome.runtime.sendMessage()`
- `sidepanel → content`: Works via `chrome.tabs.sendMessage()`
- `service worker → sidepanel`: **May NOT work** via `chrome.runtime.sendMessage()`

The sidepanel is a special context. Broadcasting from service worker may not reach it.

### 3. Silent `.catch(() => {})` Hides Problems
```typescript
chrome.runtime.sendMessage(message).catch(() => {
  // No receivers - that's fine, sidepanel might be closed
});
```
This catches and ignores ALL errors, including real problems.

### 4. Test Incrementally
Don't write 100 lines of code then test. Test after every 10-20 lines:
1. Add `console.log('HERE')`
2. Build & reload
3. Verify it prints
4. Continue

---

## Recommended Fix (Not Implemented)

### Option A: Use Persistent Port Connection
```typescript
// In sidepanel init:
const port = chrome.runtime.connect({ name: 'sidepanel' });
port.onMessage.addListener((msg) => {
  if (msg.type === 'UPDATE_PROGRESS') { ... }
});

// In service worker:
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    sidepanelPort = port;
  }
});
// Then use sidepanelPort.postMessage() to send
```

### Option B: Direct Tab Query
```typescript
// In service worker, instead of broadcast:
const views = await chrome.runtime.getViews({ type: 'popup' });
// Or query for sidepanel window and send directly
```

### Option C: Use Storage as Message Bus
```typescript
// Content writes:
chrome.storage.local.set({ lastProgress: { current, max } });

// Sidepanel listens:
chrome.storage.onChanged.addListener((changes) => {
  if (changes.lastProgress) updateProgressUI(changes.lastProgress.newValue);
});
```

---

## Conclusion

**Time spent:** ~1 hour
**Lines of code added:** ~80
**Result:** UI exists but non-functional

The fundamental issue is **Chrome extension message routing**, not the UI code. The progress bar UI is correct but receives no data because `UPDATE_PROGRESS` messages from the service worker never reach the sidepanel listener.

Future work must:
1. Fix message infrastructure first (verify with simple test)
2. Then build UI on working foundation
3. Never assume message delivery works

---

## Fix Applied (2026-01-30)

### Solution: Long-lived Port Connection

The fix uses `chrome.runtime.connect()` for reliable push updates instead of broadcast `sendMessage()`.

### Changes Made

**1. Service Worker (`service-worker.ts`)**

Added port tracking at top level:
```typescript
const sidepanelPorts = new Set<chrome.runtime.Port>();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'sidepanel') return;
  console.log('[SW] Sidepanel port connected');
  sidepanelPorts.add(port);
  port.onDisconnect.addListener(() => sidepanelPorts.delete(port));
});
```

Replaced broadcast with port.postMessage:
```typescript
if (sender.tab && PUSH_TYPES.has(message.type)) {
  const forwarded = { ...message, tabId: sender.tab.id };
  for (const port of sidepanelPorts) {
    port.postMessage(forwarded);
  }
}
```

**2. Sidepanel (`sidepanel.ts`)**

Added port connection on init:
```typescript
function connectToServiceWorker() {
  const port = chrome.runtime.connect({ name: 'sidepanel' });
  port.onMessage.addListener((msg) => {
    if (msg.type === 'UPDATE_PROGRESS') handleProgressUpdate(msg);
    // ... other handlers
  });
  port.onDisconnect.addListener(() => setTimeout(connectToServiceWorker, 250));
}
```

**3. Content Script (`content/index.ts`)**

Added proper error logging instead of silent catch:
```typescript
chrome.runtime.sendMessage({ type: 'UPDATE_PROGRESS', payload })
  .catch((err) => console.debug('[Content] UPDATE_PROGRESS failed:', err));
```

### Verification Checklist

1. **Page console** should show: `[Content] Sending UPDATE_PROGRESS: X/Y items`
2. **Service worker console** should show: `[SW] Sidepanel port connected` and `[SW] Forwarding UPDATE_PROGRESS from tab X to 1 sidepanel(s)`
3. **Sidepanel console** should show: `[Sidepanel] Port message received: UPDATE_PROGRESS`

### Why This Works

1. **Port connection is explicit** - sidepanel registers with service worker
2. **Messages are pushed directly** - no broadcast that might be ignored
3. **tabId is preserved** - forwarded messages include original tab ID
4. **Auto-reconnect on disconnect** - handles service worker restarts

### Status
**PENDING VERIFICATION** - Build successful, needs testing

---

## Export Fix Applied (2026-01-30)

### Problem
Export button shows "[Content] Exporting data: 21 items" but no file downloads.

### Root Cause
1. Silent error handling hid failures
2. No fallback when service worker export failed
3. Missing proper response validation

### Changes Made

**1. Added `downloadJsonDirect` function (`sidepanel.ts:331-363`)**

Direct download using `chrome.downloads.download` with `<a download>` fallback:
```typescript
async function downloadJsonDirect(filename: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2);

  // Try chrome.downloads API first
  try {
    const url = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    await chrome.downloads.download({ url, filename, saveAs: true });
    return;
  } catch (err) {
    console.warn('[Sidepanel] chrome.downloads.download failed:', err);
  }

  // Fallback: <a download>
  const blob = new Blob([json], { type: 'application/json' });
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
```

**2. Improved export button handler**

- Added `ui.exportBtn.disabled = true/false` to prevent double-clicks
- Wrapped entire flow in try/catch/finally
- Added validation for response and data array
- Added fallback to `downloadJsonDirect` if service worker fails

### Verification
1. Click Export button
2. Console should show: `[Sidepanel] EXPORT_DATA response: {success: true, data: [...]}`
3. Either service worker download or direct download should trigger
4. Save dialog should appear

### Status
**PENDING VERIFICATION** - Build successful, needs testing

---

# Lessons Learned: Excel Export Failing with Object.assign Error

**Date:** 2026-02-02
**Status:** FIXED

## Issue
**Excel export fails silently**: Clicking "Export Data" with Excel format selected does nothing. No file downloads, no visible error in sidepanel.

## Console Evidence (Service Worker)
```
[SW] EXPORT_EXCEL: items count: 1
[SW] EXPORT_EXCEL: generating workbook...
[SW] EXPORT_EXCEL error: TypeError: Cannot convert undefined or null to object
    at Object.assign (<anonymous>)
    at service-worker.js:57:2791
    at Array.forEach (<anonymous>)
    at x.exports.eachCell (service-worker.js:1:29929)
```

## Root Cause

In `src/export/excelExporter.ts`, the code was using `Object.assign()` on cell properties that were initially `undefined`:

```typescript
// BROKEN CODE
row.eachCell((cell) => {
  Object.assign(cell.border, DATA_CELL_STYLE.border);  // cell.border is undefined!
});
```

`Object.assign(target, source)` requires `target` to be an object. When `cell.border` is `undefined`, it throws:
> TypeError: Cannot convert undefined or null to object

Similarly, the header row styling used:
```typescript
// ALSO PROBLEMATIC
headerRow.eachCell((cell) => {
  Object.assign(cell, { style: headerStyle });  // May cause issues
});
```

## The Fix

### 1. Direct Assignment for Data Cells
```typescript
// FIXED CODE
row.eachCell((cell) => {
  // Set border directly (cell.border may be undefined initially)
  if (DATA_CELL_STYLE.border) {
    cell.border = DATA_CELL_STYLE.border;
  }
  // ... rest of formatting
});
```

### 2. Individual Property Assignment for Header Cells
```typescript
// FIXED CODE
headerRow.eachCell((cell) => {
  // Apply header style properties individually to avoid Object.assign issues
  if (headerStyle.font) cell.font = headerStyle.font;
  if (headerStyle.fill) cell.fill = headerStyle.fill as ExcelJS.Fill;
  if (headerStyle.alignment) cell.alignment = headerStyle.alignment;
  if (headerStyle.border) cell.border = headerStyle.border;
});
```

## Key Lessons

### 1. Object.assign Requires Non-Null Target
```typescript
Object.assign(undefined, { foo: 'bar' });  // TypeError!
Object.assign({}, { foo: 'bar' });          // OK: { foo: 'bar' }
```
Always verify the target exists before using `Object.assign`.

### 2. ExcelJS Cell Properties Start as Undefined
ExcelJS cells don't have default objects for `border`, `fill`, `font`, etc. They're `undefined` until explicitly set. You must assign directly:
```typescript
cell.border = { top: {...}, bottom: {...} };  // Correct
Object.assign(cell.border, {...});             // Wrong if border undefined
```

### 3. Check Service Worker Console for Errors
The error only appeared in the **service worker console** (chrome://extensions → "service worker" link), not in the sidepanel or page console. Always check all relevant consoles when debugging.

### 4. Silent Failures Need Explicit Logging
The original code caught the error but the user saw nothing. Added explicit logging:
```typescript
console.log('[SW] EXPORT_EXCEL: items count:', items?.length);
console.log('[SW] EXPORT_EXCEL: generating workbook...');
// ... on error:
console.error('[SW] EXPORT_EXCEL error:', error);
```

## Files Modified

| File | Change |
|------|--------|
| `src/export/excelExporter.ts:193-206` | Changed `Object.assign(cell.border, ...)` to direct `cell.border = ...` |
| `src/export/excelExporter.ts:176-182` | Changed `Object.assign(cell, { style })` to individual property assignments |

## Verification
1. Scrape at least 1 item
2. Select "Excel (.xlsx with Analysis)" format
3. Click "Export Data"
4. Save dialog should appear
5. Excel file should open with data and formatting
