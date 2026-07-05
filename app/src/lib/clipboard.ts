export type CopyResult = { ok: true } | { ok: false; reason: string };

/** Copies text to the clipboard; errors come back as values, never thrown. */
export async function copyTextToClipboard(text: string): Promise<CopyResult> {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return { ok: false, reason: "clipboard unavailable" };
  }
  try {
    await navigator.clipboard.writeText(text);
    return { ok: true };
  } catch {
    return { ok: false, reason: "clipboard write rejected" };
  }
}
