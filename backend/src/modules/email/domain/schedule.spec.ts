import { isPastDue, CATCH_UP_WINDOW_MS } from './schedule';

describe('isPastDue', () => {
  const now = new Date('2026-06-01T10:00:00Z');
  const at = (msAgo: number) => new Date(now.getTime() - msAgo);

  it('does not flag a step that became due moments ago (the scheduler will send it)', () => {
    expect(isPastDue(at(20_000), true, now)).toBe(false);
    expect(isPastDue(at(CATCH_UP_WINDOW_MS), true, now)).toBe(false);
  });

  it('flags a step that is later than the catch-up window', () => {
    expect(isPastDue(at(CATCH_UP_WINDOW_MS + 1), true, now)).toBe(true);
  });

  it('never flags steps that are not live or have no send time', () => {
    expect(isPastDue(at(10 * CATCH_UP_WINDOW_MS), false, now)).toBe(false);
    expect(isPastDue(null, true, now)).toBe(false);
  });
});
