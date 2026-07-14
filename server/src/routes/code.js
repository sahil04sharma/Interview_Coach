import { Router } from 'express';
import vm from 'node:vm';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

router.post('/run', async (req, res) => {
  const { code, language } = req.body || {};
  const lang = (language || 'javascript').toLowerCase();

  if (lang !== 'javascript' && lang !== 'js') {
    return res.status(400).json({
      error: 'Only JavaScript is supported for code execution in v1',
    });
  }

  if (typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: 'code is required' });
  }

  if (code.length > 20000) {
    return res.status(400).json({ error: 'Code is too long (max 20k chars)' });
  }

  const logs = [];
  const sandbox = {
    console: {
      log: (...args) => {
        logs.push(args.map((a) => formatValue(a)).join(' '));
      },
      error: (...args) => {
        logs.push(args.map((a) => formatValue(a)).join(' '));
      },
      warn: (...args) => {
        logs.push(args.map((a) => formatValue(a)).join(' '));
      },
    },
  };

  const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  const script = new vm.Script(code, { filename: 'user-code.js' });

  let result = undefined;
  let error = null;
  const started = Date.now();

  try {
    result = script.runInContext(context, { timeout: 1500 });
  } catch (err) {
    error = err.message || String(err);
  }

  res.json({
    language: 'javascript',
    stdout: logs.join('\n'),
    result: result === undefined ? null : formatValue(result),
    error,
    durationMs: Date.now() - started,
  });
});

function formatValue(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default router;
