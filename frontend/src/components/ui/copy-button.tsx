"use client";

import { useEffect, useRef, useState } from "react";
import type { CopyResult } from "@/lib/clipboard";
import { Button, type ButtonProps } from "./button";

const RESET_MS = 2500;
const T = {
  copied: "Copied",
  copiedPlain: "Copied as plain text (formatting not supported by this browser).",
  failed: "Could not copy. Select the text and copy it manually.",
};

type State = "idle" | "rich" | "plain" | "error";

interface Props extends Omit<ButtonProps, "onClick" | "children"> {
  label: string;
  /** Performs the copy; resolves with what was copied. */
  onCopy: () => Promise<CopyResult>;
}

/** Copy button with visible "Copied" feedback, read out via an aria-live region. */
export function CopyButton({ label, onCopy, variant = "secondary", size = "sm", ...rest }: Props) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function handleClick() {
    let next: State;
    try {
      next = await onCopy();
    } catch {
      next = "error";
    }
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), RESET_MS);
  }

  const copied = state === "rich" || state === "plain";
  const message = state === "plain" ? T.copiedPlain : state === "error" ? T.failed : copied ? T.copied : "";

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant={variant} size={size} onClick={handleClick} {...rest}>
        {copied ? `✓ ${T.copied}` : label}
      </Button>
      <span aria-live="polite" className={state === "plain" || state === "error" ? "text-xs text-slate-700" : "sr-only"}>
        {message}
      </span>
    </span>
  );
}
