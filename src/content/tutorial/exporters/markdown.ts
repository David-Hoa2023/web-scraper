/**
 * Markdown Exporter
 * Exports tutorials to Markdown format
 */

import type {
  GeneratedTutorial,
  ExportConfig,
  ExportResult,
} from '../../../types/tutorial';

/**
 * Export a tutorial to Markdown format
 */
export function exportToMarkdown(
  _tutorial: GeneratedTutorial,
  _config: ExportConfig
): ExportResult {
  // TODO: Implement in Stage 8
  throw new Error('Not implemented - Stage 8');
}

/**
 * Generate markdown content from tutorial
 */
export function generateMarkdown(
  tutorial: GeneratedTutorial,
  config: ExportConfig
): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${tutorial.title}`);
  lines.push('');

  // Description
  if (tutorial.description) {
    lines.push(tutorial.description);
    lines.push('');
  }

  // Metadata
  if (tutorial.estimatedTime) {
    lines.push(`**Estimated time:** ${tutorial.estimatedTime} minutes`);
  }
  if (tutorial.difficulty) {
    lines.push(`**Difficulty:** ${tutorial.difficulty}`);
  }
  if (tutorial.estimatedTime || tutorial.difficulty) {
    lines.push('');
  }

  // Steps
  lines.push('## Steps');
  lines.push('');

  for (const step of tutorial.steps) {
    const prefix = config.includeStepNumbers ? `${step.stepNumber}. ` : '- ';
    lines.push(`${prefix}**${step.action}**`);

    if (step.target) {
      lines.push(`   - Target: ${step.target}`);
    }

    if (step.details) {
      lines.push(`   - ${step.details}`);
    }

    if (step.note) {
      lines.push(`   > ${step.note}`);
    }

    if (config.includeTimestamps && step.timestamp) {
      lines.push(`   - *Timestamp: ${formatTimestamp(step.timestamp)}*`);
    }

    if (config.includeScreenshots && step.screenshot) {
      lines.push(`   ![Step ${step.stepNumber}](${step.screenshot})`);
    }

    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`*Generated on ${new Date(tutorial.generatedAt).toLocaleString()}*`);
  if (tutorial.llmModel) {
    lines.push(`*Using ${tutorial.llmModel}*`);
  }

  return lines.join('\n');
}

/**
 * Format a timestamp in milliseconds to mm:ss format
 */
function formatTimestamp(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Escape markdown special characters
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/([*_`[\]()#>])/g, '\\$1');
}

/**
 * Convert screenshot data URL to markdown image
 */
export function screenshotToMarkdown(
  dataUrl: string,
  alt: string
): string {
  return `![${alt}](${dataUrl})`;
}
