# ZKDrop — Privacy-First File Sharing on Aleo

![Aleo](https://img.shields.io/badge/Aleo-ZK--Powered-22c55e?style=for-the-badge)
![Leo 4.0](https://img.shields.io/badge/Leo-4.0.0-22c55e?style=for-the-badge)
![IPFS](https://img.shields.io/badge/IPFS-Decentralized-22c55e?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-4.5-blue?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge)

**Live:** [https://zkdrop-puce.vercel.app](https://zkdrop-puce.vercel.app)

---

## What Is ZKDrop?

ZKDrop is a decentralized file sharing platform built on Aleo — the first blockchain with privacy by default. Unlike traditional cloud storage (Google Drive, Dropbox, etc.), ZKDrop ensures that **file contents, access lists, and payment amounts are never public**. It is designed for users who want censorship-resistant, private file sharing without trusting a central server.

Think of it as a private IPFS with ZK-proof-based access control — you upload a file, set a price in Aleo Credits, and only the people you approve (or who pay) can decrypt and download it. Nobody — not even the platform — can see your files or who accesses them.

---

## Why Aleo?

Ethereum and Solana expose everything: wallet balances, transaction amounts, NFT metadata. Aleo changes this by using **zero-knowledge proofs** — you can prove something is true (e.g., "I own this file and paid for access") without revealing the underlying data. ZKDrop uses Aleo's private records (`FileRecord`, `AccessRecord`) to store sensitive data encrypted by the network itself, visible only to the intended owner.

| Platform | File Content | Access Lists | Payment Amounts | Metadata |
|----------|-------------|-------------|-----------------|----------|
| Google Drive | Visible to Google | Visible to Google | N/A | Fully public |
| IPFS + ENS | Public | Public | N/A | Public |
| Ethereum NFTs | Off-chain but enumerable | Public | Public | Public |
| **ZKDrop** | **Encrypted, off-chain** | **Private (hashed keys)** | **Private (via Aleo records)** | **Minimized** |

---

## What Does ZKDrop Do?

### Upload Files
Upload any file (up to 100MB). It gets encrypted client-side with AES-256-GCM, stored on IPFS, and registered on Aleo. The encryption key stays in your browser — nobody else can read the file.

### Share Files (Free or Paid)
Set a price in Aleo Credits (including $0 for free). Shareers browse files, pay if priced, and request access. Access grants are recorded on Aleo without revealing who accessed what.

### Manage Access
As an owner, you can revoke access, update the price, rename the file, or soft-delete it — all without revealing your files. The Aleo network verifies ownership via your private `FileRecord`.

### Download Files
When access is granted, the file is decrypted client-side using your locally stored key. The IPFS blob is fetched and decrypted in-browser — the decrypted content never leaves your device.

### QR Code Sharing
Share files via QR code (for the link or IPFS CID) — scan with any Aleo-compatible wallet.

---

## Core Features

### 🔒 AES-256-GCM Client-Side Encryption
Files are encrypted in the browser before upload. The encryption key is derived from the IPFS CID and stored in localStorage — it never touches the server or the blockchain. If you lose your browser data, you lose the key (and access to the file).

### 🌐 IPFS Decentralized Storage
Encrypted blobs are pinned to IPFS via Pinata. File content is content-addressed — the CID is derived from the encrypted data itself, making it tamper-proof and permanent.

### 🛡️ ZK Access Control via Aleo Records
Access grants are stored as private Aleo `AccessRecord` entries in the owner's wallet. Nobody can enumerate who has access because the access key is `sha256(file_id + address)` — a one-way hash. Only the file owner and granted user know the relationship.

### 💰 Aleo Credits + USAD Payments
Builtathon Rule 4 compliant. Payments use `credits.aleo` (testnet native token) or `usad_stablecoin.aleo` (USAD stablecoin). No third-party payment processors.

### ⏱️ Real-Time Transaction Tracking
ZKDrop tracks Aleo transactions through the full lifecycle:
1. Wallet returns a `shield_` local reference immediately
2. The wallet adapter polls `transactionStatus` until `status='accepted'`
3. The real `at1...` on-chain transaction ID is extracted from the response
4. `getTransaction` + `file_owners` mapping confirm the transaction settled
5. If the transaction is rejected (finalize failed), the user sees a specific error

For slow confirmations, the "Check Status Now" button lets users manually re-poll at any time.

### 📋 Local Registry with Pending State
All uploads are registered in browser localStorage. Files show in the dashboard immediately after upload — even before on-chain confirmation. If confirmation times out, the file stays in "pending" state so users never lose track of their uploads.

### 🔗 Wallet Support
Connect with Shield Wallet, Leo Wallet, Soter Wallet, or Puzzle Wallet. No custom setup needed — just click "Connect Wallet" and pick your preferred wallet.

### 📱 QR Code Sharing
Generate a QR code for the file link or the raw IPFS CID. Scan with any Aleo wallet for quick access.

---

## How It Works

### Upload Flow

```
1. User selects a file in the browser
2. File is encrypted with AES-256-GCM (key derived from CID, stored in localStorage)
3. Encrypted blob is POSTed to /api/upload → forwarded to Pinata → pinned to IPFS
4. Pinata returns the IPFS CID (Content Identifier)
5. Frontend computes:
     file_key = sha256(CID_bytes)[0..8] as u64   // RPC-compatible mapping key
     file_id  = sha256(CID_bytes) as field        // Aleo field literal
6. Frontend calls Aleo function upload_file(name, ipfs_hash, price, file_key, file_id, unix_ts)
     - Signs with wallet (Shield/Leo/Soter/Puzzle)
     - Attaches 2 Aleo credits as fee
     - Wallet returns shield_<timestamp>_<random> (local reference)
7. waitForOnChainConfirmation starts polling:
     a. Poll wallet.transactionStatus(shield_...) every 3s
     b. When status='accepted' → extract real at1... tx ID from response
     c. Call getTransaction(at1...) + check file_owners[file_key]
     d. If file_owners is set → confirmed ✅
        If tx on-chain but file_owners empty → rejected ❌
        If shield_ still pending → keep polling (up to ~90s)
8. IPFS CID + encryption key stored in localStorage
9. On success: user sees confirmation status + "View Dashboard" / "Upload Another"
```

### Access Flow

```
1. Requester browses files (loaded from Aleo mappings + local registry)
2. For paid files: payment via credits.aleo transfer_public
3. Requester calls request_access(file_key, file_id, ipfs_hash, file_name, access_key, unix_ts)
     - access_key = sha256(file_id + requester_address)[0..8] as u64
4. Aleo function increments file_counters[file_key] and sets access_grants[access_key] = 1
5. AccessRecord returned to requester's wallet (decrypted client-side)
6. Frontend fetches encrypted blob from IPFS
7. Decrypts with locally stored key
8. File is available to download
```

### Owner Management Flow

```
1. Owner opens file detail page (/file/[fileKey])
2. Frontend calls wallet.requestRecords(zkdrop_v4_0001.aleo, true)
3. Records are decrypted client-side by the wallet
4. Frontend finds the matching FileRecord (by file_id + file_key)
5. For each action (revoke, update_price, update_name, delete):
     - Frontend passes the FileRecord ciphertext as the last argument
     - Aleo asserts file_record.owner == self.caller (ZK proof of ownership)
     - The private record ensures only the real owner can call these functions
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-------------|---------|
| **Frontend** | Next.js 16, React 19, TypeScript | UI + API routes |
| **Styling** | Tailwind CSS 4, Framer Motion | Design & animations |
| **Blockchain** | Aleo testnet, Leo 4.0.0 contracts | Privacy logic + state |
| **Wallet SDK** | @provablehq/aleo-wallet-adaptor-react | Wallet connection |
| **Wallet Adapters** | Shield, Leo, Soter, Puzzle | Multi-wallet support |
| **RPC** | api.explorer.provable.com/v1 | On-chain queries |
| **Storage** | IPFS via Pinata | Decentralized file blobs |
| **Payments** | credits.aleo, usad_stablecoin.aleo | Token transfers |
| **Encryption** | WebCrypto AES-256-GCM | Client-side file encryption |

---

## Smart Contract

### Program: `zkdrop_v4_0002.aleo`

Deployed on Aleo testnet. Uses Leo 4.0.0 syntax — all functions use `fn` keyword with `final {}` blocks.

> **Performance Note:** `zkdrop_v4_0002` optimizes the `upload_file` function body to be minimal (FileRecord construction only). All heavy work (array slicing, 7 finalize mapping writes) runs in the finalize block — after the ZK proof is verified, with zero ZK overhead. This makes proof generation fast enough for Shield Wallet's hosted proving service. The original `zkdrop_v4_0001` had `name_short` slicing in the function body, causing ZK proof generation to timeout on Shield Wallet.

#### Records (Private)

| Record | Owner | Contents |
|--------|-------|-----------|
| `FileRecord` | Uploader | `owner`, `file_id`, `name`, `ipfs_hash`, `price`, `access_count`, `created_at`, `file_key` |
| `AccessRecord` | Requester | `owner`, `file_id`, `ipfs_hash`, `file_name`, `granted_at`, `expires_at`, `access_key` |

#### Mappings (Public)

| Mapping | Key | Value | Purpose |
|---------|-----|-------|---------|
| `file_counter` | `0u64` | u64 | Total number of uploaded files |
| `file_owners` | `file_key` | address | Owner address — confirms upload on-chain |
| `file_prices` | `file_key` | u64 | Price in microcredits |
| `file_counters` | `file_key` | u64 | Number of access requests |
| `file_names` | `file_key` | [u8; 32] | File name (first 32 bytes) for discovery |
| `file_created_at` | `file_key` | u32 | Block height at creation |
| `file_unix_ts` | `file_key` | u64 | Unix timestamp (set by frontend) |
| `access_grants` | `access_key` | u64 | 1 = granted, 0 = not granted |
| `access_granted_at` | `access_key` | u32 | Block height of access grant |

#### Contract Functions

```leo
// Upload a file. Returns FileRecord to the uploader. Finalize updates public mappings.
fn upload_file(name, ipfs_hash, price, file_key, file_id, unix_ts) -> (FileRecord, Final)

// Request access. Returns AccessRecord to the requester. Increments access counter.
fn request_access(file_key, file_id, ipfs_hash, file_name, access_key, unix_ts) -> (AccessRecord, Final)

// Revoke access. Requires FileRecord (proves ownership via ZK).
fn revoke_access(file_key, file_id, access_key, file_record) -> Final

// Update price. Requires FileRecord.
fn update_price(file_key, file_id, new_price, file_record) -> (FileRecord, Final)

// Soft-delete a file (sets price/counter to 0). Requires FileRecord.
fn delete_file(file_key, file_id, file_record) -> Final

// Update name. Requires FileRecord.
fn update_name(file_key, file_id, new_name, file_record) -> (FileRecord, Final)
```

#### Key Derivation (Must Match Between Frontend and Contract)

```typescript
// file_key: sha256 of the 64-byte IPFS CID representation, first 8 bytes as u64
// Used as the key for ALL Aleo mappings (file_owners, file_prices, etc.)
// Aleo RPC URL API requires u64 keys (field keys return 404)
const buf = await crypto.subtle.digest('SHA-256', ipfsBytes);
const fileKey = `${new DataView(buf).getBigUint64(0)}u64`;

// access_key: sha256 of file_id field literal + Aleo address, first 8 bytes as u64
// Nobody can enumerate access lists — keys are one-way hashes
const data = new TextEncoder().encode(fileId + address);
const buf = await crypto.subtle.digest('SHA-256', data);
const accessKey = `${new DataView(buf).getBigUint64(0)}u64`;
```

---

## Privacy Model

### Private (Aleo Records — only the holder can read)

- `FileRecord` — uploader's file metadata, IPFS CID, encryption key
- `AccessRecord` — requester's access proof
- IPFS decryption key — stored in localStorage, never sent anywhere
- `access_key` derivation — happens entirely client-side

### Public (Aleo Mappings — visible to anyone)

- File owner address — needed for buyers to discover files
- File price — needed for paid access
- File name (first 32 bytes) — needed for search/discovery
- Access grant exists for a hashed key — proves authorization without revealing identity
- Block heights and timestamps — not personally identifying

### Known Tradeoffs

- `file_owners` uses raw Aleo addresses. For full owner privacy, `sha256(owner)` would hide the owner.
- `transfer_public` used for payments — amounts are visible on-chain. For private payments, `transfer_private_to_public` on mainnet.
- IPFS CID is in the private `FileRecord`. Losing localStorage means losing access to the file. Users should back up their localStorage or use wallet-based key recovery.
- File enumeration is possible via `file_counter` + scanning `file_owners`. Private file listings require a separate indexing service.

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-repo/zkdrop.git
cd zkdrop
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local with:
#   - PINATA_JWT (from pinata.cloud — server-side only, NO NEXT_PUBLIC_ prefix)
#   - NEXT_PUBLIC_RPC_URL (default: https://api.explorer.provable.com/v1)
#   - NEXT_PUBLIC_ZKDROP_PROGRAM_ID (default: zkdrop_v4_0001.aleo)

# Run locally
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) — connect your Aleo wallet and start uploading.

---

## Environment Variables

```env
# Aleo Network Configuration
NEXT_PUBLIC_RPC_URL=https://api.explorer.provable.com/v1
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_CHAIN_ID=4

# Smart Contract (testnet)
NEXT_PUBLIC_ZKDROP_PROGRAM_ID=zkdrop_v4_0001.aleo
NEXT_PUBLIC_CREDITS_PROGRAM_ID=credits.aleo
NEXT_PUBLIC_USAD_PROGRAM_ID=usad_stablecoin.aleo

# IPFS (Pinata)
NEXT_PUBLIC_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
PINATA_JWT=your_pinata_jwt_here        # ← Server-side only! Do NOT prefix with NEXT_PUBLIC_
```

> **Security:** `PINATA_JWT` is used only in `/api/upload` (Next.js API route) and never reaches the browser. The `NEXT_PUBLIC_` prefix must NOT be used for it.

---

## Deploying the Contract

```bash
# Build the Leo contract
cd contracts/zkdrop_v2
leo build

# Deploy to testnet (requires Aleo CLI with funded account)
leo deploy \
  --private-key YOUR_PRIVATE_KEY \
  --network testnet \
  --endpoint https://api.explorer.provable.com/v1 \
  --broadcast --yes

# Update .env.local with the new program ID after deployment
```

---

## Project Structure

```
zkdrop/
├── contracts/zkdrop_v2/          # Leo 4.0.0 smart contract
│   ├── src/main.leo               # Contract source (records, mappings, functions)
│   ├── build/                     # Compiled .aleo bytecode + ABI (gitignored)
│   └── program.json              # Deployment manifest
│
├── src/
│   ├── app/                      # Next.js 16 App Router
│   │   ├── layout/               # Root layout + providers
│   │   ├── page.tsx              # Homepage
│   │   ├── upload/page.tsx      # Upload flow (IPFS + Aleo + wallet polling)
│   │   ├── files/page.tsx       # Browse all files
│   │   ├── file/[id]/page.tsx   # File detail + access + owner actions
│   │   ├── dashboard/page.tsx    # User dashboard (my files + activity)
│   │   ├── payments/page.tsx     # Credits + USAD transfers
│   │   ├── api/upload/route.ts  # Server-side IPFS proxy (JWT stays server-side)
│   │   └── globals.css           # Tailwind + custom styles
│   │
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Button, Card, Badge, Input, Spinner
│   │   └── wallet/               # QRCodeModal, WalletButton
│   │
│   └── lib/
│       ├── wallet.tsx             # ZKDropWalletProvider + useWallet hook
│       ├── aleo.ts              # Aleo config, fee constants, toMicro/fromMicro
│       ├── zkdrop.ts            # On-chain service layer
│       │                           # - waitForOnChainConfirmation (wallet polling)
│       │                           # - getFileOwner, getFilePrice, fileExists
│       │                           # - registerFile, getRegistry (localStorage)
│       │                           # - getUserFiles, getFileDetails
│       │                           # - hasAccess, getBalances
│       ├── ipfs.ts               # IPFS URL construction
│       ├── crypto.ts            # AES-256-GCM encrypt/decrypt, key storage
│       └── utils.ts             # toFixedLengthBytes, isWalletLocalTransactionId
│
├── public/                       # Static assets
├── .env.local                   # Local env overrides (JWT, RPC, program ID)
└── next.config.ts               # Security headers, image optimization
```

---

## Supported Networks

**Testnet** (current). Aleo testnet3 via `api.explorer.provable.com/v1`.

Mainnet-compatible — to deploy to mainnet:
1. Update `NEXT_PUBLIC_RPC_URL` to the mainnet RPC
2. Update `NEXT_PUBLIC_ZKDROP_PROGRAM_ID` to the mainnet program ID
3. Update payment program IDs to mainnet versions

## Supported Wallets

| Wallet | Adapter | Notes |
|--------|---------|-------|
| **Shield Wallet** | `@provablehq/aleo-wallet-adaptor-shield` | Recommended — best tx status polling |
| **Leo Wallet** | `@provablehq/aleo-wallet-adaptor-leo` | leo.provable.xyz browser extension |
| **Soter Wallet** | `@provablehq/aleo-wallet-adaptor-soter` | Soter secure wallet |
| **Puzzle Wallet** | `@provablehq/aleo-wallet-adaptor-puzzle` | Puzzle wallet |

Connect via the built-in modal — no configuration needed.

## License

MIT
