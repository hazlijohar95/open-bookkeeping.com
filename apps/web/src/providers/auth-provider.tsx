import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { authService } from "@/data/auth";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Global token storage for synchronous access in tRPC headers
let cachedAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return cachedAccessToken;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void authService.getSession().then(({ session }) => {
      setSession(session);
      setUser(session?.user ?? null);
      cachedAccessToken = session?.access_token ?? null;
      setIsLoading(false);
    });

    const unsubscribe = authService.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      cachedAccessToken = session?.access_token ?? null;
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await authService.signInWithGoogle(
      `${window.location.origin}/auth/callback`
    );
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await authService.signOut();
    if (error) console.error("Error signing out:", error.message);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, isLoading, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined)
    throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
