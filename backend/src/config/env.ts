import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  // Modelo de OpenRouter; configurable para no quedar clavados a uno retirado.
  openrouterModel: process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:8081',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:8081',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:8081/',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY ?? '',
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN ?? '',
  // Reminder worker
  reminderCheckIntervalMs: parseInt(process.env.REMINDER_CHECK_INTERVAL_MS ?? '60000', 10),
  reminderBatchMax: parseInt(process.env.REMINDER_BATCH_MAX ?? '25', 10),
  reminderClaimTtlMs: parseInt(process.env.REMINDER_CLAIM_TTL_MS ?? '300000', 10),
  reminderRetryMaxAttempts: parseInt(process.env.REMINDER_RETRY_MAX_ATTEMPTS ?? '3', 10),
  expoRequestTimeoutMs: parseInt(process.env.EXPO_REQUEST_TIMEOUT_MS ?? '15000', 10),
} as const;
