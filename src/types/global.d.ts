// Global type declarations

declare global {
  interface Window {
    aleo?: {
      puzzleWalletClient?: any;
      soter?: any;
      leo?: any;
      requestAccounts?: () => Promise<string[]>;
      connect?: () => Promise<string[]>;
    };
  }
}

export {};
