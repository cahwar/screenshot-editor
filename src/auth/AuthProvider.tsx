import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../utils/supabase";
import { setSyncUser, pullSettings } from "./cloudSync";

type AuthResult = { error?: string; needsConfirmation?: boolean };

type AuthContextValue = {
  configured: boolean;
  ready: boolean;
  session: Session | null;
  user: User | null;
  signInEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpEmail: (email: string, password: string) => Promise<AuthResult>;
  signInGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let lastUid: string | null = null;

    const handle = (next: Session | null) => {
      setSession(next);
      const uid = next?.user?.id ?? null;
      setSyncUser(uid);
      if (uid && uid !== lastUid) {
        lastUid = uid;
        void pullSettings(uid);
      } else if (!uid) {
        lastUid = null;
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      handle(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) =>
      handle(next)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    configured: isSupabaseConfigured,
    ready,
    session,
    user: session?.user ?? null,
    signInEmail: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error?.message };
    },
    signUpEmail: async (email, password) => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      // Supabase obfuscates already-registered emails: it returns a user with
      // no identities and no session instead of an error. Surface a clear hint.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        return { error: "Этот email уже зарегистрирован — войди." };
      }
      // With email confirmation off this has a session (instant login); with it
      // on there's no session yet and the user must confirm via the email link.
      return { needsConfirmation: !data.session };
    },
    signInGoogle: async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      return { error: error?.message };
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
