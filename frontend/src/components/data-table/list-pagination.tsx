"use client";

import { useId } from "react";
import { PAGE_SIZES, type ListMeta } from "@/lib/list-query";
import { Button } from "@/components/ui/button";

const T = {
  label: "Pagination",
  showing: (from: number, to: number, total: number) => `Showing ${from}–${to} of ${total}`,
  perPage: "Rows per page",
  page: (page: number, pages: number) => `Page ${page} of ${pages}`,
  previous: "Previous",
  next: "Next",
};

interface Props {
  meta: ListMeta;
  count: number;
  onPage: (page: number) => void;
  onLimit: (limit: number) => void;
}

export function ListPagination({ meta, count, onPage, onLimit }: Props) {
  const sizeId = useId();
  const limit = Math.max(1, meta.limit);
  const pages = Math.max(1, Math.ceil(meta.total / limit));
  const from = meta.total === 0 ? 0 : (meta.page - 1) * limit + 1;
  const to = from === 0 ? 0 : from + count - 1;
  const sizes: number[] = PAGE_SIZES.includes(limit as (typeof PAGE_SIZES)[number]) ? [...PAGE_SIZES] : [...PAGE_SIZES, limit].sort((a, b) => a - b);

  return (
    <nav aria-label={T.label} className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
      <span aria-live="polite">{T.showing(from, to, meta.total)}</span>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={sizeId} className="flex items-center gap-2">
          {T.perPage}
          <select
            id={sizeId}
            value={limit}
            onChange={(e) => onLimit(Number(e.target.value))}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900"
          >
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
              {T.previous}
            </Button>
            <span>{T.page(meta.page, pages)}</span>
            <Button variant="secondary" size="sm" disabled={meta.page >= pages} onClick={() => onPage(meta.page + 1)}>
              {T.next}
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
