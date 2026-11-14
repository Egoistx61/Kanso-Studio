import vm from 'node:vm';

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  runtime: string;
  tables?: Array<{
    statement: string;
    columns: string[];
    rows: unknown[][];
  }>;
}

interface ProtectedText {
  masked: string;
  strings: Array<{ raw: string; quote: string; content: string; isTemplate?: boolean }>;
}

/**
 * Masks string literals and strips comments safely so transpilation passes
 * never corrupt characters inside string literals or comments.
 */
function protectStringsAndStripComments(
  code: string,
  options: {
    hashComments?: boolean;
    percentComments?: boolean;
    slashComments?: boolean;
    backtickStrings?: boolean;
    dollarStrings?: boolean;
  }
): ProtectedText {
  const strings: ProtectedText['strings'] = [];
  let out = '';
  let i = 0;
  const n = code.length;

  while (i < n) {
    const ch = code[i];
    const next = code[i + 1] ?? '';

    // C-style block comments /* ... */
    if (options.slashComments && ch === '/' && next === '*') {
      const start = i;
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) {
        if (code[i] === '\n') out += '\n';
        i++;
      }
      i = Math.min(n, i + 2);
      void start;
      out += ' ';
      continue;
    }

    // Line comments //
    if (options.slashComments && ch === '/' && next === '/') {
      while (i < n && code[i] !== '\n') i++;
      continue;
    }

    // Hash comments #
    if (options.hashComments && ch === '#') {
      while (i < n && code[i] !== '\n') i++;
      continue;
    }

    // MATLAB percent comments %
    if (options.percentComments && ch === '%') {
      if (next === '{') {
        i += 2;
        while (i < n && !(code[i] === '%' && code[i + 1] === '}')) {
          if (code[i] === '\n') out += '\n';
          i++;
        }
        i = Math.min(n, i + 2);
        continue;
      }
      while (i < n && code[i] !== '\n') i++;
      continue;
    }

    // C# interpolated string $"..."
    if (options.dollarStrings && ch === '$' && next === '"') {
      const start = i;
      i += 2;
      let content = '';
      while (i < n && code[i] !== '"') {
        if (code[i] === '\\' && i + 1 < n) {
          content += code[i] + code[i + 1];
          i += 2;
        } else {
          content += code[i];
          i++;
        }
      }
      i = Math.min(n, i + 1);
      const idx = strings.length;
      strings.push({ raw: code.slice(start, i), quote: '$"', content, isTemplate: true });
      out += `__STR_${idx}__`;
      continue;
    }

    // Double, single, or backtick strings
    if (ch === '"' || ch === "'" || (options.backtickStrings && ch === '`')) {
      const quote = ch;
      const start = i;
      i++;
      let content = '';
      while (i < n && code[i] !== quote) {
        if (code[i] === '\\' && i + 1 < n) {
          content += code[i] + code[i + 1];
          i += 2;
        } else {
          content += code[i];
          i++;
        }
      }
      i = Math.min(n, i + 1);
      const idx = strings.length;
      strings.push({ raw: code.slice(start, i), quote, content });
      out += `__STR_${idx}__`;
      continue;
    }

    out += ch;
    i++;
  }

  return { masked: out, strings };
}

function restoreStrings(
  code: string,
  strings: ProtectedText['strings'],
  transformString?: (entry: ProtectedText['strings'][number], idx: number) => string
): string {
  return code.replace(/__STR_(\d+)__/g, (_, numStr) => {
    const idx = Number(numStr);
    const entry = strings[idx];
    if (!entry) return '""';
    if (transformString) return transformString(entry, idx);
    if (entry.quote === '`') {
      return '`' + entry.content + '`';
    }
    if (entry.quote === "'") {
      return "'" + entry.content + "'";
    }
    return '"' + entry.content + '"';
  });
}

function injectLoopGuards(jsCode: string): string {
  // Adds iteration guard into while/for/do loops so infinite loops terminate safely
  return jsCode
    .replace(/\b(while\s*\([^)]*\)\s*\{)/g, '$1 __guard();')
    .replace(/\b(for\s*\([^;]*;[^;]*;[^)]*\)\s*\{)/g, '$1 __guard();')
    .replace(/\b(for\s*\([^)]+\bof\b[^)]*\)\s*\{)/g, '$1 __guard();')
    .replace(/\b(for\s*\([^)]+\bin\b[^)]*\)\s*\{)/g, '$1 __guard();');
}

function createRuntime(stdin: string) {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const stdinTokens = stdin.trim().length > 0 ? stdin.trim().split(/\s+/) : [];
  let stdinLineIdx = 0;
  const stdinLines = stdin.length > 0 ? stdin.replace(/\r\n/g, '\n').split('\n') : [];
  let tokenIdx = 0;
  let guardCount = 0;
  const startTime = Date.now();

  const __guard = () => {
    guardCount++;
    if (guardCount > 250000 || Date.now() - startTime > 3000) {
      throw new Error('Execution timed out (loop iteration limit exceeded)');
    }
  };

  const formatPrintf = (fmt: string, args: unknown[]): string => {
    let argIndex = 0;
    return fmt.replace(/%(-?\d*(?:\.\d+)?)(ld|lu|lf|d|i|u|f|s|c|x|X|o|%)/g, (match, spec, conv) => {
      if (conv === '%') return '%';
      const val = args[argIndex++];
      if (val === undefined) return match;
      if (conv === 'd' || conv === 'i' || conv === 'ld') {
        const n = Math.trunc(Number(val));
        return applyWidth(String(n), spec);
      }
      if (conv === 'u' || conv === 'lu') {
        return applyWidth(String(Math.max(0, Math.trunc(Number(val)))), spec);
      }
      if (conv === 'f' || conv === 'lf') {
        const dotMatch = spec.match(/\.(\d+)/);
        const prec = dotMatch ? Number(dotMatch[1]) : 6;
        const formatted = Number(val).toFixed(prec);
        const widthOnly = spec.replace(/\.\d+/, '');
        return applyWidth(formatted, widthOnly);
      }
      if (conv === 'x') return applyWidth(Math.trunc(Number(val)).toString(16), spec);
      if (conv === 'X') return applyWidth(Math.trunc(Number(val)).toString(16).toUpperCase(), spec);
      if (conv === 'o') return applyWidth(Math.trunc(Number(val)).toString(8), spec);
      if (conv === 'c') {
        return typeof val === 'number' ? String.fromCharCode(val) : String(val).slice(0, 1);
      }
      return applyWidth(String(val), spec);
    });
  };

  const applyWidth = (str: string, spec: string): string => {
    if (!spec) return str;
    const leftAlign = spec.startsWith('-');
    const width = parseInt(spec.replace('-', ''), 10);
    if (!width || str.length >= width) return str;
    const pad = ' '.repeat(width - str.length);
    return leftAlign ? str + pad : pad + str;
  };

  const formatRust = (fmt: string, args: unknown[]): string => {
    let idx = 0;
    return fmt.replace(/\{(:[?.a-zA-Z0-9]*|)\}/g, (_, spec) => {
      const val = args[idx++];
      if (val === undefined) return '';
      if (spec === ':?') return JSON.stringify(val);
      if (spec.startsWith(':.')) {
        const p = parseInt(spec.slice(2), 10);
        return Number.isFinite(p) ? Number(val).toFixed(p) : String(val);
      }
      return Array.isArray(val) ? `[${val.join(', ')}]` : String(val);
    });
  };

  const write = (s: unknown) => {
    stdoutChunks.push(String(s));
  };

  const writeln = (...args: unknown[]) => {
    stdoutChunks.push(args.map((a) => formatValue(a)).join(' ') + '\n');
  };

  const formatValue = (v: unknown): string => {
    if (v === null || v === undefined) return 'null';
    if (Array.isArray(v)) return '[' + v.map((x) => formatValue(x)).join(', ') + ']';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  const nextToken = () => stdinTokens[tokenIdx++] ?? '';
  const nextLine = () => stdinLines[stdinLineIdx++] ?? '';

  // Vector & Matrix helpers for R / MATLAB
  const range = (start: number, end: number, step = 1): number[] => {
    const res: number[] = [];
    if (step === 0) return res;
    if (step > 0) {
      for (let x = start; x <= end + 1e-12; x += step) {
        __guard();
        res.push(Number(x.toFixed(10)));
      }
    } else {
      for (let x = start; x >= end - 1e-12; x += step) {
        __guard();
        res.push(Number(x.toFixed(10)));
      }
    }
    return res;
  };

  const linspace = (a: number, b: number, n = 100): number[] => {
    if (n <= 1) return [b];
    const step = (b - a) / (n - 1);
    return Array.from({ length: n }, (_, i) => Number((a + i * step).toFixed(6)));
  };

  const vecOp = (a: unknown, b: unknown, op: (x: number, y: number) => number): unknown => {
    if (Array.isArray(a) && Array.isArray(b)) {
      const len = Math.max(a.length, b.length);
      return Array.from({ length: len }, (_, i) =>
        vecOp(a[i % a.length], b[i % b.length], op)
      );
    }
    if (Array.isArray(a)) return a.map((x) => vecOp(x, b, op));
    if (Array.isArray(b)) return b.map((y) => vecOp(a, y, op));
    return op(Number(a), Number(b));
  };

  const flattenNums = (v: unknown): number[] => {
    if (Array.isArray(v)) return v.flatMap(flattenNums);
    return [Number(v)];
  };

  const mean = (v: unknown) => {
    const nums = flattenNums(v);
    return nums.reduce((s, x) => s + x, 0) / (nums.length || 1);
  };

  const sum = (v: unknown) => flattenNums(v).reduce((s, x) => s + x, 0);

  const median = (v: unknown) => {
    const nums = [...flattenNums(v)].sort((a, b) => a - b);
    if (nums.length === 0) return 0;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  };

  const variance = (v: unknown) => {
    const nums = flattenNums(v);
    if (nums.length < 2) return 0;
    const m = mean(nums);
    return nums.reduce((s, x) => s + (x - m) ** 2, 0) / (nums.length - 1);
  };

  const sd = (v: unknown) => Math.sqrt(variance(v));

  const formatMatrix = (v: unknown): string => {
    if (!Array.isArray(v)) return String(v);
    if (v.length > 0 && Array.isArray(v[0])) {
      return (v as unknown[][])
        .map((row) => '  ' + row.map((cell) => Number(cell).toFixed(4).replace(/\.0000$/, '')).join('   '))
        .join('\n');
    }
    return '  ' + v.map((cell) => (typeof cell === 'number' ? Number(cell.toFixed(4).replace(/\.0000$/, '')) : String(cell))).join('   ');
  };

  return {
    __guard,
    __stdout: stdoutChunks,
    __stderr: stderrChunks,
    __write: write,
    __writeln: writeln,
    __printf: (fmt: string, ...args: unknown[]) => write(formatPrintf(fmt, args)),
    __sprintf: (fmt: string, ...args: unknown[]) => formatPrintf(fmt, args),
    __rustPrintln: (fmt: string, ...args: unknown[]) => write(formatRust(fmt, args) + '\n'),
    __rustPrint: (fmt: string, ...args: unknown[]) => write(formatRust(fmt, args)),
    __rustFormat: (fmt: string, ...args: unknown[]) => formatRust(fmt, args),
    __nextToken: nextToken,
    __nextLine: nextLine,
    __range: range,
    __linspace: linspace,
    __vecAdd: (a: unknown, b: unknown) => vecOp(a, b, (x, y) => x + y),
    __vecSub: (a: unknown, b: unknown) => vecOp(a, b, (x, y) => x - y),
    __vecMul: (a: unknown, b: unknown) => vecOp(a, b, (x, y) => x * y),
    __vecDiv: (a: unknown, b: unknown) => vecOp(a, b, (x, y) => x / y),
    __vecPow: (a: unknown, b: unknown) => vecOp(a, b, (x, y) => x ** y),
    __mean: mean,
    __sum: sum,
    __median: median,
    __var: variance,
    __sd: sd,
    __formatMatrix: formatMatrix,
    __formatValue: formatValue,
  };
}

function runTranspiledJS(jsCode: string, stdin: string, runtimeName: string): ExecutionResult {
  const start = performance.now();
  const rt = createRuntime(stdin);
  const guarded = injectLoopGuards(jsCode);

  const sandbox: Record<string, unknown> = {
    ...rt,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    JSON,
    Map,
    Set,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    console: {
      log: (...a: unknown[]) => rt.__writeln(...a),
      error: (...a: unknown[]) => rt.__stderr.push(a.map(String).join(' ') + '\n'),
    },
  };

  try {
    vm.createContext(sandbox);
    vm.runInContext(guarded, sandbox, { timeout: 3500 });
    return {
      stdout: rt.__stdout.join(''),
      stderr: rt.__stderr.join(''),
      exitCode: 0,
      durationMs: Math.max(1, Math.round(performance.now() - start)),
      runtime: runtimeName,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      stdout: rt.__stdout.join(''),
      stderr: (rt.__stderr.join('') + (msg ? msg + '\n' : '')).trim() + '\n',
      exitCode: 1,
      durationMs: Math.max(1, Math.round(performance.now() - start)),
      runtime: runtimeName,
    };
  }
}

/* ============================================================================
 * Language-specific AST / Syntax Transpilers -> Safe JavaScript
 * ========================================================================== */

function transpileJava(source: string): string {
  const { masked, strings } = protectStringsAndStripComments(source, { slashComments: true });
  let s = masked;
  s = s.replace(/^\s*(package|import)\s+[^;]+;\s*$/gm, '');
  s = s.replace(/\bpublic\s+static\s+void\s+main\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\{/g, 'function main() {');
  s = s.replace(/\b(?:public|private|protected)\s+static\s+[\w<>\[\]]+\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (_, name, params) => {
    const cleanParams = params
      .split(',')
      .map((p: string) => p.trim().split(/\s+/).pop() ?? '')
      .filter(Boolean)
      .join(', ');
    return `function ${name}(${cleanParams}) {`;
  });
  s = s.replace(/\b(?:public|private|protected)?\s*class\s+\w+\s*(?:extends\s+\w+\s*)?(?:implements\s+[\w,\s]+)?\{/g, '');
  s = s.replace(/System\.out\.println/g, '__javaPrintln');
  s = s.replace(/System\.out\.printf/g, '__printf');
  s = s.replace(/System\.out\.print/g, '__write');
  s = s.replace(/String\.format/g, '__sprintf');
  s = s.replace(/Arrays\.toString\(([^)]+)\)/g, 'JSON.stringify($1)');
  s = s.replace(/Arrays\.sort\(([^)]+)\)/g, '$1.sort((a,b)=>a-b)');
  s = s.replace(/\((?:double|float|int|long|short|byte)\)\s*/g, '');
  // Enhanced for loop: for (int x : arr)
  s = s.replace(/for\s*\(\s*(?:final\s+)?[\w<>\[\]]+\s+(\w+)\s*:\s*([^)]+)\)/g, 'for (let $1 of $2)');
  // Typed variable declarations & array initializers
  s = s.replace(/\bnew\s+(?:int|double|float|long|String|boolean)\s*\[\]\s*\{([^}]*)\}/g, '[$1]');
  s = s.replace(/\bnew\s+(?:int|double|float|long)\s*\[([^\]]+)\]/g, 'new Array($1).fill(0)');
  s = s.replace(/\bnew\s+ArrayList\s*(?:<[^>]*>)?\s*\(\s*\)/g, '[]');
  s = s.replace(/\b(?:int|double|float|long|short|byte|char|boolean|String|var)\s*\[\s*\]\s+(\w+)\s*=\s*\{([^}]*)\}/g, 'let $1 = [$2]');
  s = s.replace(/\b(?:int|double|float|long|short|byte|char|boolean|String|var|ArrayList<[^>]+>)\s+(\w+)\s*=/g, 'let $1 =');
  s = s.replace(/\b(?:int|double|float|long|short|byte|char|boolean|String)\s+(\w+)\s*;/g, 'let $1;');
  s = s.replace(/\.length\(\)/g, '.length');
  s = s.replace(/\.size\(\)/g, '.length');
  s = s.replace(/\.add\(/g, '.push(');
  s = s.replace(/\.get\(([^)]+)\)/g, '[$1]');
  s = s.replace(/\.equals\(([^)]+)\)/g, ' === ($1)');
  s = s.replace(/\bInteger\.parseInt\b/g, 'parseInt');
  s = s.replace(/\bDouble\.parseDouble\b/g, 'parseFloat');

  const openCount = (s.match(/\{/g) || []).length;
  const closeCount = (s.match(/\}/g) || []).length;
  if (closeCount > openCount) {
    for (let k = 0; k < closeCount - openCount; k++) {
      const last = s.lastIndexOf('}');
      if (last !== -1) s = s.slice(0, last) + s.slice(last + 1);
    }
  }

  const restored = restoreStrings(s, strings);
  return `
    const __javaPrintln = (...a) => __writeln(...a);
    ${restored}
    if (typeof main === 'function') main();
  `;
}

function replaceBalancedSwiftInterp(content: string): string {
  let out = '';
  let i = 0;
  while (i < content.length) {
    if (content[i] === '\\' && content[i + 1] === '(') {
      i += 2;
      let depth = 1;
      let expr = '';
      while (i < content.length && depth > 0) {
        if (content[i] === '(') depth++;
        else if (content[i] === ')') {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        expr += content[i];
        i++;
      }
      out += '${' + expr + '}';
    } else {
      out += content[i];
      i++;
    }
  }
  return out;
}

function transpileCSharp(source: string): string {
  const { masked, strings } = protectStringsAndStripComments(source, { slashComments: true, dollarStrings: true });
  let s = masked;
  s = s.replace(/^\s*using\s+[^;]+;\s*$/gm, '');
  s = s.replace(/\bnamespace\s+[\w.]+\s*\{?/g, '');
  s = s.replace(/\b(?:public|internal|private)?\s*class\s+\w+\s*\{/g, '{');
  s = s.replace(/\b(?:public|private|internal)?\s*static\s+(?:void|int|Task)\s+Main\s*\([^)]*\)\s*\{/g, 'function Main() {');
  s = s.replace(/\b(?:public|private|internal)?\s*static\s+[\w<>\[\]]+\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (_, name, params) => {
    const cleanParams = params
      .split(',')
      .map((p: string) => p.trim().split(/\s+/).pop() ?? '')
      .filter(Boolean)
      .join(', ');
    return `function ${name}(${cleanParams}) {`;
  });
  s = s.replace(/Console\.WriteLine/g, '__writeln');
  s = s.replace(/Console\.Write/g, '__write');
  s = s.replace(/foreach\s*\(\s*(?:var|[\w<>]+)\s+(\w+)\s+in\s+([^)]+)\)/g, 'for (let $1 of $2)');
  s = s.replace(/\bnew\s+List<[^>]+>\s*\(\s*\)\s*\{([^}]*)\}/g, '[$1]');
  s = s.replace(/\bnew\s+List<[^>]+>\s*\(\s*\)/g, '[]');
  s = s.replace(/\bnew\s+(?:int|double|float|string|bool)\s*\[\s*\]\s*\{([^}]*)\}/g, '[$1]');
  s = s.replace(/\b(?:int|double|float|decimal|long|bool|string|char|var)\s*\[\s*\]\s+(\w+)\s*=\s*\{([^}]*)\}/g, 'let $1 = [$2]');
  s = s.replace(/\b(?:int|double|float|decimal|long|bool|string|char|var)\s+(\w+)\s*=/g, 'let $1 =');
  s = s.replace(/\.Count\b/g, '.length');
  s = s.replace(/\.Length\b/g, '.length');
  s = s.replace(/\.Add\(/g, '.push(');
  s = s.replace(/\.ToUpper\(\)/g, '.toUpperCase()');
  s = s.replace(/\.ToLower\(\)/g, '.toLowerCase()');
  s = s.replace(/\bMath\.Sqrt\b/g, 'Math.sqrt');
  s = s.replace(/\bMath\.Pow\b/g, 'Math.pow');
  s = s.replace(/\bMath\.Abs\b/g, 'Math.abs');
  s = s.replace(/\bMath\.Max\b/g, 'Math.max');
  s = s.replace(/\bMath\.Min\b/g, 'Math.min');
  s = s.replace(/\bMath\.Round\b/g, '__csRound');
  s = s.replace(/\bMath\.PI\b/g, 'Math.PI');
  s = s.replace(/\bstring\.Join\(/g, '((sep, arr) => arr.join(sep))(');

  // Balance stray braces if class/namespace were stripped
  const openCount = (s.match(/\{/g) || []).length;
  const closeCount = (s.match(/\}/g) || []).length;
  if (closeCount > openCount) {
    for (let k = 0; k < closeCount - openCount; k++) {
      const last = s.lastIndexOf('}');
      if (last !== -1) s = s.slice(0, last) + s.slice(last + 1);
    }
  }

  const csExprTransform = (expr: string) =>
    expr
      .replace(/\.Count\b/g, '.length')
      .replace(/\.Length\b/g, '.length')
      .replace(/\bMath\.Round\b/g, '__csRound')
      .replace(/\bMath\.Sqrt\b/g, 'Math.sqrt')
      .replace(/\bMath\.Pow\b/g, 'Math.pow')
      .replace(/\bMath\.Abs\b/g, 'Math.abs');

  const restored = restoreStrings(s, strings, (entry) => {
    if (entry.quote === '$"') {
      return '`' + entry.content.replace(/\{([^}]+)\}/g, (_, inner) => '${' + csExprTransform(inner) + '}') + '`';
    }
    return entry.raw;
  });

  return `
    const __csRound = (v, d = 0) => Number(Number(v).toFixed(d));
    ${restored}
    if (typeof Main === 'function') Main();
  `;
}

function transpileC(source: string): string {
  const { masked, strings } = protectStringsAndStripComments(source, { slashComments: true });
  let s = masked;
  s = s.replace(/^\s*#include\s+[^\n]+/gm, '');
  s = s.replace(/^\s*#define\s+(\w+)\s+([^\n]+)/gm, 'const $1 = $2;');
  // Functions like int fib(int n) { ... } or void greet() { ... }
  s = s.replace(/\b(?:unsigned\s+|long\s+|short\s+|const\s+)?(?:void|int|long|double|float|char|bool)\s*\*?\s*(\w+)\s*\(([^)]*)\)\s*\{/g, (_, name, params) => {
    const cleanParams = params
      .trim()
      .split(',')
      .map((p: string) => {
        const t = p.trim();
        if (!t || t === 'void') return '';
        return t.replace(/\[[^\]]*\]/g, '').trim().split(/[\s*]+/).pop() ?? '';
      })
      .filter(Boolean)
      .join(', ');
    return `function ${name}(${cleanParams}) {`;
  });
  // Array declarations: int arr[] = {1, 2, 3}; or int arr[5] = {0};
  s = s.replace(/\b(?:const\s+)?(?:unsigned\s+|long\s+|short\s+)?(?:int|long|double|float|char|bool)\s+(\w+)\s*\[[^\]]*\]\s*=\s*\{([^}]*)\}/g, 'let $1 = [$2]');
  s = s.replace(/\b(?:const\s+)?(?:unsigned\s+|long\s+|short\s+)?(?:int|long|double|float|char)\s*\*\s*(\w+)\s*=/g, 'let $1 =');
  s = s.replace(/\b(?:const\s+)?(?:unsigned\s+|long\s+|short\s+)?(?:int|long|double|float|char|bool)\s+(\w+)\s*=/g, 'let $1 =');
  s = s.replace(/\b(?:int|long|double|float|char|bool)\s+(\w+)\s*;/g, 'let $1 = 0;');
  s = s.replace(/\((?:double|float|long|unsigned|short|int)\)\s*/g, '');
  s = s.replace(/\bprintf\s*\(/g, '__printf(');
  s = s.replace(/\bputs\s*\(/g, '__writeln(');
  s = s.replace(/\bputchar\s*\(([^)]+)\)/g, '__write(typeof $1 === "number" ? String.fromCharCode($1) : $1)');
  s = s.replace(/\bsqrt\b/g, 'Math.sqrt');
  s = s.replace(/\bpow\b/g, 'Math.pow');
  s = s.replace(/\babs\b/g, 'Math.abs');
  s = s.replace(/\bfabs\b/g, 'Math.abs');
  s = s.replace(/\bstrlen\(([^)]+)\)/g, 'String($1).length');
  s = s.replace(/\bsizeof\(([^)]+)\)\s*\/\s*sizeof\([^)]+\[0\]\)/g, '$1.length');

  const restored = restoreStrings(s, strings);
  return `
    ${restored}
    if (typeof main === 'function') main();
  `;
}

function transpileCpp(source: string): string {
  const { masked, strings } = protectStringsAndStripComments(source, { slashComments: true });
  let s = masked;
  s = s.replace(/^\s*#include\s+[^\n]+/gm, '');
  s = s.replace(/^\s*using\s+namespace\s+std\s*;\s*$/gm, '');
  // std::cout << a << b << std::endl;
  s = s.replace(/(?:std::)?cout\s*<<\s*([^;]+);/g, (_, chain) => {
    const parts = chain.split('<<').map((p: string) => {
      const t = p.trim();
      if (t === 'std::endl' || t === 'endl') return '"\\n"';
      return t;
    });
    return `__write(${parts.map((p: string) => `String(${p})`).join(' + ')});`;
  });
  // Functions
  s = s.replace(/\b(?:inline\s+|static\s+|const\s+)?(?:void|int|long\s+long|long|double|float|bool|auto|std::string|string)\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (_, name, params) => {
    const cleanParams = params
      .trim()
      .split(',')
      .map((p: string) => p.trim().replace(/[&*]/g, '').split(/\s+/).pop() ?? '')
      .filter((x: string) => x && x !== 'void')
      .join(', ');
    return `function ${name}(${cleanParams}) {`;
  });
  // Range-based for: for (auto x : vec) or for (int x : vec)
  s = s.replace(/for\s*\(\s*(?:const\s+)?[\w:&<>]+\s+(\w+)\s*:\s*([^)]+)\)/g, 'for (let $1 of $2)');
  // std::vector<int> v = {1, 2, 3};
  s = s.replace(/\b(?:std::)?vector\s*<[^>]+>\s+(\w+)\s*=\s*\{([^}]*)\}/g, 'let $1 = [$2]');
  s = s.replace(/\b(?:std::)?vector\s*<[^>]+>\s+(\w+)\s*;/g, 'let $1 = [];');
  s = s.replace(/\b(?:const\s+)?(?:auto|int|long\s+long|long|double|float|bool|char|std::string|string)\s+(\w+)\s*=\s*\{([^}]*)\}/g, 'let $1 = [$2]');
  s = s.replace(/\b(?:const\s+)?(?:auto|int|long\s+long|long|double|float|bool|char|std::string|string)\s+(\w+)\s*=/g, 'let $1 =');
  s = s.replace(/\b(?:int|long\s+long|long|double|float|bool|std::string|string)\s+(\w+)\s*;/g, 'let $1;');
  s = s.replace(/\.push_back\(/g, '.push(');
  s = s.replace(/\.size\(\)/g, '.length');
  s = s.replace(/\.length\(\)/g, '.length');
  s = s.replace(/\b(?:std::)?sort\s*\(\s*(\w+)\.begin\(\)\s*,\s*\1\.end\(\)\s*\)/g, '$1.sort((a,b)=>a-b)');
  s = s.replace(/\b(?:std::)?reverse\s*\(\s*(\w+)\.begin\(\)\s*,\s*\1\.end\(\)\s*\)/g, '$1.reverse()');
  s = s.replace(/\b(?:std::)?printf\s*\(/g, '__printf(');
  s = s.replace(/\bsqrt\b/g, 'Math.sqrt');
  s = s.replace(/\bpow\b/g, 'Math.pow');
  s = s.replace(/\babs\b/g, 'Math.abs');
  s = s.replace(/\b(?:std::)?max\b/g, 'Math.max');
  s = s.replace(/\b(?:std::)?min\b/g, 'Math.min');

  const restored = restoreStrings(s, strings);
  return `
    ${restored}
    if (typeof main === 'function') main();
  `;
}

function transpileRust(source: string): string {
  const { masked, strings } = protectStringsAndStripComments(source, { slashComments: true });
  let s = masked;
  s = s.replace(/\bprintln!\s*\(/g, '__rustPrintln(');
  s = s.replace(/\bprint!\s*\(/g, '__rustPrint(');
  s = s.replace(/\bformat!\s*\(/g, '__rustFormat(');
  s = s.replace(/\bvec!\s*\[([^\]]*)\]/g, '[$1]');
  // Functions: fn name(a: i32, b: i32) -> i32 {
  s = s.replace(/\bfn\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*[\w<>\[\]&'\s]+)?\{/g, (_, name, params) => {
    const cleanParams = params
      .split(',')
      .map((p: string) => p.split(':')[0].replace(/\bmut\b/g, '').trim())
      .filter(Boolean)
      .join(', ');
    return `function ${name}(${cleanParams}) {`;
  });
  // for i in 0..=n { or for i in 0..n { or for x in arr.iter() {
  s = s.replace(/for\s+(\w+)\s+in\s+([^\s{]+)\.\.=([^\s{]+)\s*\{/g, 'for (let $1 = $2; $1 <= $3; $1++) {');
  s = s.replace(/for\s+(\w+)\s+in\s+([^\s{]+)\.\.([^\s{]+)\s*\{/g, 'for (let $1 = $2; $1 < $3; $1++) {');
  s = s.replace(/for\s+(\w+)\s+in\s+([^{\n]+)\{/g, 'for (let $1 of $2) {');
  s = s.replace(/\bloop\s*\{/g, 'while (true) {');
  s = s.replace(/\bwhile\s+([^{\n]+)\{/g, 'while ($1) {');
  s = s.replace(/\bif\s+([^{\n]+)\{/g, 'if ($1) {');
  s = s.replace(/\}\s*else\s+if\s+([^{\n]+)\{/g, '} else if ($1) {');
  s = s.replace(/\blet\s+mut\s+(\w+)\s*(?::\s*[^=]+)?=/g, 'let $1 =');
  s = s.replace(/\blet\s+(\w+)\s*(?::\s*[^=]+)?=/g, 'let $1 =');
  s = s.replace(/\.iter\(\)/g, '');
  s = s.replace(/\.into_iter\(\)/g, '');
  s = s.replace(/\.collect::<[^>]+>\(\)/g, '');
  s = s.replace(/\.collect\(\)/g, '');
  s = s.replace(/\.len\(\)/g, '.length');
  s = s.replace(/\.push\(/g, '.push(');
  s = s.replace(/\.sum::<[^>]+>\(\)/g, '.reduce((a,b)=>a+b, 0)');
  s = s.replace(/\.sum\(\)/g, '.reduce((a,b)=>a+b, 0)');
  s = s.replace(/\.to_string\(\)/g, '');
  s = s.replace(/(\w+)\s+as\s+(?:f64|f32|i32|i64|usize)/g, 'Number($1)');
  s = s.replace(/\.map\(\|(\w+)\|\s*([^)]+)\)/g, '.map(($1) => ($2))');
  s = s.replace(/\.filter\(\|&?(\w+)\|\s*([^)]+)\)/g, '.filter(($1) => ($2))');

  const restored = restoreStrings(s, strings);
  return `
    ${restored}
    if (typeof main === 'function') main();
  `;
}

function transpileGo(source: string): string {
  const { masked, strings } = protectStringsAndStripComments(source, { slashComments: true, backtickStrings: true });
  let s = masked;
  s = s.replace(/^\s*package\s+\w+\s*$/gm, '');
  s = s.replace(/import\s*\([\s\S]*?\)/g, '');
  s = s.replace(/^\s*import\s+__STR_\d+__\s*$/gm, '');

  // func name(a int, b int) int {
  s = s.replace(/\bfunc\s+(\w+)\s*\(([^)]*)\)\s*(?:\([^)]*\)|[\w\[\]*]+)?\s*\{/g, (_, name, params) => {
    const cleanParams = params
      .split(',')
      .map((p: string) => {
        const parts = p.trim().split(/\s+/);
        return parts[0] ?? '';
      })
      .filter(Boolean)
      .join(', ');
    return `function ${name}(${cleanParams}) {`;
  });

  // for i, v := range slice {
  s = s.replace(/for\s+(\w+)\s*,\s*(\w+)\s*:=\s*range\s+([^{\n]+)\{/g, '__FOR__ (let [$1, $2] of ($3).entries()) {');
  s = s.replace(/for\s+(\w+)\s*:=\s*range\s+([^{\n]+)\{/g, '__FOR__ (let $1 = 0; $1 < ($2).length; $1++) {');
  // C-style Go for: for i := 0; i < n; i++ {
  s = s.replace(/for\s+([^;{\n]+);([^;{\n]+);([^{\n]+)\{/g, (_, init, cond, post) => {
    const jsInit = init.replace(/(\w+)\s*:=\s*/g, 'let $1 = ');
    return `__FOR__ (${jsInit}; ${cond}; ${post}) {`;
  });
  // Infinite Go loop: for {
  s = s.replace(/\bfor\s*\{/g, 'while (true) {');
  // While-style Go loop: for cond {
  s = s.replace(/\bfor\s+([^{\n]+)\{/g, 'while ($1) {');
  s = s.replace(/__FOR__/g, 'for');
  // Go if: if cond {
  s = s.replace(/\bif\s+([^{\n]+)\{/g, 'if ($1) {');
  s = s.replace(/\}\s*else\s+if\s+([^{\n]+)\{/g, '} else if ($1) {');

  // Slice literals: []int{1, 2, 3} -> [1, 2, 3]
  s = s.replace(/\[\]\w+\s*\{([^}]*)\}/g, '[$1]');
  // Short declaration: a := b or a, b := x, y
  s = s.replace(/\b(\w+(?:\s*,\s*\w+)*)\s*:=\s*([^\n;]+)/g, (_, lhs, rhs) => {
    if (lhs.includes(',')) return `let [${lhs}] = [${rhs}];`;
    return `let ${lhs} = ${rhs};`;
  });
  s = s.replace(/\bvar\s+(\w+)\s+[\w\[\]]+\s*=\s*/g, 'let $1 = ');
  s = s.replace(/\bvar\s+(\w+)\s+[\w\[\]]+/g, 'let $1');

  s = s.replace(/fmt\.Println/g, '__writeln');
  s = s.replace(/fmt\.Printf/g, '__printf');
  s = s.replace(/fmt\.Print/g, '__write');
  s = s.replace(/fmt\.Sprintf/g, '__sprintf');
  s = s.replace(/strings\.ToUpper\(([^)]+)\)/g, 'String($1).toUpperCase()');
  s = s.replace(/strings\.ToLower\(([^)]+)\)/g, 'String($1).toLowerCase()');
  s = s.replace(/strings\.Join\(([^,]+),\s*([^)]+)\)/g, '($1).join($2)');
  s = s.replace(/sort\.Ints\(([^)]+)\)/g, '($1).sort((a,b)=>a-b)');
  s = s.replace(/\blen\(([^)]+)\)/g, '($1).length');
  s = s.replace(/\bappend\(([^,]+),\s*([^)]+)\)/g, '[...($1), $2]');
  s = s.replace(/\bmath\.Sqrt\b/g, 'Math.sqrt');
  s = s.replace(/\bmath\.Pow\b/g, 'Math.pow');
  s = s.replace(/\bmath\.Abs\b/g, 'Math.abs');
  s = s.replace(/\bmath\.Max\b/g, 'Math.max');
  s = s.replace(/\bmath\.Min\b/g, 'Math.min');

  const restored = restoreStrings(s, strings);
  return `
    ${restored}
    if (typeof main === 'function') main();
  `;
}

function transpileSwift(source: string): string {
  const { masked, strings } = protectStringsAndStripComments(source, { slashComments: true });
  let s = masked;
  s = s.replace(/\bfunc\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*[\w<>\[\]?]+\s*)?\{/g, (_, name, params) => {
    const cleanParams = params
      .split(',')
      .map((p: string) => {
        const left = p.split(':')[0].trim().split(/\s+/);
        return left[left.length - 1] ?? '';
      })
      .filter(Boolean)
      .join(', ');
    return `function ${name}(${cleanParams}) {`;
  });
  s = s.replace(/\blet\s+(\w+)\s*(?::\s*[^=]+)?=/g, 'const $1 =');
  s = s.replace(/\bvar\s+(\w+)\s*(?::\s*[^=]+)?=/g, 'let $1 =');
  s = s.replace(/for\s+(\w+)\s+in\s+([^\s{]+)\.\.\.([^\s{]+)\s*\{/g, 'for (let $1 = $2; $1 <= $3; $1++) {');
  s = s.replace(/for\s+(\w+)\s+in\s+([^\s{]+)\.\.<([^\s{]+)\s*\{/g, 'for (let $1 = $2; $1 < $3; $1++) {');
  s = s.replace(/for\s+(\w+)\s+in\s+([^{\n]+)\{/g, 'for (let $1 of $2) {');
  s = s.replace(/\bwhile\s+([^{\n]+)\{/g, 'while ($1) {');
  s = s.replace(/\bif\s+([^{\n]+)\{/g, 'if ($1) {');
  s = s.replace(/\}\s*else\s+if\s+([^{\n]+)\{/g, '} else if ($1) {');
  s = s.replace(/\bprint\s*\(/g, '__writeln(');
  s = s.replace(/\.count\b/g, '.length');
  s = s.replace(/\.append\(/g, '.push(');
  s = s.replace(/\.sorted\(\)/g, '.slice().sort((a,b)=>a-b)');
  s = s.replace(/\.reversed\(\)/g, '.slice().reverse()');
  s = s.replace(/\.uppercased\(\)/g, '.toUpperCase()');
  s = s.replace(/\.lowercased\(\)/g, '.toLowerCase()');
  s = s.replace(/\bDouble\(([^)]+)\)/g, 'Number($1)');
  s = s.replace(/\bInt\(([^)]+)\)/g, 'Math.trunc(Number($1))');
  s = s.replace(/\bString\(([^)]+)\)/g, 'String($1)');

  const restored = restoreStrings(s, strings, (entry) => {
    // Swift string interpolation "\(expr)" with balanced parens
    const interp = replaceBalancedSwiftInterp(entry.content);
    return '`' + interp + '`';
  });
  return restored;
}

function transpileKotlin(source: string): string {
  const { masked, strings } = protectStringsAndStripComments(source, { slashComments: true });
  let s = masked;
  s = s.replace(/\bfun\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*[\w<>?]+\s*)?\{/g, (_, name, params) => {
    const cleanParams = params
      .split(',')
      .map((p: string) => p.split(':')[0].trim())
      .filter(Boolean)
      .join(', ');
    return `function ${name}(${cleanParams}) {`;
  });
  s = s.replace(/for\s*\(\s*(\w+)\s+in\s+([^\s.]+)\.\.([^\s)]+)\s*\)/g, 'for (let $1 = $2; $1 <= $3; $1++)');
  s = s.replace(/for\s*\(\s*(\w+)\s+in\s+([^\s]+)\s+until\s+([^\s)]+)\s*\)/g, 'for (let $1 = $2; $1 < $3; $1++)');
  s = s.replace(/for\s*\(\s*(\w+)\s+in\s+([^)]+)\)/g, 'for (let $1 of $2)');
  s = s.replace(/\bval\s+(\w+)\s*(?::\s*[^=]+)?=/g, 'const $1 =');
  s = s.replace(/\bvar\s+(\w+)\s*(?::\s*[^=]+)?=/g, 'let $1 =');
  s = s.replace(/\bprintln\s*\(/g, '__writeln(');
  s = s.replace(/\bprint\s*\(/g, '__write(');
  s = s.replace(/\b(?:mutableListOf|listOf|arrayOf|intArrayOf)\s*\(([^)]*)\)/g, '[$1]');
  s = s.replace(/\.size\b/g, '.length');
  s = s.replace(/\.add\(/g, '.push(');
  s = s.replace(/\.sum\(\)/g, '.reduce((a,b)=>a+b, 0)');
  s = s.replace(/\.sorted\(\)/g, '.slice().sort((a,b)=>a-b)');
  s = s.replace(/\.uppercase\(\)/g, '.toUpperCase()');
  s = s.replace(/\.lowercase\(\)/g, '.toLowerCase()');
  s = s.replace(/\.filter\s*\{\s*([^}]+)\}/g, '.filter((it) => ($1))');
  s = s.replace(/\.map\s*\{\s*([^}]+)\}/g, '.map((it) => ($1))');
  s = s.replace(/\.forEach\s*\{\s*([^}]+)\}/g, '.forEach((it) => { $1; })');
  s = s.replace(/\.joinToString\(([^)]*)\)/g, '.join($1)');

  const ktExprTransform = (expr: string) =>
    expr
      .replace(/\.sum\(\)/g, '.reduce((a,b)=>a+b, 0)')
      .replace(/\.size\b/g, '.length')
      .replace(/\.sorted\(\)/g, '.slice().sort((a,b)=>a-b)');

  const restored = restoreStrings(s, strings, (entry) => {
    if (entry.quote === '"') {
      const interp = entry.content
        .replace(/\$\{([^}]+)\}/g, (_, inner) => '${' + ktExprTransform(inner) + '}')
        .replace(/(?<!\\)\$([a-zA-Z_]\w*)/g, '${$1}');
      return '`' + interp + '`';
    }
    return entry.raw;
  });

  return `
    ${restored}
    if (typeof main === 'function') main();
  `;
}

function transpileDart(source: string): string {
  const { masked, strings } = protectStringsAndStripComments(source, { slashComments: true });
  let s = masked;
  s = s.replace(/\b(?:void|int|double|num|String|bool|List(?:<[^>]+>)?|dynamic)\s+(\w+)\s*\(([^)]*)\)\s*=>\s*([^;]+);/g, (_, name, params, body) => {
    const cleanParams = params
      .split(',')
      .map((p: string) => p.trim().split(/\s+/).pop() ?? '')
      .filter(Boolean)
      .join(', ');
    return `function ${name}(${cleanParams}) { return ${body}; }`;
  });
  s = s.replace(/\b(?:void|int|double|num|String|bool|List(?:<[^>]+>)?|dynamic)\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (_, name, params) => {
    const cleanParams = params
      .split(',')
      .map((p: string) => p.trim().split(/\s+/).pop() ?? '')
      .filter(Boolean)
      .join(', ');
    return `function ${name}(${cleanParams}) {`;
  });
  s = s.replace(/for\s*\(\s*(?:var|final|int|double|String)\s+(\w+)\s+in\s+([^)]+)\)/g, 'for (let $1 of $2)');
  s = s.replace(/\b(?:final|const)\s+(?:(?:int|double|num|String|bool|List(?:<[^>]+>)?|Map(?:<[^>]+>)?)\s+)?(\w+)\s*=/g, 'const $1 =');
  s = s.replace(/\b(?:var|int|double|num|String|bool|List(?:<[^>]+>)?|Map(?:<[^>]+>)?)\s+(\w+)\s*=/g, 'let $1 =');
  s = s.replace(/\bprint\s*\(/g, '__writeln(');
  s = s.replace(/\.where\(/g, '.filter(');
  s = s.replace(/\.toList\(\)/g, '');
  s = s.replace(/\.add\(/g, '.push(');
  s = s.replace(/\~\//g, '/');

  const restored = restoreStrings(s, strings, (entry) => {
    const interp = entry.content
      .replace(/\$\{([^}]+)\}/g, '${$1}')
      .replace(/(?<!\\)\$([a-zA-Z_]\w*)/g, '${$1}');
    return '`' + interp + '`';
  });

  return `
    ${restored}
    if (typeof main === 'function') main();
  `;
}

function transpilePHP(source: string): string {
  let raw = source.replace(/^\s*<\?php\s*/i, '').replace(/\?>\s*$/i, '');
  const { masked, strings } = protectStringsAndStripComments(raw, { slashComments: true, hashComments: true });
  let s = masked;

  s = s.replace(/foreach\s*\(\s*([^)]+)\s+as\s+\$(\w+)\s*=>\s*\$(\w+)\s*\)\s*\{/g, 'for (let [__php_$2, __php_$3] of Object.entries($1)) {');
  s = s.replace(/foreach\s*\(\s*([^)]+)\s+as\s+\$(\w+)\s*\)\s*\{/g, 'for (let __php_$2 of Object.values($1)) {');
  s = s.replace(/\bfunction\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (_, name, params) => {
    const cleanParams = params.replace(/\$/g, '__php_');
    return `function ${name}(${cleanParams}) {`;
  });
  // PHP variables $name -> __php_name
  s = s.replace(/\$([a-zA-Z_]\w*)/g, '__php_$1');
  // Declare first assignments safely in JS strict/non-strict
  s = s.replace(/\b(__php_\w+)\s*=/g, 'var $1 =');
  // Fix for loops: for (var __php_i = 0; ...)
  s = s.replace(/for\s*\(\s*var\s+/g, 'for (let ');
  // Associative array syntax ['a' => 1] -> ({'a': 1})
  s = s.replace(/\[([^\]]*=>[^\]]*)\]/g, (_, inner) => '{' + inner.replace(/=>/g, ':') + '}');
  s = s.replace(/\barray\s*\(([^)]*)\)/g, '[$1]');
  // PHP echo / print
  s = s.replace(/\becho\s+([^;]+);/g, '__write($1);');
  s = s.replace(/\bprint\s+([^;]+);/g, '__write($1);');
  s = s.replace(/\bprintf\s*\(/g, '__printf(');
  s = s.replace(/\bprint_r\s*\(([^)]+)\)/g, '__writeln($1)');
  s = s.replace(/\bvar_dump\s*\(([^)]+)\)/g, '__writeln($1)');
  // PHP string concatenation ` . ` -> ` + ` (careful not to hit floats like 3.14)
  s = s.replace(/(\S)\s+\.\s+(\S)/g, '$1 + $2');
  s = s.replace(/\.=/g, '+=');
  s = s.replace(/\bcount\(([^)]+)\)/g, '($1).length');
  s = s.replace(/\bstrlen\(([^)]+)\)/g, 'String($1).length');
  s = s.replace(/\bstrtoupper\(([^)]+)\)/g, 'String($1).toUpperCase()');
  s = s.replace(/\bstrtolower\(([^)]+)\)/g, 'String($1).toLowerCase()');
  s = s.replace(/\bimplode\(([^,]+),\s*([^)]+)\)/g, '($2).join($1)');
  s = s.replace(/\bexplode\(([^,]+),\s*([^)]+)\)/g, 'String($2).split($1)');
  s = s.replace(/\barray_sum\(([^)]+)\)/g, '($1).reduce((a,b)=>a+b, 0)');
  s = s.replace(/\barray_map\(([^,]+),\s*([^)]+)\)/g, '($2).map($1)');
  s = s.replace(/\barray_push\(([^,]+),\s*([^)]+)\)/g, '($1).push($2)');
  s = s.replace(/\bnumber_format\(([^,]+),\s*([^)]+)\)/g, 'Number($1).toFixed($2)');
  s = s.replace(/\bPHP_EOL\b/g, '"\\n"');

  const restored = restoreStrings(s, strings, (entry) => {
    if (entry.quote === '"' && /\$[a-zA-Z_{]/.test(entry.content)) {
      const interp = entry.content
        .replace(/\{\$([a-zA-Z_]\w*)\}/g, '${__php_$1}')
        .replace(/\$([a-zA-Z_]\w*)/g, '${__php_$1}');
      return '`' + interp + '`';
    }
    return entry.quote === '"' ? '"' + entry.content + '"' : "'" + entry.content + "'";
  });

  return restored;
}

function transpileRuby(source: string): string {
  const { masked, strings } = protectStringsAndStripComments(source, { hashComments: true });
  const lines = masked.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  const blockStack: string[] = [];

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) {
      out.push('');
      continue;
    }

    // (1..5).each do |i|
    let m = line.match(/^\(?([^.)]+)\.\.([^.)]+)\)?\.each\s+do\s*\|(\w+)\|\s*$/);
    if (m) {
      out.push(`for (let ${m[3]} = ${m[1]}; ${m[3]} <= ${m[2]}; ${m[3]}++) {`);
      blockStack.push('for');
      continue;
    }
    // 5.times do |i|
    m = line.match(/^(\w+|\d+)\.times\s+do\s*(?:\|(\w+)\|)?\s*$/);
    if (m) {
      const v = m[2] || '__idx';
      out.push(`for (let ${v} = 0; ${v} < ${m[1]}; ${v}++) {`);
      blockStack.push('for');
      continue;
    }
    // arr.each do |x|
    m = line.match(/^(.+)\.each\s+do\s*\|(\w+)\|\s*$/);
    if (m) {
      out.push(`for (let ${m[2]} of ${m[1]}) {`);
      blockStack.push('for');
      continue;
    }
    // def name(a, b) or def name a, b
    m = line.match(/^def\s+(\w+)(?:\(([^)]*)\)|\s+([^#\n]+))?$/);
    if (m) {
      const params = (m[2] ?? m[3] ?? '').trim();
      out.push(`function ${m[1]}(${params}) {`);
      blockStack.push('fn');
      continue;
    }
    if (/^if\s+/.test(line)) {
      out.push(`if (${line.replace(/^if\s+/, '')}) {`);
      blockStack.push('if');
      continue;
    }
    if (/^elsif\s+/.test(line)) {
      out.push(`} else if (${line.replace(/^elsif\s+/, '')}) {`);
      continue;
    }
    if (/^else$/.test(line)) {
      out.push(`} else {`);
      continue;
    }
    if (/^unless\s+/.test(line)) {
      out.push(`if (!(${line.replace(/^unless\s+/, '')})) {`);
      blockStack.push('if');
      continue;
    }
    if (/^while\s+/.test(line)) {
      out.push(`while (${line.replace(/^while\s+/, '')}) {`);
      blockStack.push('while');
      continue;
    }
    if (line === 'end') {
      blockStack.pop();
      out.push('}');
      continue;
    }

    // Inline transforms
    line = line.replace(/\bputs\s+(.+)$/, '__writeln($1)');
    line = line.replace(/\bprint\s+(.+)$/, '__write($1)');
    line = line.replace(/\bp\s+(.+)$/, '__writeln(JSON.stringify($1))');
    line = line.replace(/\.map\s*\{\s*\|(\w+)\|\s*([^}]+)\}/g, '.map(($1) => ($2))');
    line = line.replace(/\.select\s*\{\s*\|(\w+)\|\s*([^}]+)\}/g, '.filter(($1) => ($2))');
    line = line.replace(/\.reduce\(([^)]+)\)\s*\{\s*\|(\w+)\s*,\s*(\w+)\|\s*([^}]+)\}/g, '.reduce(($2, $3) => ($4), $1)');
    line = line.replace(/\.sum\b/g, '.reduce((a,b)=>a+b, 0)');
    line = line.replace(/\.length\b/g, '.length');
    line = line.replace(/\.size\b/g, '.length');
    line = line.replace(/\.push\b/g, '.push');
    line = line.replace(/\.sort\b/g, '.slice().sort((a,b)=>a-b)');
    line = line.replace(/\.reverse\b/g, '.slice().reverse()');
    line = line.replace(/\.upcase\b/g, '.toUpperCase()');
    line = line.replace(/\.downcase\b/g, '.toLowerCase()');
    line = line.replace(/\.to_s\b/g, '.toString()');
    line = line.replace(/\.to_i\b/g, '|0');
    line = line.replace(/\.join\(/g, '.join(');
    line = line.replace(/\bnil\b/g, 'null');

    // Implicit return on last line inside def? Handle explicit return + simple var assignment
    if (/^[a-zA-Z_]\w*\s*=[^=]/.test(line) && !/^(var|let|const)\s/.test(line)) {
      line = 'var ' + line;
    }
    out.push(line + ';');
  }

  const joined = out.join('\n');
  const restored = restoreStrings(joined, strings, (entry) => {
    if (entry.quote === '"') {
      const interp = entry.content.replace(/#\{([^}]+)\}/g, '${$1}');
      return '`' + interp + '`';
    }
    return "'" + entry.content + "'";
  });
  return restored;
}

function transpileR(source: string): string {
  const { masked, strings } = protectStringsAndStripComments(source, { hashComments: true });
  let s = masked;
  s = s.replace(/(\w+)\s*<-\s*function\s*\(([^)]*)\)\s*\{/g, 'function $1($2) {');
  s = s.replace(/(\w+)\s*<-\s*/g, 'var $1 = ');
  s = s.replace(/\bc\(([^)]*)\)/g, '[$1]');
  s = s.replace(/\b(\d+)\s*:\s*(\d+)\b/g, '__range($1, $2)');
  s = s.replace(/\bseq\(([^)]+)\)/g, '__rSeq($1)');
  s = s.replace(/\brep\(([^,]+),\s*([^)]+)\)/g, 'Array($2).fill($1)');
  s = s.replace(/for\s*\(\s*(\w+)\s+in\s+([^)]+)\)/g, 'for (let $1 of $2)');
  s = s.replace(/\bprint\(([^)]+)\)/g, '__rPrint($1)');
  s = s.replace(/\bcat\(([^)]+)\)/g, '__rCat($1)');
  s = s.replace(/\bpaste0\(([^)]+)\)/g, '[ $1 ].map(String).join("")');
  s = s.replace(/\bpaste\(([^)]+)\)/g, '[ $1 ].map(String).join(" ")');
  s = s.replace(/\bsprintf\(/g, '__sprintf(');
  s = s.replace(/\bmean\(/g, '__mean(');
  s = s.replace(/\bsum\(/g, '__sum(');
  s = s.replace(/\bmedian\(/g, '__median(');
  s = s.replace(/\bvar\(/g, '__var(');
  s = s.replace(/\bsd\(/g, '__sd(');
  s = s.replace(/\bsqrt\(/g, 'Math.sqrt(');
  s = s.replace(/\babs\(/g, 'Math.abs(');
  s = s.replace(/\bround\(([^,]+),\s*([^)]+)\)/g, 'Number(($1).toFixed($2))');
  s = s.replace(/\bround\(([^)]+)\)/g, 'Math.round($1)');
  s = s.replace(/\blength\(([^)]+)\)/g, '($1).length');
  s = s.replace(/\bsort\(([^)]+)\)/g, '[...($1)].sort((a,b)=>a-b)');
  s = s.replace(/\bmin\(([^)]+)\)/g, 'Math.min(...(Array.isArray($1)?$1:[$1]))');
  s = s.replace(/\bmax\(([^)]+)\)/g, 'Math.max(...(Array.isArray($1)?$1:[$1]))');
  s = s.replace(/\bsapply\(([^,]+),\s*([^)]+)\)/g, '($1).map($2)');
  s = s.replace(/\bTRUE\b/g, 'true').replace(/\bFALSE\b/g, 'false').replace(/\bNULL\b/g, 'null');

  const restored = restoreStrings(s, strings);
  return `
    const __rSeq = (a, b, by = 1) => __range(a, b, by);
    const __rPrint = (v) => {
      if (Array.isArray(v)) __writeln('[1] ' + v.map((x) => typeof x === 'number' ? Number(x.toFixed(4).replace(/\\.0000$/, '')) : x).join(' '));
      else __writeln('[1] ' + v);
    };
    const __rCat = (...args) => __write(args.map((a) => Array.isArray(a) ? a.join(' ') : String(a)).join(''));
    ${restored}
  `;
}

function transpileMatlab(source: string): string {
  const { masked, strings } = protectStringsAndStripComments(source, { percentComments: true });
  const lines = masked.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  const fnDefs: string[] = [];
  let inFunc = false;
  let currentFn: string[] = [];
  let fnReturnVar = '';
  let depth = 0;

  for (let rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;

    const fnMatch = line.match(/^function\s+(?:(\w+)\s*=\s*)?(\w+)\s*\(([^)]*)\)\s*$/);
    if (fnMatch) {
      inFunc = true;
      fnReturnVar = fnMatch[1] || '';
      currentFn = [`function ${fnMatch[2]}(${fnMatch[3]}) {`, fnReturnVar ? `let ${fnReturnVar};` : ''];
      depth = 1;
      continue;
    }

    const pushLine = (l: string) => {
      if (inFunc) currentFn.push(l);
      else out.push(l);
    };

    // Control structures
    const forMatch = line.match(/^for\s+(\w+)\s*=\s*(.+)$/);
    if (forMatch) {
      if (inFunc) depth++;
      pushLine(`for (let ${forMatch[1]} of ${convertMatlabExpr(forMatch[2])}) {`);
      continue;
    }
    const ifMatch = line.match(/^if\s+(.+)$/);
    if (ifMatch) {
      if (inFunc) depth++;
      pushLine(`if (${convertMatlabExpr(ifMatch[1])}) {`);
      continue;
    }
    const elseifMatch = line.match(/^elseif\s+(.+)$/);
    if (elseifMatch) {
      pushLine(`} else if (${convertMatlabExpr(elseifMatch[1])}) {`);
      continue;
    }
    if (line === 'else') {
      pushLine(`} else {`);
      continue;
    }
    const whileMatch = line.match(/^while\s+(.+)$/);
    if (whileMatch) {
      if (inFunc) depth++;
      pushLine(`while (${convertMatlabExpr(whileMatch[1])}) {`);
      continue;
    }
    if (line === 'end') {
      if (inFunc) {
        depth--;
        if (depth === 0) {
          if (fnReturnVar) currentFn.push(`return ${fnReturnVar};`);
          currentFn.push('}');
          fnDefs.push(currentFn.join('\n'));
          inFunc = false;
          currentFn = [];
          fnReturnVar = '';
          continue;
        }
      }
      pushLine('}');
      continue;
    }

    const suppressed = line.endsWith(';');
    if (suppressed) line = line.slice(0, -1).trim();
    if (!line) continue;

    // Assignment x = expr
    const assignMatch = line.match(/^([a-zA-Z_]\w*)\s*=\s*(.+)$/);
    if (assignMatch) {
      const lhs = assignMatch[1];
      const rhs = convertMatlabExpr(assignMatch[2]);
      pushLine(`var ${lhs} = ${rhs};`);
      if (!suppressed) {
        pushLine(`__writeln("${lhs} ="); __writeln(Array.isArray(${lhs}) ? __formatMatrix(${lhs}) : ${lhs});`);
      }
      continue;
    }

    const converted = convertMatlabExpr(line);
    pushLine(converted + ';');
  }

  const combined = [...fnDefs, ...out].join('\n');
  const restored = restoreStrings(combined, strings, (entry) => {
    return '"' + entry.content + '"';
  });

  return `
    const disp = (v) => __writeln(Array.isArray(v) ? __formatMatrix(v) : v);
    const fprintf = (fmt, ...args) => __printf(fmt, ...args);
    const sprintf = (fmt, ...args) => __sprintf(fmt, ...args);
    const linspace = (a, b, n = 100) => __linspace(a, b, n);
    const zeros = (r, c) => c === undefined ? Array.from({length:r},()=>Array(r).fill(0)) : Array.from({length:r},()=>Array(c).fill(0));
    const ones = (r, c) => c === undefined ? Array.from({length:r},()=>Array(r).fill(1)) : Array.from({length:r},()=>Array(c).fill(1));
    const eye = (n) => Array.from({length:n},(_,i)=>Array.from({length:n},(__,j)=>i===j?1:0));
    const sum = (v) => Array.isArray(v[0]) ? v[0].map((_,c)=>v.reduce((s,r)=>s+r[c],0)) : __sum(v);
    const mean = (v) => __mean(v);
    const std = (v) => __sd(v);
    const length = (v) => Array.isArray(v) ? v.length : 1;
    const size = (v) => Array.isArray(v) ? (Array.isArray(v[0]) ? [v.length, v[0].length] : [1, v.length]) : [1, 1];
    const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
    const sqrt = (v) => Array.isArray(v) ? v.map(sqrt) : Math.sqrt(v);
    const abs = (v) => Array.isArray(v) ? v.map(abs) : Math.abs(v);
    const sin = (v) => Array.isArray(v) ? v.map(sin) : Math.sin(v);
    const cos = (v) => Array.isArray(v) ? v.map(cos) : Math.cos(v);
    const exp = (v) => Array.isArray(v) ? v.map(exp) : Math.exp(v);
    const __matMul = (a, b) => {
      if (!Array.isArray(a) || !Array.isArray(b)) return __vecMul(a, b);
      if (Array.isArray(a[0]) && Array.isArray(b[0])) {
        return a.map(row => b[0].map((_, j) => row.reduce((s, val, k) => s + val * b[k][j], 0)));
      }
      return __vecMul(a, b);
    };
    const __transpose = (m) => {
      if (!Array.isArray(m)) return m;
      if (!Array.isArray(m[0])) return m.map(x => [x]);
      return m[0].map((_, c) => m.map(r => r[c]));
    };
    ${restored}
  `;
}

function convertMatlabExpr(expr: string): string {
  let e = expr.trim();
  // Matrix literals: [1 2 3; 4 5 6] or [1, 2, 3]
  e = e.replace(/\[([^\]]+)\]/g, (_, inner) => {
    if (inner.includes(';')) {
      const rows = inner.split(';').map((r: string) => '[' + r.trim().replace(/[,\s]+/g, ', ') + ']');
      return '[' + rows.join(', ') + ']';
    }
    return '[' + inner.trim().replace(/[,\s]+/g, ', ') + ']';
  });
  // Range start:step:end and start:end
  e = e.replace(/(\b[\w.)]+):([\w.)]+):([\w.(]+)/g, '__range($1, $3, $2)');
  e = e.replace(/(\b[\w.)]+):([\w.(]+)/g, '__range($1, $2)');
  // Elementwise ops .^ .* ./
  e = e.replace(/(\S+)\s*\.\^\s*(\S+)/g, '__vecPow($1, $2)');
  e = e.replace(/(\S+)\s*\.\*\s*(\S+)/g, '__vecMul($1, $2)');
  e = e.replace(/(\S+)\s*\.\/\s*(\S+)/g, '__vecDiv($1, $2)');
  e = e.replace(/(\w+)'/g, '__transpose($1)');
  e = e.replace(/\bmod\(/g, '((a,b)=>a%b)(');
  e = e.replace(/~=/g, '!==');
  return e;
}

export function executeTranspiledLanguage(language: string, code: string, stdin: string): ExecutionResult {
  try {
    switch (language) {
      case 'java':
        return runTranspiledJS(transpileJava(code), stdin, 'Java 21 Sandbox');
      case 'csharp':
        return runTranspiledJS(transpileCSharp(code), stdin, '.NET C# 12 Sandbox');
      case 'c':
        return runTranspiledJS(transpileC(code), stdin, 'C17 Sandbox');
      case 'cpp':
        return runTranspiledJS(transpileCpp(code), stdin, 'C++20 Sandbox');
      case 'rust':
        return runTranspiledJS(transpileRust(code), stdin, 'Rust Sandbox');
      case 'go':
        return runTranspiledJS(transpileGo(code), stdin, 'Go 1.23 Sandbox');
      case 'swift':
        return runTranspiledJS(transpileSwift(code), stdin, 'Swift 6 Sandbox');
      case 'kotlin':
        return runTranspiledJS(transpileKotlin(code), stdin, 'Kotlin 2.0 Sandbox');
      case 'dart':
        return runTranspiledJS(transpileDart(code), stdin, 'Dart 3.5 Sandbox');
      case 'php':
        return runTranspiledJS(transpilePHP(code), stdin, 'PHP 8.3 Sandbox');
      case 'ruby':
        return runTranspiledJS(transpileRuby(code), stdin, 'Ruby 3.3 Sandbox');
      case 'r':
        return runTranspiledJS(transpileR(code), stdin, 'R 4.4 Statistical Sandbox');
      case 'matlab':
        return runTranspiledJS(transpileMatlab(code), stdin, 'MATLAB Numeric Sandbox');
      default:
        return {
          stdout: '',
          stderr: `Unsupported language: ${language}\n`,
          exitCode: 1,
          durationMs: 1,
          runtime: 'Unknown',
        };
    }
  } catch (err) {
    return {
      stdout: '',
      stderr: (err instanceof Error ? err.message : String(err)) + '\n',
      exitCode: 1,
      durationMs: 1,
      runtime: language,
    };
  }
}
