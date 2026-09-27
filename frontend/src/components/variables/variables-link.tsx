"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

/** Anchor ids of the Variables sections on the tournament and participation pages. */
export const TOURNAMENT_VARIABLES_ID = "tournament-variables";
export const PARTICIPATION_VARIABLES_ID = "participation-variables";

export const tournamentVariablesHref = (tournamentId: string) => `/tournaments/${tournamentId}#${TOURNAMENT_VARIABLES_ID}`;
export const participationVariablesHref = (participationId: string) =>
  `/participations/${participationId}#${PARTICIPATION_VARIABLES_ID}`;

export const variableInputId = (sectionId: string, key: string) => `${sectionId}-var-${key}`;

/** Scrolls to a variables section and focuses its first missing (or first) value input. */
export function focusVariablesSection(sectionId: string): boolean {
  const section = document.getElementById(sectionId);
  if (!section) return false;
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  const input =
    section.querySelector<HTMLInputElement>("input[data-missing='true']") ?? section.querySelector<HTMLInputElement>("input");
  (input ?? section).focus({ preventScroll: true });
  return true;
}

/** Focuses the section once when the page was opened with its #hash (e.g. from the work queue). */
export function useFocusOnHash(sectionId: string, ready: boolean): void {
  useEffect(() => {
    if (ready && window.location.hash === `#${sectionId}`) focusVariablesSection(sectionId);
  }, [sectionId, ready]);
}

interface Props {
  href: string;
  children: ReactNode;
  className?: string;
  /** Called before navigating, e.g. to close the dialog the link sits in. */
  onNavigate?: () => void;
}

/**
 * Link to a Variables section (`/path#section`). On that page itself it closes the surrounding
 * dialog (via onNavigate) and focuses the section instead of navigating.
 */
export function VariablesLink({ href, children, className, onNavigate }: Props) {
  const pathname = usePathname();
  const [path, sectionId = ""] = href.split("#");
  const samePage = pathname === path;
  return (
    <Link
      href={href}
      className={className ?? "font-medium underline"}
      onClick={(event) => {
        onNavigate?.();
        if (!samePage || !sectionId) return;
        event.preventDefault();
        // Let a closing dialog restore focus first, then move focus to the section.
        setTimeout(() => focusVariablesSection(sectionId), 0);
      }}
    >
      {children}
    </Link>
  );
}
