import { initLogin } from "./login.js";
import { unwrap, resourceURL, apiURL, segment } from "./api.js";
import { initHive } from "./hive.js";
import { initBatches } from "./batches.js";
import { initLab } from "./lab.js";
import { initTraceability } from "./traceability.js";
import { initVerification } from "./verification.js";
import { initMarketplace } from "./marketplace.js";
import { initAdmin } from "./admin.js";
import { initFarmers } from "./farmers.js";

export const $ = (selector, root = document) => root.querySelector(selector);
export function node(tag, className = "", text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}
export function pick(object, ...paths) {
  for (const path of paths) {
    const value = path.split(".").reduce((current, key) => current?.[key], object);
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}
export function display(value) {
  if (value === null || value === undefined || value === "") return "Unavailable";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
export function number(value, unit = "") {
  if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "Unavailable";
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
}
export function date(value) {
  if (!value) return "Unavailable";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? display(value) : parsed.toLocaleString();
}
export function badge(text, type = "neutral") {
  return node("span", `badge ${type}`, text);
}
export function status(value) {
  const text = display(value);
  const normalized = text.toLowerCase().replaceAll(" ", "_");
  const good = ["healthy", "low", "available", "passed"];
  const bad = ["high", "disease_risk", "critical", "failed", "at_risk", "unhealthy"];
  return badge(text, good.includes(normalized) ? "good" : bad.includes(normalized) ? "bad" : "neutral");
}
export function verificationState(value) {
  if (value === true) return "verified";
  if (value === false) return "not_verified";
  if (value && typeof value === "object") {
    if (value.available === false || value.blockchain_available === false) return "unavailable";
    if (value.verified === false || value.is_verified === false) return "not_verified";
    const state = value.status ?? value.verification_status;
    if (["unavailable", "blockchain_unavailable", "error"].includes(String(state).toLowerCase())) return "unavailable";
    if (["not_verified", "failed", "mismatch", "hash_mismatch"].includes(String(state).toLowerCase())) return "not_verified";
    if (value.verified === true || value.is_verified === true) return "verified";
    return verificationState(state);
  }
  const normalized = String(value ?? "").trim().toLowerCase().replaceAll(" ", "_");
  if (normalized === "verified") return "verified";
  if (["not_verified", "failed", "mismatch", "hash_mismatch", "invalid"].includes(normalized)) return "not_verified";
  return "unavailable";
}
export function verificationBadge(value) {
  const state = verificationState(value);
  return badge(
    state === "verified" ? "VERIFIED" : state === "not_verified" ? "NOT VERIFIED" : "UNAVAILABLE",
    state === "verified" ? "good" : state === "not_verified" ? "bad" : "warn"
  );
}
export function blockchainValue(data) {
  if (data?.blockchain_available === false) return { available: false };
  return pick(data, "blockchain_verification", "blockchain_verified", "blockchain", "blockchain_status");
}
export function details(entries) {
  const dl = node("dl", "details");
  entries.forEach(([label, value]) => {
    const row = node("div");
    row.append(node("dt", "", label));
    const dd = node("dd");
    dd.append(value instanceof Node ? value : document.createTextNode(display(value)));
    row.append(dd);
    dl.append(row);
  });
  return dl;
}
export function raw(data) {
  const element = node("details", "raw");
  element.style.display = "none";
  return element;
}
export function empty(target, message = "No records returned by the backend.") {
  target.replaceChildren(node("div", "empty", message));
}
export function errorBox(target, error) {
  target.replaceChildren(node("div", "error-box", error.message || String(error)));
}
export function toast(message, type = "") {
  const item = node("div", `toast ${type}`);
  const close = node("button", "", "Dismiss");
  close.type = "button";
  close.addEventListener("click", () => item.remove());
  item.append(node("span", "", message), close);
  $("#toasts").append(item);
  setTimeout(() => item.remove(), type === "error" ? 14000 : 6500);
}
export async function task(target, action, button) {
  if (button) button.disabled = true;
  target.setAttribute("aria-busy", "true");
  target.replaceChildren(node("div", "loading", "Contacting backend..."));
  try {
    return await action();
  } catch (error) {
    if (error.name !== "AbortError") {
      errorBox(target, error);
      toast(error.message || "Request failed.", "error");
    }
    return null;
  } finally {
    target.removeAttribute("aria-busy");
    if (button) button.disabled = false;
  }
}
export function table(columns, rows) {
  if (!rows.length) return node("div", "empty", "No records returned by the backend.");
  const wrapper = node("div", "table-wrap");
  wrapper.tabIndex = 0;
  wrapper.setAttribute("role", "region");
  wrapper.setAttribute("aria-label", "Scrollable data table");
  const element = node("table");
  const head = node("thead");
  const header = node("tr");
  columns.forEach(([label]) => {
    const th = node("th", "", label);
    th.scope = "col";
    header.append(th);
  });
  head.append(header);
  const body = node("tbody");
  rows.forEach(row => {
    const tr = node("tr");
    columns.forEach(([, get]) => {
      const td = node("td");
      const value = get(row);
      td.append(value instanceof Node ? value : document.createTextNode(display(value)));
      tr.append(td);
    });
    body.append(tr);
  });
  element.append(head, body);
  wrapper.append(element);
  return wrapper;
}
export function metrics(target, values) {
  target.replaceChildren();
  values.forEach(([label, value, note]) => {
    const card = node("div", "metric");
    card.append(node("span", "metric-label", label), node("span", "metric-value", display(value)));
    if (note) card.append(node("small", "", note));
    target.append(card);
  });
}
export function options(select, rows, getId, getLabel, prompt = "Select a record") {
  const previous = select.value;
  const placeholder = new Option(prompt, "");
  select.replaceChildren(placeholder);
  rows.forEach(row => {
    const id = getId(row);
    if (id !== null && id !== undefined && id !== "") {
      select.add(new Option(display(getLabel(row)), String(id)));
    }
  });
  if ([...select.options].some(option => option.value === previous)) select.value = previous;
}
export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}
export function modal(title, content) {
  $("#dialog-title").textContent = title;
  $("#dialog-content").replaceChildren(content);
  const dialog = $("#details-dialog");
  if (!dialog.open) dialog.showModal();
}
export function recordButton(label, callback) {
  const button = node("button", "button ghost small", label);
  button.type = "button";
  button.addEventListener("click", () => callback(button));
  return button;
}
export function qrPanel(data, batchId) {
  const panel = node("div", "qr-panel");
  panel.append(node("h3", "", "Scan to Verify"));
  const qr = pick(data, "qr_code", "qr_code_url", "qr_code_path", "qr_code.url", "qr_code.path", "qr_url", "qr_path");  
  const url = resourceURL(qr);
  if (url) {
    const image = node("img");
    image.alt = `Backend-provided verification QR for batch ${batchId || ""}`;
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      image.replaceWith(node("p", "error-box", "The backend-provided QR image could not be loaded."));
    }, { once: true });
    image.src = url;
    panel.append(image);
  } else {
    panel.append(node("p", "muted", "QR unavailable. No replacement or fabricated QR has been generated."));
  }
  if (batchId) {
    const link = node("a", "button ghost", "Open Public Verification");
    link.href = apiURL(`/verify/${segment(batchId)}`);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    panel.append(link);
  }
  panel.append(node("p", "help section-gap", "A QR code links to a record; it does not itself prove blockchain verification."));
  return panel;
}
export function timeline(events) {
  if (!Array.isArray(events) || !events.length) return node("div", "empty", "No traceability events returned.");
  const list = node("ol", "timeline");
  events.forEach(event => {
    const item = node("li");
    item.append(node("h3", "", display(pick(event, "event_type", "type"))));
    item.append(details([
      ["From", pick(event, "from", "from_entity")],
      ["To", pick(event, "to", "to_entity")],
      ["Location", event.location],
      ["Timestamp", date(pick(event, "timestamp", "created_at"))],
      ["Transaction hash", pick(event, "transaction_hash", "tx_hash")]
    ]));
    list.append(item);
  });
  return list;
}
export function lineChart(target, records, valuePath, title) {
  target.replaceChildren(node("h3", "", title));
  const samples = records.map(row => ({
    value: pick(row, valuePath, `prediction.${valuePath}`),
    time: pick(row, "timestamp", "created_at")
  })).filter(row => row.value !== null && Number.isFinite(Number(row.value)));
  if (!samples.length) {
    target.append(node("p", "empty", "No numeric history available."));
    return;
  }
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 600 180");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `${title}.`);
  const values = samples.map(sample => Number(sample.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const points = values.map((value, index) => [
    25 + index * 550 / Math.max(values.length - 1, 1),
    max === min ? 85 : 145 - (value - min) / (max - min) * 115
  ]);
  const baseline = document.createElementNS(ns, "line");
  Object.entries({ x1: 25, y1: 150, x2: 575, y2: 150, stroke: "#dce2d8" }).forEach(([key, value]) => baseline.setAttribute(key, value));
  const path = document.createElementNS(ns, "polyline");
  path.setAttribute("points", points.map(point => point.join(",")).join(" "));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#ba861b");
  path.setAttribute("stroke-width", "3");
  svg.append(baseline, path);
  points.forEach(([cx, cy], index) => {
    const circle = document.createElementNS(ns, "circle");
    Object.entries({ cx, cy, r: 4, fill: "#213e35" }).forEach(([key, value]) => circle.setAttribute(key, value));
    const tooltip = document.createElementNS(ns, "title");
    tooltip.textContent = `${date(samples[index].time)}: ${values[index]}`;
    circle.append(tooltip);
    svg.append(circle);
  });
  const labels = node("div", "chart-labels");
  labels.append(node("span", "", date(samples[0].time)), node("span", "", date(samples.at(-1).time)));
  target.append(svg, labels, node("p", "help", `Observed range: ${number(min)} to ${number(max)}.`));
}

export const state = { batchId: "", hiveId: "" };
export function selectBatch(id) {
  state.batchId = String(id ?? "");
  window.dispatchEvent(new CustomEvent("batch:selected", { detail: state.batchId }));
}

const pages = {
  login: ["Login", "Access Honey Chain Dashboard."],
  farmers: ["Farmers", "Register and manage farmers across India."],
  hive: ["Farmer / Smart Hive", "Monitor hive data and predictions."],
  history: ["Hive History", "Inspect recorded sensor readings."],
  batches: ["Honey Batches", "Create and manage honey harvest records."],
  lab: ["Lab Reports", "Upload laboratory evidence."],
  traceability: ["Traceability", "Follow the recorded movement of honey."],
  verification: ["Consumer Verification", "Verify honey source privately."],
  marketplace: ["Buyer Marketplace", "Explore available honey batches."],
  admin: ["Regional Dashboard", "Monitor farmers and regional activity."]
};
const loaders = new Map();
export function onPage(name, callback) { loaders.set(name, callback); }

function route() {
  const name = location.hash.slice(1).split("?")[0] || "login";  
  const page = pages[name] ? name : "login";
  
  // --- AUTHENTICATION & ROUTE PROTECTION ---
  const userType = localStorage.getItem("honeychain_user_type");
  const publicPages = ["login", "verification", "marketplace"];

  if (!userType && !publicPages.includes(page)) {
    toast("Please login to access protected pages.", "error");
    location.hash = "login";
    return;
  }

  // Sidebar link visibility and route access guarding
  document.querySelectorAll("#navigation a").forEach(link => {
    const targetPage = link.dataset.page;
    link.style.display = "block"; 
    
    // Farmer Logic
    if (userType === "farmer") {
      if (["admin", "farmers"].includes(targetPage)) link.style.display = "none";
      if (["admin", "farmers"].includes(page)) {
         toast("Access Denied: Admins only.", "error");
         location.hash = "hive";
         return;
      }
    }
    
    // Admin Logic
    if (userType === "admin") {
      if (["hive", "history", "batches"].includes(targetPage)) link.style.display = "none";
      if (["hive", "history", "batches"].includes(page)) {
         toast("Access Denied: Use the Regional Dashboard.", "error");
         location.hash = "admin";
         return;
      }
    }

    // Unauthenticated Logic
    if (!userType && !publicPages.includes(targetPage)) {
      link.style.display = "none";
    }
  });
  // ------------------------------------------

  document.querySelectorAll(".page").forEach(element => {
    element.hidden = element.id !== `page-${page}`;
  });
  document.querySelectorAll("[data-page]").forEach(link => {
    const active = link.dataset.page === page;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  $("#page-title").textContent = pages[page][0];
  $("#breadcrumb").textContent = pages[page][0];
  $("#page-description").textContent = pages[page][1];
  $("#sidebar").classList.remove("open");
  $("#menu-toggle").setAttribute("aria-expanded", "false");
  Promise.resolve(loaders.get(page)?.()).catch(error => toast(error.message, "error"));
}

function boot() {
  window.addEventListener("api:connection", event => {
    const reachable = event.detail.reachable;
    const indicator = $("#connection");
    indicator.className = `badge ${reachable ? "good" : "bad"}`;
    indicator.textContent = reachable ? "API reachable" : "API unavailable";
  });
  $("#menu-toggle").addEventListener("click", () => {
    const open = $("#sidebar").classList.toggle("open");
    $("#menu-toggle").setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      $("#sidebar").classList.remove("open");
      $("#menu-toggle").setAttribute("aria-expanded", "false");
    }
  });
  $("#dialog-close").addEventListener("click", () => $("#details-dialog").close());
  
  initLogin();
  initHive();
  initBatches();
  initLab();
  initTraceability();
  initVerification();
  initMarketplace();
  initFarmers();
  initAdmin();
  
  const params = new URLSearchParams(location.search);
  if (params.get("batch_id")) selectBatch(params.get("batch_id"));
  window.addEventListener("hashchange", route);
  route();
}

boot();