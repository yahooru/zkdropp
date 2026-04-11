'use client';

import { motion } from 'framer-motion';
import { Upload, EyeOff, Share2, CreditCard, Shield, Database } from 'lucide-react';

const features = [
  {
    icon: Upload,
    title: 'IPFS Storage',
    description:
      'Files are stored on IPFS — distributed, resilient, and never tied to your identity on-chain.',
    color: 'from-green-400 to-emerald-500',
  },
  {
    icon: EyeOff,
    title: 'ZK Access Control',
    description:
      'Prove you have access without revealing who you are. Zero-knowledge cryptography protects every access check.',
    color: 'from-emerald-400 to-teal-500',
  },
  {
    icon: Share2,
    title: 'Selective Sharing',
    description:
      'Share with specific users or sell access. Your access list is encrypted — nobody sees who accesses your files.',
    color: 'from-teal-400 to-cyan-500',
  },
  {
    icon: CreditCard,
    title: 'Private Payments',
    description:
      'Get paid in Aleo Credits or USAD without revealing transaction amounts or counterparties.',
    color: 'from-cyan-400 to-blue-500',
  },
  {
    icon: Shield,
    title: 'On-Chain Privacy',
    description:
      'File ownership, access lists, and payments are all private by default on Aleo. Only proofs are public.',
    color: 'from-blue-400 to-indigo-500',
  },
  {
    icon: Database,
    title: 'Permanent Records',
    description:
      'Once uploaded, your file reference is immutably recorded. Access can be proven forever without intermediaries.',
    color: 'from-indigo-400 to-violet-500',
  },
];

export function Features() {
  return (
    <section className="py-24 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <h2 className="text-4xl font-bold text-green-900">
            Built for Privacy,{' '}
            <span className="bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
              Designed for Use
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-600">
            Every feature is designed with privacy at its core. Not an afterthought —
            built into the protocol itself.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4 }}
                className="group relative rounded-2xl border border-green-100 bg-white p-6 shadow-sm transition-all hover:shadow-xl hover:shadow-green-500/10 hover:border-green-200"
              >
                <div
                  className={`inline-flex items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} mb-4 h-12 w-12 shadow-lg`}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-green-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>

                {/* Hover glow effect */}
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-0 transition-opacity duration-300 group-hover:opacity-5`}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
