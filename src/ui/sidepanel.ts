// Sidepanel script - Stitch UI Design
import type {
  ScraperMessage,
  ScraperResponse,
  PatternDetectorConfig,
  ScrollerConfig,
  ExtractionConfig,
  ExtractionField,
  ExtractedItem
} from '../types';

// State Interfaces
interface AppConfig {
  patternConfig: PatternDetectorConfig;
  scrollerConfig: ScrollerConfig;
  extractionConfig: ExtractionConfig;
}

interface HistoryEntry {
  id: string;
  taskName: string;
  status: 'completed' | 'failed' | 'running' | 'paused';
  itemsCollected: number;
  timestamp: Date;
  duration: number;
}

interface WizardData {
  taskName: string;
  targetUrl: string;
  description: string;
  frequency: string;
  maxItems: number;
  timeout: number;
  exportFormat: string;
  webhookUrl: string;
  autoExport: boolean;
}

interface WebhookConfig {
  url: string;
  onComplete: boolean;
  onFailure: boolean;
  includeData: boolean;
}

interface ScheduledTask {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'pending';
  frequency: string;
  lastRun: Date | null;
  nextRun: Date | null;
}

// Default Configuration
const DEFAULT_CONFIG: AppConfig = {
  patternConfig: {
    matchBy: ['tag', 'class'],
    minListItems: 3,
    allowSingleFallback: true,
    depthLimit: 12,
    simThreshold: 0.62
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

// UI Elements
const ui = {
  // Navigation
  tabs: document.querySelectorAll('.nav-item[data-tab]'),
  contents: document.querySelectorAll('.tab-pane'),

  // Dashboard
  mainActionBtn: document.getElementById('main-action-btn') as HTMLButtonElement,
  exportBtn: document.getElementById('export-btn') as HTMLButtonElement,
  clearLogBtn: document.getElementById('clear-log-btn') as HTMLButtonElement,
  createTaskBtn: document.getElementById('create-task-btn') as HTMLButtonElement,
  itemCount: document.getElementById('items-count') as HTMLSpanElement,
  itemsTrend: document.getElementById('items-trend') as HTMLSpanElement,
  totalTasks: document.getElementById('total-tasks') as HTMLSpanElement,
  tasksTrend: document.getElementById('tasks-trend') as HTMLSpanElement,
  successRate: document.getElementById('success-rate') as HTMLSpanElement,
  successTrend: document.getElementById('success-trend') as HTMLSpanElement,
  tasksTableBody: document.getElementById('tasks-table-body') as HTMLTableSectionElement,
  statusText: document.getElementById('status-text') as HTMLSpanElement,
  statusDot: document.getElementById('status-dot') as HTMLSpanElement,
  statusBadge: document.getElementById('status-badge') as HTMLDivElement,
  activityLog: document.getElementById('activity-log') as HTMLDivElement,

  // Match Settings
  matchTag: document.getElementById('match-tag') as HTMLInputElement,
  matchClass: document.getElementById('match-class') as HTMLInputElement,
  matchId: document.getElementById('match-id') as HTMLInputElement,
  matchData: document.getElementById('match-data') as HTMLInputElement,

  // Scroll Settings
  scrollSpeed: document.getElementById('scroll-speed') as HTMLInputElement,
  maxItems: document.getElementById('max-items') as HTMLInputElement,
  retryCount: document.getElementById('retry-count') as HTMLInputElement,

  // Extraction Settings
  fieldsList: document.getElementById('fields-list') as HTMLDivElement,
  addFieldBtn: document.getElementById('add-field-btn') as HTMLButtonElement,
  preserveHierarchy: document.getElementById('preserve-hierarchy') as HTMLInputElement,
  normalizeText: document.getElementById('normalize-text') as HTMLInputElement,

  // History Tab
  historyTableBody: document.getElementById('history-table-body') as HTMLTableSectionElement,
  historyPaginationInfo: document.getElementById('history-pagination-info') as HTMLSpanElement,
  historyPrevBtn: document.getElementById('history-prev-btn') as HTMLButtonElement,
  historyNextBtn: document.getElementById('history-next-btn') as HTMLButtonElement,
  clearHistoryBtn: document.getElementById('clear-history-btn') as HTMLButtonElement,

  // Webhooks
  webhookUrl: document.getElementById('webhook-url') as HTMLInputElement,
  webhookOnComplete: document.getElementById('webhook-on-complete') as HTMLInputElement,
  webhookOnFailure: document.getElementById('webhook-on-failure') as HTMLInputElement,
  webhookIncludeData: document.getElementById('webhook-include-data') as HTMLInputElement,
  testWebhookBtn: document.getElementById('test-webhook-btn') as HTMLButtonElement,

  // Wizard
  wizardOverlay: document.getElementById('wizard-overlay') as HTMLDivElement,
  wizardSteps: document.querySelectorAll('.wizard-step'),
  wizardStepContents: document.querySelectorAll('.wizard-step-content'),
  wizardPrevBtn: document.getElementById('wizard-prev-btn') as HTMLButtonElement,
  wizardNextBtn: document.getElementById('wizard-next-btn') as HTMLButtonElement,
  wizardCancelBtn: document.getElementById('wizard-cancel-btn') as HTMLButtonElement,

  // Wizard Fields
  wizardTaskName: document.getElementById('wizard-task-name') as HTMLInputElement,
  wizardTargetUrl: document.getElementById('wizard-target-url') as HTMLInputElement,
  wizardDescription: document.getElementById('wizard-description') as HTMLTextAreaElement,
  wizardFrequency: document.getElementById('wizard-frequency') as HTMLSelectElement,
  wizardMaxItems: document.getElementById('wizard-max-items') as HTMLInputElement,
  wizardTimeout: document.getElementById('wizard-timeout') as HTMLInputElement,
  wizardExportFormat: document.getElementById('wizard-export-format') as HTMLSelectElement,
  wizardWebhook: document.getElementById('wizard-webhook') as HTMLInputElement,
  wizardAutoExport: document.getElementById('wizard-auto-export') as HTMLInputElement,

  // Preview
  previewCards: document.getElementById('preview-cards') as HTMLDivElement,
  livePreviewContent: document.getElementById('live-preview-content') as HTMLDivElement,
  togglePreviewMode: document.getElementById('toggle-preview-mode') as HTMLButtonElement,
};

// State
let currentConfig: AppConfig;
let currentWizardStep = 1;
let history: HistoryEntry[] = [];
let historyPage = 0;
const historyPageSize = 5;
let activityLogs: { time: string; msg: string }[] = [];
let scheduledTasks: ScheduledTask[] = [];
let webhookConfig: WebhookConfig = {
  url: '',
  onComplete: false,
  onFailure: true,
  includeData: false,
};
let previewMode: 'cards' | 'json' = 'cards';
let previewItems: ExtractedItem[] = [];

// --- Utility Functions ---

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderPreviewCard(item: ExtractedItem): string {
  const imageUrl = (item.image as string) || '';
  const title = (item.title as string) || (item.linkText as string) || 'Untitled';
  const text = (item.text as string) || '';
  const link = (item.link as string) || '';
  const imageAlt = (item.imageAlt as string) || '';

  const imageSection = imageUrl
    ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" class="preview-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'"/>
       <div class="preview-img-placeholder" style="display: none;">
         <span class="material-symbols-outlined" style="font-size: 20px;">broken_image</span>
       </div>`
    : `<div class="preview-img-placeholder">
         <span class="material-symbols-outlined" style="font-size: 20px;">article</span>
       </div>`;

  const truncatedText = text.length > 100 ? text.substring(0, 100) + '...' : text;

  return `
    <div class="preview-card">
      ${imageSection}
      <div class="preview-content">
        <div class="preview-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
        ${truncatedText ? `<div class="preview-text">${escapeHtml(truncatedText)}</div>` : ''}
        ${link ? `<a href="${escapeHtml(link)}" class="preview-link" target="_blank" rel="noopener">View source →</a>` : ''}
      </div>
    </div>
  `;
}

function renderPreviewCards(items: ExtractedItem[]) {
  if (!ui.previewCards) return;

  if (items.length === 0) {
    ui.previewCards.innerHTML = `
      <div class="preview-empty">
        <span class="material-symbols-outlined" style="font-size: 32px; opacity: 0.3;">image</span>
        <span>Scraped items will appear here...</span>
      </div>
    `;
    return;
  }

  // Show last 5 items, most recent first
  const recentItems = items.slice(-5).reverse();
  ui.previewCards.innerHTML = recentItems.map(item => renderPreviewCard(item)).join('');
}

function togglePreviewMode() {
  if (previewMode === 'cards') {
    previewMode = 'json';
    ui.previewCards.style.display = 'none';
    ui.livePreviewContent.style.display = 'block';
    ui.togglePreviewMode.querySelector('.material-symbols-outlined')!.textContent = 'grid_view';
    ui.togglePreviewMode.title = 'Switch to card view';
    // Update JSON view
    if (previewItems.length > 0) {
      ui.livePreviewContent.textContent = JSON.stringify(previewItems.slice(-5), null, 2);
    }
  } else {
    previewMode = 'cards';
    ui.previewCards.style.display = 'flex';
    ui.livePreviewContent.style.display = 'none';
    ui.togglePreviewMode.querySelector('.material-symbols-outlined')!.textContent = 'view_list';
    ui.togglePreviewMode.title = 'Switch to JSON view';
    // Update cards view
    renderPreviewCards(previewItems);
  }
}

// Bind toggle button
ui.togglePreviewMode?.addEventListener('click', togglePreviewMode);

// --- Storage & Config ---

async function loadConfig(): Promise<AppConfig> {
  const result = await chrome.storage.local.get('scraperConfig');
  return { ...DEFAULT_CONFIG, ...result.scraperConfig };
}

async function saveConfig(config: AppConfig) {
  await chrome.storage.local.set({ scraperConfig: config });
  sendMessage({ type: 'UPDATE_CONFIG', payload: config });
}

async function loadHistory(): Promise<HistoryEntry[]> {
  const result = await chrome.storage.local.get('scraperHistory');
  return result.scraperHistory || [];
}

async function saveHistory(entries: HistoryEntry[]) {
  await chrome.storage.local.set({ scraperHistory: entries });
}

// --- Messaging ---

async function sendMessage(message: ScraperMessage): Promise<ScraperResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
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
      return { success: false, error: '' };
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id!, message, (response) => {
        if (chrome.runtime.lastError) {
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
      ui.tabs.forEach(t => t.classList.remove('active'));
      ui.contents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = (tab as HTMLElement).dataset.tab;
      document.getElementById(`tab-${targetId}`)?.classList.add('active');
    });
  });
}

// --- Settings Logic ---

async function syncUIWithConfig() {
  currentConfig = await loadConfig();

  // Match
  if (ui.matchTag) ui.matchTag.checked = currentConfig.patternConfig.matchBy.includes('tag');
  if (ui.matchClass) ui.matchClass.checked = currentConfig.patternConfig.matchBy.includes('class');
  if (ui.matchId) ui.matchId.checked = currentConfig.patternConfig.matchBy.includes('id');
  if (ui.matchData) ui.matchData.checked = currentConfig.patternConfig.matchBy.includes('data');

  // Scroll
  if (ui.scrollSpeed) ui.scrollSpeed.value = String(currentConfig.scrollerConfig.throttleMs);
  if (ui.maxItems) ui.maxItems.value = String(currentConfig.scrollerConfig.maxItems || 0);
  if (ui.retryCount) ui.retryCount.value = String(currentConfig.scrollerConfig.retryCount || 3);

  // Extraction
  if (ui.preserveHierarchy) ui.preserveHierarchy.checked = currentConfig.extractionConfig.preserveHierarchy || false;
  if (ui.normalizeText) ui.normalizeText.checked = currentConfig.extractionConfig.normalize !== false;
  if (ui.fieldsList) renderFields(currentConfig.extractionConfig.fields);
}

function bindSettingsListeners() {
  const updateConfig = () => {
    const matchBy: ('tag' | 'class' | 'id' | 'data')[] = [];
    if (ui.matchTag?.checked) matchBy.push('tag');
    if (ui.matchClass?.checked) matchBy.push('class');
    if (ui.matchId?.checked) matchBy.push('id');
    if (ui.matchData?.checked) matchBy.push('data');

    currentConfig.patternConfig.matchBy = matchBy;
    currentConfig.scrollerConfig.throttleMs = parseInt(ui.scrollSpeed?.value) || 1000;
    currentConfig.scrollerConfig.maxItems = parseInt(ui.maxItems?.value) || 0;
    currentConfig.scrollerConfig.retryCount = parseInt(ui.retryCount?.value) || 3;
    currentConfig.extractionConfig.preserveHierarchy = ui.preserveHierarchy?.checked || false;
    currentConfig.extractionConfig.normalize = ui.normalizeText?.checked !== false;

    saveConfig(currentConfig);
  };

  ui.matchTag?.addEventListener('change', updateConfig);
  ui.matchClass?.addEventListener('change', updateConfig);
  ui.matchId?.addEventListener('change', updateConfig);
  ui.matchData?.addEventListener('change', updateConfig);
  ui.scrollSpeed?.addEventListener('change', updateConfig);
  ui.maxItems?.addEventListener('change', updateConfig);
  ui.retryCount?.addEventListener('change', updateConfig);
  ui.preserveHierarchy?.addEventListener('change', updateConfig);
  ui.normalizeText?.addEventListener('change', updateConfig);
}

// --- Extraction Fields UI ---

function renderFields(fields: ExtractionField[]) {
  if (!ui.fieldsList) return;
  ui.fieldsList.innerHTML = '';

  if (fields.length === 0) {
    ui.fieldsList.innerHTML = '<div class="empty-placeholder">No custom fields defined</div>';
    return;
  }

  fields.forEach((field, index) => {
    const row = document.createElement('div');
    row.className = 'field-item';
    row.innerHTML = `
      <input type="text" class="field-name" value="${field.name}" placeholder="Name">
      <input type="text" class="field-selector" value="${field.selector}" placeholder="Selector">
      <button class="btn-icon-sm remove-btn" data-index="${index}" title="Remove">
        <span class="material-symbols-outlined" style="font-size: 14px;">close</span>
      </button>
    `;

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

// --- Activity Log ---

function addLogEntry(msg: string) {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  activityLogs.unshift({ time, msg });
  if (activityLogs.length > 20) activityLogs.pop();
  renderActivityLog();
}

function renderActivityLog() {
  if (!ui.activityLog) return;

  if (activityLogs.length === 0) {
    ui.activityLog.innerHTML = `
      <div class="log-item">
        <span class="time">--:--</span>
        <span class="msg">Waiting for activity...</span>
      </div>
    `;
    return;
  }

  ui.activityLog.innerHTML = activityLogs
    .slice(0, 5)
    .map(log => `
      <div class="log-item">
        <span class="time">${log.time}</span>
        <span class="msg">${log.msg}</span>
      </div>
    `)
    .join('');
}

ui.clearLogBtn?.addEventListener('click', () => {
  activityLogs = [];
  renderActivityLog();
});

// --- History Tab ---

async function loadAndRenderHistory() {
  history = await loadHistory();
  renderHistory();
}

function renderHistory() {
  if (!ui.historyTableBody) return;

  const start = historyPage * historyPageSize;
  const end = start + historyPageSize;
  const pageItems = history.slice(start, end);

  if (pageItems.length === 0) {
    ui.historyTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-placeholder">No history yet</td>
      </tr>
    `;
  } else {
    ui.historyTableBody.innerHTML = pageItems
      .map(entry => {
        const statusClass = `badge badge-${entry.status}`;
        const statusLabel = entry.status.charAt(0).toUpperCase() + entry.status.slice(1);
        const timeAgo = formatTimeAgo(new Date(entry.timestamp));

        return `
          <tr>
            <td>
              <div style="font-weight: 600;">${entry.taskName}</div>
              <div style="font-size: 10px; color: var(--text-muted);">ID: ${entry.id.slice(0, 8)}</div>
            </td>
            <td><span class="${statusClass}">${statusLabel}</span></td>
            <td>${entry.itemsCollected}</td>
            <td style="color: var(--text-muted);">${timeAgo}</td>
          </tr>
        `;
      })
      .join('');
  }

  // Update pagination
  const total = history.length;
  const showing = Math.min(end, total);
  ui.historyPaginationInfo.textContent = `Showing ${start + 1}-${showing} of ${total}`;
  ui.historyPrevBtn.disabled = historyPage === 0;
  ui.historyNextBtn.disabled = end >= total;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

ui.historyPrevBtn?.addEventListener('click', () => {
  if (historyPage > 0) {
    historyPage--;
    renderHistory();
  }
});

ui.historyNextBtn?.addEventListener('click', () => {
  if ((historyPage + 1) * historyPageSize < history.length) {
    historyPage++;
    renderHistory();
  }
});

ui.clearHistoryBtn?.addEventListener('click', async () => {
  history = [];
  historyPage = 0;
  await saveHistory(history);
  renderHistory();
});

// --- Scheduled Tasks ---

async function loadScheduledTasks(): Promise<ScheduledTask[]> {
  const result = await chrome.storage.local.get('scheduledTasks');
  return result.scheduledTasks || [];
}

async function saveScheduledTasks(tasks: ScheduledTask[]) {
  await chrome.storage.local.set({ scheduledTasks: tasks });
}

function renderScheduledTasks() {
  if (!ui.tasksTableBody) return;

  if (scheduledTasks.length === 0) {
    ui.tasksTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-placeholder">No scheduled tasks</td>
      </tr>
    `;
    return;
  }

  ui.tasksTableBody.innerHTML = scheduledTasks
    .slice(0, 5)
    .map(task => {
      const statusClass = `badge badge-${task.status}`;
      const statusLabel = task.status.charAt(0).toUpperCase() + task.status.slice(1);

      return `
        <tr>
          <td>
            <div style="font-weight: 600;">${task.name}</div>
            <div style="font-size: 10px; color: var(--color-text-muted);">ID: ${task.id.slice(0, 8)}</div>
          </td>
          <td><span class="${statusClass}">${statusLabel}</span></td>
          <td>${task.frequency}</td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn-icon-sm task-play" data-id="${task.id}" title="Run Now">
                <span class="material-symbols-outlined" style="font-size: 14px;">play_arrow</span>
              </button>
              <button class="btn-icon-sm task-pause" data-id="${task.id}" title="${task.status === 'paused' ? 'Resume' : 'Pause'}">
                <span class="material-symbols-outlined" style="font-size: 14px;">${task.status === 'paused' ? 'play_circle' : 'pause'}</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  // Add event listeners to task buttons
  ui.tasksTableBody.querySelectorAll('.task-play').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskId = (btn as HTMLElement).dataset.id;
      addLogEntry(`Started task: ${taskId?.slice(0, 8)}`);
    });
  });

  ui.tasksTableBody.querySelectorAll('.task-pause').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskId = (btn as HTMLElement).dataset.id;
      const task = scheduledTasks.find(t => t.id === taskId);
      if (task) {
        task.status = task.status === 'paused' ? 'active' : 'paused';
        await saveScheduledTasks(scheduledTasks);
        renderScheduledTasks();
        updateDashboardStats();
        addLogEntry(`${task.status === 'paused' ? 'Paused' : 'Resumed'} task: ${task.name}`);
      }
    });
  });
}

function updateDashboardStats() {
  // Update total tasks
  if (ui.totalTasks) {
    ui.totalTasks.textContent = String(scheduledTasks.length);
  }

  // Calculate success rate from history
  const completedTasks = history.filter(h => h.status === 'completed').length;
  const totalRuns = history.length;
  const rate = totalRuns > 0 ? Math.round((completedTasks / totalRuns) * 100) : 0;

  if (ui.successRate) {
    ui.successRate.textContent = `${rate}%`;
  }

  // Calculate total items collected
  const totalItems = history.reduce((sum, h) => sum + h.itemsCollected, 0);
  if (ui.itemCount) {
    ui.itemCount.textContent = String(totalItems);
  }
}

// --- Webhook Configuration ---

async function loadWebhookConfig(): Promise<WebhookConfig> {
  const result = await chrome.storage.local.get('webhookConfig');
  return result.webhookConfig || webhookConfig;
}

async function saveWebhookConfig(config: WebhookConfig) {
  await chrome.storage.local.set({ webhookConfig: config });
}

function syncWebhookUI() {
  if (ui.webhookUrl) ui.webhookUrl.value = webhookConfig.url;
  if (ui.webhookOnComplete) ui.webhookOnComplete.checked = webhookConfig.onComplete;
  if (ui.webhookOnFailure) ui.webhookOnFailure.checked = webhookConfig.onFailure;
  if (ui.webhookIncludeData) ui.webhookIncludeData.checked = webhookConfig.includeData;
}

function bindWebhookListeners() {
  const updateWebhookConfig = () => {
    webhookConfig = {
      url: ui.webhookUrl?.value || '',
      onComplete: ui.webhookOnComplete?.checked || false,
      onFailure: ui.webhookOnFailure?.checked || false,
      includeData: ui.webhookIncludeData?.checked || false,
    };
    saveWebhookConfig(webhookConfig);
  };

  ui.webhookUrl?.addEventListener('change', updateWebhookConfig);
  ui.webhookOnComplete?.addEventListener('change', updateWebhookConfig);
  ui.webhookOnFailure?.addEventListener('change', updateWebhookConfig);
  ui.webhookIncludeData?.addEventListener('change', updateWebhookConfig);

  ui.testWebhookBtn?.addEventListener('click', async () => {
    if (!webhookConfig.url) {
      addLogEntry('Webhook URL is empty');
      return;
    }

    try {
      const response = await fetch(webhookConfig.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'test',
          message: 'Webhook test from Scraper Pro',
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        addLogEntry('Webhook test successful');
      } else {
        addLogEntry(`Webhook test failed: ${response.status}`);
      }
    } catch (error: any) {
      addLogEntry(`Webhook error: ${error.message}`);
    }
  });
}

// --- Wizard ---

function openWizard() {
  currentWizardStep = 1;
  updateWizardUI();
  ui.wizardOverlay?.classList.add('active');

  // Reset form
  if (ui.wizardTaskName) ui.wizardTaskName.value = '';
  if (ui.wizardTargetUrl) ui.wizardTargetUrl.value = '';
  if (ui.wizardDescription) ui.wizardDescription.value = '';
  if (ui.wizardFrequency) ui.wizardFrequency.value = 'once';
  if (ui.wizardMaxItems) ui.wizardMaxItems.value = '100';
  if (ui.wizardTimeout) ui.wizardTimeout.value = '300';
  if (ui.wizardExportFormat) ui.wizardExportFormat.value = 'json';
  if (ui.wizardWebhook) ui.wizardWebhook.value = '';
  if (ui.wizardAutoExport) ui.wizardAutoExport.checked = false;
}

function closeWizard() {
  ui.wizardOverlay?.classList.remove('active');
}

function updateWizardUI() {
  // Update step indicators
  ui.wizardSteps.forEach((step, index) => {
    const stepNum = index + 1;
    step.classList.toggle('active', stepNum === currentWizardStep);
    step.classList.toggle('completed', stepNum < currentWizardStep);
  });

  // Update step content visibility
  ui.wizardStepContents.forEach((content, index) => {
    content.classList.toggle('active', index + 1 === currentWizardStep);
  });

  // Update buttons
  ui.wizardPrevBtn.style.display = currentWizardStep > 1 ? 'flex' : 'none';

  if (currentWizardStep === 3) {
    ui.wizardNextBtn.innerHTML = `
      <span class="material-symbols-outlined" style="font-size: 16px;">check</span>
      Create Task
    `;
  } else {
    ui.wizardNextBtn.innerHTML = `
      Next
      <span class="material-symbols-outlined" style="font-size: 16px;">arrow_forward</span>
    `;
  }
}

function getWizardData(): WizardData {
  return {
    taskName: ui.wizardTaskName?.value || 'Untitled Task',
    targetUrl: ui.wizardTargetUrl?.value || '',
    description: ui.wizardDescription?.value || '',
    frequency: ui.wizardFrequency?.value || 'once',
    maxItems: parseInt(ui.wizardMaxItems?.value) || 100,
    timeout: parseInt(ui.wizardTimeout?.value) || 300,
    exportFormat: ui.wizardExportFormat?.value || 'json',
    webhookUrl: ui.wizardWebhook?.value || '',
    autoExport: ui.wizardAutoExport?.checked || false,
  };
}

async function createTask() {
  const data = getWizardData();

  // Create scheduled task
  const task: ScheduledTask = {
    id: crypto.randomUUID(),
    name: data.taskName,
    status: 'active',
    frequency: data.frequency === 'once' ? 'Once' :
      data.frequency === 'hourly' ? 'Hourly' :
        data.frequency === 'daily' ? 'Daily' : 'Weekly',
    lastRun: null,
    nextRun: data.frequency === 'once' ? null : new Date(),
  };

  scheduledTasks.unshift(task);
  await saveScheduledTasks(scheduledTasks);

  // Create history entry
  const entry: HistoryEntry = {
    id: task.id,
    taskName: data.taskName,
    status: 'running',
    itemsCollected: 0,
    timestamp: new Date(),
    duration: 0,
  };

  history.unshift(entry);
  await saveHistory(history);

  // Update config
  currentConfig.scrollerConfig.maxItems = data.maxItems;
  await saveConfig(currentConfig);

  // Add log entry
  addLogEntry(`Created task: ${data.taskName}`);

  closeWizard();
  renderHistory();
  renderScheduledTasks();
  updateDashboardStats();
}

ui.createTaskBtn?.addEventListener('click', openWizard);
ui.wizardCancelBtn?.addEventListener('click', closeWizard);

ui.wizardPrevBtn?.addEventListener('click', () => {
  if (currentWizardStep > 1) {
    currentWizardStep--;
    updateWizardUI();
  }
});

ui.wizardNextBtn?.addEventListener('click', async () => {
  if (currentWizardStep < 3) {
    currentWizardStep++;
    updateWizardUI();
  } else {
    await createTask();
  }
});

// Close wizard when clicking outside
ui.wizardOverlay?.addEventListener('click', (e) => {
  if (e.target === ui.wizardOverlay) {
    closeWizard();
  }
});

// --- Dashboard Actions ---

async function updateDashboardStatus() {
  const response = await sendToContentScript({ type: 'GET_STATUS' });

  if (!response.success) {
    ui.itemCount.textContent = '0';
    ui.statusText.textContent = 'Ready';
    ui.statusDot?.classList.remove('running', 'paused', 'error');
    ui.statusDot?.classList.add('active');
    updateMainButton('idle');
    return;
  }

  if (response.data) {
    const data = response.data as {
      itemsCollected?: number;
      status?: string;
      pattern?: string;
    };

    // Note: itemCount is now updated via updateDashboardStats() from history

    const status = data.status || 'idle';
    ui.statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);

    // Update status dot
    ui.statusDot?.classList.remove('active', 'running', 'paused', 'error');
    if (status === 'running') {
      ui.statusDot?.classList.add('running');
    } else if (status === 'paused') {
      ui.statusDot?.classList.add('paused');
    } else if (status === 'error') {
      ui.statusDot?.classList.add('error');
    } else {
      ui.statusDot?.classList.add('active');
    }

    updateMainButton(status);
  }
}

function updateMainButton(status: string) {
  if (!ui.mainActionBtn) return;

  if (status === 'running') {
    ui.mainActionBtn.innerHTML = `
      <span class="material-symbols-outlined">pause</span>
      Pause Scanning
    `;
  } else if (status === 'paused') {
    ui.mainActionBtn.innerHTML = `
      <span class="material-symbols-outlined">play_arrow</span>
      Resume Scanning
    `;
  } else {
    ui.mainActionBtn.innerHTML = `
      <span class="material-symbols-outlined">play_arrow</span>
      Start Scanning
    `;
  }
}

ui.mainActionBtn?.addEventListener('click', async () => {
  const btnText = ui.mainActionBtn.textContent?.toLowerCase() || '';

  if (btnText.includes('start')) {
    ui.mainActionBtn.innerHTML = `
      <span class="material-symbols-outlined">hourglass_empty</span>
      Starting...
    `;
    await sendToContentScript({ type: 'START_SCRAPE' });
    addLogEntry('Started scanning');
  } else if (btnText.includes('pause')) {
    await sendToContentScript({ type: 'PAUSE_SCRAPE' });
    addLogEntry('Paused scanning');
  } else if (btnText.includes('resume')) {
    await sendToContentScript({ type: 'RESUME_SCRAPE' });
    addLogEntry('Resumed scanning');
  }

  setTimeout(updateDashboardStatus, 200);
});

ui.exportBtn?.addEventListener('click', async () => {
  const response = await sendToContentScript({ type: 'EXPORT_DATA' });
  if (response.success && response.data) {
    const data = response.data as any[];
    if (data.length === 0) {
      addLogEntry('Export failed: No data');
      return;
    }

    const formatSelector = document.getElementById('export-format-selector') as HTMLSelectElement;
    const format = formatSelector ? formatSelector.value : 'json';

    let content = '';
    let mimeType = 'application/json';
    let extension = 'json';

    if (format === 'csv' || format === 'excel') {
      // Convert to CSV
      const headers = Array.from(new Set(data.flatMap(Object.keys)));
      const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(fieldName => {
          const value = row[fieldName] || '';
          const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          // Escape quotes and wrap in quotes
          return `"${stringValue.replace(/"/g, '""')}"`;
        }).join(','))
      ].join('\n');

      if (format === 'excel') {
        // Add BOM for Excel UTF-8 support
        content = '\uFEFF' + csvContent;
        extension = 'csv'; // Using .csv for Excel is standard, or could use .xls (XML/HTML hack) but CSV is safer
      } else {
        content = csvContent;
        extension = 'csv';
      }
      mimeType = 'text/csv;charset=utf-8;';
    } else {
      content = JSON.stringify(data, null, 2);
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scrape-${new Date().toISOString().slice(0, 10)}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
    addLogEntry(`Exported ${data.length} items as ${format.toUpperCase()}`);
  } else {
    addLogEntry('Export failed');
  }
});

// --- Initialization ---

async function init() {
  setupTabs();
  await syncUIWithConfig();
  bindSettingsListeners();
  await loadAndRenderHistory();
  renderActivityLog();

  // Load and render scheduled tasks
  scheduledTasks = await loadScheduledTasks();
  renderScheduledTasks();
  updateDashboardStats();

  // Load and sync webhook config
  webhookConfig = await loadWebhookConfig();
  syncWebhookUI();
  bindWebhookListeners();

  // Poll for status
  updateDashboardStatus();
  setInterval(updateDashboardStatus, 1000);
}

init();

// --- Message Listener for Real-time Updates ---

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === 'UPDATE_STATUS') {
    const status = message.payload?.status || 'idle';
    if (ui.statusText) ui.statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);

    // Update status dot and button
    ui.statusDot?.classList.remove('active', 'running', 'paused', 'error');
    if (status === 'running') {
      ui.statusDot?.classList.add('running');
      updateMainButton('running');
    } else if (status === 'paused') {
      ui.statusDot?.classList.add('paused');
      updateMainButton('paused');
    } else if (status === 'error') {
      ui.statusDot?.classList.add('error');
      updateMainButton('idle');
    } else {
      ui.statusDot?.classList.add('active');
      updateMainButton('idle');
    }
  } else if (message.type === 'UPDATE_PROGRESS') {
    const { current } = message.payload || { current: 0 };
    if (ui.itemCount) {
      ui.itemCount.textContent = String(current);
    }
  } else if (message.type === 'SHOW_ERROR') {
    const errorMsg = message.payload?.message || 'Unknown error';
    addLogEntry(`Error: ${errorMsg}`);
    if (ui.statusText) ui.statusText.textContent = 'Error';
    ui.statusDot?.classList.remove('active', 'running', 'paused');
    ui.statusDot?.classList.add('error');
  } else if (message.type === 'UPDATE_PREVIEW') {
    const items = (message.payload?.items || []) as ExtractedItem[];
    if (items.length > 0) {
      previewItems = items;

      if (previewMode === 'cards') {
        renderPreviewCards(items);
      } else {
        ui.livePreviewContent.textContent = JSON.stringify(items.slice(-5), null, 2);
      }
    }
  }
});
