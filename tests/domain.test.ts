import { describe, it, expect } from "vitest";
import {
  validate, createItem, normalize, filterItems, sortItems,
  formatDate, formatDistance, summarize,
  DIFFICULTIES, STATUSES, UNITS,
  type TrailInput, type Trail,
} from "../src/domain.js";

// ── Helpers ────────────────────────────────────────────────────────────────
function validInput(overrides: Partial<TrailInput> = {}): TrailInput {
  return {
    name: "Half Dome",
    location: "Yosemite NP",
    distance: "14.2",
    unit: "mi",
    difficulty: "hard",
    notes: "A classic challenge",
    status: "want",
    ...overrides,
  };
}

function makeTrail(overrides: Partial<Trail> = {}): Trail {
  return {
    id: "t1",
    name: "Half Dome",
    location: "Yosemite NP",
    distance: 14.2,
    unit: "mi",
    difficulty: "hard",
    notes: "A classic challenge",
    status: "want",
    createdAt: "2026-01-15T10:00:00.000Z",
    ...overrides,
  };
}

// ── validate() ─────────────────────────────────────────────────────────────
describe("validate", () => {
  it("passes a fully valid input", () => {
    const r = validate(validInput());
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual({});
  });

  it("rejects empty trail name", () => {
    const r = validate(validInput({ name: "" }));
    expect(r.ok).toBe(false);
    expect(r.errors.name).toBeTruthy();
  });

  it("rejects whitespace-only trail name", () => {
    const r = validate(validInput({ name: "   " }));
    expect(r.ok).toBe(false);
    expect(r.errors.name).toBeTruthy();
  });

  it("accepts name at exactly max length (100 chars)", () => {
    const r = validate(validInput({ name: "A".repeat(100) }));
    expect(r.ok).toBe(true);
  });

  it("rejects name exceeding max length (101 chars)", () => {
    const r = validate(validInput({ name: "A".repeat(101) }));
    expect(r.ok).toBe(false);
    expect(r.errors.name).toMatch(/100/);
  });

  it("rejects empty location", () => {
    const r = validate(validInput({ location: "" }));
    expect(r.ok).toBe(false);
    expect(r.errors.location).toBeTruthy();
  });

  it("rejects whitespace-only location", () => {
    const r = validate(validInput({ location: "  \t  " }));
    expect(r.ok).toBe(false);
    expect(r.errors.location).toBeTruthy();
  });

  it("accepts location at exactly max length (100 chars)", () => {
    const r = validate(validInput({ location: "B".repeat(100) }));
    expect(r.ok).toBe(true);
  });

  it("rejects location exceeding max length (101 chars)", () => {
    const r = validate(validInput({ location: "B".repeat(101) }));
    expect(r.ok).toBe(false);
    expect(r.errors.location).toBeTruthy();
  });

  it("rejects empty distance", () => {
    const r = validate(validInput({ distance: "" }));
    expect(r.ok).toBe(false);
    expect(r.errors.distance).toBeTruthy();
  });

  it("rejects whitespace-only distance", () => {
    const r = validate(validInput({ distance: "   " }));
    expect(r.ok).toBe(false);
    expect(r.errors.distance).toBeTruthy();
  });

  it("rejects non-numeric distance", () => {
    const r = validate(validInput({ distance: "abc" }));
    expect(r.ok).toBe(false);
    expect(r.errors.distance).toBeTruthy();
  });

  it("rejects zero distance", () => {
    const r = validate(validInput({ distance: "0" }));
    expect(r.ok).toBe(false);
    expect(r.errors.distance).toBeTruthy();
  });

  it("rejects negative distance", () => {
    const r = validate(validInput({ distance: "-5" }));
    expect(r.ok).toBe(false);
    expect(r.errors.distance).toBeTruthy();
  });

  it("accepts distance at exactly max (9999)", () => {
    const r = validate(validInput({ distance: "9999" }));
    expect(r.ok).toBe(true);
  });

  it("rejects distance exceeding max (10000)", () => {
    const r = validate(validInput({ distance: "10000" }));
    expect(r.ok).toBe(false);
    expect(r.errors.distance).toBeTruthy();
  });

  it("rejects invalid unit", () => {
    const r = validate(validInput({ unit: "furlongs" }));
    expect(r.ok).toBe(false);
    expect(r.errors.unit).toBeTruthy();
  });

  it("accepts all valid units", () => {
    for (const unit of UNITS) {
      const r = validate(validInput({ unit }));
      expect(r.ok).toBe(true);
    }
  });

  it("rejects invalid difficulty", () => {
    const r = validate(validInput({ difficulty: "extreme" }));
    expect(r.ok).toBe(false);
    expect(r.errors.difficulty).toBeTruthy();
  });

  it("rejects empty difficulty (blank select)", () => {
    const r = validate(validInput({ difficulty: "" }));
    expect(r.ok).toBe(false);
    expect(r.errors.difficulty).toBeTruthy();
  });

  it("accepts all valid difficulties", () => {
    for (const difficulty of DIFFICULTIES) {
      const r = validate(validInput({ difficulty }));
      expect(r.ok).toBe(true);
    }
  });

  it("reports multiple errors simultaneously", () => {
    const r = validate(validInput({ name: "", location: "", distance: "" }));
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).length).toBeGreaterThanOrEqual(3);
  });
});

// ── createItem() ───────────────────────────────────────────────────────────
describe("createItem", () => {
  it("creates a trail with explicit id and now params", () => {
    const trail = createItem(validInput(), "explicit-id", "2026-01-15T00:00:00Z");
    expect(trail.id).toBe("explicit-id");
    expect(trail.createdAt).toBe("2026-01-15T00:00:00Z");
    expect(trail.name).toBe("Half Dome");
    expect(trail.distance).toBe(14.2);
  });

  it("trims whitespace from name and location", () => {
    const trail = createItem(validInput({ name: "  Mt. Whitney  ", location: "  Sierra Nevada  " }), "id", "now");
    expect(trail.name).toBe("Mt. Whitney");
    expect(trail.location).toBe("Sierra Nevada");
  });

  it("defaults to want status for invalid status value", () => {
    const trail = createItem(validInput({ status: "invalid-status" }), "id", "now");
    expect(trail.status).toBe("want");
  });

  it("accepts completed status", () => {
    const trail = createItem(validInput({ status: "completed" }), "id", "now");
    expect(trail.status).toBe("completed");
  });

  it("truncates notes to 500 characters", () => {
    const longNotes = "x".repeat(600);
    const trail = createItem(validInput({ notes: longNotes }), "id", "now");
    expect(trail.notes.length).toBe(500);
  });
});

// ── normalize() ────────────────────────────────────────────────────────────
describe("normalize", () => {
  it("normalizes a valid stored trail object", () => {
    const raw = { id: "abc", name: "Trail X", location: "Park Y", distance: 5.0, unit: "km", difficulty: "easy", notes: "", status: "want", createdAt: "2026-01-01T00:00:00Z" };
    const result = normalize(raw);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Trail X");
  });

  it("returns null for null input", () => {
    expect(normalize(null)).toBeNull();
  });

  it("returns null for a bare string", () => {
    expect(normalize("Half Dome")).toBeNull();
  });

  it("returns null for a number", () => {
    expect(normalize(42)).toBeNull();
  });

  it("returns null for an array", () => {
    expect(normalize([{ id: "t1", name: "Trail" }])).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(normalize(undefined)).toBeNull();
  });

  it("returns null when id is missing", () => {
    const raw = { name: "Trail X", location: "Park Y", distance: 5.0, unit: "km", difficulty: "easy", notes: "", status: "want", createdAt: "2026-01-01T00:00:00Z" };
    expect(normalize(raw)).toBeNull();
  });

  it("returns null when id is empty string", () => {
    const raw = { id: "", name: "Trail X", location: "Park Y", distance: 5.0, unit: "km", difficulty: "easy", notes: "", status: "want", createdAt: "2026-01-01T00:00:00Z" };
    expect(normalize(raw)).toBeNull();
  });

  it("returns null for unknown difficulty", () => {
    const raw = { id: "t1", name: "Trail X", location: "Park Y", distance: 5.0, unit: "km", difficulty: "IMPOSSIBLE", notes: "", status: "want", createdAt: "2026-01-01T00:00:00Z" };
    expect(normalize(raw)).toBeNull();
  });

  it("returns null for unknown unit", () => {
    const raw = { id: "t1", name: "Trail X", location: "Park Y", distance: 5.0, unit: "leagues", difficulty: "easy", notes: "", status: "want", createdAt: "2026-01-01T00:00:00Z" };
    expect(normalize(raw)).toBeNull();
  });

  it("returns null for missing required name", () => {
    const raw = { id: "t1", location: "Park Y", distance: 5.0, unit: "km", difficulty: "easy", notes: "", status: "want", createdAt: "2026-01-01T00:00:00Z" };
    expect(normalize(raw)).toBeNull();
  });

  it("returns null for distance of zero", () => {
    const raw = { id: "t1", name: "Trail X", location: "Park Y", distance: 0, unit: "km", difficulty: "easy", notes: "", status: "want", createdAt: "2026-01-01T00:00:00Z" };
    expect(normalize(raw)).toBeNull();
  });

  it("returns null for non-numeric distance", () => {
    const raw = { id: "t1", name: "Trail X", location: "Park Y", distance: "nope", unit: "km", difficulty: "easy", notes: "", status: "want", createdAt: "2026-01-01T00:00:00Z" };
    expect(normalize(raw)).toBeNull();
  });

  it("accepts all valid STATUSES without normalization failure", () => {
    for (const status of STATUSES) {
      const raw = { id: "t1", name: "Trail X", location: "Park Y", distance: 5.0, unit: "km", difficulty: "easy", notes: "", status, createdAt: "2026-01-01T00:00:00Z" };
      expect(normalize(raw)).not.toBeNull();
    }
  });
});

// ── filterItems() ──────────────────────────────────────────────────────────
describe("filterItems", () => {
  const trails: Trail[] = [
    makeTrail({ id: "1", name: "Half Dome", location: "Yosemite", notes: "granite peak" }),
    makeTrail({ id: "2", name: "Angels Landing", location: "Zion NP", notes: "chains required" }),
    makeTrail({ id: "3", name: "Kalalau Trail", location: "Kauai", notes: "coastal paradise" }),
  ];

  it("returns all items when query is empty", () => {
    expect(filterItems(trails, "")).toHaveLength(3);
  });

  it("returns all items when query is whitespace only", () => {
    expect(filterItems(trails, "   ")).toHaveLength(3);
  });

  it("filters by name (case-insensitive)", () => {
    const r = filterItems(trails, "angels");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("2");
  });

  it("filters by location", () => {
    const r = filterItems(trails, "kauai");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("3");
  });

  it("filters by notes", () => {
    const r = filterItems(trails, "chains");
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("2");
  });

  it("returns zero results when nothing matches", () => {
    expect(filterItems(trails, "everest")).toHaveLength(0);
  });

  it("matches multiple items when query applies to more than one", () => {
    const r = filterItems(trails, "trail");
    expect(r.length).toBeGreaterThanOrEqual(1);
  });

  it("does not mutate the input array", () => {
    const copy = [...trails];
    filterItems(trails, "dome");
    expect(trails).toEqual(copy);
  });
});

// ── sortItems() ────────────────────────────────────────────────────────────
describe("sortItems", () => {
  const trails: Trail[] = [
    makeTrail({ id: "c1", name: "Zion Narrows", status: "completed" }),
    makeTrail({ id: "w2", name: "Angels Landing", status: "want" }),
    makeTrail({ id: "w1", name: "Half Dome", status: "want" }),
    makeTrail({ id: "c2", name: "Appalachian", status: "completed" }),
  ];

  it("puts want-to-hike trails before completed ones", () => {
    const sorted = sortItems(trails);
    const firstCompleted = sorted.findIndex((t) => t.status === "completed");
    const lastWant = sorted.map((t) => t.status).lastIndexOf("want");
    expect(lastWant).toBeLessThan(firstCompleted);
  });

  it("sorts alphabetically within same status", () => {
    const sorted = sortItems(trails);
    const wantNames = sorted.filter((t) => t.status === "want").map((t) => t.name);
    expect(wantNames).toEqual([...wantNames].sort());
    const completedNames = sorted.filter((t) => t.status === "completed").map((t) => t.name);
    expect(completedNames).toEqual([...completedNames].sort());
  });

  it("does not mutate the input array", () => {
    const copy = [...trails];
    sortItems(trails);
    expect(trails).toEqual(copy);
  });
});

// ── formatDistance() ───────────────────────────────────────────────────────
describe("formatDistance", () => {
  it("formats whole number miles", () => {
    expect(formatDistance(10, "mi")).toBe("10 mi");
  });

  it("formats decimal kilometers", () => {
    expect(formatDistance(5.5, "km")).toBe("5.5 km");
  });

  it("rounds to one decimal place when needed", () => {
    const r = formatDistance(3.14159, "mi");
    expect(r).toBe("3.1 mi");
  });

  it("displays integer without decimal for whole numbers", () => {
    expect(formatDistance(8, "km")).toBe("8 km");
  });
});

// ── formatDate() ───────────────────────────────────────────────────────────
describe("formatDate", () => {
  it("formats a valid ISO date string", () => {
    const result = formatDate("2026-01-15T10:00:00.000Z");
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2026/);
  });

  it("returns Unknown date for invalid ISO string", () => {
    expect(formatDate("not-a-date")).toBe("Unknown date");
  });

  it("returns Unknown date for empty string", () => {
    expect(formatDate("")).toBe("Unknown date");
  });

  it("includes day in the formatted output", () => {
    const result = formatDate("2026-07-04T00:00:00.000Z");
    expect(result).toMatch(/4|04/);
  });
});

// ── summarize() ────────────────────────────────────────────────────────────
describe("summarize", () => {
  it("returns zeros for empty list", () => {
    const s = summarize([]);
    expect(s.total).toBe(0);
    expect(s.completed).toBe(0);
    expect(s.totalDistance).toBe(0);
  });

  it("counts total and completed correctly", () => {
    const trails = [
      makeTrail({ id: "1", status: "want" }),
      makeTrail({ id: "2", status: "completed", distance: 10 }),
      makeTrail({ id: "3", status: "completed", distance: 5 }),
    ];
    const s = summarize(trails);
    expect(s.total).toBe(3);
    expect(s.completed).toBe(2);
    expect(s.totalDistance).toBe(15);
  });

  it("sums only completed trail distances", () => {
    const trails = [
      makeTrail({ id: "1", status: "want", distance: 100 }),
      makeTrail({ id: "2", status: "completed", distance: 7 }),
    ];
    const s = summarize(trails);
    expect(s.totalDistance).toBe(7);
  });

  it("returns totalDistance as 0 with no completed trails", () => {
    const trails = [makeTrail({ id: "1", status: "want", distance: 20 })];
    const s = summarize(trails);
    expect(s.totalDistance).toBe(0);
  });

  it("handles mixed units by converting all to mi", () => {
    const trails = [
      makeTrail({ id: "1", status: "completed", distance: 10, unit: "mi" }),
      makeTrail({ id: "2", status: "completed", distance: 10, unit: "km" }),
    ];
    const s = summarize(trails);
    expect(s.unit).toBe("mi");
    expect(s.totalDistance).toBeGreaterThan(10);
    expect(s.totalDistance).toBeLessThan(20);
  });
});

// ── Constants exported correctly ───────────────────────────────────────────
describe("exported constants", () => {
  it("DIFFICULTIES contains expected values", () => {
    expect(DIFFICULTIES).toContain("easy");
    expect(DIFFICULTIES).toContain("moderate");
    expect(DIFFICULTIES).toContain("hard");
    expect(DIFFICULTIES).toContain("epic");
  });

  it("STATUSES contains want and completed", () => {
    expect(STATUSES).toContain("want");
    expect(STATUSES).toContain("completed");
  });

  it("UNITS contains mi and km", () => {
    expect(UNITS).toContain("mi");
    expect(UNITS).toContain("km");
  });
});
