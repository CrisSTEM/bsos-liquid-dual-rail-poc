import { DEFAULT_FORM_STATE } from "./config.js";

const $ = (id) => document.getElementById(id);

export const fieldIds = Object.keys(DEFAULT_FORM_STATE);

const fieldEls = Object.fromEntries(fieldIds.map((id) => [id, $(id)]));

export const dom = {
  ...fieldEls,

  healthPill: $("healthPill"),
  loadDefaultsBtn: $("loadDefaultsBtn"),
  refreshHealthBtn: $("refreshHealthBtn"),
  resetSessionBtn: $("resetSessionBtn"),
  togglePresenterBtn: $("togglePresenterBtn"),

  heroServiceValue: $("heroServiceValue"),
  heroServiceMeta: $("heroServiceMeta"),
  heroSettlementValue: $("heroSettlementValue"),
  heroSettlementMeta: $("heroSettlementMeta"),
  heroConfValue: $("heroConfValue"),
  heroConfMeta: $("heroConfMeta"),
  heroAuditValue: $("heroAuditValue"),
  heroAuditMeta: $("heroAuditMeta"),

  sessionSettlement: $("sessionSettlement"),
  sessionTravelRule: $("sessionTravelRule"),
  sessionAmount: $("sessionAmount"),
  sessionTxid: $("sessionTxid"),
  sessionBlindingKey: $("sessionBlindingKey"),
  sessionAudit: $("sessionAudit"),
  copyTxidBtn: $("copyTxidBtn"),
  copyBlindingKeyBtn: $("copyBlindingKeyBtn"),

  demoView: $("demoView"),
  opsView: $("opsView"),
  switchToOpsBtn: $("switchToOpsBtn"),

  demoProgressLabel: $("demoProgressLabel"),
  demoProgressBar: $("demoProgressBar"),
  progressNode1: $("progressNode1"),
  progressNode2: $("progressNode2"),
  progressNode3: $("progressNode3"),

  demoStep1Card: $("demoStep1Card"),
  demoStep2Card: $("demoStep2Card"),
  demoStep3Card: $("demoStep3Card"),
  demoStep1Badge: $("demoStep1Badge"),
  demoStep2Badge: $("demoStep2Badge"),
  demoStep3Badge: $("demoStep3Badge"),

  demoOriginatorValue: $("demoOriginatorValue"),
  demoBeneficiaryValue: $("demoBeneficiaryValue"),
  demoAmountValue: $("demoAmountValue"),
  demoAssetValue: $("demoAssetValue"),
  demoLookupTxid: $("demoLookupTxid"),
  demoAuditRequester: $("demoAuditRequester"),
  demoAuditBlindingKey: $("demoAuditBlindingKey"),

  demoTransferResult: $("demoTransferResult"),
  demoLookupResult: $("demoLookupResult"),
  demoAuditResult: $("demoAuditResult"),

  proofTransferText: $("proofTransferText"),
  proofLookupText: $("proofLookupText"),
  proofAuditText: $("proofAuditText"),

  transferSubmitBtn: $("transferSubmitBtn"),
  lookupSubmitBtn: $("lookupSubmitBtn"),
  auditSubmitBtn: $("auditSubmitBtn"),
  useLatestLookupBtn: $("useLatestLookupBtn"),
  useLatestAuditBtn: $("useLatestAuditBtn"),
  demoRunTransferBtn: $("demoRunTransferBtn"),
  demoRunLookupBtn: $("demoRunLookupBtn"),
  demoRunAuditBtn: $("demoRunAuditBtn"),

  responseTitle: $("responseTitle"),
  responseHint: $("responseHint"),
  responseBadge: $("responseBadge"),
  responseJson: $("responseJson"),
  copyInspectorBtn: $("copyInspectorBtn"),

  checkServiceText: $("checkServiceText"),
  checkTransferText: $("checkTransferText"),
  checkLookupText: $("checkLookupText"),
  checkAuditText: $("checkAuditText"),
  checkServiceBadge: $("checkServiceBadge"),
  checkTransferBadge: $("checkTransferBadge"),
  checkLookupBadge: $("checkLookupBadge"),
  checkAuditBadge: $("checkAuditBadge"),

  toastContainer: $("toastContainer"),
};

export const viewButtons = Array.from(
  document.querySelectorAll("[data-view-button]"),
);

export const responseTabButtons = Array.from(
  document.querySelectorAll("[data-response-tab]"),
);

export { $ };
