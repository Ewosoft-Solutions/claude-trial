import { describe, it, expect } from '@jest/globals';
import { classifyDeliveryCost, SMS_UNIT_COST } from './sms-cost';
import { redactDestination } from './redact';

describe('classifyDeliveryCost', () => {
  it('meters SMS by DND vs normal (C107 parity)', () => {
    expect(classifyDeliveryCost('sms', false)).toEqual({
      costUnits: SMS_UNIT_COST.normal,
      dndFlag: false,
    });
    expect(classifyDeliveryCost('sms', true)).toEqual({
      costUnits: SMS_UNIT_COST.dnd,
      dndFlag: true,
    });
  });

  it('does not meter non-SMS channels', () => {
    expect(classifyDeliveryCost('email', false).costUnits).toBe(0);
    expect(classifyDeliveryCost('push', true).costUnits).toBe(0);
    expect(classifyDeliveryCost('in_app', false).costUnits).toBe(0);
  });
});

describe('redactDestination', () => {
  it('masks an email to first char + domain', () => {
    expect(redactDestination('email', 'grace@school.ng')).toBe(
      'g****@school.ng',
    );
  });

  it('masks a phone to its last four digits', () => {
    expect(redactDestination('sms', '+2348031234567')).toBe('**********4567');
  });

  it('handles empty input', () => {
    expect(redactDestination('sms', '')).toBe('');
  });
});
