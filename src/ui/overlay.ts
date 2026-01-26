/**
 * UI Overlay Module for Web Scraper Chrome Extension
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
 * Gets the overlay styles (dark theme)
 */
/**
 * Gets the overlay styles (Glassmorphism theme)
 */
function getStyles(): string {
  return `
    :host {
      all: initial;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --glass-bg: rgba(16, 22, 37, 0.90);
      --glass-border: 1px solid rgba(255, 255, 255, 0.1);
      --glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
      --glass-blur: blur(12px);
      
      --accent: #00ff88;
      --accent-hover: #00fa9a;
      --text: #ffffff;
      --text-muted: #9ca3af;
      --danger: #ef4444;
      --warning: #fbbf24;
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
      width: 320px;
      background: var(--glass-bg);
      backdrop-filter: var(--glass-blur);
      border: var(--glass-border);
      border-radius: 12px;
      box-shadow: var(--glass-shadow);
      z-index: 2147483647;
      color: var(--text);
      font-size: 13px;
      overflow: hidden;
      user-select: none;
      transition: width 0.3s ease, min-width 0.3s ease, border-radius 0.3s ease;
    }

    .overlay-container.minimized {
      width: 180px;
      min-width: 0;
      border-radius: 24px;
    }

    .overlay-container.minimized .overlay-body {
      display: none;
    }
    
    .overlay-container.minimized .header-controls {
      display: none;
    }

    /* Header */
    .overlay-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.03);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      cursor: move;
    }
    
    .overlay-container.minimized .overlay-header {
      border-bottom: none;
      padding: 8px 16px;
      justify-content: center;
    }

    .overlay-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 14px;
      color: var(--accent);
      text-shadow: 0 0 10px rgba(0, 255, 136, 0.3);
    }

    .overlay-title-icon {
      width: 18px;
      height: 18px;
    }

    .header-controls {
      display: flex;
      gap: 4px;
    }

    .header-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .header-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: var(--text);
    }

    /* Body */
    .overlay-body {
      padding: 16px;
    }

    /* Progress & Status */
    .progress-section {
      margin-bottom: 16px;
    }

    .progress-label {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
      color: var(--text-muted);
    }

    .progress-count {
      color: var(--text);
      font-weight: 700;
      font-family: 'Monaco', monospace;
    }

    .progress-bar-container {
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: var(--accent);
      border-radius: 2px;
      transition: width 0.3s ease;
      width: 0%;
      box-shadow: 0 0 8px var(--accent);
    }

    .status-section {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      padding: 6px 10px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--text-muted);
      box-shadow: 0 0 5px currentColor;
    }

    .status-dot.idle { background: var(--text-muted); color: var(--text-muted); }
    .status-dot.running { background: var(--accent); color: var(--accent); animation: pulse 1.5s infinite; }
    .status-dot.paused { background: var(--warning); color: var(--warning); }
    .status-dot.error { background: var(--danger); color: var(--danger); }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }

    .status-text {
      text-transform: uppercase;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: var(--text-muted);
    }

    /* Controls */
    .buttons-section {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    .control-btn {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid transparent;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .btn-start {
      background: rgba(0, 255, 136, 0.15);
      border-color: rgba(0, 255, 136, 0.3);
      color: var(--accent);
    }
    .btn-start:hover { background: rgba(0, 255, 136, 0.25); }

    .btn-pause {
      background: rgba(251, 191, 36, 0.15);
      border-color: rgba(251, 191, 36, 0.3);
      color: var(--warning);
    }
    .btn-pause:hover { background: rgba(251, 191, 36, 0.25); }

    .btn-stop {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.3);
      color: var(--danger);
    }
    .btn-stop:hover { background: rgba(239, 68, 68, 0.25); }
    
    .control-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
      filter: grayscale(1);
    }

    /* Terminal Preview */
    .preview-section {
      margin-bottom: 0;
    }

    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .preview-title {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .preview-list {
      max-height: 120px;
      overflow-y: auto;
      background: #0a0e17;
      border-radius: 6px;
      padding: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      font-family: 'Fira Code', 'Consolas', monospace;
    }

    .preview-list::-webkit-scrollbar {
      width: 4px;
    }
    .preview-list::-webkit-scrollbar-thumb {
      background: #333;
      border-radius: 2px;
    }

    .preview-item {
      font-size: 10px;
      color: #a0a0a0;
      padding: 4px 6px;
      margin-bottom: 4px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .preview-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }
    /* Syntax highlighting simulation */
    .key { color: #f0a; }
    .string { color: var(--accent); }
    
    .preview-empty {
      text-align: center;
      color: #444;
      padding: 12px;
      font-style: italic;
    }

    .error-section {
      margin-top: 12px;
      padding: 8px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 6px;
      display: none;
    }
    
    .error-section.has-errors { display: block; }
    
    .error-item {
        color: var(--danger);
        font-size: 11px;
        margin-bottom: 4px;
    }
  `;
}

/**
 * Gets the overlay HTML structure
 */
function getHTML(): string {
  return `
    <div class="overlay-container" id="overlay-container">
      <div class="overlay-header" id="drag-handle">
        <div class="overlay-title">
          <svg class="overlay-title-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          <span style="font-family: inherit;">Scraper Pro</span>
        </div>
        <div class="header-controls">
          <button class="header-btn" id="minimize-btn" title="Minimize/Maximize">
            <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13H5v-2h14v2z"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="overlay-body">
        <div class="status-section">
          <div class="status-dot idle" id="status-dot"></div>
          <span class="status-text" id="status-text">Ready</span>
        </div>

        <div class="progress-section">
          <div class="progress-label">
            <span>Collected</span>
            <span class="progress-count"><span id="collected-count">0</span> / <span id="max-count">∞</span></span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" id="progress-bar"></div>
          </div>
        </div>

        <div class="buttons-section">
          <button class="control-btn btn-start" id="start-btn">
            ▶ Start
          </button>
          <button class="control-btn btn-pause" id="pause-btn" style="display: none;">
            ⏸ Pause
          </button>
          <button class="control-btn btn-resume" id="resume-btn" style="display: none;">
            ▶ Resume
          </button>
          <button class="control-btn btn-stop" id="stop-btn" disabled>
            ⏹ Stop
          </button>
        </div>

        <div class="preview-section">
          <div class="preview-header">
            <span class="preview-title">Terminal Output</span>
          </div>
          <div class="preview-list" id="preview-list">
            <div class="preview-empty">// Logs will appear here...</div>
          </div>
        </div>
        
        <div class="error-section" id="error-section">
            <div class="error-list" id="error-list"></div>
            <button class="header-btn" id="clear-errors-btn" style="width:100%; margin-top:4px;">Clear Errors</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Sets up dragging functionality for the overlay
 */
function setupDragging(container: HTMLElement, handle: HTMLElement): void {
  handle.addEventListener('mousedown', (e: MouseEvent) => {
    // Ignore if clicking on buttons
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

    // Keep within viewport bounds
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
  const minimizeBtn = root.getElementById('minimize-btn') as HTMLButtonElement;
  const clearErrorsBtn = root.getElementById('clear-errors-btn') as HTMLButtonElement;
  const container = root.getElementById('overlay-container') as HTMLElement;

  if (startBtn) startBtn.addEventListener('click', () => buttonHandlers?.onStart());
  if (pauseBtn) pauseBtn.addEventListener('click', () => buttonHandlers?.onPause());
  if (resumeBtn) resumeBtn.addEventListener('click', () => buttonHandlers?.onResume());
  if (stopBtn) stopBtn.addEventListener('click', () => buttonHandlers?.onStop());

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      isMinimized = !isMinimized;
      container.classList.toggle('minimized', isMinimized);
    });
  }

  if (clearErrorsBtn) {
    clearErrorsBtn.addEventListener('click', () => clearErrors());
  }
}

/**
 * Creates the overlay with Shadow DOM isolation
 * @returns The ShadowRoot containing the overlay
 */
export function createOverlay(): ShadowRoot {
  // Remove existing overlay if present
  const existing = document.getElementById(SHADOW_HOST_ID);
  if (existing) {
    existing.remove();
  }

  // Create shadow host
  const host = document.createElement('div');
  host.id = SHADOW_HOST_ID;
  host.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 2147483647; pointer-events: none;';
  document.body.appendChild(host);

  // Create shadow DOM
  shadowRoot = host.attachShadow({ mode: 'open' });

  // Add styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = getStyles();
  shadowRoot.appendChild(styleSheet);

  // Add HTML structure
  const wrapper = document.createElement('div');
  wrapper.innerHTML = getHTML();
  wrapper.style.pointerEvents = 'auto';
  shadowRoot.appendChild(wrapper);

  // Get container and handle
  const container = shadowRoot.getElementById('overlay-container') as HTMLElement;
  const handle = shadowRoot.getElementById('drag-handle') as HTMLElement;

  if (container && handle) {
    setupDragging(container, handle);
    setupButtonHandlers(shadowRoot);
  }

  console.log('[WebScraper Overlay] Created');

  return shadowRoot;
}


/**
 * Updates the progress display
 * @param collected - Number of items collected
 * @param max - Maximum items to collect (optional)
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
    maxEl.textContent = max !== undefined ? String(max) : '--';
  }

  if (progressBar && max !== undefined && max > 0) {
    const percentage = Math.min((collected / max) * 100, 100);
    progressBar.style.width = `${percentage}%`;
  } else if (progressBar) {
    // Indeterminate progress - show pulsing animation
    progressBar.style.width = collected > 0 ? '100%' : '0%';
  }
}

/**
 * Updates the preview list with the last 5 extracted items
 * @param items - Array of extracted items
 */
export function updatePreview(items: ExtractedItem[]): void {
  if (!shadowRoot) return;

  const previewList = shadowRoot.getElementById('preview-list');
  const previewCount = shadowRoot.getElementById('preview-count');

  if (!previewList) return;

  // Update count
  if (previewCount) {
    previewCount.textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;
  }

  // Show last 5 items
  const lastItems = items.slice(-5);

  if (lastItems.length === 0) {
    previewList.innerHTML = '<div class="preview-empty">No items collected yet</div>';
    return;
  }

  previewList.innerHTML = lastItems
    .map((item) => {
      const json = JSON.stringify(item);
      const truncated = json.length > 80 ? json.substring(0, 77) + '...' : json;
      return `<div class="preview-item" title="${escapeHtml(json)}">${escapeHtml(truncated)}</div>`;
    })
    .join('');
}

/**
 * Updates the status display
 * @param status - Current scroller status
 */
export function updateStatus(status: ScrollerStatus): void {
  if (!shadowRoot) return;

  const statusDot = shadowRoot.getElementById('status-dot');
  const statusText = shadowRoot.getElementById('status-text');
  const startBtn = shadowRoot.getElementById('start-btn') as HTMLButtonElement;
  const pauseBtn = shadowRoot.getElementById('pause-btn') as HTMLButtonElement;
  const resumeBtn = shadowRoot.getElementById('resume-btn') as HTMLButtonElement;
  const stopBtn = shadowRoot.getElementById('stop-btn') as HTMLButtonElement;

  // Update status indicator
  if (statusDot) {
    statusDot.className = `status-dot ${status}`;
  }

  if (statusText) {
    statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  }

  // Update button visibility and states based on status
  if (startBtn && pauseBtn && resumeBtn && stopBtn) {
    switch (status) {
      case 'idle':
        startBtn.style.display = 'flex';
        startBtn.disabled = false;
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        stopBtn.disabled = true;
        break;
      case 'running':
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'flex';
        pauseBtn.disabled = false;
        resumeBtn.style.display = 'none';
        stopBtn.disabled = false;
        break;
      case 'paused':
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'flex';
        resumeBtn.disabled = false;
        stopBtn.disabled = false;
        break;
      case 'error':
        startBtn.style.display = 'flex';
        startBtn.disabled = false;
        pauseBtn.style.display = 'none';
        resumeBtn.style.display = 'none';
        stopBtn.disabled = true;
        break;
    }
  }
}

/**
 * Shows an error message in the overlay
 * @param message - Error message to display
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

    // Auto-scroll to bottom
    errorList.scrollTop = errorList.scrollHeight;
  }
}

/**
 * Clears all error messages from the overlay
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
 * Sets the button handlers to connect overlay buttons to scroller
 * @param handlers - Object containing handler functions
 */
export function setButtonHandlers(handlers: ButtonHandlers): void {
  buttonHandlers = handlers;
}

/**
 * Destroys the overlay and cleans up
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
 * Checks if the overlay is currently visible
 */
export function isOverlayVisible(): boolean {
  return shadowRoot !== null;
}

/**
 * Helper function to escape HTML entities
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
