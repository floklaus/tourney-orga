import { resolveSendAt } from './send-time';

const tournament = { startDate: '2026-06-20', endDate: '2026-06-21' };
const zone = 'Europe/Berlin';

describe('resolveSendAt', () => {
  it('returns sendAt for absolute steps', () => {
    const sendAt = new Date('2026-06-01T07:00:00Z');
    expect(
      resolveSendAt(
        {
          timingType: 'ABSOLUTE',
          sendAt,
          offsetDays: null,
          timeOfDay: null,
          anchor: 'START',
        },
        tournament,
        zone,
      ),
    ).toEqual(sendAt);
  });

  it('counts days from the tournament start at the local time of day', () => {
    const result = resolveSendAt(
      {
        timingType: 'RELATIVE',
        sendAt: null,
        offsetDays: -14,
        timeOfDay: '09:00',
        anchor: 'START',
      },
      tournament,
      zone,
    );
    expect(result?.toISOString()).toBe('2026-06-06T07:00:00.000Z');
  });

  it('can count from the tournament end', () => {
    const result = resolveSendAt(
      {
        timingType: 'RELATIVE',
        sendAt: null,
        offsetDays: 1,
        timeOfDay: '10:30',
        anchor: 'END',
      },
      tournament,
      zone,
    );
    expect(result?.toISOString()).toBe('2026-06-22T08:30:00.000Z');
  });

  it('keeps local wall-clock time across a DST change', () => {
    const result = resolveSendAt(
      {
        timingType: 'RELATIVE',
        sendAt: null,
        offsetDays: 3,
        timeOfDay: '09:00',
        anchor: 'START',
      },
      { startDate: '2026-10-23', endDate: '2026-10-23' },
      zone,
    );
    expect(result?.toISOString()).toBe('2026-10-26T08:00:00.000Z');
  });

  it('returns null for incomplete timings', () => {
    expect(
      resolveSendAt(
        {
          timingType: 'ABSOLUTE',
          sendAt: null,
          offsetDays: null,
          timeOfDay: null,
          anchor: 'START',
        },
        tournament,
        zone,
      ),
    ).toBeNull();
    expect(
      resolveSendAt(
        {
          timingType: 'RELATIVE',
          sendAt: null,
          offsetDays: null,
          timeOfDay: '09:00',
          anchor: 'START',
        },
        tournament,
        zone,
      ),
    ).toBeNull();
  });
});
