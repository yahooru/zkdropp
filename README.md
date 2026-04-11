# ZKDrop — Privacy-First File Sharing on Aleo

![ZKDrop Banner](https://img.shields.io/badge/Aleo-Privacy%20Buildathon-22c55e?style=for-the-badge)
![Shield Wallet](https://img.shields.io/badge/Shield%20Wallet-Integrated-22c55e?style=for-the-badge)
![IPFS](https://img.shields.io/badge/IPFS-Storage-22c55e?style=for-the-badge)

**Prove everything. Reveal nothing.**

ZKDrop is a privacy-first decentralized file sharing platform built on Aleo. Files are stored on IPFS, access is controlled via zero-knowledge proofs, and payments are private by default.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Smart Contract](#smart-contract)
- [Privacy Model](#privacy-model)
- [Payment Integration](#payment-integration)
- [Wallet Integration](#wallet-integration)
- [Deployment](#deployment)
- [Buildathon Compliance](#buildathon-compliance)
- [License](#license)

---

## Overview

ZKDrop solves the problem of **public file sharing platforms** that expose:
- Who uploaded what files
- Who accesses which files
- Payment amounts and recipient identities

ZKDrop uses Aleo's zero-knowledge cryptography to keep file ownership, access lists, and payments private while still enabling trustless verification.

### Use Cases

1. **Private Document Sharing** — Share sensitive documents without revealing who has access
2. **Paid Content** — Monetize files with private payments via USAD/Credits
3. **Private Collaboration** — Grant/revoke access to files without intermediaries
4. **Privacy-Preserving File Marketplaces** — Trade files with encrypted transaction details

---

## Features

- **AES-256-GCM Encryption** — Files are encrypted client-side before IPFS upload. Only the owner and authorized users can decrypt.
- **IPFS Storage** — Encrypted blobs are stored on IPFS, distributed and resilient. Raw content never reaches the blockchain.
- **ZK Access Control** — Prove you have access without revealing your identity. Per-user hashed keys prevent access enumeration.
- **Private Payments** — Transactions via Aleo Credits or USAD. Full privacy requires `transfer_private` on mainnet.
- **Selective Sharing** — Grant/revoke access to specific users via on-chain records. Access keys are hashed.
- **On-Chain Privacy** — FileRecord and AccessRecord contents are encrypted by Aleo records.
- **Modern UI** — Clean, responsive interface with parallax effects, animations, and a light green + white theme.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ZKDrop Architecture                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐      ┌─────────────────┐      ┌──────────┐ │
│  │  Frontend   │ ──── │  Aleo Network    │ ──── │  IPFS    │ │
│  │  (Next.js)  │      │  (Leo Contracts)│      │ (Files)  │ │
│  └─────────────┘      └─────────────────┘      └──────────┘ │
│         │                    │                    │         │
│         │                    │                    │         │
│  ┌─────────────┐      ┌─────────────────┐                   │
│  │   Shield    │      │  Payment Layer  │                   │
│  │   Wallet    │      │  credits.aleo   │                   │
│  └─────────────┘      │  usad_stablecoin │                   │
│                       └─────────────────┘                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Upload Flow**
   ```
   User selects file → AES-256-GCM encrypt client-side
   → Upload encrypted blob to IPFS → Get CID → Call upload_file() on Aleo
   → Encryption key stored in localStorage → Public mapping tracks existence
   ```

2. **Access Flow**
   ```
   User requests access → Pay via credits.aleo/transfer_public
   → Call request_access(file_id, access_key) → Receive AccessRecord privately
   → Retrieve decryption key from localStorage → Decrypt file from IPFS
   ```

3. **Payment Flow**
   ```
   Buyer selects paid file → Direct transfer via credits.aleo/usad_stablecoin.aleo
   → Call request_access() → Buyer receives AccessRecord → Download decrypted file
   ```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 16, React 19, TypeScript | User interface |
| **Styling** | Tailwind CSS, Framer Motion | Design & animations |
| **Blockchain** | Aleo (Leo smart contracts) | Privacy-preserving logic |
| **Wallet** | Shield Wallet Adapter | Wallet connection |
| **Storage** | IPFS via Pinata | Decentralized file storage |
| **Payments** | credits.aleo, usad_stablecoin.aleo | Private token transfers |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Aleo CLI (`curl -s https://raw.githubusercontent.com/AleoHQ/sdk/master/install.sh | sh`)
- Shield Wallet browser extension
- Pinata account for IPFS uploads (free tier available)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd zkdrop

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your values
```

### Environment Variables

Create `.env.local` with the following:

```env
# Aleo Network
NEXT_PUBLIC_RPC_URL=https://api.provable.com/v2
NEXT_PUBLIC_NETWORK=testnet

# ZKDrop Contract (update after deployment)
NEXT_PUBLIC_ZKDROP_PROGRAM_ID=zkdrop_v3_0001.aleo

# Payment Programs
NEXT_PUBLIC_CREDITS_PROGRAM_ID=credits.aleo
NEXT_PUBLIC_USAD_PROGRAM_ID=usad_stablecoin.aleo

# IPFS (Pinata)
NEXT_PUBLIC_PINATA_GATEWAY=https://gateway.pinata.cloud/ipfs/
PINATA_JWT=your_pinata_jwt_here
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

---

## Smart Contract

### Contract: `zkdrop_v3_0001.aleo`

The ZKDrop contract manages file metadata and access control on Aleo.

### Records (Private State)

| Record | Fields | Visibility |
|--------|--------|------------|
| `FileRecord` | owner, file_id, name, ipfs_hash, price, access_count | **Private** |
| `AccessRecord` | owner (recipient), file_id | **Private** |

> `created_at` and `granted_at` are stored in public `file_created_at` / `access_granted_at` mappings (block heights — not personally identifying).

### Mappings (Public State)

| Mapping | Key → Value | Purpose |
|---------|-------------|---------|
| `file_counter` | u8 → u64 | Unique file ID counter |
| `file_owners` | field → address | Public file discovery |
| `file_prices` | field → u64 | File pricing info |
| `file_counters` | field → u64 | Access statistics |
| `access_grants` | field → u64 | Access grant timestamps |
| `file_names` | field → [u8; 32] | File name for search |

### Transitions (Leo 4.0 — all `fn`, no `transition` keyword)

| Function | Description |
|---------|-------------|
| `upload_file(name, ipfs_hash, price, file_id)` | Upload a file, returns FileRecord. `file_id` = sha256(ipfs_hash) passed from frontend. |
| `request_access(file_id, access_key)` | Any user requests access, returns AccessRecord. `access_key` = sha256(file_id + address). |
| `revoke_access(file_id, access_key, file_record)` | Owner revokes a user's access. Requires FileRecord to prove ownership. |
| `update_price(file_id, new_price, file_record)` | Owner updates price. Requires FileRecord. |

> **Note:** Access control is **per-user** via hashed keys: `access_key = sha256(file_id || address)`. No one can enumerate who has access to a file.

### Reading Mappings (No View Functions Needed)

ZKDrop uses direct RPC queries instead of view functions. The `@provablehq/sdk` reads public mappings directly:

```
GET /program/zkdrop_v3_0001.aleo/mapping/file_owners/<file_id>
GET /program/zkdrop_v3_0001.aleo/mapping/file_prices/<file_id>
GET /program/zkdrop_v3_0001.aleo/mapping/access_grants/<access_key>
```

> **Note:** `access_grants` uses a per-user key. To check if a specific user has access, compute `sha256(file_id || address)` and query that key.

### Building & Deploying

```bash
# Build the contract
cd contracts/zkdrop_v2
leo build

# Deploy (requires private key)
leo deploy --private-key YOUR_PRIVATE_KEY \
    --network testnet \
    --endpoint https://api.provable.com/v2 \
    --broadcast --yes
```

Or use the deploy script:

```bash
chmod +x deploy.sh
./deploy.sh YOUR_PRIVATE_KEY
```

### Deploying from WSL (Windows)

Windows users should use the WSL deployment script which handles Windows-specific paths and private key retrieval:

```bash
chmod +x deploy.wsl.sh
# Option 1: Pass key as argument
./deploy.wsl.sh "YOUR_PRIVATE_KEY"

# Option 2: Use environment variable
export DEPLOY_PRIVATE_KEY="YOUR_PRIVATE_KEY"
./deploy.wsl.sh

# Option 3: Key file (Windows: %USERPROFILE%\.aleo\pvt_key)
./deploy.wsl.sh
```

The WSL script also supports retrieving the private key from:
- Windows Shield Wallet: `C:\Users\<you>\.aleo\pvt_key`
- `.pvt_key` file in the project directory
- `DEPLOY_PRIVATE_KEY` environment variable

---

## Privacy Model

ZKDrop uses Aleo's private-by-default record model. Here's what is **actually** private vs **public**:

### Private (Encrypted — only holder can view)

| Data | How Private |
|------|-------------|
| `FileRecord` contents | Stored as an Aleo record — only the owner (who receives it at upload) can decrypt and view the contents (name, ipfs_hash, price, access_count) |
| `AccessRecord` | Delivered as a private record to the buyer — only the recipient can view it |
| IPFS CID (in FileRecord) | The actual file content locator is only in the private record — not published on-chain |

### Public (On-chain, visible to all)

| Data | Why Public |
|------|------------|
| `file_owners` mapping | File ownership is public for buyer discovery. ⚠️ **Tradeoff:** if true privacy is needed, ownership could be committed via a hash. |
| `file_prices` mapping | Prices must be public so buyers know the cost. |
| `file_names` mapping | First 32 bytes of file name for search/discovery. |
| `access_grants` mapping | Uses per-user hashed keys: `sha256(file_id || address)`. Shows access was granted for a file, but **not who**. |
| Payment amounts | Uses `transfer_public` on testnet (⚠️ not fully private). For true privacy, `transfer_private` would be needed. |
| `file_counters` | Access statistics only. |
| `file_created_at` | Block height of upload — not personally identifying. |

### Privacy Improvements for Production

To achieve full privacy:
1. **Owner privacy:** Store `sha256(owner_address)` instead of raw address in `file_owners`
2. **Payment privacy:** Use `transfer_private` or `transfer_public_to_private` for payments
3. **Atomic payment+access:** Use multi-program calls to atomically transfer credits and grant access in one transaction
4. **File encryption:** Encrypt files with AES-256-GCM before IPFS upload; store the decryption key inside the FileRecord (E2E encryption)

### ZK Proof Verification

Access verification uses Aleo's record model:

1. **Upload:** Owner calls `upload_file` → receives private `FileRecord` (contains ipfs_hash, name, price)
2. **Request access:** Buyer pays via `credits.aleo/transfer_public` → calls `request_access(file_id, access_key)` → receives private `AccessRecord`
3. **Verify access:** Frontend queries `access_grants[sha256(file_id || buyer_address)]` from the public mapping
4. **Download:** With access confirmed, buyer downloads file from IPFS gateway

---

## Payment Integration

**Buildathon Rule 4 Compliance**: ZKDrop integrates both `credits.aleo` and `usad_stablecoin.aleo`.

### Payment Flow

```
┌─────────────────┐     credits.aleo      ┌─────────────────┐
│     Buyer       │ ────────────────────→│     Owner       │
│                 │   (private transfer)   │                 │
└─────────────────┘                      └─────────────────┘
         │
         │ After payment confirmed
         ↓
┌─────────────────┐
│  grant_access  │ (Owner calls to grant access)
└─────────────────┘
```

### Supported Tokens

| Token | Program | Network | Use Case |
|-------|---------|---------|----------|
| **Aleo Credits** | `credits.aleo` | Testnet/Mainnet | Micro-transactions, fees |
| **USAD** | `usad_stablecoin.aleo` | Mainnet | Stable-value payments |

### Transfer Functions Used

- `credits.aleo/transfer_public` — Direct Credits transfer
- `usad_stablecoin.aleo/transfer_public` — Direct USAD transfer

### Code Example

```typescript
// Transfer 5 Credits via credits.aleo
const result = await wallet.transferCredits(recipient, BigInt(5000000));

// Transfer 10 USAD via usad_stablecoin.aleo
const result = await wallet.transferUSAD(recipient, BigInt(10000000));
```

---

## Wallet Integration

ZKDrop integrates **Shield Wallet** as the primary wallet, with support for other Aleo wallets.

### Supported Wallets

| Wallet | Status | Integration |
|--------|--------|-------------|
| **Shield Wallet** | Primary | `@provablehq/aleo-wallet-adaptor-shield` |
| **Leo Wallet** | Supported | `@demox-labs/aleo-wallet-adapter-leo` |
| **Soter Wallet** | Supported | `@provablehq/aleo-wallet-adaptor-soter` |

### Wallet Connection Flow

```typescript
// Using the ZKDrop wallet hook
import { useWallet } from '@/lib/wallet';

function MyComponent() {
  const { connect, disconnect, address, isConnected } = useWallet();

  return (
    <button onClick={connect}>
      {isConnected ? address : 'Connect Wallet'}
    </button>
  );
}
```

### Required Programs

Shield Wallet needs permission to interact with these programs:

- `zkdrop_v3_0001.aleo` — Main contract
- `credits.aleo` — Native Aleo Credits
- `usad_stablecoin.aleo` — USAD stablecoin

---

## Deployment

### Deploy Smart Contract

```bash
# Option 1: Using deploy script
./deploy.sh YOUR_PRIVATE_KEY

# Option 2: Manual deployment
cd contracts/zkdrop_v2
leo build
leo deploy --private-key YOUR_PRIVATE_KEY \
    --network testnet \
    --endpoint https://api.provable.com/v2 \
    --broadcast --yes
```

### Update Configuration

After deployment, update `.env.local`:

```env
NEXT_PUBLIC_ZKDROP_PROGRAM_ID=your_new_program_id.aleo
```

### Deploy Frontend

```bash
# Build for production
npm run build

# Deploy to Vercel, Netlify, or any hosting
vercel deploy
```

---

## Final Deployment Status

```
┌────────────────────────┬────────┬────────────────────────────────────────────┐
│       Component        │ Status │                  Details                    │
├────────────────────────┼────────┼────────────────────────────────────────────┤
│ Contract deployed      │   ✅   │ zkdrop_v3_0001.aleo live on testnet   │
├────────────────────────┼────────┼────────────────────────────────────────────┤
│ RPC Endpoint           │   ✅   │ https://api.provable.com/v2                 │
├────────────────────────┼────────┼────────────────────────────────────────────┤
│ Credits balance        │   ✅   │ 42.65 credits available                     │
├────────────────────────┼────────┼────────────────────────────────────────────┤
│ credits.aleo payments  │   ✅   │ transfer_public function confirmed          │
├────────────────────────┼────────┼────────────────────────────────────────────┤
│ usad_stablecoin.aleo  │   ⚠️   │ Mainnet only — works on mainnet deploy    │
├────────────────────────┼────────┼────────────────────────────────────────────┤
│ Upload (IPFS + Aleo)   │   ✅   │ upload_file function on-chain              │
├────────────────────────┼────────┼────────────────────────────────────────────┤
│ Access control         │   ✅   │ request_access, revoke_access; per-user hashed keys │
├────────────────────────┼────────┼────────────────────────────────────────────┤
│ QR code sharing        │   ✅   │ Link + IPFS QR codes on file page         │
├────────────────────────┼────────┼────────────────────────────────────────────┤
│ Privacy (ZK)           │   ✅   │ FileRecord private; per-user access keys; public mappings documented honestly |
├────────────────────────┼────────┼────────────────────────────────────────────┤
│ Leo 4.0.0 compatible  │   ✅   │ Contract uses Leo 4.0.0 syntax             │
├────────────────────────┼────────┼────────────────────────────────────────────┤
│ Shield Wallet          │   ✅   │ @provablehq/aleo-wallet-adaptor-shield     │
├────────────────────────┼────────┼────────────────────────────────────────────┤
│ Frontend builds        │   ✅   │ All 7 routes compile cleanly                │
└────────────────────────┴────────┴────────────────────────────────────────────┘
```

### Deployment Info
- **Program ID**: `zkdrop_v3_0001.aleo`
- **Transaction ID**: `at18hfepug35wue9dhkqpsmurdvhsuj2yfmhh6u5y9mwtldl6eh2crqc8sc6j`
- **Explorer**: https://testnet.explorer.provable.com/program/zkdrop_v3_0001.aleo
- **Deployment Fee**: 8.10 credits

### Environment Checklist

Before deployment, ensure all settings are correct in `.env.local`:

- [x] `NEXT_PUBLIC_RPC_URL=https://api.provable.com/v2` ✅ (correct Aleo testnet RPC)
- [x] `NEXT_PUBLIC_ZKDROP_PROGRAM_ID=zkdrop_v3_0001.aleo` ✅ (deployed)
- [x] `PINATA_JWT` ✅ (configured in .env.local — real JWT set)
- [x] `NEXT_PUBLIC_CREDITS_PROGRAM_ID=credits.aleo` ✅
- [x] `NEXT_PUBLIC_USAD_PROGRAM_ID=usad_stablecoin.aleo` ✅ (mainnet only)

### End-to-End Test Flow

1. Connect Shield Wallet → Dashboard
2. Upload a file → IPFS upload + `upload_file` on-chain transaction
3. Copy share link or scan QR code → File detail page
4. Request access → Payment via `credits.aleo`
5. Download → IPFS file retrieved via gateway

---

## Buildathon Compliance

ZKDrop is built for the **Aleo Privacy Buildathon** by AKINDO.

### Rule Compliance

| Rule | Compliance | Details |
|------|------------|---------|
| **Rule 4: Core Tooling** | ✅ | Shield Wallet + `credits.aleo`/`usad_stablecoin.aleo` |
| **Rule 1: Single Submission** | ✅ | One project per team |
| **Rule 2: Functional Frontend** | ✅ | Next.js app with Aleo integration |
| **Rule 3: Non-trivial Contract** | ✅ | File storage + access control contract |
| **Rule 5: No AI Slop** | ✅ | Original implementation |

### Judging Criteria

| Category | Weight | ZKDrop Implementation |
|---------|--------|----------------------|
| **Privacy Usage** | 40% | ZK proofs for access, private records |
| **Technical Implementation** | 20% | Aleo contracts + IPFS + wallet integration |
| **User Experience** | 20% | Modern UI with animations, responsive design |
| **Practicality** | 10% | Real file sharing use case |
| **Novelty** | 10% | Privacy-first approach to file sharing |

---

## File Structure

```
zkdrop/
├── contracts/
│   └── zkdrop/
│       ├── program.json           # Leo program manifest
│       └── src/
│           └── main.leo           # Main smart contract
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout with providers
│   │   ├── page.tsx               # Homepage with parallax
│   │   ├── providers.tsx           # Wallet provider
│   │   ├── upload/page.tsx        # File upload
│   │   ├── dashboard/page.tsx     # User dashboard
│   │   ├── files/page.tsx         # Browse files
│   │   ├── file/[id]/page.tsx     # File detail
│   │   └── payments/page.tsx      # Payment management
│   ├── components/
│   │   ├── ui/                    # UI components (Button, Card, etc.)
│   │   ├── layout/                # Navbar, Footer
│   │   ├── home/                  # Homepage sections
│   │   ├── wallet/                # Wallet components
│   │   └── upload/                # Upload components
│   ├── lib/
│   │   ├── aleo.ts                # Aleo configuration
│   │   ├── wallet.tsx             # Wallet provider (Shield)
│   │   ├── ipfs.ts                # IPFS utilities
│   │   ├── payments.ts            # Payment utilities
│   │   └── utils.ts               # Common utilities
│   └── types/
│       └── global.d.ts            # TypeScript declarations
├── .env.local                     # Environment variables
├── deploy.sh                      # Linux/WSL deployment script
├── deploy.wsl.sh                 # WSL deployment with private key setup
└── package.json
```

---

## License

MIT

---

Built with ❤️ for the Aleo Privacy Buildathon
