# BLUEPRINT: AI Features - Phases 2-4

**Feature:** AI Features - Feature Parity, Differentiation & Architecture
**Status:** Complete
**Created:** 2026-01-27
**Completed:** 2026-01-27
**Source:** docs/implementation-plan-ai-features.md

---

## Overview

Implement advanced AI features across three phases:
- **Phase 2 (Feature Parity):** Voiceover, multi-language support
- **Phase 3 (Differentiation):** AI pattern detection, LLM gateway, hybrid processing
- **Phase 4 (Architecture):** Event bus, job queue, storage management

---

## Phase 2: Feature Parity

### FP-1/FP-2: Export (Pre-existing)
- Markdown and PDF exporters already implemented in `src/content/tutorial/exporters/`

### FP-3: AI Voiceover (`src/services/voiceover.ts`)
- ElevenLabs and OpenAI TTS integration
- Rate-limited API calls
- Batch processing for long content

### FP-4: Multi-language (`src/i18n/index.ts`)
- 25 supported languages
- RTL support (Arabic, Hebrew)
- LLM prompt suffixes for localized generation

---

## Phase 3: Differentiation

### DIF-1/DIF-3: AI Pattern Detection (`src/content/aiPatternDetector.ts`)
- LLM-powered DOM analysis
- Hybrid processing (redact locally, process in cloud)
- Field suggestion for detected patterns

### DIF-2: LLM Gateway (`src/services/llmGateway.ts`)
- Multi-provider support: Anthropic, OpenAI, Groq, Ollama
- Automatic fallback chain
- Integrated rate limiting and retry
- Automatic sensitive data redaction

---

## Phase 4: Architecture

### ARCH-1: Event Bus (`src/core/eventBus.ts`)
- Typed events with wildcard subscriptions
- Priority-based handler execution
- Error isolation per handler
- Event history tracking

### ARCH-2: Job Queue (`src/core/jobQueue.ts`)
- Persistent queue via chrome.storage
- Configurable concurrency
- Priority scheduling
- Automatic retry with backoff

### ARCH-3/ARCH-4: Storage Manager (`src/core/storageManager.ts`)
- Quota monitoring with warning/critical thresholds
- LRU eviction for automatic cleanup
- Metadata tracking for all stored items
- Type-based categorization

---

## Architecture

```
src/
  core/
    eventBus.ts              # ARCH-1: Typed event system
    jobQueue.ts              # ARCH-2: Background job processing
    storageManager.ts        # ARCH-4: Quota management
  services/
    llmGateway.ts            # DIF-2: Multi-provider LLM
    voiceover.ts             # FP-3: TTS integration
  content/
    aiPatternDetector.ts     # DIF-1/DIF-3: AI pattern detection
  i18n/
    index.ts                 # FP-4: Multi-language support
```

---

## API Contracts

### Event Bus
```typescript
class EventBus {
  on<T>(type: EventType, handler: EventHandler<T>, priority?: number): () => void;
  once<T>(type: EventType, handler: EventHandler<T>): () => void;
  emit<T>(type: EventType, payload?: Record<string, unknown>): Promise<void>;
  getHistory(type?: EventType, limit?: number): BaseEvent[];
}
```

### Job Queue
```typescript
class JobQueue {
  registerHandler<T, R>(type: string, handler: JobHandler<T, R>): void;
  enqueue<T>(type: string, payload: T, options?: { priority?: JobPriority }): Promise<string>;
  getJob(id: string): Job | undefined;
  cancel(id: string): Promise<boolean>;
  getStats(): { pending: number; running: number; completed: number; failed: number };
}
```

### LLM Gateway
```typescript
class LLMGateway {
  setApiKey(provider: LLMProvider, key: string): void;
  complete(prompt: string, options?: LLMRequestOptions): Promise<LLMResponse>;
  completeWith(provider: LLMProvider, prompt: string, options?: LLMRequestOptions): Promise<LLMResponse>;
  getAvailableProviders(): Promise<LLMProvider[]>;
}
```

### Voiceover Service
```typescript
class VoiceoverService {
  setApiKey(provider: TTSProvider, key: string): void;
  generateVoiceover(request: VoiceoverRequest): Promise<VoiceoverResult>;
  generateBatchVoiceover(segments: string[], config?: Partial<VoiceConfig>): Promise<VoiceoverResult[]>;
}
```

### AI Pattern Detector
```typescript
class AIPatternDetector {
  detectPattern(element: Element): Promise<AIDetectedPattern | null>;
  refinePattern(element: Element, currentSelector: string, feedback: string): Promise<AIDetectedPattern | null>;
  suggestFields(element: Element, selector: string): Promise<AIDetectedPattern['suggestedFields']>;
}
```

---

## Verification

```bash
bun run typecheck  # Pass
bun run lint       # 0 errors
```

---

## Success Metrics

| Component | Metric | Status |
|-----------|--------|--------|
| Event Bus | Handler isolation | Implemented |
| Job Queue | Persistent state | Implemented |
| LLM Gateway | 4 providers | Implemented |
| Voiceover | 2 TTS providers | Implemented |
| i18n | 25 languages | Implemented |
| Storage | Auto-cleanup | Implemented |
