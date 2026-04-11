import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Truncate text
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}...${str.slice(-4)}`;
}

// Generate a unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Check if running in browser
export const isBrowser = typeof window !== 'undefined';

// Local storage helpers with SSR safety
export const storage = {
  get: (key: string, fallback: any = null) => {
    if (!isBrowser) return fallback;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key: string, value: any) => {
    if (!isBrowser) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage errors
    }
  },
  remove: (key: string) => {
    if (!isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore
    }
  },
};
