/** A due step later than this (e.g. server was down) needs a human decision instead of sending. */
export const CATCH_UP_WINDOW_MS = 60 * 60 * 1000;

/**
 * True when a live scheduled step missed its send time by more than the
 * catch-up window. Uses the same rule as the scheduler, so edits never flag
 * a step the scheduler would still send on its next tick.
 */
export function isPastDue(
  resolvedSendAt: Date | null,
  isLiveScheduled: boolean,
  now = new Date(),
): boolean {
  return (
    isLiveScheduled &&
    resolvedSendAt !== null &&
    now.getTime() - resolvedSendAt.getTime() > CATCH_UP_WINDOW_MS
  );
}
