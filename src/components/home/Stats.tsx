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

function AnimatedStatNumber({ stat }: { stat: StatItem }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (stat.value === 0) return;

    const step = Math.ceil(stat.value / 50);
    const interval = setInterval(() => {
      setCount((previous) => {
        const next = previous + step;
        if (next >= stat.value) {
          clearInterval(interval);
          return stat.value;
        }
        return next;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [stat.value]);

  return (
    <span className={`text-4xl font-bold lg:text-5xl ${stat.color}`}>
      {count.toLocaleString()}
      {stat.suffix}
    </span>
  );
}

export function Stats() {
  const [stats, setStats] = useState<StatItem[]>([
    { label: 'Files Stored', value: 0, suffix: '+', color: 'text-white' },
    { label: 'Privacy Protected', value: 100, suffix: '%', color: 'text-white' },
    { label: 'ZK Proofs Verified', value: 0, suffix: '+', color: 'text-white' },
    { label: 'USAD Transacted', value: 0, suffix: '', color: 'text-white' },
  ]);

  useEffect(() => {
    const loadOnChainStats = async () => {
      try {
        const fileCount = await getTotalFileCount();
        setStats((previous) =>
          previous.map((stat, index) =>
            index === 0 || index === 2 ? { ...stat, value: Number(fileCount) } : stat
          )
        );
      } catch {
        // Keep fallback values if the RPC is unavailable.
      }
    };

    loadOnChainStats();
  }, []);

  return (
    <section className="bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <AnimatedStatNumber stat={stat} />
              <p className="mt-2 text-sm font-medium text-white/80">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
