import { supabase } from '../../database/supabase';
import { env } from '../../config/env';
import { createAppError } from '../../middleware/error.middleware';
import type { RegisterInput, LoginInput, ForgotPasswordInput } from './auth.schema';

export class AuthService {
  async register(data: RegisterInput) {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          display_name: data.displayName,
        },
      },
    });

    if (error) {
      throw createAppError(error.message, 400, 'REGISTRATION_FAILED');
    }

    if (!authData.user) {
      throw createAppError('Failed to create user', 500, 'USER_CREATION_FAILED');
    }

    return {
      user: {
        id: authData.user.id,
        email: authData.user.email!,
        displayName: authData.user.user_metadata?.display_name ?? null,
      },
      session: authData.session,
    };
  }

  async login(data: LoginInput) {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      throw createAppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    return {
      user: {
        id: authData.user.id,
        email: authData.user.email!,
        displayName: authData.user.user_metadata?.display_name ?? null,
      },
      session: authData.session,
    };
  }

  async logout(token: string) {
    const { error } = await supabase.auth.admin.signOut(token);

    if (error) {
      throw createAppError('Failed to logout', 500, 'LOGOUT_FAILED');
    }

    return { message: 'Logged out successfully' };
  }

  async getSession(token: string) {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw createAppError('Invalid session', 401, 'INVALID_SESSION');
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
        displayName: data.user.user_metadata?.display_name ?? null,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error) {
      throw createAppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    return {
      session: data.session,
    };
  }

  async forgotPassword(data: ForgotPasswordInput) {
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${env.frontendUrl}/reset-password`,
    });

    if (error) {
      throw createAppError('Failed to send reset email', 500, 'RESET_EMAIL_FAILED');
    }

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async updateProfile(updates: { displayName?: string }) {
    const { data, error } = await supabase.auth.updateUser({
      data: updates.displayName ? { display_name: updates.displayName } : undefined,
    });

    if (error) {
      throw createAppError(error.message, 400, 'UPDATE_FAILED');
    }

    return {
      user: {
        id: data.user.id,
        email: data.user.email!,
        displayName: data.user.user_metadata?.display_name ?? null,
      },
    };
  }
}

export const authService = new AuthService();
