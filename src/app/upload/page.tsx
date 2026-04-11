'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Upload, FileText, X, CheckCircle2, AlertCircle, Lock, Shield, Coins, KeyRound } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useWallet } from '@/lib/wallet';
import { aleoConfig, toMicro } from '@/lib/aleo';
import { registerFile } from '@/lib/zkdrop';
// FileRecord ciphertext will be retrieved from wallet via transaction history after upload.
import { encryptFileForUpload, storeEncryptionKey } from '@/lib/crypto';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

type UploadStep = 'idle' | 'uploading' | 'ipfs' | 'blockchain' | 'success' | 'error';

interface UploadState {
  step: UploadStep;
  file: File | null;
  ipfsCid: string | null;
  txId: string | null;
  error: string | null;
  fileId: string | null;
}

export default function UploadPage() {
  const router = useRouter();
  const wallet = useWallet();

  const [state, setState] = useState<UploadState>({
    step: 'idle',
    file: null,
    ipfsCid: null,
    txId: null,
    error: null,
    fileId: null,
  });

  const [price, setPrice] = useState('');
  const [fileName, setFileName] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setState((s) => ({ ...s, file, step: 'uploading' }));
      setFileName(file.name);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { '*': [] },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (!state.file || !wallet.address) return;

    setState((s) => ({ ...s, step: 'ipfs', error: null }));

    try {
      // Step 1: Encrypt the file with AES-256-GCM before upload (SEC-2: true E2E privacy)
      setState((s) => ({ ...s, step: 'ipfs', error: null }));
      const { encryptedBlob, keyBase64, ivBase64 } = await encryptFileForUpload(state.file);

      // Step 2: Upload encrypted blob to IPFS via server-side API route (C4 fix: JWT stays server-side)
      const formData = new FormData();
      const encryptedFile = new File([encryptedBlob], `${state.file.name}.enc`, {
        type: 'application/octet-stream',
      });
      formData.append('file', encryptedFile);
      formData.append('name', `${state.file.name} (encrypted)`);
      const ipfsRes = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!ipfsRes.ok) {
        const err = await ipfsRes.json().catch(() => ({ error: ipfsRes.statusText }));
        throw new Error(err.error || 'IPFS upload failed');
      }
      const { IpfsHash: cid } = await ipfsRes.json();
      setState((s) => ({ ...s, ipfsCid: cid, step: 'blockchain' }));

      // Step 2: Execute Aleo contract
      const nameBytes = nameToBytes(state.file.name);
      const priceMicro = toMicro(parseFloat(price) || 0);

      // Build IPFS bytes as [u8; 64] — pad or truncate CID to 64 bytes
      const paddedCid: string = cid.padEnd(64, '\0');
      const ipfsBytes: number[] = [];
      for (let i = 0; i < 64; i++) {
        ipfsBytes.push(i < paddedCid.length ? paddedCid.charCodeAt(i) : 0);
      }

      // Compute both the field file_id and u64 file_key for Aleo RPC compatibility.
      // file_id    = sha256(ipfs_bytes) as Aleo field literal (0x...field) — for contract inputs.
      // file_key   = sha256(ipfs_bytes)[0..8] as u64 literal — for Aleo RPC URL API.
      const ipfsHashBytes = new Uint8Array(ipfsBytes);
      const hashBuffer = await crypto.subtle.digest('SHA-256', ipfsHashBytes);
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const fileId = `0x${hashHex}field`;
      const view = new DataView(hashBuffer);
      const fileKey = `${view.getBigUint64(0).toString()}u64`;

      // Unix timestamp for human-readable dates (stored in contract and registry)
      const unixTs = Math.floor(Date.now() / 1000);

      // Build inputs for upload_file (6 params: name, ipfs_hash, price, file_key, file_id, unix_ts)
      const inputs = [
        `[${nameBytes.map(b => `${b}u8`).join(', ')}]`,
        `[${ipfsBytes.map(b => `${b}u8`).join(', ')}]`,
        `${priceMicro.toString()}u64`,
        fileKey,
        fileId,
        `${unixTs}u64`,
      ];

      const result = await wallet.execute(
        aleoConfig.programs.zkdrop,
        'upload_file',
        inputs,
        2.0
      );

      if (result.txId) {
        // Store encryption key in localStorage
        storeEncryptionKey(fileId, { key: keyBase64, iv: ivBase64, originalName: state.file.name });

        // Register file in local registry
        registerFile({
          fileId,
          fileKey,
          cid,
          name: state.file.name,
          price: parseFloat(price) || 0,
          txId: result.txId,
          encrypted: true,
          unixTs,
        });

        setState((s) => ({
          ...s,
          step: 'success',
          txId: result.txId || null,
          fileId,
        }));
      } else {
        throw new Error(result.error || 'Transaction failed — no txId returned');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setState((s) => ({
        ...s,
        step: 'error',
        error: String(error),
      }));
    }
  };

  const reset = () => {
    setState({ step: 'idle', file: null, ipfsCid: null, txId: null, error: null, fileId: null });
    setPrice('');
    setFileName('');
  };

  const steps = [
    { key: 'ipfs', label: 'IPFS Upload' },
    { key: 'blockchain', label: 'Aleo Blockchain' },
    { key: 'success', label: 'Complete' },
  ];
  const stepOrder = ['uploading', 'ipfs', 'blockchain', 'success', 'error'];
  const currentStepIndex = Math.max(0, stepOrder.indexOf(state.step));

  if (!wallet.isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
              <Lock className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>Connect Your Wallet</CardTitle>
            <CardDescription>
              Connect your Aleo wallet (Shield Wallet recommended) to upload files.
            </CardDescription>
          </CardHeader>
          <Button onClick={() => wallet.connect()} isLoading={wallet.isConnecting} size="lg" className="w-full">
            <Shield className="h-5 w-5" />
            Connect Wallet
          </Button>
          <div className="mt-4 flex justify-center gap-2">
            <Badge variant="success" size="sm">
              <Shield className="h-3 w-3 mr-1" />
              Shield Wallet
            </Badge>
            <Badge variant="info" size="sm">
              <Coins className="h-3 w-3 mr-1" />
              credits.aleo
            </Badge>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] py-12">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="text-3xl font-bold text-green-900">Upload Files</h1>
          <p className="mt-2 text-gray-600">
            Upload to IPFS and register on Aleo. Your file data and access lists stay private.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="success" size="sm">
              <KeyRound className="h-3 w-3 mr-1" />
              AES-256-GCM Encrypted
            </Badge>
            <Badge variant="info" size="sm">
              IPFS Storage
            </Badge>
            <Badge variant="default" size="sm">
              <Shield className="h-3 w-3 mr-1" />
              {wallet.walletType}
            </Badge>
          </div>
        </motion.div>

        {/* Progress steps */}
        {state.step !== 'idle' && state.step !== 'error' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-8 flex items-center justify-center gap-2"
          >
            {steps.map((step, i) => {
              const isComplete = i < currentStepIndex - 1;
              const isActive = i === currentStepIndex - 1;
              return (
                <div key={step.key} className="flex items-center gap-2">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      isComplete
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-green-100 text-green-600 ring-2 ring-green-500 animate-pulse'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isComplete ? '✓' : i + 1}
                  </div>
                  <span className={`text-sm ${i < currentStepIndex - 1 ? 'text-green-600' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                  {i < steps.length - 1 && <div className="h-px w-8 bg-gray-200" />}
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Drop zone */}
        {state.step === 'idle' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-2 border-dashed border-green-200 bg-green-50/50">
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                  isDragActive
                    ? 'border-green-500 bg-green-100'
                    : 'border-green-200 hover:border-green-400 hover:bg-green-50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-green-400 mb-4" />
                <p className="text-lg font-medium text-green-800">
                  {isDragActive ? 'Drop your file here' : 'Drag & drop a file'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  or click to browse · Max 100MB
                </p>
              </div>
            </Card>
          </motion.div>
        )}

        {/* File selected */}
        {state.file && state.step !== 'success' && state.step !== 'error' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <Card className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-900">{state.file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(state.file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={reset}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Access Control & Pricing</CardTitle>
                <CardDescription>
                  Set an optional price in Aleo Credits. Leave empty for free access.
                  Access control uses ZK proofs — only access grants are recorded on-chain.
                </CardDescription>
              </CardHeader>
              <div className="space-y-4">
                <Input
                  label="Price (Credits)"
                  type="number"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  icon={<Coins className="h-4 w-4" />}
                />
                <p className="text-xs text-gray-500">
                  Access list is private by default. Payment via{' '}
                  <code className="bg-gray-100 px-1 rounded">credits.aleo</code>.
                </p>
              </div>
            </Card>

            <Button
              onClick={handleUpload}
              isLoading={state.step === 'ipfs' || state.step === 'blockchain'}
              size="lg"
              className="w-full"
            >
              {state.step === 'blockchain' ? (
                <>
                  <Shield className="h-5 w-5" />
                  Confirm in {wallet.walletType}...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  Upload to Aleo
                </>
              )}
            </Button>

            {state.ipfsCid && (
              <p className="text-center text-xs text-gray-500">
                IPFS: {state.ipfsCid}
              </p>
            )}
          </motion.div>
        )}

        {/* Success */}
        {state.step === 'success' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-xl">File Uploaded Successfully!</CardTitle>
              <CardDescription className="mt-2">
                Your file is AES-256-GCM encrypted, stored on IPFS, and registered on Aleo with private access control.
              </CardDescription>

              <div className="mt-6 space-y-3 text-left">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-xs text-gray-500 mb-1">IPFS CID</p>
                  <p className="font-mono text-sm text-green-800 break-all">{state.ipfsCid}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-xs text-gray-500 mb-1">Transaction ID</p>
                  <p className="font-mono text-sm text-green-800 break-all">{state.txId}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-4 border border-green-200">
                  <p className="text-xs text-green-600 mb-1 font-medium">ZKDrop Contract</p>
                  <p className="font-mono text-sm text-green-800">{aleoConfig.programs.zkdrop}</p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button onClick={reset} variant="outline" className="flex-1">
                  Upload Another
                </Button>
                <Button onClick={() => router.push('/dashboard')} className="flex-1">
                  View Dashboard
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Error */}
        {state.step === 'error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="text-center border-red-200 bg-red-50">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <CardTitle className="text-xl text-red-900">Upload Failed</CardTitle>
              <CardDescription className="mt-2 text-red-700">{state.error}</CardDescription>
              <Button onClick={reset} className="mt-6" variant="danger">
                Try Again
              </Button>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function nameToBytes(name: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < 64; i++) {
    bytes.push(i < name.length ? name.charCodeAt(i) : 0);
  }
  return bytes;
}
