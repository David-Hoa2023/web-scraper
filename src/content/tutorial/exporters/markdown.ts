/**
 * Markdown Exporter
 * Exports tutorials to Markdown format
 */

import type {
  GeneratedTutorial,
  ExportConfig,
  ExportResult,
} from '../../../types/tutorial';

import { EXPORT_MIME_TYPES } from '../../../types/tutorial';

/**
 * Export a tutorial to Markdown format
 */
export function exportToMarkdown(
  tutorial: GeneratedTutorial,
  config: ExportConfig
): ExportResult {
  const content = generateMarkdown(tutorial, config);
  const filename = generateFilename(tutorial.title, 'md');

  return {
    format: 'markdown',
    content,
    mimeType: EXPORT_MIME_TYPES.markdown,
    filename,
    size: new Blob([content]).size,
    exportedAt: new Date().toISOString(),
  };
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
  lines.push(`# ${escapeMarkdown(tutorial.title)}`);
  lines.push('');

  // Description
  if (tutorial.description) {
    lines.push(tutorial.description);
    lines.push('');
  }

  // Metadata section
  const metadata: string[] = [];
  if (tutorial.estimatedTime) {
    metadata.push(`**Estimated time:** ${tutorial.estimatedTime} minute${tutorial.estimatedTime > 1 ? 's' : ''}`);
  }
  if (tutorial.difficulty) {
    metadata.push(`**Difficulty:** ${capitalize(tutorial.difficulty)}`);
  }
  if (tutorial.tags && tutorial.tags.length > 0) {
    metadata.push(`**Tags:** ${tutorial.tags.join(', ')}`);
  }

  if (metadata.length > 0) {
    lines.push(...metadata);
    lines.push('');
  }

  // Table of contents for longer tutorials
  if (tutorial.steps.length > 5) {
    lines.push('## Table of Contents');
    lines.push('');
    for (const step of tutorial.steps) {
      const anchor = step.action.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
      lines.push(`${step.stepNumber}. [${truncate(step.action, 60)}](#step-${step.stepNumber}-${anchor})`);
    }
    lines.push('');
  }

  // Steps
  lines.push('## Steps');
  lines.push('');

  for (const step of tutorial.steps) {
    // Step heading
    const anchor = step.action.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    if (config.includeStepNumbers) {
      lines.push(`### Step ${step.stepNumber}: ${escapeMarkdown(step.action)} {#step-${step.stepNumber}-${anchor}}`);
    } else {
      lines.push(`### ${escapeMarkdown(step.action)}`);
    }
    lines.push('');

    // Screenshot
    if (config.includeScreenshots && step.screenshot) {
      lines.push(`![Step ${step.stepNumber}: ${escapeMarkdown(step.action)}](${step.screenshot})`);
      lines.push('');
    }

    // Target element
    if (step.target) {
      lines.push(`**Target:** ${escapeMarkdown(step.target)}`);
      lines.push('');
    }

    // Input value (for type actions)
    if (step.inputValue) {
      lines.push(`**Enter:** \`${step.inputValue}\``);
      lines.push('');
    }

    // Details
    if (step.details) {
      lines.push(step.details);
      lines.push('');
    }

    // Expected result
    if (step.expectedResult) {
      lines.push(`**Expected result:** ${step.expectedResult}`);
      lines.push('');
    }

    // Note/tip
    if (step.note) {
      lines.push(`> **Note:** ${step.note}`);
      lines.push('');
    }

    // Timestamp
    if (config.includeTimestamps && step.timestamp) {
      lines.push(`*Timestamp: ${formatTimestamp(step.timestamp)}*`);
      lines.push('');
    }
  }

  // Summary section
  lines.push('---');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`This tutorial covered ${tutorial.steps.length} step${tutorial.steps.length > 1 ? 's' : ''} to complete the task.`);
  lines.push('');

  // Footer
  lines.push('---');
  lines.push('');
  lines.push(`*Generated on ${formatDate(tutorial.generatedAt)}*`);
  if (tutorial.llmModel) {
    lines.push(`*Powered by ${tutorial.llmModel}*`);
  }
  lines.push('');
  lines.push('*Created with Web Scraper Tutorial Generator*');

  return lines.join('\n');
}

/**
 * Generate filename from title
 */
function generateFilename(title: string, extension: string): string {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  return `${sanitized || 'tutorial'}.${extension}`;
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
 * Format ISO date string to readable format
 */
function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}

/**
 * Escape markdown special characters
 */
export function escapeMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/([*_`[\]()#>\\])/g, '\\$1');
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Truncate string with ellipsis
 */
function truncate(str: string, maxLength: number): string {
  if (!str || str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Convert screenshot data URL to markdown image
 */
export function screenshotToMarkdown(
  dataUrl: string,
  alt: string
): string {
  return `![${escapeMarkdown(alt)}](${dataUrl})`;
}

/**
 * Generate markdown table from data
 */
export function generateTable(
  headers: string[],
  rows: string[][]
): string {
  const lines: string[] = [];

  // Header row
  lines.push(`| ${headers.join(' | ')} |`);

  // Separator row
  lines.push(`| ${headers.map(() => '---').join(' | ')} |`);

  // Data rows
  for (const row of rows) {
    lines.push(`| ${row.map(escapeMarkdown).join(' | ')} |`);
  }

  return lines.join('\n');
}

/**
 * Generate markdown for a code block
 */
export function codeBlock(code: string, language?: string): string {
  const lang = language || '';
  return `\`\`\`${lang}\n${code}\n\`\`\``;
}

/**
 * Generate a markdown link
 */
export function markdownLink(text: string, url: string): string {
  return `[${escapeMarkdown(text)}](${url})`;
}
