import { normalize, type Trail } from "./domain.js";

const K = "trail-mix-trails";
export type LoadResult =
  | { status: "ok"; items: Trail[] }
  | { status: "empty" }
  | { status: "partial"; items: Trail[]; message: string }
  | { status: "error"; message: string };

export function load(): LoadResult {
  try {
    const raw = localStorage.getItem(K);
    if (raw === null) return { status: "empty" };
    let p: unknown;
    try { p = JSON.parse(raw); } catch { return { status: "error", message: "Saved data could not be parsed. Starting fresh." }; }
    if (!Array.isArray(p)) return { status: "error", message: "Saved data has an unexpected format. Starting fresh." };
    const valid: Trail[] = [];
    let bad = 0;
    for (const x of p) { const t = normalize(x); if (t) valid.push(t); else bad++; }
    if (!valid.length && !p.length) return { status: "empty" };
    if (bad > 0 && !valid.length) return { status: "error", message: `All ${bad} saved trail(s) were corrupted. Starting fresh.` };
    if (bad > 0) return { status: "partial", items: valid, message: `${bad} corrupted trail record(s) were removed.` };
    return { status: "ok", items: valid };
  } catch (e) {
    return { status: "error", message: `Could not read saved data: ${e instanceof Error ? e.message : "Unknown error"}` };
  }
}

export interface SaveResult { ok: boolean; message?: string; }

export function save(items: Trail[]): SaveResult {
  try {
    localStorage.setItem(K, JSON.stringify(items));
    return { ok: true };
  } catch (e) {
    const msg = e instanceof DOMException && e.name === "QuotaExceededError"
      ? "Storage quota exceeded. Remove some trails to save."
      : `Could not save trails: ${e instanceof Error ? e.message : "Unknown error"}`;
    return { ok: false, message: msg };
  }
}
