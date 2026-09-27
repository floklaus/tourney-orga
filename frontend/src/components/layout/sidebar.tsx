"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, fullName } from "@/lib/format";
import { useAttention } from "@/lib/queries";
import { useAuth } from "./auth-context";
import { BrandLogo } from "./brand-logo";

const T = {
  queueCount: (total: number, high: number) =>
    high > 0 ? `${total} items need attention, ${high} urgent` : `${total} items need attention`,
};

const NAV_ITEMS: { href: string; label: string; showQueueCount?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/queue", label: "Work queue", showQueueCount: true },
  { href: "/tournaments", label: "Tournaments" },
  { href: "/participations", label: "Participations" },
  { href: "/deliveries", label: "Emails" },
  { href: "/templates", label: "Templates" },
  { href: "/teams", label: "Teams" },
  { href: "/groups", label: "Groups" },
  { href: "/users", label: "Users" },
  { href: "/settings", label: "Settings" },
];

function QueueCount() {
  const { data } = useAttention();
  if (!data || data.counts.total === 0) return null;
  const { total, high } = data.counts;
  return (
    <span
      className={cn(
        "ml-auto inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold",
        high > 0 ? "bg-red-600 text-white" : "bg-neutral-100 text-neutral-900",
      )}
    >
      <span aria-hidden="true">{total}</span>
      <span className="sr-only">{T.queueCount(total, high)}</span>
    </span>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-4 pt-3">
        <div className="rounded-md border-b-4 border-brand-orange bg-white px-3 pb-2 pt-3">
          <BrandLogo priority />
        </div>
        <p className="mt-3 px-1 font-display text-sm font-bold uppercase tracking-wide text-brand-orange-light">Team Communication</p>
      </div>
      <nav aria-label="Main" className="flex-1 space-y-1 px-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                active ? "bg-brand-orange font-semibold text-neutral-900" : "text-neutral-100 hover:bg-brand-charcoal-hover",
              )}
            >
              {item.label}
              {item.showQueueCount && <QueueCount />}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-4 text-sm text-neutral-200">
        <p className="truncate font-medium text-white">{fullName(user)}</p>
        <p className="truncate text-xs">{user.email}</p>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-3 rounded-md border border-neutral-400 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-charcoal-hover"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
