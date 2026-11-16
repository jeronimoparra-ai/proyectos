import { vi } from 'vitest';
import { getStringParam, parseQuery } from '../utils/helpers';
import { taskService } from '../modules/tasks/task.service';
import type { TaskQueryInput } from '../modules/tasks/task.schema';

// Regresión: el controller pasa req.query sin validar, de modo que list()
// recibe page/limit undefined. El mock emula a PostgREST: con offset/limit
// NaN devuelve count=1 pero data=[] (exactamente el bug de producción).
const { mockFrom, mockRange } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRange: vi.fn(),
}));

vi.mock('../database/supabase', () => ({
  supabase: { from: mockFrom },
}));

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

describe('TaskService.list - tarea sin categoría y due_date null', () => {
  const task = {
    id: '1e4e8234-f5d9-4bc1-898a-23260b67ec1d',
    title: 'Bug repro task',
    due_date: null,
    category_id: null,
    task_tags: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    let rangeArgs: unknown[] = [];

    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(() => chain),
      range: mockRange.mockImplementation((from: unknown, to: unknown) => {
        rangeArgs = [from, to];
        return chain;
      }),
      order: vi.fn(() => chain),
      then: (resolve: (value: unknown) => void) => {
        const [from, to] = rangeArgs;
        const valid = typeof from === 'number' && typeof to === 'number'
          && Number.isFinite(from) && Number.isFinite(to);
        return Promise.resolve({
          data: valid ? [task] : [],
          error: null,
          count: 1,
        }).then(resolve);
      },
    };

    mockFrom.mockReturnValue(chain);
  });

  it('devuelve la tarea cuando no se envían page ni limit', async () => {
    const result = await taskService.list('user-1', {} as TaskQueryInput);

    expect(mockRange).toHaveBeenCalledWith(0, 19);
    expect(result.tasks).toEqual([task]);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('respeta page y limit cuando vienen como strings de la query', async () => {
    const result = await taskService.list('user-1', {
      page: '2',
      limit: '10',
    } as unknown as TaskQueryInput);

    expect(mockRange).toHaveBeenCalledWith(10, 19);
    expect(result.tasks).toEqual([task]);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });
});
