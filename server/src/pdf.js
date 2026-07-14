import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function resolvePdfParser() {
  // Prefer the lib entry — the package root index has debug side-effects
  // and newer major versions export a class instead of a function.
  const candidates = [
    () => require('pdf-parse/lib/pdf-parse.js'),
    () => require('pdf-parse'),
  ];

  for (const load of candidates) {
    try {
      const mod = load();
      if (typeof mod === 'function') return mod;
      if (typeof mod?.default === 'function') return mod.default;
      if (typeof mod?.PDFParse === 'function') {
        return async (buffer) => {
          const parser = new mod.PDFParse({ data: buffer });
          try {
            const result = await parser.getText();
            return {
              text: result?.text || '',
              numpages: result?.total || result?.numpages || null,
            };
          } finally {
            if (typeof parser.destroy === 'function') {
              await parser.destroy();
            }
          }
        };
      }
    } catch {
      // try next candidate
    }
  }

  throw new Error('PDF parser is unavailable. Reinstall pdf-parse@1.1.1 in server/');
}

const parsePdf = resolvePdfParser();

export async function extractTextFromPdf(buffer) {
  const parsed = await parsePdf(buffer);
  const text = String(parsed?.text || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    text,
    pages: parsed?.numpages ?? null,
  };
}
