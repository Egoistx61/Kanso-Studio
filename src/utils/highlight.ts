export interface HighlightToken {
  text: string;
  type: 'plain' | 'keyword' | 'type' | 'string' | 'number' | 'comment' | 'function' | 'operator';
}

const KEYWORDS = new Set([
  'def', 'fn', 'func', 'fun', 'function', 'return', 'if', 'else', 'elif', 'elsif', 'elseif',
  'for', 'while', 'do', 'loop', 'in', 'of', 'break', 'continue', 'switch', 'case', 'default',
  'match', 'when', 'class', 'struct', 'interface', 'impl', 'extends', 'implements', 'package',
  'import', 'using', 'namespace', 'include', 'define', 'public', 'private', 'protected',
  'static', 'const', 'let', 'var', 'val', 'final', 'mut', 'auto', 'new', 'true', 'false',
  'True', 'False', 'None', 'null', 'nil', 'NULL', 'TRUE', 'FALSE', 'and', 'or', 'not',
  'foreach', 'as', 'echo', 'print', 'println', 'puts', 'end', 'unless', 'guard', 'SELECT',
  'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'CREATE', 'TABLE', 'UPDATE', 'SET', 'DELETE',
  'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'ON', 'AS', 'OVER',
  'PARTITION', 'PRIMARY', 'KEY', 'NOT', 'NULL', 'COUNT', 'SUM', 'AVG', 'ROUND', 'RANK',
  'select', 'from', 'where', 'insert', 'into', 'values', 'create', 'table', 'group', 'by',
  'order', 'join', 'on', 'as', 'range', 'until', 'throws', 'try', 'catch', 'finally',
]);

const TYPES = new Set([
  'int', 'float', 'double', 'long', 'short', 'byte', 'char', 'bool', 'boolean', 'void',
  'string', 'String', 'str', 'list', 'dict', 'vector', 'List', 'Map', 'Array', 'ArrayList',
  'HashMap', 'Int', 'Double', 'Bool', 'i32', 'i64', 'f32', 'f64', 'usize', 'Vec', 'INTEGER',
  'TEXT', 'REAL', 'NUMERIC', 'number', 'unknown', 'any', 'dynamic', 'num', 'decimal',
]);

export function tokenizeCode(code: string, language: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;
  const n = code.length;
  const isHashComment = language === 'python' || language === 'ruby' || language === 'r' || language === 'php';
  const isPercentComment = language === 'matlab';
  const isSqlComment = language === 'sql';
  const isSlashComment = !isSqlComment && !isPercentComment && language !== 'python' && language !== 'ruby' && language !== 'r';

  while (i < n) {
    const ch = code[i];
    const next = code[i + 1] ?? '';

    // Line comments
    if (
      (isSlashComment && ch === '/' && next === '/') ||
      (isHashComment && ch === '#') ||
      (isPercentComment && ch === '%') ||
      (isSqlComment && ch === '-' && next === '-')
    ) {
      let j = i;
      while (j < n && code[j] !== '\n') j++;
      tokens.push({ text: code.slice(i, j), type: 'comment' });
      i = j;
      continue;
    }

    // Block comments /* ... */
    if ((isSlashComment || isSqlComment) && ch === '/' && next === '*') {
      let j = i + 2;
      while (j < n && !(code[j] === '*' && code[j + 1] === '/')) j++;
      j = Math.min(n, j + 2);
      tokens.push({ text: code.slice(i, j), type: 'comment' });
      i = j;
      continue;
    }

    // Preprocessor directives in C/C++
    if ((language === 'c' || language === 'cpp') && ch === '#') {
      let j = i;
      while (j < n && code[j] !== '\n') j++;
      tokens.push({ text: code.slice(i, j), type: 'keyword' });
      i = j;
      continue;
    }

    // Strings
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < n && code[j] !== quote && code[j] !== '\n') {
        if (code[j] === '\\' && j + 1 < n) j += 2;
        else j++;
      }
      if (j < n && code[j] === quote) j++;
      tokens.push({ text: code.slice(i, j), type: 'string' });
      i = j;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch) && (i === 0 || !/[a-zA-Z0-9_$]/.test(code[i - 1]))) {
      let j = i;
      while (j < n && /[0-9._xXa-fA-F]/.test(code[j])) j++;
      tokens.push({ text: code.slice(i, j), type: 'number' });
      i = j;
      continue;
    }

    // Identifiers & Keywords
    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[a-zA-Z0-9_$!]/.test(code[j])) j++;
      const word = code.slice(i, j);
      // Look ahead for function call
      let k = j;
      while (k < n && code[k] === ' ') k++;
      if (KEYWORDS.has(word)) {
        tokens.push({ text: word, type: 'keyword' });
      } else if (TYPES.has(word)) {
        tokens.push({ text: word, type: 'type' });
      } else if (code[k] === '(') {
        tokens.push({ text: word, type: 'function' });
      } else {
        tokens.push({ text: word, type: 'plain' });
      }
      i = j;
      continue;
    }

    // Plain / punctuation chunking for speed
    let j = i + 1;
    while (
      j < n &&
      !/[a-zA-Z0-9_$"'`#%/\-]/.test(code[j])
    ) {
      j++;
    }
    tokens.push({ text: code.slice(i, j), type: 'plain' });
    i = j;
  }

  return tokens;
}
