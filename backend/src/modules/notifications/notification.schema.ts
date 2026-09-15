import { z } from 'zod';

export const registerPushTokenSchema = z.object({
  token: z.string().min(1, 'Push token is required'),
  platform: z.enum(['android', 'ios', 'web']).default('android'),
});

export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;
