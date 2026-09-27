import type { ReactNode } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center bg-background-card px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <BrandLogo priority className="mx-auto w-64" />
          <p className="mt-2 font-display text-sm font-bold uppercase tracking-wide text-brand-grey">Team Communication</p>
        </div>
        <div className="rounded-lg border-t-4 border-brand-orange bg-white p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
