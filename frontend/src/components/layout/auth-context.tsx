"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { LoadingState, ErrorState } from "@/components/ui/states";

interface AuthContextValue {
  user: User;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);


/** Loads the current user; unauthenticated visitors are redirected by the API client. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: user, error, loading, reload } = useApi("me", () => api.get<User>("/auth/me"));
  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      router.replace("/login");
    }
  }, [router]);
  const value = useMemo(() => (user ? { user, logout } : null), [user, logout]);

  if (!value) {
    if (error && error.code !== "UNAUTHORIZED") {
      return (
        <div className="mx-auto max-w-md p-6">
          <ErrorState error={error} onRetry={reload} />
        </div>
      );
    }
    if (error) {
      return (
        <div className="mx-auto max-w-md p-6 text-center">
          <p className="mb-4 text-sm text-slate-700">Your session has ended.</p>
          <Button onClick={() => router.replace("/login")}>Go to login</Button>
        </div>
      );
    }
    return <LoadingState label={loading ? "Checking your session…" : "Loading…"} />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
