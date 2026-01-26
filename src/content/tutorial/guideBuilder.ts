/**
 * Guide Builder
 * Assembles final tutorial output from parsed actions and LLM content
 */

import type { RecordingSession } from '../../types/recording';
import type {
  GeneratedTutorial,
  TutorialStep,
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
  // TODO: Implement in Stage 8
  throw new Error('Not implemented - Stage 8');
}

/**
 * Generate a unique tutorial ID
 */
export function generateTutorialId(): string {
  return `tut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Merge LLM-generated content with parsed steps
 */
export function mergeWithLLMContent(
  _parsedSteps: TutorialStep[],
  _llmSteps: Partial<TutorialStep>[]
): TutorialStep[] {
  // TODO: Implement in Stage 8
  throw new Error('Not implemented - Stage 8');
}

/**
 * Find the best screenshot for a step based on timestamp
 */
export function findBestScreenshot(
  _stepTimestamp: number,
  _session: RecordingSession
): string | undefined {
  // TODO: Implement in Stage 8
  throw new Error('Not implemented - Stage 8');
}

/**
 * Auto-generate tags based on content
 */
export function generateTags(
  _steps: TutorialStep[],
  _url: string
): string[] {
  // TODO: Implement in Stage 8
  throw new Error('Not implemented - Stage 8');
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

  return {
    valid: errors.length === 0,
    errors,
  };
}
