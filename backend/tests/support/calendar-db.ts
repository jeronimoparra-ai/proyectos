import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readFile } from 'node:fs/promises';

export async function calendarDatabase() {
  const db = new PGlite({ extensions: { uuid_ossp } });
  await db.exec(`CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT null::uuid';
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;`);
  for (const file of ['001_initial_schema.sql', '002_push_tokens.sql', '003_study_sessions.sql', '005_calendar_integrations_hardening.sql']) {
    await db.exec(await readFile(new URL(`../../src/database/migrations/${file}`, import.meta.url), 'utf8'));
  }
  return db;
}

// Small PostgREST transport double. Queries execute on actual PostgreSQL/WASM;
// constraints, transactions, privileges and the import function are not mocked.
export function databaseClient(db: PGlite) {
  return {
    from(table: string) {
      let operation = 'SELECT'; let fields = '*'; let payload: Record<string, unknown> = {};
      let conflict = ''; let single = false;
      const filters: Array<[string, string, unknown]> = [];
      const builder = {
        select(value = '*') { fields = value; return builder; },
        insert(value: Record<string, unknown>) { operation = 'INSERT'; payload = value; return builder; },
        upsert(value: Record<string, unknown>, options: { onConflict: string }) { operation = 'INSERT'; payload = value; conflict = options.onConflict; return builder; },
        update(value: Record<string, unknown>) { operation = 'UPDATE'; payload = value; return builder; },
        delete() { operation = 'DELETE'; return builder; },
        is(key: string, value: unknown) { filters.push([key, 'IS', value]); return builder; },
        eq(key: string, value: unknown) { filters.push([key, '=', value]); return builder; },
        gt(key: string, value: unknown) { filters.push([key, '>', value]); return builder; },
        lt(key: string, value: unknown) { filters.push([key, '<', value]); return builder; },
        maybeSingle() { single = true; return builder; },
        async then(resolve: (result: unknown) => unknown, reject: (error: unknown) => unknown) {
          try {
            const values: unknown[] = [];
            const param = (value: unknown) => { values.push(value); return `$${values.length}`; };
            const keys = Object.keys(payload);
            let sql = operation === 'SELECT' ? `SELECT ${fields} FROM ${table}` : operation === 'DELETE' ? `DELETE FROM ${table}` : operation === 'UPDATE'
              ? `UPDATE ${table} SET ${keys.map(key => `${key}=${param(payload[key])}`).join(',')}`
              : `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(key => param(payload[key])).join(',')})`;
            if (filters.length) sql += ` WHERE ${filters.map(([key, op, value]) => op === 'IS' ? `${key} IS NULL` : `${key} ${op} ${param(value)}`).join(' AND ')}`;
            if (conflict) sql += ` ON CONFLICT (${conflict}) DO UPDATE SET ${keys.map(key => `${key}=excluded.${key}`).join(',')}`;
            if (operation !== 'SELECT') sql += ` RETURNING ${fields}`;
            const result = await db.query(sql, values);
            return resolve({ data: single ? result.rows[0] ?? null : result.rows, error: null });
          } catch (error) { return resolve({ data: null, error }); }
        },
      };
      return builder;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      try {
        const values = Object.values(args).map(value => typeof value === 'object' ? JSON.stringify(value) : value);
        const params = Object.keys(args).map((key, index) => `${key} => $${index + 1}`).join(',');
        const result = await db.query<{ result: unknown }>(`SELECT ${name}(${params}) AS result`, values);
        return { data: result.rows[0].result, error: null };
      } catch (error) { return { data: null, error }; }
    },
  };
}
