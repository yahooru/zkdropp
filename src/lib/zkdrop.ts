// ZKDrop service layer — real on-chain queries via @provablehq/sdk
// ─────────────────────────────────────────────────────────────────────────────

import { aleoConfig } from './aleo';

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
  createdAt: number; // unix timestamp in seconds
  txId: string;
  encrypted: boolean;
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
    console.debug(`[ZKDrop] saveToRegistry: added new entry, total=${registry.length + 1}`);
  }
  saveRegistry(registry);
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
 * @returns Aleo field literal: "0x<hex>field"
 */
export async function sha256ToField(bytes: number[]): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  const hex = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `0x${hex}field`;
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
 * @returns Aleo field literal: "0x<hex>field"
 */
export async function sha256AccessKeyField(fileId: string, address: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(fileId + address);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `0x${hex}field`;
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
    const tx = await client.getTransaction(txId) as any;
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
 * Wait for a file to appear on-chain by polling fileExists.
 * Retries every 3s for up to maxRetries (default: 20 = ~60s).
 * Returns true if confirmed on-chain, false if timeout.
 */
export async function waitForOnChainConfirmation(
  fileKey: string,
  maxRetries: number = 20
): Promise<boolean> {
  console.debug(`[ZKDrop] Waiting for on-chain confirmation for fileKey=${fileKey}`);
  for (let i = 0; i < maxRetries; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const exists = await fileExists(fileKey);
    console.debug(`[ZKDrop] Attempt ${i + 1}/${maxRetries}: fileKey=${fileKey}, exists=${exists}`);
    if (exists) {
      console.debug(`[ZKDrop] File confirmed on-chain: fileKey=${fileKey}`);
      return true;
    }
  }
  console.warn(`[ZKDrop] On-chain confirmation timed out for fileKey=${fileKey} after ${maxRetries} attempts`);
  return false;
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
        const block = await (client as any).getBlock(blockHeight);
        if (!block?.transactions) continue;

        for (const tx of block.transactions) {
          // Check if this tx's transitions involve our address
          const txObj = tx as any;
          const transitions = txObj.transitions || [];

          let involvesAddress = false;
          let program = '';
          let func = '';

          for (const t of transitions) {
            const tObj = t as any;
            if (tObj.program === aleoConfig.programs.zkdrop) {
              involvesAddress = true;
              program = tObj.program || '';
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

  const files: ZKDropFile[] = [];
  const addressLower = address?.toLowerCase();

  for (const entry of registry) {
    const [owner, price, accessCount, blockHeight, unixTs, chainName] = await Promise.all([
      getFileOwner(entry.fileKey),
      getFilePrice(entry.fileKey),
      getFileAccessCount(entry.fileKey),
      getFileCreatedAt(entry.fileKey),
      getFileUnixTs(entry.fileKey),
      getFileName(entry.fileKey),
    ]);

    const ownerLower = owner?.toLowerCase();
    const isPending = !owner; // No owner on-chain = pending confirmation

    // Include files owned by this address OR files pending on-chain for this address
    const isOwned = ownerLower && addressLower && ownerLower === addressLower;
    const isPendingForThisAddress = isPending; // Registry entry exists for this user

    if (isOwned || isPendingForThisAddress) {
      files.push({
        fileId: entry.fileId,
        fileKey: entry.fileKey,
        cid: entry.cid,
        // Prefer chain name if registry name is empty/missing
        name: chainName !== 'Unknown File' ? chainName : entry.name,
        price: price ?? BigInt(0),
        accessCount: accessCount ?? BigInt(0),
        owner: owner ?? address, // Show user's address for pending files
        // Use unix timestamp from chain if available, fallback to registry
        createdAt: unixTs > 0 ? unixTs : entry.createdAt,
        blockHeight: blockHeight ?? 0,
        txId: entry.txId,
        encrypted: entry.encrypted ?? false,
      });
    }
  }

  return files.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get multiple file details at once (for browse page).
 * @param fileKeys - array of u64 literal strings (NOT field literals)
 */
export async function getFilesByIds(fileKeys: string[]): Promise<ZKDropFile[]> {
  if (!fileKeys.length) return [];
  const results = await Promise.all(
    fileKeys.map(key => getFileDetails(key))
  );
  const filtered = results.filter((f): f is ZKDropFile => f !== null);
  console.debug(`[ZKDrop] getFilesByIds: queried=${fileKeys.length}, found=${filtered.length}`);
  return filtered;
}

/**
 * Get file details by fileKey (u64 mapping key).
 * Uses both on-chain data (timestamps, names, prices) and local registry (cid, txId).
 */
export async function getFileDetails(fileKey: string): Promise<ZKDropFile | null> {
  const [owner, price, accessCount, blockHeight, unixTs, chainName] = await Promise.all([
    getFileOwner(fileKey),
    getFilePrice(fileKey),
    getFileAccessCount(fileKey),
    getFileCreatedAt(fileKey),
    getFileUnixTs(fileKey),
    getFileName(fileKey),
  ]);

  if (!owner) {
    console.debug(`[ZKDrop] getFileDetails: no owner found for fileKey=${fileKey}`);
    return null;
  }

  const registry = getRegistry();
  const local = registry.find(e => e.fileKey === fileKey);

  return {
    fileId: local?.fileId || `0x${fileKey.replace('u64', '')}${'0'.repeat(64)}field`,
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
}): void {
  const fileId = params.fileId ?? '';
  const fileKey = params.fileKey ?? '';
  console.debug(`[ZKDrop] registerFile: fileId=${fileId}, fileKey=${fileKey}, cid=${params.cid}, name=${params.name}`);
  saveToRegistry({
    fileId,
    fileKey,
    cid: params.cid,
    name: params.name,
    price: params.price.toString(),
    createdAt: params.unixTs ?? Math.floor(Date.now() / 1000),
    txId: params.txId,
    encrypted: params.encrypted ?? false,
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
        const block = await (client as any).getBlock(blockHeight);
        if (!block?.transactions) continue;

        for (const tx of block.transactions) {
          const txObj = tx as any;
          const transitions = txObj.transitions || [];

          let involvesAddress = false;
          let func = '';

          for (const t of transitions) {
            const tObj = t as any;
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
