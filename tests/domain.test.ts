import { describe, it, expect } from "vitest";
import {
  validate, createItem, normalize, filterItems, sortItems,
  formatDate, formatDistance, summarize,
  DIFFICULTIES, STATUSES, UNITS,
  type TrailInput, type Trail,
} from "../src/domain.js";

const v = (o: Partial<TrailInput> = {}): TrailInput => ({
  name: "Half Dome", location: "Yosemite", distance: "14.2", unit: "mi", difficulty: "hard", notes: "Classic", status: "want", ...o,
});
const t = (o: Partial<Trail> = {}): Trail => ({
  id: "t1", name: "Half Dome", location: "Yosemite", distance: 14.2, unit: "mi", difficulty: "hard", notes: "Classic", status: "want", createdAt: "2026-01-15T10:00:00.000Z", ...o,
});
const chk = (o: Partial<TrailInput>) => validate(v(o));
const n = (raw: unknown) => normalize(raw);

describe("validate", () => {
  it("valid input", () => { const r = validate(v()); expect(r.ok).toBe(true); expect(r.errors).toEqual({}); });
  it("empty name", () => expect(chk({ name: "" }).ok).toBe(false));
  it("whitespace name", () => expect(chk({ name: "   " }).ok).toBe(false));
  it("max name 100", () => expect(chk({ name: "A".repeat(100) }).ok).toBe(true));
  it("over max name 101", () => { const r = chk({ name: "A".repeat(101) }); expect(r.ok).toBe(false); expect(r.errors.name).toMatch(/100/); });
  it("empty location", () => expect(chk({ location: "" }).ok).toBe(false));
  it("whitespace location", () => expect(chk({ location: "  \t  " }).ok).toBe(false));
  it("max location 100", () => expect(chk({ location: "B".repeat(100) }).ok).toBe(true));
  it("over max location 101", () => expect(chk({ location: "B".repeat(101) }).ok).toBe(false));
  it("empty distance", () => expect(chk({ distance: "" }).ok).toBe(false));
  it("whitespace distance", () => expect(chk({ distance: "   " }).ok).toBe(false));
  it("non-numeric distance", () => expect(chk({ distance: "abc" }).ok).toBe(false));
  it("zero distance", () => expect(chk({ distance: "0" }).ok).toBe(false));
  it("negative distance", () => expect(chk({ distance: "-5" }).ok).toBe(false));
  it("max distance 9999", () => expect(chk({ distance: "9999" }).ok).toBe(true));
  it("over max distance 10000", () => expect(chk({ distance: "10000" }).ok).toBe(false));
  it("invalid unit", () => expect(chk({ unit: "furlongs" }).ok).toBe(false));
  it("all valid units", () => { for (const unit of UNITS) expect(chk({ unit }).ok).toBe(true); });
  it("invalid difficulty", () => expect(chk({ difficulty: "extreme" }).ok).toBe(false));
  it("empty difficulty", () => expect(chk({ difficulty: "" }).ok).toBe(false));
  it("all valid difficulties", () => { for (const difficulty of DIFFICULTIES) expect(chk({ difficulty }).ok).toBe(true); });
  it("multiple errors", () => { const r = chk({ name: "", location: "", distance: "" }); expect(r.ok).toBe(false); expect(Object.keys(r.errors).length).toBeGreaterThanOrEqual(3); });
});

describe("createItem", () => {
  it("explicit id and now", () => {
    const item = createItem(v(), "id-1", "2026-01-15T00:00:00Z");
    expect(item.id).toBe("id-1"); expect(item.createdAt).toBe("2026-01-15T00:00:00Z"); expect(item.name).toBe("Half Dome"); expect(item.distance).toBe(14.2);
  });
  it("trims whitespace", () => { const item = createItem(v({ name: "  Whitney  ", location: "  Sierra  " }), "id", "now"); expect(item.name).toBe("Whitney"); expect(item.location).toBe("Sierra"); });
  it("defaults invalid status to want", () => expect(createItem(v({ status: "invalid" }), "id", "now").status).toBe("want"));
  it("accepts completed status", () => expect(createItem(v({ status: "completed" }), "id", "now").status).toBe("completed"));
  it("truncates notes to 500 chars", () => expect(createItem(v({ notes: "x".repeat(600) }), "id", "now").notes.length).toBe(500));
});

describe("normalize", () => {
  const raw = { id: "abc", name: "Trail X", location: "Park Y", distance: 5.0, unit: "km", difficulty: "easy", notes: "", status: "want", createdAt: "2026-01-01T00:00:00Z" };
  it("valid raw", () => expect(n(raw)?.name).toBe("Trail X"));
  it("null", () => expect(n(null)).toBeNull());
  it("string", () => expect(n("Half Dome")).toBeNull());
  it("number", () => expect(n(42)).toBeNull());
  it("array", () => expect(n([raw])).toBeNull());
  it("undefined", () => expect(n(undefined)).toBeNull());
  it("missing id", () => { const { id: _, ...rest } = raw; void _; expect(n(rest)).toBeNull(); });
  it("empty id", () => expect(n({ ...raw, id: "" })).toBeNull());
  it("unknown difficulty", () => expect(n({ ...raw, difficulty: "IMPOSSIBLE" })).toBeNull());
  it("unknown unit", () => expect(n({ ...raw, unit: "leagues" })).toBeNull());
  it("missing name", () => { const { name: _, ...rest } = raw; void _; expect(n(rest)).toBeNull(); });
  it("zero distance", () => expect(n({ ...raw, distance: 0 })).toBeNull());
  it("non-numeric distance", () => expect(n({ ...raw, distance: "nope" })).toBeNull());
  it("valid statuses", () => { for (const status of STATUSES) expect(n({ ...raw, status })).not.toBeNull(); });
});

describe("filterItems", () => {
  const trails: Trail[] = [
    t({ id: "1", name: "Half Dome", location: "Yosemite", notes: "granite peak" }),
    t({ id: "2", name: "Angels Landing", location: "Zion NP", notes: "chains required" }),
    t({ id: "3", name: "Kalalau Trail", location: "Kauai", notes: "coastal paradise" }),
  ];
  it("empty query", () => expect(filterItems(trails, "")).toHaveLength(3));
  it("whitespace query", () => expect(filterItems(trails, "   ")).toHaveLength(3));
  it("filters name case-insensitive", () => expect(filterItems(trails, "angels")[0]?.id).toBe("2"));
  it("filters location", () => expect(filterItems(trails, "kauai")[0]?.id).toBe("3"));
  it("filters notes", () => expect(filterItems(trails, "chains")[0]?.id).toBe("2"));
  it("zero matches", () => expect(filterItems(trails, "everest")).toHaveLength(0));
  it("multi matches", () => expect(filterItems(trails, "trail").length).toBeGreaterThanOrEqual(1));
  it("no mutation", () => { const copy = [...trails]; filterItems(trails, "dome"); expect(trails).toEqual(copy); });
});

describe("sortItems", () => {
  const trails: Trail[] = [
    t({ id: "c1", name: "Zion Narrows", status: "completed" }),
    t({ id: "w2", name: "Angels Landing", status: "want" }),
    t({ id: "w1", name: "Half Dome", status: "want" }),
    t({ id: "c2", name: "Appalachian", status: "completed" }),
  ];
  it("want before completed", () => {
    const s = sortItems(trails);
    expect(s.map((x) => x.status).lastIndexOf("want")).toBeLessThan(s.findIndex((x) => x.status === "completed"));
  });
  it("alphabetical within status", () => {
    const s = sortItems(trails);
    const want = s.filter((x) => x.status === "want").map((x) => x.name);
    expect(want).toEqual([...want].sort());
    const comp = s.filter((x) => x.status === "completed").map((x) => x.name);
    expect(comp).toEqual([...comp].sort());
  });
  it("no mutation", () => { const copy = [...trails]; sortItems(trails); expect(trails).toEqual(copy); });
});

describe("formatDistance", () => {
  it("whole miles", () => expect(formatDistance(10, "mi")).toBe("10 mi"));
  it("decimal km", () => expect(formatDistance(5.5, "km")).toBe("5.5 km"));
  it("rounds to 1 decimal", () => expect(formatDistance(3.14159, "mi")).toBe("3.1 mi"));
  it("integer format", () => expect(formatDistance(8, "km")).toBe("8 km"));
});

describe("formatDate", () => {
  it("valid ISO", () => { const r = formatDate("2026-01-15T10:00:00.000Z"); expect(r).toMatch(/Jan/); expect(r).toMatch(/2026/); });
  it("invalid date", () => expect(formatDate("not-a-date")).toBe("Unknown date"));
  it("empty date", () => expect(formatDate("")).toBe("Unknown date"));
  it("includes day", () => expect(formatDate("2026-07-04T00:00:00.000Z")).toMatch(/4|04/));
});

describe("summarize", () => {
  it("empty list", () => { const s = summarize([]); expect(s.total).toBe(0); expect(s.completed).toBe(0); expect(s.totalDistance).toBe(0); });
  it("counts total and completed", () => {
    const s = summarize([t({ id: "1", status: "want" }), t({ id: "2", status: "completed", distance: 10 }), t({ id: "3", status: "completed", distance: 5 })]);
    expect(s.total).toBe(3); expect(s.completed).toBe(2); expect(s.totalDistance).toBe(15);
  });
  it("sums only completed", () => expect(summarize([t({ id: "1", status: "want", distance: 100 }), t({ id: "2", status: "completed", distance: 7 })]).totalDistance).toBe(7));
  it("zero completed returns 0", () => expect(summarize([t({ id: "1", status: "want", distance: 20 })]).totalDistance).toBe(0));
  it("handles mixed units", () => {
    const s = summarize([t({ id: "1", status: "completed", distance: 10, unit: "mi" }), t({ id: "2", status: "completed", distance: 10, unit: "km" })]);
    expect(s.unit).toBe("mi"); expect(s.totalDistance).toBeGreaterThan(10); expect(s.totalDistance).toBeLessThan(20);
  });
});

describe("exported constants", () => {
  it("DIFFICULTIES", () => { for (const d of ["easy", "moderate", "hard", "epic"]) expect(DIFFICULTIES).toContain(d); });
  it("STATUSES", () => { expect(STATUSES).toContain("want"); expect(STATUSES).toContain("completed"); });
  it("UNITS", () => { expect(UNITS).toContain("mi"); expect(UNITS).toContain("km"); });
});
