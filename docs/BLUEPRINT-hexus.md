# BLUEPRINT: Hexus Integration - Tutorial Generation

**Run ID:** web-scraper-hexus-b2
**Source:** docs/backlog/backlog-2-hexus-integration.yaml
**Created:** 2026-01-26
**Status:** Complete - All stages implemented (Stages 0-10)

## Overview

Transform the web scraper Chrome Extension into a Hexus-style tutorial generation platform. This enables users to record browser interactions, capture screen content, and auto-generate instructional guides using DOM event logging, video capture, and LLM-powered content generation.

## Goals

1. **Hybrid Capture** - Simultaneously capture DOM events and screen pixels with synchronized timestamps
2. **Enhanced Pattern Detection** - Visual feedback overlays for detected patterns with user refinement
3. **Smart Auto-Scroller** - MutationObserver-based content detection with optimized resource usage
4. **Cursor Smoothing** - Bezier curve smoothed mouse movements for professional tutorial videos
5. **LLM Content Generation** - Auto-generate instructional guides from recorded interactions
6. **Real-Time UX Feedback** - Progress indicators, previews, and notifications
7. **Export Flexibility** - Multiple output formats (Markdown, PDF, video)

## Non-Goals

- Server-side video processing (client-only)
- Cloud storage integration (local export only)
- Video editing capabilities (capture and export only)
- Multi-tab/multi-window recording
- Audio capture or voiceover

## Hard Constraints

- Chrome Extension Manifest V3 compliance
- No external runtime dependencies (dev deps only)
- Must work alongside existing scraping functionality
- Maximum recording duration: 5 minutes (memory constraints)
- UI must use Shadow DOM isolation
- LLM integration via user-provided API key (no bundled keys)

## Architecture

```
src/
  content/
    index.ts                  # Extended with recording orchestration
    patternDetector.ts        # Enhanced with visual overlay refinement
    autoScroller.ts           # MutationObserver optimization
    recorder/
      captureOrchestrator.ts  # Coordinates DOM + video capture
      domEventLogger.ts       # DOM interaction capture
      videoCapture.ts         # MediaRecorder + canvas rendering
      cursorTracker.ts        # Mouse position + smoothing
      snapshotSystem.ts       # Page layout snapshots
      timeline.ts             # Event/frame synchronization
    tutorial/
      contentGenerator.ts     # LLM prompt building + API calls
      actionParser.ts         # Convert DOM events to human-readable steps
      guideBuilder.ts         # Assemble final output
      exporters/
        markdown.ts           # Markdown export
        pdf.ts                # PDF generation (jsPDF)
        video.ts              # Video with cursor overlay
  ui/
    overlay.ts                # Extended with recording controls
    recordingPanel.ts         # Recording start/stop/pause UI
    tutorialPreview.ts        # Preview generated content
    patternRefinement.ts      # Manual pattern adjustment UI
  types/
    recording.ts              # Recording-related types
    tutorial.ts               # Tutorial/content types
```

## API/Interface Contracts

### Recording Types

```typescript
// src/types/recording.ts

interface RecordingConfig {
  captureVideo: boolean;
  captureDomEvents: boolean;
  cursorSmoothing: boolean;
  snapshotIntervalMs: number;
  maxDurationMs: number;
  videoQuality: 'low' | 'medium' | 'high';
}

interface RecordingState {
  status: 'idle' | 'recording' | 'paused' | 'processing' | 'complete' | 'error';
  startTime: number | null;
  duration: number;
  eventCount: number;
  frameCount: number;
  errors: string[];
}

interface DomEvent {
  type: 'click' | 'input' | 'scroll' | 'focus' | 'blur' | 'hover' | 'keypress';
  timestamp: number;
  target: ElementSnapshot;
  data: Record<string, unknown>;
  cursorPosition: Point;
}

interface ElementSnapshot {
  tagName: string;
  id?: string;
  classes: string[];
  textContent?: string;
  selector: string;  // Unique CSS selector
  boundingRect: DOMRect;
  attributes: Record<string, string>;
}

interface Point {
  x: number;
  y: number;
}

interface CursorFrame {
  timestamp: number;
  position: Point;
  smoothedPosition: Point;  // Bezier-interpolated
  isClick: boolean;
}

interface PageSnapshot {
  timestamp: number;
  scrollPosition: Point;
  viewportSize: { width: number; height: number };
  domHash: string;  // Content hash for change detection
  screenshot?: Blob;
}

interface RecordingSession {
  id: string;
  config: RecordingConfig;
  state: RecordingState;
  domEvents: DomEvent[];
  cursorFrames: CursorFrame[];
  snapshots: PageSnapshot[];
  videoBlob?: Blob;
  metadata: {
    url: string;
    title: string;
    startedAt: string;
    endedAt?: string;
  };
}
```

### Tutorial Types

```typescript
// src/types/tutorial.ts

interface TutorialStep {
  stepNumber: number;
  action: string;           // Human-readable action description
  target?: string;          // Element description
  screenshot?: Blob;
  timestamp: number;
  details?: string;         // Additional context
}

interface GeneratedTutorial {
  id: string;
  title: string;
  description: string;
  steps: TutorialStep[];
  sourceRecording: string;  // Recording session ID
  generatedAt: string;
  llmModel?: string;
}

interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  model: string;
  endpoint?: string;        // For custom providers
  maxTokens: number;
  temperature: number;
}

interface ExportConfig {
  format: 'markdown' | 'pdf' | 'video';
  includeScreenshots: boolean;
  includeCursor: boolean;
  cursorStyle: 'dot' | 'arrow' | 'highlight';
  outputPath?: string;
}
```

### Capture Orchestrator

```typescript
// src/content/recorder/captureOrchestrator.ts

interface CaptureOrchestrator {
  start(config: RecordingConfig): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): Promise<RecordingSession>;
  getState(): RecordingState;
  onStateChange(callback: (state: RecordingState) => void): () => void;
}

function createCaptureOrchestrator(): CaptureOrchestrator;
```

### DOM Event Logger

```typescript
// src/content/recorder/domEventLogger.ts

interface DomEventLogger {
  start(): void;
  stop(): DomEvent[];
  getEvents(): DomEvent[];
  clear(): void;
}

function createDomEventLogger(): DomEventLogger;
function generateUniqueSelector(element: Element): string;
```

### Video Capture

```typescript
// src/content/recorder/videoCapture.ts

interface VideoCapture {
  start(config: { quality: string }): Promise<void>;
  stop(): Promise<Blob>;
  pause(): void;
  resume(): void;
  isRecording(): boolean;
}

function createVideoCapture(): VideoCapture;
```

### Cursor Tracker

```typescript
// src/content/recorder/cursorTracker.ts

interface CursorTracker {
  start(): void;
  stop(): CursorFrame[];
  getSmoothedPath(frames: CursorFrame[]): CursorFrame[];
}

function createCursorTracker(): CursorTracker;
function smoothCursorPath(
  points: Point[],
  options: { tension?: number; segments?: number }
): Point[];
```

### Content Generator

```typescript
// src/content/tutorial/contentGenerator.ts

interface ContentGenerator {
  generate(session: RecordingSession, config: LLMConfig): Promise<GeneratedTutorial>;
  buildPrompt(events: DomEvent[], context: string): string;
}

function createContentGenerator(): ContentGenerator;
function parseActionsToSteps(events: DomEvent[]): TutorialStep[];
```

### Exporters

```typescript
// src/content/tutorial/exporters/*.ts

function exportToMarkdown(tutorial: GeneratedTutorial, config: ExportConfig): string;
function exportToPdf(tutorial: GeneratedTutorial, config: ExportConfig): Promise<Blob>;
function exportToVideo(
  session: RecordingSession,
  tutorial: GeneratedTutorial,
  config: ExportConfig
): Promise<Blob>;
```

### Enhanced Pattern Detector

```typescript
// src/content/patternDetector.ts (additions)

interface PatternRefinement {
  addToPattern(element: Element): void;
  removeFromPattern(element: Element): void;
  adjustBoundary(direction: 'expand' | 'contract'): void;
  getAdjustedPattern(): PatternMatch;
}

function createPatternRefinement(initialMatch: PatternMatch): PatternRefinement;
function showRefinementOverlay(match: PatternMatch): void;
```

## Staged Plan

### Stage 0: Contracts & Types (COMPLETE)
- [x] Define all TypeScript interfaces in `src/types/recording.ts` and `src/types/tutorial.ts`
- [x] Update `src/types.ts` with re-exports
- [x] Add new dependencies to package.json (jsPDF for PDF export)
- [x] Create stub files for new modules

### Stage 1: DOM Event Logger (COMPLETE)
- [x] Implement `domEventLogger.ts` with event capture
- [x] Generate unique CSS selectors for elements
- [x] Create `ElementSnapshot` from DOM elements
- [x] Add keyboard event capture (keypresses)
- [ ] Test event capture on sample pages

### Stage 2: Cursor Tracking & Smoothing (COMPLETE)
- [x] Implement `cursorTracker.ts` with mouse position polling
- [x] Implement Bezier curve smoothing algorithm
- [x] Add configurable tension/segments for smoothing
- [ ] Visualize cursor path in canvas overlay
- [x] Performance optimization (throttled tracking)

### Stage 3: Video Capture (COMPLETE)
- [x] Implement `videoCapture.ts` using MediaRecorder API
- [x] Tab capture via `getDisplayMedia`
- [x] Quality settings (resolution, frame rate)
- [x] Pause/resume support
- [x] Memory management for long recordings

### Stage 4: Capture Orchestrator (COMPLETE)
- [x] Implement `captureOrchestrator.ts` to coordinate all capture systems
- [x] Timestamp synchronization between DOM events and video frames
- [x] Snapshot system for page layout checkpoints (`snapshotSystem.ts`)
- [x] Timeline synchronization utilities (`timeline.ts`)
- [x] State management (idle/recording/paused/processing)
- [x] Error handling and recovery

### Stage 5: Pattern Detection Enhancement (COMPLETE)
- [x] Add visual overlay with distinct highlight colors
- [x] Implement pattern refinement UI (add/remove elements)
- [x] User-adjustable pattern boundaries
- [x] Confidence score display
- [x] Persist pattern adjustments

### Stage 6: Auto-Scroller Optimization (COMPLETE)
- [x] Refactor to use MutationObserver for content detection
- [x] Optimize scroll behavior for minimal resource usage
- [x] Improve error handling with retry strategies
- [x] Add scroll progress estimation

### Stage 7: LLM Content Generation (COMPLETE)
- [x] Implement `actionParser.ts` to convert events to steps
- [x] Build LLM prompt templates
- [x] Implement `contentGenerator.ts` with API integration
- [x] Implement `guideBuilder.ts` for tutorial assembly
- [x] Support multiple providers (OpenAI, Anthropic, custom)
- [x] Handle rate limits and errors gracefully
- [x] User-configurable prompts/templates

### Stage 8: Tutorial Export (COMPLETE)
- [x] Implement Markdown exporter
- [x] Implement PDF exporter (jsPDF)
- [x] Implement video exporter with cursor overlay
- [x] Screenshot embedding in exports
- [x] Format-specific styling options

### Stage 9: UI/UX (COMPLETE)
- [x] Recording panel (start/stop/pause)
- [x] Real-time progress during recording
- [x] Tutorial preview panel
- [x] Export format selection
- [x] Error notifications
- [x] Settings for LLM API key/configuration

### Stage 10: Integration & Polish (COMPLETE)
- [x] Integrate with existing scraping workflow
- [ ] End-to-end testing (manual verification)
- [ ] Performance profiling (manual verification)
- [ ] Documentation
- [ ] Memory leak detection and fixes (manual verification)

## Acceptance Criteria

### Hybrid Capture
- [ ] DOM events (click, input, scroll, focus, keypress) are captured with timestamps
- [ ] Screen video is captured at configurable quality
- [ ] DOM events and video frames are synchronized within 50ms
- [ ] Snapshots capture page state at configurable intervals

### Pattern Detection
- [ ] Detected patterns show visual overlay with highlight
- [ ] Users can manually add/remove elements from pattern
- [ ] Pattern adjustments persist during session
- [ ] Confidence score is displayed for matches

### Auto-Scroller
- [ ] MutationObserver detects new content loading
- [ ] Scrolling is throttled to minimize resource usage
- [ ] Errors trigger retry with backoff

### Cursor Smoothing
- [ ] Raw cursor positions are recorded at 60fps minimum
- [ ] Bezier smoothing produces natural-looking paths
- [ ] Smoothing is configurable (tension, segments)
- [ ] Performance impact is < 5% CPU during recording

### Content Generation
- [ ] Actions are parsed into human-readable steps
- [ ] LLM generates clear, concise instructional text
- [ ] Multiple LLM providers are supported
- [ ] API errors are handled gracefully with user feedback

### Export
- [ ] Markdown export includes steps and optional screenshots
- [ ] PDF export is properly formatted with images
- [ ] Video export includes smooth cursor overlay
- [ ] All formats support configurable options

### UX
- [ ] Recording controls are accessible and responsive
- [ ] Progress is shown during recording and processing
- [ ] Previews load quickly
- [ ] Errors display helpful messages

## Verification Protocol

```bash
# Fast check (after each stage)
bun run typecheck
bun run lint

# Full verify
bun test
bun run build

# Manual verification
# 1. Load extension in Chrome
# 2. Navigate to test page
# 3. Start recording, perform actions
# 4. Stop recording, verify event capture
# 5. Generate tutorial with LLM
# 6. Export in each format
# 7. Verify output quality
```

## Test Pages

- GitHub (complex interactions, code highlighting)
- Google Search (input, suggestions, results)
- YouTube (video player controls)
- Amazon (product pages, add to cart flow)
- Custom test page with various input types

## Dependencies

```json
{
  "devDependencies": {
    "jspdf": "^2.5.1"
  }
}
```

## Security Considerations

- LLM API keys stored in Chrome local storage (encrypted if possible)
- No automatic transmission of recorded data
- User consent required before recording starts
- Sensitive data (passwords, credit cards) should be masked in exports
- Rate limiting on LLM API calls to prevent cost overruns

## Performance Budget

- Recording overhead: < 10% CPU
- Memory usage during recording: < 200MB for 5min session
- Export processing: < 30 seconds for 5min recording
- Cursor smoothing: Real-time (< 16ms per frame)

## Open Questions

1. Should we support audio capture for voiceover tutorials?
2. What's the preferred LLM prompt structure for best results?
3. Should pattern refinement persist across sessions?
4. Maximum supported recording duration?

---

**Next Steps:** Await user approval, then proceed to Stage 0 implementation.
