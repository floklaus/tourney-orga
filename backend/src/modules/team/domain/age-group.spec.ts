import { ageGroupFor, matchAgeGroup, schoolYearEnd } from './age-group';

describe('age groups from graduation year', () => {
  it('rolls the school year over in the season start month', () => {
    expect(schoolYearEnd('2026-08-31', 9)).toBe(2026);
    expect(schoolYearEnd('2026-09-01', 9)).toBe(2027);
    expect(schoolYearEnd('2026-03-15', 9)).toBe(2026);
    // January start means calendar years
    expect(schoolYearEnd('2026-12-31', 1)).toBe(2026);
  });

  it('maps 8th graders to U14 (grade + 6)', () => {
    // School year 2025/26: the class of 2030 is in 8th grade
    expect(ageGroupFor(2030, '2026-05-01', 9)).toBe('U14');
    expect(ageGroupFor(2030, '2026-10-01', 9)).toBe('U15');
    expect(ageGroupFor(2032, '2026-05-01', 9)).toBe('U12');
  });

  it('returns null without a graduation year', () => {
    expect(ageGroupFor(null, '2026-05-01', 9)).toBeNull();
  });

  describe('matchAgeGroup', () => {
    const groups = ['U10', 'U12', '14U', 'U16'];

    it('picks the youngest group the team is eligible for', () => {
      expect(matchAgeGroup(2032, '2026-05-01', 9, groups)).toBe('U12');
      expect(matchAgeGroup(2031, '2026-05-01', 9, groups)).toBe('14U');
      expect(matchAgeGroup(2030, '2026-05-01', 9, groups)).toBe('14U');
    });

    it('prefers a division named after the graduation year', () => {
      expect(matchAgeGroup(2030, '2026-05-01', 9, ['2030', 'U14'])).toBe(
        '2030',
      );
    });

    it('returns null when no group fits', () => {
      expect(matchAgeGroup(2026, '2026-05-01', 9, groups)).toBeNull();
      expect(matchAgeGroup(null, '2026-05-01', 9, groups)).toBeNull();
      expect(matchAgeGroup(2030, '2026-05-01', 9, ['Open'])).toBeNull();
    });
  });
});
