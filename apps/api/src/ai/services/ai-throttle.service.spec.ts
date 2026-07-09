/**
 * AiThrottleService unit tests — per-user rate limit + daily cap.
 */
import { AiThrottleService } from './ai-throttle.service';
import type { AiConfig } from '../config/ai.config';

const config: AiConfig = {
  ANTHROPIC_API_KEY: 'test-key',
  AI_MODEL: 'claude-opus-4-8',
  AI_MAX_TOKENS: 4096,
  AI_ENABLED: true,
  AI_TOOL_LOOP_MAX_ITERATIONS: 5,
  AI_HISTORY_MAX_MESSAGES: 20,
  AI_RATE_LIMIT_PER_MINUTE: 3,
  AI_DAILY_MESSAGE_CAP: 5,
  AI_MONTHLY_TOKEN_BUDGET: 1_000_000,
  AI_TENANT_CONCURRENCY_LIMIT: 3,
  AI_SPEND_ALERT_THRESHOLD_PERCENT: 80,
  AI_EMBEDDINGS_MODEL: 'voyage-3.5-lite',
  AI_EMBEDDINGS_DIMENSIONS: 1024,
};

describe('AiThrottleService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-06T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('allows requests under the per-minute limit', () => {
    const service = new AiThrottleService(config);
    for (let i = 0; i < 3; i++) {
      expect(service.checkAndConsume('t1', 'p1').allowed).toBe(true);
    }
  });

  it('denies the request over the per-minute limit with a retry hint', () => {
    const service = new AiThrottleService(config);
    for (let i = 0; i < 3; i++) service.checkAndConsume('t1', 'p1');

    const verdict = service.checkAndConsume('t1', 'p1');
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toContain('Too many AI requests');
    expect(verdict.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(verdict.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it('frees the minute window as time passes', () => {
    const service = new AiThrottleService(config);
    for (let i = 0; i < 3; i++) service.checkAndConsume('t1', 'p1');

    jest.advanceTimersByTime(61_000);
    expect(service.checkAndConsume('t1', 'p1').allowed).toBe(true);
  });

  it('tracks users independently', () => {
    const service = new AiThrottleService(config);
    for (let i = 0; i < 3; i++) service.checkAndConsume('t1', 'p1');

    expect(service.checkAndConsume('t1', 'p2').allowed).toBe(true);
    expect(service.checkAndConsume('t2', 'p1').allowed).toBe(true);
  });

  it('enforces the daily cap across minute windows and resets next day', () => {
    const service = new AiThrottleService(config);

    // 5 allowed requests spaced out so the minute window never trips.
    for (let i = 0; i < 5; i++) {
      expect(service.checkAndConsume('t1', 'p1').allowed).toBe(true);
      jest.advanceTimersByTime(61_000);
    }

    const denied = service.checkAndConsume('t1', 'p1');
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toContain('Daily AI message cap');

    jest.setSystemTime(new Date('2026-07-07T00:00:01Z'));
    expect(service.checkAndConsume('t1', 'p1').allowed).toBe(true);
  });
});
