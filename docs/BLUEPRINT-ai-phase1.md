# BLUEPRINT: AI Features - Phase 1 (Critical Gaps)

**Feature:** AI Infrastructure - Critical Gaps
**Status:** Complete
**Created:** 2026-01-27
**Completed:** 2026-01-27
**Source:** docs/implementation-plan-ai-features.md

---

## Overview

Implement foundational AI infrastructure for the web scraper extension, focusing on production reliability requirements: rate limiting, retry with backoff, sensitive data redaction, and API key encryption.

---

## Goals

1. **AI-1: Rate Limiting** - Enforce minimum 500ms between LLM API calls
2. **AI-2: Retry with Backoff** - Exponential backoff for transient API errors
3. **AI-3: Sensitive Data Redaction** - Remove credit cards, SSN, API keys before LLM
4. **AI-4: API Key Encryption** - AES-GCM encryption with password-derived key

## Non-Goals

- LLM provider integration (deferred to Phase 2)
- UI for key management (deferred)
- Provider fallback chain (Phase 2)

---

## Architecture

```
src/
  types/
    ai.ts                    # AI-related type definitions
  utils/
    rateLimiter.ts           # AI-1: Rate limiting
    retry.ts                 # AI-2: Retry with backoff
    redaction.ts             # AI-3: Sensitive data redaction
    encryption.ts            # AI-4: API key encryption
```

---

## API Contracts

### Rate Limiter (`src/utils/rateLimiter.ts`)

```typescript
interface RateLimiterConfig {
  minIntervalMs: number;
  maxConcurrent?: number;
}

class RateLimiter {
  constructor(config: RateLimiterConfig);
  throttle<T>(fn: () => Promise<T>): Promise<T>;
  get queueLength(): number;
  clear(): void;
}
```

### Retry (`src/utils/retry.ts`)

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryOn?: (error: Error) => boolean;
}

function withRetry<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T>;
```

### Redaction (`src/utils/redaction.ts`)

```typescript
interface RedactionResult {
  redacted: string;
  placeholders: Map<string, string>;
}

function redact(text: string): RedactionResult;
function restore(text: string, placeholders: Map<string, string>): string;
```

### Encryption (`src/utils/encryption.ts`)

```typescript
interface EncryptedData {
  ciphertext: string;
  iv: string;
  salt: string;
  version: number;
}

class KeyVault {
  encrypt(apiKey: string, password: string): Promise<EncryptedData>;
  decrypt(data: EncryptedData, password: string): Promise<string>;
  store(name: string, apiKey: string, password: string): Promise<void>;
  retrieve(name: string, password: string): Promise<string>;
}
```

---

## Verification

```bash
bun run typecheck
bun run lint
bun test
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Rate limit compliance | 100% |
| Retry success rate | 99%+ for transient errors |
| Redaction coverage | 0 sensitive data leakage |
| Encryption strength | AES-256-GCM, PBKDF2 100k iterations |
