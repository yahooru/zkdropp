'use client';

import { ZKDropWalletProvider } from '@/lib/wallet';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ZKDropWalletProvider>
      {children}
    </ZKDropWalletProvider>
  );
}
