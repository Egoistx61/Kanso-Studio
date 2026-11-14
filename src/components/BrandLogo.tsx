import { motion } from 'motion/react';

interface BrandLogoProps {
  className?: string;
  animated?: boolean;
}

export function BrandLogo({ className = 'w-6 h-6', animated = false }: BrandLogoProps) {
  return (
    <motion.svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      whileHover={{ scale: 1.06, rotate: -3 }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      className={className}
    >
      <rect
        x="2"
        y="2"
        width="28"
        height="28"
        rx="7"
        className="fill-zinc-950 dark:fill-white transition-colors"
      />
      <motion.path
        d="M11.5 11L7 16L11.5 21"
        className="stroke-white dark:stroke-zinc-950 transition-colors"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animated ? { pathLength: 0, opacity: 0 } : false}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.path
        d="M20.5 11L25 16L20.5 21"
        className="stroke-white dark:stroke-zinc-950 transition-colors"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={animated ? { pathLength: 0, opacity: 0 } : false}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.35, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
      />
      <motion.path
        d="M17.5 9.5L14.5 22.5"
        className="stroke-white dark:stroke-zinc-950 transition-colors"
        strokeWidth="2.1"
        strokeLinecap="round"
        initial={animated ? { pathLength: 0, opacity: 0 } : false}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.32, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
      />
    </motion.svg>
  );
}
