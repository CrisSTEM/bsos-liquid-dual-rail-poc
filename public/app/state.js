import {
  STORAGE_KEY,
  DEFAULT_FORM_STATE,
  createInitialState,
} from "./config.js";
import { dom, fieldIds } from "./dom.js";

export const state = createInitialState();

function applyFreshState(fresh) {
  state.health = fresh.health;
  state.transfer = fresh.transfer;
  state.transferError = fresh.transferError;
  state.lookup = fresh.lookup;
  state.lookupError = fresh.lookupError;
  state.audit = fresh.audit;
  state.auditError = fresh.auditError;
  state.viewMode = fresh.viewMode;
  state.responseTab = fresh.responseTab;
  state.presenterMode = fresh.presenterMode;
  state.form = { ...fresh.form };
}

export function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    state.health = saved.health || null;
    state.transfer = saved.transfer || null;
    state.transferError = saved.transferError || null;
    state.lookup = saved.lookup || null;
    state.lookupError = saved.lookupError || null;
    state.audit = saved.audit || null;
    state.auditError = saved.auditError || null;
    state.viewMode = saved.viewMode === "ops" ? "ops" : "demo";
    state.responseTab = ["transfer", "lookup", "audit"].includes(
      saved.responseTab,
    )
      ? saved.responseTab
      : "transfer";
    state.presenterMode = Boolean(saved.presenterMode);
    state.form = {
      ...DEFAULT_FORM_STATE,
      ...(saved.form || {}),
    };
  } catch (_) {
    applyFreshState(createInitialState());
  }
}

export function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    // Ignore localStorage failures in browser-restricted contexts.
  }
}

export function applyFormState() {
  fieldIds.forEach((id) => {
    if (dom[id]) {
      dom[id].value = state.form[id] ?? "";
    }
  });
}

export function captureFormState() {
  fieldIds.forEach((id) => {
    if (dom[id]) {
      state.form[id] = dom[id].value;
    }
  });

  persistState();
}

export function getLatestTxid() {
  return state.transfer?.txid || state.lookup?.txid || state.audit?.txid || "";
}

export function getLatestBlindingKey() {
  return (
    state.transfer?.regulator_demo?.blinding_key ||
    state.form.auditBlindingKey ||
    ""
  );
}

export function getLatestConfidentiality() {
  return (
    state.lookup?.confidentiality ||
    state.audit?.blockchain_confidentiality ||
    state.transfer?.confidentiality_check ||
    null
  );
}

export function syncDerivedFields(force = false) {
  const txid = getLatestTxid();
  const blindingKey = getLatestBlindingKey();

  if (txid && (force || !state.form.lookupTxid)) {
    state.form.lookupTxid = txid;
  }

  if (txid && (force || !state.form.auditTxid)) {
    state.form.auditTxid = txid;
  }

  if (blindingKey && (force || !state.form.auditBlindingKey)) {
    state.form.auditBlindingKey = blindingKey;
  }
}
