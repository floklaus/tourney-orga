import { EmailContext } from '../template/email-renderer.service';
import { EmailStep } from './email-step.entity';
import { effectiveVariables } from './variables';

/** Rendering context of a step. Requires step.participation.tournament loaded. */
export function emailContextOf(step: EmailStep): EmailContext {
  const { participation } = step;
  return {
    tournament: participation.tournament,
    variables: effectiveVariables(
      participation.tournament.variables,
      participation.variables,
    ),
    ageGroup: participation.ageGroup,
    days: participation.days,
  };
}

/** Relations the delivery engine needs to render and address a step. */
export const STEP_DELIVERY_RELATIONS = {
  template: true,
  participation: { tournament: true, team: true },
} as const;
