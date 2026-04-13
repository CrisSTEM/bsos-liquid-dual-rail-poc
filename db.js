require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();

const rawDbPath = process.env.DB_PATH || "./data/app.db";
const DB_PATH = path.isAbsolute(rawDbPath)
  ? rawDbPath
  : path.join(__dirname, rawDbPath);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function hashBlindingKey(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hydrateTransfer(row) {
  if (!row) return null;

  return {
    ...row,
    ivms_payload: JSON.parse(row.ivms_payload_json),
    audit_artifact: JSON.parse(row.audit_artifact_json),
  };
}

async function initDb() {
  await run("PRAGMA journal_mode = WAL;");
  await run("PRAGMA foreign_keys = ON;");

  await run(`
    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      settlement_reference TEXT NOT NULL UNIQUE,
      txid TEXT NOT NULL,
      output_index INTEGER NOT NULL,
      originator_name TEXT NOT NULL,
      originator_document TEXT NOT NULL,
      beneficiary_name TEXT NOT NULL,
      beneficiary_wallet TEXT NOT NULL,
      amount TEXT NOT NULL,
      currency TEXT NOT NULL,
      asset_symbol TEXT NOT NULL,
      travel_rule_status TEXT NOT NULL,
      ivms_payload_json TEXT NOT NULL,
      audit_artifact_json TEXT NOT NULL,
      blinding_key_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      txid TEXT NOT NULL,
      requester TEXT NOT NULL,
      result TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_transfers_txid
    ON transfers(txid);
  `);

  await run(`
    CREATE INDEX IF NOT EXISTS idx_transfers_txid_blinding_key_hash
    ON transfers(txid, blinding_key_hash);
  `);
}

async function createTransferRecord(record) {
  await run(
    `
      INSERT INTO transfers (
        settlement_reference,
        txid,
        output_index,
        originator_name,
        originator_document,
        beneficiary_name,
        beneficiary_wallet,
        amount,
        currency,
        asset_symbol,
        travel_rule_status,
        ivms_payload_json,
        audit_artifact_json,
        blinding_key_hash,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `,
    [
      record.settlementReference,
      record.txid,
      record.outputIndex,
      record.originatorName,
      record.originatorDocument,
      record.beneficiaryName,
      record.beneficiaryWallet,
      record.amount,
      record.currency,
      record.assetSymbol,
      record.travelRuleStatus,
      JSON.stringify(record.ivms101Payload),
      JSON.stringify(record.auditArtifact),
      hashBlindingKey(record.blindingKey),
      record.createdAt,
    ],
  );
}

async function findTransferForAudit(txid, blindingKey) {
  const row = await get(
    `
      SELECT *
      FROM transfers
      WHERE txid = ? AND blinding_key_hash = ?
      ORDER BY id DESC
      LIMIT 1;
    `,
    [txid, hashBlindingKey(blindingKey)],
  );

  return hydrateTransfer(row);
}

async function logAuditAttempt({ txid, requester, result, reason = null }) {
  await run(
    `
      INSERT INTO audit_logs (txid, requester, result, reason, created_at)
      VALUES (?, ?, ?, ?, ?);
    `,
    [txid, requester, result, reason, new Date().toISOString()],
  );
}

module.exports = {
  initDb,
  createTransferRecord,
  findTransferForAudit,
  logAuditAttempt,
};
