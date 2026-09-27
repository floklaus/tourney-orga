"use client";

import type { EmailStep } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  actionLabel,
  availableActions,
  BLOCKED_BY_MISSING_VARIABLES,
  blockedHintId,
  missingVariablesOfStep,
  type StepAction,
} from "./step-actions";

const DANGER: StepAction[] = ["cancel", "delete", "skip", "dismiss"];
const T = {
  blocked: (keys: string) => `Can't send yet: missing variable(s) ${keys}. Fill them in first.`,
  label: (action: string, step: string) => `${action}: ${step}`,
  group: (step: string) => `Actions for ${step}`,
};

interface Props {
  step: EmailStep;
  onAction: (action: StepAction, step: EmailStep) => void;
  exclude?: StepAction[];
  /** True while the server is in MANUAL sending mode (adjusts labels). */
  manual?: boolean;
}

function variantFor(action: StepAction, step: EmailStep) {
  if (action === "send-manually") return "primary";
  if (action === "send-now" && step.isPastDue) return "primary";
  return DANGER.includes(action) ? "danger-outline" : "secondary";
}

export function StepActionButtons({ step, onAction, exclude = [], manual = false }: Props) {
  const actions = availableActions(step).filter((a) => !exclude.includes(a));
  if (actions.length === 0) return null;
  const missing = missingVariablesOfStep(step);
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={T.group(step.name)}>
      {actions.map((action) => {
        const blocked = missing.length > 0 && BLOCKED_BY_MISSING_VARIABLES.includes(action);
        const label = actionLabel(action, manual);
        return (
          <Button
            key={action}
            size="sm"
            variant={variantFor(action, step)}
            onClick={() => onAction(action, step)}
            disabled={blocked}
            title={blocked ? T.blocked(missing.join(", ")) : undefined}
            aria-label={T.label(label, step.name)}
            aria-describedby={blocked ? blockedHintId(step) : undefined}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
