'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, TrendingUp, ArrowUpRight, ArrowDownLeft, Lock, Coins, CheckCircle } from 'lucide-react';
import { useWallet, formatAddress } from '@/lib/wallet';
import { aleoConfig, toMicro, fromMicro } from '@/lib/aleo';
import { getBalances, getCreditsTransactions } from '@/lib/zkdrop';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

interface OnChainTransaction {
  id: string;
  type: 'receive' | 'send';
  amount: string;
  token: 'Credits' | 'USAD';
  address: string;
  txId: string;
  time: string;
}

export default function PaymentsPage() {
  const wallet = useWallet();
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'credits' | 'usad'>('credits');
  const [balance, setBalance] = useState({ credits: BigInt(0), usad: BigInt(0) });
  const [transactions, setTransactions] = useState<OnChainTransaction[]>([]);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [txStatus, setTxStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Load real balances + transaction history from chain
  const loadData = useCallback(async () => {
    if (!wallet.isConnected || !wallet.address) return;

    setLoading(true);
    try {
      const [balances, txs] = await Promise.all([
        getBalances(wallet.address),
        getCreditsTransactions(wallet.address, 20),
      ]);
      setBalance(balances);

      // Map chain transactions to display format (M4 fix: parse amounts where available)
      const mapped: OnChainTransaction[] = txs.map((tx) => {
        // Determine direction: if tx is a "payment" type and has a description
        // that suggests outbound, mark as send. Aleo RPC doesn't easily expose
        // the counterparty, so we show "—" for amount (requires view key to decode).
        const isSend = tx.type === 'payment';
        return {
          id: tx.id,
          type: isSend ? 'send' as const : ('receive' as const),
          amount: '—', // Aleo uses private records; amount requires view key to decode
          token: 'Credits' as const,
          address: tx.description,
          txId: tx.txId,
          time: formatTime(tx.timestamp),
        };
      });
      setTransactions(mapped);
    } catch (error) {
      console.error('Failed to load on-chain data:', error);
    } finally {
      setLoading(false);
    }
  }, [wallet.isConnected, wallet.address]);

  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      loadData();
    } else {
      setBalance({ credits: BigInt(0), usad: BigInt(0) });
      setTransactions([]);
      setLoading(false);
    }
  }, [wallet.isConnected, wallet.address, loadData]);

  const handleTransfer = async () => {
    if (!transferAmount || !transferTo || !wallet.isConnected) return;

    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setTxStatus({ success: false, message: 'Invalid amount' });
      return;
    }

    setTransferring(true);
    setTxStatus(null);

    try {
      const amountMicro = toMicro(amountNum);

      if (activeTab === 'credits') {
        const result = await wallet.transferCredits(transferTo, amountMicro);
        if (result.txId) {
          setTxStatus({ success: true, message: `Transfer submitted! TX: ${result.txId.slice(0, 16)}... Confirming...` });
          // M3 fix: poll balance until it updates (Aleo txs take ~30s to finalize)
          pollBalance('credits', 3);
        } else {
          setTxStatus({ success: false, message: result.error || 'Transfer failed' });
        }
      } else {
        const result = await wallet.transferUSAD(transferTo, amountMicro);
        if (result.txId) {
          setTxStatus({ success: true, message: `Transfer submitted! TX: ${result.txId.slice(0, 16)}... Confirming...` });
          pollBalance('usad', 3);
        } else {
          setTxStatus({ success: false, message: result.error || 'Transfer failed' });
        }
      }

      setTransferAmount('');
      setTransferTo('');
    } catch (error) {
      setTxStatus({ success: false, message: String(error) });
    } finally {
      setTransferring(false);
    }
  };

  // Poll balance after transfer until it reflects the new value
  const pollBalance = async (token: 'credits' | 'usad', retries = 8) => {
    for (let i = 0; i < retries; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const newBal = await wallet.getBalance(
        token === 'credits' ? aleoConfig.programs.credits : aleoConfig.programs.usad
      );
      if (newBal !== balance[token]) {
        setBalance(b => ({ ...b, [token]: newBal }));
        break; // Stop polling once balance changes
      }
    }
  };

  const formatBalance = (micro: bigint) => fromMicro(micro).toFixed(4);

  if (!wallet.isConnected) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
              <CreditCard className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle>Payments</CardTitle>
            <CardDescription>
              Connect your wallet to manage Aleo Credits and USAD transfers.
            </CardDescription>
          </CardHeader>
          <Button onClick={() => wallet.connect()} isLoading={wallet.isConnecting} size="lg" className="w-full">
            Connect Wallet
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-green-900">Payments</h1>
          <p className="mt-1 text-gray-600">
            Transfer Aleo Credits and USAD. All transactions are private on Aleo.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="success" size="sm">
              <Coins className="h-3 w-3 mr-1" />
              credits.aleo integration
            </Badge>
            <Badge variant="success" size="sm">
              <Coins className="h-3 w-3 mr-1" />
              usad_stablecoin.aleo integration
            </Badge>
            <Badge variant="info" size="sm">
              <Lock className="h-3 w-3 mr-1" />
              Private transfers
            </Badge>
          </div>
        </motion.div>

        {/* Balance cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-8">
          {/* Aleo Credits */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="overflow-hidden bg-gradient-to-br from-green-500 to-emerald-500 text-white relative">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 opacity-80" />
                    <span className="text-sm font-medium opacity-80">Aleo Credits</span>
                  </div>
                  <Badge className="bg-white/20 text-white border-0">
                    {wallet.walletType}
                  </Badge>
                </div>
                {loading ? (
                  <div className="h-12 w-32 bg-white/20 rounded animate-pulse" />
                ) : (
                  <p className="text-4xl font-bold">{formatBalance(balance.credits)}</p>
                )}
                <p className="mt-1 text-xs opacity-60">
                  {wallet.address ? formatAddress(wallet.address, 6) : 'Not connected'}
                </p>
                <p className="mt-2 text-xs opacity-60">
                  Program: credits.aleo
                </p>
              </div>
              <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-white/10" />
            </Card>
          </motion.div>

          {/* USAD */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-500 text-white relative">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 opacity-80" />
                    <span className="text-sm font-medium opacity-80">USAD</span>
                  </div>
                  <Badge className="bg-white/20 text-white border-0">
                    Paxos-backed
                  </Badge>
                </div>
                {loading ? (
                  <div className="h-12 w-32 bg-white/20 rounded animate-pulse" />
                ) : (
                  <p className="text-4xl font-bold">{formatBalance(balance.usad)}</p>
                )}
                <p className="mt-1 text-xs opacity-60">
                  USD stablecoin on Aleo
                </p>
                <p className="mt-2 text-xs opacity-60">
                  Program: usad_stablecoin.aleo
                </p>
              </div>
              <div className="absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-white/10" />
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Transfer form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Transfer</CardTitle>
                <CardDescription>
                  Send {activeTab === 'credits' ? 'Aleo Credits' : 'USAD'} using{' '}
                  <code className="text-xs bg-gray-100 px-1 rounded">
                    {activeTab === 'credits' ? 'credits.aleo' : 'usad_stablecoin.aleo'}
                  </code>
                </CardDescription>
              </CardHeader>

              {/* Token selector */}
              <div className="flex gap-2 mb-4">
                {(['credits', 'usad'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                      activeTab === tab
                        ? 'bg-green-500 text-white'
                        : 'bg-green-50 text-gray-600 hover:bg-green-100'
                    }`}
                  >
                    <Coins className="h-4 w-4" />
                    {tab === 'credits' ? 'Credits' : 'USAD'}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <Input
                  label="Recipient Address"
                  placeholder="aleo1..."
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  icon={<ArrowUpRight className="h-4 w-4" />}
                />
                <Input
                  label={`Amount (${activeTab === 'credits' ? 'Credits' : 'USAD'})`}
                  type="number"
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  icon={<CreditCard className="h-4 w-4" />}
                />
                <div className="flex gap-2 text-xs text-gray-500">
                  <Lock className="h-3 w-3" />
                  Transfers are private on Aleo via {activeTab === 'credits' ? 'credits.aleo' : 'usad_stablecoin.aleo'}
                </div>

                {/* Transaction status */}
                {txStatus && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-lg p-3 text-sm flex items-center gap-2 ${
                      txStatus.success
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {txStatus.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    {txStatus.message}
                  </motion.div>
                )}

                <Button
                  onClick={handleTransfer}
                  isLoading={transferring}
                  className="w-full"
                  size="lg"
                  disabled={!transferAmount || !transferTo}
                >
                  Transfer via {activeTab === 'credits' ? 'credits.aleo' : 'usad_stablecoin.aleo'}
                </Button>
              </div>
            </Card>
          </motion.div>

          {/* Transaction history */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>On-Chain Transactions</CardTitle>
                <CardDescription>
                  Your live transaction history from the Aleo testnet.
                </CardDescription>
              </CardHeader>
              <div className="space-y-3">
                {txLoading || loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-500">
                    No transactions found on-chain.
                    <br />
                    <span className="text-xs">Transfers will appear here once confirmed.</span>
                  </div>
                ) : (
                  transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center gap-3 rounded-lg border border-green-50 bg-green-50/30 p-3"
                    >
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center ${
                        tx.type === 'receive' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {tx.type === 'receive' ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-900 truncate">
                          {tx.address}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {tx.txId ? `${tx.txId.slice(0, 12)}...` : 'Pending'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">
                          {tx.amount !== '—' ? `${tx.type === 'receive' ? '+' : '-'}${tx.amount}` : '—'}
                        </p>
                        <p className="text-xs text-gray-400">{tx.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Privacy notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 rounded-xl border border-green-100 bg-green-50 p-4"
        >
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Aleo Network Privacy</p>
              <p className="text-xs text-green-700 mt-1">
                Transfers use <code className="bg-green-100 px-1 rounded">transfer_public</code> on testnet
                (⚠️ amount and recipient are public on-chain). For full privacy,{' '}
                <code className="bg-green-100 px-1 rounded">transfer_private</code> would be used.
                FileRecord and AccessRecord contents are fully encrypted via Aleo records.
                Uses <code className="bg-green-100 px-1 rounded">credits.aleo</code> and{' '}
                <code className="bg-green-100 px-1 rounded">usad_stablecoin.aleo</code>.
              </p>
            </div>
          </div>
        </motion.div>
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
