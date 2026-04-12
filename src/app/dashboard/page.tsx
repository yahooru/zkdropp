'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, FileText, Download, Share2, Eye, Trash2, Copy, CheckCircle2, ExternalLink } from 'lucide-react';
import { useWallet } from '@/lib/wallet';
import { fromMicro } from '@/lib/aleo';
import { getUserFiles, getAddressTransactions, getBalances, removeFileByKey } from '@/lib/zkdrop';
import type { ZKDropFile, ZKDropTransaction } from '@/lib/zkdrop';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { copyToClipboard } from '@/lib/utils';

export default function DashboardPage() {
  const wallet = useWallet();
  const [activeTab, setActiveTab] = useState<'files' | 'activity'>('files');
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<ZKDropFile[]>([]);
  const [transactions, setTransactions] = useState<ZKDropTransaction[]>([]);
  const [balance, setBalance] = useState(BigInt(0));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address) return;

    setLoading(true);
    try {
      const [userFiles, txs, balances] = await Promise.all([
        getUserFiles(wallet.address),
        getAddressTransactions(wallet.address, 20),
        getBalances(wallet.address),
      ]);
      setFiles(userFiles);
      setTransactions(txs);
      setBalance(balances.credits);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, [wallet.isConnected, wallet.address]);

  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      loadData();
    } else {
      setFiles([]);
      setTransactions([]);
      setLoading(false);
    }
  }, [wallet.isConnected, wallet.address, loadData]);

  if (!wallet.isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
              <LayoutDashboard className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>Your Dashboard</CardTitle>
            <CardDescription>
              Connect your wallet to see your uploaded files and activity.
            </CardDescription>
          </CardHeader>
          <Button onClick={() => wallet.connect()} isLoading={wallet.isConnecting} size="lg" className="w-full">
            Connect Wallet
          </Button>
        </Card>
      </div>
    );
  }

  const totalFiles = files.length;
  const totalDownloads = files.reduce((sum, f) => sum + Number(f.accessCount), 0);
  const totalEarnings = files.reduce((sum, f) => {
    return sum + Number(f.accessCount) * Number(fromMicro(f.price));
  }, 0);

  return (
    <div className="min-h-[80vh] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-green-900">Dashboard</h1>
          <p className="mt-1 text-gray-600">
            Manage your uploaded files and track on-chain activity.
          </p>
          <p className="mt-2 text-sm text-green-700">
            Wallet balance: {fromMicro(balance).toFixed(2)} Credits
          </p>
        </motion.div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Total Files', value: loading ? '—' : totalFiles.toString(), icon: FileText, color: 'text-green-600' },
            { label: 'Total Downloads', value: loading ? '—' : totalDownloads.toString(), icon: Download, color: 'text-emerald-600' },
            { label: 'Total Earnings', value: loading ? '—' : `${totalEarnings.toFixed(1)} Credits`, icon: Share2, color: 'text-teal-600' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="flex items-center gap-4">
                  <div className={`rounded-xl bg-green-50 p-3 ${stat.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-900">{stat.value}</p>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl bg-green-50 p-1">
          {[
            { key: 'files', label: 'My Files', icon: FileText },
            { key: 'activity', label: 'Activity', icon: Eye },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'files' | 'activity')}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white text-green-700 shadow-sm'
                    : 'text-gray-600 hover:text-green-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : activeTab === 'files' ? (
          <div className="space-y-4">
            {files.length === 0 ? (
              <Card className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p className="text-gray-500">No files uploaded yet.</p>
                <Button onClick={() => window.location.href = '/upload'} className="mt-4">
                  Upload Your First File
                </Button>
              </Card>
            ) : (
              files.map((file, i) => (
                <motion.div
                  key={file.fileId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card hover className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                        <FileText className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-green-900">{file.name}</p>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <Badge variant={Number(file.price) === 0 ? 'success' : 'warning'} size="sm">
                            {Number(file.price) === 0 ? 'Free' : `${fromMicro(file.price)} Credits`}
                          </Badge>
                          {file.encrypted && (
                            <Badge variant="info" size="sm">
                              🔒 Encrypted
                            </Badge>
                          )}
                          {file.pending && (
                            <Badge variant="default" size="sm">
                              Pending
                            </Badge>
                          )}
                          <span className="text-xs text-gray-400">
                            {Number(file.accessCount)} accesses
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(file.createdAt * 1000).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Share"
                        onClick={() => {
                          copyToClipboard(`${typeof window !== 'undefined' ? window.location.origin : ''}/file/${file.fileKey}`);
                          setCopiedId(file.fileKey);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                      >
                        {copiedId === file.fileKey ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Open file page"
                        onClick={() => { window.location.href = `/file/${file.fileKey}`; }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete file"
                        onClick={() => setDeletingId(file.fileKey)}
                        className="hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.length === 0 ? (
              <Card className="text-center py-12">
                <Eye className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <p className="text-gray-500">No on-chain activity yet.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Upload a file or grant access to see transactions here.
                </p>
              </Card>
            ) : (
              transactions.map((tx, i) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg ${
                      tx.type === 'upload' ? 'bg-green-100' :
                      tx.type === 'access' ? 'bg-blue-100' :
                      tx.type === 'payment' ? 'bg-yellow-100' : 'bg-gray-100'
                    }`}>
                      {tx.type === 'upload' ? '📤' :
                       tx.type === 'access' ? '👁️' :
                       tx.type === 'payment' ? '💰' : '🔗'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900">{tx.description}</p>
                      <p className="text-xs text-gray-500">
                        {formatTime(tx.timestamp)}
                        {tx.blockHeight ? ` · Block ${tx.blockHeight}` : ''}
                      </p>
                    </div>
                    <p className="text-xs font-mono text-gray-400">{tx.txId.slice(0, 16)}...</p>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deletingId && (() => {
          const fileToDelete = files.find(f => f.fileKey === deletingId);
          return fileToDelete ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setDeletingId(null)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Delete File</h3>
                <p className="mt-2 text-sm text-gray-600">
                  This removes it from your local registry only. To fully remove from the
                  blockchain, use the &quot;Delete File&quot; button on the file detail page.
                </p>
                <div className="mt-6 flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setDeletingId(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={() => {
                      removeFileByKey(deletingId);
                      setFiles(prev => prev.filter(f => f.fileKey !== deletingId));
                      setDeletingId(null);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          ) : null;
        })()}
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const diff = Date.now() / 1000 - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}
