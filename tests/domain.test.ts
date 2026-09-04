import { describe, it, expect as exp } from "vitest";
import {
validate, createItem, normalize, filterItems, sortItems,
formatDate, formatDistance, summarize,
DIFFICULTIES, STATUSES, UNITS,
type TrailInput, type Trail,
} from "../src/domain.js";
const v = (o: Partial<TrailInput> = {}): TrailInput => ({ name: "Dome", location: "Park", distance: "10", unit: "mi", difficulty: "easy", notes: "N", status: "want", ...o });
const t = (o: Partial<Trail> = {}): Trail => ({ id: "t1", name: "Dome", location: "Park", distance: 10, unit: "mi", difficulty: "easy", notes: "N", status: "want", createdAt: "2026-01-15T00:00:00Z", ...o });
const chk = (o: Partial<TrailInput>) => validate(v(o));
const n = (raw: unknown) => normalize(raw);
const truthy = (x: unknown) => exp(x).toBe(true);
const falsy = (x: unknown) => exp(x).toBe(false);
const isNull = (x: unknown) => exp(x).toBeNull();
describe("validate", () => {
it("valid", () => truthy(validate(v()).ok));
it("empty name", () => falsy(chk({ name: "" }).ok));
it("blank name", () => falsy(chk({ name: "   " }).ok));
it("max name", () => truthy(chk({ name: "A".repeat(100) }).ok));
it("over name", () => { const r = chk({ name: "A".repeat(101) }); falsy(r.ok); exp(r.errors.name).toMatch(/100/); });
it("empty loc", () => falsy(chk({ location: "" }).ok));
it("blank loc", () => falsy(chk({ location: "  \t  " }).ok));
it("max loc", () => truthy(chk({ location: "B".repeat(100) }).ok));
it("over loc", () => falsy(chk({ location: "B".repeat(101) }).ok));
it("empty dist", () => falsy(chk({ distance: "" }).ok));
it("blank dist", () => falsy(chk({ distance: "   " }).ok));
it("nan dist", () => falsy(chk({ distance: "abc" }).ok));
it("zero dist", () => falsy(chk({ distance: "0" }).ok));
it("neg dist", () => falsy(chk({ distance: "-5" }).ok));
it("max dist", () => truthy(chk({ distance: "9999" }).ok));
it("over dist", () => falsy(chk({ distance: "10000" }).ok));
it("bad unit", () => falsy(chk({ unit: "furlongs" }).ok));
it("units", () => { for (const unit of UNITS) truthy(chk({ unit }).ok); });
it("bad diff", () => falsy(chk({ difficulty: "extreme" }).ok));
it("blank diff", () => falsy(chk({ difficulty: "" }).ok));
it("diffs", () => { for (const difficulty of DIFFICULTIES) truthy(chk({ difficulty }).ok); });
it("multi err", () => { const r = chk({ name: "", location: "", distance: "" }); falsy(r.ok); exp(Object.keys(r.errors).length).toBeGreaterThanOrEqual(3); });
});
describe("createItem", () => {
it("create", () => {
const item = createItem(v(), "id-1", "2026-01-15T00:00:00Z");
exp(item.id).toBe("id-1"); exp(item.createdAt).toBe("2026-01-15T00:00:00Z"); exp(item.name).toBe("Dome"); exp(item.distance).toBe(10);
});
it("trim", () => { const item = createItem(v({ name: "  Whitney  ", location: "  Sierra  " }), "id", "now"); exp(item.name).toBe("Whitney"); exp(item.location).toBe("Sierra"); });
it("bad status", () => exp(createItem(v({ status: "bad" }), "id", "now").status).toBe("want"));
it("done status", () => exp(createItem(v({ status: "completed" }), "id", "now").status).toBe("completed"));
it("notes cap", () => exp(createItem(v({ notes: "x".repeat(600) }), "id", "now").notes.length).toBe(500));
});
describe("normalize", () => {
const raw = { id: "a", name: "T", location: "P", distance: 5, unit: "km", difficulty: "easy", notes: "", status: "want", createdAt: "2026-01-01T00:00:00Z" };
it("valid", () => exp(n(raw)?.name).toBe("T"));
it("null", () => isNull(n(null)));
it("str", () => isNull(n("Dome")));
it("num", () => isNull(n(42)));
it("arr", () => isNull(n([raw])));
it("undef", () => isNull(n(undefined)));
it("no id", () => { const { id: _, ...rest } = raw; void _; isNull(n(rest)); });
it("empty id", () => isNull(n({ ...raw, id: "" })));
it("bad diff", () => isNull(n({ ...raw, difficulty: "IMPOSSIBLE" })));
it("bad unit", () => isNull(n({ ...raw, unit: "leagues" })));
it("no name", () => { const { name: _, ...rest } = raw; void _; isNull(n(rest)); });
it("zero dist", () => isNull(n({ ...raw, distance: 0 })));
it("bad dist", () => isNull(n({ ...raw, distance: "nope" })));
it("statuses", () => { for (const status of STATUSES) exp(n({ ...raw, status })).not.toBeNull(); });
});
describe("filterItems", () => {
const trails: Trail[] = [
t({ id: "1", name: "Half Dome", location: "Yosemite", notes: "granite" }),
t({ id: "2", name: "Angels Landing", location: "Zion", notes: "chains" }),
t({ id: "3", name: "Kalalau Trail", location: "Kauai", notes: "coastal" }),
];
it("empty q", () => exp(filterItems(trails, "")).toHaveLength(3));
it("blank q", () => exp(filterItems(trails, "   ")).toHaveLength(3));
it("by name", () => exp(filterItems(trails, "angels")[0]?.id).toBe("2"));
it("by loc", () => exp(filterItems(trails, "kauai")[0]?.id).toBe("3"));
it("by notes", () => exp(filterItems(trails, "chains")[0]?.id).toBe("2"));
it("no match", () => exp(filterItems(trails, "everest")).toHaveLength(0));
it("multi", () => exp(filterItems(trails, "trail").length).toBeGreaterThanOrEqual(1));
it("pure", () => { const copy = [...trails]; filterItems(trails, "dome"); exp(trails).toEqual(copy); });
});
describe("sortItems", () => {
const trails: Trail[] = [
t({ id: "c1", name: "Zion", status: "completed" }),
t({ id: "w2", name: "Angels", status: "want" }),
t({ id: "w1", name: "Dome", status: "want" }),
t({ id: "c2", name: "Appalachian", status: "completed" }),
];
it("want first", () => {
const s = sortItems(trails);
exp(s.map((x) => x.status).lastIndexOf("want")).toBeLessThan(s.findIndex((x) => x.status === "completed"));
});
it("alpha", () => {
const s = sortItems(trails);
const want = s.filter((x) => x.status === "want").map((x) => x.name);
exp(want).toEqual([...want].sort());
const comp = s.filter((x) => x.status === "completed").map((x) => x.name);
exp(comp).toEqual([...comp].sort());
});
it("pure", () => { const copy = [...trails]; sortItems(trails); exp(trails).toEqual(copy); });
});
describe("formatDistance", () => {
it("whole mi", () => exp(formatDistance(10, "mi")).toBe("10 mi"));
it("dec km", () => exp(formatDistance(5.5, "km")).toBe("5.5 km"));
it("round 1 dec", () => exp(formatDistance(3.14159, "mi")).toBe("3.1 mi"));
it("int fmt", () => exp(formatDistance(8, "km")).toBe("8 km"));
});
describe("formatDate", () => {
it("valid iso", () => { const r = formatDate("2026-01-15T10:00:00.000Z"); exp(r).toMatch(/Jan/); exp(r).toMatch(/2026/); });
it("invalid", () => exp(formatDate("not-a-date")).toBe("Unknown date"));
it("empty", () => exp(formatDate("")).toBe("Unknown date"));
it("day", () => exp(formatDate("2026-07-04T00:00:00.000Z")).toMatch(/4|04/));
});
describe("summarize", () => {
it("empty", () => { const s = summarize([]); exp(s.total).toBe(0); exp(s.completed).toBe(0); exp(s.totalDistance).toBe(0); });
it("counts", () => {
const s = summarize([t({ id: "1", status: "want" }), t({ id: "2", status: "completed", distance: 10 }), t({ id: "3", status: "completed", distance: 5 })]);
exp(s.total).toBe(3); exp(s.completed).toBe(2); exp(s.totalDistance).toBe(15);
});
it("sums done", () => exp(summarize([t({ id: "1", status: "want", distance: 100 }), t({ id: "2", status: "completed", distance: 7 })]).totalDistance).toBe(7));
it("zero done", () => exp(summarize([t({ id: "1", status: "want", distance: 20 })]).totalDistance).toBe(0));
it("mixed units", () => {
const s = summarize([t({ id: "1", status: "completed", distance: 10, unit: "mi" }), t({ id: "2", status: "completed", distance: 10, unit: "km" })]);
exp(s.unit).toBe("mi"); exp(s.totalDistance).toBeGreaterThan(10); exp(s.totalDistance).toBeLessThan(20);
});
});
describe("constants", () => {
it("diffs", () => { for (const d of ["easy", "moderate", "hard", "epic"]) exp(DIFFICULTIES).toContain(d); });
it("statuses", () => { exp(STATUSES).toContain("want"); exp(STATUSES).toContain("completed"); });
it("units", () => { exp(UNITS).toContain("mi"); exp(UNITS).toContain("km"); });
});