export const DIFFICULTIES = ["easy", "moderate", "hard", "epic"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const STATUSES = ["want", "completed"] as const;
export type Status = (typeof STATUSES)[number];
export const UNITS = ["mi", "km"] as const;
export type Unit = (typeof UNITS)[number];

export interface Trail {
  id: string;
  name: string;
  location: string;
  distance: number;
  unit: Unit;
  difficulty: Difficulty;
  notes: string;
  status: Status;
  createdAt: string;
}

export type ValidationErrors = Partial<Record<"name" | "location" | "distance" | "difficulty" | "unit", string>>;
export interface ValidationResult { ok: boolean; errors: ValidationErrors; }
export interface TrailInput {
  name: string; location: string; distance: string; unit: string; difficulty: string; notes: string; status: string;
}

export function validate(input: TrailInput): ValidationResult {
  const errors: ValidationErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = "Trail name is required.";
  else if (name.length > 100) errors.name = "Trail name must be 100 characters or fewer.";

  const loc = input.location.trim();
  if (!loc) errors.location = "Location is required.";
  else if (loc.length > 100) errors.location = "Location must be 100 characters or fewer.";

  const d = parseFloat(input.distance);
  if (!input.distance.trim() || isNaN(d)) errors.distance = "Distance is required and must be a number.";
  else if (d <= 0) errors.distance = "Distance must be greater than zero.";
  else if (d > 9999) errors.distance = "Distance must be 9999 or fewer.";

  if (!UNITS.includes(input.unit as Unit)) errors.unit = "Select a valid unit (mi or km).";
  if (!DIFFICULTIES.includes(input.difficulty as Difficulty)) errors.difficulty = "Select a valid difficulty level.";

  return { ok: Object.keys(errors).length === 0, errors };
}

export function createItem(input: TrailInput, id: string, now: string): Trail {
  return {
    id,
    name: input.name.trim(),
    location: input.location.trim(),
    distance: parseFloat(input.distance),
    unit: input.unit as Unit,
    difficulty: input.difficulty as Difficulty,
    notes: input.notes.trim().slice(0, 500),
    status: STATUSES.includes(input.status as Status) ? (input.status as Status) : "want",
    createdAt: now,
  };
}

export function normalize(raw: unknown): Trail | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const s = (k: string) => typeof r[k] === "string" ? (r[k] as string) : "";
  const input: TrailInput = {
    name: s("name"),
    location: s("location"),
    distance: typeof r.distance === "number" ? String(r.distance) : String(r.distance ?? ""),
    unit: s("unit"),
    difficulty: s("difficulty"),
    notes: s("notes"),
    status: s("status") || "want",
  };
  if (!validate(input).ok || typeof r.id !== "string" || !r.id.trim()) return null;
  return createItem(input, r.id, s("createdAt") || new Date().toISOString());
}

export const filterItems = (items: Trail[], q: string): Trail[] => {
  const s = q.trim().toLowerCase();
  return s ? items.filter((t) => (t.name + " " + t.location + " " + t.notes).toLowerCase().includes(s)) : items;
};

export const sortItems = (items: Trail[]): Trail[] =>
  [...items].sort((a, b) => a.status !== b.status ? (a.status === "want" ? -1 : 1) : a.name.localeCompare(b.name));

export const formatDistance = (d: number, u: Unit): string =>
  `${Number.isInteger(d) ? d : parseFloat(d.toFixed(1))} ${u}`;

export const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "Unknown date" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export interface Summary {
  total: number;
  completed: number;
  totalDistance: number;
  unit: string;
}

export function summarize(items: Trail[]): Summary {
  const done = items.filter((t) => t.status === "completed");
  const mixed = done.length > 0 && done.some((t) => t.unit !== done[0].unit);
  const unit = mixed ? "mi" : done[0]?.unit ?? "mi";
  const dist = done.reduce((sum, t) => sum + (t.unit === unit ? t.distance : t.unit === "km" ? t.distance * 0.621371 : t.distance / 0.621371), 0);
  return { total: items.length, completed: done.length, totalDistance: parseFloat(dist.toFixed(1)), unit };
}
