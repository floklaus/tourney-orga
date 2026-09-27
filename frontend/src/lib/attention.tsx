"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { api } from "./api";
import { useApi, type QueryResult } from "./use-api";
import type { AttentionResponse } from "./types";

/** How often the work queue is refreshed while the app is open. */
export const ATTENTION_POLL_MS = 60_000;

const AttentionContext = createContext<QueryResult<AttentionResponse> | null>(null);

/**
 * Loads GET /attention once for the whole authenticated app and polls it, so the sidebar
 * badge, the dashboard card and the work queue page share one request and one state.
 */
export function AttentionProvider({ children }: { children: ReactNode }) {
  const attention = useApi("attention", () => api.get<AttentionResponse>("/attention"));
  const { reload } = attention;

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, ATTENTION_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  return <AttentionContext.Provider value={attention}>{children}</AttentionContext.Provider>;
}

/** Shared work-queue state (see AttentionProvider). Call `reload()` after any action. */
export function useAttention(): QueryResult<AttentionResponse> {
  const ctx = useContext(AttentionContext);
  if (!ctx) throw new Error("useAttention must be used inside AttentionProvider");
  return ctx;
}
