/**
 * Recording Panel UI Component
 * Provides controls for recording browser interactions for tutorial generation
 */

import type { RecordingState, RecordingConfig } from '../types/recording';

// Constants
const PANEL_ID = 'web-scraper-recording-panel';

// State
let shadowRoot: ShadowRoot | null = null;
let stateUpdateCallback: ((state: RecordingState) => void) | null = null;
let currentState: RecordingState = {
  status: 'idle',
  startTime: null,
  duration: 0,
  eventCount: 0,
  frameCount: 0,
  errors: [],
};

/**
 * Recording panel event handlers
 */
export interface RecordingPanelHandlers {
  onStart: (config: RecordingConfig) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onExport: (format: 'markdown' | 'pdf' | 'video') => void;
  onSettingsOpen: () => void;
}

let handlers: RecordingPanelHandlers | null = null;

/**
 * Gets the panel styles
 */
function getStyles(): string {
  return `
    :host {
      all: initial;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --bg-primary: rgba(16, 22, 37, 0.95);
      --bg-secondary: rgba(30, 41, 59, 0.9);
      --border-color: rgba(255, 255, 255, 0.1);
      --text-primary: #ffffff;
      --text-secondary: #9ca3af;
      --accent: #ef4444;
      --accent-hover: #dc2626;
      --success: #22c55e;
      --warning: #f59e0b;
      --error: #ef4444;
    }

    .panel {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 320px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(12px);
      z-index: 2147483647;
      overflow: hidden;
      transition: all 0.3s ease;
    }

    .panel.minimized {
      width: auto;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      cursor: move;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .recording-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--text-secondary);
      transition: background 0.3s;
    }

    .recording-indicator.active {
      background: var(--accent);
      animation: pulse 1.5s infinite;
    }

    .recording-indicator.paused {
      background: var(--warning);
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .header-buttons {
      display: flex;
      gap: 4px;
    }

    .icon-btn {
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .icon-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: var(--text-primary);
    }

    .body {
      padding: 16px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }

    .stat {
      text-align: center;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .stat-label {
      font-size: 11px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .controls {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }

    .btn {
      flex: 1;
      padding: 10px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .btn-primary {
      background: var(--accent);
      color: white;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
    }

    .btn-primary:disabled {
      background: rgba(239, 68, 68, 0.5);
      cursor: not-allowed;
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: var(--text-primary);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .btn-success {
      background: var(--success);
      color: white;
    }

    .btn-success:hover {
      background: #16a34a;
    }

    .progress-section {
      margin-bottom: 16px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }

    .progress-bar {
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--accent);
      transition: width 0.3s ease;
    }

    .export-section {
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
    }

    .export-title {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .export-buttons {
      display: flex;
      gap: 8px;
    }

    .export-btn {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--text-primary);
      font-size: 12px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .export-btn:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: var(--text-secondary);
    }

    .export-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .error-banner {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 12px;
      font-size: 12px;
      color: var(--error);
    }

    .settings-section {
      padding-top: 16px;
      border-top: 1px solid var(--border-color);
    }

    .config-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .config-label {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .toggle {
      width: 40px;
      height: 22px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 11px;
      position: relative;
      cursor: pointer;
      transition: background 0.2s;
    }

    .toggle.active {
      background: var(--success);
    }

    .toggle::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s;
    }

    .toggle.active::after {
      transform: translateX(18px);
    }

    .hidden {
      display: none;
    }

    .minimized-content {
      display: none;
    }

    .panel.minimized .body {
      display: none;
    }

    .panel.minimized .minimized-content {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px 12px;
    }

    .mini-timer {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }
  `;
}

/**
 * Formats duration in seconds to MM:SS or HH:MM:SS
 */
function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Creates the panel HTML
 */
function createPanelHTML(state: RecordingState): string {
  const isRecording = state.status === 'recording';
  const isPaused = state.status === 'paused';
  const isComplete = state.status === 'complete';
  const isProcessing = state.status === 'processing';
  const hasErrors = state.errors.length > 0;
  const canExport = isComplete || state.eventCount > 0;

  const indicatorClass = isRecording ? 'active' : isPaused ? 'paused' : '';
  const maxDuration = 5 * 60; // 5 minutes max
  const progress = (state.duration / maxDuration) * 100;

  return `
    <div class="header" id="drag-handle">
      <div class="header-left">
        <div class="recording-indicator ${indicatorClass}"></div>
        <span class="title">Tutorial Recorder</span>
      </div>
      <div class="header-buttons">
        <button class="icon-btn" id="settings-btn" title="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        <button class="icon-btn" id="minimize-btn" title="Minimize">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
          </svg>
        </button>
        <button class="icon-btn" id="close-btn" title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="minimized-content">
      <div class="recording-indicator ${indicatorClass}"></div>
      <span class="mini-timer">${formatDuration(state.duration)}</span>
    </div>

    <div class="body">
      ${hasErrors ? `<div class="error-banner">${state.errors[state.errors.length - 1]}</div>` : ''}

      <div class="stats">
        <div class="stat">
          <div class="stat-value">${formatDuration(state.duration)}</div>
          <div class="stat-label">Duration</div>
        </div>
        <div class="stat">
          <div class="stat-value">${state.eventCount}</div>
          <div class="stat-label">Events</div>
        </div>
        <div class="stat">
          <div class="stat-value">${state.frameCount}</div>
          <div class="stat-label">Frames</div>
        </div>
      </div>

      <div class="progress-section">
        <div class="progress-header">
          <span>Recording limit</span>
          <span>${formatDuration(state.duration)} / ${formatDuration(maxDuration)}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
        </div>
      </div>

      <div class="controls">
        ${
          state.status === 'idle'
            ? `<button class="btn btn-primary" id="start-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10"/>
                </svg>
                Start Recording
              </button>`
            : ''
        }
        ${
          isRecording
            ? `
              <button class="btn btn-secondary" id="pause-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"/>
                  <rect x="14" y="4" width="4" height="16"/>
                </svg>
                Pause
              </button>
              <button class="btn btn-primary" id="stop-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
                Stop
              </button>
            `
            : ''
        }
        ${
          isPaused
            ? `
              <button class="btn btn-success" id="resume-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Resume
              </button>
              <button class="btn btn-primary" id="stop-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
                Stop
              </button>
            `
            : ''
        }
        ${
          isProcessing
            ? `<button class="btn btn-secondary" disabled>Processing...</button>`
            : ''
        }
        ${
          isComplete
            ? `<button class="btn btn-success" id="start-btn">New Recording</button>`
            : ''
        }
      </div>

      <div class="export-section ${!canExport ? 'hidden' : ''}">
        <div class="export-title">Export Tutorial</div>
        <div class="export-buttons">
          <button class="export-btn" id="export-md-btn" ${!canExport ? 'disabled' : ''}>
            Markdown
          </button>
          <button class="export-btn" id="export-pdf-btn" ${!canExport ? 'disabled' : ''}>
            PDF
          </button>
          <button class="export-btn" id="export-video-btn" ${!canExport ? 'disabled' : ''}>
            Video
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Sets up event listeners for the panel
 */
function setupEventListeners(): void {
  if (!shadowRoot) return;

  const panel = shadowRoot.querySelector('.panel') as HTMLElement;
  const dragHandle = shadowRoot.getElementById('drag-handle');
  const minimizeBtn = shadowRoot.getElementById('minimize-btn');
  const closeBtn = shadowRoot.getElementById('close-btn');
  const settingsBtn = shadowRoot.getElementById('settings-btn');
  const startBtn = shadowRoot.getElementById('start-btn');
  const pauseBtn = shadowRoot.getElementById('pause-btn');
  const resumeBtn = shadowRoot.getElementById('resume-btn');
  const stopBtn = shadowRoot.getElementById('stop-btn');
  const exportMdBtn = shadowRoot.getElementById('export-md-btn');
  const exportPdfBtn = shadowRoot.getElementById('export-pdf-btn');
  const exportVideoBtn = shadowRoot.getElementById('export-video-btn');

  // Drag handling
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  dragHandle?.addEventListener('mousedown', (e: MouseEvent) => {
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;
    panel.style.left = `${e.clientX - dragOffset.x}px`;
    panel.style.top = `${e.clientY - dragOffset.y}px`;
    panel.style.right = 'auto';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Minimize
  minimizeBtn?.addEventListener('click', () => {
    panel.classList.toggle('minimized');
  });

  // Close
  closeBtn?.addEventListener('click', () => {
    hideRecordingPanel();
  });

  // Settings
  settingsBtn?.addEventListener('click', () => {
    handlers?.onSettingsOpen();
  });

  // Recording controls
  startBtn?.addEventListener('click', () => {
    const config: RecordingConfig = {
      captureVideo: true,
      captureDomEvents: true,
      cursorSmoothing: true,
      snapshotIntervalMs: 5000,
      maxDurationMs: 5 * 60 * 1000,
      videoQuality: 'medium',
      cursorFps: 60,
    };
    handlers?.onStart(config);
  });

  pauseBtn?.addEventListener('click', () => {
    handlers?.onPause();
  });

  resumeBtn?.addEventListener('click', () => {
    handlers?.onResume();
  });

  stopBtn?.addEventListener('click', () => {
    handlers?.onStop();
  });

  // Export buttons
  exportMdBtn?.addEventListener('click', () => {
    handlers?.onExport('markdown');
  });

  exportPdfBtn?.addEventListener('click', () => {
    handlers?.onExport('pdf');
  });

  exportVideoBtn?.addEventListener('click', () => {
    handlers?.onExport('video');
  });
}

/**
 * Shows the recording panel
 */
export function showRecordingPanel(panelHandlers: RecordingPanelHandlers): void {
  handlers = panelHandlers;

  // Remove existing panel if any
  const existing = document.getElementById(PANEL_ID);
  if (existing) {
    existing.remove();
  }

  // Create shadow host
  const host = document.createElement('div');
  host.id = PANEL_ID;
  document.body.appendChild(host);

  // Create shadow root
  shadowRoot = host.attachShadow({ mode: 'closed' });

  // Add styles
  const style = document.createElement('style');
  style.textContent = getStyles();
  shadowRoot.appendChild(style);

  // Add panel
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.innerHTML = createPanelHTML(currentState);
  shadowRoot.appendChild(panel);

  // Setup event listeners
  setupEventListeners();

  console.log('[RecordingPanel] Panel shown');
}

/**
 * Hides the recording panel
 */
export function hideRecordingPanel(): void {
  const host = document.getElementById(PANEL_ID);
  if (host) {
    host.remove();
  }
  shadowRoot = null;
  handlers = null;
  console.log('[RecordingPanel] Panel hidden');
}

/**
 * Updates the panel with new recording state
 */
export function updateRecordingState(state: RecordingState): void {
  currentState = state;

  if (!shadowRoot) return;

  const panel = shadowRoot.querySelector('.panel');
  if (!panel) return;

  // Preserve minimized state
  const isMinimized = panel.classList.contains('minimized');

  // Update panel content
  panel.innerHTML = createPanelHTML(state);

  if (isMinimized) {
    panel.classList.add('minimized');
  }

  // Re-setup event listeners
  setupEventListeners();

  // Notify callback if registered
  if (stateUpdateCallback) {
    stateUpdateCallback(state);
  }
}

/**
 * Registers a callback for state updates
 */
export function onStateUpdate(callback: (state: RecordingState) => void): void {
  stateUpdateCallback = callback;
}

/**
 * Gets the current recording state
 */
export function getCurrentState(): RecordingState {
  return { ...currentState };
}

/**
 * Shows a notification toast
 */
export function showNotification(
  message: string,
  type: 'success' | 'error' | 'warning' = 'success'
): void {
  if (!shadowRoot) return;

  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#22c55e'};
    color: white;
    font-size: 14px;
    font-weight: 500;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 2147483647;
    animation: slideUp 0.3s ease;
  `;
  toast.textContent = message;

  const host = document.getElementById(PANEL_ID);
  if (host?.shadowRoot) {
    host.shadowRoot.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}
