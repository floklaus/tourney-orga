"use client";

import { useId, useRef } from "react";
import type { Placeholder } from "@/lib/types";
import { inputClass } from "@/components/ui/field";
import { PlaceholderPicker } from "./placeholder-picker";
import { applyEdit, insertText, listFromSelection, wrapSelection, type Edit } from "./text-insert";

interface HtmlEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholders?: Placeholder[];
  error?: string;
  rows?: number;
  required?: boolean;
}

type ToolId = "bold" | "italic" | "link" | "paragraph" | "list";

const TOOLS: { id: ToolId; label: string; text: string; className?: string }[] = [
  { id: "bold", label: "Bold", text: "B", className: "font-bold" },
  { id: "italic", label: "Italic", text: "I", className: "italic" },
  { id: "link", label: "Insert link", text: "Link" },
  { id: "paragraph", label: "Paragraph", text: "¶" },
  { id: "list", label: "Bullet list", text: "• List" },
];

/** Lightweight HTML body editor: a textarea plus formatting toolbar. The server sanitizes the HTML. */
export function HtmlEditor({ label, value, onChange, placeholders, error, rows = 14, required }: HtmlEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();

  function edit(build: (el: HTMLTextAreaElement) => Edit | null) {
    const el = ref.current;
    if (!el) return;
    const result = build(el);
    if (result) applyEdit(el, result, onChange);
  }

  function runTool(tool: ToolId) {
    edit((el) => {
      switch (tool) {
        case "bold":
          return wrapSelection(el, "<strong>", "</strong>", "bold text");
        case "italic":
          return wrapSelection(el, "<em>", "</em>", "italic text");
        case "paragraph":
          return wrapSelection(el, "<p>", "</p>\n", "Paragraph");
        case "list":
          return listFromSelection(el);
        case "link": {
          const url = window.prompt("Link URL (https://…)", "https://");
          if (!url || !/^(https?:|mailto:|\{\{)/i.test(url)) return null;
          const safe = url.replace(/"/g, "&quot;");
          return wrapSelection(el, `<a href="${safe}">`, "</a>", "link text");
        }
      }
    });
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
        {required && <span className="text-red-700" aria-hidden="true"> *</span>}
      </label>
      <div role="toolbar" aria-label={`${label} formatting`} aria-controls={id} className="flex flex-wrap items-center gap-1 rounded-t-md border border-b-0 border-slate-300 bg-background-card p-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() => runTool(tool.id)}
            aria-label={tool.label}
            title={tool.label}
            className={`min-w-8 rounded px-2 py-1 text-sm text-slate-800 hover:bg-slate-200 ${tool.className ?? ""}`}
          >
            {tool.text}
          </button>
        ))}
        {placeholders && (
          <div className="ml-auto">
            <PlaceholderPicker placeholders={placeholders} onInsert={(token) => edit((el) => insertText(el, token))} />
          </div>
        )}
      </div>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        spellCheck
        className={`${inputClass} rounded-t-none font-mono`}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
