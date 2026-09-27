"use client";

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import type { ApiError } from "./api";

interface QueryState<T> {
  requestKey: string | null;
  data: T | undefined;
  error: ApiError | undefined;
}

export interface QueryResult<T> {
  data: T | undefined;
  error: ApiError | undefined;
  /** True while the current request (for the current key) has not resolved yet. */
  loading: boolean;
  reload: () => void;
}

/**
 * Minimal data-fetching hook. `key` identifies the request; whenever it changes
 * (or `reload` is called) the loader runs again. Previous data stays visible while
 * refetching so tables do not flash. Pass `null` as key to skip loading.
 */
export function useApi<T>(key: string | null, loader: () => Promise<T>): QueryResult<T> {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<QueryState<T>>({
    requestKey: null,
    data: undefined,
    error: undefined,
  });
  const requestKey = key === null ? null : `${key}#${nonce}`;
  const runLoader = useEffectEvent(loader);

  useEffect(() => {
    if (requestKey === null) return;
    let active = true;
    runLoader().then(
      (data) => {
        if (active) setState({ requestKey, data, error: undefined });
      },
      (error: ApiError) => {
        if (active) setState((prev) => ({ requestKey, data: prev.data, error }));
      },
    );
    return () => {
      active = false;
    };
  }, [requestKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    data: state.data,
    error: state.requestKey === requestKey ? state.error : undefined,
    loading: requestKey !== null && state.requestKey !== requestKey,
    reload,
  };
}
