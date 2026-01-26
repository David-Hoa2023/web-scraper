/**
 * Content Generator
 * Uses LLM to generate instructional content from recorded interactions
 */

import type { RecordingSession, DomEvent } from '../../types/recording';
import type {
  GeneratedTutorial,
  LLMConfig,
  PromptContext,
  PromptTemplate,
  GenerationResult,
  GenerationProgress,
  GenerationProgressCallback,
  TutorialStep,
  ActionType,
} from '../../types/tutorial';

import {
  DEFAULT_PROMPT_TEMPLATE,
  DEFAULT_LLM_CONFIG,
  LLM_ENDPOINTS,
} from '../../types/tutorial';

import { createActionParser } from './actionParser';

export interface ContentGenerator {
  /** Generate a tutorial from a recording session */
  generate(
    session: RecordingSession,
    config: LLMConfig
  ): Promise<GenerationResult>;
  /** Generate with progress callbacks */
  generateWithProgress(
    session: RecordingSession,
    config: LLMConfig,
    onProgress: GenerationProgressCallback
  ): Promise<GenerationResult>;
  /** Build prompt from events */
  buildPrompt(session: RecordingSession, template?: PromptTemplate): string;
  /** Set custom prompt template */
  setTemplate(template: PromptTemplate): void;
  /** Get current template */
  getTemplate(): PromptTemplate;
}

/**
 * Create a new content generator instance
 */
export function createContentGenerator(): ContentGenerator {
  let template: PromptTemplate = { ...DEFAULT_PROMPT_TEMPLATE };
  const actionParser = createActionParser();

  function setTemplate(newTemplate: PromptTemplate): void {
    template = { ...newTemplate };
  }

  function getTemplate(): PromptTemplate {
    return { ...template };
  }

  function buildPrompt(session: RecordingSession, customTemplate?: PromptTemplate): string {
    const currentTemplate = customTemplate || template;
    const context = buildPromptContext(session);

    // Parse actions to get human-readable descriptions
    const steps = actionParser.parse(session.domEvents);
    const actionsText = steps
      .map((step, i) => `${i + 1}. ${step.action}`)
      .join('\n');

    // Replace placeholders in template
    let userPrompt = currentTemplate.userPromptTemplate;
    userPrompt = userPrompt.replace('{{title}}', context.title);
    userPrompt = userPrompt.replace('{{url}}', context.url);
    userPrompt = userPrompt.replace('{{actionCount}}', String(context.actionCount));
    userPrompt = userPrompt.replace('{{actions}}', actionsText);

    return userPrompt;
  }

  async function generate(
    session: RecordingSession,
    config: LLMConfig
  ): Promise<GenerationResult> {
    return generateWithProgress(session, config, () => {});
  }

  async function generateWithProgress(
    session: RecordingSession,
    config: LLMConfig,
    onProgress: GenerationProgressCallback
  ): Promise<GenerationResult> {
    const startTime = Date.now();

    try {
      // Stage 1: Parsing
      emitProgress(onProgress, {
        stage: 'parsing',
        progress: 10,
        message: 'Parsing recorded actions...',
      });

      const parsedSteps = actionParser.parse(session.domEvents);
      if (parsedSteps.length === 0) {
        return {
          success: false,
          error: 'No actions recorded to generate tutorial from',
          duration: Date.now() - startTime,
        };
      }

      // Stage 2: Building prompt
      emitProgress(onProgress, {
        stage: 'generating',
        progress: 30,
        message: 'Building LLM prompt...',
      });

      const prompt = buildPrompt(session);
      const promptTokens = estimateTokens(prompt);

      // Stage 3: Calling LLM
      emitProgress(onProgress, {
        stage: 'generating',
        progress: 50,
        message: `Calling ${config.provider} API...`,
      });

      let response: string;
      try {
        response = await callLLM(prompt, template.systemPrompt, config);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'LLM API call failed';
        emitProgress(onProgress, {
          stage: 'error',
          progress: 50,
          message: 'LLM API call failed',
          error: errorMessage,
        });
        return {
          success: false,
          error: errorMessage,
          duration: Date.now() - startTime,
        };
      }

      const completionTokens = estimateTokens(response);

      // Stage 4: Parsing response
      emitProgress(onProgress, {
        stage: 'formatting',
        progress: 70,
        message: 'Parsing LLM response...',
      });

      const { title, description, steps } = parseResponse(response, parsedSteps);

      // Stage 5: Building tutorial
      emitProgress(onProgress, {
        stage: 'formatting',
        progress: 90,
        message: 'Assembling tutorial...',
      });

      const tutorial: GeneratedTutorial = {
        id: generateTutorialId(),
        title,
        description,
        steps,
        sourceRecording: session.id,
        generatedAt: new Date().toISOString(),
        llmModel: config.model,
        tags: inferTags(session, steps),
        estimatedTime: estimateCompletionTime(steps),
        difficulty: inferDifficulty(steps),
      };

      // Validate and clean
      const validatedTutorial = validateTutorial(tutorial);

      // Complete
      emitProgress(onProgress, {
        stage: 'complete',
        progress: 100,
        message: 'Tutorial generated successfully',
      });

      return {
        success: true,
        tutorial: validatedTutorial,
        tokenUsage: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      emitProgress(onProgress, {
        stage: 'error',
        progress: 0,
        message: 'Generation failed',
        error: errorMessage,
      });
      return {
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  return {
    generate,
    generateWithProgress,
    buildPrompt,
    setTemplate,
    getTemplate,
  };
}

/**
 * Emit progress event
 */
function emitProgress(
  callback: GenerationProgressCallback,
  progress: GenerationProgress
): void {
  try {
    callback(progress);
  } catch {
    // Ignore callback errors
  }
}

/**
 * Build context object for prompt template
 */
export function buildPromptContext(session: RecordingSession): PromptContext {
  const actionTypes = new Set<ActionType>();
  const keyElements = new Set<string>();

  for (const event of session.domEvents) {
    // Map event types to action types
    const actionType = mapEventToActionType(event.type);
    actionTypes.add(actionType);

    // Collect key element descriptions
    const elementDesc = describeElementBriefly(event.target);
    if (elementDesc && keyElements.size < 10) {
      keyElements.add(elementDesc);
    }
  }

  return {
    url: session.metadata?.url || window.location.href,
    title: session.metadata?.title || document.title,
    actionCount: session.domEvents.length,
    actionTypes: Array.from(actionTypes),
    keyElements: Array.from(keyElements),
  };
}

/**
 * Map DOM event type to action type
 */
function mapEventToActionType(eventType: string): ActionType {
  switch (eventType) {
    case 'click':
    case 'dblclick':
      return 'click';
    case 'input':
    case 'change':
    case 'keydown':
    case 'keypress':
      return 'type';
    case 'scroll':
      return 'scroll';
    case 'hover':
      return 'hover';
    case 'focus':
    case 'blur':
      return 'click';
    default:
      return 'click';
  }
}

/**
 * Create brief element description
 */
function describeElementBriefly(target: DomEvent['target']): string | null {
  if (target.attributes['aria-label']) {
    return target.attributes['aria-label'];
  }
  if (target.textContent && target.textContent.length <= 30) {
    return target.textContent.trim();
  }
  if (target.id) {
    return `#${target.id}`;
  }
  return null;
}

/**
 * Call LLM API based on provider
 */
async function callLLM(
  prompt: string,
  systemPrompt: string,
  config: LLMConfig
): Promise<string> {
  switch (config.provider) {
    case 'openai':
      return callOpenAI(prompt, systemPrompt, config);
    case 'anthropic':
      return callAnthropic(prompt, systemPrompt, config);
    case 'custom':
      return callCustomEndpoint(prompt, systemPrompt, config);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

/**
 * Call OpenAI API for content generation
 */
export async function callOpenAI(
  prompt: string,
  systemPrompt: string,
  config: LLMConfig
): Promise<string> {
  const endpoint = config.endpoint || LLM_ENDPOINTS.openai;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || DEFAULT_LLM_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: config.maxTokens || DEFAULT_LLM_CONFIG.maxTokens,
      temperature: config.temperature ?? DEFAULT_LLM_CONFIG.temperature,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Call Anthropic API for content generation
 */
export async function callAnthropic(
  prompt: string,
  systemPrompt: string,
  config: LLMConfig
): Promise<string> {
  const endpoint = config.endpoint || LLM_ENDPOINTS.anthropic;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model || 'claude-3-haiku-20240307',
      max_tokens: config.maxTokens || DEFAULT_LLM_CONFIG.maxTokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
}

/**
 * Call custom endpoint for content generation
 */
async function callCustomEndpoint(
  prompt: string,
  systemPrompt: string,
  config: LLMConfig
): Promise<string> {
  if (!config.endpoint) {
    throw new Error('Custom endpoint URL is required');
  }

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
    },
    body: JSON.stringify({
      prompt,
      system_prompt: systemPrompt,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Custom API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  // Try common response formats
  return data.content || data.text || data.response || data.output || '';
}

/**
 * Parse LLM response into tutorial components
 */
export function parseResponse(
  response: string,
  fallbackSteps: TutorialStep[]
): { title: string; description: string; steps: TutorialStep[] } {
  // Try to parse as JSON first
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.title && parsed.steps && Array.isArray(parsed.steps)) {
        return {
          title: parsed.title,
          description: parsed.description || '',
          steps: normalizeSteps(parsed.steps),
        };
      }
    }
  } catch {
    // JSON parsing failed, try text parsing
  }

  // Parse as text format
  return parseTextResponse(response, fallbackSteps);
}

/**
 * Parse text-format LLM response
 */
function parseTextResponse(
  response: string,
  fallbackSteps: TutorialStep[]
): { title: string; description: string; steps: TutorialStep[] } {
  const lines = response.split('\n').filter(line => line.trim());

  // Extract title (first line or first heading)
  let title = 'Tutorial';
  const titleMatch = lines[0]?.match(/^#?\s*(.+)$/);
  if (titleMatch) {
    title = titleMatch[1].replace(/^#+\s*/, '');
  }

  // Extract description (first paragraph after title)
  let description = '';
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.match(/^\d+\.|^-|^Step/i)) {
      description = line;
      break;
    }
  }

  // Extract steps (numbered list items)
  const steps: TutorialStep[] = [];
  const stepRegex = /^\s*(\d+)[.)]\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(stepRegex);
    if (match) {
      const stepNum = parseInt(match[1], 10);
      const action = match[2].trim();

      // Find corresponding fallback step for metadata
      const fallback = fallbackSteps[stepNum - 1];

      steps.push({
        stepNumber: stepNum,
        action,
        actionType: fallback?.actionType || 'click',
        target: fallback?.target,
        targetSelector: fallback?.targetSelector,
        timestamp: fallback?.timestamp || 0,
        inputValue: fallback?.inputValue,
      });
    }
  }

  // If no steps extracted, use fallback steps with enhanced descriptions
  if (steps.length === 0) {
    return {
      title,
      description,
      steps: fallbackSteps,
    };
  }

  return { title, description, steps };
}

/**
 * Normalize steps to ensure proper structure
 */
function normalizeSteps(steps: unknown[]): TutorialStep[] {
  return steps.map((step, index) => {
    const s = step as Record<string, unknown>;
    return {
      stepNumber: (s.stepNumber as number) || index + 1,
      action: (s.action as string) || (s.description as string) || 'Perform action',
      actionType: (s.actionType as ActionType) || 'click',
      target: s.target as string | undefined,
      targetSelector: s.targetSelector as string | undefined,
      timestamp: (s.timestamp as number) || 0,
      details: s.details as string | undefined,
      inputValue: s.inputValue as string | undefined,
      expectedResult: s.expectedResult as string | undefined,
      note: s.note as string | undefined,
    };
  });
}

/**
 * Validate and clean generated tutorial
 */
export function validateTutorial(tutorial: GeneratedTutorial): GeneratedTutorial {
  // Ensure required fields
  const validated: GeneratedTutorial = {
    ...tutorial,
    id: tutorial.id || generateTutorialId(),
    title: tutorial.title?.trim() || 'Tutorial',
    description: tutorial.description?.trim() || '',
    steps: tutorial.steps || [],
    sourceRecording: tutorial.sourceRecording || 'unknown',
    generatedAt: tutorial.generatedAt || new Date().toISOString(),
    tags: tutorial.tags || [],
  };

  // Clean and validate steps
  validated.steps = validated.steps.map((step, index) => ({
    ...step,
    stepNumber: index + 1, // Re-number sequentially
    action: step.action?.trim() || `Step ${index + 1}`,
    actionType: step.actionType || 'click',
    timestamp: step.timestamp || 0,
  }));

  // Remove empty steps
  validated.steps = validated.steps.filter(step => step.action && step.action.length > 0);

  return validated;
}

/**
 * Generate unique tutorial ID
 */
function generateTutorialId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `tut_${timestamp}_${random}`;
}

/**
 * Infer tags from session and steps
 */
function inferTags(session: RecordingSession, steps: TutorialStep[]): string[] {
  const tags: string[] = [];

  // Add domain-based tag
  try {
    const url = session.metadata?.url || '';
    const hostname = new URL(url).hostname;
    const domain = hostname.replace('www.', '').split('.')[0];
    if (domain) tags.push(domain);
  } catch {
    // Invalid URL, skip
  }

  // Add action-based tags
  const actionTypes = new Set(steps.map(s => s.actionType));
  if (actionTypes.has('type')) tags.push('form');
  if (actionTypes.has('navigate')) tags.push('navigation');
  if (actionTypes.has('scroll')) tags.push('scrolling');

  // Limit to 5 tags
  return tags.slice(0, 5);
}

/**
 * Estimate completion time in minutes
 */
function estimateCompletionTime(steps: TutorialStep[]): number {
  // Rough estimate: 15 seconds per step
  return Math.ceil(steps.length * 0.25);
}

/**
 * Infer difficulty from steps
 */
function inferDifficulty(
  steps: TutorialStep[]
): 'beginner' | 'intermediate' | 'advanced' {
  // Simple heuristic based on step count and complexity
  const stepCount = steps.length;
  const hasTyping = steps.some(s => s.actionType === 'type');
  const hasNavigation = steps.some(s => s.actionType === 'navigate');

  if (stepCount <= 5 && !hasTyping) return 'beginner';
  if (stepCount >= 15 || (hasTyping && hasNavigation)) return 'advanced';
  return 'intermediate';
}

/**
 * Estimate token count for a string (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}
