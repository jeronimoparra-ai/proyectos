import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Guarda anti-regresion del bug de produccion que dejo el alta de usuarios en 500:
// una funcion SECURITY DEFINER sin `SET search_path` hereda el search_path del
// llamador. Con `supabase_auth_admin` (search_path = auth) el trigger de alta
// buscaba `auth.user_preferences` y fallaba con "relation does not exist".
//
// Regla: se evalua el ESTADO FINAL de las migraciones. Si una migracion posterior
// redefine una funcion (p. ej. 008 corrige handle_new_user de 001), vale la
// ultima definicion.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, '../database/migrations');

interface FunctionBlock {
  name: string;
  file: string;
  isSecurityDefiner: boolean;
  hasSearchPath: boolean;
}

// Extrae los bloques `CREATE [OR REPLACE] FUNCTION ... $$ ... $$;` de un SQL.
export function extractFunctions(sql: string, file = 'memoria.sql'): FunctionBlock[] {
  const blocks: FunctionBlock[] = [];
  const regex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w."]+)[\s\S]*?\$\$[\s\S]*?\$\$\s*([^;]*);/gi;

  for (const match of sql.matchAll(regex)) {
    const body = match[0];
    const name = match[1].replace(/"/g, '');
    // `SET search_path` puede ir en la firma (despues del cuerpo) o en el cuerpo.
    const hasSearchPath = /SET\s+search_path/i.test(body);
    blocks.push({
      name,
      file,
      isSecurityDefiner: /SECURITY\s+DEFINER/i.test(body),
      hasSearchPath,
    });
  }

  return blocks;
}

// Recorre las migraciones en orden y se queda con la ultima definicion de cada funcion.
function finalFunctionState(): FunctionBlock[] {
  const latest = new Map<string, FunctionBlock>();

  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    for (const fn of extractFunctions(sql, file)) {
      // 001 define `handle_new_user` sin esquema y 008 `public.handle_new_user`:
      // la clave se normaliza para que la redefinicion sustituya a la anterior.
      const key = fn.name.split('.').pop() as string;
      latest.set(key, fn);
    }
  }

  return [...latest.values()];
}

describe('migraciones — SECURITY DEFINER siempre fija search_path', () => {
  const functions = finalFunctionState();

  it('encuentra funciones en las migraciones (el parser no esta vacio)', () => {
    expect(functions.length).toBeGreaterThan(0);
  });

  it('ninguna funcion SECURITY DEFINER hereda el search_path del llamador', () => {
    const risky = functions
      .filter((f) => f.isSecurityDefiner && !f.hasSearchPath)
      .map((f) => `${f.file}: ${f.name}`);

    expect(risky).toEqual([]);
  });

  it('handle_new_user queda con search_path fijo tras 008', () => {
    const fn = functions.find((f) => f.name.endsWith('handle_new_user'));
    expect(fn).toBeDefined();
    expect(fn?.isSecurityDefiner).toBe(true);
    expect(fn?.hasSearchPath).toBe(true);
    expect(fn?.file).toBe('008_fix_handle_new_user.sql');
  });

  it('el parser detecta una funcion SECURITY DEFINER sin search_path', () => {
    const bad = `
CREATE OR REPLACE FUNCTION public.fn_insegura()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.tabla (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;
    const [fn] = extractFunctions(bad);
    expect(fn.name).toBe('public.fn_insegura');
    expect(fn.isSecurityDefiner).toBe(true);
    expect(fn.hasSearchPath).toBe(false);
  });

  it('el parser acepta la variante segura (SET search_path en la firma)', () => {
    const good = `
CREATE FUNCTION public.fn_segura()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
`;
    const [fn] = extractFunctions(good);
    expect(fn.isSecurityDefiner).toBe(true);
    expect(fn.hasSearchPath).toBe(true);
  });
});
