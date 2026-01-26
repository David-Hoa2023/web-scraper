/**
 * Settings Panel UI Component
 * Provides configuration for LLM API keys and recording preferences
 */

import type { LLMConfig } from '../types/tutorial';
import type { RecordingConfig } from '../types/recording';

// Constants
const SETTINGS_ID = 'web-scraper-settings-panel';
const STORAGE_KEY = 'web-scraper-settings';

// State
let shadowRoot: ShadowRoot | null = null;

/**
 * Combined settings interface
 */
export interface Settings {
  llm: LLMConfig;
  recording: RecordingConfig;
}

/**
 * Default settings
 */
const DEFAULT_SETTINGS: Settings = {
  llm: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4',
    maxTokens: 2048,
    temperature: 0.7,
  },
  recording: {
    captureVideo: true,
    captureDomEvents: true,
    cursorSmoothing: true,
    snapshotIntervalMs: 5000,
    maxDurationMs: 5 * 60 * 1000,
    videoQuality: 'medium',
    cursorFps: 60,
  },
};

let currentSettings: Settings = { ...DEFAULT_SETTINGS };

/**
 * Settings panel event handlers
 */
export interface SettingsPanelHandlers {
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

let handlers: SettingsPanelHandlers | null = null;

/**
 * Gets the settings panel styles
 */
function getStyles(): string {
  return `
    :host {
      all: initial;
      font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(16, 34, 22, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      backdrop-filter: blur(4px);
    }

    .panel {
      width: 90%;
      max-width: 520px;
      max-height: 90vh;
      background: #102216;
      border: 1px solid rgba(19, 236, 91, 0.2);
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: rgba(19, 236, 91, 0.08);
      border-bottom: 1px solid rgba(19, 236, 91, 0.2);
    }

    .title {
      font-size: 18px;
      font-weight: 600;
      color: #f6f8f6;
    }

    .close-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: #92c9a4;
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .close-btn:hover {
      background: rgba(19, 236, 91, 0.1);
      color: #f6f8f6;
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .section {
      margin-bottom: 24px;
    }

    .section:last-child {
      margin-bottom: 0;
    }

    .section-title {
      font-size: 12px;
      font-weight: 600;
      color: #92c9a4;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group:last-child {
      margin-bottom: 0;
    }

    .label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #f6f8f6;
      margin-bottom: 6px;
    }

    .input {
      width: 100%;
      padding: 10px 12px;
      background: rgba(19, 236, 91, 0.05);
      border: 1px solid rgba(19, 236, 91, 0.2);
      border-radius: 8px;
      color: #f6f8f6;
      font-size: 14px;
      transition: all 0.2s;
      box-sizing: border-box;
    }

    .input:focus {
      outline: none;
      border-color: #13ec5b;
      box-shadow: 0 0 0 3px rgba(19, 236, 91, 0.2);
    }

    .input::placeholder {
      color: #92c9a4;
    }

    .select {
      width: 100%;
      padding: 10px 12px;
      background: rgba(19, 236, 91, 0.05);
      border: 1px solid rgba(19, 236, 91, 0.2);
      border-radius: 8px;
      color: #f6f8f6;
      font-size: 14px;
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2392c9a4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      background-size: 16px;
      box-sizing: border-box;
    }

    .select:focus {
      outline: none;
      border-color: #13ec5b;
    }

    .select option {
      background: #102216;
      color: #f6f8f6;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(19, 236, 91, 0.1);
    }

    .checkbox-group:last-child {
      border-bottom: none;
    }

    .checkbox-label {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .checkbox-title {
      font-size: 14px;
      color: #f6f8f6;
    }

    .checkbox-desc {
      font-size: 12px;
      color: #92c9a4;
    }

    .toggle {
      position: relative;
      width: 44px;
      height: 24px;
      background: rgba(19, 236, 91, 0.15);
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .toggle.active {
      background: #13ec5b;
    }

    .toggle::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s;
    }

    .toggle.active::after {
      transform: translateX(20px);
    }

    .slider-group {
      margin-bottom: 16px;
    }

    .slider-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .slider {
      width: 100%;
      height: 4px;
      background: rgba(19, 236, 91, 0.15);
      border-radius: 2px;
      appearance: none;
      cursor: pointer;
    }

    .slider::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      background: #13ec5b;
      border-radius: 50%;
      cursor: pointer;
    }

    .hint {
      font-size: 12px;
      color: #92c9a4;
      margin-top: 4px;
    }

    .api-key-input {
      position: relative;
    }

    .api-key-input .input {
      padding-right: 40px;
    }

    .toggle-visibility {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #92c9a4;
      cursor: pointer;
      padding: 4px;
    }

    .toggle-visibility:hover {
      color: #f6f8f6;
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      background: rgba(19, 236, 91, 0.08);
      border-top: 1px solid rgba(19, 236, 91, 0.2);
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-secondary {
      background: rgba(19, 236, 91, 0.1);
      color: #f6f8f6;
    }

    .btn-secondary:hover {
      background: rgba(19, 236, 91, 0.15);
    }

    .btn-primary {
      background: #13ec5b;
      color: #102216;
    }

    .btn-primary:hover {
      background: #10d450;
    }

    .status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: rgba(19, 236, 91, 0.05);
      border-radius: 12px;
      font-size: 12px;
      margin-top: 8px;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .status-dot.success {
      background: #13ec5b;
    }

    .status-dot.error {
      background: #ef4444;
    }

    .status-dot.pending {
      background: #f59e0b;
    }
  `;
}

/**
 * Creates the settings panel HTML
 */
function createSettingsHTML(settings: Settings): string {
  const showApiKey = false;

  return `
    <div class="overlay" id="settings-overlay">
      <div class="panel">
        <div class="header">
          <span class="title">Settings</span>
          <button class="close-btn" id="close-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="content">
          <div class="section">
            <div class="section-title">LLM Configuration</div>

            <div class="form-group">
              <label class="label">Provider</label>
              <select class="select" id="llm-provider">
                <option value="openai" ${settings.llm.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
                <option value="anthropic" ${settings.llm.provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
                <option value="custom" ${settings.llm.provider === 'custom' ? 'selected' : ''}>Custom</option>
              </select>
            </div>

            <div class="form-group">
              <label class="label">API Key</label>
              <div class="api-key-input">
                <input
                  type="${showApiKey ? 'text' : 'password'}"
                  class="input"
                  id="api-key"
                  value="${settings.llm.apiKey}"
                  placeholder="Enter your API key"
                >
                <button class="toggle-visibility" id="toggle-api-key">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
              <div class="hint">Your API key is stored locally and never sent anywhere except to the provider</div>
            </div>

            <div class="form-group">
              <label class="label">Model</label>
              <select class="select" id="llm-model">
                <optgroup label="OpenAI">
                  <option value="gpt-4" ${settings.llm.model === 'gpt-4' ? 'selected' : ''}>GPT-4</option>
                  <option value="gpt-4-turbo" ${settings.llm.model === 'gpt-4-turbo' ? 'selected' : ''}>GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo" ${settings.llm.model === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo</option>
                </optgroup>
                <optgroup label="Anthropic">
                  <option value="claude-3-opus" ${settings.llm.model === 'claude-3-opus' ? 'selected' : ''}>Claude 3 Opus</option>
                  <option value="claude-3-sonnet" ${settings.llm.model === 'claude-3-sonnet' ? 'selected' : ''}>Claude 3 Sonnet</option>
                  <option value="claude-3-haiku" ${settings.llm.model === 'claude-3-haiku' ? 'selected' : ''}>Claude 3 Haiku</option>
                </optgroup>
              </select>
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <label class="label">Temperature</label>
                <span class="label" id="temp-value">${settings.llm.temperature}</span>
              </div>
              <input
                type="range"
                class="slider"
                id="llm-temperature"
                min="0"
                max="1"
                step="0.1"
                value="${settings.llm.temperature}"
              >
              <div class="hint">Lower values produce more focused output, higher values more creative</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Recording Options</div>

            <div class="checkbox-group">
              <div class="checkbox-label">
                <span class="checkbox-title">Capture Video</span>
                <span class="checkbox-desc">Record screen video alongside DOM events</span>
              </div>
              <div class="toggle ${settings.recording.captureVideo ? 'active' : ''}"
                   id="toggle-video"
                   data-setting="captureVideo"></div>
            </div>

            <div class="checkbox-group">
              <div class="checkbox-label">
                <span class="checkbox-title">Capture DOM Events</span>
                <span class="checkbox-desc">Record clicks, inputs, and navigation</span>
              </div>
              <div class="toggle ${settings.recording.captureDomEvents ? 'active' : ''}"
                   id="toggle-dom"
                   data-setting="captureDomEvents"></div>
            </div>

            <div class="checkbox-group">
              <div class="checkbox-label">
                <span class="checkbox-title">Cursor Smoothing</span>
                <span class="checkbox-desc">Apply Bezier smoothing to cursor movement</span>
              </div>
              <div class="toggle ${settings.recording.cursorSmoothing ? 'active' : ''}"
                   id="toggle-cursor"
                   data-setting="cursorSmoothing"></div>
            </div>

            <div class="form-group">
              <label class="label">Video Quality</label>
              <select class="select" id="video-quality">
                <option value="low" ${settings.recording.videoQuality === 'low' ? 'selected' : ''}>Low (720p)</option>
                <option value="medium" ${settings.recording.videoQuality === 'medium' ? 'selected' : ''}>Medium (1080p)</option>
                <option value="high" ${settings.recording.videoQuality === 'high' ? 'selected' : ''}>High (4K)</option>
              </select>
            </div>

            <div class="slider-group">
              <div class="slider-header">
                <label class="label">Snapshot Interval</label>
                <span class="label" id="snapshot-value">${settings.recording.snapshotIntervalMs / 1000}s</span>
              </div>
              <input
                type="range"
                class="slider"
                id="snapshot-interval"
                min="1000"
                max="30000"
                step="1000"
                value="${settings.recording.snapshotIntervalMs}"
              >
            </div>
          </div>
        </div>

        <div class="footer">
          <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
          <button class="btn btn-primary" id="save-btn">Save Settings</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Sets up event listeners for the settings panel
 */
function setupEventListeners(): void {
  if (!shadowRoot) return;

  const overlay = shadowRoot.getElementById('settings-overlay');
  const closeBtn = shadowRoot.getElementById('close-btn');
  const cancelBtn = shadowRoot.getElementById('cancel-btn');
  const saveBtn = shadowRoot.getElementById('save-btn');
  const toggleApiKey = shadowRoot.getElementById('toggle-api-key');

  // Input elements
  const providerSelect = shadowRoot.getElementById('llm-provider') as HTMLSelectElement;
  const apiKeyInput = shadowRoot.getElementById('api-key') as HTMLInputElement;
  const modelSelect = shadowRoot.getElementById('llm-model') as HTMLSelectElement;
  const temperatureSlider = shadowRoot.getElementById('llm-temperature') as HTMLInputElement;
  const videoQualitySelect = shadowRoot.getElementById('video-quality') as HTMLSelectElement;
  const snapshotSlider = shadowRoot.getElementById('snapshot-interval') as HTMLInputElement;

  // Temperature display
  const tempValue = shadowRoot.getElementById('temp-value');
  temperatureSlider?.addEventListener('input', () => {
    if (tempValue) {
      tempValue.textContent = temperatureSlider.value;
    }
  });

  // Snapshot interval display
  const snapshotValue = shadowRoot.getElementById('snapshot-value');
  snapshotSlider?.addEventListener('input', () => {
    if (snapshotValue) {
      snapshotValue.textContent = `${parseInt(snapshotSlider.value, 10) / 1000}s`;
    }
  });

  // Toggle API key visibility
  toggleApiKey?.addEventListener('click', () => {
    if (apiKeyInput) {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
    }
  });

  // Toggle switches
  const toggles = shadowRoot.querySelectorAll('.toggle[data-setting]');
  toggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
    });
  });

  // Close on overlay click
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideSettingsPanel();
    }
  });

  // Close button
  closeBtn?.addEventListener('click', () => {
    hideSettingsPanel();
  });

  // Cancel button
  cancelBtn?.addEventListener('click', () => {
    hideSettingsPanel();
  });

  // Save button
  saveBtn?.addEventListener('click', () => {
    const newSettings: Settings = {
      llm: {
        provider: providerSelect?.value as 'openai' | 'anthropic' | 'custom' || 'openai',
        apiKey: apiKeyInput?.value || '',
        model: modelSelect?.value || 'gpt-4',
        maxTokens: currentSettings.llm.maxTokens,
        temperature: parseFloat(temperatureSlider?.value || '0.7'),
      },
      recording: {
        captureVideo: shadowRoot?.getElementById('toggle-video')?.classList.contains('active') ?? true,
        captureDomEvents: shadowRoot?.getElementById('toggle-dom')?.classList.contains('active') ?? true,
        cursorSmoothing: shadowRoot?.getElementById('toggle-cursor')?.classList.contains('active') ?? true,
        snapshotIntervalMs: parseInt(snapshotSlider?.value || '5000', 10),
        maxDurationMs: currentSettings.recording.maxDurationMs,
        videoQuality: videoQualitySelect?.value as 'low' | 'medium' | 'high' || 'medium',
        cursorFps: currentSettings.recording.cursorFps,
      },
    };

    currentSettings = newSettings;
    saveSettingsToStorage(newSettings);
    handlers?.onSave(newSettings);
    hideSettingsPanel();
  });
}

/**
 * Shows the settings panel
 */
export function showSettingsPanel(settingsHandlers: SettingsPanelHandlers): void {
  handlers = settingsHandlers;

  // Load settings from storage
  loadSettingsFromStorage();

  // Remove existing panel if any
  const existing = document.getElementById(SETTINGS_ID);
  if (existing) {
    existing.remove();
  }

  // Create shadow host
  const host = document.createElement('div');
  host.id = SETTINGS_ID;
  document.body.appendChild(host);

  // Create shadow root
  shadowRoot = host.attachShadow({ mode: 'closed' });

  // Add styles
  const style = document.createElement('style');
  style.textContent = getStyles();
  shadowRoot.appendChild(style);

  // Add content
  const content = document.createElement('div');
  content.innerHTML = createSettingsHTML(currentSettings);
  shadowRoot.appendChild(content);

  // Setup event listeners
  setupEventListeners();

  console.log('[SettingsPanel] Panel shown');
}

/**
 * Hides the settings panel
 */
export function hideSettingsPanel(): void {
  const host = document.getElementById(SETTINGS_ID);
  if (host) {
    host.remove();
  }
  shadowRoot = null;
  handlers?.onClose();
  handlers = null;
  console.log('[SettingsPanel] Panel hidden');
}

/**
 * Saves settings to Chrome local storage
 */
async function saveSettingsToStorage(settings: Settings): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [STORAGE_KEY]: settings });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
    console.log('[SettingsPanel] Settings saved');
  } catch (error) {
    console.error('[SettingsPanel] Error saving settings:', error);
  }
}

/**
 * Loads settings from Chrome local storage
 */
async function loadSettingsFromStorage(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        currentSettings = { ...DEFAULT_SETTINGS, ...result[STORAGE_KEY] };
      }
    } else {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        currentSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    }
    console.log('[SettingsPanel] Settings loaded');
  } catch (error) {
    console.error('[SettingsPanel] Error loading settings:', error);
    currentSettings = { ...DEFAULT_SETTINGS };
  }
}

/**
 * Gets the current settings
 */
export function getSettings(): Settings {
  return { ...currentSettings };
}

/**
 * Updates settings programmatically
 */
export function updateSettings(updates: Partial<Settings>): void {
  if (updates.llm) {
    currentSettings.llm = { ...currentSettings.llm, ...updates.llm };
  }
  if (updates.recording) {
    currentSettings.recording = { ...currentSettings.recording, ...updates.recording };
  }
  saveSettingsToStorage(currentSettings);
}
