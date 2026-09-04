import { normalize, type Trail } from "./domain.js";

const KEY = "trail-mix-trails";

export type LoadResult =
  | { status: "ok"; items: Trail[] }
  | { status: "empty" }
  | { status: "partial"; items: Trail[]; message: string }
  | { status: "error"; message: string };

export function load(): LoadResult {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return { status: "empty" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { status: "error", message: "Saved data could not be parsed. Starting fresh." };
    }
    if (!Array.isArray(parsed)) return { status: "error", message: "Saved data has an unexpected format. Starting fresh." };
    const valid: Trail[] = [];
    let rejected = 0;
    for (const item of parsed) {
      const t = normalize(item);
      if (t) valid.push(t); else rejected++;
    }
    if (valid.length === 0 && parsed.length === 0) return { status: "empty" };
    if (rejected > 0 && valid.length === 0) return { status: "error", message: `All ${rejected} saved trail(s) were corrupted. Starting fresh.` };
    if (rejected > 0) return { status: "partial", items: valid, message: `${rejected} corrupted trail record(s) were removed.` };
    return { status: "ok", items: valid };
  } catch (e) {
    return { status: "error", message: `Could not read saved data: ${e instanceof Error ? e.message : "Unknown error"}` };
  }
}

export interface SaveResult { ok: boolean; message?: string; }

export function save(items: Trail[]): SaveResult {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return { ok: true };
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") return { ok: false, message: "Storage quota exceeded. Remove some trails to save." };
    return { ok: false, message: `Could not save trails: ${e instanceof Error ? e.message : "Unknown error"}` };
  }
}
