'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Shield, Lock, Upload, Share2, Zap } from 'lucide-react';

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  return (
    <section ref={ref} className="relative min-h-screen overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-50 via-white to-emerald-50">
        {/* Floating orbs */}
        <motion.div
          className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-green-200/30 blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 30, 0],
            y: [0, -20, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/2 -left-40 h-80 w-80 rounded-full bg-emerald-200/20 blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -20, 0],
            y: [0, 30, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        <motion.div
          className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-green-300/20 blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            y: [0, 20, 0],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#22c55e 1px, transparent 1px), linear-gradient(90deg, #22c55e 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      <motion.div
        style={{ y, opacity, scale }}
        className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-20"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8 flex justify-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-green-700 shadow-sm backdrop-blur-sm">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Privacy Buildathon Submission
          </div>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight"
        >
          <span className="text-green-900">Share Files.</span>
          <br />
          <span className="bg-gradient-to-r from-green-600 via-emerald-500 to-green-500 bg-clip-text text-transparent">
            Prove Access.
          </span>
          <br />
          <span className="text-green-900">Reveal Nothing.</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mx-auto mt-8 max-w-2xl text-center text-lg text-gray-600 leading-relaxed"
        >
          ZKDrop is a privacy-first decentralized file sharing platform. Upload to IPFS,
          control access with zero-knowledge proofs, and transact privately on Aleo.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="/upload"
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-green-500/30 transition-all hover:from-green-600 hover:to-emerald-600 hover:shadow-green-500/50 hover:-translate-y-0.5"
          >
            <Upload className="h-5 w-5" />
            Start Uploading
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              →
            </motion.span>
          </a>
          <a
            href="/files"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-green-200 bg-white px-8 py-4 text-base font-semibold text-green-700 hover:border-green-300 hover:bg-green-50 transition-all"
          >
            Browse Files
          </a>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-3"
        >
          {[
            { icon: Lock, text: 'Private Access' },
            { icon: Zap, text: 'ZK Proofs' },
            { icon: Share2, text: 'Selective Sharing' },
            { icon: Shield, text: 'On-Chain Privacy' },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.text}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 + i * 0.1 }}
                className="flex items-center gap-2 rounded-full border border-green-100 bg-white/80 px-4 py-2 text-sm text-gray-700 shadow-sm backdrop-blur-sm"
              >
                <Icon className="h-4 w-4 text-green-500" />
                {item.text}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-20 flex justify-center"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex h-8 w-5 items-start justify-center rounded-full border-2 border-green-300"
          >
            <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500" />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
