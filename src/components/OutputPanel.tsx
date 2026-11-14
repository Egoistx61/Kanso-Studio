import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Check, Copy, Play, Table2, TerminalSquare, Trash2 } from 'lucide-react';
import type { ExecutionResult } from '../../server/transpiler';

interface OutputPanelProps {
  result: ExecutionResult | null;
  isRunning: boolean;
  onClear: () => void;
  onRun: () => void;
  fontSize: number;
  minHeightClass?: string;
}

export function OutputPanel({
  result,
  isRunning,
  onClear,
  onRun,
  fontSize,
  minHeightClass = 'min-h-[420px] lg:min-h-[520px]',
}: OutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const [sqlView, setSqlView] = useState<'table' | 'raw'>('table');

  const hasTables = Boolean(result?.tables && result.tables.length > 0);
  const combinedText = [result?.stdout ?? '', result?.stderr ?? ''].filter(Boolean).join('\n');

  const handleCopyOutput = async () => {
    if (!combinedText) return;
    try {
      await navigator.clipboard.writeText(combinedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard ignored
    }
  };

  return (
    <section
      aria-label="Execution Result"
      className="@container min-w-0 flex flex-col bg-white dark:bg-[#121215] border border-zinc-950/15 dark:border-white/15 rounded-xl shadow-black-md overflow-hidden"
    >
      {/* Output Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-zinc-950/10 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.02]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <span className="font-display text-xs font-semibold text-zinc-950 dark:text-zinc-100 whitespace-nowrap">
            Result Console
          </span>
          {result && !isRunning && (
            <>
              <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">
                ·
              </span>
              <span
                className={`inline-flex items-center gap-1 font-mono text-xs tabular-nums whitespace-nowrap ${
                  result.exitCode === 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {result.exitCode === 0 ? 'Success' : 'Error'} (Exit {result.exitCode})
              </span>
              <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                {result.durationMs} ms
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {hasTables && (
            <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-white/10 mr-1">
              <button
                type="button"
                onClick={() => setSqlView('table')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  sqlView === 'table'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span className="hidden @[340px]:inline">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setSqlView('raw')}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                  sqlView === 'raw'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <TerminalSquare className="w-3.5 h-3.5" />
                <span className="hidden @[340px]:inline">Raw</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopyOutput}
            disabled={!combinedText}
            title="Copy output"
            className="inline-flex items-center gap-1.5 px-2 @[340px]:px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden @[340px]:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={onClear}
            disabled={!result}
            title="Clear console"
            className="inline-flex items-center gap-1.5 px-2 @[340px]:px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden @[340px]:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Sliding Execution Progress Bar */}
      <div className="relative h-[2px] w-full bg-transparent overflow-hidden">
        {isRunning && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ repeat: Infinity, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-y-0 w-1/2 bg-zinc-950 dark:bg-white"
          />
        )}
      </div>

      {/* Console Viewport */}
      <div className={`kanso-scroll flex-1 ${minHeightClass} overflow-auto p-3.5 sm:p-5`}>
        <AnimatePresence mode="wait">
          {isRunning ? (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-3"
            >
              <div className="h-4 w-48 rounded bg-zinc-100 dark:bg-white/10 animate-pulse" />
              <div className="h-4 w-72 rounded bg-zinc-100 dark:bg-white/10 animate-pulse" />
              <div className="h-4 w-56 rounded bg-zinc-100 dark:bg-white/10 animate-pulse" />
            </motion.div>
          ) : !result ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="h-full min-h-[200px] sm:min-h-[340px] flex flex-col items-center justify-center text-center px-4 sm:px-6"
            >
              <p className="font-display text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1.5">
                Ready to execute
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mb-5 leading-relaxed">
                Write code in the editor or load an example preset, then run to inspect live output here.
              </p>
              <button
                type="button"
                onClick={onRun}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-black-sm hover:-translate-y-0.5 active:translate-y-0 transition-transform"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Program</span>
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={`${result.runtime}-${result.durationMs}-${combinedText.length}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              {/* SQL Interactive Data Grids */}
              {hasTables && sqlView === 'table' && result.tables && (
                <div className="space-y-5">
                  {result.tables.map((tbl, tIdx) => (
                    <div
                      key={tIdx}
                      className="rounded-lg border border-zinc-950/15 dark:border-white/15 overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-zinc-50 dark:bg-white/[0.03] border-b border-zinc-950/10 dark:border-white/10 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="font-mono truncate min-w-0">{tbl.statement.split('\n')[0]}</span>
                        <span className="font-mono tabular-nums shrink-0">
                          {tbl.rows.length} {tbl.rows.length === 1 ? 'row' : 'rows'}
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse font-mono text-xs">
                          <thead>
                            <tr className="border-b border-zinc-950/10 dark:border-white/10 bg-zinc-50/60 dark:bg-white/[0.02]">
                              {tbl.columns.map((col, cIdx) => (
                                <th
                                  key={cIdx}
                                  className="px-3 py-2 font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tbl.rows.map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                className="border-b last:border-b-0 border-zinc-950/6 dark:border-white/6 hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors"
                              >
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className="px-3 py-2 text-zinc-700 dark:text-zinc-300 tabular-nums whitespace-nowrap"
                                  >
                                    {cell === null ? (
                                      <span className="text-zinc-400 italic">NULL</span>
                                    ) : (
                                      String(cell)
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Standard Output */}
              {result.stdout && (!hasTables || sqlView === 'raw') && (
                <pre
                  className="font-mono text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap break-words leading-relaxed m-0"
                  style={{ fontSize: `${Math.max(12, fontSize - 1)}px` }}
                >
                  {result.stdout}
                </pre>
              )}

              {/* Explicit Error State */}
              {result.stderr && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-50/80 dark:bg-rose-950/30 p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300 mb-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Execution Error</span>
                  </div>
                  <pre className="font-mono text-xs text-rose-800 dark:text-rose-200 whitespace-pre-wrap break-words m-0 leading-relaxed">
                    {result.stderr}
                  </pre>
                </div>
              )}

              {!result.stdout && !result.stderr && (
                <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  Program completed with no output.
                </p>
              )}

              <div className="pt-3 border-t border-zinc-950/8 dark:border-white/8 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                <span>Runtime: {result.runtime}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{result.durationMs} ms</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
