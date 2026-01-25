// Service worker for Chrome Extension
// Handles extension lifecycle and message routing

import type { ScraperMessage, ScraperResponse } from '../types';

console.log('[Web Scraper] Service worker initialized');

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(
  (message: ScraperMessage, _sender, sendResponse: (response: ScraperResponse) => void) => {
    console.log('[Service Worker] Received message:', message.type);

    switch (message.type) {
      case 'GET_STATUS':
        sendResponse({ success: true, data: { status: 'idle' } });
        break;
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }

    return true; // Keep channel open for async response
  }
);

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Service Worker] Extension installed:', details.reason);
});
