import { isApiError } from "./api";

/** Normalises the free-form `details` of an API error into readable lines. */
export function errorDetails(details: unknown): string[] {
  if (details === null || details === undefined) return [];
  if (typeof details === "string") return [details];
  if (Array.isArray(details)) return details.flatMap((item) => errorDetails(item));
  if (typeof details === "object") {
    const record = details as Record<string, unknown>;
    if (typeof record.message === "string") {
      const prefix =
        typeof record.field === "string"
          ? `${record.field}: `
          : typeof record.property === "string"
            ? `${record.property}: `
            : typeof record.row === "number"
              ? `Row ${record.row}: `
              : "";
      return [`${prefix}${record.message}`];
    }
    if (Array.isArray(record.constraints)) return errorDetails(record.constraints);
    return Object.entries(record).flatMap(([key, value]) =>
      errorDetails(value).map((line) => `${key}: ${line}`),
    );
  }
  return [String(details)];
}

export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

export function isConflict(error: unknown): boolean {
  return isApiError(error) && error.code === "CONFLICT";
}

/**
 * Keys from a 422 `{ details: { missingVariables } }` (sending blocked by missing tournament
 * variables), or null for any other error.
 */
export function missingVariablesOf(error: unknown): string[] | null {
  if (!isApiError(error) || error.status !== 422) return null;
  const details = error.details as { missingVariables?: unknown } | null | undefined;
  const keys = details && typeof details === "object" ? details.missingVariables : undefined;
  if (!Array.isArray(keys)) return null;
  return keys.filter((key): key is string => typeof key === "string");
}

/** Like errorMessage, but spells out a missing-variables 422 in plain words. */
export function sendErrorMessage(error: unknown): string {
  const missing = missingVariablesOf(error);
  if (missing) return `Can't send yet: missing variable(s) ${missing.join(", ")}.`;
  return errorMessage(error);
}
