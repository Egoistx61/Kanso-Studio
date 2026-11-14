import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import * as esbuild from 'esbuild';
import { executeTranspiledLanguage, type ExecutionResult } from './transpiler.ts';

const EXECUTION_TIMEOUT_MS = 5000;
const MAX_OUTPUT_BYTES = 128 * 1024;

function runProcess(
  command: string,
  args: string[],
  stdin: string,
  runtime: string,
  extraEnv?: Record<string, string>
): Promise<ExecutionResult> {
  return new Promise((resolve) => {
    const start = performance.now();
    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        PATH: process.env.PATH,
        HOME: os.tmpdir(),
        LANG: 'C.UTF-8',
        ...(extraEnv ?? {}),
      },
    });

    let stdout = '';
    let stderr = '';
    let finished = false;
    let timedOut = false;

    const timer = setTimeout(() => {
      if (!finished) {
        timedOut = true;
        child.kill('SIGKILL');
      }
    }, EXECUTION_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length < MAX_OUTPUT_BYTES) {
        stdout += chunk.toString('utf8');
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      if (stderr.length < MAX_OUTPUT_BYTES) {
        stderr += chunk.toString('utf8');
      }
    });

    child.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({
        stdout,
        stderr: err.message + '\n',
        exitCode: 1,
        durationMs: Math.max(1, Math.round(performance.now() - start)),
        runtime,
      });
    });

    child.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (timedOut) {
        stderr += '\nProcess terminated: execution exceeded 5000ms timeout.\n';
      }
      resolve({
        stdout: stdout.slice(0, MAX_OUTPUT_BYTES),
        stderr: stderr.slice(0, MAX_OUTPUT_BYTES),
        exitCode: timedOut ? 124 : (code ?? 0),
        durationMs: Math.max(1, Math.round(performance.now() - start)),
        runtime,
      });
    });

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

async function runPython(
  code: string,
  stdin: string,
  extraEnv?: Record<string, string>
): Promise<ExecutionResult> {
  const tmpFile = path.join(os.tmpdir(), `kanso_${crypto.randomUUID()}.py`);
  await fs.writeFile(tmpFile, code, 'utf8');
  try {
    const res = await runProcess('python3', ['-I', tmpFile], stdin, 'Python 3.10', extraEnv);
    res.stderr = res.stderr.replaceAll(tmpFile, 'main.py');
    return res;
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}

async function runJavaScript(code: string, stdin: string): Promise<ExecutionResult> {
  const tmpFile = path.join(os.tmpdir(), `kanso_${crypto.randomUUID()}.mjs`);
  // Provide lightweight readStdin helper while supporting standard console.log
  const wrapped = stdin
    ? `import fs from 'node:fs';\n${code}`
    : code;
  await fs.writeFile(tmpFile, wrapped, 'utf8');
  try {
    const res = await runProcess('node', [tmpFile], stdin, `Node.js ${process.version}`);
    res.stderr = res.stderr.replaceAll(tmpFile, 'main.js');
    return res;
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}

async function runTypeScript(code: string, stdin: string): Promise<ExecutionResult> {
  const start = performance.now();
  try {
    const transformed = await esbuild.transform(code, {
      loader: 'ts',
      target: 'node22',
      format: 'esm',
    });
    const tmpFile = path.join(os.tmpdir(), `kanso_${crypto.randomUUID()}.mjs`);
    await fs.writeFile(tmpFile, transformed.code, 'utf8');
    try {
      const res = await runProcess('node', [tmpFile], stdin, 'TypeScript (esbuild + Node 22)');
      res.stderr = res.stderr.replaceAll(tmpFile, 'main.ts');
      return res;
    } finally {
      await fs.unlink(tmpFile).catch(() => {});
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      stdout: '',
      stderr: msg + '\n',
      exitCode: 1,
      durationMs: Math.max(1, Math.round(performance.now() - start)),
      runtime: 'TypeScript',
    };
  }
}

async function runSQL(code: string, dbPath = ':memory:'): Promise<ExecutionResult> {
  const start = performance.now();
  const pyRunner = `
import json, sqlite3, sys

db_path = sys.argv[1] if len(sys.argv) > 1 else ":memory:"
sql_script = sys.stdin.read()
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Split SQL safely preserving string literals & comments
statements = []
buf = []
in_sq = False
in_dq = False
in_line_comment = False
in_block_comment = False
i = 0
n = len(sql_script)

while i < n:
    ch = sql_script[i]
    nxt = sql_script[i + 1] if i + 1 < n else ""
    if in_line_comment:
        buf.append(ch)
        if ch == "\\n":
            in_line_comment = False
        i += 1
        continue
    if in_block_comment:
        buf.append(ch)
        if ch == "*" and nxt == "/":
            buf.append("/")
            in_block_comment = False
            i += 2
            continue
        i += 1
        continue
    if not in_sq and not in_dq:
        if ch == "-" and nxt == "-":
            in_line_comment = True
            buf.append(ch)
            i += 1
            continue
        if ch == "/" and nxt == "*":
            in_block_comment = True
            buf.append(ch)
            i += 1
            continue
    if ch == "'" and not in_dq:
        if in_sq and nxt == "'":
            buf.append("''")
            i += 2
            continue
        in_sq = not in_sq
    elif ch == '"' and not in_sq:
        in_dq = not in_dq
    elif ch == ";" and not in_sq and not in_dq:
        stmt = "".join(buf).strip()
        if stmt:
            statements.append(stmt)
        buf = []
        i += 1
        continue
    buf.append(ch)
    i += 1

tail = "".join(buf).strip()
if tail:
    statements.append(tail)

tables = []
text_parts = []
try:
    for stmt in statements:
        # Check if statement has actual SQL beyond comments
        cleaned = "\\n".join(line for line in stmt.splitlines() if not line.strip().startswith("--")).strip()
        if not cleaned:
            continue
        cur.execute(stmt)
        if cur.description is not None:
            cols = [d[0] for d in cur.description]
            rows = [list(r) for r in cur.fetchall()]
            tables.append({"statement": cleaned, "columns": cols, "rows": rows})
            # Render clean ASCII table
            widths = [len(str(c)) for c in cols]
            for r in rows:
                for idx, val in enumerate(r):
                    widths[idx] = max(widths[idx], len("NULL" if val is None else str(val)))
            sep = "+-" + "-+-".join("-" * w for w in widths) + "-+"
            header = "| " + " | ".join(str(c).ljust(widths[idx]) for idx, c in enumerate(cols)) + " |"
            lines = [sep, header, sep]
            for r in rows:
                lines.append("| " + " | ".join(("NULL" if val is None else str(val)).ljust(widths[idx]) for idx, val in enumerate(r)) + " |")
            lines.append(sep)
            lines.append(f"{len(rows)} row(s) returned")
            text_parts.append("\\n".join(lines))
        else:
            affected = cur.rowcount if cur.rowcount >= 0 else 0
            text_parts.append(f"OK ({affected} row(s) affected)")
    conn.commit()
    print(json.dumps({"stdout": "\\n\\n".join(text_parts) + ("\\n" if text_parts else ""), "stderr": "", "exitCode": 0, "tables": tables}))
except Exception as e:
    print(json.dumps({"stdout": "\\n\\n".join(text_parts), "stderr": str(e) + "\\n", "exitCode": 1, "tables": tables}))
`;
  const res = await runProcess('python3', ['-I', '-c', pyRunner, dbPath], code, 'SQLite 3.40');
  const durationMs = Math.max(1, Math.round(performance.now() - start));
  if (res.stdout.trim()) {
    try {
      const parsed = JSON.parse(res.stdout);
      return {
        stdout: parsed.stdout ?? '',
        stderr: parsed.stderr ?? '',
        exitCode: parsed.exitCode ?? 0,
        durationMs,
        runtime: 'SQLite 3.40',
        tables: parsed.tables ?? [],
      };
    } catch {
      // Fallback if JSON parse fails
    }
  }
  return {
    stdout: res.stdout,
    stderr: res.stderr || 'SQL execution failed.\n',
    exitCode: res.exitCode || 1,
    durationMs,
    runtime: 'SQLite 3.40',
  };
}

export async function executeCode(
  language: string,
  code: string,
  stdin = ''
): Promise<ExecutionResult> {
  if (!code.trim()) {
    return {
      stdout: '',
      stderr: 'Nothing to execute: editor is empty.\n',
      exitCode: 1,
      durationMs: 1,
      runtime: language,
    };
  }

  switch (language) {
    case 'python':
      return runPython(code, stdin);
    case 'javascript':
      return runJavaScript(code, stdin);
    case 'typescript':
      return runTypeScript(code, stdin);
    case 'sql':
      return runSQL(code);
    default:
      return executeTranspiledLanguage(language, code, stdin);
  }
}

export interface ExecutionFile {
  language: string;
  code: string;
  filename?: string;
}

const SERVER_COMPAT_GROUPS: string[][] = [
  ['javascript', 'typescript', 'sql'],
  ['python', 'sql'],
  ['c', 'cpp'],
  ['java', 'kotlin'],
];

export async function executeCombinedFiles(
  files: ExecutionFile[],
  stdin = ''
): Promise<ExecutionResult> {
  if (files.length === 0) {
    return {
      stdout: '',
      stderr: 'Nothing to execute: no active files.\n',
      exitCode: 1,
      durationMs: 1,
      runtime: 'Studio',
    };
  }

  if (files.length === 1) {
    return executeCode(files[0].language, files[0].code, stdin);
  }

  const start = performance.now();
  const uniqueLangs = Array.from(new Set(files.map((f) => f.language)));
  const isCompatible = SERVER_COMPAT_GROUPS.some((group) =>
    uniqueLangs.every((id) => group.includes(id))
  );

  if (!isCompatible) {
    return {
      stdout: '',
      stderr: `Not possible: ${uniqueLangs.join(' + ')} cannot execute together in the same runtime.\n`,
      exitCode: 1,
      durationMs: Math.max(1, Math.round(performance.now() - start)),
      runtime: 'Incompatible Runtimes',
    };
  }

  // 1. Python + SQLite shared DB execution
  if (uniqueLangs.includes('python') && uniqueLangs.includes('sql')) {
    const dbPath = path.join(os.tmpdir(), `kanso_shared_${crypto.randomUUID()}.db`);
    const sqlFiles = files.filter((f) => f.language === 'sql');
    const pyFiles = files.filter((f) => f.language === 'python');
    let combinedStdout = '';
    let combinedStderr = '';
    const allTables: NonNullable<ExecutionResult['tables']> = [];

    try {
      for (const sf of sqlFiles) {
        if (!sf.code.trim()) continue;
        const sqlRes = await runSQL(sf.code, dbPath);
        if (sqlRes.tables) allTables.push(...sqlRes.tables);
        if (sqlRes.stdout) combinedStdout += sqlRes.stdout;
        if (sqlRes.stderr) combinedStderr += sqlRes.stderr;
        if (sqlRes.exitCode !== 0) {
          return {
            stdout: combinedStdout,
            stderr: combinedStderr,
            exitCode: sqlRes.exitCode,
            durationMs: Math.max(1, Math.round(performance.now() - start)),
            runtime: 'Python 3.10 + SQLite 3.40',
            tables: allTables,
          };
        }
      }

      const pyCode = pyFiles.map((f) => f.code).filter((c) => c.trim()).join('\n\n');
      if (pyCode) {
        const pyRes = await runPython(pyCode, stdin, { KANSO_DB_PATH: dbPath });
        if (pyRes.stdout) {
          if (combinedStdout && !combinedStdout.endsWith('\n')) combinedStdout += '\n';
          combinedStdout += (combinedStdout ? '\n' : '') + pyRes.stdout;
        }
        if (pyRes.stderr) combinedStderr += pyRes.stderr;
        return {
          stdout: combinedStdout,
          stderr: combinedStderr,
          exitCode: pyRes.exitCode,
          durationMs: Math.max(1, Math.round(performance.now() - start)),
          runtime: 'Python 3.10 + SQLite 3.40',
          tables: allTables.length > 0 ? allTables : undefined,
        };
      }

      return {
        stdout: combinedStdout,
        stderr: combinedStderr,
        exitCode: 0,
        durationMs: Math.max(1, Math.round(performance.now() - start)),
        runtime: 'Python 3.10 + SQLite 3.40',
        tables: allTables.length > 0 ? allTables : undefined,
      };
    } finally {
      await fs.unlink(dbPath).catch(() => {});
    }
  }

  // 2. JavaScript / TypeScript (+ optional SQLite)
  if (uniqueLangs.every((l) => l === 'javascript' || l === 'typescript' || l === 'sql')) {
    const sqlFiles = files.filter((f) => f.language === 'sql');
    const jsTsFiles = files.filter((f) => f.language === 'javascript' || f.language === 'typescript');
    let combinedStdout = '';
    let combinedStderr = '';
    const allTables: NonNullable<ExecutionResult['tables']> = [];

    for (const sf of sqlFiles) {
      if (!sf.code.trim()) continue;
      const sqlRes = await runSQL(sf.code);
      if (sqlRes.tables) allTables.push(...sqlRes.tables);
      if (sqlRes.stdout) combinedStdout += sqlRes.stdout;
      if (sqlRes.stderr) combinedStderr += sqlRes.stderr;
      if (sqlRes.exitCode !== 0) {
        return {
          stdout: combinedStdout,
          stderr: combinedStderr,
          exitCode: sqlRes.exitCode,
          durationMs: Math.max(1, Math.round(performance.now() - start)),
          runtime: 'Node 22 + esbuild + SQLite',
          tables: allTables,
        };
      }
    }

    if (jsTsFiles.some((f) => f.code.trim())) {
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kanso_multi_'));
      try {
        const importLines: string[] = [
          `globalThis.SQL_TABLES = ${JSON.stringify(allTables)};`,
        ];
        for (let idx = 0; idx < jsTsFiles.length; idx++) {
          const f = jsTsFiles[idx];
          if (!f.code.trim()) continue;
          let jsCode = f.code;
          if (f.language === 'typescript') {
            const transformed = await esbuild.transform(f.code, {
              loader: 'ts',
              target: 'node22',
              format: 'esm',
            });
            jsCode = transformed.code;
          }
          const modPath = path.join(tmpDir, `tab_${idx}.mjs`);
          await fs.writeFile(modPath, jsCode, 'utf8');
          importLines.push(`await import('./tab_${idx}.mjs');`);
        }

        const entryPath = path.join(tmpDir, 'runner.mjs');
        await fs.writeFile(entryPath, importLines.join('\n') + '\n', 'utf8');
        const nodeRes = await runProcess(
          'node',
          [entryPath],
          stdin,
          sqlFiles.length > 0 ? 'Node 22 + esbuild + SQLite' : 'Node 22 + TypeScript (esbuild)'
        );
        nodeRes.stderr = nodeRes.stderr.replaceAll(tmpDir + path.sep, '');
        if (nodeRes.stdout) {
          if (combinedStdout && !combinedStdout.endsWith('\n')) combinedStdout += '\n';
          combinedStdout += (combinedStdout ? '\n' : '') + nodeRes.stdout;
        }
        if (nodeRes.stderr) combinedStderr += nodeRes.stderr;
        return {
          stdout: combinedStdout,
          stderr: combinedStderr,
          exitCode: nodeRes.exitCode,
          durationMs: Math.max(1, Math.round(performance.now() - start)),
          runtime: nodeRes.runtime,
          tables: allTables.length > 0 ? allTables : undefined,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          stdout: combinedStdout,
          stderr: combinedStderr + msg + '\n',
          exitCode: 1,
          durationMs: Math.max(1, Math.round(performance.now() - start)),
          runtime: 'Node 22 + esbuild',
          tables: allTables.length > 0 ? allTables : undefined,
        };
      } finally {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      }
    }

    return {
      stdout: combinedStdout,
      stderr: combinedStderr,
      exitCode: 0,
      durationMs: Math.max(1, Math.round(performance.now() - start)),
      runtime: 'Node 22 + SQLite',
      tables: allTables.length > 0 ? allTables : undefined,
    };
  }

  // 3. C + C++ or Java + Kotlin unified sequential execution
  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  for (const f of files) {
    if (!f.code.trim()) continue;
    const res = await executeTranspiledLanguage(f.language, f.code, stdin);
    if (res.stdout) stdout += res.stdout;
    if (res.stderr) stderr += res.stderr;
    if (res.exitCode !== 0) {
      exitCode = res.exitCode;
      break;
    }
  }

  const label = uniqueLangs.includes('cpp') ? 'C + C++ Combined Sandbox' : 'Java + Kotlin Combined JVM';
  return {
    stdout,
    stderr,
    exitCode,
    durationMs: Math.max(1, Math.round(performance.now() - start)),
    runtime: label,
  };
}

