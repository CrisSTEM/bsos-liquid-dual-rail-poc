import { dom } from "./dom.js";

export function textOrDash(value) {
  return value === undefined || value === null || value === ""
    ? "—"
    : String(value);
}

export function shortHash(value, head = 14, tail = 10) {
  if (!value) return "—";

  const str = String(value);
  return str.length <= head + tail + 1
    ? str
    : `${str.slice(0, head)}…${str.slice(-tail)}`;
}

export function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export function setPill(element, text, tone = "neutral") {
  if (!element) return;
  element.className = `pill ${tone}`;
  element.textContent = text;
}

export function setStatusBadge(element, text, tone = "neutral") {
  if (!element) return;
  element.className = `status-badge ${tone}`;
  element.textContent = text;
}

export function setResultBox(element, message, tone = "") {
  if (!element) return;
  element.className = `result-box${tone ? ` ${tone}` : ""}`;
  element.textContent = message;
}

export function setProgressNode(
  element,
  { complete = false, active = false } = {},
) {
  if (!element) return;
  element.classList.toggle("complete", complete);
  element.classList.toggle("active", active);
}

export function setStepCardState(element, stateName) {
  if (!element) return;
  element.classList.remove("current", "complete", "error");

  if (stateName) {
    element.classList.add(stateName);
  }
}

export function setJson(pre, payload, placeholder) {
  if (!pre) return;
  pre.textContent = payload ? JSON.stringify(payload, null, 2) : placeholder;
}

export function normalizeError(error) {
  return (
    error?.payload || {
      error: "request_failed",
      message: error?.message || "Request failed.",
    }
  );
}

export function showToast(message, tone = "info") {
  if (!dom.toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    toast.style.transition = "all 180ms ease";
  }, 2600);

  window.setTimeout(() => {
    toast.remove();
  }, 3000);
}

export async function copyText(value, label) {
  const text = String(value || "").trim();

  if (!text || text === "—" || text.startsWith("//")) {
    showToast(`No ${label.toLowerCase()} available to copy.`, "warning");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard.`, "success");
  } catch (_) {
    showToast(`Unable to copy ${label.toLowerCase()}.`, "error");
  }
}

export async function withButtons(buttons, busyTexts, task) {
  const originals = buttons.map((button) => button?.textContent || "");

  buttons.forEach((button, index) => {
    if (!button) return;
    button.disabled = true;
    button.textContent = busyTexts[index] || button.textContent;
  });

  try {
    await task();
  } finally {
    buttons.forEach((button, index) => {
      if (!button) return;
      button.disabled = false;
      button.textContent = originals[index];
    });
  }
}
