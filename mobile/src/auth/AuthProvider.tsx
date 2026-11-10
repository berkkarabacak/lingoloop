import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Level, Stats, User } from "@lingoloop/shared";
import { api, setApiToken } from "../api/client";
import { tokenStore } from "./tokenStore";

type Status = "loading" | "signedOut" | "signedIn";
interface AuthValue {
  status: Status;
  user: User | null;
  stats: Stats | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  setLevel: (level: Level) => Promise<void>;
  refreshMe: () => Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);
const timezone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const refreshMe = useCallback(async () => {
    const result = await api<{ user: User; stats: Stats }>("/api/me");
    setUser(result.user);
    setStats(result.stats);
  }, []);

  useEffect(() => {
    void (async () => {
      const token = await tokenStore.get();
      if (!token) { setStatus("signedOut"); return; }
      setApiToken(token);
      try { await refreshMe(); setStatus("signedIn"); }
      catch { setApiToken(null); await tokenStore.clear(); setStatus("signedOut"); }
    })();
  }, [refreshMe]);

  const accept = useCallback(async (path: string, email: string, password: string) => {
    const result = await api<{ token: string; user: User }>(path, {
      method: "POST", body: JSON.stringify({ email, password, timezone: timezone() }),
    });
    setApiToken(result.token);
    await tokenStore.set(result.token);
    setUser(result.user);
    setStatus("signedIn");
    await refreshMe();
  }, [refreshMe]);

  const value = useMemo<AuthValue>(() => ({
    status, user, stats,
    signIn: (email, password) => accept("/api/auth/login", email, password),
    signUp: (email, password) => accept("/api/auth/signup", email, password),
    signOut: async () => {
      try { await api("/api/auth/logout", { method: "POST" }); } catch { /* Local sign-out still proceeds. */ }
      setApiToken(null); await tokenStore.clear(); setUser(null); setStats(null); setStatus("signedOut");
    },
    setLevel: async (level: Level) => {
      const result = await api<{ user: User }>("/api/me", { method: "PATCH", body: JSON.stringify({ level }) });
      setUser(result.user);
      await refreshMe();
    },
    refreshMe,
  }), [accept, refreshMe, stats, status, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
