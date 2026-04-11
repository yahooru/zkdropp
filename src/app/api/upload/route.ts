// API Route: POST /api/upload
// Proxies IPFS upload to Pinata server-side so the JWT never touches the client.
// ─────────────────────────────────────────────────────────────────────────────
//
// Usage from frontend (no JWT exposure):
//   const formData = new FormData();
//   formData.append('file', fileBlob);
//   const res = await fetch('/api/upload', { method: 'POST', body: formData });
//   const { IpfsHash } = await res.json();
//
// Required env vars (server-side only, NOT prefixed with NEXT_PUBLIC_):
//   PINATA_JWT  — Pinata API JWT token
//
// Optional env vars:
//   PINATA_GATEWAY — Gateway base URL (default: https://gateway.pinata.cloud/ipfs/)
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';

const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

export async function POST(req: NextRequest) {
  const jwt = process.env.PINATA_JWT;

  if (!jwt || jwt === 'your_pinata_jwt_here' || jwt === '') {
    return NextResponse.json(
      { error: 'PINATA_JWT not configured on server. Set it in .env.local (no NEXT_PUBLIC_ prefix).' },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // SEC-4: Validate file size (max 100MB)
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 100MB.' }, { status: 413 });
    }

    // Basic MIME type check (allow any type but log for monitoring)
    const allowedMimes = [
      'application/pdf', 'image/', 'video/', 'audio/',
      'text/', 'application/json', 'application/zip',
      'application/x-', 'application/octet-stream',
    ];
    const mime = file instanceof File ? file.type : 'application/octet-stream';
    const isAllowed = allowedMimes.some(m => mime.startsWith(m) || mime === m || mime === 'application/octet-stream');
    if (!isAllowed && file.size > 0) {
      // Allow but log suspicious types — don't block, encrypted blobs are octet-stream
      console.warn(`[API /upload] Unusual MIME type: ${mime}`);
    }

    // Build Pinata request with metadata
    const pinataFormData = new FormData();
    pinataFormData.append('file', file);
    pinataFormData.append(
      'pinataMetadata',
      JSON.stringify({
        name: file instanceof File ? file.name : 'ZKDrop upload',
        keyvalues: {
          uploadedAt: new Date().toISOString(),
          app: 'ZKDrop',
        },
      })
    );
    pinataFormData.append(
      'pinataOptions',
      JSON.stringify({ cidVersion: 1 })
    );

    const response = await fetch(PINATA_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: pinataFormData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      return NextResponse.json(
        { error: `Pinata upload failed (${response.status}): ${text}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ IpfsHash: data.IpfsHash, name: data.name });
  } catch (error) {
    console.error('[API /upload]', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
