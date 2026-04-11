'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getTotalFileCount } from '@/lib/zkdrop';

interface StatItem {
  label: string;
  value: number;
  suffix: string;
  color: string;
}

export function Stats() {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<StatItem[]>([
    { label: 'Files Stored', value: 0, suffix: '+', color: 'text-white' },
    { label: 'Privacy Protected', value: 100, suffix: '%', color: 'text-white' },
    { label: 'ZK Proofs Verified', value: 0, suffix: '+', color: 'text-white' },
    { label: 'USAD Transacted', value: 0, suffix: '', color: 'text-white' },
  ]);

  useEffect(() => {
    setMounted(true);

    const loadOnChainStats = async () => {
      try {
        const fileCount = await getTotalFileCount();
        setStats((prev) =>
          prev.map((s, i) =>
            i === 0 ? { ...s, value: Number(fileCount) } :
            i === 2 ? { ...s, value: Number(fileCount) } : s
          )
        );
      } catch {
        // Keep fallback values
      }
    };

    loadOnChainStats();
  }, []);

  return (
    <section className="py-20 bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((stat, i) => {
            const NumberComponent = () => {
              const [count, setCount] = useState(0);
              useEffect(() => {
                if (!mounted) return;
                const numValue = stat.value;
                if (numValue === 0) {
                  setCount(0);
                  return;
                }
                const step = Math.ceil(numValue / 50);
                const interval = setInterval(() => {
                  setCount((prev) => {
                    const next = prev + step;
                    if (next >= numValue) {
                      clearInterval(interval);
                      return numValue;
                    }
                    return next;
                  });
                }, 30);
                return () => clearInterval(interval);
              }, [mounted, stat.value]);

              return (
                <span className={`text-4xl font-bold lg:text-5xl ${stat.color}`}>
                  {mounted ? count.toLocaleString() : '0'}
                  {stat.suffix}
                </span>
              );
            };

            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <NumberComponent />
                <p className="mt-2 text-sm font-medium text-white/80">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
