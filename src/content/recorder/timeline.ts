/**
 * Timeline
 * Synchronizes events and frames across capture systems
 * Provides utilities for time-based queries and alignment
 */

import type {
  DomEvent,
  CursorFrame,
  PageSnapshot,
} from '../../types/recording';

export interface TimelineEntry {
  timestamp: number;
  type: 'dom_event' | 'cursor_frame' | 'snapshot' | 'marker';
  data: DomEvent | CursorFrame | PageSnapshot | TimelineMarker;
}

export interface TimelineMarker {
  name: string;
  description?: string;
  timestamp: number;
}

export interface Timeline {
  /** Add a DOM event to the timeline */
  addDomEvent(event: DomEvent): void;
  /** Add a cursor frame to the timeline */
  addCursorFrame(frame: CursorFrame): void;
  /** Add a snapshot to the timeline */
  addSnapshot(snapshot: PageSnapshot): void;
  /** Add a custom marker */
  addMarker(name: string, description?: string): void;
  /** Get all entries sorted by timestamp */
  getEntries(): TimelineEntry[];
  /** Get entries within a time range */
  getEntriesInRange(startMs: number, endMs: number): TimelineEntry[];
  /** Get the nearest entry to a timestamp */
  getNearestEntry(timestamp: number, type?: TimelineEntry['type']): TimelineEntry | null;
  /** Get entries by type */
  getEntriesByType(type: TimelineEntry['type']): TimelineEntry[];
  /** Clear all entries */
  clear(): void;
  /** Get recording duration */
  getDuration(): number;
  /** Get entry count */
  getCount(): number;
}

/**
 * Create a new timeline instance
 */
export function createTimeline(): Timeline {
  let entries: TimelineEntry[] = [];

  function addEntry(entry: TimelineEntry): void {
    entries.push(entry);
    // Keep sorted by timestamp
    entries.sort((a, b) => a.timestamp - b.timestamp);
  }

  function addDomEvent(event: DomEvent): void {
    addEntry({
      timestamp: event.timestamp,
      type: 'dom_event',
      data: event,
    });
  }

  function addCursorFrame(frame: CursorFrame): void {
    addEntry({
      timestamp: frame.timestamp,
      type: 'cursor_frame',
      data: frame,
    });
  }

  function addSnapshot(snapshot: PageSnapshot): void {
    addEntry({
      timestamp: snapshot.timestamp,
      type: 'snapshot',
      data: snapshot,
    });
  }

  function addMarker(name: string, description?: string): void {
    const marker: TimelineMarker = {
      name,
      description,
      timestamp: Date.now(),
    };
    addEntry({
      timestamp: marker.timestamp,
      type: 'marker',
      data: marker,
    });
  }

  function getEntries(): TimelineEntry[] {
    return [...entries];
  }

  function getEntriesInRange(startMs: number, endMs: number): TimelineEntry[] {
    return entries.filter(
      (entry) => entry.timestamp >= startMs && entry.timestamp <= endMs
    );
  }

  function getNearestEntry(
    timestamp: number,
    type?: TimelineEntry['type']
  ): TimelineEntry | null {
    const filteredEntries = type
      ? entries.filter((e) => e.type === type)
      : entries;

    if (filteredEntries.length === 0) return null;

    let nearest = filteredEntries[0];
    let minDiff = Math.abs(filteredEntries[0].timestamp - timestamp);

    for (const entry of filteredEntries) {
      const diff = Math.abs(entry.timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = entry;
      }
    }

    return nearest;
  }

  function getEntriesByType(type: TimelineEntry['type']): TimelineEntry[] {
    return entries.filter((e) => e.type === type);
  }

  function clear(): void {
    entries = [];
  }

  function getDuration(): number {
    if (entries.length === 0) return 0;
    const first = entries[0].timestamp;
    const last = entries[entries.length - 1].timestamp;
    return last - first;
  }

  function getCount(): number {
    return entries.length;
  }

  return {
    addDomEvent,
    addCursorFrame,
    addSnapshot,
    addMarker,
    getEntries,
    getEntriesInRange,
    getNearestEntry,
    getEntriesByType,
    clear,
    getDuration,
    getCount,
  };
}

/**
 * Build a timeline from recording session data
 */
export function buildTimeline(
  domEvents: DomEvent[],
  cursorFrames: CursorFrame[],
  snapshots: PageSnapshot[]
): Timeline {
  const timeline = createTimeline();

  domEvents.forEach((event) => timeline.addDomEvent(event));
  cursorFrames.forEach((frame) => timeline.addCursorFrame(frame));
  snapshots.forEach((snapshot) => timeline.addSnapshot(snapshot));

  return timeline;
}

/**
 * Merge multiple timelines into one
 */
export function mergeTimelines(...timelines: Timeline[]): Timeline {
  const merged = createTimeline();

  for (const timeline of timelines) {
    for (const entry of timeline.getEntries()) {
      switch (entry.type) {
        case 'dom_event':
          merged.addDomEvent(entry.data as DomEvent);
          break;
        case 'cursor_frame':
          merged.addCursorFrame(entry.data as CursorFrame);
          break;
        case 'snapshot':
          merged.addSnapshot(entry.data as PageSnapshot);
          break;
        case 'marker': {
          const marker = entry.data as TimelineMarker;
          merged.addMarker(marker.name, marker.description);
          break;
        }
      }
    }
  }

  return merged;
}

/**
 * Align cursor frames with DOM events
 * Finds the closest cursor position for each DOM event
 */
export function alignCursorToEvents(
  events: DomEvent[],
  frames: CursorFrame[],
  toleranceMs: number = 100
): Map<DomEvent, CursorFrame | null> {
  const alignment = new Map<DomEvent, CursorFrame | null>();

  for (const event of events) {
    let closestFrame: CursorFrame | null = null;
    let minDiff = toleranceMs;

    for (const frame of frames) {
      const diff = Math.abs(frame.timestamp - event.timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closestFrame = frame;
      }
    }

    alignment.set(event, closestFrame);
  }

  return alignment;
}

/**
 * Find the snapshot closest to a given timestamp
 */
export function findClosestSnapshot(
  snapshots: PageSnapshot[],
  timestamp: number
): PageSnapshot | null {
  if (snapshots.length === 0) return null;

  let closest = snapshots[0];
  let minDiff = Math.abs(snapshots[0].timestamp - timestamp);

  for (const snapshot of snapshots) {
    const diff = Math.abs(snapshot.timestamp - timestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closest = snapshot;
    }
  }

  return closest;
}

/**
 * Get events that occurred during a specific snapshot period
 */
export function getEventsForSnapshot(
  events: DomEvent[],
  snapshots: PageSnapshot[],
  snapshotIndex: number
): DomEvent[] {
  if (snapshotIndex < 0 || snapshotIndex >= snapshots.length) {
    return [];
  }

  const snapshot = snapshots[snapshotIndex];
  const nextSnapshot = snapshots[snapshotIndex + 1];

  const startTime = snapshot.timestamp;
  const endTime = nextSnapshot?.timestamp ?? Infinity;

  return events.filter(
    (event) => event.timestamp >= startTime && event.timestamp < endTime
  );
}

/**
 * Calculate time gaps between events
 */
export function findTimeGaps(
  entries: TimelineEntry[],
  minGapMs: number = 1000
): Array<{ start: number; end: number; duration: number }> {
  const gaps: Array<{ start: number; end: number; duration: number }> = [];

  for (let i = 1; i < entries.length; i++) {
    const gap = entries[i].timestamp - entries[i - 1].timestamp;
    if (gap >= minGapMs) {
      gaps.push({
        start: entries[i - 1].timestamp,
        end: entries[i].timestamp,
        duration: gap,
      });
    }
  }

  return gaps;
}

/**
 * Normalize timestamps to start from zero
 */
export function normalizeTimestamps<T extends { timestamp: number }>(
  items: T[]
): T[] {
  if (items.length === 0) return [];

  const minTimestamp = Math.min(...items.map((item) => item.timestamp));

  return items.map((item) => ({
    ...item,
    timestamp: item.timestamp - minTimestamp,
  }));
}

/**
 * Adjust timestamps by an offset
 */
export function adjustTimestamps<T extends { timestamp: number }>(
  items: T[],
  offsetMs: number
): T[] {
  return items.map((item) => ({
    ...item,
    timestamp: item.timestamp + offsetMs,
  }));
}

/**
 * Get playback position for a given time
 */
export function getPlaybackPosition(
  entries: TimelineEntry[],
  currentTimeMs: number
): {
  currentIndex: number;
  currentEntry: TimelineEntry | null;
  nextEntry: TimelineEntry | null;
  progress: number;
} {
  if (entries.length === 0) {
    return { currentIndex: -1, currentEntry: null, nextEntry: null, progress: 0 };
  }

  const duration = entries[entries.length - 1].timestamp - entries[0].timestamp;
  const progress = duration > 0 ? (currentTimeMs / duration) * 100 : 0;

  // Find current entry (last entry before or at currentTimeMs)
  let currentIndex = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].timestamp <= currentTimeMs) {
      currentIndex = i;
      break;
    }
  }

  return {
    currentIndex,
    currentEntry: currentIndex >= 0 ? entries[currentIndex] : null,
    nextEntry: currentIndex < entries.length - 1 ? entries[currentIndex + 1] : null,
    progress: Math.min(100, Math.max(0, progress)),
  };
}
