import {
  type Trail, type TrailInput,
  validate, createItem, filterItems, sortItems,
  formatDate, formatDistance, summarize,
} from "./domain.js";
import { load, save } from "./storage.js";

let items: Trail[] = [];
let filterQuery = "";
let editingId: string | null = null;
let armedDeleteId: string | null = null;
let armedDeleteTimer: ReturnType<typeof setTimeout> | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const $ = (id: string): HTMLElement => document.getElementById(id)!;
const fld = (form: HTMLFormElement, name: string) => form.elements.namedItem(name) as HTMLInputElement;

function announce(text: string): void {
  const region = $("live-region");
  region.textContent = "";
  requestAnimationFrame(() => { region.textContent = text; });
}

function setBanner(msg = ""): void {
  const b = $("storage-banner");
  b.hidden = !msg;
  b.textContent = msg;
  if (msg) announce(`Error: ${msg}`);
}

export function init(): void {
  const r = load();
  items = r.status === "ok" || r.status === "partial" ? r.items : [];
  setBanner(r.status === "partial" || r.status === "error" ? r.message : "");
  wireEvents();
  render();
}

function resetDeleteArm(msg?: string): void {
  if (armedDeleteTimer) { clearTimeout(armedDeleteTimer); armedDeleteTimer = null; }
  if (armedDeleteId) {
    document.querySelectorAll(".btn-arm").forEach((b) => {
      b.textContent = "Delete"; b.setAttribute("aria-label", "Delete trail"); b.classList.remove("btn-arm");
    });
    armedDeleteId = null;
  }
  if (msg) announce(msg);
}

function render(): void {
  resetDeleteArm();
  const filtered = filterItems(items, filterQuery);
  const sorted = sortItems(filtered);
  renderSummary();
  renderList(sorted, items.length === 0, filtered.length === 0 && items.length > 0);
  renderFormState();
}

function renderSummary(): void {
  const s = summarize(items);
  $("summary-total").textContent = `${s.total}`;
  $("summary-completed").textContent = `${s.completed}`;
  $("summary-distance").textContent = `${s.totalDistance} ${s.unit}`;
}

function renderList(sorted: Trail[], isEmpty: boolean, isFilterEmpty: boolean): void {
  const list = $("trail-list");
  list.innerHTML = "";
  $("empty-all").hidden = !isEmpty;
  const emptyFilter = $("empty-filter");
  if (isFilterEmpty) {
    emptyFilter.hidden = false;
    ($("empty-filter-query") as HTMLElement).textContent = `"${filterQuery}"`;
    return;
  }
  emptyFilter.hidden = true;
  if (!isEmpty) for (const trail of sorted) list.appendChild(createCard(trail));
}

function createCard(trail: Trail): HTMLElement {
  const isDone = trail.status === "completed";
  const card = el("article", `trail-card${isDone ? " trail-card--completed" : ""}`);
  card.dataset.id = trail.id;

  const badges = el("div", "card-badges");
  badges.append(
    el("span", `status-badge status-badge--${trail.status}`, isDone ? "✓ Completed" : "⛰ Want to Hike"),
    el("span", `diff-badge diff-badge--${trail.difficulty}`, trail.difficulty)
  );

  const title = el("h2", `card-title${isDone ? " card-title--done" : ""}`, trail.name);

  const meta = el("div", "card-meta");
  const loc = el("span", "card-loc");
  loc.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg> `;
  loc.appendChild(document.createTextNode(trail.location));
  meta.append(loc, el("span", "card-dist", formatDistance(trail.distance, trail.unit)), el("span", "card-date", formatDate(trail.createdAt)));

  const actions = el("div", "card-actions");
  const btn = (cls: string, txt: string, label: string, fn: (b: HTMLButtonElement) => void) => {
    const b = el("button", cls, txt);
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.onclick = () => fn(b);
    return b;
  };
  const toggleTxt = isDone ? "Mark Pending" : "Mark Complete";
  actions.append(
    btn("btn btn-secondary", "Edit", `Edit ${trail.name}`, () => startEdit(trail.id)),
    btn("btn btn-ghost", toggleTxt, `${toggleTxt} ${trail.name}`, () => toggleStatus(trail.id)),
    btn("btn btn-danger", "Delete", `Delete ${trail.name}`, (b) => handleDelete(trail.id, b))
  );

  card.append(badges, title, meta);
  if (trail.notes) card.appendChild(el("p", "card-notes", trail.notes));
  card.appendChild(actions);
  if (editingId === trail.id) card.classList.add("trail-card--editing");
  return card;
}

function renderFormState(): void {
  const form = $("trail-form") as HTMLFormElement;
  const isEditing = editingId !== null;
  $("form-heading").textContent = isEditing ? "Edit Trail" : "Add a Trail";
  $("submit-btn").textContent = isEditing ? "Save Changes" : "Add Trail";
  $("cancel-edit-btn").hidden = !isEditing;

  if (isEditing) {
    const t = items.find((x) => x.id === editingId);
    if (t) {
      for (const k of ["name", "location", "unit", "difficulty", "notes", "status"] as const) fld(form, k).value = t[k];
      fld(form, "distance").value = String(t.distance);
    }
  } else {
    form.reset();
    setErrors();
  }
}

function wireEvents(): void {
  const form = $("trail-form") as HTMLFormElement;
  form.onsubmit = (e) => { e.preventDefault(); handleFormSubmit(form); };
  const on = (id: string, ev: string, fn: (e: Event) => void) => $(id).addEventListener(ev, fn);

  on("cancel-edit-btn", "click", () => { editingId = null; render(); announce("Edit cancelled"); });
  on("search-input", "input", (e) => {
    filterQuery = (e.target as HTMLInputElement).value;
    render();
    if (filterQuery && filterItems(items, filterQuery).length === 0) announce(`No trails found for "${filterQuery}".`);
  });
  on("clear-filter-btn", "click", () => {
    filterQuery = "";
    ($("search-input") as HTMLInputElement).value = "";
    render(); announce("Filter cleared");
  });
  on("dismiss-banner-btn", "click", () => setBanner());

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") resetDeleteArm("Delete cancelled.");
  });
  document.addEventListener("click", (e) => {
    if (armedDeleteId && !(e.target as HTMLElement).closest(`[data-id="${armedDeleteId}"] .btn-danger`)) {
      resetDeleteArm();
    }
  });
}

function setErrors(errors: Record<string, string> = {}): void {
  document.querySelectorAll(".field-error").forEach((e) => { e.textContent = ""; });
  document.querySelectorAll("[aria-invalid]").forEach((e) => e.removeAttribute("aria-invalid"));
  for (const [k, v] of Object.entries(errors)) {
    const err = $(`${k}-error`);
    if (err) err.textContent = v;
    document.querySelector(`[name="${k}"]`)?.setAttribute("aria-invalid", "true");
  }
  const first = Object.values(errors)[0];
  if (first) announce(`Validation error: ${first}`);
}

function commitItems(next: Trail[], msg: string, cb?: () => void): boolean {
  const res = save(next);
  if (!res.ok) { setBanner(res.message ?? "Could not save."); return false; }
  items = next;
  cb?.();
  render();
  announce(msg);
  return true;
}

function handleFormSubmit(form: HTMLFormElement): void {
  const v = (n: string) => fld(form, n).value;
  const input: TrailInput = {
    name: v("name"), location: v("location"), distance: v("distance"),
    unit: v("unit"), difficulty: v("difficulty"), notes: (form.elements.namedItem("notes") as HTMLTextAreaElement).value,
    status: v("status"),
  };
  const res = validate(input);
  if (!res.ok) { setErrors(res.errors as Record<string, string>); return; }
  setErrors();

  if (editingId !== null) {
    const orig = items.find((t) => t.id === editingId);
    const updated = createItem(input, editingId, orig?.createdAt ?? new Date().toISOString());
    commitItems(items.map((t) => (t.id === editingId ? updated : t)), `Trail "${updated.name}" updated successfully.`, () => { editingId = null; });
  } else {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newTrail = createItem(input, id, new Date().toISOString());
    commitItems([...items, newTrail], `Trail "${newTrail.name}" added to your list.`, () => {
      setTimeout(() => document.querySelector(`[data-id="${id}"]`)?.classList.add("card-enter"), 0);
    });
  }
}

function startEdit(id: string): void {
  editingId = id;
  render();
  const form = $("trail-form") as HTMLFormElement;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  fld(form, "name").focus();
  const trail = items.find((t) => t.id === id);
  if (trail) announce(`Editing trail: ${trail.name}`);
}

function toggleStatus(id: string): void {
  const trail = items.find((t) => t.id === id);
  if (!trail) return;
  const status = trail.status === "want" ? "completed" : "want";
  const updated = { ...trail, status } as Trail;
  commitItems(
    items.map((t) => (t.id === id ? updated : t)),
    `"${trail.name}" marked as ${status === "completed" ? "completed" : "want to hike"}.`
  );
}

function handleDelete(id: string, btn: HTMLButtonElement): void {
  if (armedDeleteId === id) {
    const name = items.find((t) => t.id === id)?.name ?? "Trail";
    commitItems(items.filter((t) => t.id !== id), `Trail "${name}" deleted.`, () => {
      if (editingId === id) editingId = null;
    });
  } else {
    resetDeleteArm();
    armedDeleteId = id;
    btn.textContent = "Confirm?";
    btn.setAttribute("aria-label", "Confirm delete");
    btn.classList.add("btn-arm");
    armedDeleteTimer = setTimeout(() => resetDeleteArm("Delete cancelled"), 3000);
    announce("Delete armed — click again to confirm, Escape to cancel");
  }
}
