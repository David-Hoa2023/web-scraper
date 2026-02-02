// Sidepanel script - Stitch UI Design
import type {
  ScraperMessage,
  ScraperResponse,
  PatternDetectorConfig,
  ScrollerConfig,
  ExtractionConfig,
  ExtractionField,
  ExtractedItem,
  ArbitrageOpportunity,
  PlatformId,
  ScrapingTemplate,
} from '../types';

import { analyzeData } from '../export/dataAnalysis';
import { generateSlides, generateSlidesWithLLM, selectChartType } from '../visualization/chartSelector';
import { exportToPptx, exportToPdf } from '../visualization/presentationExporter';
import { loadLlmSettings as loadLlmSettingsFromStorage } from '../services/llmAnalysis';

// ==========================================
// WIRE TEST: Debug port connection (remove after fixing)
// ==========================================
console.log('[Sidepanel] boot', location.href);

const debugPort = chrome.runtime.connect({ name: 'sidepanel' });
console.log('[Sidepanel] port connected, waiting for SW_HELLO...');

debugPort.onMessage.addListener((msg) => {
  console.log('[Sidepanel] port msg:', msg);
});

debugPort.onDisconnect.addListener(() => {
  console.warn('[Sidepanel] port disconnected', chrome.runtime.lastError);
});

// Send a ping to verify bidirectional communication
debugPort.postMessage({ type: 'PING', ts: Date.now() });
// ==========================================

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
  urls: string[];          // NEW: Batch URLs
  description: string;
  frequency: string;
  maxItems: number;
  timeout: number;
  exportFormat: string;
  webhookUrl: string;
  autoExport: boolean;
  // NEW: Cron scheduling
  scheduleType: 'simple' | 'cron';
  cronTime: string;
  daysOfWeek: number[];
  daysOfMonth: number[];
  // NEW: Batch config
  batchContinueOnError: boolean;
  batchDelayMs: number;
  // NEW: Change detection
  changeDetectionEnabled: boolean;
  webhookOnChangeOnly: boolean;
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

interface SavedUrl {
  id: string;
  name: string;
  url: string;
  favicon?: string;
  addedAt: string;
  lastUsed?: string;
  useCount: number;
  tags?: string[];
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
    maxPages: 0,
    retryCount: 3,
    retryDelayMs: 2000,
    randomDelayMin: 500,
    randomDelayMax: 2000,
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
  // Extension Master Toggle
  extensionEnabled: document.getElementById('extension-enabled') as HTMLInputElement,
  extensionStatus: document.getElementById('extension-status') as HTMLSpanElement,

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

  // Scroll Settings (Match Strategy tab - legacy)
  scrollSpeed: document.getElementById('scroll-speed') as HTMLInputElement,
  maxItems: document.getElementById('max-items') as HTMLInputElement,
  maxPages: document.getElementById('max-pages') as HTMLInputElement,
  retryCount: document.getElementById('retry-count') as HTMLInputElement,

  // Anti-Ban Protection (Match Strategy tab - legacy)
  randomDelayMin: document.getElementById('random-delay-min') as HTMLInputElement,
  randomDelayMax: document.getElementById('random-delay-max') as HTMLInputElement,
  enableRandomDelay: document.getElementById('enable-random-delay') as HTMLInputElement,

  // Extraction Tab - Scraping Limits & Anti-Ban
  extractMaxItems: document.getElementById('extract-max-items') as HTMLInputElement,
  extractMaxPages: document.getElementById('extract-max-pages') as HTMLInputElement,
  extractRandomDelayMin: document.getElementById('extract-random-delay-min') as HTMLInputElement,
  extractRandomDelayMax: document.getElementById('extract-random-delay-max') as HTMLInputElement,
  extractEnableRandomDelay: document.getElementById('extract-enable-random-delay') as HTMLInputElement,

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
  wizardTargetUrls: document.getElementById('wizard-target-urls') as HTMLTextAreaElement,
  wizardDescription: document.getElementById('wizard-description') as HTMLTextAreaElement,
  wizardFrequency: document.getElementById('wizard-frequency') as HTMLSelectElement,
  wizardMaxItems: document.getElementById('wizard-max-items') as HTMLInputElement,
  wizardTimeout: document.getElementById('wizard-timeout') as HTMLInputElement,
  wizardExportFormat: document.getElementById('wizard-export-format') as HTMLSelectElement,
  wizardWebhook: document.getElementById('wizard-webhook') as HTMLInputElement,
  wizardAutoExport: document.getElementById('wizard-auto-export') as HTMLInputElement,
  // NEW: Batch options
  batchOptions: document.getElementById('batch-options') as HTMLDivElement,
  wizardContinueOnError: document.getElementById('wizard-continue-on-error') as HTMLInputElement,
  wizardBatchDelay: document.getElementById('wizard-batch-delay') as HTMLInputElement,
  // NEW: Cron scheduling
  cronTimeField: document.getElementById('cron-time-field') as HTMLDivElement,
  cronDaysField: document.getElementById('cron-days-field') as HTMLDivElement,
  cronMonthDaysField: document.getElementById('cron-month-days-field') as HTMLDivElement,
  wizardCronTime: document.getElementById('wizard-cron-time') as HTMLInputElement,
  wizardDaysGroup: document.getElementById('wizard-days-group') as HTMLDivElement,
  wizardMonthDays: document.getElementById('wizard-month-days') as HTMLInputElement,
  // NEW: Change detection
  wizardChangeDetection: document.getElementById('wizard-change-detection') as HTMLInputElement,
  wizardWebhookOnChange: document.getElementById('wizard-webhook-on-change') as HTMLInputElement,
  webhookOnChangeRow: document.getElementById('webhook-on-change-row') as HTMLDivElement,

  // Saved URLs
  savedUrlsList: document.getElementById('saved-urls-list') as HTMLDivElement,
  addCurrentUrlBtn: document.getElementById('add-current-url-btn') as HTMLButtonElement,
  wizardUrlSelect: document.getElementById('wizard-url-select') as HTMLSelectElement,

  // Templates
  templatesList: document.getElementById('templates-list') as HTMLDivElement,
  saveCurrentAsTemplateBtn: document.getElementById('save-current-as-template-btn') as HTMLButtonElement,
  templateSuggestionBanner: document.getElementById('template-suggestion-banner') as HTMLDivElement,
  templateSuggestionText: document.getElementById('template-suggestion-text') as HTMLParagraphElement,
  applySuggestedTemplateBtn: document.getElementById('apply-suggested-template-btn') as HTMLButtonElement,
  dismissTemplateSuggestionBtn: document.getElementById('dismiss-template-suggestion-btn') as HTMLButtonElement,

  // Preview
  previewCards: document.getElementById('preview-cards') as HTMLDivElement,
  livePreviewContent: document.getElementById('live-preview-content') as HTMLDivElement,
  togglePreviewMode: document.getElementById('toggle-preview-mode') as HTMLButtonElement,

  // Presentation
  generatePresentationBtn: document.getElementById('generate-presentation-btn') as HTMLButtonElement,

  // Export Progress
  exportProgressContainer: document.getElementById('export-progress-container') as HTMLDivElement,
  exportProgressBar: document.getElementById('export-progress-bar') as HTMLDivElement,
  exportProgressLabel: document.getElementById('export-progress-label') as HTMLSpanElement,
  exportProgressPercent: document.getElementById('export-progress-percent') as HTMLSpanElement,

  // Scraping Progress (Extraction Tab)
  scrapingProgressBar: document.getElementById('scraping-progress-bar') as HTMLDivElement,
  scrapingItemsCurrent: document.getElementById('scraping-items-current') as HTMLSpanElement,

  // LLM Settings
  llmProvider: document.getElementById('llm-provider') as HTMLSelectElement,
  llmApiKey: document.getElementById('llm-api-key') as HTMLInputElement,
  llmApiKeyGroup: document.getElementById('llm-api-key-group') as HTMLDivElement,
  llmModel: document.getElementById('llm-model') as HTMLSelectElement,
  llmModelGroup: document.getElementById('llm-model-group') as HTMLDivElement,
  saveLlmSettingsBtn: document.getElementById('save-llm-settings-btn') as HTMLButtonElement,
  testLlmBtn: document.getElementById('test-llm-btn') as HTMLButtonElement,
  toggleApiKeyVisibility: document.getElementById('toggle-api-key-visibility') as HTMLButtonElement,
  llmStatus: document.getElementById('llm-status') as HTMLDivElement,

  // AI Analysis
  analyzeWithAiBtn: document.getElementById('analyze-with-ai-btn') as HTMLButtonElement,
  aiAnalysisLoading: document.getElementById('ai-analysis-loading') as HTMLDivElement,
  aiAnalysisResults: document.getElementById('ai-analysis-results') as HTMLDivElement,
  aiSummaryText: document.getElementById('ai-summary-text') as HTMLParagraphElement,
  aiInsightsList: document.getElementById('ai-insights-list') as HTMLUListElement,
  aiRecommendationsList: document.getElementById('ai-recommendations-list') as HTMLUListElement,
  aiAnalysisError: document.getElementById('ai-analysis-error') as HTMLDivElement,
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
let extensionEnabled = true;
let savedUrls: SavedUrl[] = [];
let templates: ScrapingTemplate[] = [];
let suggestedTemplate: ScrapingTemplate | null = null;
let currentContainerSelector: string = '';

// LLM Settings
interface LlmSettings {
  provider: '' | 'openai' | 'anthropic' | 'gemini' | 'deepseek';
  apiKey: string;  // Current provider's API key (for backward compatibility)
  model: string;
  apiKeys: Record<string, string>;  // Per-provider API keys
}

let llmSettings: LlmSettings = {
  provider: '',
  apiKey: '',
  model: '',
  apiKeys: {},  // { openai: 'key1', anthropic: 'key2', ... }
};

const LLM_MODELS: Record<string, Array<{ value: string; label: string }>> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (Latest)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Faster)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo (Cheapest)' },
  ],
  anthropic: [
    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4.5 (Most Capable)' },
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Recommended)' },
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fastest)' },
  ],
  gemini: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Latest)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Most Capable)' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek Chat' },
    { value: 'deepseek-coder', label: 'DeepSeek Coder' },
  ],
};

const LLM_API_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
};

// --- Direct Download Function (Fallback) ---

async function downloadJsonDirect(filename: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2);

  // Try chrome.downloads API first
  try {
    const url = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
    const downloadId = await chrome.downloads.download({
      url,
      filename,
      saveAs: true,
    });
    console.log('[Sidepanel] Direct download started, id =', downloadId);
    return;
  } catch (err) {
    console.warn('[Sidepanel] chrome.downloads.download failed:', err);
  }

  // Fallback: Use <a download> (may work in some contexts)
  const blob = new Blob([json], { type: 'application/json' });
  const blobUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    console.log('[Sidepanel] Fallback <a> download triggered');
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  }
}

// --- Download Base64 Data ---

async function downloadBase64(filename: string, base64: string, mimeType: string): Promise<void> {
  console.log('[Sidepanel] downloadBase64 called:', filename, 'base64 length:', base64.length, 'mimeType:', mimeType);

  // Convert base64 to blob first (more reliable than data URLs for large files)
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);
  console.log('[Sidepanel] Created blob URL:', blobUrl.substring(0, 50) + '...');

  // Try chrome.downloads API with blob URL
  try {
    const downloadId = await chrome.downloads.download({
      url: blobUrl,
      filename,
      saveAs: true,
    });
    console.log('[Sidepanel] chrome.downloads started, id =', downloadId);
    // Revoke after a delay to allow download to start
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    return;
  } catch (err) {
    console.warn('[Sidepanel] chrome.downloads.download failed:', err);
  }

  // Fallback: Use <a download> element
  try {
    console.log('[Sidepanel] Trying <a download> fallback...');
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    console.log('[Sidepanel] Fallback <a download> triggered');
    // Revoke after a delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (fallbackErr) {
    console.error('[Sidepanel] Fallback download also failed:', fallbackErr);
    URL.revokeObjectURL(blobUrl);
    throw new Error('Download failed - please try again');
  }
}

// --- Export Progress Functions ---

function showExportProgress(label: string = 'Exporting...') {
  if (ui.exportProgressContainer) {
    ui.exportProgressContainer.style.display = 'block';
  }
  if (ui.exportProgressLabel) {
    ui.exportProgressLabel.textContent = label;
  }
  updateExportProgress(0);
}

function updateExportProgress(percent: number) {
  const clampedPercent = Math.min(100, Math.max(0, percent));
  if (ui.exportProgressBar) {
    ui.exportProgressBar.style.width = `${clampedPercent}%`;
  }
  if (ui.exportProgressPercent) {
    ui.exportProgressPercent.textContent = `${Math.round(clampedPercent)}%`;
  }
}

function hideExportProgress() {
  if (ui.exportProgressContainer) {
    ui.exportProgressContainer.style.display = 'none';
  }
  updateExportProgress(0);
}

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
  console.log('[Sidepanel] Saving config - Limits:', {
    maxItems: config.scrollerConfig.maxItems,
    maxPages: config.scrollerConfig.maxPages,
    throttleMs: config.scrollerConfig.throttleMs,
    randomDelay: `${config.scrollerConfig.randomDelayMin}-${config.scrollerConfig.randomDelayMax}ms`
  });
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

// Extension Enabled State
async function loadExtensionEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get('extensionEnabled');
  return result.extensionEnabled !== false; // Default to true
}

async function saveExtensionEnabled(enabled: boolean) {
  await chrome.storage.local.set({ extensionEnabled: enabled });
  // Notify content script
  sendToContentScript({
    type: 'SET_EXTENSION_ENABLED',
    payload: { enabled }
  });
}

function updateExtensionToggleUI(enabled: boolean) {
  if (ui.extensionEnabled) {
    ui.extensionEnabled.checked = enabled;
  }
  if (ui.extensionStatus) {
    ui.extensionStatus.textContent = enabled ? 'Active' : 'Disabled';
    ui.extensionStatus.classList.toggle('disabled', !enabled);
  }
}

function bindExtensionToggle() {
  ui.extensionEnabled?.addEventListener('change', async () => {
    extensionEnabled = ui.extensionEnabled.checked;
    await saveExtensionEnabled(extensionEnabled);
    updateExtensionToggleUI(extensionEnabled);
  });
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
  console.log('[Sidepanel] sendToContentScript:', message.type);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('[Sidepanel] Active tab:', tab?.id, tab?.url?.substring(0, 50));

    if (!tab?.id) {
      console.warn('[Sidepanel] No active tab found');
      return { success: false, error: 'No active tab' };
    }

    if (tab.url?.startsWith('chrome') || tab.url?.startsWith('edge')) {
      console.log('[Sidepanel] Skipping browser internal page');
      return { success: false, error: '' };
    }

    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id!, message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('[Sidepanel] sendMessage error:', chrome.runtime.lastError.message);
          resolve({ success: false, error: `Content script not ready: ${chrome.runtime.lastError.message}` });
          return;
        }
        console.log('[Sidepanel] Got response for', message.type, ':', response?.success);
        resolve(response || { success: false, error: 'No response from content script' });
      });
    });
  } catch (e: any) {
    console.error('[Sidepanel] sendToContentScript error:', e);
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

/**
 * Programmatically switch to a specific tab
 */
function switchToTab(tabName: string) {
  ui.tabs.forEach(t => t.classList.remove('active'));
  ui.contents.forEach(c => c.classList.remove('active'));

  const targetTab = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (targetTab) {
    targetTab.classList.add('active');
  }
  document.getElementById(`tab-${tabName}`)?.classList.add('active');
}

// --- Settings Logic ---

async function syncUIWithConfig() {
  currentConfig = await loadConfig();

  // Match
  if (ui.matchTag) ui.matchTag.checked = currentConfig.patternConfig.matchBy.includes('tag');
  if (ui.matchClass) ui.matchClass.checked = currentConfig.patternConfig.matchBy.includes('class');
  if (ui.matchId) ui.matchId.checked = currentConfig.patternConfig.matchBy.includes('id');
  if (ui.matchData) ui.matchData.checked = currentConfig.patternConfig.matchBy.includes('data');

  // Scroll (Match Strategy tab - legacy)
  if (ui.scrollSpeed) ui.scrollSpeed.value = String(currentConfig.scrollerConfig.throttleMs);
  if (ui.maxItems) ui.maxItems.value = String(currentConfig.scrollerConfig.maxItems || 0);
  if (ui.maxPages) ui.maxPages.value = String(currentConfig.scrollerConfig.maxPages || 0);
  if (ui.retryCount) ui.retryCount.value = String(currentConfig.scrollerConfig.retryCount || 3);

  // Anti-Ban Protection (Match Strategy tab - legacy)
  if (ui.randomDelayMin) ui.randomDelayMin.value = String(currentConfig.scrollerConfig.randomDelayMin || 500);
  if (ui.randomDelayMax) ui.randomDelayMax.value = String(currentConfig.scrollerConfig.randomDelayMax || 2000);
  if (ui.enableRandomDelay) {
    ui.enableRandomDelay.checked = (currentConfig.scrollerConfig.randomDelayMin ?? 0) > 0 ||
                                    (currentConfig.scrollerConfig.randomDelayMax ?? 0) > 0;
  }

  // Extraction Tab - Scraping Limits
  if (ui.extractMaxItems) ui.extractMaxItems.value = String(currentConfig.scrollerConfig.maxItems || 0);
  if (ui.extractMaxPages) ui.extractMaxPages.value = String(currentConfig.scrollerConfig.maxPages || 0);

  // Extraction Tab - Anti-Ban Protection
  if (ui.extractRandomDelayMin) ui.extractRandomDelayMin.value = String(currentConfig.scrollerConfig.randomDelayMin || 500);
  if (ui.extractRandomDelayMax) ui.extractRandomDelayMax.value = String(currentConfig.scrollerConfig.randomDelayMax || 2000);
  if (ui.extractEnableRandomDelay) {
    ui.extractEnableRandomDelay.checked = (currentConfig.scrollerConfig.randomDelayMin ?? 0) > 0 ||
                                           (currentConfig.scrollerConfig.randomDelayMax ?? 0) > 0;
  }

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
    currentConfig.scrollerConfig.retryCount = parseInt(ui.retryCount?.value) || 3;

    // Read from both tabs (Extraction tab takes precedence if both exist)
    const maxItemsValue = ui.extractMaxItems?.value || ui.maxItems?.value || '0';
    const maxPagesValue = ui.extractMaxPages?.value || ui.maxPages?.value || '0';
    currentConfig.scrollerConfig.maxItems = parseInt(maxItemsValue) || 0;
    currentConfig.scrollerConfig.maxPages = parseInt(maxPagesValue) || 0;

    // Anti-Ban Protection settings (Extraction tab takes precedence)
    const enableRandomDelay = ui.extractEnableRandomDelay?.checked ?? ui.enableRandomDelay?.checked ?? true;
    if (enableRandomDelay) {
      const minValue = ui.extractRandomDelayMin?.value || ui.randomDelayMin?.value || '500';
      const maxValue = ui.extractRandomDelayMax?.value || ui.randomDelayMax?.value || '2000';
      currentConfig.scrollerConfig.randomDelayMin = parseInt(minValue) || 500;
      currentConfig.scrollerConfig.randomDelayMax = parseInt(maxValue) || 2000;
    } else {
      currentConfig.scrollerConfig.randomDelayMin = 0;
      currentConfig.scrollerConfig.randomDelayMax = 0;
    }

    currentConfig.extractionConfig.preserveHierarchy = ui.preserveHierarchy?.checked || false;
    currentConfig.extractionConfig.normalize = ui.normalizeText?.checked !== false;

    saveConfig(currentConfig);
  };

  // Sync between tabs helper
  const syncExtractToMatch = () => {
    if (ui.maxItems && ui.extractMaxItems) ui.maxItems.value = ui.extractMaxItems.value;
    if (ui.maxPages && ui.extractMaxPages) ui.maxPages.value = ui.extractMaxPages.value;
    if (ui.randomDelayMin && ui.extractRandomDelayMin) ui.randomDelayMin.value = ui.extractRandomDelayMin.value;
    if (ui.randomDelayMax && ui.extractRandomDelayMax) ui.randomDelayMax.value = ui.extractRandomDelayMax.value;
    if (ui.enableRandomDelay && ui.extractEnableRandomDelay) ui.enableRandomDelay.checked = ui.extractEnableRandomDelay.checked;
  };

  const syncMatchToExtract = () => {
    if (ui.extractMaxItems && ui.maxItems) ui.extractMaxItems.value = ui.maxItems.value;
    if (ui.extractMaxPages && ui.maxPages) ui.extractMaxPages.value = ui.maxPages.value;
    if (ui.extractRandomDelayMin && ui.randomDelayMin) ui.extractRandomDelayMin.value = ui.randomDelayMin.value;
    if (ui.extractRandomDelayMax && ui.randomDelayMax) ui.extractRandomDelayMax.value = ui.randomDelayMax.value;
    if (ui.extractEnableRandomDelay && ui.enableRandomDelay) ui.extractEnableRandomDelay.checked = ui.enableRandomDelay.checked;
  };

  // Match Strategy tab listeners
  ui.matchTag?.addEventListener('change', updateConfig);
  ui.matchClass?.addEventListener('change', updateConfig);
  ui.matchId?.addEventListener('change', updateConfig);
  ui.matchData?.addEventListener('change', updateConfig);
  ui.scrollSpeed?.addEventListener('change', updateConfig);
  ui.maxItems?.addEventListener('change', () => { syncMatchToExtract(); updateConfig(); });
  ui.maxPages?.addEventListener('change', () => { syncMatchToExtract(); updateConfig(); });
  ui.retryCount?.addEventListener('change', updateConfig);
  ui.randomDelayMin?.addEventListener('change', () => { syncMatchToExtract(); updateConfig(); });
  ui.randomDelayMax?.addEventListener('change', () => { syncMatchToExtract(); updateConfig(); });
  ui.enableRandomDelay?.addEventListener('change', () => { syncMatchToExtract(); updateConfig(); });

  // Extraction tab listeners
  ui.extractMaxItems?.addEventListener('change', () => { syncExtractToMatch(); updateConfig(); });
  ui.extractMaxPages?.addEventListener('change', () => { syncExtractToMatch(); updateConfig(); });
  ui.extractRandomDelayMin?.addEventListener('change', () => { syncExtractToMatch(); updateConfig(); });
  ui.extractRandomDelayMax?.addEventListener('change', () => { syncExtractToMatch(); updateConfig(); });
  ui.extractEnableRandomDelay?.addEventListener('change', () => { syncExtractToMatch(); updateConfig(); });

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

// --- Saved URLs ---

async function loadSavedUrls(): Promise<SavedUrl[]> {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_SAVED_URLS',
  }) as ScraperResponse;

  if (response.success && response.data) {
    return response.data as SavedUrl[];
  }
  return [];
}

async function removeSavedUrl(id: string): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'REMOVE_SAVED_URL',
    payload: { id },
  });

  // Refresh the list
  savedUrls = await loadSavedUrls();
  renderSavedUrls();
  populateWizardUrlSelect();
}

function renderSavedUrls(): void {
  if (!ui.savedUrlsList) return;

  if (savedUrls.length === 0) {
    ui.savedUrlsList.innerHTML = `
      <div class="saved-url-empty" style="text-align: center; padding: 16px; color: var(--color-text-muted); font-size: 12px;">
        <span class="material-symbols-outlined" style="font-size: 24px; display: block; margin-bottom: 4px;">bookmark_border</span>
        No saved URLs yet. Right-click any page and select "Save to Scraping List".
      </div>
    `;
    return;
  }

  ui.savedUrlsList.innerHTML = savedUrls
    .slice(0, 10)
    .map(url => {
      const faviconHtml = url.favicon
        ? `<img src="${escapeHtml(url.favicon)}" width="16" height="16" style="border-radius: 2px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex'"/><span class="material-symbols-outlined" style="font-size: 16px; display: none;">language</span>`
        : `<span class="material-symbols-outlined" style="font-size: 16px;">language</span>`;

      const usedText = url.lastUsed
        ? `Used ${url.useCount}x`
        : 'Not used yet';

      return `
        <div class="saved-url-item" style="display: flex; align-items: center; gap: 8px; padding: 8px; border-bottom: 1px solid var(--color-border); cursor: pointer;" data-url="${escapeHtml(url.url)}" data-id="${url.id}">
          <div class="saved-url-favicon" style="flex-shrink: 0;">
            ${faviconHtml}
          </div>
          <div class="saved-url-info" style="flex: 1; min-width: 0;">
            <div class="saved-url-name" style="font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(url.name)}</div>
            <div class="saved-url-meta" style="font-size: 10px; color: var(--color-text-muted);">${usedText}</div>
          </div>
          <div class="saved-url-actions" style="display: flex; gap: 4px; flex-shrink: 0;">
            <button class="btn-icon-sm saved-url-use" title="Create task from URL" data-id="${url.id}" data-url="${escapeHtml(url.url)}" data-name="${escapeHtml(url.name)}">
              <span class="material-symbols-outlined" style="font-size: 14px;">add_task</span>
            </button>
            <button class="btn-icon-sm saved-url-remove" title="Remove" data-id="${url.id}">
              <span class="material-symbols-outlined" style="font-size: 14px;">close</span>
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  // Add event listeners
  ui.savedUrlsList.querySelectorAll('.saved-url-use').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const urlData = (btn as HTMLElement).dataset;
      if (urlData.url) {
        // Open wizard with this URL
        openWizard();
        if (ui.wizardTargetUrls) {
          ui.wizardTargetUrls.value = urlData.url;
        }
        if (ui.wizardTaskName && urlData.name) {
          ui.wizardTaskName.value = `Scrape: ${urlData.name}`;
        }
        // Update usage
        if (urlData.id) {
          chrome.runtime.sendMessage({
            type: 'UPDATE_SAVED_URL_USAGE',
            payload: { id: urlData.id },
          });
        }
      }
    });
  });

  ui.savedUrlsList.querySelectorAll('.saved-url-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.id;
      if (id) {
        removeSavedUrl(id);
        addLogEntry('Removed URL from saved list');
      }
    });
  });

  // Click on item to copy URL
  ui.savedUrlsList.querySelectorAll('.saved-url-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = (item as HTMLElement).dataset.url;
      if (url) {
        navigator.clipboard.writeText(url).then(() => {
          addLogEntry('URL copied to clipboard');
        }).catch(() => {
          addLogEntry('Failed to copy URL');
        });
      }
    });
  });
}

function populateWizardUrlSelect(): void {
  if (!ui.wizardUrlSelect) return;

  // Keep the default option and rebuild the rest
  ui.wizardUrlSelect.innerHTML = `
    <option value="">-- Select a saved URL (or enter manually below) --</option>
    ${savedUrls.map(url => `
      <option value="${escapeHtml(url.url)}" data-name="${escapeHtml(url.name)}">${escapeHtml(url.name)}</option>
    `).join('')}
  `;
}

function bindSavedUrlsListeners(): void {
  // URL select dropdown in wizard
  if (ui.wizardUrlSelect) {
    ui.wizardUrlSelect.addEventListener('change', () => {
      const selectedUrl = ui.wizardUrlSelect.value;
      if (selectedUrl && ui.wizardTargetUrls) {
        ui.wizardTargetUrls.value = selectedUrl;

        // Auto-fill task name from selected option's data attribute
        const selectedOption = ui.wizardUrlSelect.selectedOptions[0];
        const urlName = selectedOption?.dataset.name;
        if (urlName && ui.wizardTaskName) {
          ui.wizardTaskName.value = `Scrape: ${urlName}`;
        }

        // Find and update usage
        const savedUrl = savedUrls.find(u => u.url === selectedUrl);
        if (savedUrl) {
          chrome.runtime.sendMessage({
            type: 'UPDATE_SAVED_URL_USAGE',
            payload: { id: savedUrl.id },
          });
        }
      }
    });
  }

  // Add current page URL button
  if (ui.addCurrentUrlBtn) {
    ui.addCurrentUrlBtn.addEventListener('click', async () => {
      // Get current tab info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        const response = await chrome.runtime.sendMessage({
          type: 'ADD_SAVED_URL',
          payload: {
            url: tab.url,
            name: tab.title || new URL(tab.url).hostname,
            favicon: tab.favIconUrl,
          },
        }) as ScraperResponse;

        if (response.success) {
          addLogEntry(`Saved: ${tab.title || 'Current page'}`);
          // Refresh the list
          savedUrls = await loadSavedUrls();
          renderSavedUrls();
          populateWizardUrlSelect();
        }
      }
    });
  }
}

// --- Scraping Templates ---

async function loadTemplates(): Promise<ScrapingTemplate[]> {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_TEMPLATES',
  }) as ScraperResponse;

  if (response.success && response.data) {
    return response.data as ScrapingTemplate[];
  }
  return [];
}

async function saveCurrentAsTemplate(): Promise<void> {
  // Get current tab info for URL pattern
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    addLogEntry('Error: No active tab');
    return;
  }

  let hostname: string;
  let pathname: string;
  try {
    const url = new URL(tab.url);
    hostname = url.hostname;
    pathname = url.pathname;
  } catch {
    addLogEntry('Error: Invalid URL');
    return;
  }

  // If no container selector, request it from content script
  let containerSelector = currentContainerSelector;
  if (!containerSelector) {
    const selectorResponse = await sendToContentScript({
      type: 'GET_PATTERN_SELECTORS',
      payload: {},
    });

    if (selectorResponse.success && selectorResponse.data) {
      const selectors = selectorResponse.data as { selectors?: { fullItemSelector?: string }; itemCount?: number };
      containerSelector = selectors.selectors?.fullItemSelector || '';
      if (containerSelector) {
        currentContainerSelector = containerSelector;
        addLogEntry(`Pattern detected (${selectors.itemCount || 0} items)`);
      }
    }
  }

  // Validate we have a selector
  if (!containerSelector) {
    addLogEntry('Error: No pattern selected. Hover over a list and click to lock a pattern first.');
    alert('No pattern selected.\n\nHover over a list of items on the page and click to lock a pattern before saving a template.');
    return;
  }

  // Create URL pattern (escape special regex chars in pathname)
  const escapedPathname = pathname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const urlPattern = `https?://${hostname.replace(/\./g, '\\.')}${escapedPathname}.*`;

  // Prompt for template name
  const templateName = prompt('Enter a name for this template:', tab.title || hostname);
  if (!templateName) return;

  const templateData = {
    name: templateName,
    description: `Template for ${hostname}`,
    urlPattern,
    siteHostname: hostname,
    containerSelector,
    extractionConfig: currentConfig.extractionConfig,
    patternConfig: currentConfig.patternConfig,
    scrollerConfig: currentConfig.scrollerConfig,
  };

  const response = await chrome.runtime.sendMessage({
    type: 'SAVE_TEMPLATE',
    payload: templateData,
  }) as ScraperResponse;

  if (response.success) {
    addLogEntry(`Template saved: ${templateName}`);
    templates = await loadTemplates();
    renderTemplates();
  } else {
    addLogEntry(`Error saving template: ${response.error}`);
  }
}

async function deleteTemplate(id: string): Promise<void> {
  await chrome.runtime.sendMessage({
    type: 'DELETE_TEMPLATE',
    payload: { id },
  });

  templates = await loadTemplates();
  renderTemplates();
  addLogEntry('Template deleted');
}

async function applyTemplate(template: ScrapingTemplate): Promise<void> {
  // Update current config with template values
  currentConfig.extractionConfig = { ...template.extractionConfig };
  currentConfig.patternConfig = { ...template.patternConfig };
  if (template.scrollerConfig) {
    currentConfig.scrollerConfig = { ...template.scrollerConfig };
  }
  currentContainerSelector = template.containerSelector;

  // Save config to storage
  await saveConfig(currentConfig);

  // Update UI to reflect template config (reload from storage to sync)
  await syncUIWithConfig();

  // Send config to content script (await to ensure it's processed first)
  const configResult = await sendToContentScript({
    type: 'UPDATE_CONFIG',
    payload: currentConfig,
  });
  console.log('[Sidepanel] UPDATE_CONFIG result:', configResult);

  // Apply template to content script - this will find elements and highlight them
  console.log('[Sidepanel] Sending APPLY_TEMPLATE with selector:', template.containerSelector);
  const applyResult = await sendToContentScript({
    type: 'APPLY_TEMPLATE',
    payload: {
      containerSelector: template.containerSelector,
      extractionConfig: template.extractionConfig,
      patternConfig: template.patternConfig,
    },
  });
  console.log('[Sidepanel] APPLY_TEMPLATE result:', applyResult);

  if (applyResult?.success) {
    const data = applyResult.data as { itemCount?: number } | undefined;
    addLogEntry(`Applied template: ${template.name} (${data?.itemCount || 0} items found)`);
  } else {
    addLogEntry(`Applied template: ${template.name} (${applyResult?.error || 'no items found on page'})`);
  }

  // Mark template as used in storage
  await chrome.runtime.sendMessage({
    type: 'APPLY_TEMPLATE',
    payload: { id: template.id },
  });

  // Hide suggestion banner
  if (ui.templateSuggestionBanner) {
    ui.templateSuggestionBanner.style.display = 'none';
  }
  suggestedTemplate = null;

  // Switch to Extraction tab to continue workflow
  switchToTab('extract');
}

function renderTemplates(): void {
  if (!ui.templatesList) return;

  if (templates.length === 0) {
    ui.templatesList.innerHTML = `
      <div class="templates-empty" style="text-align: center; padding: 32px; color: var(--color-text-muted);">
        <span class="material-symbols-outlined" style="font-size: 48px; display: block; margin-bottom: 8px;">content_copy</span>
        <p style="margin-bottom: 8px;">No templates saved yet.</p>
        <p style="font-size: 12px;">Configure a scraping task and click "Save Current" to create a reusable template.</p>
      </div>
    `;
    return;
  }

  ui.templatesList.innerHTML = templates.map(template => {
    const lastUsed = template.lastUsedAt
      ? new Date(template.lastUsedAt).toLocaleDateString()
      : 'Never';

    return `
      <div class="template-item" style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; border-bottom: 1px solid var(--color-border);" data-id="${template.id}">
        <div class="template-icon" style="flex-shrink: 0; width: 40px; height: 40px; background: var(--color-bg-alt); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
          <span class="material-symbols-outlined" style="font-size: 20px; color: var(--color-accent);">language</span>
        </div>
        <div class="template-info" style="flex: 1; min-width: 0;">
          <div class="template-name" style="font-weight: 600; font-size: 14px; margin-bottom: 2px;">${escapeHtml(template.name)}</div>
          <div class="template-hostname" style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 4px;">${escapeHtml(template.siteHostname)}</div>
          <div class="template-meta" style="font-size: 11px; color: var(--color-text-muted);">
            Used ${template.useCount}x · Last: ${lastUsed}
          </div>
        </div>
        <div class="template-actions" style="display: flex; gap: 4px; flex-shrink: 0;">
          <button class="btn-icon-sm template-apply" title="Apply template" data-id="${template.id}">
            <span class="material-symbols-outlined" style="font-size: 16px;">play_arrow</span>
          </button>
          <button class="btn-icon-sm template-delete" title="Delete template" data-id="${template.id}">
            <span class="material-symbols-outlined" style="font-size: 16px;">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners
  ui.templatesList.querySelectorAll('.template-apply').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id;
      const template = templates.find(t => t.id === id);
      if (template) {
        applyTemplate(template);
      }
    });
  });

  ui.templatesList.querySelectorAll('.template-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id;
      if (id && confirm('Delete this template?')) {
        deleteTemplate(id);
      }
    });
  });
}

function showTemplateSuggestion(template: ScrapingTemplate): void {
  suggestedTemplate = template;

  if (ui.templateSuggestionBanner && ui.templateSuggestionText) {
    ui.templateSuggestionText.textContent = `"${template.name}" matches this page. Apply it to load your saved configuration.`;
    ui.templateSuggestionBanner.style.display = 'block';
  }
}

function bindTemplateListeners(): void {
  // Save current as template button
  if (ui.saveCurrentAsTemplateBtn) {
    ui.saveCurrentAsTemplateBtn.addEventListener('click', saveCurrentAsTemplate);
  }

  // Apply suggested template button
  if (ui.applySuggestedTemplateBtn) {
    ui.applySuggestedTemplateBtn.addEventListener('click', () => {
      if (suggestedTemplate) {
        applyTemplate(suggestedTemplate);
      }
    });
  }

  // Dismiss template suggestion button
  if (ui.dismissTemplateSuggestionBtn) {
    ui.dismissTemplateSuggestionBtn.addEventListener('click', () => {
      if (ui.templateSuggestionBanner) {
        ui.templateSuggestionBanner.style.display = 'none';
      }
      suggestedTemplate = null;
    });
  }
}

async function checkForMatchingTemplate(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  const response = await chrome.runtime.sendMessage({
    type: 'FIND_MATCHING_TEMPLATE',
    payload: { url: tab.url },
  }) as ScraperResponse;

  if (response.success && response.data) {
    const template = response.data as ScrapingTemplate;
    // Only show suggestion if auto-apply is not enabled
    if (!template.autoApply) {
      showTemplateSuggestion(template);
    } else {
      // Auto-apply the template
      applyTemplate(template);
    }
  }
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

// --- LLM Settings ---

async function loadLlmSettings(): Promise<LlmSettings> {
  const result = await chrome.storage.local.get('llmSettings');
  const stored = result.llmSettings || { provider: '', apiKey: '', model: '' };

  // Migrate old format (single apiKey) to new format (apiKeys per provider)
  if (!stored.apiKeys) {
    stored.apiKeys = {};
    // If there's an old apiKey and provider, migrate it
    if (stored.apiKey && stored.provider) {
      stored.apiKeys[stored.provider] = stored.apiKey;
    }
  }

  // Set current apiKey based on selected provider
  if (stored.provider && stored.apiKeys[stored.provider]) {
    stored.apiKey = stored.apiKeys[stored.provider];
  }

  return stored;
}

async function saveLlmSettings(settings: LlmSettings): Promise<void> {
  // Save current API key to the apiKeys object for the current provider
  if (settings.provider && settings.apiKey) {
    settings.apiKeys[settings.provider] = settings.apiKey;
  }
  await chrome.storage.local.set({ llmSettings: settings });
}

function syncLlmUI() {
  if (ui.llmProvider) ui.llmProvider.value = llmSettings.provider;
  if (ui.llmApiKey) ui.llmApiKey.value = llmSettings.apiKey;

  // Update model dropdown
  updateLlmModelOptions(llmSettings.provider);

  if (ui.llmModel && llmSettings.model) {
    ui.llmModel.value = llmSettings.model;
  }

  // Show/hide API key and model groups based on provider
  const hasProvider = !!llmSettings.provider;
  if (ui.llmApiKeyGroup) {
    ui.llmApiKeyGroup.style.display = hasProvider ? 'block' : 'none';
  }
  if (ui.llmModelGroup) {
    ui.llmModelGroup.style.display = hasProvider ? 'block' : 'none';
  }
}

function updateLlmModelOptions(provider: string) {
  if (!ui.llmModel) return;

  ui.llmModel.innerHTML = '';

  if (!provider || !LLM_MODELS[provider]) {
    return;
  }

  const models = LLM_MODELS[provider];
  for (const model of models) {
    const option = document.createElement('option');
    option.value = model.value;
    option.textContent = model.label;
    ui.llmModel.appendChild(option);
  }

  // Set default model
  if (models.length > 0) {
    ui.llmModel.value = models[0].value;
  }
}

function showLlmStatus(message: string, type: 'success' | 'error' | 'info') {
  if (!ui.llmStatus) return;

  ui.llmStatus.style.display = 'block';
  ui.llmStatus.textContent = message;
  ui.llmStatus.style.color = type === 'success' ? 'var(--color-success)' :
                             type === 'error' ? 'var(--color-error)' :
                             'var(--color-text-muted)';

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (ui.llmStatus) ui.llmStatus.style.display = 'none';
  }, 5000);
}

async function testLlmConnection(): Promise<boolean> {
  if (!llmSettings.provider || !llmSettings.apiKey) {
    showLlmStatus('Please select a provider and enter an API key', 'error');
    return false;
  }

  showLlmStatus('Testing connection...', 'info');

  try {
    const provider = llmSettings.provider;
    const apiKey = llmSettings.apiKey;
    const model = llmSettings.model || LLM_MODELS[provider]?.[0]?.value || '';

    let response: Response;

    if (provider === 'openai' || provider === 'deepseek') {
      const endpoint = LLM_API_ENDPOINTS[provider];
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
      });
    } else if (provider === 'anthropic') {
      response = await fetch(LLM_API_ENDPOINTS.anthropic, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
      });
    } else if (provider === 'gemini') {
      const endpoint = `${LLM_API_ENDPOINTS.gemini}/${model}:generateContent?key=${apiKey}`;
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hi' }] }],
        }),
      });
    } else {
      showLlmStatus('Unknown provider', 'error');
      return false;
    }

    if (response.ok) {
      showLlmStatus('Connection successful!', 'success');
      return true;
    } else {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `HTTP ${response.status}`;
      showLlmStatus(`Connection failed: ${errorMsg}`, 'error');
      return false;
    }
  } catch (error: any) {
    showLlmStatus(`Connection error: ${error.message}`, 'error');
    return false;
  }
}

function bindLlmSettingsListeners() {
  // Provider change - update model options and switch API keys
  ui.llmProvider?.addEventListener('change', () => {
    const oldProvider = llmSettings.provider;
    const newProvider = ui.llmProvider.value as LlmSettings['provider'];

    // Save current API key to the old provider before switching
    if (oldProvider && ui.llmApiKey?.value) {
      llmSettings.apiKeys[oldProvider] = ui.llmApiKey.value;
    }

    llmSettings.provider = newProvider;

    // Load API key for the new provider (or empty if not saved)
    const newApiKey = newProvider ? (llmSettings.apiKeys[newProvider] || '') : '';
    llmSettings.apiKey = newApiKey;
    if (ui.llmApiKey) {
      ui.llmApiKey.value = newApiKey;
    }

    updateLlmModelOptions(newProvider);

    // Show/hide API key and model groups
    const hasProvider = !!newProvider;
    if (ui.llmApiKeyGroup) {
      ui.llmApiKeyGroup.style.display = hasProvider ? 'block' : 'none';
    }
    if (ui.llmModelGroup) {
      ui.llmModelGroup.style.display = hasProvider ? 'block' : 'none';
    }

    // Set default model for the new provider
    if (newProvider && LLM_MODELS[newProvider]?.length > 0) {
      llmSettings.model = LLM_MODELS[newProvider][0].value;
      if (ui.llmModel) {
        ui.llmModel.value = llmSettings.model;
      }
    } else {
      llmSettings.model = '';
    }
  });

  // Model change
  ui.llmModel?.addEventListener('change', () => {
    llmSettings.model = ui.llmModel.value;
  });

  // API key change
  ui.llmApiKey?.addEventListener('input', () => {
    llmSettings.apiKey = ui.llmApiKey.value;
  });

  // Toggle API key visibility
  ui.toggleApiKeyVisibility?.addEventListener('click', () => {
    if (!ui.llmApiKey) return;

    const isPassword = ui.llmApiKey.type === 'password';
    ui.llmApiKey.type = isPassword ? 'text' : 'password';

    const icon = ui.toggleApiKeyVisibility.querySelector('.material-symbols-outlined');
    if (icon) {
      icon.textContent = isPassword ? 'visibility_off' : 'visibility';
    }
  });

  // Save button
  ui.saveLlmSettingsBtn?.addEventListener('click', async () => {
    llmSettings.apiKey = ui.llmApiKey?.value || '';
    llmSettings.model = ui.llmModel?.value || '';

    await saveLlmSettings(llmSettings);
    showLlmStatus('Settings saved!', 'success');
    addLogEntry(`LLM settings saved: ${llmSettings.provider || 'disabled'}`);
  });

  // Test button
  ui.testLlmBtn?.addEventListener('click', async () => {
    llmSettings.apiKey = ui.llmApiKey?.value || '';
    llmSettings.model = ui.llmModel?.value || '';

    await testLlmConnection();
  });

  // AI Analysis button
  ui.analyzeWithAiBtn?.addEventListener('click', async () => {
    await runAiAnalysis();
  });
}

// --- AI Analysis ---

async function runAiAnalysis() {
  // Get scraped data from state
  const data = getScrapedData();

  if (!data || data.length === 0) {
    showAiAnalysisError('No data to analyze. Please scrape some data first.');
    return;
  }

  // Check if LLM is configured
  if (!llmSettings.provider || !llmSettings.apiKey) {
    showAiAnalysisError('AI provider not configured. Please configure an LLM provider in Settings tab.');
    return;
  }

  // Show loading state
  ui.analyzeWithAiBtn.disabled = true;
  ui.aiAnalysisLoading.style.display = 'block';
  ui.aiAnalysisResults.style.display = 'none';
  ui.aiAnalysisError.style.display = 'none';

  addLogEntry('Starting AI analysis...');

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE_WITH_LLM',
      payload: { items: data },
    });

    console.log('[Sidepanel] ANALYZE_WITH_LLM response:', response);

    if (response.success && response.data) {
      showAiAnalysisResults(response.data);
      addLogEntry('AI analysis completed successfully');
    } else {
      showAiAnalysisError(response.error || 'Analysis failed');
      addLogEntry(`AI analysis failed: ${response.error}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    showAiAnalysisError(errorMsg);
    addLogEntry(`AI analysis error: ${errorMsg}`);
  } finally {
    ui.analyzeWithAiBtn.disabled = false;
    ui.aiAnalysisLoading.style.display = 'none';
  }
}

function showAiAnalysisResults(data: { insights: string[]; recommendations: string[]; summary: string }) {
  // Show results container
  ui.aiAnalysisResults.style.display = 'block';
  ui.aiAnalysisError.style.display = 'none';

  // Populate summary
  ui.aiSummaryText.textContent = data.summary || 'No summary available.';

  // Populate insights
  ui.aiInsightsList.innerHTML = '';
  if (data.insights && data.insights.length > 0) {
    data.insights.forEach(insight => {
      const li = document.createElement('li');
      li.textContent = insight;
      ui.aiInsightsList.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = 'No insights available.';
    li.style.color = 'var(--color-text-muted)';
    ui.aiInsightsList.appendChild(li);
  }

  // Populate recommendations
  ui.aiRecommendationsList.innerHTML = '';
  if (data.recommendations && data.recommendations.length > 0) {
    data.recommendations.forEach(rec => {
      const li = document.createElement('li');
      li.textContent = rec;
      ui.aiRecommendationsList.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = 'No recommendations available.';
    li.style.color = 'var(--color-text-muted)';
    ui.aiRecommendationsList.appendChild(li);
  }
}

function showAiAnalysisError(message: string) {
  ui.aiAnalysisResults.style.display = 'none';
  ui.aiAnalysisError.style.display = 'block';
  ui.aiAnalysisError.textContent = message;
}

function getScrapedData(): ExtractedItem[] {
  // Get data from preview items or make a request to get current data
  if (previewItems && previewItems.length > 0) {
    return previewItems;
  }
  return [];
}

// --- Wizard ---

function openWizard() {
  currentWizardStep = 1;
  updateWizardUI();
  ui.wizardOverlay?.classList.add('active');

  // Reset form
  if (ui.wizardTaskName) ui.wizardTaskName.value = '';
  if (ui.wizardTargetUrls) ui.wizardTargetUrls.value = '';
  if (ui.wizardDescription) ui.wizardDescription.value = '';
  if (ui.wizardFrequency) ui.wizardFrequency.value = 'once';
  if (ui.wizardMaxItems) ui.wizardMaxItems.value = '100';
  if (ui.wizardTimeout) ui.wizardTimeout.value = '300';
  if (ui.wizardExportFormat) ui.wizardExportFormat.value = 'json';
  if (ui.wizardWebhook) ui.wizardWebhook.value = '';
  if (ui.wizardAutoExport) ui.wizardAutoExport.checked = false;

  // Reset new fields
  if (ui.batchOptions) ui.batchOptions.style.display = 'none';
  if (ui.wizardContinueOnError) ui.wizardContinueOnError.checked = true;
  if (ui.wizardBatchDelay) ui.wizardBatchDelay.value = '2000';
  if (ui.cronTimeField) ui.cronTimeField.style.display = 'none';
  if (ui.cronDaysField) ui.cronDaysField.style.display = 'none';
  if (ui.cronMonthDaysField) ui.cronMonthDaysField.style.display = 'none';
  if (ui.wizardCronTime) ui.wizardCronTime.value = '09:00';
  if (ui.wizardMonthDays) ui.wizardMonthDays.value = '';
  if (ui.wizardChangeDetection) ui.wizardChangeDetection.checked = false;
  if (ui.wizardWebhookOnChange) ui.wizardWebhookOnChange.checked = false;
  if (ui.webhookOnChangeRow) ui.webhookOnChangeRow.style.display = 'none';

  // Reset day checkboxes
  if (ui.wizardDaysGroup) {
    ui.wizardDaysGroup.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      (cb as HTMLInputElement).checked = false;
    });
  }
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
  // Parse URLs from textarea
  const urlsText = ui.wizardTargetUrls?.value || '';
  const urls = urlsText
    .split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0 && url.startsWith('http'));

  // Parse days of week from checkboxes
  const daysOfWeek: number[] = [];
  if (ui.wizardDaysGroup) {
    ui.wizardDaysGroup.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => {
      daysOfWeek.push(parseInt((cb as HTMLInputElement).value));
    });
  }

  // Parse days of month from input
  const monthDaysText = ui.wizardMonthDays?.value || '';
  const daysOfMonth = monthDaysText
    .split(',')
    .map(d => parseInt(d.trim()))
    .filter(d => !isNaN(d) && d >= 1 && d <= 31);

  const frequency = ui.wizardFrequency?.value || 'once';
  const hasCronConfig = frequency !== 'once' && frequency !== 'hourly';

  return {
    taskName: ui.wizardTaskName?.value || 'Untitled Task',
    targetUrl: urls[0] || '',
    urls,
    description: ui.wizardDescription?.value || '',
    frequency,
    maxItems: parseInt(ui.wizardMaxItems?.value) || 100,
    timeout: parseInt(ui.wizardTimeout?.value) || 300,
    exportFormat: ui.wizardExportFormat?.value || 'json',
    webhookUrl: ui.wizardWebhook?.value || '',
    autoExport: ui.wizardAutoExport?.checked || false,
    // Cron scheduling
    scheduleType: hasCronConfig ? 'cron' : 'simple',
    cronTime: ui.wizardCronTime?.value || '09:00',
    daysOfWeek,
    daysOfMonth,
    // Batch config
    batchContinueOnError: ui.wizardContinueOnError?.checked ?? true,
    batchDelayMs: parseInt(ui.wizardBatchDelay?.value) || 2000,
    // Change detection
    changeDetectionEnabled: ui.wizardChangeDetection?.checked || false,
    webhookOnChangeOnly: ui.wizardWebhookOnChange?.checked || false,
  };
}

async function createTask() {
  const data = getWizardData();

  // Build the full task object for service worker
  const fullTask = {
    id: crypto.randomUUID(),
    name: data.taskName,
    url: data.targetUrl,
    urls: data.urls.length > 1 ? data.urls : undefined,
    description: data.description || undefined,
    frequency: data.frequency === 'once' ? 'daily' : data.frequency, // Map once to daily for storage
    maxItems: data.maxItems,
    timeout: data.timeout,
    format: data.exportFormat as 'json' | 'csv',
    webhookUrl: data.webhookUrl || undefined,
    autoExport: data.autoExport,
    enabled: data.frequency !== 'once', // Only enable scheduling for recurring tasks
    status: 'idle' as const,
    // Cron scheduling
    scheduleType: data.scheduleType,
    cronConfig: data.scheduleType === 'cron' ? {
      time: data.cronTime,
      dayOfWeek: data.daysOfWeek.length > 0 ? data.daysOfWeek : undefined,
      dayOfMonth: data.daysOfMonth.length > 0 ? data.daysOfMonth : undefined,
    } : undefined,
    // Batch config
    batchConfig: data.urls.length > 1 ? {
      delayBetweenMs: data.batchDelayMs,
      continueOnError: data.batchContinueOnError,
      aggregateResults: true,
    } : undefined,
    // Change detection
    changeDetection: data.changeDetectionEnabled ? {
      enabled: true,
      webhookOnChangeOnly: data.webhookOnChangeOnly,
      trackFieldChanges: false,
    } : undefined,
  };

  // Create scheduled task for UI display
  const task: ScheduledTask = {
    id: fullTask.id,
    name: data.taskName,
    status: 'active',
    frequency: data.frequency === 'once' ? 'Once' :
      data.frequency === 'hourly' ? 'Hourly' :
        data.frequency === 'daily' ? 'Daily' :
          data.frequency === 'weekly' ? 'Weekly' : 'Monthly',
    lastRun: null,
    nextRun: data.frequency === 'once' ? null : new Date(),
  };

  scheduledTasks.unshift(task);
  await saveScheduledTasks(scheduledTasks);

  // Save full task to service worker storage
  const existingTasks = await chrome.storage.local.get('scheduled-tasks');
  const tasks = existingTasks['scheduled-tasks'] || [];
  tasks.unshift(fullTask);
  await chrome.storage.local.set({ 'scheduled-tasks': tasks });

  // Schedule the task if it's recurring
  if (data.frequency !== 'once') {
    await sendMessage({ type: 'SCHEDULE_TASK', payload: fullTask });
  }

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
  const batchInfo = data.urls.length > 1 ? ` (${data.urls.length} URLs)` : '';
  const cronInfo = data.scheduleType === 'cron' ? ` at ${data.cronTime}` : '';
  addLogEntry(`Created task: ${data.taskName}${batchInfo}${cronInfo}`);

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

// --- NEW: Wizard Field Event Listeners ---

// Frequency change - show/hide cron fields
ui.wizardFrequency?.addEventListener('change', () => {
  const frequency = ui.wizardFrequency.value;

  // Show time picker for daily, weekly, monthly
  const showTime = ['daily', 'weekly', 'monthly'].includes(frequency);
  if (ui.cronTimeField) ui.cronTimeField.style.display = showTime ? 'block' : 'none';

  // Show day of week for weekly
  if (ui.cronDaysField) ui.cronDaysField.style.display = frequency === 'weekly' ? 'block' : 'none';

  // Show day of month for monthly
  if (ui.cronMonthDaysField) ui.cronMonthDaysField.style.display = frequency === 'monthly' ? 'block' : 'none';
});

// URL textarea change - show/hide batch options
ui.wizardTargetUrls?.addEventListener('input', () => {
  const urlsText = ui.wizardTargetUrls.value;
  const urls = urlsText
    .split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0 && url.startsWith('http'));

  const hasMultipleUrls = urls.length > 1;
  if (ui.batchOptions) ui.batchOptions.style.display = hasMultipleUrls ? 'block' : 'none';
});

// Change detection toggle - show/hide webhook-on-change row
ui.wizardChangeDetection?.addEventListener('change', () => {
  const enabled = ui.wizardChangeDetection.checked;
  if (ui.webhookOnChangeRow) ui.webhookOnChangeRow.style.display = enabled ? 'flex' : 'none';
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

// Export button click handler function
async function handleExportClick() {
  console.log('[Sidepanel] Export button clicked - handler started');
  addLogEntry('Starting export...');

  const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
  if (exportBtn) exportBtn.disabled = true;

  try {
    // Show progress bar
    showExportProgress('Preparing data...');
    updateExportProgress(10);

    const response = await sendToContentScript({ type: 'EXPORT_DATA' });
    console.log('[Sidepanel] EXPORT_DATA response:', response);
    updateExportProgress(30);

    if (!response) {
      throw new Error('No response from content script');
    }

    if (!response.success) {
      throw new Error(response.error || 'Export failed - content script error');
    }

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Export response missing data array');
    }

    const data = response.data as ExtractedItem[];
    console.log('[Sidepanel] Got', data.length, 'items to export');

    if (data.length === 0) {
      addLogEntry('Export failed: No data');
      hideExportProgress();
      if (exportBtn) exportBtn.disabled = false;
      return;
    }

    const formatSelector = document.getElementById('export-format-selector') as HTMLSelectElement;
    const format = formatSelector ? formatSelector.value : 'json';
    console.log('[Sidepanel] Export format:', format);
    const dateStr = new Date().toISOString().slice(0, 10);

    // Update progress label based on format
    const formatLabels: Record<string, string> = {
      excel: 'Generating Excel file...',
      csv: 'Generating CSV file...',
      json: 'Generating JSON file...',
    };
    showExportProgress(formatLabels[format] || 'Exporting...');
    updateExportProgress(50);

    if (format === 'excel') {
      // Use ExcelJS via service worker for proper .xlsx export
      console.log('[Sidepanel] Starting Excel export with', data.length, 'items');
      addLogEntry('Generating Excel file...');
      updateExportProgress(60);
      const excelFilename = `scrape-${dateStr}.xlsx`;

      try {
        console.log('[Sidepanel] Sending EXPORT_EXCEL to service worker...');
        const excelResponse = await chrome.runtime.sendMessage({
          type: 'EXPORT_EXCEL',
          payload: {
            items: data,
            options: {
              filename: excelFilename,
              includeAnalysis: true,
            },
          },
        });

        console.log('[Sidepanel] EXPORT_EXCEL response:', excelResponse);

        if (!excelResponse) {
          throw new Error('No response from service worker');
        }

        if (excelResponse.success && excelResponse.data?.base64) {
          updateExportProgress(80);
          addLogEntry('Downloading Excel file...');
          console.log('[Sidepanel] Calling downloadBase64...');
          // Download from sidepanel using base64 data
          await downloadBase64(
            excelResponse.data.filename || excelFilename,
            excelResponse.data.base64,
            excelResponse.data.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          );
          updateExportProgress(100);
          addLogEntry(`Exported ${excelResponse.data.rowCount} items to Excel with analysis`);
          console.log('[Sidepanel] Excel export completed successfully');
        } else {
          const errorMsg = excelResponse?.error || 'Unknown error - no base64 data';
          console.error('[Sidepanel] Excel export failed:', errorMsg);
          addLogEntry(`Excel export failed: ${errorMsg}`);
        }
      } catch (excelError: any) {
        console.error('[Sidepanel] Excel export error:', excelError);
        addLogEntry(`Excel export error: ${excelError.message}`);
      }
    } else if (format === 'csv') {
      // Use CSV export via service worker
      updateExportProgress(60);
      const csvFilename = `scrape-${dateStr}.csv`;
      const csvResponse = await chrome.runtime.sendMessage({
        type: 'EXPORT_CSV',
        payload: {
          items: data,
          filename: csvFilename,
        },
      });

      console.log('[Sidepanel] EXPORT_CSV response:', csvResponse);

      if (csvResponse.success && csvResponse.data.base64) {
        updateExportProgress(80);
        // Download from sidepanel using base64 data
        await downloadBase64(
          csvResponse.data.filename || csvFilename,
          csvResponse.data.base64,
          'text/csv'
        );
        updateExportProgress(100);
        addLogEntry(`Exported ${csvResponse.data.rowCount} items as CSV`);
      } else if (csvResponse.success) {
        // Old format (download handled by SW)
        updateExportProgress(100);
        addLogEntry(`Exported ${csvResponse.data.rowCount} items as CSV`);
      } else {
        addLogEntry(`CSV export failed: ${csvResponse?.error || 'Unknown error'}`);
      }
    } else {
      // JSON export via service worker
      console.log('[Sidepanel] Sending EXPORT_JSON to service worker');
      updateExportProgress(60);
      try {
        const jsonResponse = await chrome.runtime.sendMessage({
          type: 'EXPORT_JSON',
          payload: {
            items: data,
            filename: `scrape-${dateStr}.json`,
          },
        });

        console.log('[Sidepanel] EXPORT_JSON response:', jsonResponse);

        if (jsonResponse && jsonResponse.success) {
          updateExportProgress(100);
          addLogEntry(`Exported ${jsonResponse.data.rowCount} items as JSON`);
        } else {
          addLogEntry(`JSON export failed: ${jsonResponse?.error || 'Unknown error'}`);
        }
      } catch (err: any) {
        console.error('[Sidepanel] EXPORT_JSON via service worker failed:', err);
        addLogEntry(`Service worker export failed, trying direct download...`);

        // Fallback: Direct download using data URL
        try {
          await downloadJsonDirect(`scrape-${dateStr}.json`, data);
          updateExportProgress(100);
          addLogEntry(`Exported ${data.length} items as JSON (direct download)`);
        } catch (fallbackErr: any) {
          console.error('[Sidepanel] Direct download also failed:', fallbackErr);
          addLogEntry(`Export failed: ${fallbackErr.message}`);
        }
      }
    }

    // Hide progress bar after a short delay to show completion
    setTimeout(() => hideExportProgress(), 1500);

  } catch (err: any) {
    console.error('[Sidepanel] Export error:', err);
    addLogEntry(`Export error: ${err.message}`);
    hideExportProgress();
  } finally {
    const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    if (exportBtn) exportBtn.disabled = false;
  }
}

// Set up export button listener
console.log('[Sidepanel] Setting up export button listener...');
const exportBtnElement = document.getElementById('export-btn');
console.log('[Sidepanel] Export button element:', exportBtnElement);
if (exportBtnElement) {
  exportBtnElement.addEventListener('click', handleExportClick);
  console.log('[Sidepanel] Export button listener attached successfully');
} else {
  console.error('[Sidepanel] ERROR: export-btn element not found!');
}

// Also expose to window for onclick fallback
(window as any).handleExportClick = handleExportClick;

// --- Generate Presentation ---

ui.generatePresentationBtn?.addEventListener('click', async () => {
  const response = await sendToContentScript({ type: 'EXPORT_DATA' });
  if (response.success && response.data) {
    const items = response.data as ExtractedItem[];
    if (items.length === 0) {
      addLogEntry('Presentation failed: No data');
      return;
    }

    addLogEntry('Analyzing data for presentation...');

    try {
      // Analyze the scraped data
      const analysis = analyzeData(items);

      // Check if LLM is configured for enhanced insights
      const llmConfig = await loadLlmSettingsFromStorage();
      let slides;

      if (llmConfig && llmConfig.provider && llmConfig.apiKey) {
        addLogEntry('Generating AI-enhanced insights...');
        slides = await generateSlidesWithLLM(analysis, items, 'Data Analysis Report');
      } else {
        // Fallback to basic slide generation
        slides = generateSlides(analysis, items, 'Data Analysis Report');
      }

      addLogEntry(`Generated ${slides.length} slides`);

      // Get chart recommendations for logging
      const chartRecommendations = Object.entries(analysis.fieldStats).map(([field, stats]) => {
        const numericStats = analysis.numericStats[field];
        const pattern = analysis.patterns.find(p => p.field === field);
        const recommendation = selectChartType(stats, numericStats, pattern);
        return `${field}: ${recommendation.suggestedType}`;
      });
      console.log('[Presentation] Chart recommendations:', chartRecommendations);

      // Show format selection dialog
      const format = await showPresentationFormatDialog();
      if (!format) {
        addLogEntry('Presentation cancelled');
        return;
      }

      addLogEntry(`Exporting as ${format.toUpperCase()}...`);

      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `presentation-${dateStr}`;

      if (format === 'pptx') {
        const result = await exportToPptx(slides, {
          filename: `${filename}.pptx`,
          author: 'Scraper Pro',
          title: 'Data Analysis Report',
        });
        if (result.success) {
          addLogEntry(`Presentation saved: ${result.filename}`);
        } else {
          addLogEntry(`Export failed: ${result.error}`);
        }
      } else if (format === 'pdf') {
        const result = await exportToPdf(slides, {
          filename: `${filename}.pdf`,
          author: 'Scraper Pro',
          title: 'Data Analysis Report',
        });
        if (result.success) {
          addLogEntry(`PDF saved: ${result.filename}`);
        } else {
          addLogEntry(`Export failed: ${result.error}`);
        }
      }
    } catch (error: any) {
      addLogEntry(`Presentation error: ${error.message}`);
      console.error('[Presentation] Error:', error);
    }
  } else {
    addLogEntry('Presentation failed: No data available');
  }
});

// Helper function to show format selection dialog
function showPresentationFormatDialog(): Promise<'pptx' | 'pdf' | null> {
  return new Promise((resolve) => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'wizard-overlay active';
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background: var(--color-bg-card); border-radius: 12px; padding: 24px; max-width: 320px; width: 90%;';
    modal.innerHTML = `
      <h3 style="margin: 0 0 8px 0; font-size: 16px;">Export Presentation</h3>
      <p style="margin: 0 0 16px 0; font-size: 13px; color: var(--color-text-muted);">Choose the export format for your presentation.</p>
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <button id="export-pptx" class="btn-primary" style="width: 100%; justify-content: center;">
          <span class="material-symbols-outlined" style="font-size: 18px; margin-right: 8px;">slideshow</span>
          PowerPoint (.pptx)
        </button>
        <button id="export-pdf" class="btn-secondary" style="width: 100%; justify-content: center;">
          <span class="material-symbols-outlined" style="font-size: 18px; margin-right: 8px;">picture_as_pdf</span>
          PDF Document
        </button>
        <button id="export-cancel" class="btn-text" style="width: 100%; margin-top: 8px;">Cancel</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cleanup = () => {
      document.body.removeChild(overlay);
    };

    modal.querySelector('#export-pptx')?.addEventListener('click', () => {
      cleanup();
      resolve('pptx');
    });

    modal.querySelector('#export-pdf')?.addEventListener('click', () => {
      cleanup();
      resolve('pdf');
    });

    modal.querySelector('#export-cancel')?.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(null);
      }
    });
  });
}

// --- Service Worker Port Connection ---
// Use long-lived port for reliable push updates from content script

function connectToServiceWorker() {
  const port = chrome.runtime.connect({ name: 'sidepanel' });

  console.log('[Sidepanel] Connecting to service worker...');

  port.onMessage.addListener((msg) => {
    // Log ALL messages at the top for debugging
    console.log('[Sidepanel] Port message received:', msg.type, msg);

    if (msg.type === 'UPDATE_PROGRESS') {
      handleProgressUpdate(msg);
    } else if (msg.type === 'UPDATE_STATUS') {
      handleStatusUpdate(msg);
    } else if (msg.type === 'UPDATE_PREVIEW') {
      handlePreviewUpdate(msg);
    } else if (msg.type === 'SHOW_ERROR') {
      handleErrorUpdate(msg);
    }
  });

  port.onDisconnect.addListener(() => {
    console.warn('[Sidepanel] SW port disconnected, reconnecting in 250ms...');
    setTimeout(connectToServiceWorker, 250);
  });

  // Handshake for debugging
  port.postMessage({ type: 'SIDEPANEL_READY', ts: Date.now() });
}

function handleProgressUpdate(msg: { payload?: { current?: number; max?: number }; tabId?: number }) {
  const current = msg.payload?.current ?? 0;
  const max = msg.payload?.max ?? 0;

  console.log(`[Sidepanel] Progress: ${current}/${max > 0 ? max : '∞'}`);

  // Update Dashboard item count
  if (ui.itemCount) ui.itemCount.textContent = String(current);

  // Update Extraction tab progress bar
  if (ui.scrapingItemsCurrent) ui.scrapingItemsCurrent.textContent = String(current);

  if (ui.scrapingProgressBar) {
    if (max > 0) {
      const progress = Math.min(100, (current / max) * 100);
      ui.scrapingProgressBar.style.width = `${progress}%`;
    } else {
      // No limit - show progress based on count
      const width = Math.min(90, current * 2);
      ui.scrapingProgressBar.style.width = `${width}%`;
    }
  }
}

function handleStatusUpdate(msg: { payload?: { status?: string } }) {
  const status = msg.payload?.status || 'idle';
  if (ui.statusText) ui.statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);

  ui.statusDot?.classList.remove('active', 'running', 'paused', 'error');
  if (status === 'running') {
    ui.statusDot?.classList.add('running');
    updateMainButton('running');
    if (ui.scrapingProgressBar) ui.scrapingProgressBar.style.width = '0%';
    if (ui.scrapingItemsCurrent) ui.scrapingItemsCurrent.textContent = '0';
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
}

function handlePreviewUpdate(msg: { payload?: { items?: ExtractedItem[] } }) {
  const items = (msg.payload?.items || []) as ExtractedItem[];
  if (items.length > 0) {
    previewItems = items;
    if (previewMode === 'cards') {
      renderPreviewCards(items);
    } else {
      ui.livePreviewContent.textContent = JSON.stringify(items.slice(-5), null, 2);
    }
  }
}

function handleErrorUpdate(msg: { payload?: { message?: string } }) {
  const errorMsg = msg.payload?.message || 'Unknown error';
  addLogEntry(`Error: ${errorMsg}`);
  if (ui.statusText) ui.statusText.textContent = 'Error';
  ui.statusDot?.classList.remove('active', 'running', 'paused');
  ui.statusDot?.classList.add('error');
}

// --- Initialization ---

async function init() {
  setupTabs();

  // Connect to service worker for push updates
  connectToServiceWorker();

  // Initialize extension toggle
  extensionEnabled = await loadExtensionEnabled();
  updateExtensionToggleUI(extensionEnabled);
  bindExtensionToggle();

  await syncUIWithConfig();
  bindSettingsListeners();
  await loadAndRenderHistory();
  renderActivityLog();

  // Load and render scheduled tasks
  scheduledTasks = await loadScheduledTasks();
  renderScheduledTasks();
  updateDashboardStats();

  // Load and render saved URLs
  savedUrls = await loadSavedUrls();
  renderSavedUrls();
  populateWizardUrlSelect();
  bindSavedUrlsListeners();

  // Load and render templates
  templates = await loadTemplates();
  renderTemplates();
  bindTemplateListeners();

  // Check for matching template on current page
  checkForMatchingTemplate();

  // Load and sync webhook config
  webhookConfig = await loadWebhookConfig();
  syncWebhookUI();
  bindWebhookListeners();

  // Load and sync LLM settings
  llmSettings = await loadLlmSettings();
  syncLlmUI();
  bindLlmSettingsListeners();

  // Poll for status
  updateDashboardStatus();
  setInterval(updateDashboardStatus, 1000);
}

init();

// --- Message Listener for Non-Push Updates ---
// Note: UPDATE_STATUS, UPDATE_PROGRESS, UPDATE_PREVIEW, SHOW_ERROR are now handled via port
// This listener handles other messages like SAVED_URLS_UPDATED, TEMPLATE_APPLIED, etc.

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === 'SAVED_URLS_UPDATED') {
    // Refresh saved URLs when updated from context menu
    loadSavedUrls().then(urls => {
      savedUrls = urls;
      renderSavedUrls();
      populateWizardUrlSelect();
    });
  } else if (message.type === 'TEMPLATE_APPLIED') {
    // Template was applied from somewhere else
    const template = message.payload?.template as ScrapingTemplate;
    if (template) {
      addLogEntry(`Template applied: ${template.name}`);
      // Update config
      currentConfig.extractionConfig = { ...template.extractionConfig };
      currentConfig.patternConfig = { ...template.patternConfig };
      if (template.scrollerConfig) {
        currentConfig.scrollerConfig = { ...template.scrollerConfig };
      }
      currentContainerSelector = template.containerSelector;
      syncUIWithConfig();
    }
  } else if (message.type === 'arbitrage:opportunity:detected') {
    // Refresh opportunities when new one is detected
    loadArbitrageOpportunities();
  } else if (message.type === 'PATTERN_SELECTORS_UPDATED') {
    // Pattern was locked/unlocked in content script - update selectors
    const selectors = message.payload?.selectors as { fullItemSelector?: string } | null;
    if (selectors?.fullItemSelector) {
      currentContainerSelector = selectors.fullItemSelector;
      console.log('[Sidepanel] Pattern selectors updated:', currentContainerSelector);
      addLogEntry(`Pattern locked (${message.payload?.itemCount || 0} items)`);
    } else {
      currentContainerSelector = '';
      console.log('[Sidepanel] Pattern cleared');
    }
  }
});

// --- Tab Change Detection for Templates ---

// Check for matching template when user switches browser tabs
chrome.tabs.onActivated.addListener(() => {
  // Small delay to ensure tab info is updated
  setTimeout(() => {
    checkForMatchingTemplate();
  }, 100);
});

// Check for matching template when URL changes in the current tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    // Check if this is the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id === tabId) {
        checkForMatchingTemplate();
      }
    });
  }
});

// --- Arbitrage Tab ---

// Arbitrage UI Elements
const arbUI = {
  scanBtn: document.getElementById('scan-arbitrage-btn') as HTMLButtonElement,
  platformBanner: document.getElementById('platform-banner') as HTMLDivElement,
  platformName: document.getElementById('platform-name') as HTMLParagraphElement,
  platformInfo: document.getElementById('platform-info') as HTMLParagraphElement,
  opportunitiesCount: document.getElementById('arb-opportunities') as HTMLSpanElement,
  avgMargin: document.getElementById('arb-avg-margin') as HTMLSpanElement,
  productsCount: document.getElementById('arb-products') as HTMLSpanElement,
  opportunitiesList: document.getElementById('opportunities-list') as HTMLDivElement,
  sortSelect: document.getElementById('arb-sort') as HTMLSelectElement,
  refreshBtn: document.getElementById('refresh-opportunities-btn') as HTMLButtonElement,
  minMarginInput: document.getElementById('arb-min-margin') as HTMLInputElement,
  autoMatchToggle: document.getElementById('arb-auto-match') as HTMLInputElement,
  alertsToggle: document.getElementById('arb-alerts') as HTMLInputElement,
  platformFilters: document.querySelectorAll('.platform-chip') as NodeListOf<HTMLLabelElement>,
};

// Arbitrage State
let arbitrageOpportunities: ArbitrageOpportunity[] = [];
let enabledPlatforms: PlatformId[] = ['temu', 'shein', 'aliexpress', 'shopee', 'lazada', 'tiktokshop'];
let _currentPlatform: { id: PlatformId; name: string } | null = null;
void _currentPlatform; // Reserved for future use (e.g., platform-specific actions)

// Arbitrage Helper Functions
function formatMargin(margin: number): string {
  return margin >= 0 ? `+${margin.toFixed(1)}%` : `${margin.toFixed(1)}%`;
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function getRecommendationClass(rec: string): string {
  switch (rec) {
    case 'buy': return 'badge-success';
    case 'hold': return 'badge-warning';
    case 'avoid': return 'badge-error';
    default: return 'badge-info';
  }
}

function renderOpportunityCard(opp: ArbitrageOpportunity): string {
  const margin = opp.financials.profitMarginPercent;
  const marginClass = margin >= 30 ? 'text-success' : margin >= 20 ? 'text-warning' : 'text-muted';
  const recClass = getRecommendationClass(opp.recommendation);

  return `
    <div class="opportunity-card" data-id="${opp.id}" style="padding: 12px 16px; border-bottom: 1px solid var(--color-border);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(opp.sourceProduct.title)}">
            ${escapeHtml(opp.sourceProduct.title.substring(0, 50))}${opp.sourceProduct.title.length > 50 ? '...' : ''}
          </div>
          <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">
            ${opp.sourceProduct.platform} → ${opp.targetProduct.platform}
          </div>
        </div>
        <span class="badge ${recClass}" style="font-size: 10px; padding: 2px 6px;">
          ${opp.recommendation.toUpperCase()}
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-size: 12px; color: var(--color-text-muted);">Margin:</span>
          <span class="${marginClass}" style="font-weight: 600; font-size: 14px; margin-left: 4px;">
            ${formatMargin(margin)}
          </span>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 11px; color: var(--color-text-muted);">Profit:</span>
          <span style="font-weight: 500; font-size: 13px; color: var(--color-primary); margin-left: 4px;">
            ${formatCurrency(opp.financials.profitPerUnit)}
          </span>
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 11px; color: var(--color-text-muted);">
        <span>Confidence: ${(opp.riskMetrics.confidence * 100).toFixed(0)}%</span>
        <button class="btn-text dismiss-opp-btn" data-id="${opp.id}" style="font-size: 11px; padding: 2px 4px;">
          Dismiss
        </button>
      </div>
    </div>
  `;
}

function renderArbitrageOpportunities() {
  if (!arbUI.opportunitiesList) return;

  // Filter by enabled platforms
  const filtered = arbitrageOpportunities.filter(opp =>
    enabledPlatforms.includes(opp.sourceProduct.platform) ||
    enabledPlatforms.includes(opp.targetProduct.platform)
  );

  if (filtered.length === 0) {
    arbUI.opportunitiesList.innerHTML = `
      <div class="empty-placeholder" style="padding: 32px; text-align: center;">
        <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.3; display: block; margin-bottom: 8px;">search_off</span>
        <p style="margin: 0; color: var(--color-text-muted);">No opportunities found yet</p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--color-text-muted);">
          Navigate to a supported e-commerce site and click "Scan Products"
        </p>
      </div>
    `;
    return;
  }

  arbUI.opportunitiesList.innerHTML = filtered.map(opp => renderOpportunityCard(opp)).join('');

  // Add event listeners for dismiss buttons
  arbUI.opportunitiesList.querySelectorAll('.dismiss-opp-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.id;
      if (id) {
        await dismissOpportunity(id);
      }
    });
  });
}

function updateArbitrageStats() {
  const _buyOpps = arbitrageOpportunities.filter(o => o.recommendation === 'buy').length;
  void _buyOpps; // Reserved for future use
  const totalMargin = arbitrageOpportunities.reduce((sum, o) => sum + o.financials.profitMarginPercent, 0);
  const avgMargin = arbitrageOpportunities.length > 0 ? totalMargin / arbitrageOpportunities.length : 0;

  if (arbUI.opportunitiesCount) {
    arbUI.opportunitiesCount.textContent = String(arbitrageOpportunities.length);
  }
  if (arbUI.avgMargin) {
    arbUI.avgMargin.textContent = `${avgMargin.toFixed(1)}%`;
  }
  // Products count would come from a separate API call - placeholder for now
}

async function loadArbitrageOpportunities() {
  try {
    const sortBy = arbUI.sortSelect?.value || 'margin';
    const response = await chrome.runtime.sendMessage({
      type: 'GET_OPPORTUNITIES',
      payload: {
        sortBy,
        platforms: enabledPlatforms,
        showDismissed: false,
      },
    }) as ScraperResponse;

    if (response.success && response.data) {
      arbitrageOpportunities = response.data as ArbitrageOpportunity[];
      renderArbitrageOpportunities();
      updateArbitrageStats();
    }
  } catch (error) {
    console.error('[Arbitrage] Failed to load opportunities:', error);
  }
}

async function dismissOpportunity(id: string) {
  try {
    await chrome.runtime.sendMessage({
      type: 'DISMISS_OPPORTUNITY',
      payload: { opportunityId: id },
    });

    // Remove from local list and re-render
    arbitrageOpportunities = arbitrageOpportunities.filter(o => o.id !== id);
    renderArbitrageOpportunities();
    updateArbitrageStats();
    addLogEntry('Dismissed opportunity');
  } catch (error) {
    console.error('[Arbitrage] Failed to dismiss:', error);
  }
}

async function scanForProducts() {
  addLogEntry('Scanning for products...');

  // Send message to content script to extract products
  const response = await sendToContentScript({
    type: 'EXTRACT_PRODUCTS',
  } as ScraperMessage);

  if (response.success && response.data) {
    const { platform, products } = response.data as { platform: any; products: any[] };

    if (platform) {
      _currentPlatform = { id: platform.id, name: platform.name };
      if (arbUI.platformBanner) arbUI.platformBanner.style.display = 'block';
      if (arbUI.platformName) arbUI.platformName.textContent = platform.name;
      if (arbUI.platformInfo) arbUI.platformInfo.textContent = `Found ${products.length} products`;
    }

    if (products.length > 0) {
      // Record prices
      await chrome.runtime.sendMessage({
        type: 'RECORD_PRICES',
        payload: { snapshots: products },
      });

      // Analyze for arbitrage opportunities
      const analyzeResponse = await chrome.runtime.sendMessage({
        type: 'ANALYZE_ARBITRAGE',
        payload: {
          products,
          sourcePlatform: platform?.id || 'temu',
          targetPlatforms: enabledPlatforms.filter(p => p !== platform?.id),
          minMargin: parseInt(arbUI.minMarginInput?.value) || 20,
        },
      });

      if (analyzeResponse.success) {
        addLogEntry(`Found ${(analyzeResponse.data as any[]).length} opportunities`);
        await loadArbitrageOpportunities();
      }
    } else {
      addLogEntry('No products found on this page');
    }
  } else {
    addLogEntry('Platform not supported or no products found');
  }
}

// Bind Arbitrage Event Listeners
function bindArbitrageListeners() {
  // Scan button
  arbUI.scanBtn?.addEventListener('click', scanForProducts);

  // Refresh button
  arbUI.refreshBtn?.addEventListener('click', loadArbitrageOpportunities);

  // Sort selector
  arbUI.sortSelect?.addEventListener('change', loadArbitrageOpportunities);

  // Platform filters
  arbUI.platformFilters.forEach(chip => {
    chip.addEventListener('click', () => {
      const checkbox = chip.querySelector('input') as HTMLInputElement;
      const platform = chip.dataset.platform as PlatformId;

      if (checkbox.checked) {
        checkbox.checked = false;
        chip.classList.remove('active');
        enabledPlatforms = enabledPlatforms.filter(p => p !== platform);
      } else {
        checkbox.checked = true;
        chip.classList.add('active');
        if (!enabledPlatforms.includes(platform)) {
          enabledPlatforms.push(platform);
        }
      }

      renderArbitrageOpportunities();
    });
  });

  // Settings changes
  arbUI.minMarginInput?.addEventListener('change', async () => {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_ARBITRAGE_SETTINGS',
      payload: { minProfitMargin: parseInt(arbUI.minMarginInput.value) || 20 },
    });
  });

  arbUI.autoMatchToggle?.addEventListener('change', async () => {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_ARBITRAGE_SETTINGS',
      payload: { autoMatch: arbUI.autoMatchToggle.checked },
    });
  });

  arbUI.alertsToggle?.addEventListener('change', async () => {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_ARBITRAGE_SETTINGS',
      payload: { alertOnOpportunity: arbUI.alertsToggle.checked },
    });
  });
}

// Initialize Arbitrage Tab
async function initArbitrage() {
  bindArbitrageListeners();
  await loadArbitrageOpportunities();

  // Load settings
  const settingsResponse = await chrome.runtime.sendMessage({
    type: 'GET_ARBITRAGE_SETTINGS',
  }) as ScraperResponse;

  if (settingsResponse.success && settingsResponse.data) {
    const settings = settingsResponse.data as any;
    if (arbUI.minMarginInput) arbUI.minMarginInput.value = String(settings.minProfitMargin || 20);
    if (arbUI.autoMatchToggle) arbUI.autoMatchToggle.checked = settings.autoMatch !== false;
    if (arbUI.alertsToggle) arbUI.alertsToggle.checked = settings.alertOnOpportunity !== false;
  }
}

// Call initArbitrage after main init
initArbitrage();
