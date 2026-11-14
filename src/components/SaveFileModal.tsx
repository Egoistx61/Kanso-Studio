import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Save, X } from 'lucide-react';
import type { LanguageSpec } from '../data/languages';

interface SaveFileModalProps {
  open: boolean;
  language: LanguageSpec;
  onSave: (name: string) => void;
  onClose: () => void;
}

export function SaveFileModal({
  open,
  language,
  onSave,
  onClose,
}: SaveFileModalProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      const now = new Date();
      const stamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setName(`${language.name} (${stamp})`);
    }
  }, [open, language.name]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim() || `${language.name} Snippet`;
    onSave(trimmed);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
        >
          <motion.form
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#121215] border border-zinc-950/15 dark:border-white/15 shadow-black-lg p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Save className="w-4 h-4 text-zinc-950 dark:text-white" />
                <h2 className="font-display text-sm font-bold text-zinc-950 dark:text-white">
                  Save Code File
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close save dialog"
                className="p-1 rounded-lg text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="save-file-name"
                className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                File Title ({language.name} · {language.filename})
              </label>
              <input
                id="save-file-name"
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter a name for this code..."
                className="w-full rounded-lg border border-zinc-950/20 dark:border-white/20 bg-zinc-50 dark:bg-[#0b0b0e] px-3 py-2 text-sm text-zinc-950 dark:text-white focus:outline-none focus:border-zinc-950 dark:focus:border-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-black-sm hover:opacity-90 transition-opacity"
              >
                Save File
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
