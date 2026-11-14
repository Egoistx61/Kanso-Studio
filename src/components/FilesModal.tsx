import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FolderOpen, Search, Trash2, X } from 'lucide-react';
import { LANGUAGE_MAP } from '../data/languages';
import type { SavedCodeFile } from '../types/savedFiles';
import { TiltPanel3D } from './TiltPanel3D';

interface FilesModalProps {
  open: boolean;
  files: SavedCodeFile[];
  onLoadFile: (file: SavedCodeFile) => void;
  onDeleteFile: (id: string) => void;
  onClose: () => void;
}

export function FilesModal({
  open,
  files,
  onLoadFile,
  onDeleteFile,
  onClose,
}: FilesModalProps) {
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

  const filtered = files.filter((f) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const langName = LANGUAGE_MAP[f.languageId]?.name ?? f.languageId;
    return (
      f.name.toLowerCase().includes(q) ||
      langName.toLowerCase().includes(q) ||
      f.code.toLowerCase().includes(q)
    );
  });

  const formatTimestamp = (ts: number) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(ts));
    } catch {
      return '';
    }
  };

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
            className="w-full max-w-3xl max-h-[82vh] flex flex-col rounded-2xl bg-white dark:bg-[#121215] border border-zinc-950/15 dark:border-white/15 shadow-black-lg overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-zinc-950/10 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <FolderOpen className="w-4 h-4 text-zinc-950 dark:text-white" />
                <h2 className="font-display text-sm font-bold text-zinc-950 dark:text-white">
                  Saved Files
                </h2>
                <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                  {files.length} {files.length === 1 ? 'file' : 'files'}
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close files modal"
                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            {files.length > 0 && (
              <div className="px-5 py-3 border-b border-zinc-950/8 dark:border-white/8 flex items-center gap-2.5">
                <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter saved files by name, language, or snippet..."
                  className="w-full bg-transparent text-xs text-zinc-950 dark:text-white placeholder:text-zinc-400 focus:outline-none"
                />
              </div>
            )}

            {/* File List */}
            <div className="kanso-scroll overflow-y-auto p-5">
              {files.length === 0 ? (
                <div className="py-14 text-center space-y-2">
                  <p className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    No saved files yet
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
                    Click Save in the workspace toolbar to store your current program and access it here anytime.
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500 dark:text-zinc-400">
                  No saved files match your search.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filtered.map((file) => {
                    const lang = LANGUAGE_MAP[file.languageId];
                    const previewLine =
                      file.code
                        .split('\n')
                        .map((l) => l.trim())
                        .find((l) => l.length > 0) ?? '(empty file)';
                    return (
                      <TiltPanel3D
                        key={file.id}
                        maxTilt={7}
                        className="rounded-xl p-4 bg-white dark:bg-[#17171b] border border-zinc-950/12 dark:border-white/12 shadow-black-sm flex flex-col justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-white truncate">
                              {file.name}
                            </h3>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteFile(file.id);
                              }}
                              title="Delete saved file"
                              aria-label={`Delete ${file.name}`}
                              className="p-1 rounded-md text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-2.5">
                            <span>{lang?.name ?? file.languageId}</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatTimestamp(file.updatedAt)}</span>
                          </div>

                          <pre className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-black/30 rounded-lg px-2.5 py-2 truncate border border-zinc-950/6 dark:border-white/8 m-0">
                            {previewLine}
                          </pre>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onLoadFile(file);
                            onClose();
                          }}
                          className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 transition-opacity"
                        >
                          Open in Workspace
                        </button>
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
