/**
 * Tutorial Types for Hexus Integration
 * Handles LLM content generation and export functionality
 */

import type { RecordingSession, DomEvent } from './recording';

// ============================================================================
// Tutorial Step Types
// ============================================================================

export type ActionType =
  | 'click'
  | 'type'
  | 'scroll'
  | 'navigate'
  | 'select'
  | 'hover'
  | 'wait'
  | 'verify';

export interface TutorialStep {
  /** Step number (1-indexed) */
  stepNumber: number;
  /** Human-readable action description */
  action: string;
  /** Action type for categorization */
  actionType: ActionType;
  /** Target element description (e.g., "the Search button") */
  target?: string;
  /** CSS selector for the target element */
  targetSelector?: string;
  /** Screenshot data URL for this step */
  screenshot?: string;
  /** Timestamp in the recording (ms) */
  timestamp: number;
  /** Additional context or details */
  details?: string;
  /** Input value if applicable (for type actions) */
  inputValue?: string;
  /** Expected result or verification */
  expectedResult?: string;
  /** Warning or note for the user */
  note?: string;
}

// ============================================================================
// Generated Tutorial Types
// ============================================================================

export interface GeneratedTutorial {
  /** Unique tutorial identifier */
  id: string;
  /** Tutorial title */
  title: string;
  /** Brief description of what the tutorial covers */
  description: string;
  /** Ordered list of tutorial steps */
  steps: TutorialStep[];
  /** ID of the source recording session */
  sourceRecording: string;
  /** ISO timestamp when tutorial was generated */
  generatedAt: string;
  /** LLM model used for generation */
  llmModel?: string;
  /** Tags for categorization */
  tags: string[];
  /** Estimated time to complete (minutes) */
  estimatedTime?: number;
  /** Difficulty level */
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

// ============================================================================
// LLM Configuration
// ============================================================================

export type LLMProvider = 'openai' | 'anthropic' | 'custom';

export interface LLMConfig {
  /** LLM provider */
  provider: LLMProvider;
  /** API key (stored securely) */
  apiKey: string;
  /** Model identifier */
  model: string;
  /** Custom endpoint for self-hosted or alternative providers */
  endpoint?: string;
  /** Maximum tokens in response */
  maxTokens: number;
  /** Temperature for generation (0-2) */
  temperature: number;
  /** System prompt override */
  systemPrompt?: string;
}

export const DEFAULT_LLM_CONFIG: Omit<LLMConfig, 'apiKey'> = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  maxTokens: 2000,
  temperature: 0.7,
};

export const LLM_ENDPOINTS: Record<LLMProvider, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  custom: '',
};

// ============================================================================
// LLM Prompt Types
// ============================================================================

export interface PromptContext {
  /** Page URL */
  url: string;
  /** Page title */
  title: string;
  /** Number of actions recorded */
  actionCount: number;
  /** Types of actions performed */
  actionTypes: ActionType[];
  /** Key elements interacted with */
  keyElements: string[];
}

export interface PromptTemplate {
  /** Template identifier */
  id: string;
  /** Template name */
  name: string;
  /** System prompt for LLM */
  systemPrompt: string;
  /** User prompt template (with placeholders) */
  userPromptTemplate: string;
  /** Output format instructions */
  outputFormat: string;
}

export const DEFAULT_PROMPT_TEMPLATE: PromptTemplate = {
  id: 'default',
  name: 'Standard Tutorial',
  systemPrompt: `You are a technical writer creating clear, step-by-step tutorials.
Your tutorials should be:
- Easy to follow for beginners
- Precise about which elements to interact with
- Written in active voice ("Click the button" not "The button should be clicked")
- Include helpful tips where appropriate`,
  userPromptTemplate: `Create a tutorial for the following recorded browser interaction:

Page: {{title}} ({{url}})
Actions recorded: {{actionCount}}

Actions performed:
{{actions}}

Generate a clear, numbered tutorial with:
1. A descriptive title
2. A brief introduction
3. Step-by-step instructions
4. Tips or warnings where appropriate`,
  outputFormat: 'Return the tutorial in JSON format matching the TutorialStep[] structure.',
};

// ============================================================================
// Export Configuration
// ============================================================================

export type ExportFormat = 'markdown' | 'pdf' | 'video' | 'html' | 'json';

export type CursorStyle = 'dot' | 'arrow' | 'highlight' | 'circle';

export interface ExportConfig {
  /** Export format */
  format: ExportFormat;
  /** Include screenshots in export */
  includeScreenshots: boolean;
  /** Include cursor visualization in video export */
  includeCursor: boolean;
  /** Cursor style for video export */
  cursorStyle: CursorStyle;
  /** Cursor color (hex) */
  cursorColor: string;
  /** Cursor size (px) */
  cursorSize: number;
  /** Include step numbers */
  includeStepNumbers: boolean;
  /** Include timestamps */
  includeTimestamps: boolean;
  /** Custom CSS for HTML/PDF export */
  customCss?: string;
  /** PDF page size */
  pdfPageSize?: 'a4' | 'letter' | 'legal';
  /** Video playback speed multiplier */
  videoSpeed?: number;
}

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  format: 'markdown',
  includeScreenshots: true,
  includeCursor: true,
  cursorStyle: 'highlight',
  cursorColor: '#00ff88',
  cursorSize: 20,
  includeStepNumbers: true,
  includeTimestamps: false,
  pdfPageSize: 'a4',
  videoSpeed: 1,
};

// ============================================================================
// Export Result Types
// ============================================================================

export interface ExportResult {
  /** Export format used */
  format: ExportFormat;
  /** Exported content (string for text formats, blob for binary) */
  content: string | Blob;
  /** MIME type of the content */
  mimeType: string;
  /** Suggested filename */
  filename: string;
  /** Size in bytes */
  size: number;
  /** Export timestamp */
  exportedAt: string;
}

export const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  markdown: 'text/markdown',
  pdf: 'application/pdf',
  video: 'video/webm',
  html: 'text/html',
  json: 'application/json',
};

// ============================================================================
// Content Generation Types
// ============================================================================

export interface GenerationProgress {
  /** Current stage */
  stage: 'parsing' | 'generating' | 'formatting' | 'complete' | 'error';
  /** Progress percentage (0-100) */
  progress: number;
  /** Current step description */
  message: string;
  /** Error message if stage is 'error' */
  error?: string;
}

export interface GenerationResult {
  success: boolean;
  tutorial?: GeneratedTutorial;
  error?: string;
  /** Token usage for cost tracking */
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  /** Generation duration (ms) */
  duration: number;
}

// ============================================================================
// Action Parsing Types
// ============================================================================

export interface ParsedAction {
  /** Original DOM event */
  event: DomEvent;
  /** Human-readable action description */
  description: string;
  /** Action type */
  type: ActionType;
  /** Target element description */
  targetDescription: string;
  /** Whether this action is significant (not filtered) */
  isSignificant: boolean;
  /** Grouped with previous action (e.g., multiple keystrokes) */
  groupedWith?: number;
}

export interface ActionParserConfig {
  /** Minimum hover duration to record (ms) */
  minHoverDuration: number;
  /** Group rapid keystrokes into single "type" action */
  groupKeystrokes: boolean;
  /** Maximum time between keystrokes to group (ms) */
  keystrokeGroupingThreshold: number;
  /** Filter out scroll events that don't result in new content */
  filterMinorScrolls: boolean;
  /** Minimum scroll distance to record (px) */
  minScrollDistance: number;
}

export const DEFAULT_ACTION_PARSER_CONFIG: ActionParserConfig = {
  minHoverDuration: 500,
  groupKeystrokes: true,
  keystrokeGroupingThreshold: 200,
  filterMinorScrolls: true,
  minScrollDistance: 100,
};

// ============================================================================
// Callbacks
// ============================================================================

export type GenerationProgressCallback = (progress: GenerationProgress) => void;
export type ExportProgressCallback = (progress: number) => void;

// ============================================================================
// Storage Types
// ============================================================================

export interface StoredTutorial {
  tutorial: GeneratedTutorial;
  recording?: RecordingSession;
  exports: ExportResult[];
  createdAt: string;
  updatedAt: string;
}

export interface TutorialStorageConfig {
  /** Maximum number of tutorials to store */
  maxTutorials: number;
  /** Maximum storage size (bytes) */
  maxStorageSize: number;
  /** Auto-delete after days (0 = never) */
  autoDeleteAfterDays: number;
}

export const DEFAULT_TUTORIAL_STORAGE_CONFIG: TutorialStorageConfig = {
  maxTutorials: 50,
  maxStorageSize: 100 * 1024 * 1024, // 100MB
  autoDeleteAfterDays: 30,
};
