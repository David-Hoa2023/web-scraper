/**
 * UI Overlay Module for Web Scraper Chrome Extension
 * Stitch Design System - Extraction Wizard Panel
 *
 * Creates an in-page overlay with Shadow DOM isolation,
 * providing controls and real-time feedback for scraping operations.
 */

import type { ScrollerStatus, ExtractedItem } from '../types';

// Constants
const SHADOW_HOST_ID = 'web-scraper-shadow-host';

// State
let shadowRoot: ShadowRoot | null = null;
let isDragging = false;
const dragOffset = { x: 0, y: 0 };
let isMinimized = false;

/**
 * Button handler interface for connecting overlay buttons to scroller
 */
export interface ButtonHandlers {
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

let buttonHandlers: ButtonHandlers | null = null;

/**
 * Gets the overlay styles (Stitch Design System)
 */
function getStyles(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');

    :host {
      all: initial;
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

      /* Stitch Design Tokens */
      --primary: #13ec5b;
      --primary-hover: #1cfc68;
      --primary-glow: rgba(19, 236, 91, 0.3);
      --primary-10: rgba(19, 236, 91, 0.1);
      --primary-20: rgba(19, 236, 91, 0.2);
      --primary-40: rgba(19, 236, 91, 0.4);

      --background-dark: #102216;
      --sidebar-bg: #0d1b12;
      --accent-dark: #193322;
      --ui-dark: #23482f;

      --text: #f6f8f6;
      --text-muted: #92c9a4;
      --text-muted-40: rgba(146, 201, 164, 0.4);

      --danger: #ef4444;
      --warning: #f59e0b;
      --success: #22c55e;

      --border-color: rgba(19, 236, 91, 0.15);
      --border-hover: rgba(19, 236, 91, 0.5);

      --radius-sm: 0.5rem;
      --radius-md: 0.75rem;
      --radius-lg: 1rem;
      --radius-full: 9999px;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .overlay-container {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 380px;
      background: var(--background-dark);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      z-index: 2147483647;
      color: var(--text);
      font-size: 13px;
      overflow: hidden;
      user-select: none;
      transition: width 0.3s ease, border-radius 0.3s ease;
    }

    .overlay-container.minimized {
      width: 200px;
      border-radius: var(--radius-full);
    }

    .overlay-container.minimized .overlay-body {
      display: none;
    }

    .overlay-container.minimized .header-controls {
      display: none;
    }

    .overlay-container.minimized .overlay-header {
      border-bottom: none;
      padding: 10px 16px;
      justify-content: center;
    }

    /* Header */
    .overlay-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: var(--sidebar-bg);
      border-bottom: 1px solid var(--border-color);
      cursor: move;
    }

    .overlay-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
      font-size: 15px;
      color: var(--text);
    }

    .overlay-title-icon {
      width: 32px;
      height: 32px;
      background: var(--primary);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .overlay-title-icon svg {
      width: 18px;
      height: 18px;
      fill: var(--background-dark);
    }

    .header-controls {
      display: flex;
      gap: 6px;
    }

    .header-btn {
      background: var(--accent-dark);
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 6px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .header-btn:hover {
      background: var(--ui-dark);
      color: var(--text);
    }

    .header-btn svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    /* Body */
    .overlay-body {
      padding: 0;
    }

    /* Status Bar */
    .status-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: rgba(0, 0, 0, 0.2);
      border-bottom: 1px solid var(--border-color);
    }

    .status-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-muted);
    }

    .status-dot.idle { background: var(--text-muted); }
    .status-dot.running {
      background: var(--primary);
      box-shadow: 0 0 10px var(--primary-glow);
      animation: pulse 1.5s infinite;
    }
    .status-dot.paused { background: var(--warning); }
    .status-dot.error { background: var(--danger); }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.3); }
    }

    .status-text {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .live-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: var(--primary-10);
      border: 1px solid var(--primary-20);
      border-radius: var(--radius-full);
      font-size: 10px;
      font-weight: 700;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .live-badge .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--primary);
      animation: pulse 1.5s infinite;
    }

    /* Smart Detection Toggle */
    .smart-detection {
      margin: 16px 20px;
      padding: 14px 16px;
      background: var(--primary-10);
      border: 1px solid var(--primary-20);
      border-radius: var(--radius-md);
    }

    .smart-detection-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .smart-detection-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
    }

    .smart-detection-title svg {
      width: 18px;
      height: 18px;
      fill: var(--primary);
    }

    .smart-detection-desc {
      font-size: 11px;
      color: var(--text-muted);
    }

    /* Progress Section */
    .progress-section {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
    }

    .progress-label {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    .progress-count {
      color: var(--primary);
      font-weight: 700;
      font-family: 'Monaco', 'Consolas', monospace;
    }

    .progress-bar-container {
      height: 6px;
      background: var(--ui-dark);
      border-radius: var(--radius-full);
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: var(--primary);
      border-radius: var(--radius-full);
      transition: width 0.3s ease;
      width: 0%;
      box-shadow: 0 0 15px var(--primary-40);
    }

    /* Active Columns Section */
    .columns-section {
      padding: 16px 20px;
    }

    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .section-title h3 {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted-40);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .add-column-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      background: transparent;
      border: none;
      color: var(--primary);
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      transition: background 0.2s;
    }

    .add-column-btn:hover {
      background: var(--primary-10);
    }

    .add-column-btn svg {
      width: 12px;
      height: 12px;
      fill: currentColor;
    }

    .columns-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 120px;
      overflow-y: auto;
    }

    .column-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      transition: border-color 0.2s;
    }

    .column-item:hover {
      border-color: var(--border-hover);
    }

    .column-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .column-icon {
      width: 28px;
      height: 28px;
      background: var(--primary-20);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .column-icon svg {
      width: 14px;
      height: 14px;
      fill: var(--primary);
    }

    .column-name {
      font-size: 12px;
      font-weight: 700;
      color: var(--text);
    }

    .column-selector {
      font-size: 9px;
      color: var(--text-muted-40);
      margin-top: 2px;
    }

    .column-actions {
      display: flex;
      gap: 8px;
    }

    .column-actions button {
      background: transparent;
      border: none;
      color: var(--text-muted-40);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: color 0.2s;
    }

    .column-actions button:hover {
      color: var(--text);
    }

    .column-actions button.delete:hover {
      color: var(--danger);
    }

    .column-actions svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    /* Sample Output */
    .sample-section {
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);
    }

    .sample-output {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      padding: 12px;
      font-family: 'JetBrains Mono', 'Monaco', 'Consolas', monospace;
      font-size: 10px;
      color: var(--primary);
      line-height: 1.6;
      max-height: 80px;
      overflow-y: auto;
    }

    .sample-output::-webkit-scrollbar {
      width: 4px;
    }

    .sample-output::-webkit-scrollbar-thumb {
      background: var(--ui-dark);
      border-radius: 2px;
    }

    .sample-empty {
      color: var(--text-muted-40);
      font-style: italic;
    }

    /* Controls Footer */
    .controls-footer {
      padding: 16px 20px;
      background: var(--sidebar-bg);
      border-top: 1px solid var(--border-color);
    }

    .btn-row {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    }

    .btn-secondary {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 16px;
      background: transparent;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .btn-secondary svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .btn-primary {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 16px;
      background: var(--primary);
      border: none;
      border-radius: var(--radius-sm);
      color: var(--background-dark);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 0 20px var(--primary-glow);
    }

    .btn-primary:hover {
      filter: brightness(1.1);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-primary svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .btn-danger {
      background: transparent;
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: var(--danger);
    }

    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.1);
    }

    .cancel-btn {
      width: 100%;
      background: transparent;
      border: none;
      color: var(--text-muted-40);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      padding: 8px;
      transition: color 0.2s;
    }

    .cancel-btn:hover {
      color: var(--text);
    }

    /* Error Section */
    .error-section {
      margin: 0 20px 16px;
      padding: 12px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--radius-sm);
      display: none;
    }

    .error-section.has-errors {
      display: block;
    }

    .error-item {
      color: var(--danger);
      font-size: 11px;
      margin-bottom: 4px;
    }

    .error-item:last-child {
      margin-bottom: 0;
    }

    /* Scrollbar */
    .columns-list::-webkit-scrollbar {
      width: 4px;
    }

    .columns-list::-webkit-scrollbar-track {
      background: transparent;
    }

    .columns-list::-webkit-scrollbar-thumb {
      background: var(--ui-dark);
      border-radius: 2px;
    }

    .columns-list::-webkit-scrollbar-thumb:hover {
      background: var(--primary);
    }
  `;
}

/**
 * Gets the overlay HTML structure (Stitch Design)
 */
function getHTML(): string {
  return `
    <div class="overlay-container" id="overlay-container">
      <div class="overlay-header" id="drag-handle">
        <div class="overlay-title">
          <div class="overlay-title-icon">
            <svg viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <span>Extraction Wizard</span>
        </div>
        <div class="header-controls">
          <button class="header-btn" id="minimize-btn" title="Minimize">
            <svg viewBox="0 0 24 24">
              <path d="M19 13H5v-2h14v2z"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="overlay-body">
        <div class="status-bar">
          <div class="status-left">
            <div class="status-dot idle" id="status-dot"></div>
            <span class="status-text" id="status-text">Ready</span>
          </div>
          <div class="live-badge">
            <span class="dot"></span>
            LIVE SESSION
          </div>
        </div>

        <div class="smart-detection">
          <div class="smart-detection-header">
            <div class="smart-detection-title">
              <svg viewBox="0 0 24 24">
                <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z"/>
              </svg>
              Smart Pattern Detection
            </div>
          </div>
          <p class="smart-detection-desc" id="pattern-desc">Hover over elements to detect patterns.</p>
        </div>

        <div class="progress-section">
          <div class="progress-label">
            <span>Items Collected</span>
            <span class="progress-count"><span id="collected-count">0</span> / <span id="max-count">--</span></span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" id="progress-bar"></div>
          </div>
        </div>

        <div class="columns-section">
          <div class="section-title">
            <h3>Active Columns</h3>
            <button class="add-column-btn">
              <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
              New Column
            </button>
          </div>
          <div class="columns-list" id="columns-list">
            <div class="column-item">
              <div class="column-info">
                <div class="column-icon">
                  <svg viewBox="0 0 24 24"><path d="M5 4v3h5.5v12h3V7H19V4z"/></svg>
                </div>
                <div>
                  <div class="column-name">Text Content</div>
                  <div class="column-selector">Auto-detected</div>
                </div>
              </div>
              <div class="column-actions">
                <button title="Edit"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                <button class="delete" title="Delete"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
              </div>
            </div>
          </div>
        </div>

        <div class="sample-section">
          <div class="section-title">
            <h3>Sample Output</h3>
          </div>
          <div class="sample-output" id="sample-output">
            <span class="sample-empty">// Data will appear here...</span>
          </div>
        </div>

        <div class="error-section" id="error-section">
          <div class="error-list" id="error-list"></div>
        </div>
      </div>

      <div class="controls-footer">
        <div class="btn-row">
          <button class="btn-secondary" id="preview-btn">
            <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
            Preview
          </button>
          <button class="btn-primary" id="start-btn">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            Start
          </button>
        </div>
        <div class="btn-row" id="running-controls" style="display: none;">
          <button class="btn-secondary" id="pause-btn">
            <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            Pause
          </button>
          <button class="btn-secondary btn-danger" id="stop-btn">
            <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
            Stop
          </button>
        </div>
        <div class="btn-row" id="paused-controls" style="display: none;">
          <button class="btn-primary" id="resume-btn">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            Resume
          </button>
          <button class="btn-secondary btn-danger" id="stop-btn-2">
            <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
            Stop
          </button>
        </div>
        <button class="cancel-btn" id="close-btn">Cancel Extraction</button>
      </div>
    </div>
  `;
}

/**
 * Sets up dragging functionality for the overlay
 */
function setupDragging(container: HTMLElement, handle: HTMLElement): void {
  handle.addEventListener('mousedown', (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }

    isDragging = true;
    const rect = container.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    container.style.transition = 'none';
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;

    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;

    const maxX = window.innerWidth - container.offsetWidth;
    const maxY = window.innerHeight - container.offsetHeight;

    container.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
    container.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
    container.style.right = 'auto';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    container.style.transition = '';
  });
}

/**
 * Sets up button click handlers
 */
function setupButtonHandlers(root: ShadowRoot): void {
  const startBtn = root.getElementById('start-btn') as HTMLButtonElement;
  const pauseBtn = root.getElementById('pause-btn') as HTMLButtonElement;
  const resumeBtn = root.getElementById('resume-btn') as HTMLButtonElement;
  const stopBtn = root.getElementById('stop-btn') as HTMLButtonElement;
  const stopBtn2 = root.getElementById('stop-btn-2') as HTMLButtonElement;
  const minimizeBtn = root.getElementById('minimize-btn') as HTMLButtonElement;
  const closeBtn = root.getElementById('close-btn') as HTMLButtonElement;
  const container = root.getElementById('overlay-container') as HTMLElement;

  if (startBtn) startBtn.addEventListener('click', () => buttonHandlers?.onStart());
  if (pauseBtn) pauseBtn.addEventListener('click', () => buttonHandlers?.onPause());
  if (resumeBtn) resumeBtn.addEventListener('click', () => buttonHandlers?.onResume());
  if (stopBtn) stopBtn.addEventListener('click', () => buttonHandlers?.onStop());
  if (stopBtn2) stopBtn2.addEventListener('click', () => buttonHandlers?.onStop());

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      isMinimized = !isMinimized;
      container.classList.toggle('minimized', isMinimized);
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      buttonHandlers?.onStop();
      destroyOverlay();
    });
  }
}

/**
 * Creates the overlay with Shadow DOM isolation
 */
export function createOverlay(): ShadowRoot {
  const existing = document.getElementById(SHADOW_HOST_ID);
  if (existing) {
    existing.remove();
  }

  const host = document.createElement('div');
  host.id = SHADOW_HOST_ID;
  host.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 2147483647; pointer-events: none;';
  document.body.appendChild(host);

  shadowRoot = host.attachShadow({ mode: 'open' });

  const styleSheet = document.createElement('style');
  styleSheet.textContent = getStyles();
  shadowRoot.appendChild(styleSheet);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = getHTML();
  wrapper.style.pointerEvents = 'auto';
  shadowRoot.appendChild(wrapper);

  const container = shadowRoot.getElementById('overlay-container') as HTMLElement;
  const handle = shadowRoot.getElementById('drag-handle') as HTMLElement;

  if (container && handle) {
    setupDragging(container, handle);
    setupButtonHandlers(shadowRoot);
  }

  console.log('[WebScraper Overlay] Created with Stitch design');

  return shadowRoot;
}

/**
 * Updates the progress display
 */
export function updateProgress(collected: number, max?: number): void {
  if (!shadowRoot) return;

  const collectedEl = shadowRoot.getElementById('collected-count');
  const maxEl = shadowRoot.getElementById('max-count');
  const progressBar = shadowRoot.getElementById('progress-bar') as HTMLElement;

  if (collectedEl) {
    collectedEl.textContent = String(collected);
  }

  if (maxEl) {
    maxEl.textContent = max !== undefined && max > 0 ? String(max) : '--';
  }

  if (progressBar && max !== undefined && max > 0) {
    const percentage = Math.min((collected / max) * 100, 100);
    progressBar.style.width = `${percentage}%`;
  } else if (progressBar) {
    progressBar.style.width = collected > 0 ? '100%' : '0%';
  }
}

/**
 * Updates the preview with extracted items
 */
export function updatePreview(items: ExtractedItem[]): void {
  if (!shadowRoot) return;

  const sampleOutput = shadowRoot.getElementById('sample-output');
  if (!sampleOutput) return;

  const lastItems = items.slice(-3);

  if (lastItems.length === 0) {
    sampleOutput.innerHTML = '<span class="sample-empty">// Data will appear here...</span>';
    return;
  }

  const preview = JSON.stringify(lastItems, null, 2);
  const truncated = preview.length > 300 ? preview.substring(0, 297) + '...' : preview;
  sampleOutput.textContent = truncated;
}

/**
 * Updates the status display
 */
export function updateStatus(status: ScrollerStatus): void {
  if (!shadowRoot) return;

  const statusDot = shadowRoot.getElementById('status-dot');
  const statusText = shadowRoot.getElementById('status-text');
  const startControls = shadowRoot.querySelector('.btn-row:first-child') as HTMLElement;
  const runningControls = shadowRoot.getElementById('running-controls') as HTMLElement;
  const pausedControls = shadowRoot.getElementById('paused-controls') as HTMLElement;
  const patternDesc = shadowRoot.getElementById('pattern-desc');

  if (statusDot) {
    statusDot.className = `status-dot ${status}`;
  }

  if (statusText) {
    statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  }

  // Update control visibility
  if (startControls && runningControls && pausedControls) {
    switch (status) {
      case 'idle':
        startControls.style.display = 'flex';
        runningControls.style.display = 'none';
        pausedControls.style.display = 'none';
        break;
      case 'running':
        startControls.style.display = 'none';
        runningControls.style.display = 'flex';
        pausedControls.style.display = 'none';
        if (patternDesc) patternDesc.textContent = 'Scanning page for patterns...';
        break;
      case 'paused':
        startControls.style.display = 'none';
        runningControls.style.display = 'none';
        pausedControls.style.display = 'flex';
        if (patternDesc) patternDesc.textContent = 'Extraction paused.';
        break;
      case 'error':
        startControls.style.display = 'flex';
        runningControls.style.display = 'none';
        pausedControls.style.display = 'none';
        if (patternDesc) patternDesc.textContent = 'An error occurred. Try again.';
        break;
    }
  }
}

/**
 * Shows an error message
 */
export function showError(message: string): void {
  if (!shadowRoot) return;

  const errorSection = shadowRoot.getElementById('error-section');
  const errorList = shadowRoot.getElementById('error-list');

  if (errorSection && errorList) {
    errorSection.classList.add('has-errors');

    const errorItem = document.createElement('div');
    errorItem.className = 'error-item';
    errorItem.textContent = message;
    errorList.appendChild(errorItem);

    errorList.scrollTop = errorList.scrollHeight;
  }
}

/**
 * Clears all errors
 */
export function clearErrors(): void {
  if (!shadowRoot) return;

  const errorSection = shadowRoot.getElementById('error-section');
  const errorList = shadowRoot.getElementById('error-list');

  if (errorSection && errorList) {
    errorSection.classList.remove('has-errors');
    errorList.innerHTML = '';
  }
}

/**
 * Sets button handlers
 */
export function setButtonHandlers(handlers: ButtonHandlers): void {
  buttonHandlers = handlers;
}

/**
 * Destroys the overlay
 */
export function destroyOverlay(): void {
  const host = document.getElementById(SHADOW_HOST_ID);
  if (host) {
    host.remove();
  }
  shadowRoot = null;
  buttonHandlers = null;
  isMinimized = false;
  console.log('[WebScraper Overlay] Destroyed');
}

/**
 * Checks if overlay is visible
 */
export function isOverlayVisible(): boolean {
  return shadowRoot !== null;
}
