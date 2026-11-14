import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { LANGUAGE_MAP } from '../data/languages';

interface NotPossibleModalProps {
  open: boolean;
  attemptedLangId: string | null;
  openLangIds: string[];
  reason: string;
  compatibleSuggestions: string[];
  onSelectCompatible?: (langId: string) => void;
  onClose: () => void;
}

export function NotPossibleModal({
  open,
  attemptedLangId,
  openLangIds,
  reason,
  compatibleSuggestions,
  onSelectCompatible,
  onClose,
}: NotPossibleModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const attemptedName = attemptedLangId
    ? LANGUAGE_MAP[attemptedLangId]?.name ?? attemptedLangId
    : 'Selected language';
  const currentNames = openLangIds
    .map((id) => LANGUAGE_MAP[id]?.name ?? id)
    .join(' + ');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="not-possible-title"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#121215] border border-zinc-950/15 dark:border-white/15 shadow-black-lg p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h2
                    id="not-possible-title"
                    className="font-display text-sm font-bold text-zinc-950 dark:text-white"
                  >
                    Not Possible
                  </h2>
                  <p className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    {currentNames} + {attemptedName}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close popup"
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {reason}
            </p>

            {compatibleSuggestions.length > 0 && (
              <div className="rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-950/10 dark:border-white/10 p-3 space-y-2">
                <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                  Compatible languages that work with {currentNames}:
                </div>
                <div className="flex flex-wrap gap-2">
                  {compatibleSuggestions.map((langId) => {
                    const spec = LANGUAGE_MAP[langId];
                    if (!spec) return null;
                    return (
                      <button
                        key={langId}
                        type="button"
                        onClick={() => {
                          onSelectCompatible?.(langId);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#1a1a1f] text-zinc-950 dark:text-zinc-100 border border-zinc-950/15 dark:border-white/15 hover:border-zinc-950/40 dark:hover:border-white/40 transition-colors"
                      >
                        <span className="font-mono text-[11px] text-zinc-400">
                          {spec.shortCode}
                        </span>
                        <span>+ Add {spec.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-black-sm hover:opacity-90 transition-opacity"
              >
                Understood
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
