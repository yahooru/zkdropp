// ZKDrop service layer — real on-chain queries via @provablehq/sdk
// ─────────────────────────────────────────────────────────────────────────────

import { aleoConfig, toMicro } from './aleo';
import { isWalletLocalTransactionId } from './utils';

interface AleoTransitionLike {
  function_name?: string;
  inputs?: string[];
  outputs?: string[];
  program?: string;
}

interface AleoTransactionLike {
  block_height?: number;
  block_timestamp?: number;
  id?: string;
  status?: string;
  transaction_id?: string;
  transitions?: AleoTransitionLike[];
  type?: string;
}

interface AleoBlockLike {
  transactions?: AleoTransactionLike[];
}

interface AleoClientWithBlock {
  getBlock?: (height: number) => Promise<AleoBlockLike | undefined>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ZKDropFile {
  fileId: string;        // SHA-256 hash of IPFS bytes as Aleo field literal (0x...field)
  fileKey: string;       // SHA-256[0..8] as Aleo u64 literal (<bigint>u64) — for RPC mapping queries
  cid: string;           // IPFS CID
  name: string;          // file name
  price: bigint;         // price in microcredits
  accessCount: bigint;   // number of accesses
  owner: string;         // Aleo address
  createdAt: number;      // unix timestamp in seconds (from contract file_unix_ts mapping)
  blockHeight: number;   // block height at creation (from contract file_created_at mapping)
  txId: string;          // upload transaction ID
  encrypted: boolean;    // true if AES-256-GCM encrypted before upload
  pending: boolean;      // true when the file exists only in local registry
}

export interface ZKDropTransaction {
  id: string;
  type: 'upload' | 'access' | 'payment' | 'update';
  description: string;
  timestamp: number;
  txId: string;
  blockHeight?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Local file registry (private metadata storage)
// ─────────────────────────────────────────────────────────────────────────────

export const REGISTRY_KEY = 'zkdrop_file_registry';

export interface FileRegistryEntry {
  fileId: string;    // SHA-256 hash of IPFS bytes as Aleo field literal (0x...field)
  fileKey: string;   // SHA-256[0..8] as Aleo u64 literal (<bigint>u64) — for RPC mapping queries
  cid: string;
  name: string;
  price: string;     // stored as string for JSON serialization
  priceUnit?: 'credits' | 'micro';
  createdAt: number; // unix timestamp in seconds
  txId: string;
  encrypted: boolean;
  ownerAddress?: string;
}

export function getRegistry(): FileRegistryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    return raw ? (JSON.parse(raw) as FileRegistryEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * Get all registry entries regardless of on-chain status.
 * Use this when you want ALL files including pending ones.
 */
export function getAllRegistryEntries(): FileRegistryEntry[] {
  return getRegistry();
}

function saveRegistry(entries: FileRegistryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(entries));
  } catch { /* storage full */ }
}

export function saveToRegistry(entry: FileRegistryEntry): void {
  const registry = getRegistry();
  const existing = registry.findIndex(e => e.fileId === entry.fileId);
  if (existing >= 0) {
    registry[existing] = entry;
    console.debug(`[ZKDrop] saveToRegistry: updated existing entry for fileId=${entry.fileId}`);
  } else {
    registry.push(entry);
    console.debug(`[ZKDrop] saveToRegistry: added new entry, total=${registry.length}`);
  }
  saveRegistry(registry);
}

export function getRegistryEntryByFileKey(fileKey: string): FileRegistryEntry | null {
  return getRegistry().find((entry) => entry.fileKey === fileKey) ?? null;
}

export function removeFromRegistry(fileId: string): void {
  const registry = getRegistry().filter(e => e.fileId !== fileId);
  saveRegistry(registry);
}

/**
 * Compute the Aleo field file_id from IPFS bytes.
 * Uses SHA-256 of the 64-byte IPFS representation, formatted as a field literal.
 * MUST match the contract's sha256(ipfs_bytes) → field derivation exactly.
 * This fixes RC1: same hash algorithm used by frontend (WebCrypto) and contract.
 *
 * @param ipfsBytes - 64-element byte array of the IPFS CID
 * @returns Aleo field literal: "<decimal>field"
 */
export async function sha256ToField(bytes: number[]): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  const hex = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return BigInt('0x' + clean).toString() + 'field';
}

/**
 * Compute the u64 mapping key from IPFS bytes.
 * Uses SHA-256 → first 8 bytes as big-endian u64.
 * Aleo RPC URL API only supports u64 mapping keys (field keys return 404).
 *
 * @param ipfsBytes - 64-element byte array of the IPFS CID
 * @returns Aleo u64 literal: "<bigint>u64"
 */
export async function sha256ToU64Key(bytes: number[]): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  const view = new DataView(buf);
  const u64 = view.getBigUint64(0); // first 8 bytes, big-endian
  return `${u64.toString()}u64`;
}

/**
 * Compute the per-user access key (u64 version for Aleo RPC mapping queries).
 * access_key = sha256(file_id + address_bytes) as u64.
 * Aleo RPC URL API only supports u64 mapping keys.
 *
 * @param fileId - the file_id field literal (0x...field format)
 * @param address - Aleo address string
 * @returns Aleo u64 literal: "<bigint>u64"
 */
export async function sha256AccessKey(fileId: string, address: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(fileId + address);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const view = new DataView(buf);
  const u64 = view.getBigUint64(0); // first 8 bytes as u64
  return `${u64.toString()}u64`;
}

/**
 * Compute the per-user access key (field version — kept for contract inputs).
 * access_key = sha256(file_id + address_bytes) as Aleo field literal.
 * MUST match the contract's sha256(file_id + address) field derivation.
 *
 * @param fileId - the file_id field literal (0x...field format)
 * @param address - Aleo address string
 * @returns Aleo field literal: "<decimal>field"
 */
export async function sha256AccessKeyField(fileId: string, address: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(fileId + address);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return BigInt('0x' + hex).toString() + 'field';
}

/**
 * @deprecated Use sha256ToField(ipfsBytes). Kept for backward compat.
 * Converts a CID string to the file_id hex (without 0x prefix).
 * Use sha256ToField() for the actual Aleo field literal.
 */
export function cidToField(cid: string): string {
  return cid;
}

/**
 * @deprecated Use sha256AccessKey(fileId, address) instead.
 */
export async function cidToAccessKey(fileId: string, address: string): Promise<string> {
  return sha256AccessKey(fileId, address);
}

// ─────────────────────────────────────────────────────────────────────────────
// AleoNetworkClient helper
// ─────────────────────────────────────────────────────────────────────────────

async function getNetworkClient() {
  const { AleoNetworkClient } = await import('@provablehq/sdk');
  return new AleoNetworkClient(aleoConfig.rpcUrl);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public mapping queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the total number of files uploaded from the public counter.
 */
export async function getTotalFileCount(): Promise<bigint> {
  try {
    const client = await getNetworkClient();
    // V2 contract: file_counter uses u64 key = 0u64
    const count = await client.getProgramMappingValue(
      aleoConfig.programs.zkdrop,
      'file_counter',
      '0u64'
    );
    return count ? BigInt(count) : BigInt(0);
  } catch {
    return BigInt(0);
  }
}

/**
 * Get the public owner of a file.
 * @param fileKey - u64 mapping key (sha256[0..8] of IPFS bytes)
 */
export async function getFileOwner(fileKey: string): Promise<string | null> {
  try {
    const client = await getNetworkClient();
    const owner = await client.getProgramMappingValue(
      aleoConfig.programs.zkdrop,
      'file_owners',
      fileKey
    );
    if (owner == null) {
      console.debug(`[ZKDrop] getFileOwner: no owner for fileKey=${fileKey} — file not on chain`);
      return null;
    }
    const result = String(owner).trim();
    return result || null;
  } catch (error) {
    console.warn(`[ZKDrop] getFileOwner error for fileKey=${fileKey}:`, error);
    return null;
  }
}

/**
 * Get the block height at which a file was created.
 * @param fileKey - u64 mapping key
 */
export async function getFileCreatedAt(fileKey: string): Promise<number> {
  try {
    const client = await getNetworkClient();
    const bh = await client.getProgramMappingValue(
      aleoConfig.programs.zkdrop,
      'file_created_at',
      fileKey
    );
    return bh ? Number(bh) : 0;
  } catch {
    return 0;
  }
}

/**
 * Get the unix timestamp at which a file was created (set by frontend).
 * @param fileKey - u64 mapping key
 */
export async function getFileUnixTs(fileKey: string): Promise<number> {
  try {
    const client = await getNetworkClient();
    const ts = await client.getProgramMappingValue(
      aleoConfig.programs.zkdrop,
      'file_unix_ts',
      fileKey
    );
    return ts ? Number(ts) : Math.floor(Date.now() / 1000);
  } catch {
    return Math.floor(Date.now() / 1000);
  }
}

/**
 * Get the IPFS name of a file (first 32 bytes).
 * @param fileKey - u64 mapping key
 */
export async function getFileName(fileKey: string): Promise<string> {
  try {
    const client = await getNetworkClient();
    const nameBytes = await client.getProgramMappingValue(
      aleoConfig.programs.zkdrop,
      'file_names',
      fileKey
    );
    if (!nameBytes) return 'Unknown File';
    // nameBytes is an array of u8 values — reconstruct the string
    const bytes = Array.isArray(nameBytes) ? nameBytes : [];
    let name = '';
    for (const b of bytes) {
      const code = typeof b === 'string' ? parseInt(b) : Number(b);
      if (code === 0) break;
      name += String.fromCharCode(code);
    }
    return name || 'Unknown File';
  } catch {
    return 'Unknown File';
  }
}

/**
 * Check if a file has been deleted (exists on-chain but price = 0).
 * A file that doesn't exist at all will also return false (no false positives).
 * @param fileKey - u64 mapping key
 */
export async function isFileDeleted(fileKey: string): Promise<boolean> {
  const [price, exists] = await Promise.all([
    getFilePrice(fileKey),
    fileExists(fileKey),
  ]);
  // File is deleted only if it exists AND price is 0
  return exists && price === BigInt(0);
}

/**
 * Get the public price of a file.
 * @param fileKey - u64 mapping key
 */
export async function getFilePrice(fileKey: string): Promise<bigint> {
  try {
    const client = await getNetworkClient();
    const price = await client.getProgramMappingValue(
      aleoConfig.programs.zkdrop,
      'file_prices',
      fileKey
    );
    return price ? BigInt(price) : BigInt(0);
  } catch {
    return BigInt(0);
  }
}

/**
 * Get the access count for a file.
 * @param fileKey - u64 mapping key
 */
export async function getFileAccessCount(fileKey: string): Promise<bigint> {
  try {
    const client = await getNetworkClient();
    const count = await client.getProgramMappingValue(
      aleoConfig.programs.zkdrop,
      'file_counters',
      fileKey
    );
    return count ? BigInt(count) : BigInt(0);
  } catch {
    return BigInt(0);
  }
}

/**
 * Check if a file exists on-chain.
 * @param fileKey - u64 mapping key
 */
export async function fileExists(fileKey: string): Promise<boolean> {
  const owner = await getFileOwner(fileKey);
  return owner !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get transaction details from the Aleo network.
 */
export async function getTransaction(txId: string): Promise<{
  type: string;
  blockHeight: number;
  status: string;
} | null> {
  try {
    const client = await getNetworkClient();
    const tx = await client.getTransaction(txId) as AleoTransactionLike | null;
    if (!tx) return null;
    return {
      type: tx.type || 'unknown',
      blockHeight: tx.block_height || 0,
      status: tx.status || 'confirmed',
    };
  } catch {
    return null;
  }
}

/**
 * Wait for a file to appear on-chain by polling fileExists AND tx status.
 *
 * Two polling strategies:
 * 1. If checkWalletTxStatus is provided (wallet hook): poll the wallet adapter's
 *    transactionStatus. When it returns 'accepted', we get the real 'at1...' ID
 *    and verify via getTransaction + fileExists.
 *    When it returns 'rejected'/'failed', we return early with rejection reason.
 * 2. Fallback: just poll fileExists every 3s.
 *
 * Returns { confirmed: true } if file is on-chain.
 * Returns { confirmed: false, rejected: true, reason: string } if tx was rejected.
 * Returns { confirmed: false, rejected: false } if timeout (tx never reached chain).
 */
export async function waitForOnChainConfirmation(
  fileKey: string,
  maxRetries: number = 20,
  txId?: string,
  checkWalletTxStatus?: (txId: string) => Promise<{ status: string; transactionId?: string; error?: string }>
): Promise<{ confirmed: boolean; rejected?: boolean; reason?: string }> {
  console.debug(`[ZKDrop] Waiting for on-chain confirmation for fileKey=${fileKey}, txId=${txId ?? 'unknown'}, hasWalletCheck=${!!checkWalletTxStatus}`);

  for (let i = 0; i < maxRetries; i++) {
    await new Promise(r => setTimeout(r, 2000));

    // Strategy 1: Poll the wallet adapter for transaction status
    // This is the ONLY way to resolve shield_ IDs to real at1... IDs
    if (txId && checkWalletTxStatus) {
      try {
        const walletResult = await checkWalletTxStatus(txId);
        console.debug(`[ZKDrop] Wallet tx status: ${walletResult.status}, realId=${walletResult.transactionId ?? 'n/a'}, attempt ${i + 1}/${maxRetries}`);

        if (walletResult.status === 'accepted' || walletResult.status === 'confirmed') {
          // Tx is on-chain! Get the real at1... ID and verify via getTransaction + fileExists
          const realTxId = walletResult.transactionId ?? txId;
          try {
            const { AleoNetworkClient } = await import('@provablehq/sdk');
            const client = new AleoNetworkClient(aleoConfig.rpcUrl);
            const tx = await client.getTransaction(realTxId) as AleoTransactionLike;
            console.debug(`[ZKDrop] On-chain tx found: ${realTxId}, type=${tx?.type}`);
            const exists = await fileExists(fileKey);
            if (exists) {
              console.debug(`[ZKDrop] File confirmed on-chain: fileKey=${fileKey}`);
              return { confirmed: true };
            }
            // Tx on-chain but file_owners not set → REJECTED
            const txType = tx?.type ?? 'unknown';
            console.warn(`[ZKDrop] Transaction on-chain but REJECTED (file_owners not set): type=${txType}`);
            return {
              confirmed: false,
              rejected: true,
              reason: `Contract execution rejected on-chain — the finalize block did not update file_owners. Check contract inputs.`,
            };
          } catch (err) {
            const msg = String(err);
            if (!msg.includes('404') && !msg.includes('Not Found') && !msg.includes('not found')) {
              console.warn(`[ZKDrop] getTransaction error after wallet accepted:`, msg);
            }
            // Tx accepted by wallet but not yet visible on RPC — keep polling
          }
        } else if (walletResult.status === 'rejected' || walletResult.status === 'failed') {
          console.warn(`[ZKDrop] Transaction ${walletResult.status} by wallet:`, walletResult.error);
          return {
            confirmed: false,
            rejected: true,
            reason: walletResult.error ?? `Transaction was ${walletResult.status} by the network.`,
          };
        }
        // 'pending' — wallet hasn't processed yet, keep polling
      } catch (err) {
        const msg = String(err);
        // Only warn for unexpected errors, not normal "not found" during pending state
        if (!msg.includes('not found') && !msg.includes('Not Found') && !msg.includes('pending')) {
          console.warn(`[ZKDrop] checkWalletTxStatus error (attempt ${i + 1}/${maxRetries}):`, msg);
        }
      }
    }

    // Strategy 2: If we already have a real on-chain txId, verify directly via RPC
    if (txId && !isWalletLocalTransactionId(txId)) {
      try {
        const { AleoNetworkClient } = await import('@provablehq/sdk');
        const client = new AleoNetworkClient(aleoConfig.rpcUrl);
        const tx = await client.getTransaction(txId) as AleoTransactionLike;
        console.debug(`[ZKDrop] Tx ${txId} found on-chain (type=${tx?.type}), attempt ${i + 1}/${maxRetries}`);
        const exists = await fileExists(fileKey);
        if (exists) {
          console.debug(`[ZKDrop] File confirmed on-chain: fileKey=${fileKey}`);
          return { confirmed: true };
        }
        const txType = tx?.type ?? 'unknown';
        console.warn(`[ZKDrop] Transaction REJECTED: on-chain but file_owners not set. type=${txType}`);
        return {
          confirmed: false,
          rejected: true,
          reason: `Contract execution rejected on-chain.`,
        };
      } catch {
        // 404 — not in a block yet, keep polling
      }
    }

    // Strategy 3: Direct fileExists check (works for both pending and any tx ID)
    const exists = await fileExists(fileKey);
    console.debug(`[ZKDrop] Attempt ${i + 1}/${maxRetries}: fileKey=${fileKey}, exists=${exists}`);
    if (exists) {
      console.debug(`[ZKDrop] File confirmed on-chain: fileKey=${fileKey}`);
      return { confirmed: true };
    }
  }
  console.warn(`[ZKDrop] On-chain confirmation timed out for fileKey=${fileKey} after ${maxRetries} attempts`);
  return { confirmed: false, rejected: false };
}

function registryEntryToPendingFile(
  entry: FileRegistryEntry,
  fallbackOwner?: string
): ZKDropFile {
  const decimalPrice = Number(entry.price);
  const parsedPrice =
    entry.priceUnit === 'micro'
      ? BigInt(entry.price || '0')
      : Number.isFinite(decimalPrice)
        ? toMicro(decimalPrice)
        : BigInt(0);
  return {
    fileId: entry.fileId,
    fileKey: entry.fileKey,
    cid: entry.cid,
    name: entry.name,
    price: parsedPrice,
    accessCount: BigInt(0),
    owner: entry.ownerAddress || fallbackOwner || '',
    createdAt: entry.createdAt,
    blockHeight: 0,
    txId: entry.txId,
    encrypted: entry.encrypted ?? false,
    pending: true,
  };
}

/**
 * Get recent transactions for an address.
 * Bug #6 fix: getTransactions(address) doesn't exist — use block-by-block queries instead.
 */
export async function getAddressTransactions(
  address: string,
  limit: number = 20
): Promise<ZKDropTransaction[]> {
  try {
    const client = await getNetworkClient();
    const latestHeight = await client.getLatestHeight();

    const zkdropTxs: ZKDropTransaction[] = [];
    // Check last 50 blocks (Aleo blocks ~400ms, 50 blocks ≈ 20s of history)
    const checkDepth = 50;

    for (let i = 0; i < checkDepth && zkdropTxs.length < limit; i++) {
      const blockHeight = latestHeight - i;
      if (blockHeight < 0) break;

      try {
        const block = await (client as AleoClientWithBlock).getBlock?.(blockHeight);
        if (!block?.transactions) continue;

        for (const txObj of block.transactions) {
          // Check if this tx's transitions involve our address
          const transitions = txObj.transitions || [];

          let involvesAddress = false;
          let func = '';

          for (const transition of transitions) {
            const tObj = transition;
            if (tObj.program === aleoConfig.programs.zkdrop) {
              involvesAddress = true;
              func = tObj.function_name || '';
              break;
            }
          }

          if (!involvesAddress) continue;

          let type: ZKDropTransaction['type'] = 'upload';
          let description = '';

          if (func === 'upload_file') {
            type = 'upload';
            description = 'File uploaded to ZKDrop';
          } else if (func === 'request_access' || func === 'grant_access') {
            type = 'access';
            description = 'Access requested for file';
          } else if (func === 'update_price') {
            type = 'update';
            description = 'File price updated';
          } else if (func === 'revoke_access') {
            type = 'update';
            description = 'Access revoked for file';
          }

          zkdropTxs.push({
            id: txObj.id || txObj.transaction_id || '',
            type,
            description,
            timestamp: txObj.block_timestamp || Math.floor(Date.now() / 1000),
            txId: txObj.id || txObj.transaction_id || '',
            blockHeight: blockHeight,
          });
        }
      } catch {
        // Individual block fetch failed — skip this block
      }
    }

    return zkdropTxs;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User's files (local registry + public chain data)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all files for the current user.
 * Uses local registry for metadata + public mappings for on-chain verification.
 * Includes files that are pending on-chain confirmation (no owner found yet).
 */
export async function getUserFiles(address: string): Promise<ZKDropFile[]> {
  const registry = getRegistry();
  if (!registry.length) {
    console.debug('[ZKDrop] getUserFiles: registry is empty');
    return [];
  }

  const addressLower = address?.toLowerCase();
  const files = await Promise.all(
    registry.map(async (entry) => {
      const [owner, price, accessCount, blockHeight, unixTs, chainName] = await Promise.all([
        getFileOwner(entry.fileKey),
        getFilePrice(entry.fileKey),
        getFileAccessCount(entry.fileKey),
        getFileCreatedAt(entry.fileKey),
        getFileUnixTs(entry.fileKey),
        getFileName(entry.fileKey),
      ]);

      const ownerLower = owner?.toLowerCase();
      const pendingOwnerLower = entry.ownerAddress?.toLowerCase();
      const isPending = !owner;
      const isOwned = Boolean(ownerLower && addressLower && ownerLower === addressLower);
      const isPendingForThisAddress = Boolean(
        isPending && addressLower && (!pendingOwnerLower || pendingOwnerLower === addressLower)
      );

      if (!isOwned && !isPendingForThisAddress) {
        return null;
      }

      if (isPending) {
        return registryEntryToPendingFile(entry, address);
      }

      return {
        fileId: entry.fileId,
        fileKey: entry.fileKey,
        cid: entry.cid,
        name: chainName !== 'Unknown File' ? chainName : entry.name,
        price: price ?? BigInt(0),
        accessCount: accessCount ?? BigInt(0),
        owner: owner ?? address,
        createdAt: unixTs > 0 ? unixTs : entry.createdAt,
        blockHeight: blockHeight ?? 0,
        txId: entry.txId,
        encrypted: entry.encrypted ?? false,
        pending: false,
      } satisfies ZKDropFile;
    })
  );

  return files
    .filter((file): file is ZKDropFile => file !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get multiple file details at once (for browse page).
 * @param fileKeys - array of u64 literal strings (NOT field literals)
 */
export async function getFilesByIds(fileKeys: string[], fallbackOwner?: string): Promise<ZKDropFile[]> {
  if (!fileKeys.length) return [];
  const results = await Promise.all(
    fileKeys.map((key) => getFileDetails(key, fallbackOwner))
  );
  const filtered = results.filter((f): f is ZKDropFile => f !== null);
  console.debug(`[ZKDrop] getFilesByIds: queried=${fileKeys.length}, found=${filtered.length}`);
  return filtered;
}

/**
 * Get file details by fileKey (u64 mapping key).
 * Uses both on-chain data (timestamps, names, prices) and local registry (cid, txId).
 */
export async function getFileDetails(fileKey: string, fallbackOwner?: string): Promise<ZKDropFile | null> {
  const [owner, price, accessCount, blockHeight, unixTs, chainName] = await Promise.all([
    getFileOwner(fileKey),
    getFilePrice(fileKey),
    getFileAccessCount(fileKey),
    getFileCreatedAt(fileKey),
    getFileUnixTs(fileKey),
    getFileName(fileKey),
  ]);

  const local = getRegistryEntryByFileKey(fileKey);

  if (!owner) {
    if (!local) {
      console.debug(`[ZKDrop] getFileDetails: no owner found for fileKey=${fileKey}`);
      return null;
    }

    return registryEntryToPendingFile(local, fallbackOwner);
  }

  return {
    fileId: local?.fileId || `${BigInt(0)}field`, // fallback only for edge cases where local registry has no fileId
    fileKey,
    cid: local?.cid || '',
    // Prefer chain name over registry name
    name: chainName !== 'Unknown File' ? chainName : (local?.name || 'Unknown File'),
    price,
    accessCount,
    owner,
    // Use unix timestamp from chain (set by frontend during upload)
    createdAt: unixTs > 0 ? unixTs : (local?.createdAt || Math.floor(Date.now() / 1000)),
    blockHeight,
    txId: local?.txId || '',
    encrypted: local?.encrypted ?? false,
    pending: false,
  };
}

/**
 * Register a newly uploaded file in the local registry.
 */
export function registerFile(params: {
  cid: string;
  name: string;
  price: number;
  txId: string;
  fileId?: string;
  fileKey?: string;
  encrypted?: boolean;
  unixTs?: number;
  ownerAddress?: string;
}): void {
  const fileId = params.fileId ?? '';
  const fileKey = params.fileKey ?? '';
  console.debug(`[ZKDrop] registerFile: fileId=${fileId}, fileKey=${fileKey}, cid=${params.cid}, name=${params.name}`);
  saveToRegistry({
    fileId,
    fileKey,
    cid: params.cid,
    name: params.name,
    price: toMicro(params.price).toString(),
    priceUnit: 'micro',
    createdAt: params.unixTs ?? Math.floor(Date.now() / 1000),
    txId: params.txId,
    encrypted: params.encrypted ?? false,
    ownerAddress: params.ownerAddress,
  });
}

/**
 * Remove a file from the local registry (by fileId).
 */
export function removeFile(fileId: string): void {
  removeFromRegistry(fileId);
}

/**
 * Remove a file from the local registry by fileKey.
 */
export function removeFileByKey(fileKey: string): void {
  const registry = getRegistry();
  const filtered = registry.filter(e => e.fileKey !== fileKey);
  saveRegistry(filtered);
}

/**
 * Check if an address has access to a file (via public mapping).
 * access_key = sha256(file_id + address)[0..8] as u64 — Aleo RPC URL API compatible.
 */
export async function hasAccess(fileId: string, address: string): Promise<boolean> {
  try {
    // Compute u64 access key (first 8 bytes of SHA-256 of fileId + address)
    const encoder = new TextEncoder();
    const data = encoder.encode(fileId + address);
    const buf = await crypto.subtle.digest('SHA-256', data);
    const view = new DataView(buf);
    const accessKey = `${view.getBigUint64(0).toString()}u64`;

    const client = await getNetworkClient();
    const grants = await client.getProgramMappingValue(
      aleoConfig.programs.zkdrop,
      'access_grants',
      accessKey
    );
    return grants ? BigInt(grants) > BigInt(0) : false;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Balances
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get Aleo credits balance.
 */
export async function getCreditsBalance(address: string): Promise<bigint> {
  try {
    const client = await getNetworkClient();
    const balance = await client.getProgramMappingValue(
      aleoConfig.programs.credits,
      'account',
      address
    );
    return balance ? BigInt(balance) : BigInt(0);
  } catch {
    return BigInt(0);
  }
}

/**
 * Get USAD balance.
 */
export async function getUSADBalance(address: string): Promise<bigint> {
  try {
    const client = await getNetworkClient();
    const balance = await client.getProgramMappingValue(
      aleoConfig.programs.usad,
      'account',
      address
    );
    return balance ? BigInt(balance) : BigInt(0);
  } catch {
    return BigInt(0);
  }
}

/**
 * Get both balances at once.
 */
export async function getBalances(address: string): Promise<{
  credits: bigint;
  usad: bigint;
}> {
  const [credits, usad] = await Promise.all([
    getCreditsBalance(address),
    getUSADBalance(address),
  ]);
  return { credits, usad };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction history
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get recent credits transactions for an address.
 * Uses block-by-block queries (Bug #6 fix: getTransactions(address) doesn't exist).
 */
export async function getCreditsTransactions(
  address: string,
  limit: number = 20
): Promise<ZKDropTransaction[]> {
  try {
    const client = await getNetworkClient();
    const latestHeight = await client.getLatestHeight();
    const result: ZKDropTransaction[] = [];
    const checkDepth = 50;

    for (let i = 0; i < checkDepth && result.length < limit; i++) {
      const blockHeight = latestHeight - i;
      if (blockHeight < 0) break;

      try {
        const block = await (client as AleoClientWithBlock).getBlock?.(blockHeight);
        if (!block?.transactions) continue;

        for (const txObj of block.transactions) {
          const transitions = txObj.transitions || [];

          let involvesAddress = false;
          let func = '';

          for (const tObj of transitions) {
            // Check credits.aleo program and transitions that might involve this address
            if (tObj.program === aleoConfig.programs.credits) {
              // Check inputs/outputs for this address
              const inputs = tObj.inputs || [];
              const outputs = tObj.outputs || [];
              if (
                inputs.some((inp: string) => inp?.toLowerCase().includes(address.toLowerCase())) ||
                outputs.some((out: string) => out?.toLowerCase().includes(address.toLowerCase()))
              ) {
                involvesAddress = true;
                func = tObj.function_name || '';
                break;
              }
            }
          }

          if (!involvesAddress) continue;

          let description = 'Credits transaction';

          if (func === 'transfer_public' || func === 'transfer' || func === 'transfer_private') {
            description = 'Credits transfer';
          } else if (func === 'split') {
            description = 'Credits split';
          } else if (func === 'bond') {
            description = 'Credits bond';
          }

          result.push({
            id: txObj.id || txObj.transaction_id || '',
            type: 'payment',
            description,
            timestamp: txObj.block_timestamp || Math.floor(Date.now() / 1000),
            txId: txObj.id || txObj.transaction_id || '',
            blockHeight: blockHeight,
          });
        }
      } catch {
        // Skip failed block fetches
      }
    }

    return result;
  } catch {
    return [];
  }
}
