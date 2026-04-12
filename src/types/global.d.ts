// Global type declarations

declare global {
  interface BrowserWalletLike {
    [key: string]: unknown;
  }

  interface Window {
    aleo?: {
      puzzleWalletClient?: BrowserWalletLike;
      soter?: BrowserWalletLike;
      leo?: BrowserWalletLike;
      requestAccounts?: () => Promise<string[]>;
      connect?: () => Promise<string[]>;
    };
  }
}

export {};
