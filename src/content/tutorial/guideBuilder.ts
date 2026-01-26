/**
 * Guide Builder
 * Assembles final tutorial output from parsed actions and LLM content
 */

import type { RecordingSession, PageSnapshot } from '../../types/recording';
import type {
  GeneratedTutorial,
  TutorialStep,
  ActionType,
} from '../../types/tutorial';

export interface GuideBuilder {
  /** Build a complete tutorial from steps and metadata */
  build(
    steps: TutorialStep[],
    session: RecordingSession,
    llmEnhancements?: Partial<GeneratedTutorial>
  ): GeneratedTutorial;
  /** Add screenshots to steps */
  attachScreenshots(
    tutorial: GeneratedTutorial,
    session: RecordingSession
  ): Promise<GeneratedTutorial>;
  /** Generate title from steps */
  generateTitle(steps: TutorialStep[], url: string): string;
  /** Generate description from steps */
  generateDescription(steps: TutorialStep[]): string;
  /** Estimate completion time */
  estimateTime(steps: TutorialStep[]): number;
  /** Determine difficulty level */
  determineDifficulty(
    steps: TutorialStep[]
  ): 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Create a new guide builder instance
 */
export function createGuideBuilder(): GuideBuilder {
  function build(
    steps: TutorialStep[],
    session: RecordingSession,
    llmEnhancements?: Partial<GeneratedTutorial>
  ): GeneratedTutorial {
    const url = session.metadata?.url || '';
    const title = llmEnhancements?.title || generateTitle(steps, url);
    const description = llmEnhancements?.description || generateDescription(steps);

    const tutorial: GeneratedTutorial = {
      id: generateTutorialId(),
      title,
      description,
      steps: normalizeSteps(steps),
      sourceRecording: session.id,
      generatedAt: new Date().toISOString(),
      llmModel: llmEnhancements?.llmModel,
      tags: llmEnhancements?.tags || generateTags(steps, url),
      estimatedTime: estimateTime(steps),
      difficulty: llmEnhancements?.difficulty || determineDifficulty(steps),
    };

    // Merge any additional LLM-enhanced steps
    if (llmEnhancements?.steps && llmEnhancements.steps.length > 0) {
      tutorial.steps = mergeWithLLMContent(steps, llmEnhancements.steps);
    }

    return tutorial;
  }

  async function attachScreenshots(
    tutorial: GeneratedTutorial,
    session: RecordingSession
  ): Promise<GeneratedTutorial> {
    if (!session.snapshots || session.snapshots.length === 0) {
      return tutorial;
    }

    const updatedSteps = tutorial.steps.map((step) => {
      const screenshot = findBestScreenshot(step.timestamp, session);
      if (screenshot) {
        return { ...step, screenshot };
      }
      return step;
    });

    return {
      ...tutorial,
      steps: updatedSteps,
    };
  }

  function generateTitle(steps: TutorialStep[], url: string): string {
    // Try to extract meaningful title from URL
    let domain = '';
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname.replace('www.', '');
    } catch {
      domain = 'the website';
    }

    // Analyze steps to determine tutorial topic
    const actionTypes = new Set(steps.map((s) => s.actionType));
    const hasForm = steps.some(
      (s) => s.actionType === 'type' || s.target?.includes('field')
    );
    const hasNavigation = actionTypes.has('navigate');
    const hasClick = actionTypes.has('click');

    // Build title based on dominant actions
    if (hasForm && steps.length <= 5) {
      return `How to Fill Out a Form on ${capitalizeFirst(domain)}`;
    }

    if (hasNavigation && hasForm) {
      return `Complete Guide: Navigate and Submit on ${capitalizeFirst(domain)}`;
    }

    if (hasClick && steps.length <= 3) {
      // Try to use target description for simple tutorials
      const firstClickStep = steps.find((s) => s.actionType === 'click');
      if (firstClickStep?.target) {
        return `How to Click ${firstClickStep.target}`;
      }
    }

    // Default title
    return `Tutorial: How to Use ${capitalizeFirst(domain)}`;
  }

  function generateDescription(steps: TutorialStep[]): string {
    const stepCount = steps.length;
    const actionTypes = new Set(steps.map((s) => s.actionType));

    // Build description based on actions
    const parts: string[] = [];

    if (actionTypes.has('click')) {
      parts.push('clicking elements');
    }
    if (actionTypes.has('type')) {
      parts.push('entering text');
    }
    if (actionTypes.has('scroll')) {
      parts.push('scrolling');
    }
    if (actionTypes.has('navigate')) {
      parts.push('navigating pages');
    }

    const actionsDescription =
      parts.length > 0
        ? `This tutorial covers ${parts.join(', ')}.`
        : 'This tutorial guides you through the process.';

    return `A ${stepCount}-step guide. ${actionsDescription}`;
  }

  function estimateTime(steps: TutorialStep[]): number {
    let totalSeconds = 0;

    for (const step of steps) {
      switch (step.actionType) {
        case 'click':
          totalSeconds += 3; // 3 seconds to find and click
          break;
        case 'type': {
          // Estimate based on input length
          const inputLength = step.inputValue?.length || 10;
          totalSeconds += Math.ceil(inputLength / 5) + 2; // ~5 chars/sec + 2s buffer
          break;
        }
        case 'scroll':
          totalSeconds += 2;
          break;
        case 'navigate':
          totalSeconds += 5; // Wait for page load
          break;
        case 'hover':
          totalSeconds += 2;
          break;
        case 'wait':
          totalSeconds += 3;
          break;
        default:
          totalSeconds += 3;
      }
    }

    // Convert to minutes, minimum 1 minute
    return Math.max(1, Math.ceil(totalSeconds / 60));
  }

  function determineDifficulty(
    steps: TutorialStep[]
  ): 'beginner' | 'intermediate' | 'advanced' {
    const stepCount = steps.length;
    const actionTypes = new Set(steps.map((s) => s.actionType));

    // Count complex actions
    const complexActions = steps.filter(
      (s) =>
        s.actionType === 'type' ||
        s.actionType === 'navigate' ||
        (s.inputValue && s.inputValue.length > 20)
    ).length;

    // Determine difficulty
    if (stepCount <= 3 && complexActions === 0) {
      return 'beginner';
    }

    if (stepCount >= 10 || complexActions >= 5 || actionTypes.size >= 4) {
      return 'advanced';
    }

    return 'intermediate';
  }

  return {
    build,
    attachScreenshots,
    generateTitle,
    generateDescription,
    estimateTime,
    determineDifficulty,
  };
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Normalize steps (ensure sequential numbering, clean up)
 */
function normalizeSteps(steps: TutorialStep[]): TutorialStep[] {
  return steps.map((step, index) => ({
    ...step,
    stepNumber: index + 1,
    action: step.action?.trim() || `Step ${index + 1}`,
    actionType: step.actionType || 'click',
  }));
}

/**
 * Generate a unique tutorial ID
 */
export function generateTutorialId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `tut_${timestamp}_${random}`;
}

/**
 * Merge LLM-generated content with parsed steps
 * LLM enhancements take precedence for descriptions but preserve metadata from parsed steps
 */
export function mergeWithLLMContent(
  parsedSteps: TutorialStep[],
  llmSteps: Partial<TutorialStep>[]
): TutorialStep[] {
  const merged: TutorialStep[] = [];

  for (let i = 0; i < parsedSteps.length; i++) {
    const parsed = parsedSteps[i];
    const llmStep = llmSteps[i] || {};

    merged.push({
      // Prefer LLM-generated text content
      stepNumber: i + 1,
      action: llmStep.action || parsed.action,
      actionType: parsed.actionType, // Keep original action type
      target: llmStep.target || parsed.target,
      targetSelector: parsed.targetSelector, // Keep original selector
      timestamp: parsed.timestamp, // Keep original timestamp
      screenshot: parsed.screenshot || llmStep.screenshot,
      details: llmStep.details || parsed.details,
      inputValue: parsed.inputValue, // Keep original input value
      expectedResult: llmStep.expectedResult || parsed.expectedResult,
      note: llmStep.note || parsed.note,
    });
  }

  // If LLM provided additional steps beyond parsed steps, add them
  if (llmSteps.length > parsedSteps.length) {
    for (let i = parsedSteps.length; i < llmSteps.length; i++) {
      const llmStep = llmSteps[i];
      merged.push({
        stepNumber: i + 1,
        action: llmStep.action || `Step ${i + 1}`,
        actionType: (llmStep.actionType as ActionType) || 'click',
        timestamp: 0,
        ...llmStep,
      });
    }
  }

  return merged;
}

/**
 * Find the best screenshot for a step based on timestamp
 * Returns the screenshot data URL from the nearest snapshot
 */
export function findBestScreenshot(
  stepTimestamp: number,
  session: RecordingSession
): string | undefined {
  if (!session.snapshots || session.snapshots.length === 0) {
    return undefined;
  }

  // Find snapshot closest to step timestamp (preferring slightly before)
  let bestSnapshot: PageSnapshot | null = null;
  let bestDiff = Infinity;

  for (const snapshot of session.snapshots) {
    const diff = stepTimestamp - snapshot.timestamp;

    // Prefer snapshots from just before the step (diff > 0)
    // But also accept snapshots from shortly after (diff > -500ms)
    if (diff >= -500 && Math.abs(diff) < bestDiff) {
      bestDiff = Math.abs(diff);
      bestSnapshot = snapshot;
    }
  }

  return bestSnapshot?.screenshotDataUrl;
}

/**
 * Auto-generate tags based on content
 */
export function generateTags(steps: TutorialStep[], url: string): string[] {
  const tags: string[] = [];

  // Add domain-based tag
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '').split('.')[0];
    if (domain && domain.length > 2) {
      tags.push(domain.toLowerCase());
    }
  } catch {
    // Invalid URL, skip
  }

  // Add action-based tags
  const actionTypes = new Set(steps.map((s) => s.actionType));

  if (actionTypes.has('type')) {
    tags.push('form');
    tags.push('input');
  }

  if (actionTypes.has('click')) {
    tags.push('interactive');
  }

  if (actionTypes.has('navigate')) {
    tags.push('navigation');
    tags.push('multi-page');
  }

  if (actionTypes.has('scroll')) {
    tags.push('scrolling');
  }

  // Add complexity tag
  if (steps.length <= 3) {
    tags.push('quick');
  } else if (steps.length >= 10) {
    tags.push('comprehensive');
  }

  // Deduplicate and limit
  return [...new Set(tags)].slice(0, 8);
}

/**
 * Validate tutorial structure
 */
export function validateTutorialStructure(
  tutorial: GeneratedTutorial
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!tutorial.id) errors.push('Missing tutorial ID');
  if (!tutorial.title) errors.push('Missing title');
  if (!tutorial.steps || tutorial.steps.length === 0) {
    errors.push('No steps in tutorial');
  }

  // Check for duplicate step numbers
  const stepNumbers = new Set<number>();
  for (const step of tutorial.steps) {
    if (stepNumbers.has(step.stepNumber)) {
      errors.push(`Duplicate step number: ${step.stepNumber}`);
    }
    stepNumbers.add(step.stepNumber);
  }

  // Check for missing required fields in steps
  for (const step of tutorial.steps) {
    if (!step.action) {
      errors.push(`Step ${step.stepNumber} missing action`);
    }
  }

  // Check step numbering is sequential
  for (let i = 0; i < tutorial.steps.length; i++) {
    if (tutorial.steps[i].stepNumber !== i + 1) {
      errors.push(
        `Step ${i + 1} has incorrect step number: ${tutorial.steps[i].stepNumber}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Split long tutorial into chapters
 */
export function splitIntoChapters(
  tutorial: GeneratedTutorial,
  maxStepsPerChapter: number = 10
): GeneratedTutorial[] {
  if (tutorial.steps.length <= maxStepsPerChapter) {
    return [tutorial];
  }

  const chapters: GeneratedTutorial[] = [];
  const totalChapters = Math.ceil(tutorial.steps.length / maxStepsPerChapter);

  for (let i = 0; i < totalChapters; i++) {
    const startIdx = i * maxStepsPerChapter;
    const endIdx = Math.min(startIdx + maxStepsPerChapter, tutorial.steps.length);
    const chapterSteps = tutorial.steps.slice(startIdx, endIdx);

    // Re-number steps for this chapter
    const numberedSteps = chapterSteps.map((step, idx) => ({
      ...step,
      stepNumber: idx + 1,
    }));

    chapters.push({
      ...tutorial,
      id: `${tutorial.id}_ch${i + 1}`,
      title: `${tutorial.title} (Part ${i + 1} of ${totalChapters})`,
      steps: numberedSteps,
    });
  }

  return chapters;
}

/**
 * Combine multiple tutorials into one
 */
export function combineTutorials(tutorials: GeneratedTutorial[]): GeneratedTutorial {
  if (tutorials.length === 0) {
    throw new Error('No tutorials to combine');
  }

  if (tutorials.length === 1) {
    return tutorials[0];
  }

  const allSteps: TutorialStep[] = [];
  let stepNumber = 1;

  for (const tutorial of tutorials) {
    for (const step of tutorial.steps) {
      allSteps.push({
        ...step,
        stepNumber: stepNumber++,
      });
    }
  }

  // Use first tutorial as base
  const base = tutorials[0];
  const allTags = [...new Set(tutorials.flatMap((t) => t.tags))];

  return {
    id: generateTutorialId(),
    title: `Combined Tutorial: ${base.title}`,
    description: `Combined from ${tutorials.length} tutorials. ${base.description}`,
    steps: allSteps,
    sourceRecording: tutorials.map((t) => t.sourceRecording).join(','),
    generatedAt: new Date().toISOString(),
    tags: allTags.slice(0, 10),
    estimatedTime: tutorials.reduce((sum, t) => sum + (t.estimatedTime || 0), 0),
    difficulty: 'intermediate', // Default for combined tutorials
  };
}
