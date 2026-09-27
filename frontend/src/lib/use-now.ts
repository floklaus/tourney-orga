"use client";

import { useEffect, useState } from "react";

const DEFAULT_TICK_MS = 60_000;

/** Current time in ms, refreshed every `tickMs` so relative times ("in 5 minutes") stay current. */
export function useNow(tickMs = DEFAULT_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);
  return now;
}
