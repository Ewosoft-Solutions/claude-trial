/**
 * Per-user abuse/runaway protection for AI chat (Step 2 minimum from the
 * plan's "Model & cost governance": per-user rate limit + daily message cap;
 * the per-tenant budget/concurrency layer lands in Step 6).
 *
 * In-memory on purpose — single API instance today; revisit when the API is
 * horizontally scaled (Step 6 moves accounting to the database anyway).
 */
import { Inject, Injectable } from '@nestjs/common';
import { aiConfig } from '../config/ai.config';
import type { AiConfig } from '../config/ai.config';

export interface ThrottleVerdict {
  allowed: boolean;
  /** Human-readable denial reason (present when not allowed). */
  reason?: string;
  retryAfterSeconds?: number;
}

interface UserWindow {
  /** Request timestamps (ms) within the last minute. */
  recent: number[];
  /** UTC day the daily counter belongs to (YYYY-MM-DD). */
  day: string;
  dayCount: number;
}

@Injectable()
export class AiThrottleService {
  private readonly windows = new Map<string, UserWindow>();

  constructor(@Inject(aiConfig.KEY) private readonly config: AiConfig) {}

  /** Check the caller's budget and consume one request when allowed. */
  checkAndConsume(tenantId: string, profileId: string): ThrottleVerdict {
    const key = `${tenantId}:${profileId}`;
    const now = Date.now();
    const today = new Date(now).toISOString().slice(0, 10);

    let window = this.windows.get(key);
    if (!window || window.day !== today) {
      window = { recent: [], day: today, dayCount: 0 };
      this.windows.set(key, window);
    }

    window.recent = window.recent.filter((ts) => now - ts < 60_000);

    if (window.dayCount >= this.config.AI_DAILY_MESSAGE_CAP) {
      return {
        allowed: false,
        reason: `Daily AI message cap reached (${this.config.AI_DAILY_MESSAGE_CAP}/day). Try again tomorrow.`,
        retryAfterSeconds: this.secondsUntilUtcMidnight(now),
      };
    }

    if (window.recent.length >= this.config.AI_RATE_LIMIT_PER_MINUTE) {
      const oldest = window.recent[0];
      return {
        allowed: false,
        reason: `Too many AI requests (${this.config.AI_RATE_LIMIT_PER_MINUTE}/minute). Slow down and retry shortly.`,
        retryAfterSeconds: Math.max(1, Math.ceil((oldest + 60_000 - now) / 1000)),
      };
    }

    window.recent.push(now);
    window.dayCount += 1;
    return { allowed: true };
  }

  private secondsUntilUtcMidnight(now: number): number {
    const next = new Date(now);
    next.setUTCHours(24, 0, 0, 0);
    return Math.max(1, Math.ceil((next.getTime() - now) / 1000));
  }
}
