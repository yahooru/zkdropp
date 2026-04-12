# ZKDrop v4 — Privacy-First File Sharing on Aleo

![Aleo](https://img.shields.io/badge/Aleo-ZK--Powered-22c55e?style=for-the-badge)
![Leo 4.0](https://img.shields.io/badge/Leo-4.0.0-22c55e?style=for-the-badge)
![IPFS](https://img.shields.io/badge/IPFS-Decentralized-22c55e?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-4.5-blue?style=for-the-badge)

**Prove access. Reveal nothing.**

ZKDrop is a privacy-first decentralized file sharing platform. Files are AES-256-GCM encrypted client-side, stored on IPFS, access controlled via Aleo zero-knowledge proofs, and payments via Aleo Credits or USAD stablecoins.

**Live:** [https://zkdrop-puce.vercel.app](https://zkdrop-puce.vercel.app)

---

## How It Works

### Upload Flow

```
User Browser                                    Aleo Network              IPFS / Pinata
   │                                               │                        │
   ├── Select file                                 │                        │
   ├── AES-256-GCM encrypt (key stays local)      │                        │
   ├── POST /api/upload ────────────────────────────────────────────────►  Upload encrypted blob
   │                                               │                        │  returns CID
   ├── compute sha256(CID_bytes)                   │                        │
   │   file_key = sha256[0..8] as u64              │                        │
   │   file_id  = sha256(CID_bytes) as field       │                        │
   ├── call upload_file(                           │                        │
   │     name, ipfs_hash, price,                   │                        │
   │     file_key, file_id, unix_ts                 │                        │
   │     + fee (2 credits) ──────────────────────► │ Deploy to Aleo         │
   │                                               │                        │
   ├── Wallet returns shield_ ID (local ref)       │                        │
   │   Poll wallet.transactionStatus(shield_)       │                        │
   │   until status='accepted' → get real at1... ID │                        │
   │                                               │                        │
   ├── Poll file_owners[file_key] until set         │                        │
   │   + verify tx on-chain via getTransaction      │                        │
   │                                               │                        │
   ├── Store encryption key in localStorage         │                        │
   ├── Register in localStorage registry            │                        │
   └── Done (localStorage has metadata)             │                        │
                                                   │                        │
   Public Aleo mappings:                           │                        │
     file_owners[file_key] → address               │                        │
     file_prices[file_key] → u64                    │                        │
     file_names[file_key] → [u8; 32]               │                        │
```

### Access Flow

```
Requester Browser                               Aleo Network              IPFS
   │                                               │                        │
   ├── Browse files (from Aleo mappings)            │                        │
   ├── Click file → get fileKey + fileId            │                        │
   ├── For paid files: pay credits.aleo transfer    │                        │
   ├── call request_access(                         │                        │
   │     file_key, file_id, ipfs_hash,             │                        │
   │     file_name, access_key, unix_ts) ────────► │                        │
   ├── AccessRecord returned to wallet             │                        │
   ├── Frontend decrypts AccessRecord               │                        │
   ├── Fetch encrypted blob from IPFS ────────────────────────────────►   │
   ├── Decrypt with stored key                     │                        │
   └── Download file                               │                        │
```

### Key Design Decisions

| Concern | Solution |
|---------|----------|
| **File content privacy** | AES-256-GCM client-side encryption. Key never leaves browser. |
| **Access list privacy** | `access_key = sha256(file_id + address)[0..8]`. Nobody can enumerate who has access. |
| **Ownership proof** | Owner functions require the private `FileRecord` from the wallet — ZK proves you own it. |
| **Transaction tracking** | Shield wallet `transactionStatus` resolves `shield_` IDs to real `at1...` on-chain IDs. On-chain status verified via `getTransaction` + `file_owners` mapping. |
| **Pending vs confirmed** | If tx times out, file stays in local registry as "pending" — visible in dashboard. User can re-check status anytime via "Check Status Now". |
| **RPC latency** | Explorer API can be ~45 min behind latest block. Wallet adapter polling is the primary confirmation path for `shield_` IDs. |

---

## Features

| Feature | Description |
|---------|-------------|
| **AES-256-GCM Encryption** | Files encrypted client-side. Only the uploader has the key. |
| **IPFS Storage** | Encrypted blobs on IPFS via Pinata. Raw content never touches the chain. |
| **ZK Access Control** | Access grants via Aleo records. No enumeration possible. |
| **Per-User Hashed Keys** | `access_key = sha256(file_id + address)[0..8]` — nobody can enumerate access lists. |
| **FileRecord Ownership Proof** | Owner functions (`revoke`, `update_price`, `delete`, `update_name`) require the private FileRecord from the wallet. |
| **USAD + Credits Payments** | Buildathon Rule 4 compliant. |
| **QR Code Sharing** | Share via link or IPFS QR — scan with any wallet. |
| **Leo 4.0.0 syntax** | All functions use `fn` keyword, `final {}` blocks, and proper `owner: address` record fields. |
| **Wallet Transaction Polling** | Shields `shield_` local IDs are resolved via `transactionStatus` until the real `at1...` ID is returned. |
| **Manual Re-check** | "Check Status Now" button on upload success page lets users manually poll for confirmation. |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-------------|---------|
| **Frontend** | Next.js 16, React 19, TypeScript | UI |
| **Styling** | Tailwind CSS 4, Framer Motion | Design & animations |
| **Blockchain** | Aleo testnet, Leo 4.0.0 contracts | Privacy logic |
| **Wallet** | @provablehq/aleo-wallet-adaptor-react | Connection to Shield, Leo, Soter, Puzzle wallets |
| **RPC** | api.explorer.provable.com/v1 | On-chain queries (mappings, transactions, blocks) |
| **Storage** | IPFS via Pinata | Decentralized file blobs |
| **Payments** | credits.aleo, usad_stablecoin.aleo | Token transfers |

---

## Smart Contract

### Program: `zkdrop_v4_0001.aleo`

Deployed on testnet. All functions use Leo 4.0.0 syntax. Records are private — only the holder can read them.

#### Records

| Record | Owner | Contents |
|--------|-------|-----------|
| `FileRecord` | Uploader | `owner`, `file_id`, `name`, `ipfs_hash`, `price`, `access_count`, `created_at`, `file_key` |
| `AccessRecord` | Requester | `owner`, `file_id`, `ipfs_hash`, `file_name`, `granted_at`, `expires_at`, `access_key` |

#### Mappings (Public State)

| Mapping | Key → Value | Privacy |
|---------|-------------|---------|
| `file_counter` | `0u64` → count | Total file count |
| `file_owners` | `file_key` → address | Public discovery |
| `file_prices` | `file_key` → u64 | Public discovery |
| `file_counters` | `file_key` → u64 | Access statistics |
| `file_names` | `file_key` → [u8; 32] | Public discovery |
| `file_created_at` | `file_key` → u32 | Block height at upload |
| `file_unix_ts` | `file_key` → u64 | Unix timestamp from frontend |
| `access_grants` | `access_key` → u64 | 1 = granted, 0 = not granted |
| `access_granted_at` | `access_key` → u32 | Block height of grant |

#### Functions (Leo 4.0.0)

```leo
// Upload a file. Returns FileRecord to the uploader.
fn upload_file(name, ipfs_hash, price, file_key, file_id, unix_ts) -> (FileRecord, Final)

// Request access. Returns AccessRecord to the requester.
fn request_access(file_key, file_id, ipfs_hash, file_name, access_key, unix_ts) -> (AccessRecord, Final)

// Revoke access. Requires FileRecord (proves ownership).
fn revoke_access(file_key, file_id, access_key, file_record) -> Final

// Update price. Requires FileRecord (proves ownership).
fn update_price(file_key, file_id, new_price, file_record) -> (FileRecord, Final)

// Soft-delete a file. Requires FileRecord. IPFS content persists.
fn delete_file(file_key, file_id, file_record) -> Final

// Update name. Requires FileRecord (proves ownership).
fn update_name(file_key, file_id, new_name, file_record) -> (FileRecord, Final)
```

> **Note:** Owner functions (`revoke_access`, `update_price`, `update_name`, `delete_file`) require the FileRecord from the wallet. The frontend retrieves records via `requestRecords(programId, true)` from the wallet SDK.

#### Key Computation

All keys use SHA-256 (WebCrypto on frontend, matching Leo contract exactly):

```typescript
// file_key = sha256(ipfs_bytes)[0..8] as u64 — Aleo RPC URL API compatible
const buf = await crypto.subtle.digest('SHA-256', ipfsBytes);
const view = new DataView(buf);
const fileKey = `${view.getBigUint64(0)}u64`;

// access_key = sha256(file_id + address)[0..8] as u64
const data = new TextEncoder().encode(fileId + address);
const buf = await crypto.subtle.digest('SHA-256', data);
const accessKey = `${new DataView(buf).getBigUint64(0)}u64`;
```

---

## Supported Wallets

| Wallet | Adapter | Status |
|--------|---------|--------|
| **Shield Wallet** | `@provablehq/aleo-wallet-adaptor-shield` | Recommended |
| **Leo Wallet** | `@provablehq/aleo-wallet-adaptor-leo` | Supported |
| **Soter Wallet** | `@provablehq/aleo-wallet-adaptor-soter` | Supported |
| **Puzzle Wallet** | `@provablehq/aleo-wallet-adaptor-puzzle` | Supported |

Connect via the built-in wallet modal. No custom setup needed.

---

## Privacy Model

### Private (Aleo Records — only holder can decrypt)

- `FileRecord` contents — owner-only
- `AccessRecord` contents — requester-only
- IPFS decryption key — stored client-side in localStorage
- `access_key` derivation — server never sees the computation

### Public (Aleo Mappings — visible to all)

| Data | Why Public |
|------|------------|
| File owner address | Buyer discovery |
| File price | Bidirectional discovery |
| File name (first 32 bytes) | Search/discovery |
| Access grant exists for `access_key` | Proves authorization |
| Block heights | Not personally identifying |

### Known Tradeoffs

- `file_owners` uses raw addresses. For full owner privacy, use `sha256(owner)` instead.
- `transfer_public` used for credits/USAD transfers. For private payments, `transfer_private` or `transfer_public_to_private` on mainnet.
- IPFS content address (CID) is in the private FileRecord. Losing localStorage loses the CID. Backup recommended.
- File enumeration is public via the counter + owner address. For private listings, a separate indexing service is needed.

---

## Quick Start

```bash
git clone https://github.com/your-repo/zkdrop.git
cd zkdrop
npm install
cp .env.local.example .env.local
# Edit .env.local with your Pinata JWT and RPC URL
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

```env
# Aleo Network
NEXT_PUBLIC_RPC_URL=https://api.explorer.provable.com/v1
NEXT_PUBLIC_NETWORK=testnet

# Deployed Contract
NEXT_PUBLIC_ZKDROP_PROGRAM_ID=zkdrop_v4_0001.aleo

# Payments
NEXT_PUBLIC_CREDITS_PROGRAM_ID=credits.aleo
NEXT_PUBLIC_USAD_PROGRAM_ID=usad_stablecoin.aleo

# IPFS
NEXT_PUBLIC_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
PINATA_JWT=your_pinata_jwt_here
```

> **Important:** `PINATA_JWT` must NOT be prefixed with `NEXT_PUBLIC_` — it is used server-side only (via `/api/upload`) so it never reaches the browser.

---

## Building & Deployment

```bash
# Build contract
cd contracts/zkdrop_v2
leo build

# Deploy to testnet
leo deploy \
  --private-key YOUR_PRIVATE_KEY \
  --network testnet \
  --endpoint https://api.explorer.provable.com/v1 \
  --broadcast --yes
```

---

## File Structure

```
zkdrop/
├── contracts/zkdrop_v2/          # Leo 4.0.0 smart contract
│   ├── src/main.leo
│   ├── build/                    # Compiled .aleo bytecode + ABI
│   └── program.json
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── page.tsx               # Homepage
│   │   ├── upload/page.tsx        # Upload flow (IPFS + Aleo + polling)
│   │   ├── files/page.tsx         # Browse files
│   │   ├── file/[id]/page.tsx     # File detail + owner actions
│   │   ├── dashboard/page.tsx      # User dashboard
│   │   ├── payments/page.tsx       # Credits/USAD transfers
│   │   ├── api/upload/route.ts     # Server-side IPFS proxy (JWT stays server-side)
│   │   └── layout/providers       # Wallet + ZKDrop providers
│   ├── components/               # Reusable UI components
│   └── lib/
│       ├── wallet.tsx             # Wallet provider + hooks (shield_, Leo, Soter, Puzzle)
│       ├── aleo.ts                # Aleo config + constants
│       ├── zkdrop.ts             # On-chain service layer (polling, registry, mappings)
│       ├── ipfs.ts               # IPFS upload/download
│       ├── crypto.ts             # AES-256-GCM encryption
│       └── utils.ts              # Shared utilities (toFixedLengthBytes, isWalletLocalTransactionId)
├── .env.local                    # Local overrides (JWT, RPC, program ID)
└── next.config.ts               # Security headers + image optimization
```

---

## Supported Networks

Testnet (current). Mainnet-compatible — update RPC URL + program IDs to deploy.

## License

MIT
