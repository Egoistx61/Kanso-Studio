import { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, Eraser, Plus, RotateCcw, Terminal, X } from 'lucide-react';
import { tokenizeCode } from '../utils/highlight';
import { LANGUAGE_MAP, type LanguageSpec } from '../data/languages';

export interface EditorTab {
  id: string;
  languageId: string;
  code: string;
}

interface CodeEditorProps {
  language: LanguageSpec;
  code: string;
  tabs: EditorTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onAddTab: () => void;
  onChange: (value: string) => void;
  onRun: () => void;
  onClear: () => void;
  onReset: () => void;
  stdin: string;
  onStdinChange: (value: string) => void;
  showStdin: boolean;
  onToggleStdin: () => void;
  fontSize: number;
  minHeightClass?: string;
}

const PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
};

export function CodeEditor({
  language,
  code,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onAddTab,
  onChange,
  onRun,
  onClear,
  onReset,
  stdin,
  onStdinChange,
  showStdin,
  onToggleStdin,
  fontSize,
  minHeightClass = 'min-h-[420px] lg:min-h-[520px]',
}: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const lines = useMemo(() => code.split('\n'), [code]);
  const tokens = useMemo(() => tokenizeCode(code, language.id), [code, language.id]);

  const updateCursorMeta = () => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? 0;
    const before = el.value.slice(0, pos);
    const split = before.split('\n');
    setCursorPos({
      line: split.length,
      col: split[split.length - 1].length + 1,
    });
  };

  const syncScroll = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = ta.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;

    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = el.selectionStart;
      const end = el.selectionEnd;

      if (e.shiftKey) {
        const lineStart = code.lastIndexOf('\n', start - 1) + 1;
        if (code.slice(lineStart, lineStart + 2) === '  ') {
          const next = code.slice(0, lineStart) + code.slice(lineStart + 2);
          onChange(next);
          requestAnimationFrame(() => {
            el.selectionStart = Math.max(lineStart, start - 2);
            el.selectionEnd = Math.max(lineStart, end - 2);
            updateCursorMeta();
          });
        }
        return;
      }

      const next = code.slice(0, start) + '  ' + code.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = start + 2;
        el.selectionEnd = start + 2;
        updateCursorMeta();
      });
      return;
    }

    if (PAIRS[e.key] && el.selectionStart === el.selectionEnd) {
      const start = el.selectionStart;
      const closing = PAIRS[e.key];
      const nextChar = code[start];
      if ((e.key === '"' || e.key === "'") && nextChar === e.key) {
        e.preventDefault();
        requestAnimationFrame(() => {
          el.selectionStart = start + 1;
          el.selectionEnd = start + 1;
        });
        return;
      }
      e.preventDefault();
      const next = code.slice(0, start) + e.key + closing + code.slice(start);
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = start + 1;
        el.selectionEnd = start + 1;
        updateCursorMeta();
      });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const tokenClass = (type: string) => {
    switch (type) {
      case 'keyword':
        return 'text-zinc-950 dark:text-white font-semibold';
      case 'type':
        return 'text-sky-700 dark:text-sky-300';
      case 'string':
        return 'text-emerald-700 dark:text-emerald-300';
      case 'number':
        return 'text-amber-700 dark:text-amber-300';
      case 'comment':
        return 'text-zinc-400 dark:text-zinc-500 italic';
      case 'function':
        return 'text-indigo-700 dark:text-indigo-300';
      default:
        return 'text-zinc-800 dark:text-zinc-200';
    }
  };

  const lineHeightPx = Math.round(fontSize * 1.65);

  return (
    <section
      aria-label="Code Editor"
      className="@container min-w-0 flex flex-col bg-white dark:bg-[#121215] border border-zinc-950/15 dark:border-white/15 rounded-xl shadow-black-md overflow-hidden"
    >
      {/* Multi-Language Editor Tab Bar */}
      <div
        role="tablist"
        aria-label="Open language tabs"
        className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 border-b border-zinc-950/10 dark:border-white/10 bg-zinc-100/70 dark:bg-white/[0.03] overflow-x-auto kanso-scroll"
      >
        {tabs.map((tab) => {
          const spec = LANGUAGE_MAP[tab.languageId];
          const isActive = tab.id === activeTabId;
          const canClose = tabs.length > 1;
          return (
            <div
              key={tab.id}
              className={`group inline-flex items-center gap-1.5 rounded-lg border text-xs transition-colors shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-[#121215] text-zinc-950 dark:text-white border-zinc-950/15 dark:border-white/20 shadow-sm'
                  : 'bg-transparent text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-white/60 dark:hover:bg-white/[0.06] hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectTab(tab.id)}
                className="inline-flex items-center gap-1.5 pl-2.5 py-1.5 font-medium whitespace-nowrap"
                style={{ paddingRight: canClose ? '0.25rem' : '0.625rem' }}
              >
                <span className="font-mono text-[10px] opacity-65">
                  {spec?.shortCode ?? tab.languageId}
                </span>
                <span className="font-mono">{spec?.filename ?? tab.languageId}</span>
              </button>
              {canClose && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  aria-label={`Close ${spec?.name ?? tab.languageId} tab`}
                  className="mr-1 p-0.5 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200/70 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={onAddTab}
          title="Add compatible language tab"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-white dark:hover:bg-white/10 border border-dashed border-zinc-950/20 dark:border-white/20 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Language</span>
        </motion.button>
      </div>

      {/* Editor Header */}
      <div className="flex flex-col @[320px]:flex-row @[320px]:items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b border-zinc-950/10 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.02]">
        <div className="flex items-center justify-between @[320px]:justify-start gap-2 min-w-0">
          <span className="font-mono text-xs font-semibold text-zinc-950 dark:text-zinc-100 truncate">
            {language.name}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden @[360px]:inline text-zinc-300 dark:text-zinc-700" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
              Ln {cursorPos.line}, Col {cursorPos.col}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 @[360px]:flex items-center gap-1 w-full @[360px]:w-auto shrink-0">
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onToggleStdin}
            title="Standard input"
            className={`inline-flex items-center justify-center gap-1 px-1.5 @[420px]:px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              showStdin
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden @[400px]:inline">Stdin</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={handleCopy}
            disabled={!code}
            title="Copy code"
            className="inline-flex items-center justify-center gap-1 px-1.5 @[420px]:px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {copied ? <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
            <span className="hidden @[400px]:inline">{copied ? 'Copied' : 'Copy'}</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              onClear();
              setCleared(true);
              setTimeout(() => setCleared(false), 1200);
            }}
            disabled={!code && !cleared}
            title="Clear coding area"
            className="inline-flex items-center justify-center gap-1 px-1.5 @[420px]:px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {cleared ? (
              <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Eraser className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="hidden @[400px]:inline">{cleared ? 'Cleared' : 'Clear'}</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onReset}
            title="Reset to starter code"
            className="inline-flex items-center justify-center gap-1 px-1.5 @[420px]:px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden @[400px]:inline">Reset</span>
          </motion.button>
        </div>
      </div>

      {/* Flat, Rock-Solid 2D Coding Surface (explicitly excluded from 3D tilt) */}
      <div
        data-cursor="code"
        className={`relative flex flex-1 min-w-0 ${minHeightClass} bg-white dark:bg-[#121215]`}
      >
        {/* Line Numbers Gutter */}
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="select-none overflow-hidden py-4 pl-2 pr-2 sm:pl-3 sm:pr-3 text-right font-mono text-zinc-400 dark:text-zinc-600 border-r border-zinc-950/8 dark:border-white/8 bg-zinc-50/40 dark:bg-white/[0.015] shrink-0 min-w-[2.5rem] sm:min-w-[3.25rem]"
          style={{ fontSize: `${fontSize}px`, lineHeight: `${lineHeightPx}px` }}
        >
          {lines.map((_, idx) => (
            <div key={idx}>{idx + 1}</div>
          ))}
        </div>

        {/* Synchronized Highlight + Input Stack */}
        <div className="relative flex-1 overflow-hidden">
          <pre
            ref={preRef}
            aria-hidden="true"
            className="code-editor-layer kanso-scroll pointer-events-none absolute inset-0 m-0 overflow-auto p-4"
            style={{ fontSize: `${fontSize}px`, lineHeight: `${lineHeightPx}px` }}
          >
            {tokens.map((tok, idx) => (
              <span key={idx} className={tokenClass(tok.type)}>
                {tok.text}
              </span>
            ))}
            {code.endsWith('\n') ? ' ' : ''}
          </pre>

          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => {
              onChange(e.target.value);
              requestAnimationFrame(updateCursorMeta);
            }}
            onScroll={syncScroll}
            onKeyDown={handleKeyDown}
            onClick={updateCursorMeta}
            onKeyUp={updateCursorMeta}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-label={`${language.name} source code editor`}
            className="code-input code-editor-layer kanso-scroll relative z-10 h-full w-full resize-none bg-transparent p-4 text-transparent caret-zinc-950 dark:caret-white focus:outline-none selection:bg-zinc-950/15 dark:selection:bg-white/20"
            style={{ fontSize: `${fontSize}px`, lineHeight: `${lineHeightPx}px` }}
          />
        </div>
      </div>

      {/* Collapsible Stdin Drawer */}
      {showStdin && (
        <div className="border-t border-zinc-950/10 dark:border-white/10 bg-zinc-50/70 dark:bg-white/[0.02] px-4 py-3">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
            Standard Input (stdin)
          </label>
          <textarea
            value={stdin}
            onChange={(e) => onStdinChange(e.target.value)}
            rows={2}
            placeholder="Optional input lines passed to your program..."
            className="w-full rounded-lg border border-zinc-950/15 dark:border-white/15 bg-white dark:bg-[#0e0e11] px-3 py-2 font-mono text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 dark:focus:border-white"
          />
        </div>
      )}
    </section>
  );
}
