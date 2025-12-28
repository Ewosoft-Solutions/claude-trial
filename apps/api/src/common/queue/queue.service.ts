import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export type QueueJobStatus = 'queued' | 'completed' | 'failed';

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

/**
 * QueueService
 *
 * Minimal in-memory queue stub for heavy operations. Provides job IDs and
 * status tracking to decouple heavy work from request handlers until a full
 * queue/broker is introduced.
 */
@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly jobs = new Map<string, QueueJob>();

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
    return job;
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
