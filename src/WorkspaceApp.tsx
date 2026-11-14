import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  ChevronDown,
  Columns2,
  Download,
  FileCode2,
  FileText,
  FolderOpen,
  LayoutGrid,
  Minus,
  Moon,
  MousePointer2,
  PanelLeft,
  Play,
  Plus,
  Rows2,
  Save,
  Sun,
} from 'lucide-react';
import {
  LANGUAGES,
  LANGUAGE_MAP,
  type LanguageSpec,
} from './data/languages';
import { CodingCursor } from './components/CodingCursor';
import { CodeEditor, type EditorTab } from './components/CodeEditor';
import { OutputPanel } from './components/OutputPanel';
import { LanguagePickerModal } from './components/LanguagePickerModal';
import { NotPossibleModal } from './components/NotPossibleModal';
import { FilesModal } from './components/FilesModal';
import { SaveFileModal } from './components/SaveFileModal';
import { BrandLogo } from './components/BrandLogo';
import { TiltPanel3D } from './components/TiltPanel3D';
import { LoadingScreen } from './components/LoadingScreen';
import { Footer } from './components/Footer';
import { checkLanguageCompatibility } from './utils/languageCompatibility';
import {
  loadSavedFiles,
  persistSavedFiles,
  type SavedCodeFile,
} from './types/savedFiles';
import type { ExecutionResult } from '../server/transpiler';

type WorkspaceLayout = 'split' | 'wide' | 'stacked';

const LAYOUT_OPTIONS: Array<{
  id: WorkspaceLayout;
  label: string;
  icon: typeof Columns2;
}> = [
  { id: 'split', label: 'Split', icon: Columns2 },
  { id: 'wide', label: 'Wide', icon: PanelLeft },
  { id: 'stacked', label: 'Stacked', icon: Rows2 },
];

export default function WorkspaceApp() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem('kanso-theme') === 'dark' ? 'dark' : 'light';
  });

  const [customCursor, setCustomCursor] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('kanso-cursor') !== 'off';
  });

  const [layout, setLayout] = useState<WorkspaceLayout>(() => {
    if (typeof window === 'undefined') return 'split';
    const saved = localStorage.getItem('kanso-layout');
    return saved === 'wide' || saved === 'stacked' ? saved : 'split';
  });

  // Read ?lang=...&example=... from URL on initial mount
  const [initialSelection] = useState(() => {
    if (typeof window === 'undefined') return { langId: 'python', exampleIdx: 0 };
    const params = new URLSearchParams(window.location.search);
    const paramLang = params.get('lang') ?? '';
    const lang = LANGUAGE_MAP[paramLang] ?? LANGUAGES[0];
    const exRaw = parseInt(params.get('example') ?? '0', 10);
    const exIdx =
      Number.isFinite(exRaw) && exRaw >= 0 && exRaw < lang.examples.length ? exRaw : 0;
    return { langId: lang.id, exampleIdx: exIdx };
  });

  const [tabs, setTabs] = useState<EditorTab[]>(() => {
    const initLang = LANGUAGE_MAP[initialSelection.langId] ?? LANGUAGES[0];
    const initEx = initLang.examples[initialSelection.exampleIdx];
    return [
      {
        id: `tab-${initLang.id}-1`,
        languageId: initLang.id,
        code: initEx?.code ?? initLang.defaultCode,
      },
    ];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const initLang = LANGUAGE_MAP[initialSelection.langId] ?? LANGUAGES[0];
    return `tab-${initLang.id}-1`;
  });
  const [activeExampleIdxByLang, setActiveExampleIdxByLang] = useState<Record<string, number>>(() => ({
    [initialSelection.langId]: initialSelection.exampleIdx,
  }));

  const [stdin, setStdin] = useState('');
  const [showStdin, setShowStdin] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'switch' | 'combine'>('switch');
  const [notPossibleState, setNotPossibleState] = useState<{
    open: boolean;
    attemptedLangId: string | null;
    reason: string;
    compatibleSuggestions: string[];
  }>({
    open: false,
    attemptedLangId: null,
    reason: '',
    compatibleSuggestions: [],
  });
  const [filesOpen, setFilesOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [justExported, setJustExported] = useState(false);
  const [savedFiles, setSavedFiles] = useState<SavedCodeFile[]>(() => loadSavedFiles());
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const activeLanguage = LANGUAGE_MAP[activeTab.languageId] ?? LANGUAGES[0];
  const activeCode = activeTab.code;
  const activeExampleIdx = activeExampleIdxByLang[activeLanguage.id] ?? 0;
  const openLanguageIds = tabs.map((t) => t.languageId);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('kanso-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('kanso-cursor', customCursor ? 'on' : 'off');
  }, [customCursor]);

  useEffect(() => {
    localStorage.setItem('kanso-layout', layout);
  }, [layout]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      const payload =
        tabs.length > 1
          ? {
              files: tabs.map((t) => ({
                language: t.languageId,
                code: t.code,
                filename: LANGUAGE_MAP[t.languageId]?.filename,
              })),
              stdin,
            }
          : {
              language: activeLanguage.id,
              code: activeCode,
              stdin,
            };

      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as ExecutionResult;
      setResult(data);
    } catch (err) {
      setResult({
        stdout: '',
        stderr:
          (err instanceof Error ? err.message : 'Unable to reach execution server.') + '\n',
        exitCode: 1,
        durationMs: 0,
        runtime: activeLanguage.name,
      });
    } finally {
      setIsRunning(false);
    }
  }, [activeCode, activeLanguage.id, activeLanguage.name, isRunning, stdin, tabs]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPickerMode('switch');
        setPickerOpen((o) => !o);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleTheme();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setSaveOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          handleRun();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRun, toggleTheme]);

  const addCompatibleLanguageTab = useCallback(
    (lang: LanguageSpec) => {
      const existing = tabs.find((t) => t.languageId === lang.id);
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }

      const check = checkLanguageCompatibility(openLanguageIds, lang.id);
      if (!check.compatible) {
        setNotPossibleState({
          open: true,
          attemptedLangId: lang.id,
          reason: check.reason,
          compatibleSuggestions: check.compatibleSuggestions,
        });
        return;
      }

      const newTab: EditorTab = {
        id: `tab-${lang.id}-${Date.now()}`,
        languageId: lang.id,
        code: lang.defaultCode,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      setResult(null);
    },
    [openLanguageIds, tabs]
  );

  const handlePickerSelect = (lang: LanguageSpec) => {
    if (pickerMode === 'combine') {
      addCompatibleLanguageTab(lang);
      return;
    }

    // Switch primary active tab (keep compatible tabs, or reset to single tab if incompatible)
    const otherLangIds = tabs
      .filter((t) => t.id !== activeTab.id)
      .map((t) => t.languageId);
    const keepOthers =
      otherLangIds.length > 0 &&
      checkLanguageCompatibility(otherLangIds, lang.id).compatible;

    if (keepOthers) {
      const existingSame = tabs.find(
        (t) => t.id !== activeTab.id && t.languageId === lang.id
      );
      if (existingSame) {
        setActiveTabId(existingSame.id);
      } else {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id
              ? { ...t, languageId: lang.id, code: lang.defaultCode }
              : t
          )
        );
      }
    } else {
      const freshId = `tab-${lang.id}-${Date.now()}`;
      setTabs([{ id: freshId, languageId: lang.id, code: lang.defaultCode }]);
      setActiveTabId(freshId);
    }
    setActiveExampleIdxByLang((prev) => ({ ...prev, [lang.id]: 0 }));
    setResult(null);
  };

  const handleCloseTab = (tabId: string) => {
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex((t) => t.id === tabId);
    const next = tabs.filter((t) => t.id !== tabId);
    setTabs(next);
    if (activeTab.id === tabId) {
      const fallback = next[Math.max(0, idx - 1)] ?? next[0];
      setActiveTabId(fallback.id);
    }
    setResult(null);
  };

  const loadExample = (idx: number) => {
    const example = activeLanguage.examples[idx];
    if (!example) return;
    setActiveExampleIdxByLang((prev) => ({ ...prev, [activeLanguage.id]: idx }));
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? { ...t, code: example.code } : t))
    );
    setResult(null);
  };

  const handleClearCode = () => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? { ...t, code: '' } : t))
    );
    setResult(null);
  };

  const handleResetCode = () => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, code: activeLanguage.defaultCode } : t
      )
    );
    setActiveExampleIdxByLang((prev) => ({ ...prev, [activeLanguage.id]: 0 }));
    setResult(null);
  };

  const handleSaveFile = (name: string) => {
    const entry: SavedCodeFile = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      languageId: activeLanguage.id,
      code: activeCode,
      updatedAt: Date.now(),
    };
    const next = [entry, ...savedFiles];
    setSavedFiles(next);
    persistSavedFiles(next);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  const handleLoadSavedFile = (file: SavedCodeFile) => {
    const lang = LANGUAGE_MAP[file.languageId];
    if (!lang) return;
    const existing = tabs.find((t) => t.languageId === file.languageId);
    if (existing) {
      setTabs((prev) =>
        prev.map((t) => (t.id === existing.id ? { ...t, code: file.code } : t))
      );
      setActiveTabId(existing.id);
    } else {
      const freshId = `tab-${file.languageId}-${Date.now()}`;
      setTabs([{ id: freshId, languageId: file.languageId, code: file.code }]);
      setActiveTabId(freshId);
    }
    setResult(null);
  };

  const handleDeleteSavedFile = (id: string) => {
    const next = savedFiles.filter((f) => f.id !== id);
    setSavedFiles(next);
    persistSavedFiles(next);
  };

  useEffect(() => {
    if (!exportOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [exportOpen]);

  const handleExport = (format: 'source' | 'txt') => {
    const sourceName = activeLanguage.filename;
    const baseName = sourceName.includes('.')
      ? sourceName.slice(0, sourceName.lastIndexOf('.'))
      : sourceName;
    const downloadName = format === 'txt' ? `${baseName}.txt` : sourceName;

    const blob = new Blob([activeCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportOpen(false);
    setJustExported(true);
    setTimeout(() => setJustExported(false), 1800);
  };

  const gridLayoutClass =
    layout === 'stacked'
      ? 'grid-cols-1 gap-4 sm:gap-5'
      : layout === 'wide'
        ? 'grid-cols-1 sm:grid-cols-[1.65fr_1fr] gap-4 sm:gap-5'
        : 'grid-cols-2 gap-2.5 sm:gap-5';

  const editorHeightClass =
    layout === 'stacked'
      ? 'min-h-[300px] sm:min-h-[380px] lg:min-h-[420px]'
      : layout === 'wide'
        ? 'min-h-[380px] sm:min-h-[480px] lg:min-h-[580px]'
        : 'min-h-[310px] sm:min-h-[440px] lg:min-h-[540px]';

  const outputHeightClass =
    layout === 'stacked'
      ? 'min-h-[240px] sm:min-h-[260px] lg:min-h-[300px]'
      : layout === 'wide'
        ? 'min-h-[190px] sm:min-h-[480px] lg:min-h-[580px]'
        : 'min-h-[310px] sm:min-h-[440px] lg:min-h-[540px]';

  return (
    <div className="min-h-screen overflow-x-hidden flex flex-col bg-[#f5f5f7] dark:bg-[#09090b] text-zinc-950 dark:text-zinc-50 transition-colors duration-200">
      <LoadingScreen label="Kanso Workspace" />
      <CodingCursor enabled={customCursor} />

      {/* Top Bar (Strict 3-zone contract) */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0e0e11]/95 border-b border-zinc-950/10 dark:border-white/10">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Minimalist Logo + Wordmark */}
          <a
            href="/"
            className="inline-flex items-center gap-2.5 font-display text-base font-bold tracking-tight text-zinc-950 dark:text-white whitespace-nowrap shrink-0"
          >
            <BrandLogo className="w-6 h-6 shrink-0" />
            <span>Kanso Studio</span>
          </a>

          {/* Zone 2: 4 Clean Single-Line Nav Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600 dark:text-zinc-400"
          >
            <a
              href="/#languages"
              className="hover:text-zinc-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Languages
            </a>
            <a
              href="/#snippets"
              className="hover:text-zinc-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Snippets
            </a>
            <a
              href="/#shortcuts"
              className="hover:text-zinc-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Shortcuts
            </a>
            <a
              href="/app.html"
              className="text-zinc-950 dark:text-white font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Workspace
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <motion.button
              type="button"
              onClick={handleRun}
              disabled={isRunning}
              whileTap={{ scale: 0.96 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-black-sm hover:-translate-y-0.5 transition-transform disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {isRunning
                  ? 'Running...'
                  : tabs.length > 1
                    ? `Run (${tabs.length} Tabs)`
                    : 'Run Code'}
              </span>
            </motion.button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 sm:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
        {/* Mobile Quick Links */}
        <nav
          aria-label="Mobile workspace links"
          className="md:hidden flex items-center gap-5 overflow-x-auto pb-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          <a href="/#languages" className="hover:text-zinc-950 dark:hover:text-white whitespace-nowrap shrink-0">
            Languages
          </a>
          <a href="/#snippets" className="hover:text-zinc-950 dark:hover:text-white whitespace-nowrap shrink-0">
            Snippets
          </a>
          <a href="/#shortcuts" className="hover:text-zinc-950 dark:hover:text-white whitespace-nowrap shrink-0">
            Shortcuts
          </a>
          <a href="/" className="hover:text-zinc-950 dark:hover:text-white whitespace-nowrap shrink-0">
            Overview
          </a>
        </nav>

        {/* Workspace Control Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-white dark:bg-[#121215] border border-zinc-950/15 dark:border-white/15 shadow-black-sm"
        >
          {/* Left Group: Language, Examples, Save, Files, Export */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => {
                setPickerMode('switch');
                setPickerOpen(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-between sm:justify-start gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              <span className="inline-flex items-center gap-2">
                <span className="font-mono text-[11px] opacity-75">
                  {activeLanguage.shortCode}
                </span>
                <span>{activeLanguage.name}</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </button>

            {/* Examples */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-white/[0.06] overflow-x-auto max-w-full kanso-scroll">
              {activeLanguage.examples.map((ex, idx) => {
                const selected = idx === activeExampleIdx;
                return (
                  <button
                    key={ex.title}
                    type="button"
                    onClick={() => loadExample(idx)}
                    className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      selected
                        ? 'text-zinc-950 dark:text-white'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    {selected && (
                      <motion.span
                        layoutId="ws-example-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-md bg-white dark:bg-zinc-800 shadow-sm"
                      />
                    )}
                    <span className="relative z-10">{ex.title}</span>
                  </button>
                );
              })}
            </div>

            {/* Save, Files, Export Action Row */}
            <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full sm:w-auto">
              {/* Save Button */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => setSaveOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-[#1a1a1f] text-zinc-950 dark:text-zinc-100 border border-zinc-950/15 dark:border-white/15 hover:border-zinc-950/35 dark:hover:border-white/35 transition-colors whitespace-nowrap"
              >
                {justSaved ? (
                  <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Save className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{justSaved ? 'Saved' : 'Save'}</span>
              </motion.button>

              {/* Files Popup Button */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => setFilesOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-[#1a1a1f] text-zinc-950 dark:text-zinc-100 border border-zinc-950/15 dark:border-white/15 hover:border-zinc-950/35 dark:hover:border-white/35 transition-colors whitespace-nowrap"
              >
                <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                <span>Files</span>
                {savedFiles.length > 0 && (
                  <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                    ({savedFiles.length})
                  </span>
                )}
              </motion.button>

              {/* Export Dropdown Button */}
              <div ref={exportMenuRef} className="relative">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  disabled={!activeCode}
                  aria-expanded={exportOpen}
                  aria-haspopup="menu"
                  onClick={() => setExportOpen((o) => !o)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-[#1a1a1f] text-zinc-950 dark:text-zinc-100 border border-zinc-950/15 dark:border-white/15 hover:border-zinc-950/35 dark:hover:border-white/35 disabled:opacity-40 transition-colors whitespace-nowrap"
                >
                  {justExported ? (
                    <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Download className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{justExported ? 'Exported' : 'Export'}</span>
                  <ChevronDown
                    className={`w-3 h-3 shrink-0 opacity-70 transition-transform duration-150 ${
                      exportOpen ? 'rotate-180' : ''
                    }`}
                  />
                </motion.button>

                <AnimatePresence>
                  {exportOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.97 }}
                      transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-60 z-40 rounded-xl bg-white dark:bg-[#17171b] border border-zinc-950/15 dark:border-white/15 shadow-black-md p-1.5"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => handleExport('source')}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                      >
                        <span className="inline-flex items-center gap-2 font-medium text-zinc-950 dark:text-zinc-100">
                          <FileCode2 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                          <span>Source file</span>
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                          {activeLanguage.filename}
                        </span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => handleExport('txt')}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
                      >
                        <span className="inline-flex items-center gap-2 font-medium text-zinc-950 dark:text-zinc-100">
                          <FileText className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                          <span>Plain text</span>
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                          {(activeLanguage.filename.includes('.')
                            ? activeLanguage.filename.slice(0, activeLanguage.filename.lastIndexOf('.'))
                            : activeLanguage.filename) + '.txt'}
                        </span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Right Group: Font Size (px), Theme Toggle, and Layout Switcher Side by Side */}
          <div className="flex flex-nowrap items-center justify-between lg:justify-end gap-1.5 sm:gap-2 w-full lg:w-auto shrink-0">
            {/* Font Size (px changer) */}
            <div className="flex items-center border border-zinc-950/12 dark:border-white/12 rounded-lg overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.max(12, s - 1))}
                aria-label="Decrease editor font size"
                className="p-1.5 sm:p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 sm:px-2 font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                {fontSize}px
              </span>
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.min(18, s + 1))}
                aria-label="Increase editor font size"
                className="p-1.5 sm:p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Theme Toggle */}
            <motion.button
              type="button"
              onClick={toggleTheme}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              aria-label="Toggle light and dark theme"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#1a1a1f] text-zinc-950 dark:text-zinc-100 border border-zinc-950/15 dark:border-white/15 hover:border-zinc-950/35 dark:hover:border-white/35 transition-colors whitespace-nowrap shrink-0"
            >
              <motion.span
                key={theme}
                initial={{ rotate: -35, opacity: 0, scale: 0.75 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                className="inline-flex"
              >
                {theme === 'light' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </motion.span>
              <span>{theme === 'light' ? 'Light' : 'Dark'}</span>
            </motion.button>

            {/* Multi-Layout Switcher */}
            <div
              role="group"
              aria-label="Workspace layout"
              className="flex items-center gap-0.5 sm:gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-white/[0.06] shrink-0"
            >
              {LAYOUT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = layout === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLayout(opt.id)}
                    title={`${opt.label} layout`}
                    aria-label={`${opt.label} layout`}
                    aria-pressed={active}
                    className={`relative inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'text-zinc-950 dark:text-white'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="ws-layout-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-md bg-white dark:bg-zinc-800 shadow-sm"
                      />
                    )}
                    <Icon className="relative z-10 w-3.5 h-3.5" />
                    <span className="relative z-10 hidden sm:inline">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Cursor Toggle */}
            <motion.button
              type="button"
              onClick={() => setCustomCursor((c) => !c)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              title="Toggle coding cursor"
              className="hidden xl:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#1a1a1f] text-zinc-950 dark:text-zinc-100 border border-zinc-950/15 dark:border-white/15 hover:border-zinc-950/35 dark:hover:border-white/35 transition-colors whitespace-nowrap shrink-0"
            >
              <MousePointer2 className="w-3.5 h-3.5" />
              <span>{customCursor ? 'Cursor: On' : 'Cursor: Off'}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Coding Area & Output Console (Strictly 2D — Zero 3D tilt on coding surface) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className={`grid ${gridLayoutClass} items-stretch`}
        >
          <CodeEditor
            language={activeLanguage}
            code={activeCode}
            tabs={tabs}
            activeTabId={activeTab.id}
            onSelectTab={(tabId) => setActiveTabId(tabId)}
            onCloseTab={handleCloseTab}
            onAddTab={() => {
              setPickerMode('combine');
              setPickerOpen(true);
            }}
            onChange={(val) =>
              setTabs((prev) =>
                prev.map((t) => (t.id === activeTab.id ? { ...t, code: val } : t))
              )
            }
            onRun={handleRun}
            onClear={handleClearCode}
            onReset={handleResetCode}
            stdin={stdin}
            onStdinChange={setStdin}
            showStdin={showStdin}
            onToggleStdin={() => setShowStdin((s) => !s)}
            fontSize={fontSize}
            minHeightClass={editorHeightClass}
          />

          <OutputPanel
            result={result}
            isRunning={isRunning}
            onClear={() => setResult(null)}
            onRun={handleRun}
            fontSize={fontSize}
            minHeightClass={outputHeightClass}
          />
        </motion.div>

        {/* Interactive 3D Workspace Companion Panels (below the coding area) */}
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Workspace quick actions"
          className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2"
        >
          <TiltPanel3D
            maxTilt={8}
            onClick={() => {
              setPickerMode('switch');
              setPickerOpen(true);
            }}
            className="rounded-xl p-4 bg-white dark:bg-[#121215] border border-zinc-950/12 dark:border-white/12 shadow-black-sm flex items-center justify-between gap-3"
          >
            <div>
              <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                Active Runtime · {activeLanguage.shortCode}
              </div>
              <div className="font-display text-sm font-bold text-zinc-950 dark:text-white mt-0.5">
                Switch Language (⌘K)
              </div>
            </div>
            <LayoutGrid className="w-4 h-4 text-zinc-500 shrink-0" />
          </TiltPanel3D>

          <TiltPanel3D
            maxTilt={8}
            onClick={() => setFilesOpen(true)}
            className="rounded-xl p-4 bg-white dark:bg-[#121215] border border-zinc-950/12 dark:border-white/12 shadow-black-sm flex items-center justify-between gap-3"
          >
            <div>
              <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                Local Library · {savedFiles.length} saved
              </div>
              <div className="font-display text-sm font-bold text-zinc-950 dark:text-white mt-0.5">
                Browse Saved Files
              </div>
            </div>
            <FolderOpen className="w-4 h-4 text-zinc-500 shrink-0" />
          </TiltPanel3D>

          <TiltPanel3D
            maxTilt={8}
            onClick={() => setSaveOpen(true)}
            className="rounded-xl p-4 bg-white dark:bg-[#121215] border border-zinc-950/12 dark:border-white/12 shadow-black-sm flex items-center justify-between gap-3"
          >
            <div>
              <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                Snapshot · {activeLanguage.filename}
              </div>
              <div className="font-display text-sm font-bold text-zinc-950 dark:text-white mt-0.5">
                Save Current Code (⌘S)
              </div>
            </div>
            <Save className="w-4 h-4 text-zinc-500 shrink-0" />
          </TiltPanel3D>
        </motion.section>
      </main>

      <Footer page="workspace" theme={theme} onToggleTheme={toggleTheme} />

      <LanguagePickerModal
        open={pickerOpen}
        activeId={activeLanguage.id}
        mode={pickerMode}
        openLanguageIds={openLanguageIds}
        onSelect={handlePickerSelect}
        onClose={() => setPickerOpen(false)}
      />

      <NotPossibleModal
        open={notPossibleState.open}
        attemptedLangId={notPossibleState.attemptedLangId}
        openLangIds={openLanguageIds}
        reason={notPossibleState.reason}
        compatibleSuggestions={notPossibleState.compatibleSuggestions}
        onSelectCompatible={(langId) => {
          const spec = LANGUAGE_MAP[langId];
          if (spec) addCompatibleLanguageTab(spec);
        }}
        onClose={() =>
          setNotPossibleState((prev) => ({ ...prev, open: false }))
        }
      />

      <SaveFileModal
        open={saveOpen}
        language={activeLanguage}
        onSave={handleSaveFile}
        onClose={() => setSaveOpen(false)}
      />

      <FilesModal
        open={filesOpen}
        files={savedFiles}
        onLoadFile={handleLoadSavedFile}
        onDeleteFile={handleDeleteSavedFile}
        onClose={() => setFilesOpen(false)}
      />
    </div>
  );
}
