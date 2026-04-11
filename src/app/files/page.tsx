'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, FileText, Lock, Eye, CreditCard } from 'lucide-react';
import { useWallet, formatAddress } from '@/lib/wallet';
import { aleoConfig, fromMicro } from '@/lib/aleo';
import { getTotalFileCount, getFilesByIds, getRegistry } from '@/lib/zkdrop';
import type { ZKDropFile } from '@/lib/zkdrop';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';

// Demo/fallback files shown when no on-chain data is available
const FALLBACK_FILES: ZKDropFile[] = [];

export default function FilesPage() {
  const wallet = useWallet();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<ZKDropFile[]>([]);
  const [totalOnChain, setTotalOnChain] = useState<bigint | null>(null);

  useEffect(() => {
    const loadFiles = async () => {
      setLoading(true);
      try {
        // Get total file count from the public mapping
        const count = await getTotalFileCount();
        setTotalOnChain(count);

        if (count > BigInt(0)) {
          // For public browsing, derive file IDs from the local registry
          const registry = getRegistry();
          const ids = registry.map((e) => e.fileId).slice(0, 20);
          const onChainFiles = await getFilesByIds(ids);
          setFiles(onChainFiles);
        } else {
          setFiles([]);
        }
      } catch (error) {
        console.error('Failed to load files from chain:', error);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, []);

  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(search.toLowerCase()) ||
      file.owner.toLowerCase().includes(search.toLowerCase()) ||
      file.cid.toLowerCase().includes(search.toLowerCase());
    const price = Number(fromMicro(file.price));
    const matchesFilter =
      filter === 'all' || (filter === 'free' && price === 0) || (filter === 'paid' && price > 0);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-[80vh] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-green-900">Browse Files</h1>
          <p className="mt-1 text-gray-600">
            Discover and access files shared by the community.
            {totalOnChain !== null && (
              <span className="ml-2 text-sm text-green-600">
                {totalOnChain > BigInt(0)
                  ? `${totalOnChain} file${Number(totalOnChain) === 1 ? '' : 's'} on-chain`
                  : 'No files uploaded yet'}
              </span>
            )}
          </p>
        </motion.div>

        {/* Search & Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 flex flex-col gap-4 sm:flex-row"
        >
          <div className="flex-1">
            <Input
              placeholder="Search by name, owner, or CID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'free', 'paid'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-green-500 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-green-50'
                }`}
              >
                {f === 'all' ? 'All' : f === 'free' ? 'Free' : 'Paid'}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6 flex items-center gap-4 text-sm text-gray-500"
        >
          <span>{loading ? 'Loading...' : `${filteredFiles.length} file${filteredFiles.length === 1 ? '' : 's'}`}</span>
          <span className="h-4 w-px bg-gray-200" />
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            All access lists are private
          </span>
          <span className="h-4 w-px bg-gray-200" />
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            Data stored on Aleo + IPFS
          </span>
        </motion.div>

        {/* File grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-20">
            <Search className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            {totalOnChain === BigInt(0) ? (
              <>
                <p className="text-gray-500 font-medium">No files on-chain yet.</p>
                <p className="text-gray-400 text-sm mt-1">
                  Be the first to upload a file!
                </p>
                <Button
                  onClick={() => window.location.href = '/upload'}
                  className="mt-4"
                >
                  Upload First File
                </Button>
              </>
            ) : (
              <p className="text-gray-500">No files match your search.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredFiles.map((file, i) => (
              <motion.div
                key={file.fileId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/file/${file.fileKey}`}>
                  <Card
                    hover
                    className="h-full cursor-pointer"
                    gradient
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                        <FileText className="h-6 w-6 text-green-600" />
                      </div>
                      <Badge variant={Number(fromMicro(file.price)) === 0 ? 'success' : 'warning'} size="sm">
                        {Number(fromMicro(file.price)) === 0 ? 'Free' : `${fromMicro(file.price)} Credits`}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-green-900 truncate">{file.name}</h3>
                    <p className="mt-1 text-xs text-gray-500 font-mono truncate">
                      {formatAddress(file.owner, 6)}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {Number(file.accessCount)}
                      </span>
                      <span className="text-xs">
                        {new Date(file.createdAt * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
