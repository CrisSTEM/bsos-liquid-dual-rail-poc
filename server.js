require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const {
  initDb,
  createTransferRecord,
  findTransferForAudit,
  logAuditAttempt,
} = require("./db");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const ESPLORA_BASE_URL =
  process.env.ESPLORA_BASE_URL || "https://blockstream.info/liquidtestnet/api";
const DEMO_SETTLEMENT_TXID =
  process.env.DEMO_SETTLEMENT_TXID ||
  "REPLACE_WITH_REAL_CONFIDENTIAL_LIQUID_TESTNET_TXID";
const DEMO_SETTLEMENT_OUTPUT_INDEX = Number(
  process.env.DEMO_SETTLEMENT_OUTPUT_INDEX || 0,
);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPositiveDecimal(value) {
  return /^\d+(\.\d{1,8})?$/.test(value);
}

function buildSettlementReference() {
  const compactDate = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  return `SET-${compactDate}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function validateTransferPayload(body) {
  const payload = {
    originator: {
      name: asTrimmedString(body?.originator?.name),
      documentNumber: asTrimmedString(body?.originator?.documentNumber),
      vaspId: asTrimmedString(body?.originator?.vaspId || "BSOS_BR"),
      country: asTrimmedString(body?.originator?.country || "BR"),
    },
    beneficiary: {
      name: asTrimmedString(body?.beneficiary?.name),
      walletAddress: asTrimmedString(body?.beneficiary?.walletAddress),
      vaspId: asTrimmedString(body?.beneficiary?.vaspId || "ASIA_PARTNER"),
      country: asTrimmedString(body?.beneficiary?.country || "TW"),
    },
    transfer: {
      amount: asTrimmedString(body?.transfer?.amount),
      currency: asTrimmedString(body?.transfer?.currency || "USD"),
      assetSymbol: asTrimmedString(body?.transfer?.assetSymbol || "L-USDt"),
      purpose: asTrimmedString(body?.transfer?.purpose || "B2B settlement"),
    },
  };

  const errors = [];

  if (!payload.originator.name) errors.push("originator.name is required");
  if (!payload.originator.documentNumber) {
    errors.push("originator.documentNumber is required");
  }
  if (!payload.beneficiary.name) errors.push("beneficiary.name is required");
  if (!payload.beneficiary.walletAddress) {
    errors.push("beneficiary.walletAddress is required");
  }
  if (!payload.transfer.amount || !isPositiveDecimal(payload.transfer.amount)) {
    errors.push(
      "transfer.amount must be a positive decimal with up to 8 decimals",
    );
  }
  if (!payload.transfer.currency) errors.push("transfer.currency is required");
  if (!payload.transfer.assetSymbol)
    errors.push("transfer.assetSymbol is required");

  return { payload, errors };
}

function buildIvms101Payload(payload, settlementReference, txid) {
  return {
    schema: "IVMS101.2023",
    messageId: crypto.randomUUID(),
    settlementReference,
    routingContext: {
      model: "DUAL_RAIL",
      institutionalSettlementRail: "LIQUID_TESTNET",
      localBrazilOffRampRail: "TRON_PIX_STUB",
    },
    originatorVasp: {
      vaspId: payload.originator.vaspId,
      role: "ORIGINATING_VASP",
      country: payload.originator.country,
    },
    beneficiaryVasp: {
      vaspId: payload.beneficiary.vaspId,
      role: "BENEFICIARY_VASP",
      country: payload.beneficiary.country,
    },
    originator: {
      customerType: "LEGAL_PERSON",
      name: payload.originator.name,
      nationalIdentifier: {
        type: "BUSINESS_REGISTRATION_NUMBER",
        value: payload.originator.documentNumber,
        country: payload.originator.country,
      },
    },
    beneficiary: {
      customerType: "LEGAL_PERSON",
      name: payload.beneficiary.name,
      accountNumber: payload.beneficiary.walletAddress,
      country: payload.beneficiary.country,
    },
    transaction: {
      amount: payload.transfer.amount,
      fiatCurrency: payload.transfer.currency,
      virtualAssetSymbol: payload.transfer.assetSymbol,
      purpose: payload.transfer.purpose,
      onChainReference: txid,
    },
    createdAt: new Date().toISOString(),
  };
}

async function fetchLiquidTransaction(txid) {
  const response = await fetch(
    `${ESPLORA_BASE_URL}/tx/${encodeURIComponent(txid)}`,
    {
      headers: { accept: "application/json" },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(
      `Esplora request failed: ${response.status} ${body}`,
    );
    error.statusCode = response.status;
    throw error;
  }

  return response.json();
}

function outputIsBlinded(output = {}) {
  return Boolean(
    output.valuecommitment ||
    output.assetcommitment ||
    output.noncecommitment ||
    output.rangeproof ||
    output.surjectionproof,
  );
}

function summarizeConfidentiality(tx) {
  const outputs = Array.isArray(tx?.vout) ? tx.vout : [];

  const blindedOutputs = outputs
    .map((output, index) => ({
      index,
      is_blinded: outputIsBlinded(output),
      valuecommitment: output.valuecommitment || null,
      assetcommitment: output.assetcommitment || null,
      noncecommitment: output.noncecommitment || null,
      has_rangeproof: Boolean(output.rangeproof),
      has_surjectionproof: Boolean(output.surjectionproof),
      scriptpubkey_type: output.scriptpubkey_type || null,
      scriptpubkey_address: output.scriptpubkey_address || null,
      explicit_value: output.value ?? null,
      explicit_asset: output.asset ?? null,
    }))
    .filter((output) => output.is_blinded);

  return {
    txid: tx?.txid || null,
    confirmed: Boolean(tx?.status?.confirmed),
    is_confidential: blindedOutputs.length > 0,
    blinded_output_count: blindedOutputs.length,
    blinded_outputs: blindedOutputs,
  };
}

app.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    service: "bsos-liquid-dual-rail-poc",
    esplora: ESPLORA_BASE_URL,
  });
});

app.post("/api/transfer", async (req, res, next) => {
  try {
    if (DEMO_SETTLEMENT_TXID.startsWith("REPLACE_WITH_")) {
      return res.status(500).json({
        error: "demo_txid_not_configured",
        message:
          "Set DEMO_SETTLEMENT_TXID in .env to a real Liquid Testnet transaction with confidential outputs.",
      });
    }

    const { payload, errors } = validateTransferPayload(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        error: "validation_error",
        details: errors,
      });
    }

    const settlementReference = buildSettlementReference();
    const blindingKey = crypto.randomBytes(32).toString("hex");

    const chainTx = await fetchLiquidTransaction(DEMO_SETTLEMENT_TXID);
    const confidentiality = summarizeConfidentiality(chainTx);
    const selectedOutput = chainTx?.vout?.[DEMO_SETTLEMENT_OUTPUT_INDEX];

    if (!selectedOutput) {
      return res.status(422).json({
        error: "invalid_demo_output_index",
        message: `DEMO_SETTLEMENT_OUTPUT_INDEX=${DEMO_SETTLEMENT_OUTPUT_INDEX} does not exist in the configured transaction.`,
      });
    }

    if (!outputIsBlinded(selectedOutput)) {
      return res.status(422).json({
        error: "demo_tx_not_confidential",
        message:
          "The selected output is not blinded. Use a real Liquid Testnet txid with confidential commitments.",
      });
    }

    const ivms101Payload = buildIvms101Payload(
      payload,
      settlementReference,
      DEMO_SETTLEMENT_TXID,
    );

    const auditArtifact = {
      txid: DEMO_SETTLEMENT_TXID,
      outputIndex: DEMO_SETTLEMENT_OUTPUT_INDEX,
      revealedAmount: payload.transfer.amount,
      revealedAsset: payload.transfer.assetSymbol,
      disclosureMode: "SIMULATED_CASE_SPECIFIC_UNBLINDING",
      createdAt: new Date().toISOString(),
    };

    await createTransferRecord({
      settlementReference,
      txid: DEMO_SETTLEMENT_TXID,
      outputIndex: DEMO_SETTLEMENT_OUTPUT_INDEX,
      originatorName: payload.originator.name,
      originatorDocument: payload.originator.documentNumber,
      beneficiaryName: payload.beneficiary.name,
      beneficiaryWallet: payload.beneficiary.walletAddress,
      amount: payload.transfer.amount,
      currency: payload.transfer.currency,
      assetSymbol: payload.transfer.assetSymbol,
      travelRuleStatus: "SENT_DIRECT_VASP_TO_VASP_SIMULATED",
      ivms101Payload,
      auditArtifact,
      blindingKey,
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json({
      message:
        "Transfer simulated successfully. IVMS 101 was stored off-chain and linked to a Liquid settlement reference.",
      settlement_reference: settlementReference,
      txid: DEMO_SETTLEMENT_TXID,
      output_index: DEMO_SETTLEMENT_OUTPUT_INDEX,
      ivms101_message_id: ivms101Payload.messageId,
      travel_rule_status: "SENT_DIRECT_VASP_TO_VASP_SIMULATED",
      confidentiality_check: {
        is_confidential: confidentiality.is_confidential,
        blinded_output_count: confidentiality.blinded_output_count,
      },
      ivms101: ivms101Payload,
      regulator_demo: {
        blinding_key: blindingKey,
        warning:
          "Demo only. In production this disclosure material must travel through a secure case-management channel.",
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/liquid/tx/:txid", async (req, res, next) => {
  try {
    const tx = await fetchLiquidTransaction(req.params.txid);
    const confidentiality = summarizeConfidentiality(tx);

    return res.json({
      txid: req.params.txid,
      confidentiality,
      raw: tx,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/audit", async (req, res, next) => {
  const txid = asTrimmedString(req.body?.txid);
  const blindingKey = asTrimmedString(req.body?.blinding_key);
  const requester = asTrimmedString(req.body?.requester || "REGULATOR_DEMO");

  if (!txid || !blindingKey) {
    return res.status(400).json({
      error: "validation_error",
      message: "txid and blinding_key are required.",
    });
  }

  try {
    const tx = await fetchLiquidTransaction(txid);
    const confidentiality = summarizeConfidentiality(tx);

    if (!confidentiality.is_confidential) {
      await logAuditAttempt({
        txid,
        requester,
        result: "REJECTED",
        reason: "tx_has_no_blinded_outputs",
      });

      return res.status(422).json({
        error: "non_confidential_tx",
        message:
          "The requested transaction does not expose confidential outputs.",
      });
    }

    const record = await findTransferForAudit(txid, blindingKey);

    if (!record) {
      await logAuditAttempt({
        txid,
        requester,
        result: "NOT_FOUND",
        reason: "no_matching_txid_and_blinding_key",
      });

      return res.status(404).json({
        error: "audit_artifact_not_found",
        message:
          "No audit artifact matched the provided txid and blinding_key.",
      });
    }

    const amountMatches =
      record.audit_artifact.revealedAmount ===
      record.ivms_payload.transaction.amount;

    const assetMatches =
      record.audit_artifact.revealedAsset ===
      record.ivms_payload.transaction.virtualAssetSymbol;

    if (!amountMatches || !assetMatches) {
      await logAuditAttempt({
        txid,
        requester,
        result: "MISMATCH",
        reason: "audit_artifact_does_not_match_ivms_payload",
      });

      return res.status(409).json({
        status: "Mismatch",
        txid,
        settlement_reference: record.settlement_reference,
        details: {
          ivms_amount: record.ivms_payload.transaction.amount,
          revealed_amount: record.audit_artifact.revealedAmount,
          ivms_asset: record.ivms_payload.transaction.virtualAssetSymbol,
          revealed_asset: record.audit_artifact.revealedAsset,
        },
      });
    }

    await logAuditAttempt({
      txid,
      requester,
      result: "MATCH",
      reason: "blinding_key_valid_and_amount_matches_ivms",
    });

    return res.json({
      status: "Successful Match",
      settlement_reference: record.settlement_reference,
      txid,
      ivms101_message_id: record.ivms_payload.messageId,
      originator: record.originator_name,
      beneficiary: record.beneficiary_name,
      ivms101_amount: record.ivms_payload.transaction.amount,
      revealed_amount: record.audit_artifact.revealedAmount,
      asset_symbol: record.audit_artifact.revealedAsset,
      output_index: record.output_index,
      blockchain_confidentiality: confidentiality,
      audit_explanation:
        "This PoC does not perform cryptographic unblinding from Esplora data alone. It validates the blinding key against an off-chain hash and uses the stored audit artifact as a proxy for case-specific disclosure.",
    });
  } catch (error) {
    next(error);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(err.statusCode || 500).json({
    error: "internal_error",
    message: err.message || "Unexpected internal error.",
  });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
      console.log(`Esplora base URL: ${ESPLORA_BASE_URL}`);

      if (DEMO_SETTLEMENT_TXID.startsWith("REPLACE_WITH_")) {
        console.warn(
          "WARNING: DEMO_SETTLEMENT_TXID is not configured. /api/transfer will fail until .env is set.",
        );
      }
    });
  })
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
