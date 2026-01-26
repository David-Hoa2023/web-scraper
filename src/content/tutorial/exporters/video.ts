/**
 * Video Exporter
 * Exports recordings with cursor overlay and annotations
 */

import type { RecordingSession, CursorFrame, Point } from '../../../types/recording';
import type {
  GeneratedTutorial,
  ExportConfig,
  ExportResult,
  CursorStyle,
} from '../../../types/tutorial';

/**
 * Export a recording session with tutorial overlay to video
 */
export async function exportToVideo(
  _session: RecordingSession,
  _tutorial: GeneratedTutorial,
  _config: ExportConfig
): Promise<ExportResult> {
  // TODO: Implement in Stage 8
  throw new Error('Not implemented - Stage 8');
}

/**
 * Generate video with cursor overlay
 */
export async function generateVideo(
  _session: RecordingSession,
  _config: ExportConfig
): Promise<Blob> {
  // TODO: Implement in Stage 8
  throw new Error('Not implemented - Stage 8');
}

/**
 * Render cursor overlay on canvas
 */
export function renderCursor(
  ctx: CanvasRenderingContext2D,
  position: Point,
  style: CursorStyle,
  color: string,
  size: number,
  isClick: boolean
): void {
  ctx.save();

  switch (style) {
    case 'dot':
      renderDotCursor(ctx, position, color, size, isClick);
      break;
    case 'arrow':
      renderArrowCursor(ctx, position, color, size, isClick);
      break;
    case 'highlight':
      renderHighlightCursor(ctx, position, color, size, isClick);
      break;
    case 'circle':
      renderCircleCursor(ctx, position, color, size, isClick);
      break;
  }

  ctx.restore();
}

/**
 * Render a dot-style cursor
 */
function renderDotCursor(
  ctx: CanvasRenderingContext2D,
  position: Point,
  color: string,
  size: number,
  isClick: boolean
): void {
  ctx.beginPath();
  ctx.arc(position.x, position.y, isClick ? size * 1.5 : size, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  if (isClick) {
    // Click ripple effect
    ctx.beginPath();
    ctx.arc(position.x, position.y, size * 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.stroke();
  }
}

/**
 * Render an arrow-style cursor
 */
function renderArrowCursor(
  ctx: CanvasRenderingContext2D,
  position: Point,
  color: string,
  size: number,
  isClick: boolean
): void {
  const scale = isClick ? 1.2 : 1;
  const s = size * scale;

  ctx.beginPath();
  ctx.moveTo(position.x, position.y);
  ctx.lineTo(position.x + s * 0.7, position.y + s * 0.7);
  ctx.lineTo(position.x + s * 0.3, position.y + s * 0.7);
  ctx.lineTo(position.x + s * 0.3, position.y + s);
  ctx.lineTo(position.x, position.y + s * 0.7);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Render a highlight-style cursor (glowing effect)
 */
function renderHighlightCursor(
  ctx: CanvasRenderingContext2D,
  position: Point,
  color: string,
  size: number,
  isClick: boolean
): void {
  const gradient = ctx.createRadialGradient(
    position.x,
    position.y,
    0,
    position.x,
    position.y,
    isClick ? size * 2 : size
  );
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.5, color + '80'); // 50% opacity
  gradient.addColorStop(1, color + '00'); // Transparent

  ctx.beginPath();
  ctx.arc(position.x, position.y, isClick ? size * 2 : size, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Center dot
  ctx.beginPath();
  ctx.arc(position.x, position.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Render a circle-style cursor (ring)
 */
function renderCircleCursor(
  ctx: CanvasRenderingContext2D,
  position: Point,
  color: string,
  size: number,
  isClick: boolean
): void {
  ctx.beginPath();
  ctx.arc(position.x, position.y, isClick ? size * 1.5 : size, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = isClick ? 4 : 2;
  ctx.stroke();

  if (isClick) {
    ctx.beginPath();
    ctx.arc(position.x, position.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

/**
 * Get the cursor frame for a specific timestamp
 */
export function getCursorAtTime(
  frames: CursorFrame[],
  timestamp: number
): CursorFrame | null {
  if (frames.length === 0) return null;

  // Find the frame closest to the timestamp
  let closest = frames[0];
  let minDiff = Math.abs(frames[0].timestamp - timestamp);

  for (const frame of frames) {
    const diff = Math.abs(frame.timestamp - timestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closest = frame;
    }
  }

  return closest;
}

/**
 * Interpolate cursor position between two frames
 */
export function interpolateCursor(
  frame1: CursorFrame,
  frame2: CursorFrame,
  timestamp: number
): Point {
  const t =
    (timestamp - frame1.timestamp) / (frame2.timestamp - frame1.timestamp);
  const clampedT = Math.max(0, Math.min(1, t));

  return {
    x:
      frame1.smoothedPosition.x +
      (frame2.smoothedPosition.x - frame1.smoothedPosition.x) * clampedT,
    y:
      frame1.smoothedPosition.y +
      (frame2.smoothedPosition.y - frame1.smoothedPosition.y) * clampedT,
  };
}
