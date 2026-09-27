import { checkDays, shiftDays, tournamentDays } from './tournament-days';

const t = { startDate: '2027-06-10', endDate: '2027-06-12' };

describe('tournament days', () => {
  it('lists every day of the tournament', () => {
    expect(tournamentDays(t)).toEqual([
      '2027-06-10',
      '2027-06-11',
      '2027-06-12',
    ]);
    expect(
      tournamentDays({ startDate: '2027-06-10', endDate: '2027-06-10' }),
    ).toEqual(['2027-06-10']);
  });

  describe('checkDays', () => {
    it('defaults to all days', () => {
      expect(checkDays(t, undefined)).toHaveLength(3);
    });

    it('sorts and de-duplicates', () => {
      expect(checkDays(t, ['2027-06-12', '2027-06-10', '2027-06-12'])).toEqual([
        '2027-06-10',
        '2027-06-12',
      ]);
    });

    it('rejects empty lists and days outside the tournament', () => {
      expect(() => checkDays(t, [])).toThrow('Choose at least one day');
      expect(() => checkDays(t, ['2027-06-13'])).toThrow(
        '2027-06-13 is not a day of the tournament',
      );
    });
  });

  describe('shiftDays', () => {
    it('keeps each day at the same position when the tournament moves', () => {
      expect(
        shiftDays(['2027-06-11'], t, {
          startDate: '2027-07-01',
          endDate: '2027-07-03',
        }),
      ).toEqual(['2027-07-02']);
    });

    it('drops days that no longer exist and falls back to all days', () => {
      const shorter = { startDate: '2027-06-10', endDate: '2027-06-11' };
      expect(shiftDays(['2027-06-11', '2027-06-12'], t, shorter)).toEqual([
        '2027-06-11',
      ]);
      expect(shiftDays(['2027-06-12'], t, shorter)).toEqual([
        '2027-06-10',
        '2027-06-11',
      ]);
    });
  });
});
