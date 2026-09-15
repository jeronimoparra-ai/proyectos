export interface EnvValidation {
  isValid: boolean;
  missingVars: string[];
  warnings: string[];
}

const REQUIRED_VARS = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] as const;

const WARNINGS: Record<string, string> = {
  EXPO_PUBLIC_API_URL:
    'EXPO_PUBLIC_API_URL no está configurada. Se usa http://localhost:3000 por defecto, que no es alcanzable desde un dispositivo real.',
  MISSING_SUPABASE:
    'Variables de Supabase faltantes. La app funcionará en modo limitado sin configuración backend.',
};

export function validateEnv(): EnvValidation {
  const missingVars: string[] = [];
  const warnings: string[] = [];

  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missingVars.push(varName);
    }
  }

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!apiUrl || apiUrl.trim() === '' || apiUrl.includes('localhost')) {
    if (apiUrl?.includes('localhost')) {
      warnings.push(WARNINGS.EXPO_PUBLIC_API_URL);
    } else if (!apiUrl || apiUrl.trim() === '') {
      warnings.push(WARNINGS.EXPO_PUBLIC_API_URL);
    }
  }

  if (missingVars.length > 0) {
    warnings.push(WARNINGS.MISSING_SUPABASE);
  }

  return {
    isValid: missingVars.length === 0,
    missingVars,
    warnings,
  };
}

export const envValidation = validateEnv();
