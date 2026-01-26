// Service worker for Chrome Extension
// Handles extension lifecycle, message routing, and scheduled task execution

import type { ScraperMessage, ScraperResponse, ExtractedItem } from '../types';

console.log('[Web Scraper] Service worker initialized');

// --- Types ---

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
}

// --- Storage Keys ---
const STORAGE_KEYS = {
  TASKS: 'scheduled-tasks',
  WEBHOOK: 'webhook-config',
  HISTORY: 'task-history',
  SETTINGS: 'web-scraper-settings',
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

function calculateNextRun(frequency: ScheduledTask['frequency']): string {
  const now = new Date();
  const minutes = frequencyToMinutes(frequency);
  now.setMinutes(now.getMinutes() + minutes);
  return now.toISOString();
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

// --- Scheduler Functions ---

async function scheduleTask(task: ScheduledTask): Promise<void> {
  if (!task.enabled) {
    console.log(`[Scheduler] Task ${task.id} is disabled, skipping`);
    return;
  }

  const periodInMinutes = frequencyToMinutes(task.frequency);

  // Create alarm for this task
  await chrome.alarms.create(task.id, {
    delayInMinutes: 1, // First run in 1 minute
    periodInMinutes,
  });

  console.log(`[Scheduler] Scheduled task ${task.id} to run every ${periodInMinutes} minutes`);
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

  try {
    // Find a tab with the target URL or create one
    let tabId: number | undefined;
    const tabs = await chrome.tabs.query({ url: task.url });

    if (tabs.length > 0 && tabs[0].id) {
      tabId = tabs[0].id;
    } else {
      // Create a new tab
      const tab = await chrome.tabs.create({ url: task.url, active: false });
      tabId = tab.id;

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
    await new Promise((resolve) => setTimeout(resolve, task.timeout * 1000));

    // Get the extracted data
    const exportResponse = await chrome.tabs.sendMessage(tabId, {
      type: 'EXPORT_DATA',
    } as ScraperMessage);

    const extractedData: ExtractedItem[] = exportResponse.data || [];

    // Stop the scrape
    await chrome.tabs.sendMessage(tabId, {
      type: 'STOP_SCRAPE',
    } as ScraperMessage);

    // Close the tab if we created it
    const createdTab = tabs.length === 0;
    if (createdTab && tabId) {
      await chrome.tabs.remove(tabId);
    }

    // Calculate duration
    const duration = Date.now() - startTime;

    // Update task status
    const updatedTasks = await getTasksFromStorage();
    const idx = updatedTasks.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      updatedTasks[idx].status = 'completed';
      updatedTasks[idx].lastRun = new Date().toISOString();
      updatedTasks[idx].nextRun = calculateNextRun(task.frequency);
      updatedTasks[idx].lastError = undefined;
      await saveTasksToStorage(updatedTasks);
    }

    // Add to history
    await addToHistory({
      taskId: task.id,
      taskName: task.name,
      runAt: new Date().toISOString(),
      status: 'success',
      itemsCollected: extractedData.length,
      duration,
    });

    // Send webhook notification
    await sendWebhookNotification(task, extractedData, true, duration);

    // Show notification
    await showNotification(
      `Task "${task.name}" completed`,
      `Collected ${extractedData.length} items in ${Math.round(duration / 1000)}s`
    );

    console.log(`[Scheduler] Task ${task.name} completed: ${extractedData.length} items`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Scheduler] Task ${task.name} failed:`, errorMessage);

    // Update task status
    const updatedTasks = await getTasksFromStorage();
    const idx = updatedTasks.findIndex(t => t.id === task.id);
    if (idx !== -1) {
      updatedTasks[idx].status = 'failed';
      updatedTasks[idx].lastRun = new Date().toISOString();
      updatedTasks[idx].nextRun = calculateNextRun(task.frequency);
      updatedTasks[idx].lastError = errorMessage;
      await saveTasksToStorage(updatedTasks);
    }

    // Add to history
    await addToHistory({
      taskId: task.id,
      taskName: task.name,
      runAt: new Date().toISOString(),
      status: 'failure',
      itemsCollected: 0,
      duration: Date.now() - startTime,
      error: errorMessage,
    });

    // Send failure webhook
    await sendWebhookNotification(task, [], false, Date.now() - startTime, errorMessage);

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
  error?: string
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
      success,
      timestamp: new Date().toISOString(),
      duration,
      itemsCollected: data.length,
    };

    if (error) {
      payload.error = error;
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
  (message: ScraperMessage, _sender, sendResponse: (response: ScraperResponse) => void) => {
    console.log('[Service Worker] Received message:', message.type);

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

// --- Extension Lifecycle ---

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Service Worker] Extension installed:', details.reason);

  // Reschedule all tasks on install/update
  await rescheduleAllTasks();
});

// Reschedule tasks when service worker starts
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Service Worker] Browser startup - rescheduling tasks');
  await rescheduleAllTasks();
});
