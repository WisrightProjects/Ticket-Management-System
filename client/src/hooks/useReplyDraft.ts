import { useState } from "react";

const PREFIX = "right-tracker:reply-draft:";
type Mode = "public" | "internal";
const keyFor = (owner: string, ticket: string, mode: Mode) => `${PREFIX}${encodeURIComponent(owner)}:${encodeURIComponent(ticket)}:${mode}`;
function read(key: string): string {
  try { return sessionStorage.getItem(key) ?? ""; } catch { return ""; }
}
function write(key: string, text: string) {
  try { if (text) sessionStorage.setItem(key, text); else sessionStorage.removeItem(key); } catch { /* Private storage may be disabled; the in-memory draft still works. */ }
}
export function clearStaffDrafts() {
  try {
    const keys = Array.from({ length: sessionStorage.length }, (_, index) => sessionStorage.key(index));
    for (const key of keys) if (key?.startsWith(PREFIX)) sessionStorage.removeItem(key);
  } catch { /* Sign-out must continue even when browser storage is unavailable. */ }
}

export function useReplyDraft(owner: string | undefined, ticket: string) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const key = (mode: Mode) => keyFor(owner ?? "ephemeral", ticket, mode);
  const get = (mode: Mode) => drafts[key(mode)] ?? (owner ? read(key(mode)) : "");
  const set = (mode: Mode, text: string) => {
    const target = key(mode);
    if (owner) write(target, text);
    setDrafts((current) => ({ ...current, [target]: text }));
  };
  const clearSent = (mode: Mode, sentText: string) => {
    const target = key(mode);
    setDrafts((current) => {
      const currentText = current[target] ?? (owner ? read(target) : "");
      if (currentText !== sentText) return current;
      if (owner) write(target, "");
      return { ...current, [target]: "" };
    });
  };
  return { get, set, clearSent };
}
