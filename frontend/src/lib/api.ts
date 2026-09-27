import type { ListMeta } from "./list-query";
import type { ApiErrorCode, Envelope, Paginated } from "./types";

export const API_BASE = "/api/v1";

/** Routes that must never trigger the 401 -> /login redirect. */
const PUBLIC_PREFIXES = ["/login", "/invite", "/reset-password", "/unsubscribe"];

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ApiErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Plain key/value query, or ready-made URLSearchParams (needed for repeated keys such as filter[...]). */
export type Query = Record<string, string | number | boolean | undefined | null> | URLSearchParams;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  /** Skip the automatic redirect to /login on 401 (e.g. for the login call itself). */
  noAuthRedirect?: boolean;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function buildUrl(path: string, query?: Query): string {
  let params: URLSearchParams;
  if (query instanceof URLSearchParams) {
    params = query;
  } else {
    params = new URLSearchParams();
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });
  }
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ""}`;
}

function isOnPublicPage(): boolean {
  if (typeof window === "undefined") return true;
  const { pathname } = window.location;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectToLogin(): void {
  const { pathname, search } = window.location;
  const next = encodeURIComponent(`${pathname}${search}`);
  // A full page load is intended here: it drops all client state of the expired session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`/login?next=${next}`);
}

async function parseEnvelope<T>(response: Response): Promise<Envelope<T> | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return null;
  try {
    return (await response.json()) as Envelope<T>;
  } catch {
    return null;
  }
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta?: ListMeta }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const csrf = readCookie("csrf_token");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: "include",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", "Could not reach the server. Check your connection.", 0);
  }

  const envelope = await parseEnvelope<T>(response);

  if (response.status === 401 && !options.noAuthRedirect && !isOnPublicPage()) {
    redirectToLogin();
  }

  if (!response.ok || !envelope || !envelope.success) {
    const err = envelope?.error;
    throw new ApiError(
      err?.code ?? statusToCode(response.status),
      err?.message ?? `Request failed (${response.status})`,
      response.status,
      err?.details,
    );
  }

  return { data: envelope.data as T, meta: envelope.meta };
}

function statusToCode(status: number): ApiErrorCode {
  if (status === 400 || status === 422) return "VALIDATION_ERROR";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  return "INTERNAL_ERROR";
}

export const api = {
  async get<T>(path: string, query?: Query, opts?: Omit<RequestOptions, "query" | "body">) {
    return (await request<T>("GET", path, { ...opts, query })).data;
  },
  async list<T>(path: string, query?: Query): Promise<Paginated<T>> {
    const { data, meta } = await request<T[]>("GET", path, { query });
    const items = data ?? [];
    return { items, meta: meta ?? { total: items.length, page: 1, limit: items.length } };
  },
  async post<T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) {
    return (await request<T>("POST", path, { ...opts, body })).data;
  },
  async patch<T>(path: string, body: unknown) {
    return (await request<T>("PATCH", path, { body })).data;
  },
  async put<T>(path: string, body: unknown) {
    return (await request<T>("PUT", path, { body })).data;
  },
  async delete<T = null>(path: string) {
    return (await request<T>("DELETE", path)).data;
  },
};

/** Absolute URL (same-origin) for non-enveloped downloads such as CSV export. */
export function downloadUrl(path: string): string {
  return `${API_BASE}${path}`;
}
