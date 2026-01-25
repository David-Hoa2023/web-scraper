# UI Implementation Plan for Web Scraper Pro

## 1. Overview
This document outlines the plan to upgrade the Web Scraper Chrome Extension UI to a premium, modern, and highly functional interface. The goal is to match the requirements in `BLUEPRINT.md` while adhering to the "Premium Design" aesthetic (Glassmorphism, Dark Mode, Fluid Animations) and referencing the visual hierarchy implied by the `images/` directory.

## 2. Design System
We will refined the existing Design System in `styles.css` to be more "Glassmorphism" inspired.

-   **Color Palette**:
    -   **Background**: Deep Blue/Black with transparency (`rgba(22, 33, 62, 0.95)`) + Blur.
    -   **Accent**: Neon Green (`#00ff88`) for success/active states.
    -   **Secondary Accent**: Cyan (`#00d4ff`) for information/highlights.
    -   **Error**: Soft Red (`#ff4444`).
    -   **Text**: High contrast White (`#ffffff`) and Muted Grey (`#a0a0a0`).
-   **Typography**:
    -   Use `Inter` or `Roboto` for UI elements.
    -   Use `JetBrains Mono` or `Fira Code` for code/data snippets.
-   **Effects**:
    -   `backdrop-filter: blur(12px)` for the overlay and popup.
    -   Soft shadows: `0 8px 32px rgba(0, 0, 0, 0.5)`.
    -   Thin borders: `1px solid rgba(255, 255, 255, 0.1)`.

## 3. Component Architecture

### A. Extension Popup (`popup.html` & `popup.ts`)
The popup determines the strategy and settings *before* or *during* scraping. It needs to be expanded from a simple control panel to a full dashboard.

**Revised Layout:**
1.  **Header**: Branding + Global Actions (Reset, Help).
2.  **Navigation Tabs**:
    -   **Match**: Configure how patterns are detected.
    -   **Extract**: Define data fields.
    -   **Settings**: Scroll throttling, max items, auto-stops.
3.  **Active View (Dashboard)**:
    -   Big "Start/Stop" button.
    -   Live counter.
    -   Recent activity log.

**New Components to Implement:**
-   `TabGroup`: For switching between "Match", "Extract", and "Settings".
-   `ToggleSwitch`: Premium-looking checkboxes for "Match by Tag", "Match by Class", etc.
-   `FieldMapper`: A dynamic list where users can add/remove extraction fields (e.g., "Title" -> "h1", "Price" -> ".price").

### B. In-Page Overlay (`overlay.ts`)
The overlay is the "heads-up display" (HUD) for the scraping process.

**Enhancements:**
-   **Draggable Pill Mode**: When minimized, it should become a small, unobtrusive pill floating in the corner.
-   **Visual Feedback**:
    -   Pulse animation when scraping is active.
    -   "Sparkle" or highlight effect when a new batch of items is found.
-   **Real-time Preview**:
    -   The existing preview list is good, but let's make it look like a "Code Terminal" with syntax highlighting colors.
-   **Shadow DOM**: Continue using `shadow-root` for total isolation.

## 4. Feature Implementation Steps

### Phase 1: Visual Upgrade (The "Wow" Factor)
-   Update `styles.css` with the Glassmorphism variables.
-   Refactor `popup.html` container to use the new glass styles.
-   Update `overlay.ts` to inject the new glass styles into the Shadow DOM.

### Phase 2: Configuration UI (The logic from Blueprint)
-   **Pattern Matcher Settings**: Add controls to `popup.html` to toggle:
    -   `matchTag` (boolean)
    -   `matchClass` (boolean)
    -   `matchId` (boolean)
    -   `matchDataAttr` (boolean)
-   **Auto-Scroll Settings**: Input sliders for:
    -   `throttleMs` (100ms - 5000ms)
    -   `maxItems` (Input number)

### Phase 3: Data Extraction UI
-   **Field Editor**: A UI in the popup to define schema.
    -   Name (Input)
    -   Selector (Input, or "Point & Click" button later)
    -   Type (Dropdown: Text, Link, Image, Attribute)

### Phase 4: Integration
-   Ensure `popup.ts` saves these settings to `chrome.storage.local`.
-   Ensure `content/index.ts` (and `patternDetector.ts`) reads these settings before running.

## 5. File Structure Updates

```text
src/
  ui/
    components/          # Reusable UI components
      Tabs.ts
      Toggle.ts
      InputField.ts
    icons/               # SVG Icons
    styles/
      variables.css      # Colors, spacing, shadows
      glass.css          # Glassmorphism utilities
      components.css     # Tab, Button, Input styles
    popup.html
    popup.ts
    overlay.ts
```

## 6. CSS Variable Reference (Additions)

```css
:root {
  --glass-bg: rgba(22, 33, 62, 0.85);
  --glass-border: 1px solid rgba(255, 255, 255, 0.08);
  --glass-shadow: 0 12px 40px rgba(0,0,0,0.6);
  --glass-blur: blur(12px);

  --neon-green: #00ff88;
  --neon-blue: #00d4ff;
  --neon-purple: #b700ff;
}
```

## 7. Next Actions
1.  Refactor `styles.css` to implement the Glassmorphism theme.
2.  Update `popup.html` to include the Tab structure.
3.  Update `overlay.ts` to match the new visual style.
