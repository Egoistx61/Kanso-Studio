import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrandLogo } from './BrandLogo';

interface LoadingScreenProps {
  label?: string;
}

export function LoadingScreen({ label = 'Kanso Studio' }: LoadingScreenProps) {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      setVisible(false);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="kanso-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#f5f5f7] dark:bg-[#09090b] select-none pointer-events-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-5 px-8 py-7 rounded-2xl bg-white dark:bg-[#121215] border border-zinc-950/15 dark:border-white/15 shadow-black-lg min-w-[240px]"
          >
            <motion.div
              initial={{ scale: 0.8, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 24 }}
            >
              <BrandLogo className="w-11 h-11" animated />
            </motion.div>

            <div className="text-center space-y-1">
              <div className="font-display text-sm font-bold tracking-tight text-zinc-950 dark:text-white">
                {label}
              </div>
              <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                Preparing environment
              </div>
            </div>

            {/* GPU-composited progress hairline */}
            <div className="w-40 h-[2px] rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
                className="h-full w-full origin-left bg-zinc-950 dark:bg-white"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
