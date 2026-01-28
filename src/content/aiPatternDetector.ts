/**
 * AI-Enhanced Pattern Detector
 * DIF-1: LLM-powered pattern analysis for improved detection
 * DIF-3: Hybrid processing with local redaction
 */

import { getLLMGateway, type LLMResponse } from '../services/llmGateway';
import { redact, restore } from '../utils/redaction';
import { withRetry } from '../utils/retry';
import { getEventBus } from '../core/eventBus';

/**
 * Detected pattern from AI analysis
 */
export interface AIDetectedPattern {
  selector: string;
  confidence: number;
  reasoning: string;
  suggestedFields: Array<{
    name: string;
    selector: string;
    type: 'text' | 'link' | 'image' | 'attribute';
    attribute?: string;
  }>;
  itemCount: number;
  sampleData?: Record<string, string>[];
}

/**
 * DOM sample for AI analysis
 */
interface DOMSample {
  html: string;
  tagSummary: Record<string, number>;
  classSummary: string[];
  depth: number;
  childCount: number;
}

/**
 * AI Pattern Detector configuration
 */
export interface AIPatternDetectorConfig {
  maxSampleSize: number;
  minConfidence: number;
  useHybridProcessing: boolean;
  maxRetries: number;
}

const DEFAULT_CONFIG: AIPatternDetectorConfig = {
  maxSampleSize: 5000,
  minConfidence: 0.7,
  useHybridProcessing: true,
  maxRetries: 2,
};

/**
 * System prompt for pattern detection
 */
const PATTERN_DETECTION_PROMPT = `You are an expert at analyzing HTML DOM structures to identify repeating patterns for web scraping.

Given a sample of HTML, identify:
1. The most likely repeating item selector (CSS selector)
2. Confidence level (0-1)
3. Brief reasoning for your choice
4. Suggested data fields to extract from each item

Respond in JSON format:
{
  "selector": "CSS selector for repeating items",
  "confidence": 0.85,
  "reasoning": "Brief explanation",
  "suggestedFields": [
    { "name": "title", "selector": "relative selector", "type": "text" },
    { "name": "link", "selector": "a", "type": "link" },
    { "name": "image", "selector": "img", "type": "image" }
  ],
  "itemCount": 10
}

Focus on:
- List items, cards, rows, or article containers
- Consistent class patterns across siblings
- Semantic HTML elements (article, li, tr, etc.)
- Data attributes that indicate list items`;

/**
 * AI-Enhanced Pattern Detector
 */
export class AIPatternDetector {
  private config: AIPatternDetectorConfig;
  private eventBus = getEventBus();

  constructor(config: Partial<AIPatternDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze a DOM element to detect repeating patterns using AI
   */
  async detectPattern(element: Element): Promise<AIDetectedPattern | null> {
    try {
      // Collect DOM sample
      const sample = this.collectDOMSample(element);

      // Apply hybrid processing if enabled
      let processedHtml = sample.html;
      let redactionResult: ReturnType<typeof redact> | null = null;

      if (this.config.useHybridProcessing) {
        redactionResult = redact(sample.html);
        processedHtml = redactionResult.redacted;
      }

      // Build prompt
      const prompt = this.buildPrompt(processedHtml, sample);

      // Call LLM with retry
      const response = await withRetry(
        () => this.callLLM(prompt),
        {
          maxRetries: this.config.maxRetries,
          baseDelayMs: 1000,
          maxDelayMs: 5000,
        }
      );

      // Parse response
      const pattern = this.parseResponse(response);

      if (!pattern || pattern.confidence < this.config.minConfidence) {
        return null;
      }

      // Restore any redacted content in reasoning if present
      if (redactionResult && redactionResult.placeholders.size > 0) {
        pattern.reasoning = restore(pattern.reasoning, redactionResult.placeholders);
      }

      // Validate selector works
      const validated = this.validatePattern(element, pattern);

      if (validated) {
        this.eventBus.emitSync('pattern:detected', {
          selector: pattern.selector,
          confidence: pattern.confidence,
          source: 'ai',
        });
      }

      return validated;
    } catch (error) {
      console.error('[AIPatternDetector] Detection failed:', error);
      this.eventBus.emitSync('ai:error', {
        operation: 'pattern_detection',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Refine an existing pattern with AI assistance
   */
  async refinePattern(
    element: Element,
    currentSelector: string,
    feedback: string
  ): Promise<AIDetectedPattern | null> {
    const sample = this.collectDOMSample(element);

    const prompt = `${PATTERN_DETECTION_PROMPT}

Current selector: ${currentSelector}
User feedback: ${feedback}

Please suggest an improved selector based on the feedback.

HTML Sample:
${sample.html}`;

    try {
      const response = await this.callLLM(prompt);
      const pattern = this.parseResponse(response);

      if (pattern) {
        this.eventBus.emitSync('pattern:refined', {
          oldSelector: currentSelector,
          newSelector: pattern.selector,
        });
      }

      return pattern ? this.validatePattern(element, pattern) : null;
    } catch (error) {
      console.error('[AIPatternDetector] Refinement failed:', error);
      return null;
    }
  }

  /**
   * Suggest extraction fields for a detected pattern
   */
  async suggestFields(
    element: Element,
    selector: string
  ): Promise<AIDetectedPattern['suggestedFields']> {
    const items = element.querySelectorAll(selector);
    if (items.length === 0) return [];

    // Get HTML of first few items
    const sampleItems = Array.from(items)
      .slice(0, 3)
      .map((item) => item.outerHTML)
      .join('\n---\n');

    const prompt = `Analyze these repeating HTML items and suggest data fields to extract.

Items:
${sampleItems}

Respond with JSON array:
[
  { "name": "field_name", "selector": "CSS selector relative to item", "type": "text|link|image|attribute", "attribute": "optional attr name" }
]`;

    try {
      const response = await this.callLLM(prompt);
      const content = response.content.trim();

      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('[AIPatternDetector] Field suggestion failed:', error);
    }

    return [];
  }

  private collectDOMSample(element: Element): DOMSample {
    // Get simplified HTML
    let html = element.outerHTML;

    // Truncate if too long
    if (html.length > this.config.maxSampleSize) {
      // Try to get a meaningful subset
      const children = element.children;
      if (children.length > 0) {
        // Get first few children
        const sampleChildren = Array.from(children)
          .slice(0, 5)
          .map((c) => c.outerHTML)
          .join('\n');
        html = `<${element.tagName.toLowerCase()}>\n${sampleChildren}\n<!-- truncated -->\n</${element.tagName.toLowerCase()}>`;
      } else {
        html = html.slice(0, this.config.maxSampleSize) + '<!-- truncated -->';
      }
    }

    // Collect tag summary
    const tagSummary: Record<string, number> = {};
    element.querySelectorAll('*').forEach((el) => {
      const tag = el.tagName.toLowerCase();
      tagSummary[tag] = (tagSummary[tag] || 0) + 1;
    });

    // Collect unique classes
    const classes = new Set<string>();
    element.querySelectorAll('[class]').forEach((el) => {
      el.classList.forEach((c) => classes.add(c));
    });
    const classSummary = Array.from(classes).slice(0, 20);

    return {
      html,
      tagSummary,
      classSummary,
      depth: this.getDepth(element),
      childCount: element.children.length,
    };
  }

  private buildPrompt(html: string, sample: DOMSample): string {
    return `${PATTERN_DETECTION_PROMPT}

DOM Statistics:
- Direct children: ${sample.childCount}
- Max depth: ${sample.depth}
- Common tags: ${Object.entries(sample.tagSummary)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => `${tag}(${count})`)
      .join(', ')}
- Common classes: ${sample.classSummary.slice(0, 10).join(', ')}

HTML Sample:
${html}`;
  }

  private async callLLM(prompt: string): Promise<LLMResponse> {
    const gateway = getLLMGateway();
    return gateway.complete(prompt, {
      maxTokens: 1024,
      temperature: 0.3, // Lower temperature for more consistent output
    });
  }

  private parseResponse(response: LLMResponse): AIDetectedPattern | null {
    try {
      const content = response.content.trim();

      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[AIPatternDetector] No JSON found in response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        selector: parsed.selector || '',
        confidence: parsed.confidence || 0,
        reasoning: parsed.reasoning || '',
        suggestedFields: parsed.suggestedFields || [],
        itemCount: parsed.itemCount || 0,
      };
    } catch (error) {
      console.error('[AIPatternDetector] Failed to parse response:', error);
      return null;
    }
  }

  private validatePattern(
    element: Element,
    pattern: AIDetectedPattern
  ): AIDetectedPattern | null {
    try {
      const items = element.querySelectorAll(pattern.selector);

      if (items.length === 0) {
        console.warn('[AIPatternDetector] Selector matches no elements');
        return null;
      }

      // Update item count with actual count
      pattern.itemCount = items.length;

      // Extract sample data
      if (pattern.suggestedFields.length > 0) {
        pattern.sampleData = Array.from(items)
          .slice(0, 3)
          .map((item) => {
            const data: Record<string, string> = {};
            for (const field of pattern.suggestedFields) {
              const fieldEl = item.querySelector(field.selector) || item;
              switch (field.type) {
                case 'text':
                  data[field.name] = fieldEl.textContent?.trim() || '';
                  break;
                case 'link':
                  data[field.name] = (fieldEl as HTMLAnchorElement).href || '';
                  break;
                case 'image':
                  data[field.name] = (fieldEl as HTMLImageElement).src || '';
                  break;
                case 'attribute':
                  data[field.name] = field.attribute
                    ? fieldEl.getAttribute(field.attribute) || ''
                    : '';
                  break;
              }
            }
            return data;
          });
      }

      return pattern;
    } catch (error) {
      console.error('[AIPatternDetector] Validation failed:', error);
      return null;
    }
  }

  private getDepth(element: Element): number {
    let maxDepth = 0;

    function traverse(el: Element, depth: number): void {
      maxDepth = Math.max(maxDepth, depth);
      for (const child of Array.from(el.children)) {
        traverse(child, depth + 1);
      }
    }

    traverse(element, 0);
    return maxDepth;
  }
}

// Singleton instance
let aiDetectorInstance: AIPatternDetector | null = null;

/**
 * Get the global AI pattern detector instance
 */
export function getAIPatternDetector(): AIPatternDetector {
  if (!aiDetectorInstance) {
    aiDetectorInstance = new AIPatternDetector();
  }
  return aiDetectorInstance;
}
