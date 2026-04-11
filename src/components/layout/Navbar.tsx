'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Menu, X, Upload, Files, LayoutDashboard, CreditCard, Home, LogOut } from 'lucide-react';
import { useWallet, formatAddress } from '@/lib/wallet';

const WALLET_LABELS: Record<string, string> = {
  'Shield Wallet': 'Shield',
  'Soter Wallet': 'Soter',
  'Leo Wallet': 'Leo',
  'Puzzle Wallet': 'Puzzle',
};

export function Navbar() {
  const pathname = usePathname();
  const { isConnected, address, walletType, connect, disconnect } = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

  const walletLabel = WALLET_LABELS[walletType] || 'Wallet';
  const shortAddress = address ? formatAddress(address, 4) : '';

  const navLinks = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/files', label: 'Browse', icon: Files },
    { href: '/upload', label: 'Upload', icon: Upload },
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/payments', label: 'Payments', icon: CreditCard },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-green-100 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/30">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-green-900">
              ZK<span className="text-green-500">Drop</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-green-50 text-green-700'
                      : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Wallet Button */}
          <div className="flex items-center gap-3">
            {isConnected ? (
              /* Connected — show address dropdown */
              <div className="relative">
                <button
                  onClick={() => setWalletMenuOpen(!walletMenuOpen)}
                  className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
                >
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  {walletLabel} · {shortAddress}
                </button>

                <AnimatePresence>
                  {walletMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-56 rounded-xl border border-green-100 bg-white p-2 shadow-xl shadow-green-500/10 z-[201]"
                    >
                      <div className="px-3 py-2">
                        <p className="text-xs text-gray-500">Connected with</p>
                        <p className="text-sm font-medium text-green-900">{walletLabel}</p>
                      </div>
                      <div className="border-t border-green-50 my-1" />
                      <div className="px-3 py-2">
                        <p className="text-xs text-gray-500">Address</p>
                        <p className="text-xs font-mono text-green-800 break-all">{address}</p>
                      </div>
                      <div className="border-t border-green-50 my-1" />
                      <button
                        onClick={() => {
                          disconnect();
                          setWalletMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Disconnect
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Click outside to close */}
                {walletMenuOpen && (
                  <div
                    className="fixed inset-0 z-[200]"
                    onClick={() => setWalletMenuOpen(false)}
                  />
                )}
              </div>
            ) : (
              /* Not connected — show connect button */
              <button
                onClick={() => connect()}
                className="rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 transition-colors"
              >
                Connect Wallet
              </button>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg p-2 text-gray-600 hover:bg-green-50 md:hidden"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-green-50 py-4 md:hidden"
            >
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${
                        isActive
                          ? 'bg-green-50 text-green-700'
                          : 'text-gray-600 hover:bg-green-50'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}