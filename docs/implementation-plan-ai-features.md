# Web Scraper Pro AI Features - Implementation Plan

**Based on:** `web-scraper-ai-features-synthesis-2026-01-27.md`
**Created:** 2026-01-27

---

## Overview

This plan outlines 17 action items across 4 priority phases, derived from cross-agent research synthesis analyzing the AI documentation/scraping landscape.

---

## Phase 1: Critical Gaps (Priority 1)

Production reliability requirements that should be addressed first.

| ID | Task | Description | Technical Approach |
|----|------|-------------|-------------------|
| **AI-1** | Rate Limiting | 500ms min between LLM calls | Use `bottleneck` library or custom throttle in `src/utils/` |
| **AI-2** | Retry with Backoff | Exponential backoff for API errors | Extend existing `ScraperError` class in `src/utils/errors.ts` |
| **AI-3** | Sensitive Data Redaction | Redact credit cards, SSN, API keys before LLM | Add `src/utils/redaction.ts` with regex patterns |
| **AI-4** | API Key Encryption | AES-GCM + user password-derived key | Use Web Crypto API, store encrypted in `chrome.storage` |

**Dependencies:** AI-2 builds on existing error handling. AI-3 must complete before any LLM integration work.

---

## Phase 2: Feature Parity (Priority 2)

Features competitors have that users expect.

| ID | Task | Description | Technical Approach |
|----|------|-------------|-------------------|
| **FP-1** | Native Markdown Export | Structured MD output (not just LLM-generated) | Add `src/content/markdownExporter.ts`, template-based |
| **FP-2** | PDF Export | Generate PDFs from scraped data/tutorials | Puppeteer in background or external service |
| **FP-3** | AI Voiceover | ElevenLabs/OpenAI TTS integration | New `src/services/voiceover.ts`, async generation |
| **FP-4** | Multi-language Docs | 25 languages for generated content | Add language param to LLM prompts, i18n templates |

**Dependencies:** FP-2 may require Puppeteer which has extension limitations (consider offscreen document). FP-3 requires AI-1 rate limiting.

---

## Phase 3: Differentiation (Priority 3)

Unique features to stand out from competitors.

| ID | Task | Description | Technical Approach |
|----|------|-------------|-------------------|
| **DIF-1** | AI Auto-detect Mode | LLM analyzes page structure for patterns | New mode in `patternDetector.ts`, sends DOM sample to LLM |
| **DIF-2** | Local LLM Support | Ollama integration for privacy | Add Ollama provider to LLM gateway, localhost API calls |
| **DIF-3** | Hybrid Processing | Redact locally → process cloud | Pipeline: `redaction.ts` → LLM → restore placeholders |
| **DIF-4** | Inline Guide Editing | Edit LLM-generated steps before export | UI component in overlay, re-generation per section |
| **DIF-5** | Progressive Disclosure UI | Beginner/Advanced/Expert modes | Settings-driven UI state, hide advanced controls |

**Dependencies:** DIF-1 requires AI-1, AI-3. DIF-3 requires AI-3. DIF-4 aligns with User Story 9.

---

## Phase 4: Architecture Modernization (Priority 4)

Foundation for future scalability.

| ID | Task | Description | Technical Approach |
|----|------|-------------|-------------------|
| **ARCH-1** | Internal Event Bus | Typed events, priority handlers | New `src/core/eventBus.ts`, L70 pattern from synthesis |
| **ARCH-2** | Job Queue | Background LLM processing | BullMQ or custom queue with `chrome.storage` persistence |
| **ARCH-3** | MV3 Service Worker Patterns | Persistent state via `chrome.storage` | Refactor `service-worker.ts`, handle ephemerality |
| **ARCH-4** | Storage Quota Management | Auto-pruning old data | Monitor `chrome.storage` quota, LRU eviction |

**Dependencies:** ARCH-1 should be done early in Phase 4 as other items may use it. ARCH-3 is ongoing compliance.

---

## Recommended Implementation Order

```
Phase 1 (Critical)
├── AI-1: Rate Limiting          ← Start here
├── AI-2: Retry with Backoff     ← Builds on errors.ts
├── AI-3: Sensitive Data Redaction
└── AI-4: API Key Encryption

Phase 2 (Feature Parity)
├── FP-1: Native Markdown Export ← Most requested
├── FP-2: PDF Export
├── FP-3: AI Voiceover          ← Depends on AI-1
└── FP-4: Multi-language Docs

Phase 3 (Differentiation)
├── DIF-4: Inline Guide Editing  ← User Story 9
├── DIF-1: AI Auto-detect Mode   ← Major differentiator
├── DIF-3: Hybrid Processing
├── DIF-2: Local LLM (Ollama)
└── DIF-5: Progressive UI

Phase 4 (Architecture)
├── ARCH-1: Event Bus           ← Foundation
├── ARCH-3: MV3 Patterns
├── ARCH-4: Storage Management
└── ARCH-2: Job Queue
```

---

## Key Technical Patterns to Implement

### 1. LLM Gateway (Multi-provider with fallback)

```typescript
// src/services/llmGateway.ts
class LLMGateway {
  private providers = ['anthropic', 'openai', 'groq', 'ollama'];

  async callWithFallback<T>(prompt: string, schema: T): Promise<T> {
    for (const provider of this.providers) {
      try {
        return await this.call(provider, prompt, schema);
      } catch (e) {
        console.warn(`${provider} failed, trying next...`);
      }
    }
    throw new Error('All providers failed');
  }
}
```

### 2. Redaction Pipeline

```typescript
// src/utils/redaction.ts
const patterns = {
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  apiKey: /(?:api[_-]?key|token|secret)\s*[:=]\s*['"]?([a-zA-Z0-9_\-]{32,})/gi,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g
};

function redactBeforeLLM(html: string): string {
  let redacted = html;
  for (const [name, pattern] of Object.entries(patterns)) {
    redacted = redacted.replace(pattern, `[${name.toUpperCase()}_REDACTED]`);
  }
  return redacted;
}
```

### 3. Event Bus (L70 Pattern)

```typescript
// src/core/eventBus.ts
interface RecordingEvent {
  type: 'recording:started' | 'recording:stopped' | 'step:captured' | 'export:completed';
  payload: Record<string, unknown>;
  timestamp: number;
}

class EventBus {
  private handlers = new Map<string, Function[]>();

  emit(event: RecordingEvent): void {
    const handlers = this.handlers.get(event.type) || [];
    handlers.forEach(h => h(event));
  }

  on(type: string, handler: Function): void {
    const existing = this.handlers.get(type) || [];
    this.handlers.set(type, [...existing, handler]);
  }
}
```

### 4. Rate Limiter

```typescript
// src/utils/rateLimiter.ts
class RateLimiter {
  private lastCall = 0;
  private minInterval: number;

  constructor(minIntervalMs = 500) {
    this.minInterval = minIntervalMs;
  }

  async throttle<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const wait = Math.max(0, this.minInterval - (now - this.lastCall));

    if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
    }

    this.lastCall = Date.now();
    return fn();
  }
}
```

---

## File Structure (New Files)

```
src/
├── core/
│   └── eventBus.ts          ← ARCH-1
├── services/
│   ├── llmGateway.ts        ← Multi-provider LLM
│   └── voiceover.ts         ← FP-3
├── content/
│   └── markdownExporter.ts  ← FP-1
└── utils/
    ├── redaction.ts         ← AI-3
    ├── rateLimiter.ts       ← AI-1
    └── encryption.ts        ← AI-4
```

---

## Success Metrics

| Phase | Metric | Target |
|-------|--------|--------|
| Phase 1 | API error rate | < 1% with retry |
| Phase 1 | Sensitive data leakage | 0 incidents |
| Phase 2 | Export format coverage | 4 formats (JSON, CSV, MD, PDF) |
| Phase 3 | Pattern detection success | 90%+ with AI fallback |
| Phase 4 | Service worker reliability | 99.9% uptime |

---

## References

- [Synthesis Document](./web-scraper-ai-features-synthesis-2026-01-27.md)
- [Use Cases](./use-cases.md)
- [Project CLAUDE.md](../CLAUDE.md)
