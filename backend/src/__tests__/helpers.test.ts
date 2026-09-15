import { getStringParam, parseQuery } from '../utils/helpers';

describe('getStringParam', () => {
  it('returns string as-is', () => {
    expect(getStringParam('hello')).toBe('hello');
  });

  it('returns first element of string array', () => {
    expect(getStringParam(['first', 'second'])).toBe('first');
  });

  it('returns empty string for non-string values', () => {
    expect(getStringParam(undefined)).toBe('');
    expect(getStringParam(null)).toBe('');
    expect(getStringParam(123)).toBe('');
    expect(getStringParam({})).toBe('');
  });

  it('returns empty string for empty array', () => {
    expect(getStringParam([])).toBe('');
  });

  it('returns empty string for array with non-string first element', () => {
    expect(getStringParam([123])).toBe('');
  });
});

describe('parseQuery', () => {
  it('casts query object to target type', () => {
    const query = { page: '1', search: 'test' };
    const result = parseQuery<{ page: string; search: string }>(query);
    expect(result.page).toBe('1');
    expect(result.search).toBe('test');
  });

  it('handles empty objects', () => {
    const result = parseQuery<Record<string, unknown>>({});
    expect(result).toEqual({});
  });
});
