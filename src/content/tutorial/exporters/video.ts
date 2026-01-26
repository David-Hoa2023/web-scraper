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
  TutorialStep,
} from '../../../types/tutorial';

import { EXPORT_MIME_TYPES } from '../../../types/tutorial';

/**
 * Export a recording session with tutorial overlay to video
 */
export async function exportToVideo(
  session: RecordingSession,
  tutorial: GeneratedTutorial,
  config: ExportConfig
): Promise<ExportResult> {
  const blob = await generateVideo(session, tutorial, config);
  const filename = generateFilename(tutorial.title, 'webm');

  return {
    format: 'video',
    content: blob,
    mimeType: EXPORT_MIME_TYPES.video,
    filename,
    size: blob.size,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Generate video with cursor overlay
 * This creates a video by compositing the original recording with cursor overlay
 */
export async function generateVideo(
  session: RecordingSession,
  tutorial: GeneratedTutorial,
  config: ExportConfig
): Promise<Blob> {
  // If no video blob, create a simple slide-based video from snapshots
  if (!session.videoBlob) {
    return generateSlideVideo(session, tutorial, config);
  }

  // Create video element to decode the original video
  const video = document.createElement('video');
  video.src = URL.createObjectURL(session.videoBlob);
  video.muted = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video'));
  });

  // Create canvas for compositing
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d')!;

  // Set up MediaRecorder for output
  const stream = canvas.captureStream(30);
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 5000000,
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      URL.revokeObjectURL(video.src);
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };

    mediaRecorder.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('MediaRecorder error'));
    };

    mediaRecorder.start();

    // Play video and render frames with overlay
    video.play();

    const renderFrame = () => {
      if (video.ended || video.paused) {
        mediaRecorder.stop();
        return;
      }

      // Draw video frame
      ctx.drawImage(video, 0, 0);

      // Calculate playback time
      const currentTime = video.currentTime * 1000; // Convert to ms

      // Draw cursor overlay if enabled
      if (config.includeCursor && session.cursorFrames.length > 0) {
        const cursorFrame = getCursorAtTime(session.cursorFrames, currentTime);
        if (cursorFrame) {
          // Scale cursor position to video dimensions
          const scaleX = canvas.width / (session.metadata?.screenSize?.width || canvas.width);
          const scaleY = canvas.height / (session.metadata?.screenSize?.height || canvas.height);

          const position = {
            x: cursorFrame.smoothedPosition.x * scaleX,
            y: cursorFrame.smoothedPosition.y * scaleY,
          };

          renderCursor(
            ctx,
            position,
            config.cursorStyle,
            config.cursorColor,
            config.cursorSize,
            cursorFrame.isClick
          );
        }
      }

      // Draw step annotation if we're at a step timestamp
      const currentStep = getStepAtTime(tutorial.steps, currentTime);
      if (currentStep) {
        renderStepAnnotation(ctx, currentStep, canvas.width, canvas.height);
      }

      requestAnimationFrame(renderFrame);
    };

    requestAnimationFrame(renderFrame);
  });
}

/**
 * Generate a slide-based video from snapshots when no video is available
 */
async function generateSlideVideo(
  session: RecordingSession,
  tutorial: GeneratedTutorial,
  config: ExportConfig
): Promise<Blob> {
  const width = session.metadata?.screenSize?.width || 1920;
  const height = session.metadata?.screenSize?.height || 1080;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const stream = canvas.captureStream(30);
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 2500000,
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve(blob);
    };

    mediaRecorder.onerror = () => {
      reject(new Error('MediaRecorder error'));
    };

    mediaRecorder.start();

    // Render each step as a slide
    let stepIndex = 0;
    const stepsToShow = tutorial.steps;
    const frameTime = 3000; // 3 seconds per step

    const renderSlide = () => {
      if (stepIndex >= stepsToShow.length) {
        // Show final slide for 2 seconds then stop
        setTimeout(() => mediaRecorder.stop(), 2000);
        return;
      }

      const step = stepsToShow[stepIndex];

      // Clear canvas with background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, width, height);

      // Draw step content
      renderSlideContent(ctx, step, stepIndex + 1, stepsToShow.length, width, height);

      // Draw cursor at center if enabled
      if (config.includeCursor) {
        renderCursor(
          ctx,
          { x: width / 2, y: height / 2 },
          config.cursorStyle,
          config.cursorColor,
          config.cursorSize,
          false
        );
      }

      stepIndex++;
      setTimeout(renderSlide, frameTime);
    };

    // Start with title slide
    renderTitleSlide(ctx, tutorial, width, height);
    setTimeout(renderSlide, 3000);
  });
}

/**
 * Render title slide
 */
function renderTitleSlide(
  ctx: CanvasRenderingContext2D,
  tutorial: GeneratedTutorial,
  width: number,
  height: number
): void {
  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(tutorial.title, width / 2, height / 2 - 50);

  // Description
  if (tutorial.description) {
    ctx.font = '24px Arial, sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(tutorial.description, width / 2, height / 2 + 20);
  }

  // Step count
  ctx.font = '18px Arial, sans-serif';
  ctx.fillStyle = '#888888';
  ctx.fillText(`${tutorial.steps.length} steps`, width / 2, height / 2 + 70);
}

/**
 * Render slide content for a step
 */
function renderSlideContent(
  ctx: CanvasRenderingContext2D,
  step: TutorialStep,
  stepNum: number,
  totalSteps: number,
  width: number,
  height: number
): void {
  // Step number header
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Step ${stepNum} of ${totalSteps}`, 50, 50);

  // Action text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px Arial, sans-serif';
  ctx.textAlign = 'center';

  // Wrap long text
  const words = step.action.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > width - 100) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const startY = height / 2 - (lines.length * 45) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, width / 2, startY + i * 45);
  });

  // Target info
  if (step.target) {
    ctx.font = '20px Arial, sans-serif';
    ctx.fillStyle = '#888888';
    ctx.fillText(`Target: ${step.target}`, width / 2, height - 100);
  }

  // Progress bar
  const progressWidth = width - 100;
  const progress = stepNum / totalSteps;
  ctx.fillStyle = '#333333';
  ctx.fillRect(50, height - 30, progressWidth, 10);
  ctx.fillStyle = '#00ff88';
  ctx.fillRect(50, height - 30, progressWidth * progress, 10);
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
 * Render step annotation overlay
 */
function renderStepAnnotation(
  ctx: CanvasRenderingContext2D,
  step: TutorialStep,
  width: number,
  height: number
): void {
  const padding = 10;
  const boxHeight = 60;
  const boxY = height - boxHeight - 20;

  // Semi-transparent background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, boxY, width, boxHeight);

  // Step number
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Step ${step.stepNumber}`, padding, boxY + 25);

  // Action text
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px Arial, sans-serif';
  const actionText = step.action.length > 80
    ? step.action.substring(0, 77) + '...'
    : step.action;
  ctx.fillText(actionText, padding, boxY + 48);
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
 * Get the step at a given time
 */
function getStepAtTime(
  steps: TutorialStep[],
  timestamp: number
): TutorialStep | null {
  // Find step that matches or precedes the timestamp
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].timestamp <= timestamp) {
      // Only show for 2 seconds after the step timestamp
      if (timestamp - steps[i].timestamp < 2000) {
        return steps[i];
      }
      return null;
    }
  }
  return null;
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

/**
 * Generate filename from title
 */
function generateFilename(title: string, extension: string): string {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  return `${sanitized || 'tutorial'}.${extension}`;
}
