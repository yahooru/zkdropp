// ZKDrop Client-Side Encryption
// ─────────────────────────────────────────────────────────────────────────────
// Encrypts files with AES-256-GCM before IPFS upload (SEC-2 fix).
// Only the owner and authorized users have the decryption key.
// The encrypted blob is what gets uploaded to IPFS — raw content is never stored.
//
// Key storage: Keys are stored in localStorage alongside the IPFS hash.
// Future improvement: Store keys in the Aleo FileRecord (as base64) so they're
// recoverable from the blockchain. Currently kept client-side for simplicity.
// ─────────────────────────────────────────────────────────────────────────────

const KEY_LENGTH = 256;
const ALGORITHM = 'AES-GCM';
const IV_LENGTH = 12; // 96-bit IV for AES-GCM

/**
 * Generate a random AES-256-GCM encryption key.
 */
export async function generateEncryptionKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable (needed to export for storage)
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to a base64 string for storage.
 */
export async function exportKeyToBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  const bytes = Array.from(new Uint8Array(raw)); let binary = ''; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]); return btoa(binary);
}

/**
 * Import a base64 key string back to a CryptoKey.
 */
export async function importKeyFromBase64(base64: string): Promise<CryptoKey> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return crypto.subtle.importKey(
    'raw',
    bytes,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['decrypt']
  );
}

/**
 * Encrypt a file and return { encryptedBlob, keyBase64 } for upload + storage.
 */
export async function encryptFileForUpload(file: File): Promise<{
  encryptedBlob: Blob;
  keyBase64: string;
  ivBase64: string;
  originalName: string;
  originalSize: number;
}> {
  const key = await generateEncryptionKey();
  const fileBuffer = await file.arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    fileBuffer
  );

  const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });

  const keyBase64 = await exportKeyToBase64(key);
  const ivBase64 = btoa(String.fromCharCode(...iv));

  return {
    encryptedBlob,
    keyBase64,
    ivBase64,
    originalName: file.name,
    originalSize: file.size,
  };
}

/**
 * Decrypt a file using a stored key and IV.
 */
export async function decryptFile(
  encryptedBlob: Blob,
  keyBase64: string,
  ivBase64: string
): Promise<Blob> {
  const key = await importKeyFromBase64(keyBase64);

  // Reconstruct IV
  const binary = atob(ivBase64);
  const iv = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    iv[i] = binary.charCodeAt(i);
  }

  const encryptedBuffer = await encryptedBlob.arrayBuffer();

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    encryptedBuffer
  );

  return new Blob([decryptedBuffer]);
}

/**
 * Store encryption keys for a file in localStorage.
 * Key storage format: 'zkdrop_key_<fileId>' → JSON { key, iv, originalName }
 */
const KEY_PREFIX = 'zkdrop_key_';

export function storeEncryptionKey(fileId: string, data: { key: string; iv: string; originalName: string }): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${KEY_PREFIX}${fileId}`, JSON.stringify(data));
  } catch { /* storage full */ }
}

export function getEncryptionKey(fileId: string): { key: string; iv: string; originalName: string } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${fileId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function removeEncryptionKey(fileId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${KEY_PREFIX}${fileId}`);
  } catch { /* ignore */ }
}
