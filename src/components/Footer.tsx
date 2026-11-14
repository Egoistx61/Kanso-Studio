import { ArrowUp, ArrowUpRight, Moon, Sun } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface FooterProps {
  page: 'landing' | 'workspace';
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const STUDIO_LINKS = [
  { label: 'Overview', href: '/' },
  { label: 'Workspace', href: '/app.html' },
  { label: 'Languages', href: '/#languages' },
  { label: 'Snippets', href: '/#snippets' },
  { label: 'Shortcuts', href: '/#shortcuts' },
];

const QUICK_LAUNCH_LANGUAGES = [
  { label: 'Python', href: '/app.html?lang=python' },
  { label: 'JavaScript', href: '/app.html?lang=javascript' },
  { label: 'TypeScript', href: '/app.html?lang=typescript' },
  { label: 'SQL', href: '/app.html?lang=sql' },
  { label: 'Rust', href: '/app.html?lang=rust' },
  { label: 'C++', href: '/app.html?lang=cpp' },
  { label: 'Java', href: '/app.html?lang=java' },
  { label: 'Go', href: '/app.html?lang=go' },
];

const COMBINED_PAIRS = [
  'Python + SQL',
  'JavaScript + TypeScript + SQL',
  'C + C++',
  'Java + Kotlin',
];

export function Footer({ page, theme, onToggleTheme }: FooterProps) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="border-t border-zinc-950/10 dark:border-white/10 bg-white dark:bg-[#0e0e11] text-zinc-600 dark:text-zinc-400 transition-colors duration-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Brand Column */}
          <div className="sm:col-span-2 lg:col-span-4 space-y-3.5">
            <a
              href="/"
              className="inline-flex items-center gap-2.5 font-display text-base font-bold tracking-tight text-zinc-950 dark:text-white whitespace-nowrap"
            >
              <BrandLogo className="w-6 h-6 shrink-0" />
              <span>Kanso Studio</span>
            </a>
            <p className="text-xs sm:text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 max-w-sm">
              Minimalist interactive coding playground for 17 languages with live execution, compatible multi-language tabs, and local file saves.
            </p>
            <div className="pt-1">
              <a
                href={page === 'landing' ? '/app.html' : '/#languages'}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-950 dark:text-white hover:opacity-75 transition-opacity whitespace-nowrap"
              >
                <span>
                  {page === 'landing' ? 'Open Coding Workspace' : 'Browse All 17 Languages'}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Studio Links */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="font-display text-xs font-bold tracking-tight text-zinc-950 dark:text-white">
              Navigation
            </h2>
            <ul className="space-y-2 text-xs">
              {STUDIO_LINKS.map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="hover:text-zinc-950 dark:hover:text-white transition-colors whitespace-nowrap"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Launch Languages */}
          <div className="lg:col-span-3 space-y-3">
            <h2 className="font-display text-xs font-bold tracking-tight text-zinc-950 dark:text-white">
              Quick Launch
            </h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {QUICK_LAUNCH_LANGUAGES.map((lang) => (
                <li key={lang.label}>
                  <a
                    href={lang.href}
                    className="hover:text-zinc-950 dark:hover:text-white transition-colors whitespace-nowrap"
                  >
                    {lang.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Compatible Pairs & Shortcuts */}
          <div className="lg:col-span-3 space-y-3">
            <h2 className="font-display text-xs font-bold tracking-tight text-zinc-950 dark:text-white">
              Compatible Tabs
            </h2>
            <ul className="space-y-2 text-xs font-mono text-zinc-600 dark:text-zinc-400">
              {COMBINED_PAIRS.map((pair) => (
                <li key={pair}>{pair}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Baseline */}
        <div className="mt-10 pt-6 border-t border-zinc-950/8 dark:border-white/8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-zinc-500 dark:text-zinc-400">
            <span>© {new Date().getFullYear()} Kanso Studio</span>
            <span aria-hidden="true">·</span>
            <span>17 Languages</span>
            <span aria-hidden="true">·</span>
            <span>White &amp; Dark Workspace</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-50 dark:bg-white/[0.04] text-zinc-950 dark:text-zinc-100 border border-zinc-950/12 dark:border-white/12 hover:border-zinc-950/30 dark:hover:border-white/30 transition-colors whitespace-nowrap"
            >
              {theme === 'light' ? (
                <Sun className="w-3.5 h-3.5" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
              <span>{theme === 'light' ? 'White Theme' : 'Dark Theme'}</span>
            </button>

            <button
              type="button"
              onClick={scrollToTop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Back to top</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
