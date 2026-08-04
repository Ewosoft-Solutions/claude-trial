// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_PAGE_SIZE,
  normalizePageSize,
  readPageSizePreference,
  writePageSizePreference,
} from './page-size';

afterEach(() => {
  // clear the cookie between tests
  document.cookie = 'pref_page_size=; path=/; max-age=0';
});

describe('normalizePageSize', () => {
  it('accepts allowed sizes (string or number)', () => {
    expect(normalizePageSize('25')).toBe(25);
    expect(normalizePageSize(50)).toBe(50);
    expect(normalizePageSize(100)).toBe(100);
  });
  it('falls back to the default for junk / out-of-set values', () => {
    expect(normalizePageSize('7')).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizePageSize('abc')).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizePageSize(null)).toBe(DEFAULT_PAGE_SIZE);
  });
});

describe('read/write preference (cookie round-trip)', () => {
  it('defaults to 10 when nothing is saved', () => {
    expect(readPageSizePreference()).toBe(10);
  });
  it('persists and reads back an allowed size', () => {
    writePageSizePreference(25);
    expect(readPageSizePreference()).toBe(25);
  });
  it('normalises a bad size before writing', () => {
    writePageSizePreference(999);
    expect(readPageSizePreference()).toBe(DEFAULT_PAGE_SIZE);
  });
});
