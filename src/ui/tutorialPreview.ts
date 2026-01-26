/**
 * Tutorial Preview Panel UI Component
 * Displays generated tutorial content before export
 */

import type { GeneratedTutorial, TutorialStep } from '../types/tutorial';

// Constants
const PREVIEW_ID = 'web-scraper-tutorial-preview';

// State
let shadowRoot: ShadowRoot | null = null;
let currentTutorial: GeneratedTutorial | null = null;

/**
 * Preview panel event handlers
 */
export interface TutorialPreviewHandlers {
  onExport: (format: 'markdown' | 'pdf' | 'video') => void;
  onEdit: (stepIndex: number, field: string, value: string) => void;
  onClose: () => void;
  onRegenerate: () => void;
}

let handlers: TutorialPreviewHandlers | null = null;

/**
 * Gets the preview panel styles
 */
function getStyles(): string {
  return `
    :host {
      all: initial;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483646;
      backdrop-filter: blur(4px);
    }

    .panel {
      width: 90%;
      max-width: 800px;
      max-height: 90vh;
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.1);
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
      background: #1e293b;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .title {
      font-size: 18px;
      font-weight: 600;
      color: #ffffff;
    }

    .subtitle {
      font-size: 13px;
      color: #9ca3af;
    }

    .header-buttons {
      display: flex;
      gap: 8px;
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover {
      background: #2563eb;
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .btn-icon {
      width: 32px;
      height: 32px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .btn-icon:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .meta {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 20px;
      font-size: 12px;
      color: #9ca3af;
    }

    .meta-item svg {
      width: 14px;
      height: 14px;
    }

    .description {
      font-size: 15px;
      color: #d1d5db;
      line-height: 1.6;
      margin-bottom: 24px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      border-left: 3px solid #3b82f6;
    }

    .steps {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .step {
      display: flex;
      gap: 16px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      transition: all 0.2s;
    }

    .step:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .step-number {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #3b82f6;
      color: white;
      font-size: 14px;
      font-weight: 600;
      border-radius: 50%;
    }

    .step-content {
      flex: 1;
      min-width: 0;
    }

    .step-action {
      font-size: 15px;
      font-weight: 500;
      color: #ffffff;
      margin-bottom: 4px;
    }

    .step-target {
      font-size: 13px;
      color: #9ca3af;
      margin-bottom: 8px;
    }

    .step-details {
      font-size: 13px;
      color: #6b7280;
      font-style: italic;
    }

    .step-screenshot {
      flex-shrink: 0;
      width: 120px;
      height: 80px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      overflow: hidden;
    }

    .step-screenshot img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .step-actions {
      display: flex;
      gap: 4px;
      margin-top: 8px;
    }

    .step-action-btn {
      padding: 4px 8px;
      font-size: 11px;
      background: rgba(255, 255, 255, 0.05);
      border: none;
      color: #9ca3af;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .step-action-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    .tags {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }

    .tag {
      padding: 4px 10px;
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      font-size: 12px;
      border-radius: 12px;
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: #1e293b;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .export-buttons {
      display: flex;
      gap: 8px;
    }

    .export-btn {
      padding: 10px 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: transparent;
      color: #ffffff;
      font-size: 13px;
      font-weight: 500;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .export-btn:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .export-btn.primary {
      background: #22c55e;
      border-color: #22c55e;
    }

    .export-btn.primary:hover {
      background: #16a34a;
    }

    .action-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      font-size: 11px;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-left: 8px;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: #9ca3af;
    }

    .empty-state svg {
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-state h3 {
      font-size: 18px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 8px;
    }

    .empty-state p {
      font-size: 14px;
      max-width: 300px;
      margin: 0 auto;
    }

    .difficulty-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .difficulty-beginner {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }

    .difficulty-intermediate {
      background: rgba(245, 158, 11, 0.2);
      color: #f59e0b;
    }

    .difficulty-advanced {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }
  `;
}

/**
 * Creates step HTML
 */
function createStepHTML(step: TutorialStep, index: number): string {
  return `
    <div class="step" data-step="${index}">
      <div class="step-number">${step.stepNumber}</div>
      <div class="step-content">
        <div class="step-action">
          ${escapeHtml(step.action)}
          <span class="action-badge">${step.actionType}</span>
        </div>
        ${step.target ? `<div class="step-target">${escapeHtml(step.target)}</div>` : ''}
        ${step.details ? `<div class="step-details">${escapeHtml(step.details)}</div>` : ''}
        <div class="step-actions">
          <button class="step-action-btn" data-action="edit" data-step="${index}">Edit</button>
          ${step.expectedResult ? `<button class="step-action-btn" data-action="expected">Show Expected</button>` : ''}
        </div>
      </div>
      ${step.screenshot ? `
        <div class="step-screenshot">
          <img src="${step.screenshot}" alt="Step ${step.stepNumber} screenshot">
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Creates the preview panel HTML
 */
function createPreviewHTML(tutorial: GeneratedTutorial): string {
  const difficultyClass = `difficulty-${tutorial.difficulty || 'intermediate'}`;

  return `
    <div class="overlay" id="preview-overlay">
      <div class="panel">
        <div class="header">
          <div class="header-left">
            <div class="title">${escapeHtml(tutorial.title)}</div>
            <div class="subtitle">
              ${tutorial.steps.length} steps · ${tutorial.estimatedTime || 5} min read
            </div>
          </div>
          <div class="header-buttons">
            <button class="btn btn-secondary" id="regenerate-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 21h5v-5"/>
              </svg>
              Regenerate
            </button>
            <button class="btn-icon" id="close-btn" title="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="content">
          <div class="meta">
            <div class="meta-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              ${new Date(tutorial.generatedAt).toLocaleDateString()}
            </div>
            ${tutorial.llmModel ? `
              <div class="meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
                ${tutorial.llmModel}
              </div>
            ` : ''}
            <div class="meta-item">
              <span class="difficulty-badge ${difficultyClass}">${tutorial.difficulty || 'intermediate'}</span>
            </div>
          </div>

          ${tutorial.tags && tutorial.tags.length > 0 ? `
            <div class="tags">
              ${tutorial.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}

          <div class="description">${escapeHtml(tutorial.description)}</div>

          <div class="steps">
            ${tutorial.steps.map((step, index) => createStepHTML(step, index)).join('')}
          </div>
        </div>

        <div class="footer">
          <div class="export-buttons">
            <button class="export-btn" id="export-md-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              Markdown
            </button>
            <button class="export-btn" id="export-pdf-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              PDF
            </button>
            <button class="export-btn primary" id="export-video-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              Export Video
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Creates empty state HTML
 */
function createEmptyStateHTML(): string {
  return `
    <div class="overlay" id="preview-overlay">
      <div class="panel">
        <div class="header">
          <div class="header-left">
            <div class="title">Tutorial Preview</div>
          </div>
          <div class="header-buttons">
            <button class="btn-icon" id="close-btn" title="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="content">
          <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <h3>No Tutorial Generated</h3>
            <p>Record some interactions first, then generate a tutorial to preview it here.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sets up event listeners for the preview panel
 */
function setupEventListeners(): void {
  if (!shadowRoot) return;

  const overlay = shadowRoot.getElementById('preview-overlay');
  const closeBtn = shadowRoot.getElementById('close-btn');
  const regenerateBtn = shadowRoot.getElementById('regenerate-btn');
  const exportMdBtn = shadowRoot.getElementById('export-md-btn');
  const exportPdfBtn = shadowRoot.getElementById('export-pdf-btn');
  const exportVideoBtn = shadowRoot.getElementById('export-video-btn');

  // Close on overlay click
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) {
      handlers?.onClose();
      hideTutorialPreview();
    }
  });

  // Close button
  closeBtn?.addEventListener('click', () => {
    handlers?.onClose();
    hideTutorialPreview();
  });

  // Regenerate
  regenerateBtn?.addEventListener('click', () => {
    handlers?.onRegenerate();
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

  // Edit step buttons
  const editButtons = shadowRoot.querySelectorAll('[data-action="edit"]');
  editButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const stepIndex = parseInt(btn.getAttribute('data-step') || '0', 10);
      // For now, just log - full edit modal would be added in Stage 10
      console.log('[TutorialPreview] Edit step', stepIndex);
    });
  });
}

/**
 * Shows the tutorial preview panel
 */
export function showTutorialPreview(
  tutorial: GeneratedTutorial | null,
  previewHandlers: TutorialPreviewHandlers
): void {
  handlers = previewHandlers;
  currentTutorial = tutorial;

  // Remove existing preview if any
  const existing = document.getElementById(PREVIEW_ID);
  if (existing) {
    existing.remove();
  }

  // Create shadow host
  const host = document.createElement('div');
  host.id = PREVIEW_ID;
  document.body.appendChild(host);

  // Create shadow root
  shadowRoot = host.attachShadow({ mode: 'closed' });

  // Add styles
  const style = document.createElement('style');
  style.textContent = getStyles();
  shadowRoot.appendChild(style);

  // Add content
  const content = document.createElement('div');
  content.innerHTML = tutorial ? createPreviewHTML(tutorial) : createEmptyStateHTML();
  shadowRoot.appendChild(content);

  // Setup event listeners
  setupEventListeners();

  console.log('[TutorialPreview] Preview shown');
}

/**
 * Hides the tutorial preview panel
 */
export function hideTutorialPreview(): void {
  const host = document.getElementById(PREVIEW_ID);
  if (host) {
    host.remove();
  }
  shadowRoot = null;
  handlers = null;
  currentTutorial = null;
  console.log('[TutorialPreview] Preview hidden');
}

/**
 * Updates the tutorial content in the preview
 */
export function updateTutorialContent(tutorial: GeneratedTutorial): void {
  currentTutorial = tutorial;

  if (!shadowRoot) return;

  const content = shadowRoot.querySelector('.overlay')?.parentElement;
  if (!content) return;

  content.innerHTML = createPreviewHTML(tutorial);
  setupEventListeners();
}

/**
 * Gets the current tutorial being previewed
 */
export function getCurrentTutorial(): GeneratedTutorial | null {
  return currentTutorial;
}
