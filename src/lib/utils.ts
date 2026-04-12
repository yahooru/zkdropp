import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Truncate text
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}...${str.slice(-4)}`;
}

// Generate a unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Debounce function
export function debounce<Args extends unknown[]>(
  func: (...args: Args) => void,
  wait: number
): (...args: Args) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Args) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Encode a string into a fixed-length u8 array for Aleo inputs.
export function toFixedLengthBytes(value: string, length: number): number[] {
  const encoded = new TextEncoder().encode(value);
  return Array.from({ length }, (_, index) => encoded[index] ?? 0);
}

export function toAleoByteArrayLiteral(value: string, length: number): string {
  return `[${toFixedLengthBytes(value, length).map((byte) => `${byte}u8`).join(', ')}]`;
}

/**
 * Convert a hex string (with or without 0x prefix) to an Aleo field literal.
 * Aleo field literals use the decimal representation followed by 'field'.
 * Examples:
 *   "0xabc123"       → "27478596field"  (hex as decimal + "field")
 *   "0xdeadbeef"    → "3735928559field" (hex as decimal + "field")
 *   "deadbeef"      → "3735928559field" (hex as decimal + "field")
 */
export function toAleoFieldLiteral(hexString: string): string {
  const clean = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
  const decimalValue = BigInt('0x' + clean);
  return decimalValue.toString() + 'field';
}

export function isWalletLocalTransactionId(txId: string): boolean {
  // Wallet-local IDs are prefixed with 'shield_' and are NOT on-chain queryable.
  // Real Aleo transaction IDs start with 'at1' (testnet) or 'au1' (mainnet).
  // We also treat empty/null/undefined as non-local.
  if (!txId || typeof txId !== 'string') return false;
  return txId.startsWith('shield_');
}

// Check if running in browser
export const isBrowser = typeof window !== 'undefined';

// Local storage helpers with SSR safety
export const storage = {
  get<T>(key: string, fallback: T | null = null): T | null {
    if (!isBrowser) return fallback;
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T) {
    if (!isBrowser) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage errors
    }
  },
  remove: (key: string) => {
    if (!isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },
};
