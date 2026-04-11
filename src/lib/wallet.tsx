'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { aleoConfig } from './aleo';
import '@provablehq/aleo-wallet-adaptor-react-ui/dist/styles.css';

// Core wallet provider
import {
  AleoWalletProvider as ProvableWalletProvider,
  useWallet as useAleoWallet,
} from '@provablehq/aleo-wallet-adaptor-react';

// UI components + modal visibility hook
import {
  WalletModalProvider,
  useWalletModal,
} from '@provablehq/aleo-wallet-adaptor-react-ui';

import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield';
import { LeoWalletAdapter } from '@provablehq/aleo-wallet-adaptor-leo';
import { SoterWalletAdapter } from '@provablehq/aleo-wallet-adaptor-soter';
import { PuzzleWalletAdapter } from '@provablehq/aleo-wallet-adaptor-puzzle';
import { Network } from '@provablehq/aleo-types';
import { DecryptPermission } from '@provablehq/aleo-wallet-adaptor-core';
import type { TransactionOptions } from '@provablehq/aleo-types';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ZKDropWalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  walletType: string;
  publicKey: string | null;
  network: Network | null;
  balances: Record<string, bigint>;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  getBalance: (programId: string) => Promise<bigint>;
  execute: (programId: string, functionName: string, inputs: string[], fee?: number) => Promise<{ txId?: string; error: string }>;
  transferCredits: (recipient: string, amount: bigint) => Promise<{ txId?: string; error: string }>;
  transferUSAD: (recipient: string, amount: bigint) => Promise<{ txId?: string; error: string }>;
  deleteFile: (fileKey: string, fileId: string, fileRecordCiphertext: string) => Promise<{ txId?: string; error: string }>;
  updateName: (fileKey: string, fileId: string, newName: string, fileRecordCiphertext: string) => Promise<{ txId?: string; error: string }>;
  /** Get all FileRecord ciphertexts for this program from the wallet */
  getFileRecords: () => Promise<string[]>;
  /** Decrypt an Aleo record ciphertext using the wallet's view key */
  decryptRecord: (ciphertext: string) => Promise<string>;
}

const ZKDropWalletContext = createContext<ZKDropWalletState>({
  address: null,
  isConnected: false,
  isConnecting: false,
  walletType: '',
  publicKey: null,
  network: null,
  balances: {},
  connect: async () => {},
  disconnect: async () => {},
  getBalance: async () => BigInt(0),
  execute: async () => ({ error: 'Not connected' }),
  transferCredits: async () => ({ error: 'Not connected' }),
  transferUSAD: async () => ({ error: 'Not connected' }),
  deleteFile: async () => ({ error: 'Not connected' }),
  updateName: async () => ({ error: 'Not connected' }),
  getFileRecords: async () => [],
  decryptRecord: async () => { throw new Error('Wallet not connected'); },
});

export function useWallet(): ZKDropWalletState {
  return useContext(ZKDropWalletContext);
}

// ─────────────────────────────────────────────────────────────
// Wallet Config
// ─────────────────────────────────────────────────────────────

const PROGRAMS = [
  aleoConfig.programs.zkdrop,
  aleoConfig.programs.credits,
  aleoConfig.programs.usad,
];

export interface WalletInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  getAdapter: () => any;
}

const WALLET_CONFIGS: WalletInfo[] = [
  {
    id: 'shield',
    name: 'Shield Wallet',
    icon: '🛡️',
    description: 'Official Aleo wallet by Provable',
    getAdapter: () => new ShieldWalletAdapter({ programs: PROGRAMS, appName: 'ZKDrop' }),
  },
  {
    id: 'leo',
    name: 'Leo Wallet',
    icon: '🦁',
    description: 'Aleo Explorer wallet (leo.provable.xyz)',
    getAdapter: () => new LeoWalletAdapter({
      appName: 'ZKDrop',
      appDescription: 'Privacy-first file sharing on Aleo',
      programIdPermissions: { testnet: PROGRAMS, mainnet: PROGRAMS },
    }),
  },
  {
    id: 'soter',
    name: 'Soter Wallet',
    icon: '🔐',
    description: 'Soter secure wallet',
    getAdapter: () => new SoterWalletAdapter({
      appName: 'ZKDrop',
      appDescription: 'Privacy-first file sharing on Aleo',
      programIdPermissions: { testnet: PROGRAMS, mainnet: PROGRAMS },
    }),
  },
  {
    id: 'puzzle',
    name: 'Puzzle Wallet',
    icon: '🧩',
    description: 'Puzzle wallet by Provable',
    getAdapter: () => new PuzzleWalletAdapter(),
  },
];

// ─────────────────────────────────────────────────────────────
// Wallet Provider
// ─────────────────────────────────────────────────────────────

export function ZKDropWalletProvider({ children }: { children: React.ReactNode }) {
  const adapters = useMemo(() => {
    return WALLET_CONFIGS.map((w) => w.getAdapter());
  }, []);

  return (
    <ProvableWalletProvider
      wallets={adapters}
      network={Network.TESTNET}
      decryptPermission={DecryptPermission.NoDecrypt}
      localStorageKey="zkdrop_wallet"
      autoConnect={false}
    >
      <WalletModalProvider>
        <ZKDropWalletInner>
          {children}
        </ZKDropWalletInner>
      </WalletModalProvider>
    </ProvableWalletProvider>
  );
}

// ─────────────────────────────────────────────────────────────
// Inner component that bridges AleoWallet state
// ─────────────────────────────────────────────────────────────

function ZKDropWalletInner({ children }: { children: React.ReactNode }) {
  const aleo = useAleoWallet();
  const { setVisible: setModalVisible } = useWalletModal();
  const [balances, setBalances] = useState<Record<string, bigint>>({});

  const address = aleo.address || null;
  const isConnected = aleo.connected || false;
  const isConnecting = aleo.connecting || false;
  const walletType = aleo.wallet?.adapter?.name || '';

  // Connect: open the official modal so user picks a wallet
  const connect = useCallback(async () => {
    if (isConnected) return;
    setModalVisible(true);
  }, [isConnected, setModalVisible]);

  // Disconnect
  const disconnect = useCallback(async () => {
    try {
      await aleo.disconnect();
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }, [aleo]);

  // Get balance for a program
  const getBalance = useCallback(async (programId: string): Promise<bigint> => {
    if (!address) return BigInt(0);
    try {
      const { AleoNetworkClient } = await import('@provablehq/sdk');
      const networkClient = new AleoNetworkClient(aleoConfig.rpcUrl);
      const balance = await networkClient.getProgramMappingValue(programId, 'account', address);
      return balance ? BigInt(balance) : BigInt(0);
    } catch (error) {
      return BigInt(0);
    }
  }, [address]);

  // Execute a contract function
  const execute = useCallback(async (
    programId: string,
    functionName: string,
    inputs: string[],
    fee: number = 2.0
  ): Promise<{ txId?: string; error: string }> => {
    if (!isConnected) return { error: 'No wallet connected. Please connect your wallet first.' };

    try {
      const options: TransactionOptions = {
        program: programId,
        function: functionName,
        inputs: inputs,
        fee: Math.floor(fee * 1000000),
      };
      const result = await aleo.executeTransaction(options);
      return { txId: result?.transactionId, error: '' };
    } catch (error) {
      const msg = String(error);
      console.error('Execute error:', msg);
      return { error: msg };
    }
  }, [aleo, isConnected]);

  // Transfer Aleo Credits
  // NOTE (RH1): Uses transfer_public — amount and recipient are visible on-chain.
  // For true privacy, transfer_private would be needed (requires private record inputs).
  const transferCredits = useCallback(async (
    recipient: string,
    amount: bigint
  ): Promise<{ txId?: string; error: string }> => {
    if (!isConnected) return { error: 'No wallet connected' };
    try {
      const options: TransactionOptions = {
        program: aleoConfig.programs.credits,
        function: 'transfer_public',
        inputs: [recipient, `${amount.toString()}u64`],
        fee: 2000000,
      };
      const result = await aleo.executeTransaction(options);
      return { txId: result?.transactionId, error: '' };
    } catch (error) {
      return { error: String(error) };
    }
  }, [aleo, isConnected]);

  // Transfer USAD
  const transferUSAD = useCallback(async (
    recipient: string,
    amount: bigint
  ): Promise<{ txId?: string; error: string }> => {
    if (!isConnected) return { error: 'No wallet connected' };
    try {
      const options: TransactionOptions = {
        program: aleoConfig.programs.usad,
        function: 'transfer_public',
        inputs: [recipient, `${amount.toString()}u64`],
        fee: 2000000,
      };
      const result = await aleo.executeTransaction(options);
      return { txId: result?.transactionId, error: '' };
    } catch (error) {
      return { error: String(error) };
    }
  }, [aleo, isConnected]);

  // Get FileRecord ciphertexts from the connected wallet.
  // The page component should decrypt these and find the one matching file_id + file_key.
  const getFileRecords = useCallback(async (): Promise<string[]> => {
    if (!isConnected || !address) return [];
    try {
      // aleo.requestRecords is available on the base wallet hook
      const records = await (aleo as any).requestRecords?.(aleoConfig.programs.zkdrop, true);
      if (!records) return [];
      return records.map((r: any) => r.record || r.recordCiphertext || r.ciphertext || '');
    } catch {
      return [];
    }
  }, [isConnected, address, aleo]);

  // delete_file: requires FileRecord as last parameter.
  // The caller (page component) must find the FileRecord and pass it as raw ciphertext string.
  const deleteFile = useCallback(async (
    fileKey: string,
    fileId: string,
    fileRecordCiphertext: string
  ): Promise<{ txId?: string; error: string }> => {
    if (!isConnected) return { error: 'No wallet connected' };
    try {
      const options: TransactionOptions = {
        program: aleoConfig.programs.zkdrop,
        function: 'delete_file',
        inputs: [fileKey, fileId, fileRecordCiphertext],
        fee: 2000000,
      };
      const result = await aleo.executeTransaction(options);
      return { txId: result?.transactionId, error: '' };
    } catch (error) {
      return { error: String(error) };
    }
  }, [aleo, isConnected]);

  // update_name: requires FileRecord as last parameter.
  const updateName = useCallback(async (
    fileKey: string,
    fileId: string,
    newName: string,
    fileRecordCiphertext: string
  ): Promise<{ txId?: string; error: string }> => {
    if (!isConnected) return { error: 'No wallet connected' };
    try {
      const nameBytes = [];
      for (let i = 0; i < 64; i++) {
        nameBytes.push(i < newName.length ? newName.charCodeAt(i) : 0);
      }
      const nameInput = `[${nameBytes.map(b => `${b}u8`).join(', ')}]`;
      const options: TransactionOptions = {
        program: aleoConfig.programs.zkdrop,
        function: 'update_name',
        inputs: [fileKey, fileId, nameInput, fileRecordCiphertext],
        fee: 2000000,
      };
      const result = await aleo.executeTransaction(options);
      return { txId: result?.transactionId, error: '' };
    } catch (error) {
      return { error: String(error) };
    }
  }, [aleo, isConnected]);

  // Load balances when connected
  useEffect(() => {
    if (isConnected && address) {
      Promise.all([
        getBalance(aleoConfig.programs.credits),
        getBalance(aleoConfig.programs.usad),
      ]).then(([creditsBalance, usadBalance]) => {
        setBalances({
          credits: creditsBalance,
          usad: usadBalance,
        });
      });
    } else {
      setBalances({});
    }
  }, [isConnected, address, getBalance]);

  const state: ZKDropWalletState = {
    address,
    isConnected,
    isConnecting,
    walletType,
    publicKey: address,
    network: aleo.network,
    balances,
    connect,
    disconnect,
    getBalance,
    execute,
    transferCredits,
    transferUSAD,
    getFileRecords,
    deleteFile,
    updateName,
  };

  return (
    <ZKDropWalletContext.Provider value={state}>
      {children}
    </ZKDropWalletContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Re-export helpers from aleo lib for convenience
// ─────────────────────────────────────────────────────────────

export { formatAddress } from './aleo';
