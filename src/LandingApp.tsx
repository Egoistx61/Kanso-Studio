import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
} from 'motion/react';
import {
  ArrowRight,
  ArrowUp,
  Moon,
  MousePointer2,
  Search,
  Sun,
} from 'lucide-react';
import {
  LANGUAGES,
  LANGUAGE_MAP,
  type LanguageCategory,
} from './data/languages';
import { CodingCursor } from './components/CodingCursor';
import { TiltPanel3D } from './components/TiltPanel3D';
import { BrandLogo } from './components/BrandLogo';
import { LoadingScreen } from './components/LoadingScreen';
import { Footer } from './components/Footer';

const CATEGORIES: Array<'All' | LanguageCategory> = [
  'All',
  'Systems',
  'Scripting',
  'Web & Mobile',
  'Data & Query',
];

const FEATURED_SNIPPETS = [
  {
    langId: 'sql',
    exampleIdx: 1,
    title: 'Window Ranking Analytics',
    summary: 'Partitioned SQLite revenue ranking with window functions.',
  },
  {
    langId: 'rust',
    exampleIdx: 0,
    title: 'Zero-Cost Iterator Pipeline',
    summary: 'Vector mapping, collection, and println! macro formatting.',
  },
  {
    langId: 'matlab',
    exampleIdx: 0,
    title: 'Matrix & Linspace Algebra',
    summary: '2D matrix literal construction and statistical reductions.',
  },
  {
    langId: 'python',
    exampleIdx: 1,
    title: 'Recursive Quick Sort',
    summary: 'List comprehensions and divide-and-conquer sorting in Python 3.',
  },
  {
    langId: 'r',
    exampleIdx: 0,
    title: 'Statistical Distribution',
    summary: 'Vectorized mean, median, and standard deviation computations.',
  },
  {
    langId: 'go',
    exampleIdx: 0,
    title: 'Slice Aggregation',
    summary: 'Idiomatic range loops, append, and formatted printf output.',
  },
];

const SHORTCUTS = [
  {
    keys: '⌘ / Ctrl + Enter',
    action: 'Execute active program',
    detail: 'Runs code immediately from anywhere in the workspace.',
  },
  {
    keys: '⌘ / Ctrl + S',
    action: 'Save current file',
    detail: 'Stores your code into the local Files library.',
  },
  {
    keys: '⌘ / Ctrl + K',
    action: 'Open language matrix',
    detail: 'Search and switch across all 17 supported languages.',
  },
  {
    keys: '⌘ / Ctrl + J',
    action: 'Switch light / dark theme',
    detail: 'Alternates between crisp white and obsidian modes.',
  },
];

export default function LandingApp() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return localStorage.getItem('kanso-theme') === 'dark' ? 'dark' : 'light';
  });
  const [customCursor, setCustomCursor] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('kanso-cursor') !== 'off';
  });
  const [categoryFilter, setCategoryFilter] = useState<'All' | LanguageCategory>('All');
  const [langSearch, setLangSearch] = useState('');
  const [showBackTop, setShowBackTop] = useState(false);

  // Smooth GPU-composited scroll progress bar
  const { scrollYProgress, scrollY } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 32,
    restDelta: 0.001,
  });

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const next = latest > 360;
    setShowBackTop((prev) => (prev === next ? prev : next));
  });

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

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleTheme]);

  const filteredLanguages = useMemo(() => {
    return LANGUAGES.filter((l) => {
      const catOk = categoryFilter === 'All' || l.category === categoryFilter;
      const q = langSearch.trim().toLowerCase();
      const qOk =
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.shortCode.toLowerCase().includes(q) ||
        l.paradigm.toLowerCase().includes(q);
      return catOk && qOk;
    });
  }, [categoryFilter, langSearch]);

  const openWorkspace = (langId?: string, exampleIdx?: number) => {
    const params = new URLSearchParams();
    if (langId) params.set('lang', langId);
    if (typeof exampleIdx === 'number') params.set('example', String(exampleIdx));
    const qs = params.toString();
    window.location.href = qs ? `/app.html?${qs}` : '/app.html';
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f5f7] dark:bg-[#09090b] text-zinc-950 dark:text-zinc-50 transition-colors duration-200">
      <LoadingScreen label="Kanso Studio" />
      <CodingCursor enabled={customCursor} />

      {/* Top Bar (Strict 3-zone contract) + Scroll Progress Hairline */}
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
              href="#languages"
              className="relative py-1 hover:text-zinc-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:w-0 after:bg-zinc-950 dark:after:bg-white hover:after:w-full after:transition-all after:duration-200"
            >
              Languages
            </a>
            <a
              href="#snippets"
              className="relative py-1 hover:text-zinc-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:w-0 after:bg-zinc-950 dark:after:bg-white hover:after:w-full after:transition-all after:duration-200"
            >
              Snippets
            </a>
            <a
              href="#shortcuts"
              className="relative py-1 hover:text-zinc-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:w-0 after:bg-zinc-950 dark:after:bg-white hover:after:w-full after:transition-all after:duration-200"
            >
              Shortcuts
            </a>
            <a
              href="/app.html"
              className="relative py-1 hover:text-zinc-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:w-0 after:bg-zinc-950 dark:after:bg-white hover:after:w-full after:transition-all after:duration-200"
            >
              Workspace
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <motion.a
              href="/app.html"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-black-sm transition-shadow whitespace-nowrap shrink-0"
            >
              <span>Open Workspace</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
            </motion.a>
          </div>
        </div>

        {/* Scroll Progress Indicator */}
        <motion.div
          aria-hidden="true"
          style={{ scaleX: smoothProgress }}
          className="h-[2px] w-full origin-left bg-zinc-950 dark:bg-white"
        />
      </header>

      <main className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 sm:py-14 space-y-12 sm:space-y-16">
        {/* Mobile Section Links */}
        <nav
          aria-label="Mobile quick navigation"
          className="md:hidden flex items-center gap-5 overflow-x-auto pb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400"
        >
          <a href="#languages" className="hover:text-zinc-950 dark:hover:text-white whitespace-nowrap shrink-0">
            Languages
          </a>
          <a href="#snippets" className="hover:text-zinc-950 dark:hover:text-white whitespace-nowrap shrink-0">
            Snippets
          </a>
          <a href="#shortcuts" className="hover:text-zinc-950 dark:hover:text-white whitespace-nowrap shrink-0">
            Shortcuts
          </a>
          <a href="/app.html" className="text-zinc-950 dark:text-white font-semibold whitespace-nowrap shrink-0">
            Workspace →
          </a>
        </nav>

        {/* Minimalist Hero */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 sm:gap-8 pb-6 border-b border-zinc-950/10 dark:border-white/10"
        >
          <div className="space-y-4 max-w-2xl">
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-zinc-950 dark:text-white text-balance leading-[1.1]">
              Minimalist coding studio for 17 languages.
            </h1>
            <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Explore languages, curated snippets, and keyboard shortcuts below, then launch the dedicated workspace to write, run, and save your code.
            </p>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-2">
              <motion.a
                href="/app.html"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-black-md transition-shadow whitespace-nowrap"
              >
                <span>Launch Workspace</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-150" />
              </motion.a>
              <motion.a
                href="#languages"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-[#121215] text-zinc-950 dark:text-zinc-100 border border-zinc-950/15 dark:border-white/15 shadow-black-sm transition-shadow whitespace-nowrap"
              >
                Browse 17 Languages
              </motion.a>
            </div>
          </div>

          {/* Theme & Cursor Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <motion.button
              type="button"
              onClick={toggleTheme}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              aria-label="Toggle light and dark theme"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#17171b] text-zinc-950 dark:text-zinc-100 border border-zinc-950/15 dark:border-white/15 shadow-black-sm transition-colors whitespace-nowrap"
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
              <span>{theme === 'light' ? 'White Theme' : 'Dark Theme'}</span>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => setCustomCursor((c) => !c)}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-white dark:bg-[#17171b] text-zinc-950 dark:text-zinc-100 border border-zinc-950/15 dark:border-white/15 shadow-black-sm transition-colors whitespace-nowrap"
            >
              <MousePointer2 className="w-3.5 h-3.5" />
              <span>{customCursor ? 'Coding Cursor: On' : 'Coding Cursor: Off'}</span>
            </motion.button>
          </div>
        </motion.section>

        {/* Section 1: Languages (3D Cursor-Reactive Panels + Scroll Animation) */}
        <motion.section
          id="languages"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.08 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
                Languages
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Select any 3D language panel to launch it directly inside the workspace editor.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-200/70 dark:bg-white/[0.06] overflow-x-auto max-w-full kanso-scroll">
                {CATEGORIES.map((cat) => {
                  const active = categoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`relative px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'text-zinc-950 dark:text-white'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="landing-category-pill"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          className="absolute inset-0 rounded-md bg-white dark:bg-zinc-800 shadow-sm"
                        />
                      )}
                      <span className="relative z-10">{cat}</span>
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={langSearch}
                  onChange={(e) => setLangSearch(e.target.value)}
                  placeholder="Filter language..."
                  className="pl-8 pr-3 py-2 sm:py-1.5 rounded-lg text-xs bg-white dark:bg-[#121215] border border-zinc-950/15 dark:border-white/15 text-zinc-950 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 dark:focus:border-white w-full transition-colors"
                />
              </div>
            </div>
          </div>

          {filteredLanguages.length === 0 ? (
            <div className="p-10 rounded-xl bg-white dark:bg-[#121215] border border-zinc-950/15 dark:border-white/15 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No languages match your filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredLanguages.map((lang, idx) => (
                <motion.div
                  key={lang.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{
                    duration: 0.28,
                    delay: Math.min(idx * 0.025, 0.25),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <TiltPanel3D
                    maxTilt={9}
                    onClick={() => openWorkspace(lang.id)}
                    className="group rounded-xl p-5 bg-white dark:bg-[#121215] text-zinc-950 dark:text-zinc-100 border border-zinc-950/12 dark:border-white/12 shadow-black-sm flex flex-col justify-between min-h-[144px] h-full"
                  >
                    <div>
                      <div className="flex items-baseline justify-between gap-2 mb-2">
                        <h3 className="font-display text-base font-bold tracking-tight group-hover:translate-x-0.5 transition-transform duration-150">
                          {lang.name}
                        </h3>
                        <span className="font-mono text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                          {lang.shortCode}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {lang.tagline}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-950/8 dark:border-white/8 flex items-center justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400">
                      <span>{lang.category}</span>
                      <span>{lang.filename}</span>
                    </div>
                  </TiltPanel3D>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Section 2: Snippets (3D Cursor-Reactive Panels + Scroll Animation) */}
        <motion.section
          id="snippets"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.12 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6 pt-2"
        >
          <div className="space-y-1">
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
              Snippets
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Click any snippet card to open it pre-loaded in the coding workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURED_SNIPPETS.map((item, idx) => {
              const lang = LANGUAGE_MAP[item.langId];
              if (!lang) return null;
              return (
                <motion.div
                  key={`${item.langId}-${item.exampleIdx}`}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{
                    duration: 0.28,
                    delay: idx * 0.04,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <TiltPanel3D
                    maxTilt={8}
                    onClick={() => openWorkspace(item.langId, item.exampleIdx)}
                    className="group rounded-xl p-5 bg-white dark:bg-[#121215] border border-zinc-950/12 dark:border-white/12 shadow-black-sm flex flex-col justify-between min-h-[150px] h-full"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-2">
                        <span className="font-semibold text-zinc-950 dark:text-zinc-100">
                          {lang.name}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{lang.filename}</span>
                      </div>
                      <h3 className="font-display text-base font-bold text-zinc-950 dark:text-white mb-1.5">
                        {item.title}
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {item.summary}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-950/8 dark:border-white/8 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-950 dark:text-zinc-100">
                      <span>Open in Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-150" />
                    </div>
                  </TiltPanel3D>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* Section 3: Shortcuts (3D Cursor-Reactive Panels + Scroll Animation) */}
        <motion.section
          id="shortcuts"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6 pt-2 pb-8"
        >
          <div className="space-y-1">
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
              Shortcuts
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Navigate, save, and execute without leaving the keyboard.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SHORTCUTS.map((sc, idx) => (
              <motion.div
                key={sc.keys}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{
                  duration: 0.28,
                  delay: idx * 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <TiltPanel3D
                  maxTilt={10}
                  className="rounded-xl p-5 bg-white dark:bg-[#121215] border border-zinc-950/12 dark:border-white/12 shadow-black-sm flex flex-col justify-between h-full"
                >
                  <div>
                    <div className="font-mono text-xs font-semibold text-zinc-950 dark:text-white mb-2">
                      {sc.keys}
                    </div>
                    <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-zinc-100 mb-1">
                      {sc.action}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                      {sc.detail}
                    </p>
                  </div>
                </TiltPanel3D>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </main>

      {/* Scroll-to-Top Floating Micro-Button */}
      <AnimatePresence>
        {showBackTop && (
          <motion.button
            type="button"
            onClick={scrollToTop}
            aria-label="Scroll back to top"
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-black-md"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>Top</span>
          </motion.button>
        )}
      </AnimatePresence>

      <Footer page="landing" theme={theme} onToggleTheme={toggleTheme} />
    </div>
  );
}
