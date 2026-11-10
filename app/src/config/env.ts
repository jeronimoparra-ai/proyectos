export interface EnvValidation {
  isValid: boolean;
  missingVars: string[];
  warnings: string[];
  canRefresh: boolean;
}

// IMPORTANTE: Expo solo reemplaza `process.env.NOMBRE` escrito literalmente.
// `process.env[varName]` NO se sustituye en el bundle: en el dispositivo
// process.env queda casi vacio, la validacion daba siempre invalida y la app
// no podia arrancar aunque el build estuviera bien configurado.
// https://docs.expo.dev/guides/environment-variables/
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const API_URL = process.env.EXPO_PUBLIC_API_URL;

const REQUIRED_VARS: { name: string; value: string | undefined }[] = [
  { name: 'EXPO_PUBLIC_SUPABASE_URL', value: SUPABASE_URL },
  { name: 'EXPO_PUBLIC_SUPABASE_ANON_KEY', value: SUPABASE_ANON_KEY },
];

// Valores que aparecen en eas.json o en .env.example y que NO son configuracion real.
// Si se compila con ellos, la app intenta hablar con un backend inexistente en vez
// de avisar al usuario.
const KNOWN_PLACEHOLDERS = [
  'https://tu-proyecto.supabase.co',
  'tu-anon-key',
  'your-supabase-url',
  'your-anon-key',
];

const WARNINGS: Record<string, string> = {
  EXPO_PUBLIC_API_URL:
    'EXPO_PUBLIC_API_URL no esta configurada. Se usa http://localhost:3000 por defecto, que no es alcanzable desde un dispositivo real.',
  MISSING_SUPABASE:
    'Variables de Supabase faltantes o con valor de ejemplo. Sin ellas la app no puede iniciar sesion ni cargar datos.',
};

// Devuelve true solo si el valor es una cadena real, no un marcador de plantilla.
export function isUsableValue(value: string | undefined): boolean {
  if (!value) return false;

  const trimmed = value.trim();
  if (trimmed === '') return false;
  if (KNOWN_PLACEHOLDERS.includes(trimmed)) return false;

  // Patrones genericos de plantilla: dominios de ejemplo, marcadores <asi> y
  // valores tipo "your-project" / "your-anon-key" que vienen en .env.example.
  if (/^<.*>$/.test(trimmed)) return false;
  if (/:\/\/[^/]*\bexample\.(com|org|net)\b/i.test(trimmed)) return false;
  if (/:\/\/your[-.]/i.test(trimmed)) return false;
  if (/^your[-_]/i.test(trimmed)) return false;

  return true;
}

export function validateEnv(force = false): EnvValidation {
  const missingVars: string[] = [];
  const warnings: string[] = [];

  for (const { name, value } of REQUIRED_VARS) {
    if (!isUsableValue(value)) {
      missingVars.push(name);
    }
  }

  if (!isUsableValue(API_URL) || API_URL?.includes('localhost') === true) {
    warnings.push(WARNINGS.EXPO_PUBLIC_API_URL);
  }

  if (missingVars.length > 0) {
    warnings.push(WARNINGS.MISSING_SUPABASE);
  }

  return {
    isValid: missingVars.length === 0,
    missingVars,
    warnings,
    canRefresh: !force,
  };
}

export const envValidation = validateEnv(false);
