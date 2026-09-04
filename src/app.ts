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

// ── Helpers ────────────────────────────────────────────────────────────────
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

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
  switch (result.status) {
    case "ok":
      items = result.items;
      clearBanner();
      break;
    case "empty":
      items = [];
      clearBanner();
      break;
    case "partial":
      items = result.items;
      reportFailure(result.message);
      break;
    case "error":
      items = [];
      reportFailure(result.message);
      break;
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
  const emptyAll = $("empty-all");
  const emptyFilter = $("empty-filter");
  list.innerHTML = "";

  if (isEmpty) {
    emptyAll.hidden = false;
    emptyFilter.hidden = true;
    return;
  }
  emptyAll.hidden = true;

  if (isFilterEmpty) {
    emptyFilter.hidden = false;
    ($("empty-filter-query") as HTMLElement).textContent = `"${filterQuery}"`;
    return;
  }
  emptyFilter.hidden = true;

  for (const trail of sorted) {
    list.appendChild(createCard(trail));
  }
}

function createCard(trail: Trail): HTMLElement {
  const isCompleted = trail.status === "completed";
  const card = el("article", `trail-card${isCompleted ? " trail-card--completed" : ""}`);
  card.dataset.id = trail.id;
  const badge = el("span", `status-badge status-badge--${trail.status}`, isCompleted ? "✓ Completed" : "⛰ Want to Hike");
  const diff = el("span", `diff-badge diff-badge--${trail.difficulty}`, trail.difficulty);
  const badges = el("div", "card-badges");
  badges.appendChild(badge);
  badges.appendChild(diff);
  const title = el("h2", "card-title", trail.name);
  if (isCompleted) title.classList.add("card-title--done");
  const meta = el("div", "card-meta");
  const locSpan = el("span", "card-loc");
  const pinSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  pinSvg.setAttribute("width", "14"); pinSvg.setAttribute("height", "14");
  pinSvg.setAttribute("viewBox", "0 0 24 24"); pinSvg.setAttribute("aria-hidden", "true");
  pinSvg.setAttribute("fill", "currentColor");
  pinSvg.innerHTML = '<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>';
  locSpan.appendChild(pinSvg);
  locSpan.appendChild(document.createTextNode(" " + trail.location));
  const distSpan = el("span", "card-dist", formatDistance(trail.distance, trail.unit));
  const dateSpan = el("span", "card-date", formatDate(trail.createdAt));
  meta.appendChild(locSpan); meta.appendChild(distSpan); meta.appendChild(dateSpan);
  const actions = el("div", "card-actions");
  const editBtn = el("button", "btn btn-secondary", "Edit");
  editBtn.type = "button";
  editBtn.setAttribute("aria-label", `Edit ${trail.name}`);
  editBtn.addEventListener("click", () => startEdit(trail.id));
  const toggleBtn = el("button", "btn btn-ghost", isCompleted ? "Mark Pending" : "Mark Complete");
  toggleBtn.type = "button";
  toggleBtn.setAttribute("aria-label", isCompleted ? `Mark ${trail.name} as pending` : `Mark ${trail.name} as complete`);
  toggleBtn.addEventListener("click", () => toggleStatus(trail.id));
  const deleteBtn = el("button", "btn btn-danger", "Delete");
  deleteBtn.type = "button";
  deleteBtn.setAttribute("aria-label", `Delete ${trail.name}`);
  deleteBtn.addEventListener("click", () => handleDelete(trail.id, deleteBtn));
  actions.appendChild(editBtn); actions.appendChild(toggleBtn); actions.appendChild(deleteBtn);
  card.appendChild(badges); card.appendChild(title); card.appendChild(meta);
  if (trail.notes) card.appendChild(el("p", "card-notes", trail.notes));
  card.appendChild(actions);
  if (editingId === trail.id) card.classList.add("trail-card--editing");
  return card;
}

function renderFormState(): void {
  const form = $("trail-form") as HTMLFormElement;
  const heading = $("form-heading");
  const cancelBtn = $("cancel-edit-btn");
  const submitBtn = $("submit-btn");
  if (editingId !== null) {
    const trail = items.find((t) => t.id === editingId);
    if (trail) {
      heading.textContent = "Edit Trail";
      submitBtn.textContent = "Save Changes";
      cancelBtn.hidden = false;
      (form.elements.namedItem("name") as HTMLInputElement).value = trail.name;
      (form.elements.namedItem("location") as HTMLInputElement).value = trail.location;
      (form.elements.namedItem("distance") as HTMLInputElement).value = String(trail.distance);
      (form.elements.namedItem("unit") as HTMLSelectElement).value = trail.unit;
      (form.elements.namedItem("difficulty") as HTMLSelectElement).value = trail.difficulty;
      (form.elements.namedItem("notes") as HTMLTextAreaElement).value = trail.notes;
      (form.elements.namedItem("status") as HTMLSelectElement).value = trail.status;
    }
  } else {
    heading.textContent = "Add a Trail";
    submitBtn.textContent = "Add Trail";
    cancelBtn.hidden = true;
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
    const filtered = filterItems(items, filterQuery);
    if (filterQuery && filtered.length === 0) announce(`No trails found for "${filterQuery}".`);
  });
  $("clear-filter-btn").addEventListener("click", () => {
    filterQuery = ""; ($("search-input") as HTMLInputElement).value = "";
    render(); announce("Filter cleared.");
  });
  $("dismiss-banner-btn").addEventListener("click", clearBanner);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && armedDeleteId !== null) {
      document.querySelectorAll(".btn-arm").forEach((b) => revertDeleteButton(b as HTMLButtonElement));
      clearDeleteArm(); announce("Delete cancelled.");
    }
  });
  document.addEventListener("click", (e) => {
    if (armedDeleteId === null) return;
    const target = e.target as HTMLElement;
    if (!target.closest(`[data-id="${armedDeleteId}"] .btn-danger`)) {
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
    name: (form.elements.namedItem("name") as HTMLInputElement).value,
    location: (form.elements.namedItem("location") as HTMLInputElement).value,
    distance: (form.elements.namedItem("distance") as HTMLInputElement).value,
    unit: (form.elements.namedItem("unit") as HTMLSelectElement).value,
    difficulty: (form.elements.namedItem("difficulty") as HTMLSelectElement).value,
    notes: (form.elements.namedItem("notes") as HTMLTextAreaElement).value,
    status: (form.elements.namedItem("status") as HTMLSelectElement).value,
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
    if (!saveResult.ok) {
      reportFailure(saveResult.message ?? "Could not save changes.");
      return;
    }
    items = newItems;
    editingId = null;
    render();
    announce(`Trail "${updated.name}" updated successfully.`);
  } else {
    const id = `trail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const newTrail = createItem(input, id, now);
    const newItems = [...items, newTrail];
    const saveResult = save(newItems);
    if (!saveResult.ok) {
      reportFailure(saveResult.message ?? "Could not save trail.");
      return;
    }
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
  (form.elements.namedItem("name") as HTMLInputElement).focus();
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
  if (!saveResult.ok) {
    reportFailure(saveResult.message ?? "Could not update trail status.");
    return;
  }
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
      clearDeleteArm(); revertDeleteButton(btn);
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
      revertDeleteButton(btn); clearDeleteArm(); announce("Delete cancelled.");
    }, 3000);
    announce("Delete armed. Click again to confirm, or press Escape to cancel.");
  }
}
