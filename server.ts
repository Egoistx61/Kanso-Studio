import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeCode, executeCombinedFiles } from './server/executor.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

  app.post('/api/execute', async (req, res) => {
    try {
      const { language, code, files, stdin } = req.body ?? {};
      const normalizedStdin = typeof stdin === 'string' ? stdin : '';

      if (Array.isArray(files) && files.length > 0) {
        const validFiles = files.filter(
          (f) => f && typeof f.language === 'string' && typeof f.code === 'string'
        );
        if (validFiles.length === 0) {
          res.status(400).json({
            stdout: '',
            stderr: 'Invalid request payload: each file requires "language" and "code" strings.\n',
            exitCode: 1,
            durationMs: 0,
            runtime: 'Studio',
          });
          return;
        }
        const result = await executeCombinedFiles(validFiles, normalizedStdin);
        res.json(result);
        return;
      }

      if (typeof language !== 'string' || typeof code !== 'string') {
        res.status(400).json({
          stdout: '',
          stderr: 'Invalid request payload: "language" and "code" strings are required.\n',
          exitCode: 1,
          durationMs: 0,
          runtime: 'Studio',
        });
        return;
      }

      const result = await executeCode(language, code, normalizedStdin);
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Execution engine error';
      res.status(500).json({
        stdout: '',
        stderr: msg + '\n',
        exitCode: 1,
        durationMs: 0,
        runtime: 'Studio',
      });
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'mpa',
    });
    app.use((req, _res, next) => {
      if (req.path === '/app') {
        req.url = '/app.html' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/app', (_req, res) => {
      res.sendFile(path.join(distPath, 'app.html'));
    });
    app.get('/app.html', (_req, res) => {
      res.sendFile(path.join(distPath, 'app.html'));
    });
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Kanso Studio server running on http://localhost:${PORT}`);
  });
}

startServer();
