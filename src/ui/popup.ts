// Popup script
import type {
  ScraperMessage,
  ScraperResponse,
  PatternDetectorConfig,
  ScrollerConfig,
  ExtractionConfig,
  ExtractionField
} from '../types';

// State Interfaces
interface AppConfig {
  patternConfig: PatternDetectorConfig;
  scrollerConfig: ScrollerConfig;
  extractionConfig: ExtractionConfig;
}

// Default Configuration
const DEFAULT_CONFIG: AppConfig = {
  patternConfig: {
    matchBy: ['tag', 'class'],
    minSiblings: 2,
    depthLimit: 3
  },
  scrollerConfig: {
    throttleMs: 1000,
    maxItems: 0,
    retryCount: 3,
    retryDelayMs: 2000
  },
  extractionConfig: {
    fields: [
      { name: 'text', selector: '', type: 'text' },
      { name: 'link', selector: 'a', type: 'href' },
      { name: 'image', selector: 'img', type: 'src' }
    ],
    preserveHierarchy: false,
    normalize: true
  }
};

// UI Elements with New IDs
const ui = {
  tabs: document.querySelectorAll('.nav-item[data-tab]'),
  contents: document.querySelectorAll('.tab-pane'),

  // Dashboard
  mainActionBtn: document.getElementById('main-action-btn') as HTMLButtonElement,
  exportBtn: document.getElementById('export-btn') as HTMLButtonElement,
  clearBtn: document.getElementById('clear-btn') as HTMLButtonElement,
  itemCount: document.getElementById('items-count') as HTMLSpanElement,
  statusText: document.getElementById('status-text') as HTMLSpanElement,
  statusBadge: document.getElementById('status-badge') as HTMLDivElement,

  // Match Settings (IDs are kebab-case in HTML)
  matchTag: document.getElementById('match-tag') as HTMLInputElement,
  matchClass: document.getElementById('match-class') as HTMLInputElement,
  matchId: document.getElementById('match-id') as HTMLInputElement,

  // Scroll Settings
  scrollSpeed: document.getElementById('scroll-speed') as HTMLInputElement,
  maxItems: document.getElementById('max-items') as HTMLInputElement,

  // Extraction Settings
  fieldsList: document.getElementById('fields-list') as HTMLDivElement,
  addFieldBtn: document.getElementById('add-field-btn') as HTMLButtonElement,
};

// --- Storage & Config ---

async function loadConfig(): Promise<AppConfig> {
  const result = await chrome.storage.local.get('scraperConfig');
  return { ...DEFAULT_CONFIG, ...result.scraperConfig };
}

async function saveConfig(config: AppConfig) {
  await chrome.storage.local.set({ scraperConfig: config });
  // Notify content script of config change
  sendMessage({ type: 'UPDATE_CONFIG', payload: config });
}

// --- Messaging ---

async function sendMessage(message: ScraperMessage): Promise<ScraperResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      // Ignore runtime errors when no background listener
      resolve(response || { success: false, error: 'No response' });
    });
  });
}

async function sendToContentScript(message: ScraperMessage): Promise<ScraperResponse> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return { success: false, error: 'No active tab' };
    }

    if (tab.url?.startsWith('chrome') || tab.url?.startsWith('edge')) {
      // Just silently fail for internal pages to avoid spamming errors
      return { success: false, error: '' };
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id!, message, (response) => {
        if (chrome.runtime.lastError) {
          // Content script likely not injected yet
          resolve({ success: false, error: 'Content script not ready' });
          return;
        }
        resolve(response || { success: false, error: 'No response' });
      });
    });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// --- Tabs Logic ---

function setupTabs() {
  ui.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Deactivate all
      ui.tabs.forEach(t => t.classList.remove('active'));
      ui.contents.forEach(c => c.classList.remove('active'));

      // Activate clicked
      tab.classList.add('active');
      const targetId = (tab as HTMLElement).dataset.tab;
      document.getElementById(`tab-${targetId}`)?.classList.add('active');
    });
  });
}

// --- Settings Logic ---

let currentConfig: AppConfig;

async function syncUIWithConfig() {
  currentConfig = await loadConfig();

  // Match
  if (ui.matchTag) ui.matchTag.checked = currentConfig.patternConfig.matchBy.includes('tag');
  if (ui.matchClass) ui.matchClass.checked = currentConfig.patternConfig.matchBy.includes('class');
  if (ui.matchId) ui.matchId.checked = currentConfig.patternConfig.matchBy.includes('id');

  // Scroll
  if (ui.scrollSpeed) ui.scrollSpeed.value = String(currentConfig.scrollerConfig.throttleMs);
  if (ui.maxItems) ui.maxItems.value = String(currentConfig.scrollerConfig.maxItems || 0);

  // Extraction
  if (ui.fieldsList) renderFields(currentConfig.extractionConfig.fields);
}

function bindSettingsListeners() {
  const updateConfig = () => {
    const matchBy: ('tag' | 'class' | 'id')[] = [];
    if (ui.matchTag?.checked) matchBy.push('tag');
    if (ui.matchClass?.checked) matchBy.push('class');
    if (ui.matchId?.checked) matchBy.push('id');

    currentConfig.patternConfig.matchBy = matchBy;
    currentConfig.scrollerConfig.throttleMs = parseInt(ui.scrollSpeed?.value) || 1000;
    currentConfig.scrollerConfig.maxItems = parseInt(ui.maxItems?.value) || 0;

    saveConfig(currentConfig);
  };

  ui.matchTag?.addEventListener('change', updateConfig);
  ui.matchClass?.addEventListener('change', updateConfig);
  ui.matchId?.addEventListener('change', updateConfig);
  ui.scrollSpeed?.addEventListener('change', updateConfig);
  ui.maxItems?.addEventListener('change', updateConfig);
}

// --- Extraction Fields UI ---

function renderFields(fields: ExtractionField[]) {
  if (!ui.fieldsList) return;
  ui.fieldsList.innerHTML = '';

  if (fields.length === 0) {
    ui.fieldsList.innerHTML = '<div class="empty-placeholder">No fields customized</div>';
    return;
  }

  fields.forEach((field, index) => {
    const row = document.createElement('div');
    row.className = 'field-item';
    row.innerHTML = `
      <input type="text" class="field-name" value="${field.name}" placeholder="Name">
      <input type="text" class="field-selector" value="${field.selector}" placeholder="Selector">
      <button class="icon-btn-small remove-btn" data-index="${index}">×</button>
    `;

    // Inputs Change Listener
    const inputs = row.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        const name = (row.querySelector('.field-name') as HTMLInputElement).value;
        const selector = (row.querySelector('.field-selector') as HTMLInputElement).value;
        currentConfig.extractionConfig.fields[index].name = name;
        currentConfig.extractionConfig.fields[index].selector = selector;
        saveConfig(currentConfig);
      });
    });

    // Remove Listener
    row.querySelector('.remove-btn')?.addEventListener('click', () => {
      currentConfig.extractionConfig.fields.splice(index, 1);
      renderFields(currentConfig.extractionConfig.fields);
      saveConfig(currentConfig);
    });

    ui.fieldsList.appendChild(row);
  });
}

ui.addFieldBtn?.addEventListener('click', () => {
  if (!currentConfig.extractionConfig.fields) currentConfig.extractionConfig.fields = [];
  currentConfig.extractionConfig.fields.push({ name: 'new_field', selector: '', type: 'text' });
  renderFields(currentConfig.extractionConfig.fields);
  saveConfig(currentConfig);
});

// --- Dashboard Actions ---

async function updateDashboardStatus() {
  const response = await sendToContentScript({ type: 'GET_STATUS' });

  if (!response.success) {
    // Content script not available - show ready state
    ui.itemCount.textContent = '0';
    ui.statusText.textContent = 'Ready';
    ui.mainActionBtn.textContent = 'Start Scraping';
    ui.mainActionBtn.classList.remove('active-state');
    return;
  }

  if (response.data) {
    const data = response.data as { itemsCollected?: number; status?: string };
    ui.itemCount.textContent = String(data.itemsCollected ?? 0);
    ui.statusText.textContent = data.status || 'Idle';

    // Toggle Start/Pause button State
    const status = data.status;

    if (status === 'running') {
      ui.mainActionBtn.textContent = 'Pause Scraping';
      ui.statusText.style.color = '#00ff9d'; // Green
      ui.mainActionBtn.classList.add('active-state'); // Add a pulsing glow class if needed
    } else if (status === 'paused') {
      ui.mainActionBtn.textContent = 'Resume Scraping';
      ui.statusText.style.color = '#ffcc00'; // Yellow
    } else {
      ui.mainActionBtn.textContent = 'Start Scraping';
      ui.statusText.style.color = '#fff';
      ui.mainActionBtn.classList.remove('active-state');
    }
  }
}

ui.mainActionBtn.addEventListener('click', async () => {
  const text = ui.mainActionBtn.textContent?.toLowerCase() || '';

  if (text.includes('start')) {
    ui.mainActionBtn.textContent = 'Starting...';
    await sendToContentScript({ type: 'START_SCRAPE' });
  } else if (text.includes('pause')) {
    await sendToContentScript({ type: 'PAUSE_SCRAPE' });
  } else if (text.includes('resume')) {
    await sendToContentScript({ type: 'RESUME_SCRAPE' });
  }

  setTimeout(updateDashboardStatus, 200);
});

ui.exportBtn?.addEventListener('click', async () => {
  const response = await sendToContentScript({ type: 'EXPORT_DATA' });
  if (response.success && response.data) {
    const data = response.data as any[];
    if (data.length === 0) {
      alert('No data to export.');
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrape-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    alert('Failed to export data');
  }
});

ui.clearBtn?.addEventListener('click', async () => {
  const response = await sendToContentScript({ type: 'CLEAR_DATA' });
  if (response.success) {
    ui.itemCount.textContent = '0';
    ui.statusText.textContent = 'Idle';
  }
});

// --- Initialization ---

async function init() {
  setupTabs();
  await syncUIWithConfig();
  bindSettingsListeners();

  // Poll for status
  updateDashboardStatus();
  setInterval(updateDashboardStatus, 1000);
}

init();
