# BSOS Liquid Dual-Rail PoC  
  
A minimal proof of concept that validates a dual-rail compliance architecture for cross-border settlement.  
  
## Scope  
  
This PoC demonstrates:  
  
- an off-chain IVMS 101 data plane  
- a Liquid Testnet confidential settlement reference  
- a regulator audit flow based on `txid + blinding_key`  
  
## Tech stack  
  
- Node.js  
- Express  
- SQLite  
- Vanilla HTML/CSS/JS  
- Blockstream Esplora API for Liquid Testnet  
- Docker / Docker Compose  
  
## API endpoints  
  
### `POST /api/transfer`  
  
Receives simulated originator and beneficiary data, generates an IVMS 101 payload, stores it off-chain, and returns a configured Liquid Testnet transaction reference.  
  
### `GET /api/liquid/tx/:txid`  
  
Fetches the transaction from Esplora and returns a confidentiality summary showing whether outputs are blinded.  
  
### `POST /api/audit`  
  
Receives a `txid` and a `blinding_key`, validates the off-chain audit artifact, and confirms whether the disclosed amount matches the IVMS 101 record.  
  
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
  
## Configure a real Liquid Testnet transaction  
  
Set the following values in `.env`:  
  
- `DEMO_SETTLEMENT_TXID`  
- `DEMO_SETTLEMENT_OUTPUT_INDEX`  
  
The transaction must contain at least one confidential output.  
  
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
  
## Demo flow  
  
1. Submit `/api/transfer`  
2. Copy the returned `txid`  
3. Query `/api/liquid/tx/:txid`  
4. Copy the returned `blinding_key`  
5. Submit `/api/audit`  
  
## Docker  
  
```bash  
docker compose up --build  
```  
  
## Limitations  
  
- No real transaction signing or broadcasting  
- No real cryptographic unblinding  
- No production-grade IVMS 101 transport channel  
- No encryption-at-rest for PII  
  
This is intentionally a minimal architecture validation PoC.
