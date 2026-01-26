/**
 * Timeline
 * Synchronizes events and frames across capture systems
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
  /** Clear all entries */
  clear(): void;
  /** Get recording duration */
  getDuration(): number;
}

/**
 * Create a new timeline instance
 */
export function createTimeline(): Timeline {
  // TODO: Implement in Stage 4
  throw new Error('Not implemented - Stage 4');
}

/**
 * Merge multiple timelines into one
 */
export function mergeTimelines(..._timelines: Timeline[]): Timeline {
  // TODO: Implement in Stage 4
  throw new Error('Not implemented - Stage 4');
}

/**
 * Align cursor frames with DOM events
 * Finds the closest cursor position for each DOM event
 */
export function alignCursorToEvents(
  _events: DomEvent[],
  _frames: CursorFrame[],
  _toleranceMs: number
): Map<DomEvent, CursorFrame | null> {
  // TODO: Implement in Stage 4
  throw new Error('Not implemented - Stage 4');
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
