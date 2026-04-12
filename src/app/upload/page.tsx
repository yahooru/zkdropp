'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Coins,
  FileText,
  KeyRound,
  Lock,
  RefreshCw,
  Shield,
  Upload,
  X,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { useWallet } from '@/lib/wallet';
import { aleoConfig, toMicro } from '@/lib/aleo';
import { encryptFileForUpload, storeEncryptionKey } from '@/lib/crypto';
import { registerFile, waitForOnChainConfirmation } from '@/lib/zkdrop';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { isWalletLocalTransactionId, toAleoByteArrayLiteral, toFixedLengthBytes, toAleoFieldLiteral } from '@/lib/utils';

type UploadStep = 'idle' | 'uploading' | 'ipfs' | 'blockchain' | 'success' | 'error';

interface UploadState {
  step: UploadStep;
  file: File | null;
  ipfsCid: string | null;
  txId: string | null;
  error: string | null;
  fileId: string | null;
  fileKey: string | null;
  confirmationStatus: 'pending' | 'confirmed' | null;
}

const INITIAL_STATE: UploadState = {
  step: 'idle',
  file: null,
  ipfsCid: null,
  txId: null,
  error: null,
  fileId: null,
  fileKey: null,
  confirmationStatus: null,
};

export default function UploadPage() {
  const router = useRouter();
  const wallet = useWallet();
  const [state, setState] = useState<UploadState>(INITIAL_STATE);
  const [price, setPrice] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setState((current) => ({ ...current, file, step: 'uploading', error: null }));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024,
  });

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    setPrice('');
    setCheckingStatus(false);
  }, []);

  // One-shot status check: polls 10 times at 2s intervals (20s total).
  // Designed to be triggered manually by the user after seeing the success screen.
  const handleCheckStatus = useCallback(async () => {
    if (!state.fileKey || !state.txId) {
      return;
    }
    setCheckingStatus(true);
    try {
      const result = await waitForOnChainConfirmation(
        state.fileKey,
        10,
        state.txId ?? undefined,
        wallet.checkTransactionStatus
      );
      if (result.confirmed) {
        setState((current) => ({ ...current, confirmationStatus: 'confirmed' }));
      } else if (result.rejected) {
        setState((current) => ({
          ...current,
          step: 'error',
          error: `Blockchain rejected the transaction: ${result.reason ?? 'contract execution failed'}`,
        }));
      }
    } finally {
      setCheckingStatus(false);
    }
  }, [state.fileKey, state.txId, wallet.checkTransactionStatus]);

  const handleUpload = useCallback(async () => {
    if (!state.file || !wallet.address) return;

    setState((current) => ({ ...current, step: 'ipfs', error: null }));

    try {
      const parsedPrice = parseFloat(price);
      const normalizedPrice = Number.isFinite(parsedPrice) ? parsedPrice : 0;
      if (normalizedPrice < 0) {
        throw new Error('Price cannot be negative.');
      }

      const { encryptedBlob, keyBase64, ivBase64 } = await encryptFileForUpload(state.file);

      const formData = new FormData();
      const encryptedFile = new File([encryptedBlob], `${state.file.name}.enc`, {
        type: 'application/octet-stream',
      });
      formData.append('file', encryptedFile);
      formData.append('name', `${state.file.name} (encrypted)`);

      const ipfsResponse = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!ipfsResponse.ok) {
        const errorBody = await ipfsResponse.json().catch(() => ({ error: ipfsResponse.statusText }));
        throw new Error(errorBody.error || 'IPFS upload failed');
      }

      const { IpfsHash: cid } = (await ipfsResponse.json()) as { IpfsHash: string };
      setState((current) => ({ ...current, ipfsCid: cid, step: 'blockchain' }));

      const ipfsBytes = toFixedLengthBytes(cid, 64);
      const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array(ipfsBytes));
      const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      // file_id: Aleo field literal — decimal hex value + 'field' suffix
      const fileId = toAleoFieldLiteral(hashHex);
      const fileKey = `${new DataView(hashBuffer).getBigUint64(0).toString()}u64`;
      const unixTs = Math.floor(Date.now() / 1000);
      const priceMicro = toMicro(normalizedPrice);

      const inputs = [
        toAleoByteArrayLiteral(state.file.name, 64),
        toAleoByteArrayLiteral(cid, 64),
        `${priceMicro.toString()}u64`,
        fileKey,
        fileId,
        `${unixTs}u64`,
      ];

      console.debug('[ZKDrop] Executing upload_file with inputs:', inputs);
      console.debug(
        `[ZKDrop] program=${aleoConfig.programs.zkdrop}, function=upload_file, fileKey=${fileKey}, fileId=${fileId}`
      );

      // Use 10 credits fee — higher fee gives the proving service more time/computation
      // budget to generate the ZK proof for the complex upload_file function.
      // The actual Aleo fee for finalize execution is tiny (~0.001 credits);
      // the extra goes to the proving service's computational cost.
      const result = await wallet.execute(aleoConfig.programs.zkdrop, 'upload_file', inputs, 10.0);
      console.debug('[ZKDrop] Upload result: txId=', result.txId, 'error=', result.error);

      if (!result.txId) {
        if (result.error.includes('user rejected')) {
          throw new Error('Transaction cancelled by user.');
        }
        throw new Error(result.error || 'Transaction failed: no transaction id returned.');
      }

      if (isWalletLocalTransactionId(result.txId)) {
        console.warn(`[ZKDrop] Wallet returned local tx id: ${result.txId} — transaction may not be submitted to network yet`);
      }

      storeEncryptionKey(fileId, {
        key: keyBase64,
        iv: ivBase64,
        originalName: state.file.name,
      });

      registerFile({
        fileId,
        fileKey,
        cid,
        name: state.file.name,
        price: normalizedPrice,
        txId: result.txId ?? '',
        encrypted: true,
        unixTs,
        ownerAddress: wallet.address,
      });

      setState((current) => ({ ...current, step: 'blockchain', txId: result.txId ?? null }));

      // Poll until confirmed or timeout (2s intervals).
      // Shield Wallet ZK proving can take 30s–3min depending on network load.
      // We give it 40 retries = ~80s for the quick poll on success screen.
      // The "Check Status Now" button also triggers the same polling.
      const confirmResult = await waitForOnChainConfirmation(
        fileKey,
        isWalletLocalTransactionId(result.txId) ? 40 : 20,
        result.txId ?? undefined,
        wallet.checkTransactionStatus
      );

      if (confirmResult.rejected) {
        // Transaction was submitted but rejected on-chain — show specific error
        setState((current) => ({
          ...current,
          step: 'error',
          error: `Blockchain rejected the transaction: ${confirmResult.reason ?? 'contract execution failed'}. The file is still stored on IPFS but not on Aleo.`,
        }));
        return;
      }

      setState((current) => ({
        ...current,
        step: 'success',
        fileId,
        fileKey,
        txId: result.txId ?? null,
        confirmationStatus: confirmResult.confirmed ? 'confirmed' : 'pending',
      }));
    } catch (error) {
      console.error('[ZKDrop] Upload error:', error);
      setState((current) => ({
        ...current,
        step: 'error',
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  }, [price, state.file, wallet]);

  const steps = [
    { key: 'ipfs', label: 'IPFS Upload' },
    { key: 'blockchain', label: 'Aleo Blockchain' },
    { key: 'success', label: 'Complete' },
  ];
  const stepOrder: UploadStep[] = ['uploading', 'ipfs', 'blockchain', 'success', 'error'];
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
              <Shield className="mr-1 h-3 w-3" />
              Shield Wallet
            </Badge>
            <Badge variant="info" size="sm">
              <Coins className="mr-1 h-3 w-3" />
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
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-green-900">Upload Files</h1>
          <p className="mt-2 text-gray-600">
            Upload to IPFS and register on Aleo. Your file data and access lists stay private.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Badge variant="success" size="sm">
              <KeyRound className="mr-1 h-3 w-3" />
              AES-256-GCM Encrypted
            </Badge>
            <Badge variant="info" size="sm">
              IPFS Storage
            </Badge>
            <Badge variant="default" size="sm">
              <Shield className="mr-1 h-3 w-3" />
              {wallet.walletType}
            </Badge>
          </div>
        </motion.div>

        {state.step !== 'idle' && state.step !== 'error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8 flex items-center justify-center gap-2">
            {steps.map((step, index) => {
              const isComplete = index < currentStepIndex - 1;
              const isActive = index === currentStepIndex - 1;

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
                    {isComplete ? 'OK' : index + 1}
                  </div>
                  <span className={`text-sm ${index < currentStepIndex - 1 ? 'text-green-600' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                  {index < steps.length - 1 && <div className="h-px w-8 bg-gray-200" />}
                </div>
              );
            })}
          </motion.div>
        )}

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
                <Upload className="mx-auto mb-4 h-12 w-12 text-green-400" />
                <p className="text-lg font-medium text-green-800">
                  {isDragActive ? 'Drop your file here' : 'Drag and drop a file'}
                </p>
                <p className="mt-1 text-sm text-gray-500">or click to browse - Max 100MB</p>
              </div>
            </Card>
          </motion.div>
        )}

        {state.file && state.step !== 'success' && state.step !== 'error' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
            <Card className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                  <FileText className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-green-900">{state.file.name}</p>
                  <p className="text-sm text-gray-500">{(state.file.size / 1024 / 1024).toFixed(2)} MB</p>
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
                <CardTitle>Access Control and Pricing</CardTitle>
                <CardDescription>
                  Set an optional price in Aleo Credits. Leave empty for free access. Access grants are recorded
                  on-chain without exposing the file contents.
                </CardDescription>
              </CardHeader>
              <div className="space-y-4">
                <Input
                  label="Price (Credits)"
                  type="number"
                  placeholder="0.00"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  icon={<Coins className="h-4 w-4" />}
                />
                <p className="text-xs text-gray-500">
                  Access list is private by default. Payment uses <code className="rounded bg-gray-100 px-1">credits.aleo</code>.
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
                  Submitting to {wallet.walletType}...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  Upload to Aleo
                </>
              )}
            </Button>

            {state.ipfsCid && <p className="text-center text-xs text-gray-500">IPFS: {state.ipfsCid}</p>}
          </motion.div>
        )}

        {state.step === 'success' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-xl">
                {state.confirmationStatus === 'confirmed' ? 'File Confirmed on Aleo' : 'ZKDrop Submitted'}
              </CardTitle>
              <CardDescription className="mt-2">
                {state.confirmationStatus === 'confirmed'
                  ? 'Your encrypted file is stored on IPFS and visible in Aleo mappings.'
                  : 'Your encrypted file is on IPFS and the transaction was submitted to Aleo. Shield Wallet is generating the ZK proof in the background.'}
              </CardDescription>

              <div className="mt-6 space-y-3 text-left">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="mb-1 text-xs text-gray-500">IPFS CID</p>
                  <p className="break-all font-mono text-sm text-green-800">{state.ipfsCid}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="mb-1 text-xs text-gray-500">Transaction ID</p>
                  <p className="break-all font-mono text-sm text-green-800">{state.txId}</p>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="mb-1 text-xs font-medium text-green-600">ZKDrop Contract</p>
                  <p className="font-mono text-sm text-green-800">{aleoConfig.programs.zkdrop}</p>
                </div>

                {state.confirmationStatus === 'confirmed' ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                    <p className="mb-1 text-xs font-medium text-green-700">On-chain Status</p>
                    <p className="text-sm text-green-800">Confirmed — file is live and ready to share.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="mb-1 text-xs font-medium text-amber-700">On-chain Status</p>
                    <p className="text-sm text-amber-800">
                      ZK proof is generating. Shield Wallet creates the proof in the background — this can take 30 seconds to 3 minutes depending on network load.
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      <Button
                        onClick={handleCheckStatus}
                        isLoading={checkingStatus}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className="h-3 w-3" />
                        {checkingStatus ? 'Checking...' : 'Check Status Now'}
                      </Button>
                      <a
                        href={`https://explorer.provable.com/program/${aleoConfig.programs.zkdrop}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        View on Aleo Explorer
                      </a>
                    </div>
                  </div>
                )}
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

        {state.step === 'error' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Card className="border-red-200 bg-red-50 text-center">
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
