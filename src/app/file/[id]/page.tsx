'use client';

import { use } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Download, Lock, Eye, CreditCard, Copy, CheckCircle2,
  ArrowLeft, QrCode, ExternalLink, AlertCircle, Trash2, Edit3, UserPlus, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { useWallet, formatAddress } from '@/lib/wallet';
import { aleoConfig, fromMicro, toMicro } from '@/lib/aleo';
import { getFileDetails, hasAccess, sha256AccessKeyField, removeFileByKey } from '@/lib/zkdrop';
import { getIPFSUrl } from '@/lib/ipfs';
import { getEncryptionKey, decryptFile } from '@/lib/crypto';
import type { ZKDropFile } from '@/lib/zkdrop';
import { QRCodeModal } from '@/components/wallet/QRCodeModal';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { copyToClipboard } from '@/lib/utils';

export default function FileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: fileKey } = use(params);
  const wallet = useWallet();
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<ZKDropFile | null>(null);
  const [hasAccess_, setHasAccess_] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [payStep, setPayStep] = useState<'idle' | 'transfer' | 'grant' | 'done' | 'error'>('idle');
  const [payError, setPayError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrMode, setQrMode] = useState<'link' | 'ipfs'>('link');
  const [decryptError, setDecryptError] = useState(false);

  // Owner action state
  const [grantAddress, setGrantAddress] = useState('');
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantMsg, setGrantMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [revokeAddress, setRevokeAddress] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeMsg, setRevokeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newPrice, setNewPrice] = useState('');
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceMsg, setPriceMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [newName, setNewName] = useState('');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadFile = useCallback(async () => {
    setLoading(true);
    try {
      const fileData = await getFileDetails(fileKey);
      setFile(fileData);

      if (fileData) {
        // Check access if wallet is connected
        if (wallet.isConnected && wallet.address) {
          const access = await hasAccess(fileData.fileId, wallet.address);
          setHasAccess_(access);
        }
        // Free files are accessible to everyone
        if (Number(fromMicro(fileData.price)) === 0) {
          setHasAccess_(true);
        }
      }
    } catch (error) {
      console.error('Failed to load file:', error);
    } finally {
      setLoading(false);
    }
  }, [fileKey, wallet.address, wallet.isConnected]);

  useEffect(() => {
    loadFile();
  }, [loadFile]);

  // ─────────────────────────────────────────────────────────────────
  // Find FileRecord ciphertext from wallet for owner operations
  // ─────────────────────────────────────────────────────────────────
  async function findOwnerFileRecord(): Promise<string | null> {
    if (!wallet.isConnected || !file) return null;
    try {
      const records = await wallet.getFileRecords();
      if (!records || records.length === 0) {
        console.warn('[ZKDrop] No records found in wallet for zkdrop program. Make sure the upload transaction is confirmed in your wallet.');
        return null;
      }
      for (const rec of records) {
        if (!rec.ciphertext) continue;
        const plaintext = rec.plaintext || '';
        // Try to parse the decrypted plaintext JSON
        if (plaintext) {
          try {
            const parsed = JSON.parse(plaintext);
            // Check if this is a FileRecord with matching file_id and file_key
            if (parsed.file_id === file.fileId && String(parsed.file_key) === fileKey.replace('u64', '')) {
              return rec.ciphertext;
            }
          } catch {
            // Not a valid JSON, try raw ciphertext match
          }
        }
        // Fallback: try to find record where ciphertext contains the fileKey
        if (rec.ciphertext && rec.ciphertext.includes(fileKey.replace('u64', ''))) {
          return rec.ciphertext;
        }
      }
      console.warn(`[ZKDrop] FileRecord not found for fileKey=${fileKey}, fileId=${file.fileId}. Check that the upload TX is confirmed in your wallet.`);
      return null;
    } catch (error) {
      console.error('[ZKDrop] Error finding FileRecord:', error);
      return null;
    }
  }

  const handleCopyLink = async () => {
    await copyToClipboard(`${typeof window !== 'undefined' ? window.location.origin : ''}/file/${fileKey}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenQR = (mode: 'link' | 'ipfs') => {
    setQrMode(mode);
    setQrModalOpen(true);
  };

  // ─────────────────────────────────────────────────────────────────
  // Request access to a file
  // V2 contract: request_access(file_key, file_id, ipfs_hash, file_name, access_key, unix_ts)
  // ─────────────────────────────────────────────────────────────────
  const handleRequestAccess = async () => {
    if (!wallet.isConnected || !wallet.address || !file) {
      if (!wallet.isConnected) wallet.connect();
      return;
    }

    setRequesting(true);
    setPayStep('idle');
    setPayError(null);

    try {
      const price = Number(fromMicro(file.price));

      // ⚠️ Non-atomic risk: credits transfer happens before access grant.
      // If the access transaction fails, credits are lost. A future contract
      // upgrade should handle escrow atomically.
      if (price > 0) {
        console.warn('[ZKDrop] Non-atomic payment: credits sent before access grant confirmed. TX may need manual resolution if access fails.');
      }

      // Step 1: Pay credits if the file has a price
      if (price > 0) {
        setPayStep('transfer');
        const amount = toMicro(price).toString();
        const transferResult = await wallet.execute(
          aleoConfig.programs.credits,
          'transfer_public',
          [file.owner, `${amount}u64`],
          2.5
        );
        if (!transferResult.txId) {
          throw new Error(transferResult.error || 'Credit transfer failed');
        }
      }

      // Step 2: Record access grant on-chain
      setPayStep('grant');

      // Compute access_key = sha256(file_id + address)[0..8] as u64
      const encoder = new TextEncoder();
      const accessKeyData = encoder.encode(file.fileId + (wallet.address || ''));
      const accessKeyBuf = await crypto.subtle.digest('SHA-256', accessKeyData);
      const accessView = new DataView(accessKeyBuf);
      const accessKey = `${accessView.getBigUint64(0).toString()}u64`;

      // Build file_name as [u8; 64]
      const fileNameBytes = [];
      for (let i = 0; i < 64; i++) {
        fileNameBytes.push(i < file.name.length ? file.name.charCodeAt(i) : 0);
      }

      // Build ipfs_hash as [u8; 64] (from CID, padded)
      const ipfsBytes = [];
      for (let i = 0; i < 64; i++) {
        ipfsBytes.push(i < file.cid.length ? file.cid.charCodeAt(i) : 0);
      }

      const unixTs = Math.floor(Date.now() / 1000);

      // V2 request_access: (file_key, file_id, ipfs_hash, file_name, access_key, unix_ts)
      const grantResult = await wallet.execute(
        aleoConfig.programs.zkdrop,
        'request_access',
        [
          fileKey,                                     // file_key (u64)
          file.fileId,                                 // file_id (field)
          `[${ipfsBytes.map(b => `${b}u8`).join(', ')}]`, // ipfs_hash [u8; 64]
          `[${fileNameBytes.map(b => `${b}u8`).join(', ')}]`, // file_name [u8; 64]
          accessKey,                                   // access_key (u64)
          `${unixTs}u64`,                              // unix_ts
        ],
        2.0
      );

      if (grantResult.txId) {
        setPayStep('done');
        setHasAccess_(true);
      } else {
        throw new Error(grantResult.error || 'Access grant failed');
      }
    } catch (error) {
      console.error('Failed to request access:', error);
      setPayStep('error');
      setPayError(String(error));
    } finally {
      setRequesting(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Owner: grant access to a specific address
  // ─────────────────────────────────────────────────────────────────
  const handleGrantAccess = async () => {
    if (!wallet.isConnected || !file || !grantAddress.trim()) return;
    if (!/^aleo1[a-z0-9]{50,}$/i.test(grantAddress.trim())) {
      setGrantMsg({ type: 'error', text: 'Invalid Aleo address format.' });
      return;
    }
    setGrantLoading(true);
    setGrantMsg(null);
    try {
      const recipient = grantAddress.trim();

      // Compute access_key for the recipient
      const accessKeyField = await sha256AccessKeyField(file.fileId, recipient);
      const encoder = new TextEncoder();
      const data = encoder.encode(file.fileId + recipient);
      const buf = await crypto.subtle.digest('SHA-256', data);
      const view = new DataView(buf);
      const accessKey = `${view.getBigUint64(0).toString()}u64`;

      // Build file_name as [u8; 64]
      const fileNameBytes = [];
      for (let i = 0; i < 64; i++) {
        fileNameBytes.push(i < file.name.length ? file.name.charCodeAt(i) : 0);
      }

      // Build ipfs_hash as [u8; 64]
      const ipfsBytes = [];
      for (let i = 0; i < 64; i++) {
        ipfsBytes.push(i < file.cid.length ? file.cid.charCodeAt(i) : 0);
      }

      const unixTs = Math.floor(Date.now() / 1000);

      // V2: request_access(file_key, file_id, ipfs_hash, file_name, access_key, unix_ts)
      const result = await wallet.execute(
        aleoConfig.programs.zkdrop,
        'request_access',
        [
          fileKey,
          file.fileId,
          `[${ipfsBytes.map(b => `${b}u8`).join(', ')}]`,
          `[${fileNameBytes.map(b => `${b}u8`).join(', ')}]`,
          accessKey,
          `${unixTs}u64`,
        ],
        2.0
      );
      if (result.txId) {
        setGrantMsg({ type: 'success', text: `Access granted to ${formatAddress(recipient, 6)}! TX: ${result.txId.slice(0, 16)}...` });
        setGrantAddress('');
      } else {
        setGrantMsg({ type: 'error', text: result.error || 'Grant failed.' });
      }
    } catch (e) {
      setGrantMsg({ type: 'error', text: String(e) });
    } finally {
      setGrantLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Owner: revoke access for a specific address
  // V2: revoke_access(file_key, file_id, access_key, file_record)
  // ─────────────────────────────────────────────────────────────────
  const handleRevokeAccess = async () => {
    if (!wallet.isConnected || !file || !revokeAddress.trim()) return;
    if (!/^aleo1[a-z0-9]{50,}$/i.test(revokeAddress.trim())) {
      setRevokeMsg({ type: 'error', text: 'Invalid Aleo address format.' });
      return;
    }
    setRevokeLoading(true);
    setRevokeMsg(null);
    try {
      const user = revokeAddress.trim();

      // Compute access_key for the user
      const accessKeyField = await sha256AccessKeyField(file.fileId, user);
      const encoder = new TextEncoder();
      const data = encoder.encode(file.fileId + user);
      const buf = await crypto.subtle.digest('SHA-256', data);
      const view = new DataView(buf);
      const accessKey = `${view.getBigUint64(0).toString()}u64`;

      // Find our FileRecord from the wallet
      const fileRecordCipher = await findOwnerFileRecord();
      if (!fileRecordCipher) {
        setRevokeMsg({ type: 'error', text: 'FileRecord not found in wallet. Ensure your upload transaction is confirmed and the record is in your wallet.' });
        setRevokeLoading(false);
        return;
      }

      // V2 revoke_access: (file_key, file_id, access_key, file_record)
      const result = await wallet.execute(
        aleoConfig.programs.zkdrop,
        'revoke_access',
        [fileKey, file.fileId, accessKey, fileRecordCipher],
        2.0
      );
      if (result.txId) {
        setRevokeMsg({ type: 'success', text: `Access revoked for ${formatAddress(user, 6)}. TX: ${result.txId.slice(0, 16)}...` });
        setRevokeAddress('');
      } else {
        setRevokeMsg({ type: 'error', text: result.error || 'Revoke failed. Make sure your FileRecord is in your wallet.' });
      }
    } catch (e) {
      setRevokeMsg({ type: 'error', text: String(e) });
    } finally {
      setRevokeLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Owner: update file price
  // V2: update_price(file_key, file_id, new_price, file_record)
  // ─────────────────────────────────────────────────────────────────
  const handleUpdatePrice = async () => {
    if (!wallet.isConnected || !file) return;
    const priceNum = parseFloat(newPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setPriceMsg({ type: 'error', text: 'Invalid price.' });
      return;
    }
    setPriceLoading(true);
    setPriceMsg(null);
    try {
      // Find our FileRecord from the wallet
      const fileRecordCipher = await findOwnerFileRecord();
      if (!fileRecordCipher) {
        setPriceMsg({ type: 'error', text: 'FileRecord not found in wallet. Ensure your upload transaction is confirmed and the record is in your wallet.' });
        setPriceLoading(false);
        return;
      }

      // V2 update_price: (file_key, file_id, new_price, file_record)
      const result = await wallet.execute(
        aleoConfig.programs.zkdrop,
        'update_price',
        [fileKey, file.fileId, `${toMicro(priceNum).toString()}u64`, fileRecordCipher],
        2.0
      );
      if (result.txId) {
        setPriceMsg({ type: 'success', text: `Price updated to ${priceNum} Credits!` });
        setNewPrice('');
        await loadFile(); // Refresh data
      } else {
        setPriceMsg({ type: 'error', text: result.error || 'Update failed. Make sure your FileRecord is in your wallet.' });
      }
    } catch (e) {
      setPriceMsg({ type: 'error', text: String(e) });
    } finally {
      setPriceLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Owner: update file name
  // V2: update_name(file_key, file_id, new_name, file_record)
  // ─────────────────────────────────────────────────────────────────
  const handleUpdateName = async () => {
    if (!wallet.isConnected || !file || !newName.trim()) return;
    setNameLoading(true);
    setNameMsg(null);
    try {
      const fileRecordCipher = await findOwnerFileRecord();
      if (!fileRecordCipher) {
        setNameMsg({ type: 'error', text: 'FileRecord not found in wallet. Ensure your upload transaction is confirmed and the record is in your wallet.' });
        setNameLoading(false);
        return;
      }

      // Build name as [u8; 64]
      const nameBytes = [];
      for (let i = 0; i < 64; i++) {
        nameBytes.push(i < newName.length ? newName.charCodeAt(i) : 0);
      }

      // V2 update_name: (file_key, file_id, new_name, file_record)
      const result = await wallet.execute(
        aleoConfig.programs.zkdrop,
        'update_name',
        [fileKey, file.fileId, `[${nameBytes.map(b => `${b}u8`).join(', ')}]`, fileRecordCipher],
        2.0
      );
      if (result.txId) {
        setNameMsg({ type: 'success', text: `Name updated to "${newName}"!` });
        setNewName('');
        await loadFile();
      } else {
        setNameMsg({ type: 'error', text: result.error || 'Update failed.' });
      }
    } catch (e) {
      setNameMsg({ type: 'error', text: String(e) });
    } finally {
      setNameLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Owner: delete file
  // V2: delete_file(file_key, file_id, file_record)
  // ─────────────────────────────────────────────────────────────────
  const handleDeleteFile = async () => {
    if (!wallet.isConnected || !file) return;
    setDeleteLoading(true);
    setDeleteMsg(null);
    try {
      const fileRecordCipher = await findOwnerFileRecord();
      if (!fileRecordCipher) {
        setDeleteMsg({ type: 'error', text: 'FileRecord not found in wallet. Ensure your upload transaction is confirmed and the record is in your wallet.' });
        setDeleteLoading(false);
        return;
      }

      // V2 delete_file: (file_key, file_id, file_record)
      const result = await wallet.execute(
        aleoConfig.programs.zkdrop,
        'delete_file',
        [fileKey, file.fileId, fileRecordCipher],
        2.0
      );
      if (result.txId) {
        setDeleteMsg({ type: 'success', text: `File deleted! TX: ${result.txId.slice(0, 16)}...` });
        // Remove from local registry
        removeFileByKey(fileKey);
        // Refresh
        setTimeout(() => loadFile(), 2000);
      } else {
        setDeleteMsg({ type: 'error', text: result.error || 'Delete failed.' });
      }
    } catch (e) {
      setDeleteMsg({ type: 'error', text: String(e) });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!file) return;
    setDecryptError(false);
    setDownloading(true);
    try {
      const url = getIPFSUrl(file.cid);
      const response = await fetch(url);
      if (!response.ok) throw new Error('IPFS download failed');
      let blob = await response.blob();

      // Try to decrypt if encryption keys are available
      const encKey = getEncryptionKey(file.fileId);
      if (encKey) {
        try {
          blob = await decryptFile(blob, encKey.key, encKey.iv);
        } catch {
          console.warn('Decryption failed, saving encrypted blob as-is');
          setDecryptError(true);
        }
      }

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = encKey?.originalName ?? file.name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!file) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <CardTitle>File Not Found</CardTitle>
            <CardDescription>
              This file doesn&apos;t exist on-chain or has been removed.
            </CardDescription>
          </CardHeader>
          <Link href="/files">
            <Button className="w-full">Browse Files</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const isOwner = wallet.address?.toLowerCase() === file.owner?.toLowerCase();
  const isDeleted = Number(file.price) === 0 && file.accessCount === BigInt(0);

  return (
    <div className="min-h-[80vh] py-12">
      <QRCodeModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        fileKey={fileKey}
        fileName={file.name}
        ipfsCid={file.cid}
        mode={qrMode}
      />

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Back */}
        <Link href="/files" className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-green-600">
          <ArrowLeft className="h-4 w-4" />
          Back to files
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 gap-8 lg:grid-cols-3"
        >
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <Card gradient={!isDeleted}>
              <div className="flex items-start gap-4 mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100">
                  <FileText className="h-8 w-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold text-green-900">{file.name}</h1>
                    {isDeleted && (
                      <Badge variant="default">Deleted</Badge>
                    )}
                    {!isDeleted && (
                      <Badge variant={Number(fromMicro(file.price)) === 0 ? 'success' : 'warning'}>
                        {Number(fromMicro(file.price)) === 0 ? 'Free' : `${fromMicro(file.price)} Credits`}
                      </Badge>
                    )}
                    {isOwner && !isDeleted && (
                      <Badge variant="info">
                        <Eye className="h-3 w-3 mr-1" />
                        Your File
                      </Badge>
                    )}
                    {hasAccess_ && !isOwner && (
                      <Badge variant="success">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Access Granted
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500 font-mono truncate">{file.cid}</p>
                  {file.blockHeight > 0 && (
                    <p className="mt-1 text-xs text-gray-400">
                      Block {file.blockHeight} · {new Date(file.createdAt * 1000).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-4">
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <p className="text-lg font-bold text-green-900">{Number(fromMicro(file.price))}</p>
                  <p className="text-xs text-gray-500">Credits</p>
                </div>
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <p className="text-lg font-bold text-green-900">{Number(file.accessCount)}</p>
                  <p className="text-xs text-gray-500">Accesses</p>
                </div>
                <div className="rounded-lg bg-white/60 p-3 text-center">
                  <p className="text-xs font-bold text-green-900 truncate">
                    {new Date(file.createdAt * 1000).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500">Uploaded</p>
                </div>
              </div>
            </Card>

            {/* Actions */}
            {!isDeleted && (
              <Card>
                <CardHeader>
                  <CardTitle>Actions</CardTitle>
                </CardHeader>
                <div className="space-y-3">
                  {hasAccess_ || isOwner ? (
                    <>
                      <Button onClick={handleDownload} isLoading={downloading} size="lg" className="w-full">
                        <Download className="h-5 w-5" />
                        Download File
                      </Button>
                      {decryptError && (
                        <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>Decryption failed. The downloaded file may still be encrypted.</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={handleRequestAccess}
                        isLoading={requesting}
                        size="lg"
                        className="w-full"
                      >
                        {payStep === 'transfer' ? (
                          <>
                            <CreditCard className="h-5 w-5" />
                            Transferring {fromMicro(file.price)} Credits...
                          </>
                        ) : payStep === 'grant' ? (
                          <>
                            <Lock className="h-5 w-5 animate-pulse" />
                            Recording Access on-chain...
                          </>
                        ) : (
                          <>
                            <Lock className="h-5 w-5" />
                            {Number(fromMicro(file.price)) > 0
                              ? `Pay ${fromMicro(file.price)} Credits for Access`
                              : 'Request Access'}
                          </>
                        )}
                      </Button>
                      {payStep === 'error' && payError && (
                        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>{payError}</span>
                        </div>
                      )}
                      {payStep === 'done' && (
                        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Access granted! You can now download.</span>
                        </div>
                      )}
                    </>
                  )}
                  <Button onClick={handleCopyLink} variant="secondary" className="w-full">
                    {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Link Copied!' : 'Copy Share Link'}
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">File Information</CardTitle>
              </CardHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Owner</span>
                  <span className="font-mono text-green-800 truncate max-w-[120px]">
                    {formatAddress(file.owner, 6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">File Key</span>
                  <span className="font-mono text-green-800 text-xs truncate max-w-[120px]">
                    {fileKey.slice(0, 12)}...
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">IPFS CID</span>
                  <span className="font-mono text-green-800 text-xs truncate max-w-[120px]">
                    {file.cid.slice(0, 12)}...
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-green-900 text-xs">
                    {new Date(file.createdAt * 1000).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Storage</span>
                  <span className="text-green-900">IPFS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Privacy</span>
                  <span className="text-green-900">ZK Protected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Blockchain</span>
                  <span className="text-green-900">Aleo</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status</span>
                  <span className="text-green-900">{isDeleted ? 'Deleted' : 'Active'}</span>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Privacy Info</CardTitle>
              </CardHeader>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <Lock className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <p>FileRecord contents encrypted — owner-only</p>
                </div>
                <div className="flex items-start gap-2">
                  <Lock className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <p>Access uses per-user hashed keys</p>
                </div>
                <div className="flex items-start gap-2">
                  <CreditCard className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <p>Payments via credits.aleo on Aleo</p>
                </div>
                <div className="flex items-start gap-2">
                  <Eye className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p>Owner address and prices are public for discovery</p>
                </div>
              </div>
            </Card>

            {/* QR Code Sharing */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">QR Code Sharing</CardTitle>
              </CardHeader>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleOpenQR('link')}
                >
                  <QrCode className="h-4 w-4" />
                  Share Link QR
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleOpenQR('ipfs')}
                >
                  <ExternalLink className="h-4 w-4" />
                  IPFS Gateway QR
                </Button>
                <p className="text-xs text-gray-400 pt-1">
                  Scan to share or download via mobile
                </p>
              </div>
            </Card>

            {/* Owner actions */}
            {isOwner && !isDeleted && (
              <div className="space-y-4">
                {/* Grant Access */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-green-600" />
                      Grant Access
                    </CardTitle>
                  </CardHeader>
                  <p className="text-sm text-gray-500 mb-3">
                    Authorize a user to download this file.
                  </p>
                  <input
                    type="text"
                    value={grantAddress}
                    onChange={e => setGrantAddress(e.target.value)}
                    placeholder="aleo1..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono mb-2 focus:outline-none focus:border-green-400"
                  />
                  <Button
                    variant="secondary"
                    className="w-full"
                    isLoading={grantLoading}
                    onClick={handleGrantAccess}
                  >
                    Grant Access
                  </Button>
                  {grantMsg && (
                    <div className={`mt-2 text-sm rounded-lg p-2 ${grantMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {grantMsg.text}
                    </div>
                  )}
                </Card>

                {/* Revoke Access */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-red-500" />
                      Revoke Access
                    </CardTitle>
                  </CardHeader>
                  <p className="text-sm text-gray-500 mb-3">
                    Remove a user&apos;s access to this file.
                  </p>
                  <input
                    type="text"
                    value={revokeAddress}
                    onChange={e => setRevokeAddress(e.target.value)}
                    placeholder="aleo1..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono mb-2 focus:outline-none focus:border-green-400"
                  />
                  <Button
                    variant="danger"
                    className="w-full"
                    isLoading={revokeLoading}
                    onClick={handleRevokeAccess}
                  >
                    Revoke Access
                  </Button>
                  {revokeMsg && (
                    <div className={`mt-2 text-sm rounded-lg p-2 ${revokeMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {revokeMsg.text}
                    </div>
                  )}
                </Card>

                {/* Update Price */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Edit3 className="h-4 w-4 text-blue-500" />
                      Update Price
                    </CardTitle>
                  </CardHeader>
                  <p className="text-sm text-gray-500 mb-3">
                    Change the download price for this file.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                      placeholder="0.0"
                      min="0"
                      step="0.1"
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                    />
                    <span className="flex items-center text-sm text-gray-500">Credits</span>
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full mt-2"
                    isLoading={priceLoading}
                    onClick={handleUpdatePrice}
                  >
                    Update Price
                  </Button>
                  {priceMsg && (
                    <div className={`mt-2 text-sm rounded-lg p-2 ${priceMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {priceMsg.text}
                    </div>
                  )}
                </Card>

                {/* Update Name */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Edit3 className="h-4 w-4 text-purple-500" />
                      Update Name
                    </CardTitle>
                  </CardHeader>
                  <p className="text-sm text-gray-500 mb-3">
                    Change the file name shown on-chain.
                  </p>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="New file name..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-2 focus:outline-none focus:border-green-400"
                  />
                  <Button
                    variant="secondary"
                    className="w-full"
                    isLoading={nameLoading}
                    onClick={handleUpdateName}
                  >
                    Update Name
                  </Button>
                  {nameMsg && (
                    <div className={`mt-2 text-sm rounded-lg p-2 ${nameMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {nameMsg.text}
                    </div>
                  )}
                </Card>

                {/* Delete File */}
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-red-500" />
                      Delete File
                    </CardTitle>
                  </CardHeader>
                  <p className="text-sm text-gray-500 mb-3">
                    Remove from public listings. IPFS content persists.
                  </p>
                  <Button
                    variant="danger"
                    className="w-full"
                    isLoading={deleteLoading}
                    onClick={handleDeleteFile}
                  >
                    Delete File
                  </Button>
                  {deleteMsg && (
                    <div className={`mt-2 text-sm rounded-lg p-2 ${deleteMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {deleteMsg.text}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => loadFile()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
