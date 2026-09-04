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

function reportFailure(message: string): void {
  const banner = $("storage-banner");
  banner.hidden = false;
  requestAnimationFrame(() => { banner.textContent = message; });
  announce(`Error: ${message}`);
}
function clearBanner(): void {
  const banner = $("storage-banner");
  banner.hidden = true;
  banner.textContent = "";
}

export function init(): void {
  const result = load();
  if (result.status === "ok" || result.status === "empty") {
    items = result.status === "ok" ? result.items : [];
    clearBanner();
  } else if (result.status === "partial") {
    items = result.items;
    reportFailure(result.message);
  } else {
    items = [];
    reportFailure(result.message);
  }
  wireEvents();
  render();
}

function clearDeleteArm(): void {
  if (armedDeleteTimer !== null) { clearTimeout(armedDeleteTimer); armedDeleteTimer = null; }
  armedDeleteId = null;
}
function revertDeleteButton(btn: HTMLButtonElement): void {
  btn.textContent = "Delete";
  btn.setAttribute("aria-label", "Delete trail");
  btn.classList.remove("btn-arm");
}

function render(): void {
  clearDeleteArm();
  const filtered = filterItems(items, filterQuery);
  const sorted = sortItems(filtered);
  renderSummary();
  renderList(sorted, items.length === 0, filtered.length === 0 && items.length > 0);
  renderFormState();
}

function renderSummary(): void {
  const s = summarize(items);
  $("summary-total").textContent = String(s.total);
  $("summary-completed").textContent = String(s.completed);
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
  if (!isEmpty) {
    for (const trail of sorted) list.appendChild(createCard(trail));
  }
}

function createCard(trail: Trail): HTMLElement {
  const isDone = trail.status === "completed";
  const card = el("article", `trail-card${isDone ? " trail-card--completed" : ""}`);
  card.dataset.id = trail.id;

  const badges = el("div", "card-badges");
  badges.appendChild(el("span", `status-badge status-badge--${trail.status}`, isDone ? "✓ Completed" : "⛰ Want to Hike"));
  badges.appendChild(el("span", `diff-badge diff-badge--${trail.difficulty}`, trail.difficulty));

  const title = el("h2", `card-title${isDone ? " card-title--done" : ""}`, trail.name);

  const meta = el("div", "card-meta");
  const loc = el("span", "card-loc");
  loc.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg> `;
  loc.appendChild(document.createTextNode(trail.location));
  meta.appendChild(loc);
  meta.appendChild(el("span", "card-dist", formatDistance(trail.distance, trail.unit)));
  meta.appendChild(el("span", "card-date", formatDate(trail.createdAt)));

  const actions = el("div", "card-actions");
  const editBtn = el("button", "btn btn-secondary", "Edit");
  editBtn.type = "button";
  editBtn.setAttribute("aria-label", `Edit ${trail.name}`);
  editBtn.addEventListener("click", () => startEdit(trail.id));

  const toggleBtn = el("button", "btn btn-ghost", isDone ? "Mark Pending" : "Mark Complete");
  toggleBtn.type = "button";
  toggleBtn.setAttribute("aria-label", isDone ? `Mark ${trail.name} pending` : `Mark ${trail.name} complete`);
  toggleBtn.addEventListener("click", () => toggleStatus(trail.id));

  const deleteBtn = el("button", "btn btn-danger", "Delete");
  deleteBtn.type = "button";
  deleteBtn.setAttribute("aria-label", `Delete ${trail.name}`);
  deleteBtn.addEventListener("click", () => handleDelete(trail.id, deleteBtn));

  actions.append(editBtn, toggleBtn, deleteBtn);
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
      fld(form, "name").value = t.name;
      fld(form, "location").value = t.location;
      fld(form, "distance").value = String(t.distance);
      fld(form, "unit").value = t.unit;
      fld(form, "difficulty").value = t.difficulty;
      (form.elements.namedItem("notes") as HTMLTextAreaElement).value = t.notes;
      fld(form, "status").value = t.status;
    }
  } else {
    form.reset();
    clearFieldErrors();
  }
}

function wireEvents(): void {
  const form = $("trail-form") as HTMLFormElement;
  form.addEventListener("submit", (e) => { e.preventDefault(); handleFormSubmit(form); });
  $("cancel-edit-btn").addEventListener("click", () => { editingId = null; render(); announce("Edit cancelled."); });
  $("search-input").addEventListener("input", (e) => {
    filterQuery = (e.target as HTMLInputElement).value;
    render();
    if (filterQuery && filterItems(items, filterQuery).length === 0) announce(`No trails found for "${filterQuery}".`);
  });
  $("clear-filter-btn").addEventListener("click", () => {
    filterQuery = "";
    ($("search-input") as HTMLInputElement).value = "";
    render();
    announce("Filter cleared.");
  });
  $("dismiss-banner-btn").addEventListener("click", clearBanner);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && armedDeleteId !== null) {
      document.querySelectorAll(".btn-arm").forEach((b) => revertDeleteButton(b as HTMLButtonElement));
      clearDeleteArm();
      announce("Delete cancelled.");
    }
  });
  document.addEventListener("click", (e) => {
    if (armedDeleteId === null) return;
    if (!(e.target as HTMLElement).closest(`[data-id="${armedDeleteId}"] .btn-danger`)) {
      document.querySelectorAll(".btn-arm").forEach((b) => revertDeleteButton(b as HTMLButtonElement));
      clearDeleteArm();
    }
  });
}

function clearFieldErrors(): void {
  document.querySelectorAll(".field-error").forEach((e) => { (e as HTMLElement).textContent = ""; });
  document.querySelectorAll("[aria-invalid]").forEach((e) => { e.removeAttribute("aria-invalid"); });
}

function showFieldErrors(errors: Record<string, string>): void {
  clearFieldErrors();
  for (const [field, msg] of Object.entries(errors)) {
    const errEl = $(`${field}-error`);
    if (errEl) errEl.textContent = msg;
    const inputEl = document.querySelector(`[name="${field}"]`) as HTMLElement | null;
    if (inputEl) inputEl.setAttribute("aria-invalid", "true");
  }
  const first = Object.values(errors)[0];
  if (first) announce(`Validation error: ${first}`);
}

function handleFormSubmit(form: HTMLFormElement): void {
  const input: TrailInput = {
    name: fld(form, "name").value,
    location: fld(form, "location").value,
    distance: fld(form, "distance").value,
    unit: fld(form, "unit").value,
    difficulty: fld(form, "difficulty").value,
    notes: (form.elements.namedItem("notes") as HTMLTextAreaElement).value,
    status: fld(form, "status").value,
  };
  const result = validate(input);
  if (!result.ok) {
    showFieldErrors(result.errors as Record<string, string>);
    return;
  }
  clearFieldErrors();

  if (editingId !== null) {
    const updated = createItem(input, editingId, items.find((t) => t.id === editingId)?.createdAt ?? new Date().toISOString());
    const newItems = items.map((t) => (t.id === editingId ? updated : t));
    const saveResult = save(newItems);
    if (!saveResult.ok) { reportFailure(saveResult.message ?? "Could not save changes."); return; }
    items = newItems;
    editingId = null;
    render();
    announce(`Trail "${updated.name}" updated successfully.`);
  } else {
    const id = `trail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newTrail = createItem(input, id, new Date().toISOString());
    const newItems = [...items, newTrail];
    const saveResult = save(newItems);
    if (!saveResult.ok) { reportFailure(saveResult.message ?? "Could not save trail."); return; }
    items = newItems;
    render();
    announce(`Trail "${newTrail.name}" added to your list.`);
    const newCard = document.querySelector(`[data-id="${id}"]`);
    if (newCard) newCard.classList.add("card-enter");
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
  const newStatus = trail.status === "want" ? "completed" : "want";
  const updated = { ...trail, status: newStatus } as Trail;
  const newItems = items.map((t) => (t.id === id ? updated : t));
  const saveResult = save(newItems);
  if (!saveResult.ok) { reportFailure(saveResult.message ?? "Could not update trail status."); return; }
  items = newItems;
  render();
  announce(`"${trail.name}" marked as ${newStatus === "completed" ? "completed" : "want to hike"}.`);
}

function handleDelete(id: string, btn: HTMLButtonElement): void {
  if (armedDeleteId === id) {
    const trail = items.find((t) => t.id === id);
    const name = trail?.name ?? "Trail";
    const newItems = items.filter((t) => t.id !== id);
    const saveResult = save(newItems);
    if (!saveResult.ok) {
      reportFailure(saveResult.message ?? "Could not delete trail.");
      clearDeleteArm();
      revertDeleteButton(btn);
      return;
    }
    items = newItems;
    if (editingId === id) editingId = null;
    render();
    announce(`Trail "${name}" deleted.`);
  } else {
    if (armedDeleteId !== null) {
      document.querySelectorAll(".btn-arm").forEach((b) => revertDeleteButton(b as HTMLButtonElement));
      clearDeleteArm();
    }
    armedDeleteId = id;
    btn.textContent = "Confirm?";
    btn.setAttribute("aria-label", "Confirm delete — click again to confirm");
    btn.classList.add("btn-arm");
    armedDeleteTimer = setTimeout(() => {
      revertDeleteButton(btn);
      clearDeleteArm();
      announce("Delete cancelled.");
    }, 3000);
    announce("Delete armed. Click again to confirm, or press Escape to cancel.");
  }
}
