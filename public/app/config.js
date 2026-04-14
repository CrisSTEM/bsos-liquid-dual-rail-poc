export const STORAGE_KEY = "bsosDualRailUiV3";

export const DEFAULT_FORM_STATE = {
  originatorName: "ACME Brasil Ltda",
  originatorDocumentNumber: "12.345.678/0001-99",
  originatorVaspId: "BSOS_BR",
  originatorCountry: "BR",
  beneficiaryName: "Taipei Supplier Co",
  beneficiaryWalletAddress: "tlq1qqexamplebeneficiarywallet000000000000",
  beneficiaryVaspId: "ASIA_PARTNER",
  beneficiaryCountry: "TW",
  transferAmount: "1250.75",
  transferCurrency: "USD",
  transferAssetSymbol: "L-USDt",
  transferPurpose: "Invoice INV-2026-0001",
  lookupTxid: "",
  auditTxid: "",
  auditBlindingKey: "",
  auditRequester: "BCB_DEMO",
};

export function createInitialState() {
  return {
    health: null,
    transfer: null,
    transferError: null,
    lookup: null,
    lookupError: null,
    audit: null,
    auditError: null,
    viewMode: "demo",
    responseTab: "transfer",
    presenterMode: false,
    form: { ...DEFAULT_FORM_STATE },
  };
}
