"use client";

import { api } from "./api";
import { browserTimeZone } from "./dates";
import { MAX_LIMIT } from "./list-query";
import { useApi } from "./use-api";
import type {
  EmailTemplate,
  MilestoneDefault,
  Placeholder,
  Quota,
  Settings,
  Team,
  Tournament,
} from "./types";

const MAX_PAGES = 20;

/** Pickers load everything in one request (generic list API, `limit` up to 500). */
export const ALL = { limit: MAX_LIMIT } as const;

/** Loads every (non-archived, the server default) team, walking pages beyond 500. */
export async function fetchAllTeams(): Promise<Team[]> {
  const all: Team[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { items, meta } = await api.list<Team>("/teams", { page, limit: MAX_LIMIT, sort: "name" });
    all.push(...items);
    if (items.length === 0 || all.length >= meta.total) break;
  }
  return all;
}

export const useTemplates = () => useApi("templates:all", () => api.get<EmailTemplate[]>("/templates", { ...ALL, sort: "name" }));
export const usePlaceholders = () =>
  useApi("placeholders", () => api.get<Placeholder[]>("/templates/placeholders"));
export const useAllTeams = () => useApi("all-teams", fetchAllTeams);
export const useQuota = () => useApi("quota", () => api.get<Quota>("/deliveries/quota"));
export const useSettings = () => useApi("settings", () => api.get<Settings>("/settings"));
export const useTournamentOptions = () =>
  useApi("tournaments:all", () => api.get<Tournament[]>("/tournaments", { ...ALL, sort: "-startDate" }));
export const useParticipationDefaults = () =>
  useApi("participation-defaults", () => api.get<MilestoneDefault[]>("/participation/defaults"));
/** Settings timezone (all email times are resolved in it), falling back to the browser's. */
export function useTimeZone(): string {
  const settings = useSettings();
  return settings.data?.timezone ?? browserTimeZone();
}

/** True while the server is in MANUAL sending mode (emails are prepared, not sent). */
export function useManualMode(): boolean {
  const settings = useSettings();
  return settings.data?.sendingMode === "MANUAL";
}

/** Shared, polled work queue (GET /attention); provided once by the app shell. */
export { useAttention } from "./attention";
