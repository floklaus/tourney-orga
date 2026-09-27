import type { ReactNode } from "react";
import { Button, Spinner } from "./button";
import { ErrorAlert } from "./alert";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-12 text-sm text-slate-600">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-background-card px-6 py-10 text-center">
      <p className="font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="space-y-3 py-6">
      <ErrorAlert error={error} title="Could not load data" />
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

interface QueryViewProps<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  onRetry?: () => void;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}

/** Renders loading / error / empty / content for a useApi result. */
export function QueryView<T>({ data, error, loading, onRetry, isEmpty, empty, children }: QueryViewProps<T>) {
  if (error && data === undefined) return <ErrorState error={error} onRetry={onRetry} />;
  if (data === undefined) return loading ? <LoadingState /> : null;
  return (
    <>
      {error !== undefined && error !== null && <ErrorAlert error={error} className="mb-4" />}
      {isEmpty && isEmpty(data) ? empty : children(data)}
    </>
  );
}
