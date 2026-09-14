import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:8081',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:8081',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY ?? '',
} as const;
