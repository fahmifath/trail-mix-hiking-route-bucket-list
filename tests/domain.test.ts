import{describe,it,expect as e}from"vitest";
import{validate,createItem,normalize,filterItems,sortItems,formatDate,formatDistance,summarize,DIFFICULTIES,STATUSES,UNITS,type TrailInput,type Trail}from"../src/domain.js";
const v=(o:Partial<TrailInput>={}):TrailInput=>({name:"Dome",location:"Park",distance:"10",unit:"mi",difficulty:"easy",notes:"N",status:"want",...o});
const t=(o:Partial<Trail>={}):Trail=>({id:"t1",name:"Dome",location:"Park",distance:10,unit:"mi",difficulty:"easy",notes:"N",status:"want",createdAt:"2026-01-15T00:00:00Z",...o});
const chk=(o:Partial<TrailInput>)=>validate(v(o));
const n=(r:unknown)=>normalize(r);
const T=(x:unknown)=>e(x).toBe(true);
const F=(x:unknown)=>e(x).toBe(false);
const N=(x:unknown)=>e(x).toBeNull();
describe("validate",()=>{
it("valid",()=>T(validate(v()).ok));
it("empty name",()=>F(chk({name:""}).ok));
it("blank name",()=>F(chk({name:"   "}).ok));
it("max name",()=>T(chk({name:"A".repeat(100)}).ok));
it("over name",()=>{const r=chk({name:"A".repeat(101)});F(r.ok);e(r.errors.name).toMatch(/100/);});
it("empty loc",()=>F(chk({location:""}).ok));
it("blank loc",()=>F(chk({location:"  \t  "}).ok));
it("max loc",()=>T(chk({location:"B".repeat(100)}).ok));
it("over loc",()=>F(chk({location:"B".repeat(101)}).ok));
it("empty dist",()=>F(chk({distance:""}).ok));
it("blank dist",()=>F(chk({distance:"   "}).ok));
it("nan dist",()=>F(chk({distance:"abc"}).ok));
it("zero dist",()=>F(chk({distance:"0"}).ok));
it("neg dist",()=>F(chk({distance:"-5"}).ok));
it("max dist",()=>T(chk({distance:"9999"}).ok));
it("over dist",()=>F(chk({distance:"10000"}).ok));
it("bad unit",()=>F(chk({unit:"furlongs"}).ok));
it("units",()=>{for(const unit of UNITS)T(chk({unit}).ok);});
it("bad diff",()=>F(chk({difficulty:"extreme"}).ok));
it("blank diff",()=>F(chk({difficulty:""}).ok));
it("diffs",()=>{for(const difficulty of DIFFICULTIES)T(chk({difficulty}).ok);});
it("multi err",()=>{const r=chk({name:"",location:"",distance:""});F(r.ok);e(Object.keys(r.errors).length).toBeGreaterThanOrEqual(3);});
});
describe("createItem",()=>{
it("create",()=>{const i=createItem(v(),"id-1","2026-01-15T00:00:00Z");e(i.id).toBe("id-1");e(i.createdAt).toBe("2026-01-15T00:00:00Z");e(i.name).toBe("Dome");e(i.distance).toBe(10);});
it("trim",()=>{const i=createItem(v({name:"  Whitney  ",location:"  Sierra  "}),"id","now");e(i.name).toBe("Whitney");e(i.location).toBe("Sierra");});
it("bad status",()=>e(createItem(v({status:"bad"}),"id","now").status).toBe("want"));
it("done status",()=>e(createItem(v({status:"completed"}),"id","now").status).toBe("completed"));
it("notes cap",()=>e(createItem(v({notes:"x".repeat(600)}),"id","now").notes.length).toBe(500));
});
describe("normalize",()=>{
const raw={id:"a",name:"T",location:"P",distance:5,unit:"km",difficulty:"easy",notes:"",status:"want",createdAt:"2026-01-01T00:00:00Z"};
it("valid",()=>e(n(raw)?.name).toBe("T"));
it("null",()=>N(n(null)));
it("str",()=>N(n("Dome")));
it("num",()=>N(n(42)));
it("arr",()=>N(n([raw])));
it("undef",()=>N(n(undefined)));
it("no id",()=>{const{id:_,...rest}=raw;void _;N(n(rest));});
it("empty id",()=>N(n({...raw,id:""})));
it("bad diff",()=>N(n({...raw,difficulty:"IMPOSSIBLE"})));
it("bad unit",()=>N(n({...raw,unit:"leagues"})));
it("no name",()=>{const{name:_,...rest}=raw;void _;N(n(rest));});
it("zero dist",()=>N(n({...raw,distance:0})));
it("bad dist",()=>N(n({...raw,distance:"nope"})));
it("statuses",()=>{for(const status of STATUSES)e(n({...raw,status})).not.toBeNull();});
});
describe("filterItems",()=>{
const trails:Trail[]=[
t({id:"1",name:"Half Dome",location:"Yosemite",notes:"granite"}),
t({id:"2",name:"Angels Landing",location:"Zion",notes:"chains"}),
t({id:"3",name:"Kalalau Trail",location:"Kauai",notes:"coastal"}),
];
it("empty q",()=>e(filterItems(trails,"")).toHaveLength(3));
it("blank q",()=>e(filterItems(trails,"   ")).toHaveLength(3));
it("by name",()=>e(filterItems(trails,"angels")[0]?.id).toBe("2"));
it("by loc",()=>e(filterItems(trails,"kauai")[0]?.id).toBe("3"));
it("by notes",()=>e(filterItems(trails,"chains")[0]?.id).toBe("2"));
it("no match",()=>e(filterItems(trails,"everest")).toHaveLength(0));
it("multi",()=>e(filterItems(trails,"trail").length).toBeGreaterThanOrEqual(1));
it("pure",()=>{const c=[...trails];filterItems(trails,"dome");e(trails).toEqual(c);});
});
describe("sortItems",()=>{
const trails:Trail[]=[
t({id:"c1",name:"Zion",status:"completed"}),
t({id:"w2",name:"Angels",status:"want"}),
t({id:"w1",name:"Dome",status:"want"}),
t({id:"c2",name:"Appalachian",status:"completed"}),
];
it("want first",()=>{const s=sortItems(trails);e(s.map(x=>x.status).lastIndexOf("want")).toBeLessThan(s.findIndex(x=>x.status==="completed"));});
it("alpha",()=>{const s=sortItems(trails);const w=s.filter(x=>x.status==="want").map(x=>x.name);e(w).toEqual([...w].sort());const c=s.filter(x=>x.status==="completed").map(x=>x.name);e(c).toEqual([...c].sort());});
it("pure",()=>{const c=[...trails];sortItems(trails);e(trails).toEqual(c);});
});
describe("formatDistance",()=>{
it("whole mi",()=>e(formatDistance(10,"mi")).toBe("10 mi"));
it("dec km",()=>e(formatDistance(5.5,"km")).toBe("5.5 km"));
it("round 1 dec",()=>e(formatDistance(3.14159,"mi")).toBe("3.1 mi"));
it("int fmt",()=>e(formatDistance(8,"km")).toBe("8 km"));
});
describe("formatDate",()=>{
it("valid iso",()=>{const r=formatDate("2026-01-15T10:00:00.000Z");e(r).toMatch(/Jan/);e(r).toMatch(/2026/);});
it("invalid",()=>e(formatDate("not-a-date")).toBe("Unknown date"));
it("empty",()=>e(formatDate("")).toBe("Unknown date"));
it("day",()=>e(formatDate("2026-07-04T00:00:00.000Z")).toMatch(/4|04/));
});
describe("summarize",()=>{
it("empty",()=>{const s=summarize([]);e(s.total).toBe(0);e(s.completed).toBe(0);e(s.totalDistance).toBe(0);});
it("counts",()=>{const s=summarize([t({id:"1",status:"want"}),t({id:"2",status:"completed",distance:10}),t({id:"3",status:"completed",distance:5})]);e(s.total).toBe(3);e(s.completed).toBe(2);e(s.totalDistance).toBe(15);});
it("sums done",()=>e(summarize([t({id:"1",status:"want",distance:100}),t({id:"2",status:"completed",distance:7})]).totalDistance).toBe(7));
it("zero done",()=>e(summarize([t({id:"1",status:"want",distance:20})]).totalDistance).toBe(0));
it("mixed units",()=>{const s=summarize([t({id:"1",status:"completed",distance:10,unit:"mi"}),t({id:"2",status:"completed",distance:10,unit:"km"})]);e(s.unit).toBe("mi");e(s.totalDistance).toBeGreaterThan(10);e(s.totalDistance).toBeLessThan(20);});
});
describe("constants",()=>{
it("diffs",()=>{for(const d of["easy","moderate","hard","epic"])e(DIFFICULTIES).toContain(d);});
it("statuses",()=>{e(STATUSES).toContain("want");e(STATUSES).toContain("completed");});
it("units",()=>{e(UNITS).toContain("mi");e(UNITS).toContain("km");});
});