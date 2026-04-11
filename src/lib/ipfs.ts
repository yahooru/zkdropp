// IPFS file upload/download via Pinata

const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

function getGatewayUrl(): string {
  return process.env.NEXT_PUBLIC_PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
}

function getPinataJwt(): string | null {
  const jwt = process.env.PINATA_JWT;
  if (!jwt || jwt === 'your_pinata_jwt_here' || jwt === '') return null;
  return jwt;
}

// Upload file to IPFS via Pinata
export async function uploadToIPFS(file: File): Promise<{ cid: string; name: string; size: number }> {
  const jwt = getPinataJwt();

  if (!jwt) {
    throw new Error(
      'Pinata JWT not configured. Set PINATA_JWT in your .env.local file. ' +
      'Get a free JWT at https://pinata.cloud'
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('pinataMetadata', JSON.stringify({
    name: file.name,
    keyvalues: {
      type: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      app: 'ZKDrop',
    },
  }));
  formData.append('pinataOptions', JSON.stringify({
    cidVersion: 1,
  }));

  const response = await fetch(PINATA_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`IPFS upload failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return {
    cid: data.IpfsHash,
    name: file.name,
    size: file.size,
  };
}

// Upload JSON metadata to IPFS
export async function uploadJSONToIPFS(metadata: object): Promise<string> {
  const jwt = getPinataJwt();

  if (!jwt) {
    throw new Error('Pinata JWT not configured. Set PINATA_JWT in .env.local');
  }

  const response = await fetch(PINATA_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: {
        name: `ZKDrop metadata ${Date.now()}`,
        keyvalues: { app: 'ZKDrop' },
      },
      pinataOptions: { cidVersion: 1 },
    }),
  });

  if (!response.ok) {
    throw new Error(`IPFS JSON upload failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.IpfsHash;
}

// Download file from IPFS
export async function downloadFromIPFS(cid: string): Promise<Blob> {
  const url = `${getGatewayUrl()}${cid}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`IPFS download failed: ${response.statusText}`);
  }

  return response.blob();
}

// Get IPFS gateway URL for a CID
export function getIPFSUrl(cid: string): string {
  return `${getGatewayUrl()}${cid}`;
}
