export function getStringParam(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

export function parseQuery<T extends Record<string, unknown>>(query: Record<string, unknown>): T {
  return query as T;
}
