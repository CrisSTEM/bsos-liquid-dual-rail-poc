import { dom, viewButtons, responseTabButtons } from "./dom.js";
import {
  state,
  persistState,
  getLatestTxid,
  getLatestBlindingKey,
  getLatestConfidentiality,
} from "./state.js";
import {
  textOrDash,
  shortHash,
  formatDateTime,
  setPill,
  setStatusBadge,
  setResultBox,
  setProgressNode,
  setStepCardState,
  setJson,
} from "./utils.js";

export function renderPresenterMode() {
  document.body.dataset.presenter = state.presenterMode ? "on" : "off";

  if (dom.togglePresenterBtn) {
    dom.togglePresenterBtn.textContent = state.presenterMode
      ? "Presenter mode on"
      : "Presenter mode off";
  }
}

export function renderViewMode() {
  viewButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.viewButton === state.viewMode,
    );
  });

  dom.demoView?.classList.toggle("hidden", state.viewMode !== "demo");
  dom.opsView?.classList.toggle("hidden", state.viewMode !== "ops");
}

export function renderHealth() {
  if (state.health?.status === "ok") {
    setPill(dom.healthPill, "API online", "success");
  } else if (state.health?.status === "offline") {
    setPill(dom.healthPill, "API offline", "error");
  } else {
    setPill(dom.healthPill, "Checking API", "warning");
  }
}

export function renderHeroStats() {
  const confidentiality = getLatestConfidentiality();

  dom.heroServiceValue.textContent =
    state.health?.status === "ok"
      ? "Online"
      : state.health?.status === "offline"
        ? "Offline"
        : "Checking…";

  dom.heroServiceMeta.textContent =
    state.health?.status === "ok"
      ? `Last checked ${formatDateTime(state.health.checkedAt)}`
      : state.health?.status === "offline"
        ? state.health.error || "Health check failed."
        : "Backend reachability and Esplora status.";

  dom.heroSettlementValue.textContent =
    state.transfer?.settlement_reference || "No transfer yet";

  dom.heroSettlementMeta.textContent = state.transfer?.ivms101_message_id
    ? `IVMS101 ${shortHash(state.transfer.ivms101_message_id, 8, 8)}`
    : "A settlement reference appears after step 1.";

  dom.heroConfValue.textContent =
    confidentiality?.blinded_output_count !== undefined
      ? `${confidentiality.blinded_output_count} blinded outputs`
      : "Pending";

  dom.heroConfMeta.textContent = confidentiality
    ? confidentiality.is_confidential
      ? "Liquid outputs are confidential on-chain."
      : "The inspected transaction is not confidential."
    : "Step 2 confirms blinded outputs on-chain.";

  if (state.audit) {
    dom.heroAuditValue.textContent = state.audit.status || "Completed";
    dom.heroAuditMeta.textContent = `${textOrDash(state.audit.originator)} → ${textOrDash(state.audit.beneficiary)}`;
  } else if (state.auditError) {
    dom.heroAuditValue.textContent = "Denied";
    dom.heroAuditMeta.textContent =
      state.auditError.message || "Latest audit attempt failed.";
  } else {
    dom.heroAuditValue.textContent = "Not run yet";
    dom.heroAuditMeta.textContent =
      "Step 3 simulates case-specific disclosure.";
  }
}

export function renderSession() {
  const transfer = state.transfer;
  const txid = getLatestTxid();
  const blindingKey = getLatestBlindingKey();
  const amount = transfer?.ivms101?.transaction?.amount;
  const fiat = transfer?.ivms101?.transaction?.fiatCurrency;
  const asset = transfer?.ivms101?.transaction?.virtualAssetSymbol;

  dom.sessionSettlement.textContent = textOrDash(
    transfer?.settlement_reference,
  );
  dom.sessionTravelRule.textContent = textOrDash(transfer?.travel_rule_status);
  dom.sessionAmount.textContent = amount
    ? `${amount} ${fiat || ""} · ${asset || ""}`.trim()
    : "—";
  dom.sessionTxid.textContent = textOrDash(txid);
  dom.sessionBlindingKey.textContent = textOrDash(blindingKey);
  dom.sessionAudit.textContent =
    state.audit?.status || state.auditError?.message || "—";
}

export function renderDemo() {
  const transferDone = Boolean(state.transfer);
  const lookupDone = Boolean(state.lookup?.confidentiality);
  const auditDone = state.audit?.status === "Successful Match";
  const latestTxid = getLatestTxid();
  const latestBlindingKey = getLatestBlindingKey();

  const completedSteps =
    Number(transferDone) + Number(lookupDone) + Number(auditDone);

  dom.demoOriginatorValue.textContent = textOrDash(state.form.originatorName);
  dom.demoBeneficiaryValue.textContent = textOrDash(state.form.beneficiaryName);
  dom.demoAmountValue.textContent = state.form.transferAmount
    ? `${state.form.transferAmount} ${state.form.transferCurrency || ""}`.trim()
    : "—";
  dom.demoAssetValue.textContent = textOrDash(state.form.transferAssetSymbol);
  dom.demoLookupTxid.textContent = latestTxid || "Generated after step 1";
  dom.demoAuditRequester.textContent = textOrDash(state.form.auditRequester);
  dom.demoAuditBlindingKey.textContent = latestBlindingKey
    ? shortHash(latestBlindingKey, 18, 12)
    : "Generated after step 1";

  dom.demoProgressLabel.textContent = auditDone
    ? "Completed · 3 of 3 steps"
    : `${completedSteps} of 3 steps completed`;

  dom.demoProgressBar.style.width = `${(completedSteps / 3) * 100}%`;

  setProgressNode(dom.progressNode1, {
    complete: transferDone,
    active: !transferDone,
  });

  setProgressNode(dom.progressNode2, {
    complete: lookupDone,
    active: transferDone && !lookupDone,
  });

  setProgressNode(dom.progressNode3, {
    complete: auditDone,
    active: transferDone && lookupDone && !auditDone,
  });

  if (transferDone) {
    setStepCardState(dom.demoStep1Card, "complete");
    setStatusBadge(dom.demoStep1Badge, "Completed", "success");
    setResultBox(
      dom.demoTransferResult,
      `Transfer created successfully. Settlement ${state.transfer.settlement_reference} is linked to tx ${shortHash(state.transfer.txid)} and a demo blinding key is available for the audit path.`,
      "success",
    );
  } else if (state.transferError) {
    setStepCardState(dom.demoStep1Card, "error");
    setStatusBadge(dom.demoStep1Badge, "Error", "error");
    setResultBox(
      dom.demoTransferResult,
      state.transferError.message || "The transfer request failed.",
      "error",
    );
  } else {
    setStepCardState(dom.demoStep1Card, "current");
    setStatusBadge(dom.demoStep1Badge, "Current", "info");
    setResultBox(dom.demoTransferResult, "No transfer executed yet.");
  }

  if (lookupDone) {
    setStepCardState(dom.demoStep2Card, "complete");
    setStatusBadge(dom.demoStep2Badge, "Completed", "success");
    setResultBox(
      dom.demoLookupResult,
      `Lookup confirmed that tx ${shortHash(state.lookup.txid)} is confidential with ${state.lookup.confidentiality.blinded_output_count} blinded outputs.`,
      "success",
    );
  } else if (state.lookupError) {
    setStepCardState(dom.demoStep2Card, "error");
    setStatusBadge(dom.demoStep2Badge, "Error", "error");
    setResultBox(
      dom.demoLookupResult,
      state.lookupError.message || "The lookup request failed.",
      "error",
    );
  } else if (transferDone) {
    setStepCardState(dom.demoStep2Card, "current");
    setStatusBadge(dom.demoStep2Badge, "Current", "info");
    setResultBox(
      dom.demoLookupResult,
      "Step 2 is ready. Run the lookup to prove the linked Liquid outputs are confidential.",
      "info",
    );
  } else {
    setStepCardState(dom.demoStep2Card, "");
    setStatusBadge(dom.demoStep2Badge, "Locked", "neutral");
    setResultBox(
      dom.demoLookupResult,
      "Waiting for a transfer before running the Liquid lookup.",
    );
  }

  if (auditDone) {
    setStepCardState(dom.demoStep3Card, "complete");
    setStatusBadge(dom.demoStep3Badge, "Completed", "success");
    setResultBox(
      dom.demoAuditResult,
      `Audit returned Successful Match. The disclosure artifact matched the stored record and the revealed amount ${textOrDash(state.audit.revealed_amount)} aligned with IVMS101.`,
      "success",
    );
  } else if (state.auditError) {
    setStepCardState(dom.demoStep3Card, "error");
    setStatusBadge(dom.demoStep3Badge, "Error", "error");
    setResultBox(
      dom.demoAuditResult,
      state.auditError.message || "The audit request failed.",
      "error",
    );
  } else if (transferDone && lookupDone && latestBlindingKey) {
    setStepCardState(dom.demoStep3Card, "current");
    setStatusBadge(dom.demoStep3Badge, "Current", "info");
    setResultBox(
      dom.demoAuditResult,
      "Step 3 is ready. Run the regulator audit to show the case-specific disclosure path.",
      "info",
    );
  } else {
    setStepCardState(dom.demoStep3Card, "");
    setStatusBadge(dom.demoStep3Badge, "Locked", "neutral");
    setResultBox(
      dom.demoAuditResult,
      "Waiting for steps 1 and 2 before running the regulator audit.",
    );
  }

  dom.demoRunLookupBtn.disabled = !transferDone;
  dom.demoRunAuditBtn.disabled = !(
    transferDone &&
    lookupDone &&
    latestBlindingKey
  );

  dom.proofTransferText.textContent = transferDone
    ? `Settlement ${state.transfer.settlement_reference} was created and linked to tx ${shortHash(state.transfer.txid)}.`
    : "No transfer created yet.";

  dom.proofLookupText.textContent = lookupDone
    ? `${state.lookup.confidentiality.blinded_output_count} blinded outputs were detected and the transaction is confidential on Liquid Testnet.`
    : "No confidentiality lookup performed yet.";

  dom.proofAuditText.textContent = auditDone
    ? "The regulator path returned Successful Match using the txid plus the demo blinding key."
    : state.auditError?.message || "No audit disclosure executed yet.";
}

export function renderInspector() {
  responseTabButtons.forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.responseTab === state.responseTab,
    );
  });

  let title = "Transfer response";
  let hint = "Select a response category to inspect the latest backend output.";
  let payload = null;
  let badgeText = "Idle";
  let badgeTone = "neutral";
  const placeholder = "// No response available for this section yet.";

  if (state.responseTab === "transfer") {
    title = "Transfer response";

    if (state.transferError) {
      payload = state.transferError;
      hint =
        state.transferError.message ||
        "The last transfer attempt returned an error.";
      badgeText = "Error";
      badgeTone = "error";
    } else if (state.transfer) {
      payload = state.transfer;
      hint = `Settlement ${state.transfer.settlement_reference} linked to tx ${shortHash(state.transfer.txid)}.`;
      badgeText = "Stored";
      badgeTone = "success";
    } else {
      hint =
        "Submit a transfer to store IVMS101 off-chain and obtain a settlement reference.";
    }
  }

  if (state.responseTab === "lookup") {
    title = "Lookup response";

    if (state.lookupError) {
      payload = state.lookupError;
      hint =
        state.lookupError.message ||
        "The last lookup attempt returned an error.";
      badgeText = "Error";
      badgeTone = "error";
    } else if (state.lookup) {
      payload = state.lookup;
      hint = state.lookup.confidentiality
        ? `${state.lookup.confidentiality.blinded_output_count} blinded outputs detected for tx ${shortHash(state.lookup.txid)}.`
        : "Lookup completed.";
      badgeText = state.lookup.confidentiality?.is_confidential
        ? "Confidential"
        : "Completed";
      badgeTone = state.lookup.confidentiality?.is_confidential
        ? "success"
        : "warning";
    } else {
      hint = "Run the Liquid lookup to inspect on-chain confidentiality.";
    }
  }

  if (state.responseTab === "audit") {
    title = "Audit response";

    if (state.auditError) {
      payload = state.auditError;
      hint =
        state.auditError.message || "The last audit attempt returned an error.";
      badgeText = "Denied";
      badgeTone = "error";
    } else if (state.audit) {
      payload = state.audit;
      hint =
        state.audit.status === "Successful Match"
          ? "Stored artifact matched the disclosure input and IVMS101 amount."
          : "Audit completed with a non-match result.";
      badgeText = state.audit.status || "Completed";
      badgeTone =
        state.audit.status === "Successful Match" ? "success" : "warning";
    } else {
      hint = "Run the regulator audit to validate txid + disclosure material.";
    }
  }

  dom.responseTitle.textContent = title;
  dom.responseHint.textContent = hint;
  setStatusBadge(dom.responseBadge, badgeText, badgeTone);
  setJson(dom.responseJson, payload, placeholder);
}

export function renderChecklist() {
  if (state.health?.status === "ok") {
    setStatusBadge(dom.checkServiceBadge, "Ready", "success");
    dom.checkServiceText.textContent = `Backend is online and health was confirmed at ${formatDateTime(state.health.checkedAt)}.`;
  } else if (state.health?.status === "offline") {
    setStatusBadge(dom.checkServiceBadge, "Blocked", "error");
    dom.checkServiceText.textContent =
      state.health.error || "Backend is not reachable.";
  } else {
    setStatusBadge(dom.checkServiceBadge, "Pending", "neutral");
    dom.checkServiceText.textContent = "Health check pending.";
  }

  if (state.transfer) {
    setStatusBadge(dom.checkTransferBadge, "Ready", "success");
    dom.checkTransferText.textContent = `Settlement ${state.transfer.settlement_reference} created and linked to a Liquid txid.`;
  } else if (state.transferError) {
    setStatusBadge(dom.checkTransferBadge, "Failed", "error");
    dom.checkTransferText.textContent =
      state.transferError.message || "Latest transfer attempt failed.";
  } else {
    setStatusBadge(dom.checkTransferBadge, "Pending", "neutral");
    dom.checkTransferText.textContent = "No transfer created yet.";
  }

  if (state.lookup?.confidentiality) {
    setStatusBadge(dom.checkLookupBadge, "Ready", "success");
    dom.checkLookupText.textContent = `${state.lookup.confidentiality.blinded_output_count} blinded outputs confirmed on Liquid Testnet.`;
  } else if (state.lookupError) {
    setStatusBadge(dom.checkLookupBadge, "Failed", "error");
    dom.checkLookupText.textContent =
      state.lookupError.message || "Latest lookup attempt failed.";
  } else {
    setStatusBadge(dom.checkLookupBadge, "Pending", "neutral");
    dom.checkLookupText.textContent = "No Liquid lookup performed yet.";
  }

  if (state.audit?.status === "Successful Match") {
    setStatusBadge(dom.checkAuditBadge, "Ready", "success");
    dom.checkAuditText.textContent =
      "Regulator path returned Successful Match.";
  } else if (state.auditError) {
    setStatusBadge(dom.checkAuditBadge, "Failed", "error");
    dom.checkAuditText.textContent =
      state.auditError.message || "Latest audit attempt failed.";
  } else {
    setStatusBadge(dom.checkAuditBadge, "Pending", "neutral");
    dom.checkAuditText.textContent = "No audit run yet.";
  }
}

export function renderAll() {
  renderPresenterMode();
  renderViewMode();
  renderHealth();
  renderHeroStats();
  renderSession();
  renderDemo();
  renderInspector();
  renderChecklist();
  persistState();
}
