// Aleo network and contract configuration
// ─────────────────────────────────────────────────────────────
// Buildathon Rule 4: Payments must use credits.aleo or USDCx/USAD
// Using: credits.aleo (testnet) + usad_stablecoin.aleo (mainnet)
// ─────────────────────────────────────────────────────────────
import { Network } from '@provablehq/aleo-types';

export const aleoConfig = {
  // Network configuration
  network: process.env.NEXT_PUBLIC_NETWORK || 'testnet',
  networkEnum: Network.TESTNET,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://api.explorer.provable.com/v1',

  // Program IDs (update after deployment)
  programs: {
    // Main ZKDrop contract
    zkdrop: process.env.NEXT_PUBLIC_ZKDROP_PROGRAM_ID || 'zkdrop_v4_0001.aleo',

    // ─────────────────────────────────────────────────────────
    // Buildathon Rule 4: Payment Programs
    // credits.aleo - Native Aleo Credits (used on testnet)
    // ─────────────────────────────────────────────────────────
    credits: process.env.NEXT_PUBLIC_CREDITS_PROGRAM_ID || 'credits.aleo',

    // ─────────────────────────────────────────────────────────
    // Buildathon Rule 4: USAD Stablecoin (mainnet)
    // usad_stablecoin.aleo - Paxos-backed USD stablecoin
    // ─────────────────────────────────────────────────────────
    usad: process.env.NEXT_PUBLIC_USAD_PROGRAM_ID || 'usad_stablecoin.aleo',

    // USDCx testnet (if available)
    usdcx: process.env.NEXT_PUBLIC_USDCX_PROGRAM_ID || 'usdcx_stablecoin.aleo',
  },

  // Credits program address (testnet)
  creditsAddress: 'aleo1lqmly7ez2k48ajf5hs92ulphaqr05qm4n8qwzj8v0yprmasgpqgsez59gg',

  // USAD program address (mainnet)
  usadAddress: 'usad_stablecoin.aleo',
};

// ─────────────────────────────────────────────────────────────
// Program Function Reference
// ─────────────────────────────────────────────────────────────

// ZKDrop contract functions (Leo 4.0 — all fn, no transition/function keywords)
export const ZKDROP_FUNCTIONS = [
  'upload_file',    // Upload file with IPFS hash — returns FileRecord
  'request_access', // Any user requests access — returns AccessRecord
  'revoke_access',  // Owner revokes a user's access (requires FileRecord)
  'update_price',   // Owner updates file price (requires FileRecord)
  'delete_file',    // Owner deletes a file from public listings (requires FileRecord)
  'update_name',    // Owner updates file name in public mappings (requires FileRecord)
] as const;

// credits.aleo functions (used for payments)
export const CREDITS_FUNCTIONS = [
  'transfer_public',           // Public transfer (visible)
  'transfer_private',          // Private transfer (encrypted)
  'transfer_public_as_signer', // Public transfer by signer
  'transfer_private_to_public', // Private to public
  'transfer_public_to_private', // Public to private
] as const;

// usad_stablecoin.aleo functions (used for USAD payments)
export const USAD_FUNCTIONS = [
  'transfer_public',           // Public USAD transfer
  'transfer_private',          // Private USAD transfer
  'transfer_private_to_public', // Private to public
  'transfer_public_to_private', // Public to private
] as const;

// ─────────────────────────────────────────────────────────────
// Fee Configuration
// ─────────────────────────────────────────────────────────────

export const feeConfig = {
  executionFeeMicro: BigInt(2000000),   // 2 Aleo credits
  deployFeeMicro: BigInt(100000000),   // 100 Aleo credits
  minTransferMicro: BigInt(1000),      // 0.001 credits minimum
};

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

export type MicroAmount = bigint;

/**
 * Convert human-readable amount to micro units
 * 1 Aleo Credit = 1,000,000 microcredits
 */
export function toMicro(amount: number, decimals: number = 6): MicroAmount {
  return BigInt(Math.floor(amount * Math.pow(10, decimals)));
}

/**
 * Convert micro units to human-readable amount
 */
export function fromMicro(micro: MicroAmount, decimals: number = 6): number {
  return Number(micro) / Math.pow(10, decimals);
}

/**
 * Format Aleo address for display (truncate)
 */
export function formatAddress(address: string, chars: number = 6): string {
  if (!address || address.length < chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format timestamp to relative time
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

/**
 * Format balance for display
 */
export function formatBalance(micro: MicroAmount, symbol: string = 'Credits'): string {
  const value = fromMicro(micro);
  return `${value.toFixed(4)} ${symbol}`;
}
