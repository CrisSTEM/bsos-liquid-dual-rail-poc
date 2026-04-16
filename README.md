# BSOS Liquid Dual-Rail PoC  
  
A minimal proof of concept that validates a dual-rail compliance architecture for cross-border settlement.  
  
## Scope  
  
This PoC demonstrates:  
  
- an off-chain IVMS 101-style data plane  
- a real Liquid Testnet confidential settlement reference  
- a regulator audit flow based on `txid + demo disclosure material`  
  
## Important architecture fidelity note  
  
This repository intentionally compresses multiple real-world roles into a single application server for demonstration purposes.  
  
In the target architecture described in the report:  
  
- customer-facing VASPs exchange Travel Rule data endpoint-to-endpoint  
- BSOS's settlement layer should ideally receive only batch-level settlement instructions  
- Liquid carries value  
- IVMS 101 carries identity  
  
In this PoC, those roles are simplified into one Express application so the demo can show the full flow on one screen.  
  
## What is real in this PoC  
  
- The app queries a **real confirmed Liquid Testnet transaction** from Esplora.  
- The configured transaction is checked for confidential outputs.  
- The off-chain IVMS payload and audit artifact are stored in SQLite.  
- Audit attempts are logged.  
  
## What is simulated in this PoC  
  
- `POST /api/transfer` **does not sign or broadcast** a new Liquid transaction.  
- The app links the off-chain transfer record to a preconfigured Liquid Testnet txid stored in `.env`.  
- The returned API field `blinding_key` is **demo-only disclosure material**. It is not a cryptographic Liquid output blinding private key.  
- No cryptographic unblinding is performed from Esplora data alone.  
- The downstream TRON / Pix off-ramp leg discussed in the report is out of scope for this repository.  
  
## Architecture mapping  
  
| Target architecture | PoC implementation | Note |  
|---|---|---|  
| Endpoint-to-endpoint IVMS 101 transmission | Single Express app simulates the off-chain data plane | Role-compressed for demo clarity |  
| Confidential Liquid settlement | App references a real confirmed Liquid Testnet confidential tx configured in `.env` | No in-app signing or broadcast yet |  
| Regulatory audit correlation | `txid + blinding_key` matched against stored artifact hash | Demo disclosure flow, not cryptographic unblinding |  
  
## API endpoints  
  
### `POST /api/transfer`  
  
Receives simulated originator and beneficiary data, generates an IVMS 101-style payload, stores it off-chain, and returns the configured Liquid Testnet transaction reference.  
  
### `GET /api/liquid/tx/:txid`  
  
Fetches the transaction from Esplora and returns a confidentiality summary showing whether outputs are blinded.  
  
### `POST /api/audit`  
  
Receives a `txid` and a `blinding_key`, validates the off-chain audit artifact, and confirms whether the disclosed amount matches the stored IVMS record.  
  
## What `/api/transfer` actually does  
  
The current flow is:  
  
1. validate the incoming payload  
2. read `DEMO_SETTLEMENT_TXID` and `DEMO_SETTLEMENT_OUTPUT_INDEX` from `.env`  
3. fetch that transaction from Esplora  
4. verify that the selected output is confidential  
5. create an off-chain transfer record in SQLite  
6. return the same txid as the settlement anchor for the demo session  
  
That means the frontend never signs or broadcasts a Liquid transaction. It only calls the backend APIs.  
  
## Requirements  
  
- Node.js 22+  
- npm  
- SQLite  
- Docker (optional)  
  
## Local setup  
  
```bash  
cp .env.example .env  
npm install  
npm run dev  
```  
  
Open:  
  
- `http://localhost:3000`  
- `http://localhost:3000/healthz`  
  
## Docker  
  
```bash  
docker compose up --build  
```  
  
## Configure a real Liquid Testnet transaction  
  
Set the following values in `.env`:  
  
- `DEMO_SETTLEMENT_TXID`  
- `DEMO_SETTLEMENT_OUTPUT_INDEX`  
  
The configured transaction must:  
  
- already exist on Liquid Testnet  
- be confirmed  
- contain at least one confidential output  
- use an output index that points to a blinded output  
  
## How to obtain a real txid for the demo  
  
The current repo does **not** create the transaction for you. The recommended workflow is:  
  
1. use a Liquid Testnet-compatible wallet or node  
2. create a confidential receive address  
3. fund the sending wallet with Liquid Testnet assets  
4. send a confidential self-transfer or transfer to another confidential address  
5. wait for confirmation  
6. inspect the tx on the Liquid Testnet explorer  
7. copy the txid and choose the blinded output index  
8. place those values in `.env`  
  
A self-transfer is enough for the demo as long as the transaction is real, confirmed, and contains a blinded output.  
  
## Validate the chosen output index  
  
Example validation:  
  
```bash  
source .env  
  
curl -s "$ESPLORA_BASE_URL/tx/$DEMO_SETTLEMENT_TXID" | jq '  
[  
  .vout  
  | to_entries[]  
  | {  
      index: .key,  
      is_blinded: (  
        .value.valuecommitment != null or  
        .value.assetcommitment != null or  
        .value.noncecommitment != null or  
        .value.rangeproof != null or  
        .value.surjectionproof != null  
      )  
    }  
]'  
```  
  
Pick an output where `is_blinded` is `true` and set that index as `DEMO_SETTLEMENT_OUTPUT_INDEX`.  
  
## Demo flow  
  
1. Load demo defaults in the UI  
2. Submit `POST /api/transfer`  
3. Copy the returned `txid`  
4. Query `GET /api/liquid/tx/:txid`  
5. Copy the returned demo `blinding_key`  
6. Submit `POST /api/audit`  
  
## Suggested wording for the demo / mentor review  
  
Use this exact clarification if needed:  
  
> This PoC uses a real confirmed Liquid Testnet confidential transaction as the settlement anchor. During the demo, the application creates the off-chain IVMS101 record and links it to that txid. The transaction itself is pre-existing and configured in `.env`; live signing and broadcasting are not yet implemented in the app.  
  
## Frontend note for the screen recording  
  
The default web UI is intentionally recording-first.  
  
It shows only one step at a time:  
  
1. create the off-chain transfer record  
2. inspect the linked Liquid transaction  
3. verify the audit flow  
  
This keeps the demo compact, avoids scrolling during the recording, and makes the proof sequence easier to follow.  
  
Technical JSON responses remain available in the hidden **Technical details** drawer.  
  
## Demo settlement note  
  
This PoC uses a real confirmed Liquid Testnet transaction configured in `.env` as the settlement anchor for the demo.  
  
The frontend does not broadcast a new transaction during the recording. It creates the off-chain compliance record, links it to the configured txid, verifies confidentiality via Esplora, and runs the demo audit match.  

## Limitations  
  
- No real transaction signing or broadcasting from the app  
- No real cryptographic unblinding  
- No production-grade IVMS 101 transport channel  
- No encryption-at-rest for PII  
- No role separation across multiple deployed institutions  
- No downstream TRON / Pix execution leg in this repository  
  
This is intentionally a minimal architecture validation PoC focused on the Liquid settlement reference, off-chain compliance linkage, and audit traceability.
