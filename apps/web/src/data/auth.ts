/**
 * Auth Service
 * Abstracts Supabase auth operations for the data layer
 */

import { supabase } from "@/supabase/client";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export interface AuthResult {
  error: Error | null;
}

export interface SessionResult {
  session: Session | null;
  error: Error | null;
}

export const authService = {
  /**
   * Get the current session
   */
  getSession: async (): Promise<SessionResult> => {
    const { data, error } = await supabase.auth.getSession();
    return {
      session: data.session,
      error: error ? new Error(error.message) : null,
    };
  },

  /**
   * Sign in with Google OAuth
   */
  signInWithGoogle: async (redirectTo: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
    return {
      error: error ? new Error(error.message) : null,
    };
  },

  /**
   * Sign out the current user
   */
  signOut: async (): Promise<AuthResult> => {
    const { error } = await supabase.auth.signOut();
    return {
      error: error ? new Error(error.message) : null,
    };
  },

  /**
   * Subscribe to auth state changes
   * Returns unsubscribe function
   */
  onAuthStateChange: (
    callback: (event: AuthChangeEvent, session: Session | null) => void
  ): (() => void) => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(callback);
    return () => subscription.unsubscribe();
  },
};
