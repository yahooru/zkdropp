import Link from 'next/link';
import { Shield, Globe, Code2 } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-green-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/30">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-green-900">
                ZK<span className="text-green-500">Drop</span>
              </span>
            </div>
            <p className="text-sm text-gray-600 max-w-md leading-relaxed">
              Privacy-first decentralized file sharing on Aleo. Upload, share, and monetize files
              with zero-knowledge access control. Your data, your rules.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Powered by Aleo · Zero-Knowledge Proofs
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-green-900 mb-4">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/upload" className="text-gray-600 hover:text-green-600 transition-colors">Upload Files</Link></li>
              <li><Link href="/files" className="text-gray-600 hover:text-green-600 transition-colors">Browse Files</Link></li>
              <li><Link href="/dashboard" className="text-gray-600 hover:text-green-600 transition-colors">Dashboard</Link></li>
              <li><Link href="/payments" className="text-gray-600 hover:text-green-600 transition-colors">Payments</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-green-900 mb-4">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://www.aleo.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-green-600 transition-colors"
                >
                  Aleo Docs
                </a>
              </li>
              <li>
                <a
                  href="https://docs.leo-lang.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-green-600 transition-colors"
                >
                  Leo Language
                </a>
              </li>
              <li>
                <a
                  href="https://docs.shieldwallet.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-600 hover:text-green-600 transition-colors"
                >
                  Shield Wallet
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-green-50 pt-8">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} ZKDrop. Built for the Aleo Privacy Buildathon.
          </p>
          <div className="flex items-center gap-4">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer"
               className="text-gray-400 hover:text-green-600 transition-colors">
              <Code2 className="h-5 w-5" />
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer"
               className="text-gray-400 hover:text-green-600 transition-colors">
              <Globe className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
