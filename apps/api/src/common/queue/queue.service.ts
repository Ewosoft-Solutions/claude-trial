import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type QueueJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface QueueJob<T = any> {
  id: string;
  type: string;
  tenantId?: string;
  payload: T;
  status: QueueJobStatus;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

/** A processor for a job type. Throwing marks the job failed. */
export type QueueHandler<T = any> = (
  payload: T,
  job: QueueJob<T>,
) => Promise<void> | void;

/**
 * QueueService
 *
 * Minimal in-memory queue for background work. Job types with a registered
 * handler are processed asynchronously (off the request path); types without a
 * handler are still tracked so a real broker can drain them later. This is a
 * process-local stub — good enough for single-instance dev/deploys; swap the
 * internals for a real broker (BullMQ/SQS) without touching callers.
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly jobs = new Map<string, QueueJob>();
  private readonly handlers = new Map<string, QueueHandler>();

  /** Register the processor for a job type (last registration wins). */
  registerHandler<T = any>(type: string, handler: QueueHandler<T>): void {
    this.handlers.set(type, handler as QueueHandler);
    this.logger.log(`Registered handler for type=${type}`);
  }

  enqueue<T = any>(type: string, payload: T, tenantId?: string): QueueJob<T> {
    const job: QueueJob<T> = {
      id: randomUUID(),
      type,
      tenantId,
      payload,
      status: 'queued',
      createdAt: new Date(),
    };
    this.jobs.set(job.id, job);
    this.logger.log(`Queued job ${job.id} type=${type}`);

    const handler = this.handlers.get(type);
    if (handler) {
      // Run off the request path; failures mark the job, never crash the caller.
      setImmediate(() => void this.process(job, handler));
    }
    return job;
  }

  private async process(job: QueueJob, handler: QueueHandler): Promise<void> {
    job.status = 'processing';
    try {
      await handler(job.payload, job);
      this.markCompleted(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Job ${job.id} type=${job.type} failed: ${message}`);
      this.markFailed(job.id, message);
    }
  }

  markCompleted(jobId: string) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.completedAt = new Date();
    }
  }

  markFailed(jobId: string, error?: string) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error;
      job.completedAt = new Date();
    }
  }

  getJob(jobId: string): QueueJob | undefined {
    return this.jobs.get(jobId);
  }
}
