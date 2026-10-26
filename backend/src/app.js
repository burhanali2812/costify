import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeProject } from './evm.js';
import { validateProject } from './validate.js';
import { parseUpload, sniffFile, UploadError, TEMPLATE_CSV } from './parser.js';
import { analyzeProject, detectAnomalies } from './ai.js';
import { buildReportPdf } from './report.js';
import { buildCsv } from './exportCsv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ALLOWED_EXT = new Set(['.xlsx', '.csv']);
const ALLOWED_MIME = new Set(['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);

export function createApp(opts = {}) {
  const origins = [].concat(opts.corsOrigins ?? process.env.CORS_ORIGIN ?? 'https://costify-eight.vercel.app/')
    .flatMap((s) => String(s).split(',')).map((s) => s.trim()).filter(Boolean);
  const cfg = {
    generalLimit: opts.generalLimit ?? 120, heavyLimit: opts.heavyLimit ?? 10, maxUploadBytes: opts.maxUploadBytes ?? 2 * 1024 * 1024,
    staticDir: opts.staticDir ?? process.env.FRONTEND_DIST ?? path.resolve(here, '../../frontend/dist'),
    apiKey: opts.anthropicKey ?? process.env.ANTHROPIC_API_KEY, model: opts.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5', fetchImpl: opts.fetchImpl ?? fetch,
  };
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1); // needed for correct client IPs behind Render/Nginx

  app.use(helmet());
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin)), methods: ['GET', 'POST'] }));
  app.use((req, res, next) => { res.on('finish', () => { if (req.path.startsWith('/api')) console.log(`${req.method} ${req.path} ${res.statusCode}`); }); next(); }); // never log bodies

  const limiter = (limit) => rateLimit({ windowMs: 60_000, limit, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please wait a minute and try again.' } });
  const general = limiter(cfg.generalLimit), heavy = limiter(cfg.heavyLimit);
  app.use('/api', general);
  app.use(express.json({ limit: '256kb' }));

  const upload = multer({
    storage: multer.memoryStorage(), // never written to disk
    limits: { fileSize: cfg.maxUploadBytes, files: 1, fields: 0, parts: 2 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname ?? '').toLowerCase();
      if (!ALLOWED_EXT.has(ext)) return cb(new UploadError('Only .xlsx and .csv files are accepted.', 415));
      if (!ALLOWED_MIME.has(file.mimetype)) return cb(new UploadError('Unexpected file type.', 415));
      cb(null, true);
    },
  });

  app.get('/api/health', (req, res) => res.json({ ok: true, aiAvailable: Boolean(cfg.apiKey) }));
  app.get('/api/template.csv', (req, res) => { res.type('text/csv').attachment('cost-template.csv').send(TEMPLATE_CSV); });

  app.post('/api/upload', heavy, upload.single('file'), async (req, res) => {
    if (!req.file) throw new UploadError('Choose a .xlsx or .csv file to upload.');
    const ext = path.extname(req.file.originalname).toLowerCase();
    sniffFile(req.file.buffer, ext);
    res.json(await parseUpload(req.file.buffer, ext));
  });

  const prepare = (req, res) => {
    const v = validateProject(req.body ?? {});
    if (!v.ok) { res.status(400).json({ error: 'Some values are not valid.', details: v.errors }); return null; }
    return { project: v.value, result: computeProject(v.value) };
  };

  app.post('/api/calculate', (req, res) => { const p = prepare(req, res); if (p) res.json({ result: p.result }); });

  app.post('/api/analyze', heavy, async (req, res) => {
    const p = prepare(req, res); if (!p) return;
    const analysis = await analyzeProject(p.project, p.result, { useLlm: p.project.useLlm, apiKey: cfg.apiKey, model: cfg.model, fetchImpl: cfg.fetchImpl });
    res.json({ result: p.result, analysis });
  });

  app.post('/api/report', heavy, (req, res) => {
    const p = prepare(req, res); if (!p) return;
    const doc = buildReportPdf(p.project, p.result, { anomalies: detectAnomalies(p.result), summary: '' }, p.project.aiSummary);
    res.type('application/pdf').attachment('cost-report.pdf');
    doc.pipe(res); doc.end();
  });

  app.post('/api/export/csv', heavy, (req, res) => {
    const p = prepare(req, res); if (!p) return;
    res.type('text/csv').attachment('cost-results.csv').send(buildCsv(p.project, p.result));
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  if (fs.existsSync(path.join(cfg.staticDir, 'index.html'))) { // single-service deployment: serve the built React app
    app.use(express.static(cfg.staticDir, { dotfiles: 'ignore', index: 'index.html' }));
    app.use((req, res, next) => (req.method === 'GET' && !path.extname(req.path) ? res.sendFile(path.join(cfg.staticDir, 'index.html')) : next()));
  }
  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

  app.use((err, req, res, next) => { // one place for errors: never leak stack traces or internal paths
    if (res.headersSent) return next(err);
    if (err instanceof UploadError) return res.status(err.status).json({ error: err.message });
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `File is too large (limit ${Math.round(cfg.maxUploadBytes / 1024 / 1024)} MB).` });
    if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Invalid upload request.' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large.' });
    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) return res.status(400).json({ error: 'Request body is not valid JSON.' });
    console.error('Unhandled error:', err?.message);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });
  return app;
}
