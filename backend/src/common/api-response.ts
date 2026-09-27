export interface PageMeta {
  total: number;
  page: number;
  limit: number;
}

/** Returned by handlers that want `meta` in the envelope. */
export class Paginated<T> {
  constructor(
    readonly items: T[],
    readonly meta: PageMeta,
  ) {}
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  meta?: PageMeta;
}
