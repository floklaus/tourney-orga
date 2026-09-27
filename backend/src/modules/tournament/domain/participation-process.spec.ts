import {
  allowedTransitions,
  computeSteps,
  DEFAULT_MILESTONES,
  dueDateOf,
  milestoneOrderProblems,
  PROCESS,
  ParticipationStatus as S,
  transitionPath,
} from './participation-process';

const tournament = { startDate: '2026-06-20', endDate: '2026-06-21' };

describe('participation process', () => {
  it('has the 8 steps in order with PARTICIPATED last', () => {
    expect(PROCESS).toEqual([
      S.SIGNED_UP,
      S.PAID,
      S.ADDED_TO_SPORTSENGINE,
      S.ADDED_TO_STAFF_CALENDAR,
      S.ROSTER_CONFIRMED,
      S.WAIVER_REQUESTED,
      S.WAIVER_CONFIRMED,
      S.PARTICIPATED,
    ]);
  });

  describe('allowedTransitions', () => {
    it('allows any later step, one step back and withdrawing', () => {
      expect(allowedTransitions(S.PAID, null)).toEqual([
        S.ADDED_TO_SPORTSENGINE,
        S.ADDED_TO_STAFF_CALENDAR,
        S.ROSTER_CONFIRMED,
        S.WAIVER_REQUESTED,
        S.WAIVER_CONFIRMED,
        S.PARTICIPATED,
        S.SIGNED_UP,
        S.WITHDRAWN,
      ]);
    });

    it('has no step back from the first step', () => {
      expect(allowedTransitions(S.SIGNED_UP, null)).toContain(S.WITHDRAWN);
      expect(allowedTransitions(S.SIGNED_UP, null)).not.toContain(S.SIGNED_UP);
    });

    it('treats PARTICIPATED as terminal', () => {
      expect(allowedTransitions(S.PARTICIPATED, null)).toEqual([]);
    });

    it('only allows reinstating a withdrawn participation to its previous status', () => {
      expect(allowedTransitions(S.WITHDRAWN, S.ROSTER_CONFIRMED)).toEqual([
        S.ROSTER_CONFIRMED,
      ]);
    });
  });

  describe('transitionPath', () => {
    it('records every skipped step when jumping forward', () => {
      expect(transitionPath(S.PAID, S.ADDED_TO_STAFF_CALENDAR)).toEqual([
        S.ADDED_TO_SPORTSENGINE,
        S.ADDED_TO_STAFF_CALENDAR,
      ]);
    });

    it('is a single change for back, withdraw and reinstate', () => {
      expect(transitionPath(S.PAID, S.SIGNED_UP)).toEqual([S.SIGNED_UP]);
      expect(transitionPath(S.PAID, S.WITHDRAWN)).toEqual([S.WITHDRAWN]);
      expect(transitionPath(S.WITHDRAWN, S.PAID)).toEqual([S.PAID]);
    });
  });

  describe('due dates', () => {
    it('counts days from the start or end date', () => {
      expect(
        dueDateOf(
          { status: S.PAID, offsetDays: -75, anchor: 'START' },
          tournament,
        ),
      ).toBe('2026-04-06');
      expect(
        dueDateOf(
          { status: S.PARTICIPATED, offsetDays: 1, anchor: 'END' },
          tournament,
        ),
      ).toBe('2026-06-22');
    });

    it('reports milestones whose due dates go backwards', () => {
      const broken = DEFAULT_MILESTONES.map((m) =>
        m.status === S.PAID ? { ...m, offsetDays: -100 } : m,
      );
      expect(milestoneOrderProblems(broken, tournament)).toEqual([S.PAID]);
      expect(milestoneOrderProblems(DEFAULT_MILESTONES, tournament)).toEqual(
        [],
      );
    });
  });

  describe('computeSteps', () => {
    const history = [
      { toStatus: S.SIGNED_UP, changedAt: new Date('2026-03-01T10:00:00Z') },
      { toStatus: S.PAID, changedAt: new Date('2026-03-20T10:00:00Z') },
    ];

    it('marks done, next (overdue or not) and upcoming steps', () => {
      const result = computeSteps(
        S.PAID,
        DEFAULT_MILESTONES,
        tournament,
        history,
        '2026-04-25',
        'Europe/Berlin',
      );
      expect(result.steps.map((s) => s.state)).toEqual([
        'DONE',
        'DONE',
        'OVERDUE', // added to SportsEngine was due 2026-04-21
        'UPCOMING',
        'UPCOMING',
        'UPCOMING',
        'UPCOMING',
        'UPCOMING',
      ]);
      expect(result.steps[1].completedAt).toBe('2026-03-20');
      expect(result).toMatchObject({
        nextStatus: S.ADDED_TO_SPORTSENGINE,
        nextDueDate: '2026-04-21',
        overdue: true,
        daysUntilDue: -4,
      });
    });

    it('is not overdue on the due date itself', () => {
      const result = computeSteps(
        S.PAID,
        DEFAULT_MILESTONES,
        tournament,
        history,
        '2026-04-21',
        'Europe/Berlin',
      );
      expect(result).toMatchObject({ overdue: false, daysUntilDue: 0 });
      expect(result.steps[2].state).toBe('NEXT');
    });

    it('has no next step when participated or withdrawn', () => {
      expect(
        computeSteps(
          S.PARTICIPATED,
          DEFAULT_MILESTONES,
          tournament,
          [],
          '2026-07-01',
          'UTC',
        ),
      ).toMatchObject({
        nextStatus: null,
        overdue: false,
      });
      const withdrawn = computeSteps(
        S.WITHDRAWN,
        DEFAULT_MILESTONES,
        tournament,
        history,
        '2026-07-01',
        'UTC',
      );
      expect(withdrawn.nextStatus).toBeNull();
      expect(
        withdrawn.steps.slice(2).every((s) => s.state === 'WITHDRAWN'),
      ).toBe(true);
      expect(withdrawn.steps[0].state).toBe('DONE');
    });
  });
});
