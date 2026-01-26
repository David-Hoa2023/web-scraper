// Content script entry point
// Integrates pattern detection, auto-scrolling, UI overlay, and recording

import type {
  PatternMatch,
  ScrollerState,
  ExtractedItem,
  ScraperMessage,
  ScraperResponse,
  ScrollerConfig,
  ExtractionConfig,
  RecordingSession,
} from '../types';
import {
  detectPattern,
  highlightPattern,
  hideHighlight,
  defaultConfig as defaultPatternConfig,
  setOnPatternClick,
} from './patternDetector';
import * as AutoScroller from './autoScroller';
import {
  createOverlay,
  updateProgress,
  updateStatus,
  updatePreview,
  showError,
  setButtonHandlers,
  isOverlayVisible,
} from '../ui/overlay';
import { extractData } from './dataExtractor';
import {
  createCaptureOrchestrator,
  type CaptureOrchestrator,
} from './recorder/captureOrchestrator';
import {
  showRecordingPanel,
  updateRecordingState,
  type RecordingPanelHandlers,
} from '../ui/recordingPanel';
import { showSettingsPanel } from '../ui/settingsPanel';
import { createContentGenerator } from './tutorial/contentGenerator';
import { exportToMarkdown } from './tutorial/exporters/markdown';
import { exportToPdf } from './tutorial/exporters/pdf';
import { exportToVideo } from './tutorial/exporters/video';
import type { GeneratedTutorial, ActionType } from '../types/tutorial';
import { DEFAULT_EXPORT_CONFIG } from '../types/tutorial';

console.log('[Web Scraper] Content script loaded');

// --- State Management ---
let currentPattern: PatternMatch | null = null;
let isPatternDetectionEnabled = true;

// Default layouts
let appConfig = {
  patternConfig: { ...defaultPatternConfig },
  scrollerConfig: {
    throttleMs: 1000,
    maxItems: 0,
    retryCount: 3,
    retryDelayMs: 2000
  } as ScrollerConfig,
  extractionConfig: {
    fields: [],
    preserveHierarchy: false,
    normalize: true
  } as ExtractionConfig
};

// --- Recording State ---
let captureOrchestrator: CaptureOrchestrator | null = null;
let currentRecordingSession: RecordingSession | null = null;

// --- Helper Functions ---

function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// --- Pattern Detection Logic ---

const handleMouseOver = debounce((event: MouseEvent) => {
  if (!isPatternDetectionEnabled) return;

  const target = event.target as Element;
  if (!target || target.nodeType !== Node.ELEMENT_NODE) return;

  // Ignore overlay and badge
  if (target.closest('#web-scraper-pattern-overlay') || target.closest('#web-scraper-shadow-host')) {
    return;
  }

  const match = detectPattern(target, appConfig.patternConfig);

  if (match) {
    currentPattern = match;
    highlightPattern(match);
  } else {
    currentPattern = null;
    hideHighlight();
  }
}, 50);

function handleMouseOut(event: MouseEvent) {
  const relatedTarget = event.relatedTarget as Element | null;
  if (!relatedTarget || !document.body.contains(relatedTarget)) {
    hideHighlight();
  }
}

function initPatternDetection() {
  document.addEventListener('mouseover', handleMouseOver, { passive: true });
  document.addEventListener('mouseout', handleMouseOut, { passive: true });

  // Register click handler for pattern overlay
  setOnPatternClick(() => {
    if (currentPattern) {
      console.log('[Web Scraper] Pattern clicked, starting scrape');
      handleStartScrape();
    }
  });

  console.log('[Web Scraper] Pattern detection active');
}

function cleanupPatternDetection() {
  document.removeEventListener('mouseover', handleMouseOver);
  document.removeEventListener('mouseout', handleMouseOut);
  setOnPatternClick(null);
  hideHighlight();
  console.log('[Web Scraper] Pattern detection paused');
}

// --- Data Storage ---
let collectedData: ExtractedItem[] = [];
let seenElements = new WeakSet<Element>();

// --- Scraper Integration ---

function extractFromCurrentPattern() {
  if (!currentPattern) return;

  // Extract data from all siblings that haven't been processed yet
  for (const element of currentPattern.siblings) {
    if (!seenElements.has(element)) {
      seenElements.add(element);
      const extracted = extractData(element, appConfig.extractionConfig);
      collectedData.push(extracted);
    }
  }
}

function extractWithHeuristics() {
  // Use common item selectors to find elements
  const selectors = [
    'article',
    '[data-testid*="item"]',
    '[data-testid*="card"]',
    '.item',
    '.card',
    '.post',
    '.entry',
    'li:has(a)',
  ];

  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 3) {
        elements.forEach((el) => {
          if (!seenElements.has(el)) {
            seenElements.add(el);
            const extracted = extractData(el, appConfig.extractionConfig);
            if (extracted.text || extracted.link || extracted.title) {
              collectedData.push(extracted);
            }
          }
        });
        break; // Use first matching selector
      }
    } catch {
      // Continue to next selector
    }
  }
}

function onScrollerProgress(state: ScrollerState) {
  // Update UI
  updateStatus(state.status);
  updateProgress(state.itemsCollected, appConfig.scrollerConfig.maxItems || 0);

  if (state.errors.length > 0) {
    showError(state.errors[state.errors.length - 1]);
  }

  // Extract data based on pattern or heuristics
  if (currentPattern) {
    extractFromCurrentPattern();
  } else {
    extractWithHeuristics();
  }

  // Update preview with last 5 items
  updatePreview(collectedData.slice(-5));
}

// --- Message Handling ---

chrome.runtime.onMessage.addListener(
  (message: ScraperMessage, _sender, sendResponse: (response: ScraperResponse) => void) => {
    console.log('[Content] Received:', message.type, message.payload);

    try {
      switch (message.type) {
        case 'START_SCRAPE':
          handleStartScrape();
          sendResponse({ success: true, data: { status: 'running' } });
          break;

        case 'PAUSE_SCRAPE':
          AutoScroller.pauseScroll();
          sendResponse({ success: true, data: { status: 'paused' } });
          break;

        case 'RESUME_SCRAPE':
          AutoScroller.resumeScroll();
          sendResponse({ success: true, data: { status: 'running' } });
          break;

        case 'STOP_SCRAPE':
          handleStopScrape();
          sendResponse({ success: true, data: { status: 'idle' } });
          break;

        case 'GET_STATUS': {
          const state = AutoScroller.getState();
          sendResponse({
            success: true,
            data: {
              status: state.status,
              itemsCollected: state.itemsCollected
            }
          });
          break;
        }

        case 'UPDATE_CONFIG':
          if (message.payload) {
            appConfig = { ...appConfig, ...(message.payload as any) };
            console.log('[Content] Config updated', appConfig);
          }
          sendResponse({ success: true });
          break;

        case 'EXPORT_DATA':
          console.log('[Content] Exporting data:', collectedData.length, 'items');
          sendResponse({
            success: true,
            data: collectedData
          });
          break;

        case 'CLEAR_DATA':
          collectedData = [];
          seenElements = new WeakSet<Element>();
          console.log('[Content] Data cleared');
          sendResponse({ success: true });
          break;

        // --- Recording Messages ---
        case 'START_RECORDING':
          handleStartRecording(message.payload as any)
            .then(() => sendResponse({ success: true, data: { status: 'recording' } }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
          return true; // Async response

        case 'PAUSE_RECORDING':
          handlePauseRecording();
          sendResponse({ success: true, data: { status: 'paused' } });
          break;

        case 'RESUME_RECORDING':
          handleResumeRecording();
          sendResponse({ success: true, data: { status: 'recording' } });
          break;

        case 'STOP_RECORDING':
          handleStopRecording()
            .then((session) => sendResponse({ success: true, data: session }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
          return true; // Async response

        case 'GET_RECORDING_STATUS':
          sendResponse({
            success: true,
            data: captureOrchestrator?.getState() || { status: 'idle' }
          });
          break;

        // --- Tutorial Messages ---
        case 'GENERATE_TUTORIAL':
          handleGenerateTutorial(message.payload as any)
            .then((content) => sendResponse({ success: true, data: content }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
          return true; // Async response

        case 'EXPORT_TUTORIAL':
          handleExportTutorial(message.payload as any)
            .then(() => sendResponse({ success: true }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
          return true; // Async response

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (e: any) {
      console.error('[Content] Error handling message:', e);
      sendResponse({ success: false, error: e.message });
    }

    // Return true to indicate async response might be used (though we send immediately)
    return true;
  }
);

// --- Action Handlers ---

function handleStartScrape() {
  // Pattern is optional - can work with heuristics if not set
  if (currentPattern) {
    console.log('[Content] Starting scrape with pattern:', currentPattern);
  } else {
    console.log('[Content] Starting scrape with heuristic detection (no pattern selected)');
  }

  // 1. Disable hover detection so it doesn't interfere
  isPatternDetectionEnabled = false;
  cleanupPatternDetection();

  // 2. Initialize and show Overlay
  if (!isOverlayVisible()) {
    createOverlay();

    // Wire up Overlay Buttons to Logic
    setButtonHandlers({
      onStart: () => { }, // Disabled loops
      onPause: () => AutoScroller.pauseScroll(),
      onResume: () => AutoScroller.resumeScroll(),
      onStop: handleStopScrape
    });
  }

  updateStatus('running');

  // 3. Start Scroller
  // Hook up progress
  AutoScroller.onScrollProgress(onScrollerProgress);

  try {
    AutoScroller.startScroll(appConfig.scrollerConfig);
  } catch (e: any) {
    showError(e.message);
    updateStatus('error');
  }
}

function handleStopScrape() {
  AutoScroller.stopScroll();
  AutoScroller.offScrollProgress(onScrollerProgress); // Cleanup listeners

  // Re-enable pattern detection
  isPatternDetectionEnabled = true;
  initPatternDetection();

  console.log('[Content] Scrape stopped');
}

// --- Recording Handlers ---

async function handleStartRecording(config?: any): Promise<void> {
  console.log('[Content] Starting recording...');

  // Create capture orchestrator if not exists
  if (!captureOrchestrator) {
    captureOrchestrator = createCaptureOrchestrator();
  }

  // Subscribe to state changes and update UI
  captureOrchestrator.onStateChange((state) => {
    updateRecordingState(state);
  });

  // Show recording panel with handlers
  const panelHandlers: RecordingPanelHandlers = {
    onStart: async (cfg) => {
      await captureOrchestrator?.start(cfg);
    },
    onPause: () => {
      captureOrchestrator?.pause();
    },
    onResume: () => {
      captureOrchestrator?.resume();
    },
    onStop: async () => {
      await handleStopRecording();
    },
    onExport: async (format) => {
      await handleExportTutorial({ format });
    },
    onSettingsOpen: () => {
      showSettingsPanel({
        onSave: (settings) => {
          console.log('[Content] Settings saved:', settings);
        },
        onClose: () => {
          console.log('[Content] Settings closed');
        },
      });
    },
  };

  showRecordingPanel(panelHandlers);

  // Start the capture
  await captureOrchestrator.start(config);
  console.log('[Content] Recording started');
}

function handlePauseRecording(): void {
  if (captureOrchestrator?.isRecording()) {
    captureOrchestrator.pause();
    console.log('[Content] Recording paused');
  }
}

function handleResumeRecording(): void {
  if (captureOrchestrator?.isPaused()) {
    captureOrchestrator.resume();
    console.log('[Content] Recording resumed');
  }
}

async function handleStopRecording(): Promise<RecordingSession | null> {
  if (!captureOrchestrator) {
    return null;
  }

  try {
    const session = await captureOrchestrator.stop();
    currentRecordingSession = session;
    console.log('[Content] Recording stopped, session:', session.id);
    console.log('[Content] Events captured:', session.domEvents.length);
    console.log('[Content] Cursor frames:', session.cursorFrames.length);
    return session;
  } catch (error) {
    console.error('[Content] Error stopping recording:', error);
    throw error;
  }
}

// --- Tutorial Handlers ---

async function handleGenerateTutorial(options?: {
  llmConfig?: any;
}): Promise<GeneratedTutorial> {
  if (!currentRecordingSession) {
    throw new Error('No recording session available');
  }

  console.log('[Content] Generating tutorial content...');

  // Get LLM config from storage
  const stored = await chrome.storage.local.get('web-scraper-settings');
  const settings = stored['web-scraper-settings'];
  const llmConfig = options?.llmConfig || settings?.llm;

  if (!llmConfig?.apiKey) {
    // Generate without LLM - use basic template
    console.log('[Content] No LLM API key, using template-based generation');
    return generateBasicTutorial(currentRecordingSession);
  }

  const generator = createContentGenerator();
  const result = await generator.generate(currentRecordingSession, llmConfig);

  if (!result.tutorial) {
    throw new Error('Failed to generate tutorial');
  }

  console.log('[Content] Tutorial content generated');
  return result.tutorial;
}

function mapEventTypeToActionType(eventType: string): ActionType {
  switch (eventType) {
    case 'click':
    case 'dblclick':
      return 'click';
    case 'input':
    case 'change':
      return 'type';
    case 'scroll':
      return 'scroll';
    case 'hover':
      return 'hover';
    case 'select':
      return 'select';
    default:
      return 'click';
  }
}

function generateBasicTutorial(session: RecordingSession): GeneratedTutorial {
  const steps = session.domEvents.map((event, index) => {
    let action = '';
    const targetText = event.target.textContent || event.target.selector;
    const actionType = mapEventTypeToActionType(event.type);

    switch (event.type) {
      case 'click':
        action = `Click on **${targetText}**`;
        break;
      case 'input':
      case 'change':
        action = `Enter "${event.target.value || ''}" in the ${event.target.selector} field`;
        break;
      case 'scroll':
        action = 'Scroll the page';
        break;
      default:
        action = `${event.type} on ${event.target.selector}`;
    }

    return {
      stepNumber: index + 1,
      action,
      actionType,
      targetSelector: event.target.selector,
      timestamp: event.timestamp,
    };
  });

  return {
    id: `tutorial_${session.id}`,
    title: session.metadata.title,
    description: `Tutorial recorded from ${session.metadata.url}`,
    steps,
    sourceRecording: session.id,
    generatedAt: new Date().toISOString(),
    tags: ['auto-generated'],
  };
}

async function handleExportTutorial(options: {
  format: 'markdown' | 'pdf' | 'video';
}): Promise<void> {
  if (!currentRecordingSession) {
    throw new Error('No recording session available');
  }

  console.log('[Content] Exporting tutorial as:', options.format);

  const exportConfig = {
    ...DEFAULT_EXPORT_CONFIG,
    format: options.format,
  };

  switch (options.format) {
    case 'markdown': {
      const tutorial = await handleGenerateTutorial();
      const result = exportToMarkdown(tutorial, exportConfig);
      const blob = new Blob([result.content], { type: result.mimeType });
      downloadBlob(blob, result.filename);
      break;
    }
    case 'pdf': {
      const tutorial = await handleGenerateTutorial();
      const result = await exportToPdf(tutorial, exportConfig);
      const blob = new Blob([result.content], { type: result.mimeType });
      downloadBlob(blob, result.filename);
      break;
    }
    case 'video': {
      if (!currentRecordingSession.videoBlob) {
        throw new Error('No video recorded');
      }
      const tutorial = await handleGenerateTutorial();
      const result = await exportToVideo(currentRecordingSession, tutorial, exportConfig);
      const blob = new Blob([result.content], { type: result.mimeType });
      downloadBlob(blob, result.filename);
      break;
    }
  }

  console.log('[Content] Export complete');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Initialization ---

async function init() {
  // Load saved config
  const saved = await chrome.storage.local.get('scraperConfig');
  if (saved.scraperConfig) {
    appConfig = { ...appConfig, ...saved.scraperConfig };
  }

  initPatternDetection();
}

init();

// Cleanup on unload
window.addEventListener('unload', () => {
  cleanupPatternDetection();
  AutoScroller.stopScroll();
});
