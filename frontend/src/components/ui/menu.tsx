"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { Button, type ButtonProps } from "./button";
import { usePopover } from "./popover";

export interface MenuItem {
  id: string;
  label: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface MenuSection {
  heading?: string;
  items: MenuItem[];
}

interface MenuProps {
  /** Visible trigger content. */
  label: ReactNode;
  /** Accessible name of the trigger when `label` alone is not descriptive. */
  ariaLabel?: string;
  sections: MenuSection[];
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  align?: "left" | "right";
  disabled?: boolean;
}

const itemSelector = '[role="menuitem"]:not([disabled])';

/** Button that opens a list of actions (role="menu", arrow-key navigation, Escape closes). */
export function Menu({ label, ariaLabel, sections, variant = "secondary", size = "sm", align = "right", disabled }: MenuProps) {
  const { open, toggle, close, rootRef, triggerRef, onRootKeyDown, onRootBlur } = usePopover();
  const menuId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const visible = sections.filter((s) => s.items.length > 0);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(itemSelector)?.focus();
  }, [open]);

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>(itemSelector) ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move: Record<string, number> = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: items.length - 1 };
    if (!(event.key in move) || items.length === 0) return;
    event.preventDefault();
    items[(move[event.key] + items.length) % items.length]?.focus();
  }

  return (
    <div ref={rootRef} className="relative inline-block" onKeyDown={onRootKeyDown} onBlur={onRootBlur}>
      <Button
        ref={triggerRef}
        variant={variant}
        size={size}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        onClick={toggle}
        disabled={disabled || visible.length === 0}
      >
        {label}
        <span aria-hidden="true">▾</span>
      </Button>
      {open && (
        <div
          ref={listRef}
          id={menuId}
          role="menu"
          aria-label={ariaLabel}
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute z-30 mt-1 max-h-80 min-w-48 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-left shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {visible.map((section, i) => (
            <div key={section.heading ?? i} role="group" aria-label={section.heading} className={cn(i > 0 && "border-t border-slate-100 pt-1")}>
              {section.heading && (
                <p aria-hidden="true" className="px-3 pb-0.5 pt-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {section.heading}
                </p>
              )}
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={item.disabled}
                  onClick={() => {
                    close();
                    item.onSelect();
                  }}
                  className={cn(
                    "block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 focus:bg-brand-orange-soft focus:outline-none disabled:text-slate-400",
                    item.danger ? "text-red-800" : "text-slate-900",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
