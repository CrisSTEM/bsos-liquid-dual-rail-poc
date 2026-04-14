import { DEFAULT_FORM_STATE } from "./config.js";
import { dom, fieldIds, viewButtons, responseTabButtons } from "./dom.js";
import {
  state,
  captureFormState,
  applyFormState,
  persistState,
  syncDerivedFields,
  getLatestTxid,
  getLatestBlindingKey,
} from "./state.js";
import { apiFetch } from "./api.js";
import { renderAll } from "./render.js";
import { showToast, normalizeError, withButtons, copyText } from "./utils.js";

function buildTransferPayload() {
  captureFormState();

  return {
    originator: {
      name: state.form.originatorName.trim(),
      documentNumber: state.form.originatorDocumentNumber.trim(),
      vaspId: state.form.originatorVaspId.trim(),
      country: state.form.originatorCountry.trim().toUpperCase(),
    },
    beneficiary: {
      name: state.form.beneficiaryName.trim(),
      walletAddress: state.form.beneficiaryWalletAddress.trim(),
      vaspId: state.form.beneficiaryVaspId.trim(),
      country: state.form.beneficiaryCountry.trim().toUpperCase(),
    },
    transfer: {
      amount: state.form.transferAmount.trim(),
      currency: state.form.transferCurrency.trim().toUpperCase(),
      assetSymbol: state.form.transferAssetSymbol.trim(),
      purpose: state.form.transferPurpose.trim(),
    },
  };
}

export function setViewMode(mode) {
  state.viewMode = mode === "ops" ? "ops" : "demo";
  renderAll();
  persistState();
}

export function setResponseTab(tab) {
  state.responseTab = ["transfer", "lookup", "audit"].includes(tab)
    ? tab
    : "transfer";
  renderAll();
  persistState();
}

export function togglePresenterMode() {
  state.presenterMode = !state.presenterMode;
  renderAll();
  persistState();
  showToast(
    state.presenterMode
      ? "Presenter mode enabled."
      : "Presenter mode disabled.",
    "info",
  );
}

export function loadDemoDefaults() {
  const latestTxid = getLatestTxid();
  const latestBlindingKey = getLatestBlindingKey();

  state.form = {
    ...DEFAULT_FORM_STATE,
    lookupTxid: latestTxid || "",
    auditTxid: latestTxid || "",
    auditBlindingKey: latestBlindingKey || "",
    auditRequester: DEFAULT_FORM_STATE.auditRequester,
  };

  applyFormState();
  renderAll();
  showToast("Demo defaults loaded.", "success");
}

export function resetSession() {
  captureFormState();

  state.transfer = null;
  state.transferError = null;
  state.lookup = null;
  state.lookupError = null;
  state.audit = null;
  state.auditError = null;
  state.responseTab = "transfer";

  state.form.lookupTxid = "";
  state.form.auditTxid = "";
  state.form.auditBlindingKey = "";
  state.form.auditRequester =
    state.form.auditRequester || DEFAULT_FORM_STATE.auditRequester;

  applyFormState();
  renderAll();
  showToast("Session state cleared.", "info");
}

export async function pingHealth({ silent = false } = {}) {
  const originalText = dom.refreshHealthBtn?.textContent || "Refresh health";

  if (!silent && dom.refreshHealthBtn) {
    dom.refreshHealthBtn.disabled = true;
    dom.refreshHealthBtn.textContent = "Refreshing…";
  }

  try {
    const response = await apiFetch("/healthz");
    state.health = {
      ...response,
      checkedAt: new Date().toISOString(),
    };

    if (!silent) {
      showToast("API health refreshed successfully.", "success");
    }
  } catch (error) {
    state.health = {
      status: "offline",
      error: error.message || "Health check failed.",
      checkedAt: new Date().toISOString(),
    };

    if (!silent) {
      showToast("API health check failed.", "error");
    }
  } finally {
    if (!silent && dom.refreshHealthBtn) {
      dom.refreshHealthBtn.disabled = false;
      dom.refreshHealthBtn.textContent = originalText;
    }

    renderAll();
  }
}

export async function submitTransfer() {
  const payload = buildTransferPayload();

  await withButtons(
    [dom.transferSubmitBtn, dom.demoRunTransferBtn],
    ["Submitting…", "Running step 1…"],
    async () => {
      try {
        const response = await apiFetch("/api/transfer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        state.transfer = response;
        state.transferError = null;
        state.lookup = null;
        state.lookupError = null;
        state.audit = null;
        state.auditError = null;
        state.responseTab = "transfer";

        syncDerivedFields(true);
        applyFormState();

        showToast("Transfer created successfully.", "success");
      } catch (error) {
        state.transfer = null;
        state.transferError = normalizeError(error);
        state.lookup = null;
        state.lookupError = null;
        state.audit = null;
        state.auditError = null;
        state.responseTab = "transfer";

        showToast(
          state.transferError.message || "Transfer request failed.",
          "error",
        );
      }
    },
  );

  renderAll();
}

export async function submitLookup() {
  captureFormState();

  const txid = (state.form.lookupTxid || getLatestTxid() || "").trim();

  if (!txid) {
    showToast("A txid is required for the Liquid lookup.", "warning");
    return;
  }

  state.form.lookupTxid = txid;
  state.form.auditTxid = state.form.auditTxid || txid;
  applyFormState();

  await withButtons(
    [dom.lookupSubmitBtn, dom.demoRunLookupBtn],
    ["Inspecting…", "Running step 2…"],
    async () => {
      try {
        const response = await apiFetch(
          `/api/liquid/tx/${encodeURIComponent(txid)}`,
        );

        state.lookup = response;
        state.lookupError = null;
        state.audit = null;
        state.auditError = null;
        state.responseTab = "lookup";

        state.form.auditTxid = txid;
        applyFormState();

        showToast("Liquid confidentiality inspection completed.", "success");
      } catch (error) {
        state.lookup = null;
        state.lookupError = normalizeError(error);
        state.audit = null;
        state.auditError = null;
        state.responseTab = "lookup";

        showToast(
          state.lookupError.message || "Lookup request failed.",
          "error",
        );
      }
    },
  );

  renderAll();
}

export async function submitAudit() {
  captureFormState();

  const txid = (state.form.auditTxid || getLatestTxid() || "").trim();
  const blindingKey = (
    state.form.auditBlindingKey ||
    getLatestBlindingKey() ||
    ""
  ).trim();
  const requester = (
    state.form.auditRequester || DEFAULT_FORM_STATE.auditRequester
  ).trim();

  if (!txid || !blindingKey) {
    showToast(
      "Both txid and blinding key are required for the audit.",
      "warning",
    );
    return;
  }

  state.form.auditTxid = txid;
  state.form.auditBlindingKey = blindingKey;
  state.form.auditRequester = requester;
  applyFormState();

  await withButtons(
    [dom.auditSubmitBtn, dom.demoRunAuditBtn],
    ["Running audit…", "Running step 3…"],
    async () => {
      try {
        const response = await apiFetch("/api/audit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            txid,
            blinding_key: blindingKey,
            requester,
          }),
        });

        state.audit = response;
        state.auditError = null;
        state.responseTab = "audit";

        showToast(
          response.status === "Successful Match"
            ? "Audit completed with a successful match."
            : "Audit completed.",
          "success",
        );
      } catch (error) {
        state.audit = null;
        state.auditError = normalizeError(error);
        state.responseTab = "audit";

        showToast(state.auditError.message || "Audit request failed.", "error");
      }
    },
  );

  renderAll();
}

export function bindEvents() {
  viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setViewMode(button.dataset.viewButton);
    });
  });

  responseTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setResponseTab(button.dataset.responseTab);
    });
  });

  fieldIds.forEach((id) => {
    dom[id].addEventListener("input", () => {
      captureFormState();
      renderAll();
    });
  });

  dom.loadDefaultsBtn.addEventListener("click", loadDemoDefaults);
  dom.resetSessionBtn.addEventListener("click", resetSession);
  dom.refreshHealthBtn.addEventListener("click", () => pingHealth());
  dom.togglePresenterBtn.addEventListener("click", togglePresenterMode);
  dom.switchToOpsBtn.addEventListener("click", () => setViewMode("ops"));

  dom.transferSubmitBtn.addEventListener("click", submitTransfer);
  dom.lookupSubmitBtn.addEventListener("click", submitLookup);
  dom.auditSubmitBtn.addEventListener("click", submitAudit);

  dom.demoRunTransferBtn.addEventListener("click", submitTransfer);

  dom.demoRunLookupBtn.addEventListener("click", () => {
    if (!state.form.lookupTxid && getLatestTxid()) {
      state.form.lookupTxid = getLatestTxid();
      applyFormState();
    }

    submitLookup();
  });

  dom.demoRunAuditBtn.addEventListener("click", () => {
    if (!state.form.auditTxid && getLatestTxid()) {
      state.form.auditTxid = getLatestTxid();
    }

    if (!state.form.auditBlindingKey && getLatestBlindingKey()) {
      state.form.auditBlindingKey = getLatestBlindingKey();
    }

    applyFormState();
    submitAudit();
  });

  dom.useLatestLookupBtn.addEventListener("click", () => {
    const txid = getLatestTxid();

    if (!txid) {
      showToast("No latest transfer txid is available yet.", "warning");
      return;
    }

    state.form.lookupTxid = txid;
    applyFormState();
    renderAll();

    showToast("Latest transfer txid loaded into the lookup form.", "info");
  });

  dom.useLatestAuditBtn.addEventListener("click", () => {
    const txid = getLatestTxid();
    const blindingKey = getLatestBlindingKey();

    if (!txid || !blindingKey) {
      showToast(
        "No latest transfer context is available for audit.",
        "warning",
      );
      return;
    }

    state.form.auditTxid = txid;
    state.form.auditBlindingKey = blindingKey;
    state.form.auditRequester =
      state.form.auditRequester || DEFAULT_FORM_STATE.auditRequester;

    applyFormState();
    renderAll();

    showToast("Latest transfer context loaded into the audit form.", "info");
  });

  dom.copyTxidBtn.addEventListener("click", () => {
    copyText(dom.sessionTxid.textContent, "txid");
  });

  dom.copyBlindingKeyBtn.addEventListener("click", () => {
    copyText(dom.sessionBlindingKey.textContent, "blinding key");
  });

  dom.copyInspectorBtn.addEventListener("click", () => {
    copyText(dom.responseJson.textContent, "JSON");
  });
}
