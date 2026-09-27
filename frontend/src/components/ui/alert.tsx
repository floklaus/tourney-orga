import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { errorDetails, errorMessage } from "@/lib/errors";
import { isApiError } from "@/lib/api";

type Tone = "info" | "success" | "warning" | "error";

const TONES: Record<Tone, string> = {
  info: "border-brand-orange-muted bg-brand-orange-soft text-brand-ink",
  success: "border-green-200 bg-green-50 text-green-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-900",
};

export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-md border px-4 py-3 text-sm", TONES[tone], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : undefined}>{children}</div>}
    </div>
  );
}

/** Shows an API error message plus any validation details. */
export function ErrorAlert({ error, title, className }: { error: unknown; title?: string; className?: string }) {
  if (!error) return null;
  const details = isApiError(error) ? errorDetails(error.details) : [];
  return (
    <Alert tone="error" title={title ?? errorMessage(error)} className={className}>
      {title && <p>{errorMessage(error)}</p>}
      {details.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {details.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}
