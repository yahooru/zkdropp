// Aleo read-only utilities using @provablehq/sdk
// ─────────────────────────────────────────────────────────────────────────────
// These functions are for READ-ONLY operations (no wallet needed).
// For write operations (transfers, contract execution), use the wallet adapter:
//   import { useWallet } from '@/lib/wallet'
//   const { transferCredits, transferUSAD, execute } = useWallet()
// ─────────────────────────────────────────────────────────────────────────────

import { aleoConfig } from './aleo';

interface AleoPaymentTransactionLike {
  block_height?: number;
  type?: string;
}

/**
 * Check public balance via AleoNetworkClient.
 * Works without a wallet connection.
 */
export async function getBalance(
  address: string,
  programId: string = aleoConfig.programs.credits
): Promise<bigint> {
  try {
    const { AleoNetworkClient } = await import('@provablehq/sdk');
    const networkClient = new AleoNetworkClient(aleoConfig.rpcUrl);
    const balance = await networkClient.getProgramMappingValue(programId, 'account', address);
    return balance ? BigInt(balance) : BigInt(0);
  } catch (error) {
    console.error('Get balance error:', error);
    return BigInt(0);
  }
}

/**
 * Get transaction status from the Aleo network.
 */
export async function getTransactionStatus(txId: string): Promise<{
  status: string;
  type: string;
  blockHeight?: number;
}> {
  try {
    const { AleoNetworkClient } = await import('@provablehq/sdk');
    const networkClient = new AleoNetworkClient(aleoConfig.rpcUrl);
    const tx = await networkClient.getTransaction(txId) as AleoPaymentTransactionLike | null;
    return {
      status: 'confirmed',
      type: tx?.type || 'unknown',
      blockHeight: tx?.block_height,
    };
  } catch {
    return { status: 'failed', type: 'unknown' };
  }
}

/**
 * Call a read-only view function on any Aleo program.
 * Uses the Aleo REST API (Provable v2).
 */
export async function callViewFunction(
  programId: string,
  functionName: string,
  inputs: string[]
): Promise<{ outputs?: unknown; error?: string }> {
  try {
    const baseUrl = aleoConfig.rpcUrl.replace(/\/$/, '');
    const url = `${baseUrl}/testnet/program/${programId}/${functionName}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { error: `View function failed (${response.status}): ${errText}` };
    }

    const data = await response.json();
    return { outputs: data?.outputs || data };
  } catch (error) {
    console.error('View function error:', error);
    return { error: String(error) };
  }
}

/**
 * Get the latest block height from Aleo testnet.
 */
export async function getLatestBlockHeight(): Promise<number> {
  try {
    const { AleoNetworkClient } = await import('@provablehq/sdk');
    const networkClient = new AleoNetworkClient(aleoConfig.rpcUrl);
    return await networkClient.getLatestHeight();
  } catch {
    return 0;
  }
}
