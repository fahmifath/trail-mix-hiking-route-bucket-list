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

export interface ValidationErrors {
  name?: string;
  location?: string;
  distance?: string;
  difficulty?: string;
  unit?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationErrors;
}

export interface TrailInput {
  name: string;
  location: string;
  distance: string;
  unit: string;
  difficulty: string;
  notes: string;
  status: string;
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
  const input: TrailInput = {
    name: typeof r.name === "string" ? r.name : "",
    location: typeof r.location === "string" ? r.location : "",
    distance: typeof r.distance === "number" ? String(r.distance) : String(r.distance ?? ""),
    unit: typeof r.unit === "string" ? r.unit : "",
    difficulty: typeof r.difficulty === "string" ? r.difficulty : "",
    notes: typeof r.notes === "string" ? r.notes : "",
    status: typeof r.status === "string" ? r.status : "want",
  };
  if (!validate(input).ok) return null;
  const id = typeof r.id === "string" && r.id.trim() ? r.id : "";
  if (!id) return null;
  return createItem(input, id, typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString());
}

export function filterItems(items: Trail[], query: string): Trail[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((t) => t.name.toLowerCase().includes(q) || t.location.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q));
}

export function sortItems(items: Trail[]): Trail[] {
  return [...items].sort((a, b) => a.status !== b.status ? (a.status === "want" ? -1 : 1) : a.name.localeCompare(b.name));
}

export function formatDistance(distance: number, unit: Unit): string {
  const d = Number.isInteger(distance) ? distance : parseFloat(distance.toFixed(1));
  return `${d} ${unit}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "Unknown date" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export interface Summary {
  total: number;
  completed: number;
  totalDistance: number;
  unit: string;
}

export function summarize(items: Trail[]): Summary {
  const done = items.filter((t) => t.status === "completed");
  const mixed = done.length > 0 && done.some((t) => t.unit !== done[0].unit);
  const unit = mixed ? "mi" : done.length > 0 ? done[0].unit : "mi";
  const dist = done.reduce((sum, t) => sum + (t.unit === unit ? t.distance : t.unit === "km" ? t.distance * 0.621371 : t.distance / 0.621371), 0);
  return { total: items.length, completed: done.length, totalDistance: parseFloat(dist.toFixed(1)), unit };
}
