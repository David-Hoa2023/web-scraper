/**
 * Sensitive data redaction utilities
 * AI-3: Implements automatic redaction of PII and secrets before LLM submission
 */

import type { RedactionResult, RedactionType } from '../types/ai';

/**
 * Patterns for detecting sensitive data
 * Each pattern is designed to minimize false positives while catching common formats
 */
const REDACTION_PATTERNS: Record<RedactionType, RegExp> = {
  // Credit card numbers (Visa, MasterCard, Amex, Discover, etc.)
  // Matches with or without spaces/dashes
  CREDIT_CARD: /\b(?:4[0-9]{3}|5[1-5][0-9]{2}|3[47][0-9]{2}|6(?:011|5[0-9]{2}))[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}\b/g,

  // US Social Security Numbers
  SSN: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g,

  // Email addresses
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,

  // Generic API keys (common patterns)
  // Matches: api_key=xxx, apiKey: "xxx", token: xxx, secret=xxx
  API_KEY: /(?:api[_-]?key|token|secret|password|auth)[_-]?(?:key|token|secret)?[\s]*[:=][\s]*['"]?([a-zA-Z0-9_-]{20,})/gi,

  // AWS Access Key IDs
  AWS_KEY: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,

  // JWT tokens
  JWT: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_\-.+/=]*\b/g,

  // Phone numbers (US format with optional country code)
  PHONE: /\b(?:\+1[-.\s]?)?(?:\([0-9]{3}\)|[0-9]{3})[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,

  // IPv4 addresses (exclude common non-sensitive IPs)
  IP_ADDRESS: /\b(?!(?:127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.))(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
};

/**
 * Additional patterns for specific services (can be extended)
 */
const SERVICE_PATTERNS: Record<string, RegExp> = {
  // GitHub tokens
  GITHUB_TOKEN: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,

  // Slack tokens
  SLACK_TOKEN: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}\b/g,

  // Stripe keys
  STRIPE_KEY: /\b(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}\b/g,

  // OpenAI API keys
  OPENAI_KEY: /\bsk-[a-zA-Z0-9]{20,}\b/g,

  // Anthropic API keys
  ANTHROPIC_KEY: /\bsk-ant-[a-zA-Z0-9\-_]{40,}\b/g,
};

// Merge all patterns
const ALL_PATTERNS: Record<string, RegExp> = {
  ...REDACTION_PATTERNS,
  ...SERVICE_PATTERNS,
};

/**
 * Generates a unique placeholder for redacted content
 */
function generatePlaceholder(type: string, index: number): string {
  return `[${type}_REDACTED_${index}]`;
}

/**
 * Redacts sensitive data from text, replacing it with placeholders
 *
 * @param text - The text to redact
 * @param options - Optional configuration
 * @returns RedactionResult with redacted text and placeholder mappings
 *
 * @example
 * ```typescript
 * const { redacted, placeholders, counts } = redact(
 *   'Contact me at user@example.com or call 555-123-4567'
 * );
 * // redacted: 'Contact me at [EMAIL_REDACTED_0] or call [PHONE_REDACTED_0]'
 * // placeholders: Map { '[EMAIL_REDACTED_0]' => 'user@example.com', ... }
 * // counts: { EMAIL: 1, PHONE: 1 }
 * ```
 */
export function redact(
  text: string,
  options?: { types?: string[] }
): RedactionResult {
  const placeholders = new Map<string, string>();
  const counts: Record<string, number> = {};
  let redacted = text;

  // Determine which patterns to use
  const patternsToUse = options?.types
    ? Object.entries(ALL_PATTERNS).filter(([key]) => options.types!.includes(key))
    : Object.entries(ALL_PATTERNS);

  for (const [type, pattern] of patternsToUse) {
    // Reset pattern state (important for global patterns)
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    let typeIndex = 0;

    // Find all matches for this pattern
    const matches: Array<{ value: string; index: number }> = [];
    while ((match = pattern.exec(text)) !== null) {
      matches.push({ value: match[0], index: match.index });
    }

    // Replace matches in reverse order to preserve indices
    for (const m of matches.reverse()) {
      const placeholder = generatePlaceholder(type, typeIndex++);
      placeholders.set(placeholder, m.value);

      // Find this exact occurrence in the current redacted text
      const idx = redacted.indexOf(m.value);
      if (idx !== -1) {
        redacted = redacted.slice(0, idx) + placeholder + redacted.slice(idx + m.value.length);
      }
    }

    if (matches.length > 0) {
      counts[type] = matches.length;
    }
  }

  return { redacted, placeholders, counts };
}

/**
 * Restores original values from placeholders
 *
 * @param text - Text with placeholders
 * @param placeholders - Map of placeholder -> original value
 * @returns Text with original values restored
 *
 * @example
 * ```typescript
 * const original = restore(
 *   'Contact: [EMAIL_REDACTED_0]',
 *   new Map([['[EMAIL_REDACTED_0]', 'user@example.com']])
 * );
 * // 'Contact: user@example.com'
 * ```
 */
export function restore(
  text: string,
  placeholders: Map<string, string>
): string {
  let restored = text;

  for (const [placeholder, original] of placeholders) {
    restored = restored.split(placeholder).join(original);
  }

  return restored;
}

/**
 * Checks if text contains unredacted sensitive data
 *
 * @param text - Text to check
 * @returns true if sensitive data is detected
 *
 * @example
 * ```typescript
 * if (hasUnredactedSensitiveData(userInput)) {
 *   console.warn('Input contains sensitive data!');
 * }
 * ```
 */
export function hasUnredactedSensitiveData(text: string): boolean {
  for (const pattern of Object.values(ALL_PATTERNS)) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Detects and returns all sensitive data types found in text
 *
 * @param text - Text to analyze
 * @returns Array of detected sensitive data types
 */
export function detectSensitiveDataTypes(text: string): string[] {
  const detected: string[] = [];

  for (const [type, pattern] of Object.entries(ALL_PATTERNS)) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      detected.push(type);
    }
  }

  return detected;
}

/**
 * Creates a redaction-safe wrapper for an async function
 * Automatically redacts input before processing and restores output
 *
 * @example
 * ```typescript
 * const safeLLMCall = withRedaction(async (prompt: string) => {
 *   return await llm.complete(prompt);
 * });
 *
 * // Sensitive data in prompt is automatically redacted before LLM call
 * const response = await safeLLMCall('Process this email: user@example.com');
 * ```
 */
export function withRedaction<TArgs extends string[], TResult extends string>(
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    // Redact all string arguments
    const redactionResults = args.map((arg) => redact(arg));
    const redactedArgs = redactionResults.map((r) => r.redacted) as TArgs;

    // Combine all placeholders
    const allPlaceholders = new Map<string, string>();
    for (const result of redactionResults) {
      for (const [key, value] of result.placeholders) {
        allPlaceholders.set(key, value);
      }
    }

    // Call the original function with redacted args
    const result = await fn(...redactedArgs);

    // Restore any placeholders that might appear in the result
    return restore(result, allPlaceholders) as TResult;
  };
}

/**
 * Validates that Luhn algorithm passes for potential credit card numbers
 * Used to reduce false positives in credit card detection
 */
export function isValidLuhn(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}
