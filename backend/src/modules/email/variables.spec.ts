import { EmailStep, StepStatus } from './email-step.entity';
import {
  effectiveVariables,
  missingVariablesOf,
  participationVariables,
} from './variables';

const step = (
  id: string,
  subject: string,
  body: string,
  status = StepStatus.SCHEDULED,
) =>
  ({
    id,
    name: id,
    status,
    subjectOverride: null,
    template: { subject, bodyHtml: body },
  }) as unknown as EmailStep;

describe('variables', () => {
  it('lets non-blank per-team overrides win over tournament values', () => {
    expect(
      effectiveVariables(
        { venue: 'Hall', time: '10:00' },
        { venue: 'Field 2', time: '  ' },
      ),
    ).toEqual({
      venue: 'Field 2',
      time: '10:00',
    });
  });

  it('reports variables missing for a step', () => {
    expect(
      missingVariablesOf(
        step('a', '{{tournament.vars.venue}}', '{{tournament.vars.time}}'),
        { venue: 'x' },
      ),
    ).toEqual(['time']);
  });

  it('summarizes required variables of unsent steps with their source', () => {
    const steps = [
      step('a', '{{tournament.vars.venue}}', '<p>{{tournament.vars.time}}</p>'),
      step(
        'b',
        'S',
        '<p>{{tournament.vars.venue}} {{tournament.vars.parking}}</p>',
      ),
      step('c', '{{tournament.vars.old}}', '<p>x</p>', StepStatus.SENT),
    ];
    const result = participationVariables(
      steps,
      { venue: 'Hall', time: '9:00' },
      { time: '10:00' },
    );
    expect(result.requiredVariables).toEqual([
      {
        key: 'parking',
        value: null,
        source: null,
        steps: [{ id: 'b', name: 'b' }],
      },
      {
        key: 'time',
        value: '10:00',
        source: 'PARTICIPATION',
        steps: [{ id: 'a', name: 'a' }],
      },
      {
        key: 'venue',
        value: 'Hall',
        source: 'TOURNAMENT',
        steps: [
          { id: 'a', name: 'a' },
          { id: 'b', name: 'b' },
        ],
      },
    ]);
    expect(result.missingVariables).toEqual(['parking']);
  });
});
