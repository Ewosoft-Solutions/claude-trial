import { describe, it, expect } from 'vitest';

import {
  checkEmail,
  checkName,
  checkPhone,
  checkPositiveInt,
  isSearchable,
  signalCount,
} from './input-validation';

describe('isSearchable', () => {
  it('rejects punctuation-only or too-short queries', () => {
    expect(isSearchable('??')).toBe(false);
    expect(isSearchable('  ')).toBe(false);
    expect(isSearchable('a')).toBe(false);
    expect(isSearchable('.-')).toBe(false);
  });
  it('accepts queries with 2+ letters/digits', () => {
    expect(isSearchable('te')).toBe(true);
    expect(isSearchable('a b')).toBe(true);
    expect(isSearchable('STU-01')).toBe(true);
    expect(isSearchable('Adé')).toBe(true);
  });
});

describe('signalCount', () => {
  it('counts letters and digits across scripts', () => {
    expect(signalCount('a1!')).toBe(2);
    expect(signalCount('Zoé')).toBe(3);
  });
});

describe('checkName', () => {
  it('accepts real names incl. punctuation', () => {
    expect(checkName("O'Brien-Adé").valid).toBe(true);
    expect(checkName('Mary Jane').valid).toBe(true);
  });
  it('rejects empty, symbols, and digits', () => {
    expect(checkName('').valid).toBe(false);
    expect(checkName('??').valid).toBe(false);
    expect(checkName('John3').valid).toBe(false);
  });
});

describe('checkEmail', () => {
  it('validates shape', () => {
    expect(checkEmail('a@b.co').valid).toBe(true);
    expect(checkEmail('nope').valid).toBe(false);
    expect(checkEmail('a@b').valid).toBe(false);
  });
});

describe('checkPhone', () => {
  it('accepts NG + intl formats, rejects junk', () => {
    expect(checkPhone('08030000001').valid).toBe(true);
    expect(checkPhone('+234 803 000 0001').valid).toBe(true);
    expect(checkPhone('12').valid).toBe(false);
    expect(checkPhone('abc').valid).toBe(false);
  });
});

describe('checkPositiveInt', () => {
  it('bounds and integer-checks', () => {
    expect(checkPositiveInt('').valid).toBe(true); // optional
    expect(checkPositiveInt('3').valid).toBe(true);
    expect(checkPositiveInt('0').valid).toBe(false);
    expect(checkPositiveInt('100').valid).toBe(false);
    expect(checkPositiveInt('1.5').valid).toBe(false);
    expect(checkPositiveInt('x').valid).toBe(false);
  });
});
