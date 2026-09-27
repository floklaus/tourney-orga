"use client";

import Link from "next/link";
import type { SendingMode } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const T = {
  manualMode: "Manual sending mode",
  automaticMode: "Automatic sending",
  settingsLink: "Change sending mode",
};

export function SendingModeBadge({ mode }: { mode: SendingMode }) {
  return (
    <Link href="/settings" title={T.settingsLink} className="rounded-full focus-visible:outline-2">
      <Badge tone={mode === "MANUAL" ? "purple" : "teal"}>{mode === "MANUAL" ? T.manualMode : T.automaticMode}</Badge>
    </Link>
  );
}
