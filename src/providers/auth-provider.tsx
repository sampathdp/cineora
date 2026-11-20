"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AUTH_EXPIRED_EVENT, ApiError } from "@/lib/api/client";
import { authApi, type AuthUser, type LoginResult } from "@/lib/api/auth";
import { loadCache } from "@/lib/load-cache";

type Status = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: Status;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  staffLogin: (email: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
  /** UX only (menus, buttons). The API enforces authorization on every request. */
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: Status; user: AuthUser | null }>({ status: "loading", user: null });

  const refresh = useCallback(async () => {
    try {
      const user = await authApi.me();
      setState({ status: "authenticated", user });
      return user;
    } catch (e) {
      // 401 means signed out; a network failure leaves us anonymous rather than blocking the site.
      if (!(e instanceof ApiError)) throw e;
      setState({ status: "anonymous", user: null });
      return null;
    }
  }, []);

  useEffect(() => {
    let live = true;
    authApi
      .me()
      .then((user) => live && setState({ status: "authenticated", user }))
      // 401 = signed out; any failure (including network) leaves the public site usable as anonymous.
      .catch(() => live && setState({ status: "anonymous", user: null }));
    const onExpired = () => setState({ status: "anonymous", user: null });
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => {
      live = false;
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    loadCache.clear();
    setState({ status: "authenticated", user: result.user });
    return result;
  }, []);

  const staffLogin = useCallback(async (email: string, password: string) => {
    const result = await authApi.staffLogin(email, password);
    loadCache.clear();
    setState({ status: "authenticated", user: result.user });
    return result;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      loadCache.clear();
      setState({ status: "anonymous", user: null });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      staffLogin,
      logout,
      refresh,
      can: (permission) => !!state.user?.permissions.includes(permission),
    }),
    [state, login, staffLogin, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
