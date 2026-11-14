import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X } from 'lucide-react';
import { LANGUAGE_MAP, LANGUAGES, type LanguageSpec } from '../data/languages';
import {
  checkLanguageCompatibility,
  getCompatibleSuggestions,
} from '../utils/languageCompatibility';
import { TiltPanel3D } from './TiltPanel3D';

interface LanguagePickerModalProps {
  open: boolean;
  activeId: string;
  mode?: 'switch' | 'combine';
  openLanguageIds?: string[];
  onSelect: (lang: LanguageSpec) => void;
  onClose: () => void;
}

export function LanguagePickerModal({
  open,
  activeId,
  mode = 'switch',
  openLanguageIds = [],
  onSelect,
  onClose,
}: LanguagePickerModalProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(query.toLowerCase()) ||
      l.category.toLowerCase().includes(query.toLowerCase()) ||
      l.shortCode.toLowerCase().includes(query.toLowerCase())
  );

  const isCombine = mode === 'combine';
  const suggestions = isCombine ? getCompatibleSuggestions(openLanguageIds) : [];
  const openNames = openLanguageIds
    .map((id) => LANGUAGE_MAP[id]?.name ?? id)
    .join(' + ');

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 md:p-8"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[84vh] flex flex-col rounded-2xl bg-white dark:bg-[#121215] border border-zinc-950/15 dark:border-white/15 shadow-black-lg overflow-hidden"
          >
            {/* Header + Search */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-zinc-950/10 dark:border-white/10">
              <div className="flex items-center gap-3 flex-1">
                <Search className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    isCombine
                      ? `Add compatible language to ${openNames || 'editor'}...`
                      : 'Search 17 languages (Python, Rust, MATLAB, SQL...)'
                  }
                  className="w-full bg-transparent text-sm text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close language picker"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Combine mode guidance strip */}
            {isCombine && (
              <div className="px-5 py-2.5 border-b border-zinc-950/8 dark:border-white/8 bg-zinc-50/80 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-zinc-600 dark:text-zinc-300">
                  Combining with <strong className="font-semibold text-zinc-950 dark:text-white">{openNames}</strong>
                </span>
                <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                  {suggestions.length > 0
                    ? `Compatible: ${suggestions.map((id) => LANGUAGE_MAP[id]?.name ?? id).join(', ')}`
                    : 'Isolated runtime (selecting another shows Not Possible)'}
                </span>
              </div>
            )}

            {/* 3D Language Cards Grid */}
            <div className="kanso-scroll overflow-y-auto p-5">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No matching language found.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filtered.map((lang) => {
                    const isActive = !isCombine && lang.id === activeId;
                    const isAlreadyOpen = isCombine && openLanguageIds.includes(lang.id);
                    const compat = isCombine
                      ? checkLanguageCompatibility(openLanguageIds, lang.id)
                      : null;
                    const isCompatible = compat ? compat.compatible && !isAlreadyOpen : false;

                    return (
                      <TiltPanel3D
                        key={lang.id}
                        maxTilt={9}
                        onClick={() => {
                          onSelect(lang);
                          onClose();
                        }}
                        className={`rounded-xl p-4 border transition-colors ${
                          isActive || isAlreadyOpen
                            ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white shadow-black-md'
                            : isCompatible
                              ? 'bg-white dark:bg-[#17171b] text-zinc-950 dark:text-zinc-100 border-emerald-600/45 dark:border-emerald-400/45 shadow-black-sm hover:border-emerald-600 dark:hover:border-emerald-400'
                              : 'bg-white dark:bg-[#17171b] text-zinc-950 dark:text-zinc-100 border-zinc-950/12 dark:border-white/12 shadow-black-sm hover:border-zinc-950/35 dark:hover:border-white/35'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2 mb-1.5">
                          <span className="font-display text-sm font-semibold">
                            {lang.name}
                          </span>
                          <span
                            className={`font-mono text-xs ${
                              isActive || isAlreadyOpen
                                ? 'text-zinc-300 dark:text-zinc-600'
                                : isCompatible
                                  ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                  : 'text-zinc-400 dark:text-zinc-500'
                            }`}
                          >
                            {isAlreadyOpen
                              ? 'Open'
                              : isCompatible
                                ? 'Works together'
                                : lang.shortCode}
                          </span>
                        </div>
                        <p
                          className={`text-xs leading-relaxed ${
                            isActive || isAlreadyOpen
                              ? 'text-zinc-300 dark:text-zinc-700'
                              : 'text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          {lang.paradigm}
                        </p>
                      </TiltPanel3D>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
