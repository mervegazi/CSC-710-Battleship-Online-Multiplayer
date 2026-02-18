import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import type {
  User,
  Session,
  AuthChangeEvent,
  AuthError,
} from "@supabase/supabase-js";
import { isAuthWeakPasswordError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types";

// ---------------------------------------------------------------------------
// Error message mapping
// ---------------------------------------------------------------------------

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  email_exists: "An account with this email already exists.",
  user_already_exists: "An account with this email already exists.",
  email_address_invalid: "Please enter a valid email address.",
  signup_disabled: "Registration is currently disabled.",
  weak_password: "Password is too weak. Please use a stronger password.",
  invalid_credentials: "Invalid email or password.",
  email_not_confirmed: "Please verify your email before signing in.",
  user_not_found: "No account found with this email.",
  user_banned: "This account has been suspended.",
  over_request_rate_limit:
    "Too many requests. Please wait a moment and try again.",
  over_email_send_rate_limit:
    "Too many emails sent. Please wait a few minutes.",
  session_not_found: "Your session has expired. Please sign in again.",
  session_expired: "Your session has expired. Please sign in again.",
  validation_failed: "Please check your input and try again.",
};

export function getAuthErrorMessage(error: AuthError): string {
  if (isAuthWeakPasswordError(error)) {
    const reasons = (error as { reasons?: string[] }).reasons ?? [];
    if (reasons.includes("length")) {
      return "Password must be at least 6 characters long.";
    }
    return "Password is too weak. Please use a stronger password.";
  }

  if (error.code && error.code in AUTH_ERROR_MESSAGES) {
    return AUTH_ERROR_MESSAGES[error.code];
  }

  const msg = error.message.toLowerCase();
  if (msg.includes("user already registered")) {
    return "An account with this email already exists.";
  }
  if (msg.includes("invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (msg.includes("email rate limit exceeded")) {
    return "Too many attempts. Please wait a few minutes.";
  }
  if (msg.includes("database error") || msg.includes("duplicate key")) {
    return "This display name is already taken. Please choose another.";
  }

  if (error.status === undefined || error.status === 0) {
    return "Unable to connect. Please check your internet connection.";
  }
  if (error.status && error.status >= 500) {
    return "A server error occurred. Please try again later.";
  }

  return error.message || "An unexpected error occurred. Please try again.";
}

// ---------------------------------------------------------------------------
// Profile fetch with retry (handles signup race condition & missing table)
// ---------------------------------------------------------------------------

async function fetchProfileWithRetry(
  userId: string,
  maxRetries = 3,
  baseDelay = 500
): Promise<Profile | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) return data as Profile;

    if (error) {
      // PGRST116: no rows returned — profile not yet created by trigger, retry
      if (error.code === "PGRST116" && attempt < maxRetries) {
        await new Promise((r) =>
          setTimeout(r, baseDelay * Math.pow(2, attempt))
        );
        continue;
      }

      // 42P01: relation does not exist — profiles table not created yet (Issue #2)
      if (
        error.code === "42P01" ||
        error.message?.includes("does not exist")
      ) {
        console.warn(
          "Profiles table does not exist. Auth works but profile data is unavailable.",
          "Run the SQL migration from Section 6.3 of the tech doc."
        );
        return null;
      }

      console.error("Profile fetch error:", error);
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// AuthContext
// ---------------------------------------------------------------------------

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Subscribe to auth state changes — callback must be SYNCHRONOUS
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession: Session | null) => {
        if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          setSession(null);
          setLoading(false);
        } else {
          setUser(newSession?.user ?? null);
          setSession(newSession ?? null);
        }

        if (event === "INITIAL_SESSION") {
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch profile when user changes (separate effect to avoid deadlock)
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    let cancelled = false;

    fetchProfileWithRetry(user.id).then((fetched) => {
      if (!cancelled) {
        setProfile(fetched);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error) throw error;
    },
    []
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// useAuth hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
