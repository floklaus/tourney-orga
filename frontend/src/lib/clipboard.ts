/** Result of a copy: "rich" = HTML + plain text, "plain" = plain text only. */
export type CopyResult = "rich" | "plain";

export async function copyText(text: string): Promise<CopyResult> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    throw new Error("The clipboard is not available in this browser.");
  }
  await navigator.clipboard.writeText(text);
  return "plain";
}

/**
 * Puts both text/html and text/plain on the clipboard so pasting into Gmail or
 * Outlook keeps the formatting. Falls back to plain text where ClipboardItem is
 * unsupported or the rich write is rejected.
 */
export async function copyRich(html: string, text: string): Promise<CopyResult> {
  const canWriteRich =
    typeof ClipboardItem !== "undefined" && typeof navigator !== "undefined" && Boolean(navigator.clipboard?.write);
  if (canWriteRich) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return "rich";
    } catch {
      // Some browsers expose ClipboardItem but reject text/html; plain text still works.
    }
  }
  return copyText(text);
}
