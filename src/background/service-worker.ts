// Service worker for Chrome Extension
// Handles extension lifecycle, message routing, and scheduled task execution

import type { ScraperMessage, ScraperResponse, ExtractedItem, ScrapingTemplate } from '../types';
import type {
  PriceSnapshot,
  ArbitrageFilters,
  ArbitrageSettings,
  PlatformId,
  TrendPeriod,
} from '../types/arbitrage';
import {
  exportToExcel,
  exportToCSV,
  analyzeData,
  generateTextReport,
  type ExcelExportOptions,
} from '../export';
import {
  generateDataFingerprint,
  detectChanges,
  type DataFingerprint,
  type ChangeDetectionResult,
} from '../utils/changeDetection';
import { getPriceComparisonService } from '../services/priceComparison';
import { getTrendDetectionService } from '../services/trendDetection';
import { getArbitrageAnalyzer } from '../services/arbitrageAnalyzer';
import { analyzeWithLLM } from '../services/llmAnalysis';

console.log('[SW] boot');

// --- Sidepanel Port Tracking ---
// Track sidepanel ports for push updates (progress, status, etc.)
const sidepanelPorts = new Set<chrome.runtime.Port>();

chrome.runtime.onConnect.addListener((port) => {
  console.log('[SW] onConnect', port.name, port.sender?.url);

  if (port.name !== 'sidepanel') return;

  sidepanelPorts.add(port);

  // WIRE TEST: Send hello immediately to verify connection
  port.postMessage({ type: 'SW_HELLO', ts: Date.now() });
  console.log('[SW] Sent SW_HELLO to sidepanel');

  port.onDisconnect.addListener(() => {
    console.log('[SW] Sidepanel port disconnected');
    sidepanelPorts.delete(port);
  });

  // Handle messages from sidepanel via port
  port.onMessage.addListener((msg) => {
    console.log('[SW] from sidepanel:', msg);
    // WIRE TEST: Respond to PING with PONG
    if (msg?.type === 'PING') {
      port.postMessage({ type: 'PONG', ts: Date.now() });
      console.log('[SW] Sent PONG');
    }
  });
});

// --- Types ---

// Cron configuration for scheduled tasks
interface CronConfig {
  time: string;           // "09:00" (24-hour format)
  dayOfWeek?: number[];   // 0-6 (Sunday=0)
  dayOfMonth?: number[];  // 1-31
}

// Batch configuration for multi-URL scraping
interface BatchConfig {
  delayBetweenMs: number;      // Default: 2000
  continueOnError: boolean;    // Default: true
  aggregateResults: boolean;   // Default: true
}

// Change detection configuration
interface ChangeDetectionConfig {
  enabled: boolean;
  webhookOnChangeOnly: boolean;
  trackFieldChanges: boolean;
  previousFingerprint?: DataFingerprint;
}

interface ScheduledTask {
  id: string;
  name: string;
  url: string;
  description?: string;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  maxItems: number;
  timeout: number;
  format: 'json' | 'csv';
  webhookUrl?: string;
  autoExport: boolean;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  lastError?: string;
  // NEW: Cron-style scheduling
  scheduleType?: 'simple' | 'cron';
  cronConfig?: CronConfig;
  // NEW: Batch URL support
  urls?: string[];
  batchConfig?: BatchConfig;
  // NEW: Change detection
  changeDetection?: ChangeDetectionConfig;
}

interface WebhookConfig {
  url: string;
  onComplete: boolean;
  onFailure: boolean;
  includeData: boolean;
}

interface TaskHistory {
  taskId: string;
  taskName: string;
  runAt: string;
  status: 'success' | 'failure';
  itemsCollected: number;
  duration: number;
  error?: string;
  // NEW: Change detection info
  changeDetection?: ChangeDetectionResult;
  dataFingerprint?: DataFingerprint;
  // NEW: Batch processing info
  urlsProcessed?: number;
  urlErrors?: string[];
}

// Saved URL for quick access
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

// --- Storage Keys ---
const STORAGE_KEYS = {
  TASKS: 'scheduled-tasks',
  WEBHOOK: 'webhook-config',
  HISTORY: 'task-history',
  SETTINGS: 'web-scraper-settings',
  SAVED_URLS: 'saved-urls',
  TEMPLATES: 'scraping-templates',
};

// --- Helper Functions ---

function frequencyToMinutes(frequency: ScheduledTask['frequency']): number {
  switch (frequency) {
    case 'hourly':
      return 60;
    case 'daily':
      return 60 * 24;
    case 'weekly':
      return 60 * 24 * 7;
    case 'monthly':
      return 60 * 24 * 30;
    default:
      return 60 * 24; // Default to daily
  }
}

function calculateNextRun(frequency: ScheduledTask['frequency'], cronConfig?: CronConfig): string {
  if (cronConfig) {
    const delayMinutes = calculateCronDelay(cronConfig, frequency);
    const nextRun = new Date();
    nextRun.setMinutes(nextRun.getMinutes() + delayMinutes);
    return nextRun.toISOString();
  }
  const now = new Date();
  const minutes = frequencyToMinutes(frequency);
  now.setMinutes(now.getMinutes() + minutes);
  return now.toISOString();
}

// --- Cron Scheduling Utilities ---

/**
 * Get the number of days in a given month
 */
function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Find the next occurrence of a weekday from a list
 */
function getNextWeekdayOccurrence(base: Date, days: number[]): Date {
  const result = new Date(base);
  const sorted = [...days].sort((a, b) => a - b);
  const currentDay = result.getDay();

  // Find next matching day this week
  for (const day of sorted) {
    if (day > currentDay) {
      result.setDate(result.getDate() + (day - currentDay));
      return result;
    }
  }

  // Wrap to next week - find first matching day
  const firstDay = sorted[0];
  result.setDate(result.getDate() + (7 - currentDay + firstDay));
  return result;
}

/**
 * Find the next occurrence of a day of month from a list
 */
function getNextMonthlyOccurrence(base: Date, days: number[]): Date {
  const result = new Date(base);
  const sorted = [...days].sort((a, b) => a - b);
  const currentDayOfMonth = result.getDate();

  // Find next matching day this month
  for (const day of sorted) {
    if (day > currentDayOfMonth) {
      const maxDay = getDaysInMonth(result);
      result.setDate(Math.min(day, maxDay));
      return result;
    }
  }

  // Move to next month and use first matching day
  result.setMonth(result.getMonth() + 1);
  const maxDay = getDaysInMonth(result);
  result.setDate(Math.min(sorted[0], maxDay));
  return result;
}

/**
 * Calculate delay in minutes until next cron-style scheduled run
 */
function calculateCronDelay(config: CronConfig, frequency: ScheduledTask['frequency']): number {
  const now = new Date();
  const [hours, minutes] = (config.time || '09:00').split(':').map(Number);

  let targetDate = new Date();
  targetDate.setHours(hours, minutes, 0, 0);

  // If target time has passed today, schedule for next occurrence
  if (targetDate <= now) {
    switch (frequency) {
      case 'hourly':
        // For hourly with cron time, run at that minute each hour
        targetDate.setHours(now.getHours() + 1);
        targetDate.setMinutes(minutes);
        break;
      case 'daily':
        targetDate.setDate(targetDate.getDate() + 1);
        break;
      case 'weekly':
        targetDate = getNextWeekdayOccurrence(targetDate, config.dayOfWeek || [1]); // Default Monday
        targetDate.setHours(hours, minutes, 0, 0);
        break;
      case 'monthly':
        targetDate = getNextMonthlyOccurrence(targetDate, config.dayOfMonth || [1]); // Default 1st
        targetDate.setHours(hours, minutes, 0, 0);
        break;
    }
  } else {
    // Target time is still ahead today - check if we need to adjust for day constraints
    if (frequency === 'weekly' && config.dayOfWeek?.length) {
      const today = now.getDay();
      if (!config.dayOfWeek.includes(today)) {
        targetDate = getNextWeekdayOccurrence(now, config.dayOfWeek);
        targetDate.setHours(hours, minutes, 0, 0);
      }
    } else if (frequency === 'monthly' && config.dayOfMonth?.length) {
      const today = now.getDate();
      if (!config.dayOfMonth.includes(today)) {
        targetDate = getNextMonthlyOccurrence(now, config.dayOfMonth);
        targetDate.setHours(hours, minutes, 0, 0);
      }
    }
  }

  const delayMs = targetDate.getTime() - now.getTime();
  return Math.max(1, Math.ceil(delayMs / 60000));
}

/**
 * Calculate delay for task based on schedule type
 */
function calculateDelayToNextRun(task: ScheduledTask): number {
  if (task.scheduleType === 'cron' && task.cronConfig) {
    return calculateCronDelay(task.cronConfig, task.frequency);
  }
  return 1; // Default: run in 1 minute for simple schedules
}

async function getTasksFromStorage(): Promise<ScheduledTask[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.TASKS);
  return result[STORAGE_KEYS.TASKS] || [];
}

async function saveTasksToStorage(tasks: ScheduledTask[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.TASKS]: tasks });
}

async function getWebhookConfig(): Promise<WebhookConfig | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.WEBHOOK);
  return result[STORAGE_KEYS.WEBHOOK] || null;
}

async function addToHistory(entry: TaskHistory): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
  const history: TaskHistory[] = result[STORAGE_KEYS.HISTORY] || [];
  history.unshift(entry); // Add to beginning
  // Keep only last 100 entries
  if (history.length > 100) {
    history.length = 100;
  }
  await chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: history });
}

// --- Saved URLs Functions ---

async function getSavedUrls(): Promise<SavedUrl[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SAVED_URLS);
  return result[STORAGE_KEYS.SAVED_URLS] || [];
}

async function saveSavedUrls(urls: SavedUrl[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SAVED_URLS]: urls });
}

async function addSavedUrl(url: string, name?: string, favicon?: string): Promise<SavedUrl> {
  const savedUrls = await getSavedUrls();

  // Check if URL already exists
  const existing = savedUrls.find(u => u.url === url);
  if (existing) {
    // Update use count and lastUsed
    existing.useCount++;
    existing.lastUsed = new Date().toISOString();
    await saveSavedUrls(savedUrls);
    return existing;
  }

  // Create new saved URL
  const newUrl: SavedUrl = {
    id: crypto.randomUUID(),
    name: name || new URL(url).hostname,
    url,
    favicon,
    addedAt: new Date().toISOString(),
    useCount: 1,
  };

  savedUrls.unshift(newUrl);

  // Keep only last 50 saved URLs
  if (savedUrls.length > 50) {
    savedUrls.length = 50;
  }

  await saveSavedUrls(savedUrls);
  return newUrl;
}

async function removeSavedUrl(id: string): Promise<void> {
  const savedUrls = await getSavedUrls();
  const filtered = savedUrls.filter(u => u.id !== id);
  await saveSavedUrls(filtered);
}

async function updateSavedUrlUsage(id: string): Promise<void> {
  const savedUrls = await getSavedUrls();
  const url = savedUrls.find(u => u.id === id);
  if (url) {
    url.useCount++;
    url.lastUsed = new Date().toISOString();
    await saveSavedUrls(savedUrls);
  }
}

// --- Scraping Template Functions ---

async function getTemplates(): Promise<ScrapingTemplate[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.TEMPLATES);
  return result[STORAGE_KEYS.TEMPLATES] || [];
}

async function saveTemplates(templates: ScrapingTemplate[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.TEMPLATES]: templates });
}

async function saveTemplate(template: Omit<ScrapingTemplate, 'id' | 'createdAt' | 'useCount'>): Promise<ScrapingTemplate> {
  const templates = await getTemplates();

  // Check if template with same URL pattern exists
  const existingIndex = templates.findIndex(t => t.urlPattern === template.urlPattern);

  const newTemplate: ScrapingTemplate = {
    ...template,
    id: existingIndex >= 0 ? templates[existingIndex].id : crypto.randomUUID(),
    createdAt: existingIndex >= 0 ? templates[existingIndex].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    useCount: existingIndex >= 0 ? templates[existingIndex].useCount : 0,
  };

  if (existingIndex >= 0) {
    templates[existingIndex] = newTemplate;
  } else {
    templates.unshift(newTemplate);
  }

  // Keep only last 100 templates
  if (templates.length > 100) {
    templates.length = 100;
  }

  await saveTemplates(templates);
  return newTemplate;
}

async function updateTemplate(id: string, updates: Partial<ScrapingTemplate>): Promise<ScrapingTemplate | null> {
  const templates = await getTemplates();
  const index = templates.findIndex(t => t.id === id);

  if (index < 0) {
    return null;
  }

  templates[index] = {
    ...templates[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveTemplates(templates);
  return templates[index];
}

async function deleteTemplate(id: string): Promise<void> {
  const templates = await getTemplates();
  const filtered = templates.filter(t => t.id !== id);
  await saveTemplates(filtered);
}

async function findMatchingTemplate(url: string): Promise<ScrapingTemplate | null> {
  const templates = await getTemplates();

  // Extract hostname for quick matching
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }

  // First, try to find by hostname match
  const hostnameMatches = templates.filter(t => t.siteHostname === hostname);

  // Then check URL pattern (regex)
  for (const template of hostnameMatches) {
    try {
      const pattern = new RegExp(template.urlPattern);
      if (pattern.test(url)) {
        return template;
      }
    } catch {
      // Invalid regex, skip
      continue;
    }
  }

  // If no hostname match, try all templates with URL pattern
  for (const template of templates) {
    if (template.siteHostname !== hostname) {
      try {
        const pattern = new RegExp(template.urlPattern);
        if (pattern.test(url)) {
          return template;
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

async function updateTemplateUsage(id: string): Promise<void> {
  const templates = await getTemplates();
  const template = templates.find(t => t.id === id);
  if (template) {
    template.useCount++;
    template.lastUsedAt = new Date().toISOString();
    await saveTemplates(templates);
  }
}

// --- Scheduler Functions ---

async function scheduleTask(task: ScheduledTask): Promise<void> {
  if (!task.enabled) {
    console.log(`[Scheduler] Task ${task.id} is disabled, skipping`);
    return;
  }

  const delayInMinutes = calculateDelayToNextRun(task);

  // For cron-style scheduling, don't use periodInMinutes - reschedule after each run
  // For simple frequency, use periodic alarms
  const isCronSchedule = task.scheduleType === 'cron' && task.cronConfig;
  const periodInMinutes = isCronSchedule ? undefined : frequencyToMinutes(task.frequency);

  // Create alarm for this task
  await chrome.alarms.create(task.id, {
    delayInMinutes,
    ...(periodInMinutes && { periodInMinutes }),
  });

  const scheduleInfo = isCronSchedule
    ? `in ${delayInMinutes} minutes (cron: ${task.cronConfig?.time})`
    : `every ${periodInMinutes} minutes`;

  console.log(`[Scheduler] Scheduled task ${task.id} to run ${scheduleInfo}`);
}

async function unscheduleTask(taskId: string): Promise<void> {
  await chrome.alarms.clear(taskId);
  console.log(`[Scheduler] Unscheduled task ${taskId}`);
}

async function rescheduleAllTasks(): Promise<void> {
  const tasks = await getTasksFromStorage();

  // Clear all existing alarms
  await chrome.alarms.clearAll();

  // Reschedule enabled tasks
  for (const task of tasks) {
    if (task.enabled) {
      await scheduleTask(task);
    }
  }

  console.log(`[Scheduler] Rescheduled ${tasks.filter(t => t.enabled).length} tasks`);
}

// --- Task Execution ---

/**
 * Helper function to delay execution
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Scrape a single URL and return extracted data
 */
async function scrapeUrl(url: string, task: ScheduledTask): Promise<ExtractedItem[]> {
  // Find a tab with the target URL or create one
  let tabId: number | undefined;
  let createdTab = false;
  const tabs = await chrome.tabs.query({ url });

  if (tabs.length > 0 && tabs[0].id) {
    tabId = tabs[0].id;
  } else {
    // Create a new tab
    const tab = await chrome.tabs.create({ url, active: false });
    tabId = tab.id;
    createdTab = true;

    // Wait for tab to load
    await new Promise<void>((resolve) => {
      const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);

      // Timeout after 30 seconds
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 30000);
    });
  }

  if (!tabId) {
    throw new Error('Failed to get or create tab');
  }

  try {
    // Send message to content script to start scraping
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'START_SCRAPE',
      payload: {
        maxItems: task.maxItems,
        timeout: task.timeout,
      },
    } as ScraperMessage);

    if (!response.success) {
      throw new Error(response.error || 'Scrape failed');
    }

    // Wait for scraping to complete (with timeout)
    await delay(task.timeout * 1000);

    // Get the extracted data
    const exportResponse = await chrome.tabs.sendMessage(tabId, {
      type: 'EXPORT_DATA',
    } as ScraperMessage);

    const extractedData: ExtractedItem[] = exportResponse.data || [];

    // Stop the scrape
    await chrome.tabs.sendMessage(tabId, {
      type: 'STOP_SCRAPE',
    } as ScraperMessage);

    return extractedData;
  } finally {
    // Close the tab if we created it
    if (createdTab && tabId) {
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        // Tab may already be closed
      }
    }
  }
}

/**
 * Update task fingerprint for change detection
 */
async function updateTaskFingerprint(
  taskId: string,
  fingerprint: DataFingerprint
): Promise<void> {
  const tasks = await getTasksFromStorage();
  const task = tasks.find(t => t.id === taskId);

  if (task?.changeDetection) {
    task.changeDetection.previousFingerprint = fingerprint;
    await saveTasksToStorage(tasks);
  }
}

/**
 * Execute a scheduled task with support for batch URLs and change detection
 */
async function executeTask(task: ScheduledTask): Promise<void> {
  console.log(`[Scheduler] Executing task: ${task.name}`);
  const startTime = Date.now();

  // Update task status
  const tasks = await getTasksFromStorage();
  const taskIndex = tasks.findIndex(t => t.id === task.id);
  if (taskIndex !== -1) {
    tasks[taskIndex].status = 'running';
    await saveTasksToStorage(tasks);
  }

  // Get URLs to process (batch support)
  const urls = task.urls?.length ? task.urls : [task.url];
  const batchConfig: BatchConfig = task.batchConfig || {
    delayBetweenMs: 2000,
    continueOnError: true,
    aggregateResults: true,
  };

  const allResults: ExtractedItem[] = [];
  const urlErrors: string[] = [];
  let urlsProcessed = 0;

  try {
    // Process each URL
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`[Scheduler] Processing URL ${i + 1}/${urls.length}: ${url}`);

      try {
        const result = await scrapeUrl(url, task);
        allResults.push(...result);
        urlsProcessed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        urlErrors.push(`URL ${i + 1} (${url}): ${errorMsg}`);

        if (!batchConfig.continueOnError) {
          throw new Error(`Batch stopped at URL ${i + 1}: ${errorMsg}`);
        }
      }

      // Delay between URLs (except last one)
      if (i < urls.length - 1) {
        await delay(batchConfig.delayBetweenMs);
      }
    }

    // Calculate duration
    const duration = Date.now() - startTime;

    // Change detection
    let changeResult: ChangeDetectionResult | undefined;
    let currentFingerprint: DataFingerprint | undefined;

    if (task.changeDetection?.enabled && allResults.length > 0) {
      currentFingerprint = await generateDataFingerprint(allResults);
      changeResult = detectChanges(
        currentFingerprint,
        task.changeDetection.previousFingerprint
      );

      console.log(`[Scheduler] Change detection: ${changeResult.changeType}`);

      // Update task with new fingerprint
      await updateTaskFingerprint(task.id, currentFingerprint);
    }

    // Update task status
    const updatedTasks = await getTasksFromStorage();
    const idx = updatedTasks.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      updatedTasks[idx].status = 'completed';
      updatedTasks[idx].lastRun = new Date().toISOString();
      updatedTasks[idx].nextRun = calculateNextRun(task.frequency, task.cronConfig);
      updatedTasks[idx].lastError = undefined;
      await saveTasksToStorage(updatedTasks);
    }

    // Reschedule cron tasks (they don't use periodic alarms)
    if (task.scheduleType === 'cron' && task.cronConfig) {
      await scheduleTask(task);
    }

    // Add to history with change detection and batch info
    await addToHistory({
      taskId: task.id,
      taskName: task.name,
      runAt: new Date().toISOString(),
      status: 'success',
      itemsCollected: allResults.length,
      duration,
      changeDetection: changeResult,
      dataFingerprint: currentFingerprint,
      urlsProcessed,
      urlErrors: urlErrors.length > 0 ? urlErrors : undefined,
    });

    // Determine if webhook should be sent
    const shouldSendWebhook = !task.changeDetection?.webhookOnChangeOnly
      || changeResult?.hasChanged !== false;

    if (shouldSendWebhook) {
      await sendWebhookNotification(task, allResults, true, duration, undefined, changeResult);
    }

    // Show notification
    const changeInfo = changeResult?.hasChanged === false ? ' (no changes)' : '';
    const batchInfo = urls.length > 1 ? ` from ${urlsProcessed}/${urls.length} URLs` : '';
    await showNotification(
      `Task "${task.name}" completed${changeInfo}`,
      `Collected ${allResults.length} items${batchInfo} in ${Math.round(duration / 1000)}s`
    );

    console.log(`[Scheduler] Task ${task.name} completed: ${allResults.length} items`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Scheduler] Task ${task.name} failed:`, errorMessage);

    // Update task status
    const updatedTasks = await getTasksFromStorage();
    const idx = updatedTasks.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      updatedTasks[idx].status = 'failed';
      updatedTasks[idx].lastRun = new Date().toISOString();
      updatedTasks[idx].nextRun = calculateNextRun(task.frequency, task.cronConfig);
      updatedTasks[idx].lastError = errorMessage;
      await saveTasksToStorage(updatedTasks);
    }

    // Reschedule cron tasks even on failure
    if (task.scheduleType === 'cron' && task.cronConfig) {
      await scheduleTask(task);
    }

    // Add to history
    await addToHistory({
      taskId: task.id,
      taskName: task.name,
      runAt: new Date().toISOString(),
      status: 'failure',
      itemsCollected: allResults.length,
      duration: Date.now() - startTime,
      error: errorMessage,
      urlsProcessed,
      urlErrors: urlErrors.length > 0 ? urlErrors : undefined,
    });

    // Send failure webhook
    await sendWebhookNotification(task, allResults, false, Date.now() - startTime, errorMessage);

    // Show error notification
    await showNotification(
      `Task "${task.name}" failed`,
      errorMessage,
      'error'
    );
  }
}

// --- Webhook Functions ---

async function sendWebhookNotification(
  task: ScheduledTask,
  data: ExtractedItem[],
  success: boolean,
  duration: number,
  error?: string,
  changeResult?: ChangeDetectionResult
): Promise<void> {
  // Check task-specific webhook first
  let webhookUrl = task.webhookUrl;
  let config: WebhookConfig | null = null;

  // If no task-specific webhook, use global config
  if (!webhookUrl) {
    config = await getWebhookConfig();
    if (!config?.url) {
      return;
    }
    webhookUrl = config.url;

    // Check if we should send based on config
    if (success && !config.onComplete) return;
    if (!success && !config.onFailure) return;
  }

  try {
    const payload: Record<string, unknown> = {
      taskId: task.id,
      taskName: task.name,
      url: task.url,
      urls: task.urls?.length ? task.urls : undefined,
      success,
      timestamp: new Date().toISOString(),
      duration,
      itemsCollected: data.length,
    };

    if (error) {
      payload.error = error;
    }

    // Include change detection info
    if (changeResult) {
      payload.changeDetection = {
        hasChanged: changeResult.hasChanged,
        changeType: changeResult.changeType,
        previousHash: changeResult.previousHash,
        currentHash: changeResult.currentHash,
        addedCount: changeResult.addedCount,
        removedCount: changeResult.removedCount,
      };
    }

    if (config?.includeData && data.length > 0) {
      payload.data = data;
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log(`[Webhook] Notification sent to ${webhookUrl}`);
  } catch (err) {
    console.error('[Webhook] Failed to send notification:', err);
  }
}

// --- Notification Functions ---

async function showNotification(
  title: string,
  message: string,
  type: 'success' | 'error' = 'success'
): Promise<void> {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
      priority: type === 'error' ? 2 : 0,
    });
  } catch (err) {
    console.error('[Notifications] Failed to show notification:', err);
  }
}

// --- Alarm Listener ---

chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log(`[Scheduler] Alarm fired: ${alarm.name}`);

  const tasks = await getTasksFromStorage();
  const task = tasks.find(t => t.id === alarm.name);

  if (task && task.enabled) {
    await executeTask(task);
  } else {
    console.log(`[Scheduler] Task ${alarm.name} not found or disabled`);
    // Clean up orphaned alarm
    await chrome.alarms.clear(alarm.name);
  }
});

// --- Message Listener ---

chrome.runtime.onMessage.addListener(
  (message: ScraperMessage, sender, sendResponse: (response: ScraperResponse) => void) => {
    console.log('[Service Worker] Received message:', message.type);

    // Forward UI-related messages from content scripts to sidepanel via port
    const PUSH_TYPES = new Set(['UPDATE_STATUS', 'UPDATE_PROGRESS', 'UPDATE_PREVIEW', 'SHOW_ERROR']);

    if (sender.tab && PUSH_TYPES.has(message.type)) {
      const tabId = sender.tab.id!;
      const forwarded = { ...message, tabId };

      console.log(`[SW] Forwarding ${message.type} from tab ${tabId} to ${sidepanelPorts.size} sidepanel(s)`);

      // Push to connected sidepanel(s) via port
      let delivered = 0;
      for (const port of sidepanelPorts) {
        try {
          port.postMessage(forwarded);
          delivered++;
        } catch (e) {
          // Ignore dead ports - they'll be cleaned up on disconnect
        }
      }

      // Fallback broadcast if no ports connected (e.g., popup listeners)
      if (delivered === 0) {
        chrome.runtime.sendMessage(forwarded).catch((err) => {
          const msg = String((err as Error)?.message ?? err ?? '');
          // Only ignore the normal "no receivers" case
          if (!msg.includes('Receiving end does not exist')) {
            console.warn('[SW] runtime.sendMessage failed:', err);
          }
        });
      }

      sendResponse({ success: true });
      return true;
    }

    const handleMessage = async () => {
      switch (message.type) {
        case 'GET_STATUS':
          return { success: true, data: { status: 'idle' } };

        case 'SCHEDULE_TASK': {
          const task = message.payload as ScheduledTask;
          await scheduleTask(task);
          return { success: true };
        }

        case 'UNSCHEDULE_TASK': {
          const taskId = message.payload as string;
          await unscheduleTask(taskId);
          return { success: true };
        }

        case 'RUN_TASK_NOW': {
          const taskId = message.payload as string;
          const tasks = await getTasksFromStorage();
          const task = tasks.find(t => t.id === taskId);
          if (task) {
            executeTask(task); // Fire and forget
            return { success: true, data: { status: 'started' } };
          }
          return { success: false, error: 'Task not found' };
        }

        case 'GET_SCHEDULED_TASKS': {
          const tasks = await getTasksFromStorage();
          return { success: true, data: tasks };
        }

        case 'GET_TASK_HISTORY': {
          const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
          return { success: true, data: result[STORAGE_KEYS.HISTORY] || [] };
        }

        case 'RESCHEDULE_ALL':
          await rescheduleAllTasks();
          return { success: true };

        case 'EXPORT_EXCEL': {
          const { items, options } = message.payload as {
            items: ExtractedItem[];
            options?: ExcelExportOptions;
          };

          console.log('[SW] EXPORT_EXCEL: items count:', items?.length);

          if (!items || items.length === 0) {
            return { success: false, error: 'No items to export' };
          }

          try {
            console.log('[SW] EXPORT_EXCEL: generating workbook...');
            const result = await exportToExcel(items, {
              filename: options?.filename || `scrape-export-${Date.now()}.xlsx`,
              includeAnalysis: options?.includeAnalysis ?? true,
              ...options,
            });

            console.log('[SW] EXPORT_EXCEL: converting to base64...');
            // Convert blob to base64 for download
            const buffer = await result.blob.arrayBuffer();
            const base64 = btoa(
              new Uint8Array(buffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                ''
              )
            );

            console.log('[SW] EXPORT_EXCEL: base64 length:', base64.length);

            // Return base64 data for sidepanel to handle download
            // (service worker chrome.downloads can be unreliable with large data URLs)
            return {
              success: true,
              data: {
                filename: result.filename,
                rowCount: result.rowCount,
                columnCount: result.columnCount,
                base64,
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              },
            };
          } catch (error) {
            console.error('[SW] EXPORT_EXCEL error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Export failed';
            return { success: false, error: errorMessage };
          }
        }

        case 'EXPORT_CSV': {
          const { items, filename } = message.payload as {
            items: ExtractedItem[];
            filename?: string;
          };

          console.log('[SW] EXPORT_CSV: items count:', items?.length);

          if (!items || items.length === 0) {
            return { success: false, error: 'No items to export' };
          }

          try {
            const csv = exportToCSV(items);
            const base64 = btoa(unescape(encodeURIComponent(csv)));
            const outputFilename = filename || `scrape-export-${Date.now()}.csv`;

            // Return base64 data for sidepanel to handle download
            return {
              success: true,
              data: {
                filename: outputFilename,
                rowCount: items.length,
                base64,
              },
            };
          } catch (error) {
            console.error('[SW] EXPORT_CSV error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Export failed';
            return { success: false, error: errorMessage };
          }
        }

        case 'EXPORT_JSON': {
          const { items, filename } = message.payload as {
            items: ExtractedItem[];
            filename?: string;
          };

          console.log('[Service Worker] EXPORT_JSON called with', items?.length, 'items');

          if (!items || items.length === 0) {
            return { success: false, error: 'No items to export' };
          }

          try {
            const json = JSON.stringify(items, null, 2);
            const outputFilename = filename || `scrape-export-${Date.now()}.json`;

            // Use data URL instead of blob URL (service workers don't have URL.createObjectURL)
            const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;

            console.log('[Service Worker] Starting download:', outputFilename);

            const downloadId = await chrome.downloads.download({
              url: dataUrl,
              filename: outputFilename,
              saveAs: true,
            });

            console.log('[Service Worker] Download started with ID:', downloadId);

            return {
              success: true,
              data: { filename: outputFilename, rowCount: items.length },
            };
          } catch (error) {
            console.error('[Service Worker] EXPORT_JSON error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Export failed';
            return { success: false, error: errorMessage };
          }
        }

        case 'ANALYZE_DATA': {
          const { items } = message.payload as { items: ExtractedItem[] };

          if (!items || items.length === 0) {
            return { success: false, error: 'No items to analyze' };
          }

          try {
            const analysis = analyzeData(items);
            const textReport = generateTextReport(analysis);

            return {
              success: true,
              data: {
                analysis,
                textReport,
              },
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
            return { success: false, error: errorMessage };
          }
        }

        case 'ANALYZE_WITH_LLM': {
          const { items } = message.payload as { items: ExtractedItem[] };

          console.log('[SW] ANALYZE_WITH_LLM: items count:', items?.length);

          if (!items || items.length === 0) {
            return { success: false, error: 'No items to analyze' };
          }

          try {
            const llmResult = await analyzeWithLLM(items as Array<Record<string, unknown>>);

            if (!llmResult) {
              return {
                success: false,
                error: 'LLM not configured. Please configure an AI provider in Settings.',
              };
            }

            console.log('[SW] ANALYZE_WITH_LLM: analysis complete');

            return {
              success: true,
              data: llmResult,
            };
          } catch (error) {
            console.error('[SW] ANALYZE_WITH_LLM error:', error);
            const errorMessage = error instanceof Error ? error.message : 'LLM analysis failed';
            return { success: false, error: errorMessage };
          }
        }

        // --- Saved URLs Operations ---
        case 'GET_SAVED_URLS': {
          const urls = await getSavedUrls();
          return { success: true, data: urls };
        }

        case 'REMOVE_SAVED_URL': {
          const { id } = message.payload as { id: string };
          await removeSavedUrl(id);
          return { success: true };
        }

        case 'UPDATE_SAVED_URL_USAGE': {
          const { id } = message.payload as { id: string };
          await updateSavedUrlUsage(id);
          return { success: true };
        }

        case 'ADD_SAVED_URL': {
          const { url, name, favicon } = message.payload as { url: string; name?: string; favicon?: string };
          const savedUrl = await addSavedUrl(url, name, favicon);
          return { success: true, data: savedUrl };
        }

        // --- Scraping Template Operations ---
        case 'GET_TEMPLATES': {
          const templates = await getTemplates();
          return { success: true, data: templates };
        }

        case 'SAVE_TEMPLATE': {
          const templateData = message.payload as Omit<ScrapingTemplate, 'id' | 'createdAt' | 'useCount'>;
          const template = await saveTemplate(templateData);
          return { success: true, data: template };
        }

        case 'UPDATE_TEMPLATE': {
          const { id, updates } = message.payload as { id: string; updates: Partial<ScrapingTemplate> };
          const template = await updateTemplate(id, updates);
          if (template) {
            return { success: true, data: template };
          }
          return { success: false, error: 'Template not found' };
        }

        case 'DELETE_TEMPLATE': {
          const { id } = message.payload as { id: string };
          await deleteTemplate(id);
          return { success: true };
        }

        case 'FIND_MATCHING_TEMPLATE': {
          const { url } = message.payload as { url: string };
          const template = await findMatchingTemplate(url);
          return { success: true, data: template };
        }

        case 'APPLY_TEMPLATE': {
          const { id } = message.payload as { id: string };
          await updateTemplateUsage(id);
          const templates = await getTemplates();
          const template = templates.find(t => t.id === id);
          if (template) {
            // Notify content script and sidepanel
            chrome.runtime.sendMessage({
              type: 'TEMPLATE_APPLIED',
              payload: { template },
            }).catch(() => {});
            return { success: true, data: template };
          }
          return { success: false, error: 'Template not found' };
        }

        // --- Arbitrage Operations ---
        case 'RECORD_PRICE': {
          const snapshot = message.payload as PriceSnapshot;
          const priceService = getPriceComparisonService();
          await priceService.recordPrice(snapshot);
          return { success: true };
        }

        case 'RECORD_PRICES': {
          const { snapshots } = message.payload as { snapshots: PriceSnapshot[] };
          const priceService = getPriceComparisonService();
          await priceService.recordPrices(snapshots);
          return { success: true, data: { count: snapshots.length } };
        }

        case 'GET_PRICE_HISTORY': {
          const { productId, platforms } = message.payload as {
            productId: string;
            platforms?: PlatformId[];
          };
          const priceService = getPriceComparisonService();
          const history = await priceService.getPriceHistory(productId, platforms);
          return { success: true, data: history };
        }

        case 'FIND_MATCHES': {
          const { reference, targetPlatform } = message.payload as {
            reference: PriceSnapshot;
            targetPlatform: PlatformId;
          };
          const priceService = getPriceComparisonService();
          const match = await priceService.matchProducts(reference, targetPlatform);
          return { success: true, data: match };
        }

        case 'FIND_ALL_MATCHES': {
          const { reference, targetPlatforms } = message.payload as {
            reference: PriceSnapshot;
            targetPlatforms?: PlatformId[];
          };
          const priceService = getPriceComparisonService();
          const matches = await priceService.findAllMatches(reference, targetPlatforms);
          return { success: true, data: matches };
        }

        case 'GET_TREND': {
          const { productId, platform, period } = message.payload as {
            productId: string;
            platform: PlatformId;
            period?: TrendPeriod;
          };
          const trendService = getTrendDetectionService();
          const trend = await trendService.analyzeTrend(productId, platform, period);
          return { success: true, data: trend };
        }

        case 'GET_BEST_BUY_TIME': {
          const { productId, platform } = message.payload as {
            productId: string;
            platform: PlatformId;
          };
          const trendService = getTrendDetectionService();
          const bestBuy = await trendService.findBestBuyTime(productId, platform);
          return { success: true, data: bestBuy };
        }

        case 'ANALYZE_ARBITRAGE': {
          const { products, sourcePlatform, targetPlatforms, minMargin } = message.payload as {
            products: PriceSnapshot[];
            sourcePlatform: PlatformId;
            targetPlatforms?: PlatformId[];
            minMargin?: number;
          };
          const analyzer = getArbitrageAnalyzer();
          const opportunities = await analyzer.findOpportunities(
            products,
            sourcePlatform,
            targetPlatforms,
            minMargin
          );
          return { success: true, data: opportunities };
        }

        case 'GET_OPPORTUNITIES': {
          const filters = (message.payload as ArbitrageFilters) || {};
          const analyzer = getArbitrageAnalyzer();
          const opportunities = await analyzer.getOpportunities(filters);
          return { success: true, data: opportunities };
        }

        case 'DISMISS_OPPORTUNITY': {
          const { opportunityId } = message.payload as { opportunityId: string };
          const analyzer = getArbitrageAnalyzer();
          await analyzer.dismissOpportunity(opportunityId);
          return { success: true };
        }

        case 'GET_ARBITRAGE_STATS': {
          const analyzer = getArbitrageAnalyzer();
          const stats = await analyzer.getStatistics();
          return { success: true, data: stats };
        }

        case 'GET_ARBITRAGE_SETTINGS': {
          const priceService = getPriceComparisonService();
          const settings = await priceService.getSettings();
          return { success: true, data: settings };
        }

        case 'UPDATE_ARBITRAGE_SETTINGS': {
          const settings = message.payload as Partial<ArbitrageSettings>;
          const priceService = getPriceComparisonService();
          await priceService.updateSettings(settings);
          return { success: true };
        }

        case 'CLEANUP_ARBITRAGE': {
          const analyzer = getArbitrageAnalyzer();
          const removedCount = await analyzer.cleanupOldOpportunities();
          return { success: true, data: { removedCount } };
        }

        default:
          return { success: false, error: 'Unknown message type' };
      }
    };

    handleMessage()
      .then(sendResponse)
      .catch((err) => {
        console.error('[Service Worker] Error handling message:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep channel open for async response
  }
);

// --- Context Menu ---

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'scrape-similar',
    title: 'Scrape Similar Items',
    contexts: ['all']
  });

  chrome.contextMenus.create({
    id: 'save-to-scraping-list',
    title: 'Save to Scraping List',
    contexts: ['page']
  });

  // Language learning context menu
  chrome.contextMenus.create({
    id: 'chinese-learn',
    title: '🈶 Chinese Learning',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'chinese-pronounce',
    parentId: 'chinese-learn',
    title: '🔊 Pronounce',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'chinese-meaning',
    parentId: 'chinese-learn',
    title: '📖 Show Meaning',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'chinese-both',
    parentId: 'chinese-learn',
    title: '🔊📖 Pronounce & Meaning',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'scrape-similar' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'START_SCRAPE_SELECTION'
    }).catch(() => {
      // Content script might not be ready or injected
      console.log('[Service Worker] Could not send message to tab');
    });
  } else if (
    (info.menuItemId === 'chinese-pronounce' ||
      info.menuItemId === 'chinese-meaning' ||
      info.menuItemId === 'chinese-both') &&
    tab?.id &&
    info.selectionText
  ) {
    // Send to content script for TTS and meaning lookup
    const action =
      info.menuItemId === 'chinese-pronounce'
        ? 'pronounce'
        : info.menuItemId === 'chinese-meaning'
          ? 'meaning'
          : 'both';

    chrome.tabs.sendMessage(tab.id, {
      type: 'CHINESE_LEARN',
      payload: {
        text: info.selectionText,
        action,
      },
    }).catch(() => {
      console.log('[Service Worker] Could not send Chinese learn message to tab');
    });
  } else if (info.menuItemId === 'save-to-scraping-list' && tab?.url) {
    // Save current page to scraping list
    const url = tab.url;
    const name = tab.title || new URL(url).hostname;
    const favicon = tab.favIconUrl;

    try {
      const savedUrl = await addSavedUrl(url, name, favicon);
      console.log('[Service Worker] Saved URL to scraping list:', savedUrl.name);

      // Show notification
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'URL Saved',
        message: `"${name}" added to scraping list`,
      });

      // Notify sidepanel to refresh saved URLs
      chrome.runtime.sendMessage({
        type: 'SAVED_URLS_UPDATED',
        payload: { savedUrl },
      }).catch(() => {
        // Sidepanel might not be open
      });
    } catch (error) {
      console.error('[Service Worker] Failed to save URL:', error);
    }
  }
});

// --- Extension Lifecycle ---

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Service Worker] Extension installed:', details.reason);

  // Reschedule all tasks on install/update
  await rescheduleAllTasks();

  // Enable Side Panel on Action Click
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

// Reschedule tasks when service worker starts
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Service Worker] Browser startup - rescheduling tasks');
  await rescheduleAllTasks();
});
