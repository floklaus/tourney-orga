export interface Edit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Replaces the current selection of a text control with `before + selection + after`. */
export function wrapSelection(el: HTMLTextAreaElement | HTMLInputElement, before: string, after = "", fallback = ""): Edit {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const selected = el.value.slice(start, end) || fallback;
  const value = el.value.slice(0, start) + before + selected + after + el.value.slice(end);
  const cursor = start + before.length;
  return { value, selectionStart: cursor, selectionEnd: cursor + selected.length };
}

/** Inserts `text` at the cursor, replacing any selection. */
export function insertText(el: HTMLTextAreaElement | HTMLInputElement, text: string): Edit {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const value = el.value.slice(0, start) + text + el.value.slice(end);
  const cursor = start + text.length;
  return { value, selectionStart: cursor, selectionEnd: cursor };
}

/** Turns the selected lines into an HTML bullet list. */
export function listFromSelection(el: HTMLTextAreaElement): Edit {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const lines = (el.value.slice(start, end) || "List item").split("\n").filter((l) => l.trim());
  const html = `<ul>\n${lines.map((l) => `  <li>${l.trim()}</li>`).join("\n")}\n</ul>`;
  const value = el.value.slice(0, start) + html + el.value.slice(end);
  return { value, selectionStart: start, selectionEnd: start + html.length };
}

export function applyEdit(el: HTMLTextAreaElement | HTMLInputElement, edit: Edit, onChange: (value: string) => void) {
  onChange(edit.value);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  });
}
