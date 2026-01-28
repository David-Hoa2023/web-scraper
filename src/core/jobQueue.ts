/**
 * Job Queue - Background task processing with concurrency control
 * ARCH-2: Persistent queue using chrome.storage for MV3 service worker ephemerality
 */

import { getEventBus } from './eventBus';

/**
 * Job status
 */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Job priority levels
 */
export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

const PRIORITY_VALUES: Record<JobPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

/**
 * Job definition
 */
export interface Job<T = unknown> {
  id: string;
  type: string;
  payload: T;
  priority: JobPriority;
  status: JobStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  result?: unknown;
  retries: number;
  maxRetries: number;
}

/**
 * Job handler function
 */
export type JobHandler<T = unknown, R = unknown> = (
  payload: T,
  job: Job<T>
) => Promise<R>;

/**
 * Queue configuration
 */
export interface QueueConfig {
  concurrency: number;
  maxRetries: number;
  retryDelayMs: number;
  persistKey: string;
  processInterval: number;
}

const DEFAULT_CONFIG: QueueConfig = {
  concurrency: 2,
  maxRetries: 3,
  retryDelayMs: 1000,
  persistKey: 'job_queue',
  processInterval: 1000,
};

/**
 * Job Queue with persistence and concurrency control
 */
export class JobQueue {
  private jobs: Map<string, Job> = new Map();
  private handlers: Map<string, JobHandler> = new Map();
  private runningCount = 0;
  private processTimer: ReturnType<typeof setInterval> | null = null;
  private readonly config: QueueConfig;
  private jobIdCounter = 0;
  private eventBus = getEventBus();

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize queue and restore persisted jobs
   */
  async init(): Promise<void> {
    await this.restore();
    this.startProcessing();
  }

  /**
   * Register a job handler for a job type
   */
  registerHandler<T = unknown, R = unknown>(
    type: string,
    handler: JobHandler<T, R>
  ): void {
    this.handlers.set(type, handler as JobHandler);
  }

  /**
   * Add a job to the queue
   */
  async enqueue<T>(
    type: string,
    payload: T,
    options: {
      priority?: JobPriority;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const id = `job_${Date.now()}_${++this.jobIdCounter}`;

    const job: Job<T> = {
      id,
      type,
      payload,
      priority: options.priority || 'normal',
      status: 'pending',
      createdAt: Date.now(),
      retries: 0,
      maxRetries: options.maxRetries ?? this.config.maxRetries,
    };

    this.jobs.set(id, job as Job);
    await this.persist();

    this.eventBus.emitSync('ai:request', { jobId: id, type }, 'JobQueue');

    return id;
  }

  /**
   * Get job by ID
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /**
   * Get all jobs with optional filter
   */
  getJobs(filter?: { status?: JobStatus; type?: string }): Job[] {
    let jobs = Array.from(this.jobs.values());

    if (filter?.status) {
      jobs = jobs.filter((j) => j.status === filter.status);
    }
    if (filter?.type) {
      jobs = jobs.filter((j) => j.type === filter.type);
    }

    return jobs;
  }

  /**
   * Cancel a pending job
   */
  async cancel(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job || job.status !== 'pending') {
      return false;
    }

    job.status = 'cancelled';
    job.completedAt = Date.now();
    await this.persist();

    return true;
  }

  /**
   * Clear completed/failed/cancelled jobs
   */
  async clearCompleted(): Promise<number> {
    let count = 0;
    for (const [id, job] of this.jobs) {
      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        this.jobs.delete(id);
        count++;
      }
    }
    await this.persist();
    return count;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
    total: number;
  } {
    const stats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: 0,
    };

    for (const job of this.jobs.values()) {
      stats[job.status]++;
      stats.total++;
    }

    return stats;
  }

  /**
   * Stop processing and cleanup
   */
  stop(): void {
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }
  }

  private startProcessing(): void {
    if (this.processTimer) return;

    this.processTimer = setInterval(() => {
      this.processNext().catch(console.error);
    }, this.config.processInterval);

    // Process immediately
    this.processNext().catch(console.error);
  }

  private async processNext(): Promise<void> {
    if (this.runningCount >= this.config.concurrency) {
      return;
    }

    // Get next pending job (sorted by priority then creation time)
    const pendingJobs = Array.from(this.jobs.values())
      .filter((j) => j.status === 'pending')
      .sort((a, b) => {
        const priorityDiff =
          PRIORITY_VALUES[b.priority] - PRIORITY_VALUES[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt - b.createdAt;
      });

    const job = pendingJobs[0];
    if (!job) return;

    await this.runJob(job);
  }

  private async runJob(job: Job): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      job.status = 'failed';
      job.error = `No handler registered for job type: ${job.type}`;
      job.completedAt = Date.now();
      await this.persist();
      return;
    }

    job.status = 'running';
    job.startedAt = Date.now();
    this.runningCount++;
    await this.persist();

    try {
      const result = await handler(job.payload, job);
      job.status = 'completed';
      job.result = result;
      job.completedAt = Date.now();

      this.eventBus.emitSync(
        'ai:response',
        { jobId: job.id, type: job.type, result },
        'JobQueue'
      );
    } catch (error) {
      job.retries++;

      if (job.retries < job.maxRetries) {
        // Retry later
        job.status = 'pending';
        job.error = error instanceof Error ? error.message : String(error);

        // Exponential backoff
        const delay = this.config.retryDelayMs * Math.pow(2, job.retries - 1);
        setTimeout(() => {
          this.processNext().catch(console.error);
        }, delay);
      } else {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : String(error);
        job.completedAt = Date.now();

        this.eventBus.emitSync(
          'ai:error',
          { jobId: job.id, type: job.type, error: job.error },
          'JobQueue'
        );
      }
    } finally {
      this.runningCount--;
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    const data = Array.from(this.jobs.entries());
    try {
      await chrome.storage.local.set({ [this.config.persistKey]: data });
    } catch (error) {
      console.error('[JobQueue] Failed to persist:', error);
    }
  }

  private async restore(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(this.config.persistKey);
      const data = result[this.config.persistKey] as [string, Job][] | undefined;

      if (data && Array.isArray(data)) {
        this.jobs = new Map(data);

        // Reset any running jobs to pending (service worker may have been killed)
        for (const job of this.jobs.values()) {
          if (job.status === 'running') {
            job.status = 'pending';
            job.startedAt = undefined;
          }
        }
        await this.persist();
      }
    } catch (error) {
      console.error('[JobQueue] Failed to restore:', error);
    }
  }
}

// Singleton instance
let queueInstance: JobQueue | null = null;

/**
 * Get the global job queue instance
 */
export function getJobQueue(): JobQueue {
  if (!queueInstance) {
    queueInstance = new JobQueue();
  }
  return queueInstance;
}

/**
 * Initialize the job queue (call on service worker startup)
 */
export async function initJobQueue(): Promise<JobQueue> {
  const queue = getJobQueue();
  await queue.init();
  return queue;
}
