import { api } from "@/lib/api";
import { MAX_LIMIT, toApiParams, EMPTY_QUERY, type ListFilters } from "@/lib/list-query";
import type { BulkActionResult, Delivery, DeliveryBulkAction } from "@/lib/types";

/** What a manual walk-through iterates over: a GET /deliveries query (status READY is always added). */
export interface DeliveryScope {
  filters: ListFilters;
  search?: string;
}

/** Every READY delivery matching the scope, in a stable order (for the manual walk-through). */
export async function fetchReadyDeliveries(scope: DeliveryScope): Promise<Delivery[]> {
  const params = toApiParams(
    { ...EMPTY_QUERY, search: scope.search ?? "", filters: { ...scope.filters, status: ["READY"] }, sort: "tournament" },
    {},
    { page: 1, limit: MAX_LIMIT },
  );
  return (await api.list<Delivery>("/deliveries", params)).items;
}

/** POST /deliveries/bulk: dismiss (FAILED -> SKIPPED) or resend failed deliveries. */
export const bulkDeliveries = (ids: string[], action: DeliveryBulkAction) =>
  api.post<BulkActionResult>("/deliveries/bulk", { ids, action });
