// Safe import of .xlsx / .csv files. Nothing is executed: formulas are never evaluated (only cached results are read).
import ExcelJS from 'exceljs';
import { cleanText, LIMITS } from './validate.js';

export class UploadError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export const TEMPLATE_CSV = 'Task,BAC,Planned % Complete,Actual % Complete,AC,PERT Optimistic,PERT Most Likely,PERT Pessimistic\nDesign,10000,100,100,9500,9000,10000,12000\nDevelopment,40000,60,50,26000,35000,42000,55000\nTesting,15000,20,10,2500,12000,15000,22000\nDeployment,5000,0,0,0,4000,5000,7000\n';

const MAX_COLS = 20;
const SYN = {
  name: ['name', 'task', 'taskname', 'activity', 'workpackage', 'item', 'wbs', 'description'],
  bac: ['bac', 'budget', 'budgetatcompletion', 'estimatedcost', 'estimate', 'plannedcost', 'plannedbudget', 'totalbudget'],
  plannedPct: ['plannedpercentcomplete', 'plannedcomplete', 'plannedpercentcompleted', 'plannedprogress', 'plannedpercent', 'plannedpct', 'planned'],
  actualPct: ['actualpercentcomplete', 'actualcomplete', 'actualprogress', 'actualpercent', 'actualpct', 'percentcomplete', 'progress'],
  ac: ['ac', 'actualcost', 'actualspend', 'actual', 'spent', 'costtodate'],
  optimistic: ['optimistic', 'optimisticestimate', 'pertoptimistic'],
  mostLikely: ['mostlikely', 'mostlikelyestimate', 'likelyestimate', 'pertmostlikely'],
  pessimistic: ['pessimistic', 'pessimisticestimate', 'pertpessimistic'],
};
const RISK_SYN = {
  name: ['risk', 'name', 'description', 'riskname'],
  probability: ['probability', 'prob', 'likelihood', 'probabilitypercent'],
  impact: ['impact', 'cost', 'impactcost', 'consequence', 'loss'],
};
const norm = (s) => String(s ?? '').toLowerCase().replace(/%/g, 'percent').replace(/[^a-z0-9]/g, '');

function mapColumns(header, syn) {
  const map = {};
  const normalized = header.map(norm);
  for (const [field, names] of Object.entries(syn)) {
    const wanted = new Set(names.map(norm)); // "Planned % Complete" -> plannedpercentcomplete
    const idx = normalized.findIndex((h, i) => wanted.has(h) && !Object.values(map).includes(i));
    if (idx >= 0) map[field] = idx;
  }
  return map;
}

function parseNumber(v) {
  if (typeof v === 'number') return { n: Number.isFinite(v) ? v : NaN, hadPercent: false };
  const s = String(v ?? '').trim();
  if (s === '') return { n: NaN, hadPercent: false };
  const hadPercent = s.includes('%');
  const cleaned = s.replace(/[%\s,$€£]|PKR|USD|Rs\.?/gi, '');
  return { n: /^-?\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : NaN, hadPercent };
}

function cellValue(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result); // cached formula result only
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return String(v.text);
    return '';
  }
  return typeof v === 'number' ? v : String(v);
}

export function parseCsvText(text) {
  if (text.includes('\u0000')) throw new UploadError('File is not a text CSV file.');
  text = text.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delim = (firstLine.match(/;/g) ?? []).length > (firstLine.match(/,/g) ?? []).length ? ';' : ',';
  const rows = []; let row = []; let cur = ''; let q = false;
  const pushCell = () => { row.push(cur); cur = ''; };
  const pushRow = () => { pushCell(); if (row.some((c) => c.trim() !== '')) rows.push(row.slice(0, MAX_COLS)); row = []; if (rows.length > LIMITS.maxTasks + 2) throw new UploadError(`Too many rows (maximum ${LIMITS.maxTasks}).`); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) pushCell();
    else if (c === '\n') pushRow();
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) pushRow();
  return rows;
}

function toTasks(rows, warnings) {
  const [header, ...data] = rows;
  const cols = mapColumns(header ?? [], SYN);
  const missing = ['name', 'bac', 'plannedPct', 'actualPct', 'ac'].filter((k) => !(k in cols));
  if (missing.length) throw new UploadError(`Missing column(s): ${missing.join(', ')}. Expected: Task, BAC, Planned % Complete, Actual % Complete, AC.`);

  const parsed = [];
  data.forEach((r, i) => {
    const line = i + 2;
    const get = (k) => r[cols[k]] ?? '';
    const bac = parseNumber(get('bac')), pp = parseNumber(get('plannedPct')), ap = parseNumber(get('actualPct')), ac = parseNumber(get('ac'));
    const optimistic = parseNumber(get('optimistic')), mostLikely = parseNumber(get('mostLikely')), pessimistic = parseNumber(get('pessimistic'));
    if ([bac, pp, ap, ac].some((x) => Number.isNaN(x.n))) { warnings.push(`Row ${line} skipped: BAC, planned %, actual % and AC must all be numbers.`); return; }
    parsed.push({ line, name: cleanText(get('name')) || `Task ${i + 1}`, bac: bac.n, pp: pp.n, ap: ap.n, ac: ac.n, optimistic: optimistic.n, mostLikely: mostLikely.n, pessimistic: pessimistic.n, pct: pp.hadPercent || ap.hadPercent });
  });

  // Excel stores "45%" as 0.45. If every percent value is <= 1 and none used a % sign, treat as fractions.
  const anyPctSign = parsed.some((p) => p.pct);
  const maxPct = Math.max(0, ...parsed.flatMap((p) => [p.pp, p.ap]));
  const fractions = !anyPctSign && parsed.length > 0 && maxPct <= 1 && maxPct > 0;
  if (fractions) warnings.push('Percent columns looked like fractions (0–1), so they were multiplied by 100.');

  const tasks = [];
  for (const p of parsed) {
    const pp = fractions ? p.pp * 100 : p.pp, ap = fractions ? p.ap * 100 : p.ap;
    if (p.bac < 0 || p.ac < 0 || pp < 0 || pp > 100 || ap < 0 || ap > 100 || p.bac > LIMITS.maxMoney || p.ac > LIMITS.maxMoney) { warnings.push(`Row ${p.line} skipped: a value is out of range (percent 0–100, money ≥ 0).`); continue; }
    if (/^[=+\-@]/.test(p.name)) warnings.push(`Row ${p.line}: task name starts with a formula character; it is kept as text and neutralised in exports.`);
    const pert = [p.optimistic, p.mostLikely, p.pessimistic];
    const hasPert = pert.some((value) => !Number.isNaN(value));
    if (hasPert && (pert.some(Number.isNaN) || pert.some((value) => value < 0 || value > LIMITS.maxMoney) || !(pert[0] <= pert[1] && pert[1] <= pert[2]))) { warnings.push(`Row ${p.line} skipped: PERT estimates must be ordered optimistic <= most likely <= pessimistic.`); continue; }
    tasks.push({ name: p.name, bac: p.bac, plannedPct: pp, actualPct: ap, ac: p.ac, ...(hasPert ? { optimistic: pert[0], mostLikely: pert[1], pessimistic: pert[2] } : {}) });
  }
  if (tasks.length === 0) throw new UploadError('No valid task rows were found in the file.');
  return tasks;
}

function toRisks(rows, warnings) {
  if (!rows || rows.length < 2) return [];
  const cols = mapColumns(rows[0], RISK_SYN);
  if (!('probability' in cols) || !('impact' in cols)) { warnings.push('Risks sheet ignored: needs Risk, Probability and Impact columns.'); return []; }
  const out = [];
  rows.slice(1, LIMITS.maxRisks + 1).forEach((r, i) => {
    const p = parseNumber(r[cols.probability]), im = parseNumber(r[cols.impact]);
    if (Number.isNaN(p.n) || Number.isNaN(im.n)) return;
    const prob = !p.hadPercent && p.n <= 1 ? p.n * 100 : p.n;
    if (prob < 0 || prob > 100 || im.n < 0 || im.n > LIMITS.maxMoney) return;
    out.push({ name: cleanText(r[cols.name]) || `Risk ${i + 1}`, probability: prob, impact: im.n });
  });
  return out;
}

export async function parseUpload(buffer, ext) {
  const warnings = [];
  if (ext === '.csv') {
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { throw new UploadError('CSV must be UTF-8 text.'); }
    return { tasks: toTasks(parseCsvText(text), warnings), risks: [], warnings };
  }
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buffer); } catch { throw new UploadError('This is not a readable .xlsx workbook.'); }
  const sheetRows = (ws) => {
    const out = [];
    if (!ws || ws.rowCount > LIMITS.maxTasks + 50) throw new UploadError(`Sheet has too many rows (maximum ${LIMITS.maxTasks}).`);
    ws.eachRow({ includeEmpty: false }, (row) => out.push(row.values.slice(1, MAX_COLS + 1).map(cellValue)));
    return out;
  };
  const taskSheet = wb.worksheets.find((w) => !/^risks?$/i.test(w.name));
  const riskSheet = wb.worksheets.find((w) => /^risks?$/i.test(w.name));
  if (!taskSheet) throw new UploadError('The workbook has no task sheet.');
  return { tasks: toTasks(sheetRows(taskSheet), warnings), risks: riskSheet ? toRisks(sheetRows(riskSheet), warnings) : [], warnings };
}

/** Check the file's real type from its first bytes. The extension and MIME type come from the client, so they prove nothing. */
export function sniffFile(buffer, ext) {
  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  if (ext === '.xlsx' && !isZip) throw new UploadError('File content is not a real .xlsx workbook.');
  if (ext === '.csv' && (isZip || buffer.subarray(0, 8192).includes(0))) throw new UploadError('File content is not a plain-text CSV.');
}
