'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import { X, Download, Copy, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { copyToClipboard } from '@/lib/utils';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileKey: string;    // u64 literal file key (used in URL path)
  fileName: string;
  ipfsCid?: string;
  mode: 'link' | 'ipfs';
}

export function QRCodeModal({ isOpen, onClose, fileKey, fileName, ipfsCid, mode }: QRCodeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/file/${fileKey}`
    : `https://zkdrop.app/file/${fileKey}`;

  const contentUrl = mode === 'ipfs' && ipfsCid
    ? `https://gateway.pinata.cloud/ipfs/${ipfsCid}`
    : shareUrl;

  const displayContent = mode === 'ipfs' && ipfsCid
    ? `IPFS: ${ipfsCid.slice(0, 20)}...`
    : `ZKDrop: /file/${fileId}`;

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setCopied(false);

    QRCode.toDataURL(contentUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#14532d',
        light: '#f0fdf4',
      },
    }).then((url) => {
      setQrDataUrl(url);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, [isOpen, contentUrl]);

  // ESC key to close modal (M8 fix)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `zkdrop-qr-${fileId.replace("0x", "").replace("field", "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}.png`;
    a.click();
  };

  const handleCopy = async () => {
    await copyToClipboard(contentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center">
          <h2 className="text-lg font-bold text-green-900">
            {mode === 'ipfs' ? 'IPFS QR Code' : 'Share File Link'}
          </h2>
          <p className="mt-1 text-sm text-gray-500 truncate max-w-[200px] mx-auto">{fileName}</p>
        </div>

        <div className="mt-6 flex justify-center">
          {loading ? (
            <div className="h-64 w-64 animate-pulse rounded-xl bg-gray-100" />
          ) : (
            <img
              src={qrDataUrl}
              alt={`QR Code for ${displayContent}`}
              className="rounded-xl border-4 border-green-100"
              width={256}
              height={256}
            />
          )}
        </div>

        <div className="mt-4 rounded-lg bg-green-50 p-3 text-center">
          <p className="font-mono text-xs text-green-800 break-all leading-relaxed">
            {contentUrl.length > 50 ? `${contentUrl.slice(0, 50)}...` : contentUrl}
          </p>
        </div>

        <div className="mt-5 flex gap-3">
          <Button variant="outline" onClick={handleCopy} className="flex-1">
            {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button onClick={handleDownload} className="flex-1">
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          Scan with any QR reader to access this file privately
        </p>
      </motion.div>
    </div>
  );
}

