import { Injectable, Logger } from '@nestjs/common';
import type { JobHandler } from './job.types';

/**
 * Maps a job `type` to its processor. Domain modules register a handler on boot
 * (via a registrar with OnModuleInit, mirroring EmailQueueRegistrar) so producers
 * stay decoupled from execution.
 */
@Injectable()
export class JobHandlerRegistry {
  private readonly logger = new Logger(JobHandlerRegistry.name);
  private readonly handlers = new Map<string, JobHandler>();

  register<P = unknown>(type: string, handler: JobHandler<P>): void {
    if (this.handlers.has(type)) {
      this.logger.warn(`Overwriting handler for job type=${type}`);
    }
    this.handlers.set(type, handler as JobHandler);
    this.logger.log(`Registered job handler type=${type}`);
  }

  get(type: string): JobHandler | undefined {
    return this.handlers.get(type);
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }
}
