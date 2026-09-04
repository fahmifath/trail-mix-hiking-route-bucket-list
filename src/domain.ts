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

const MAX_NAME = 100;
const MAX_LOCATION = 100;
const MAX_NOTES = 500;
const MAX_DISTANCE = 9999;

export function validate(input: TrailInput): ValidationResult {
  const errors: ValidationErrors = {};
  const name = input.name.trim();
  if (!name) {
    errors.name = "Trail name is required.";
  } else if (name.length > MAX_NAME) {
    errors.name = `Trail name must be ${MAX_NAME} characters or fewer.`;
  }
  const location = input.location.trim();
  if (!location) {
    errors.location = "Location is required.";
  } else if (location.length > MAX_LOCATION) {
    errors.location = `Location must be ${MAX_LOCATION} characters or fewer.`;
  }
  const distVal = parseFloat(input.distance);
  if (input.distance.trim() === "" || isNaN(distVal)) {
    errors.distance = "Distance is required and must be a number.";
  } else if (distVal <= 0) {
    errors.distance = "Distance must be greater than zero.";
  } else if (distVal > MAX_DISTANCE) {
    errors.distance = `Distance must be ${MAX_DISTANCE} or fewer.`;
  }
  if (!(UNITS as readonly string[]).includes(input.unit)) {
    errors.unit = "Select a valid unit (mi or km).";
  }
  if (!(DIFFICULTIES as readonly string[]).includes(input.difficulty)) {
    errors.difficulty = "Select a valid difficulty level.";
  }
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
    notes: input.notes.trim().slice(0, MAX_NOTES),
    status: (STATUSES as readonly string[]).includes(input.status) ? (input.status as Status) : "want",
    createdAt: now,
  };
}

export function normalize(raw: unknown): Trail | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
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
  const result = validate(input);
  if (!result.ok) return null;
  const id = typeof r.id === "string" && r.id.trim() ? r.id : "";
  const createdAt = typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString();
  if (!id) return null;
  return createItem(input, id, createdAt);
}

export function filterItems(items: Trail[], query: string): Trail[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (t) => t.name.toLowerCase().includes(q) || t.location.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q)
  );
}

export function sortItems(items: Trail[]): Trail[] {
  return [...items].sort((a, b) => {
    if (a.status !== b.status) return a.status === "want" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function formatDistance(distance: number, unit: Unit): string {
  const d = Number.isInteger(distance) ? distance : parseFloat(distance.toFixed(1));
  return `${d} ${unit}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export interface Summary {
  total: number;
  completed: number;
  totalDistance: number;
  unit: string;
}

export function summarize(items: Trail[]): Summary {
  const completed = items.filter((t) => t.status === "completed");
  const mixedUnits = completed.length > 0 && completed.some((t) => t.unit !== completed[0].unit);
  const unit = mixedUnits ? "mi" : completed.length > 0 ? completed[0].unit : "mi";
  const totalDistance = completed.reduce((sum, t) => {
    const d = t.unit === unit ? t.distance : t.unit === "km" ? t.distance * 0.621371 : t.distance / 0.621371;
    return sum + d;
  }, 0);
  return { total: items.length, completed: completed.length, totalDistance: parseFloat(totalDistance.toFixed(1)), unit };
}
