'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Shield, Zap } from 'lucide-react';

export function CTA() {
  return (
    <section className="py-24 bg-white">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-green-600 to-emerald-600 p-12 text-center shadow-2xl shadow-green-500/20 lg:p-16"
        >
          {/* Background decoration */}
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

          <div className="relative">
            <div className="mb-6 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <Shield className="h-8 w-8 text-white" />
              </div>
            </div>

            <h2 className="text-3xl font-bold text-white lg:text-4xl">
              Ready to Experience Private File Sharing?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-green-100">
              Join the privacy revolution on Aleo. Upload your first file in under 2 minutes
              and experience zero-knowledge access control firsthand.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="/upload"
                className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-green-700 shadow-xl transition-all hover:bg-green-50 hover:shadow-white/20 hover:-translate-y-0.5"
              >
                <Zap className="h-5 w-5" />
                Upload Your First File
                <motion.span
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ArrowRight className="h-5 w-5" />
                </motion.span>
              </a>
              <a
                href="/files"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-white/30 px-8 py-4 text-base font-semibold text-white hover:bg-white/10 transition-all backdrop-blur-sm"
              >
                Explore Files
              </a>
            </div>

            <p className="mt-6 text-xs text-green-200">
              No account needed · Files encrypted on-chain · Payments are private
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
