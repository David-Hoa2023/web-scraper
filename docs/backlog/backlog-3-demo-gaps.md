# Demo Gaps Closure Plan

## Overview

| Gap | Stories Affected | Effort | Priority |
|-----|------------------|--------|----------|
| Recording → UI integration | 2, 3, 5 | Medium | High |
| LLM content generation e2e | 2, 3, 5 | Low | High |
| Scheduled tasks backend | 4, 8 | Medium | Medium |
| Webhook auto-triggers | 4, 8 | Low | Medium |

---

## Phase 1: Recording & Tutorial Flow (Stories 2, 3, 5)

### 1.1 Wire Recording Panel to Capture Orchestrator

**Current State:** Recording panel UI exists but may not be connected to actual capture logic.

**Tasks:**
- [ ] Connect `recordingPanel.ts` button handlers to `captureOrchestrator.ts`
- [ ] Ensure `startCapture()`, `pauseCapture()`, `stopCapture()` are called
- [ ] Verify state updates flow back to panel UI (event count, duration, frames)

**Files:**
- `src/ui/recordingPanel.ts` - UI handlers
- `src/content/recorder/captureOrchestrator.ts` - capture logic
- `src/content/index.ts` - may need integration point

**Test:** Click Start → perform actions → verify event count increases → Stop

---

### 1.2 Verify Video Capture Works

**Current State:** `videoCapture.ts` uses MediaRecorder API.

**Tasks:**
- [ ] Test `getDisplayMedia()` permission flow
- [ ] Verify video blob is created on stop
- [ ] Ensure cursor overlay renders on playback

**Files:**
- `src/content/recorder/videoCapture.ts`
- `src/content/recorder/cursorTracker.ts`

**Test:** Start recording → perform actions → export video → verify cursor visible

---

### 1.3 LLM Content Generation End-to-End

**Current State:** `contentGenerator.ts` has LLM integration code.

**Tasks:**
- [ ] Verify API key flows from Settings → contentGenerator
- [ ] Test with OpenAI and Anthropic endpoints
- [ ] Handle API errors gracefully (show in UI)
- [ ] Verify generated content matches action log

**Files:**
- `src/ui/settingsPanel.ts` - API key storage
- `src/content/tutorial/contentGenerator.ts` - LLM calls
- `src/content/tutorial/actionParser.ts` - converts events to prompts

**Test:** Record workflow → Stop → Generate → verify markdown output

---

### 1.4 Export Functionality

**Current State:** Exporters exist for markdown, PDF, video.

**Tasks:**
- [ ] Wire export buttons to actual export functions
- [ ] Test markdown download
- [ ] Test PDF generation (jsPDF)
- [ ] Test video export with cursor overlay

**Files:**
- `src/content/tutorial/exporters/markdown.ts`
- `src/content/tutorial/exporters/pdf.ts`
- `src/content/tutorial/exporters/video.ts`

**Test:** Generate tutorial → click each export button → verify file downloads

---

## Phase 2: Scheduled Tasks Backend (Stories 4, 8)

### 2.1 Implement Background Scheduler

**Current State:** Tasks saved to storage but never executed.

**Tasks:**
- [ ] Add `chrome.alarms` API to service worker
- [ ] Create alarm for each scheduled task based on frequency
- [ ] On alarm fire: inject content script, run scrape, save results

**Files:**
- `src/background/service-worker.ts` - add scheduler logic
- `src/manifest.json` - add "alarms" permission

**Implementation:**
```typescript
// service-worker.ts
chrome.alarms.onAlarm.addListener(async (alarm) => {
  const taskId = alarm.name;
  const task = await getTaskFromStorage(taskId);
  if (task) {
    await executeTask(task);
  }
});

function scheduleTask(task: ScheduledTask) {
  const periodInMinutes = frequencyToMinutes(task.frequency);
  chrome.alarms.create(task.id, { periodInMinutes });
}
```

**Test:** Create task with "Hourly" → verify alarm created → wait/simulate → verify task runs

---

### 2.2 Task Execution Logic

**Current State:** No execution logic.

**Tasks:**
- [ ] Create `executeTask()` function in service worker
- [ ] Send message to content script to start scraping
- [ ] Collect results and save to history
- [ ] Update task `lastRun` timestamp

**Files:**
- `src/background/service-worker.ts`
- `src/content/index.ts` - handle EXECUTE_TASK message

**Test:** Manually trigger task → verify scrape runs → check history updated

---

### 2.3 Webhook Auto-Triggers

**Current State:** Test button works, no auto-trigger on completion.

**Tasks:**
- [ ] After task execution completes, check webhook config
- [ ] If `onComplete` enabled, send webhook with results
- [ ] If `onFailure` enabled and task failed, send webhook
- [ ] Include extracted data if `includeData` enabled

**Files:**
- `src/background/service-worker.ts` - add webhook calls
- `src/ui/popup.ts` - webhook config already saved

**Implementation:**
```typescript
async function onTaskComplete(task: ScheduledTask, results: ExtractedItem[], success: boolean) {
  const config = await getWebhookConfig();

  if (success && config.onComplete) {
    await sendWebhook(config, task, results);
  }
  if (!success && config.onFailure) {
    await sendWebhook(config, task, null, 'Task failed');
  }
}
```

**Test:** Configure webhook → run task → verify webhook received

---

## Phase 3: Polish & Integration

### 3.1 Dashboard Stats from Real Data

**Tasks:**
- [ ] Calculate success rate from actual task runs
- [ ] Show real "next run" times from alarms
- [ ] Update stats after each task completion

---

### 3.2 Error Handling & Notifications

**Tasks:**
- [ ] Show chrome.notifications on task completion/failure
- [ ] Log errors to activity log
- [ ] Handle network failures gracefully

---

## Execution Order

```
Week 1: Phase 1 (Recording + LLM)
├── 1.1 Wire recording panel
├── 1.2 Test video capture
├── 1.3 LLM integration
└── 1.4 Export functionality

Week 2: Phase 2 (Scheduled Tasks)
├── 2.1 Background scheduler
├── 2.2 Task execution
└── 2.3 Webhook triggers

Week 3: Phase 3 (Polish)
├── 3.1 Real stats
└── 3.2 Error handling
```

---

## Quick Wins (Can Demo Sooner)

1. **LLM without video** - If video capture has issues, can still demo text-based tutorial generation from DOM events only
2. **Manual task execution** - Add "Run Now" button that works before automatic scheduling
3. **Webhook test** - Already works, just needs auto-trigger wiring

---

## Success Criteria

| Story | Demo Criteria |
|-------|---------------|
| 2 - Trainer | Record → Stop → Generate → Download markdown |
| 3 - Developer | Same as above, focusing on technical docs |
| 4 - Business | Create task → See it run automatically → Webhook fires |
| 5 - QA | Record bug → Export steps + video |
| 8 - Moderator | Schedule daily audit → Runs automatically |
