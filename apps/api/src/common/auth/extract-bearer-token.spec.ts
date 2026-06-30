import { extractBearerToken } from './extract-bearer-token';

describe('extractBearerToken', () => {
  it('extracts the token from a standard Bearer header', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('is case-insensitive on the scheme', () => {
    expect(extractBearerToken('bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearerToken('BEARER abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('strips an accidentally duplicated Bearer prefix (Swagger http-bearer paste mistake)', () => {
    expect(extractBearerToken('Bearer Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('strips multiple duplicated Bearer prefixes', () => {
    expect(extractBearerToken('Bearer Bearer Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('strips a duplicated prefix with mixed case', () => {
    expect(extractBearerToken('Bearer bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('trims surrounding whitespace', () => {
    expect(extractBearerToken('Bearer   abc.def.ghi  ')).toBe('abc.def.ghi');
  });

  it('returns undefined for a missing header', () => {
    expect(extractBearerToken(undefined)).toBeUndefined();
    expect(extractBearerToken(null)).toBeUndefined();
    expect(extractBearerToken('')).toBeUndefined();
  });

  it('returns undefined for a non-Bearer scheme', () => {
    expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeUndefined();
  });

  it('returns undefined when only the scheme is present with no token', () => {
    expect(extractBearerToken('Bearer')).toBeUndefined();
    expect(extractBearerToken('Bearer ')).toBeUndefined();
  });
});
