import PDFDocument from 'pdfkit';
import { detectAnomalies } from './ai.js';

const INK = '#14232B', MUTED = '#5B6B73', LINE = '#D5DDDF', BRAND = '#0F5C6E';
const WORDS = { schedule: { good: 'ahead of plan', bad: 'behind plan', 'on target': 'on plan', unknown: 'unknown' }, cost: { good: 'under budget', bad: 'over budget', 'on target': 'on budget', unknown: 'unknown' } };
const num = (n, d = 2) => (Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : 'n/a');
const sign = (n, d = 0) => (Number.isFinite(n) ? (n > 0 ? '+' : '') + num(n, d) : 'n/a');

function table(doc, cols, rows, { head = true } = {}) {
  const x0 = doc.page.margins.left, rowH = 17;
  const drawRow = (cells, bold, fill) => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom - 10) doc.addPage();
    const y = doc.y; let x = x0;
    if (fill) doc.rect(x0, y, cols.reduce((s, c) => s + c.w, 0), rowH).fill(fill);
    doc.fillColor(INK).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
    cols.forEach((c, i) => { doc.text(String(cells[i] ?? ''), x + 3, y + 4, { width: c.w - 6, height: 11, ellipsis: true, align: c.align ?? 'left', lineBreak: false }); x += c.w; });
    doc.moveTo(x0, y + rowH).lineTo(x0 + cols.reduce((s, c) => s + c.w, 0), y + rowH).strokeColor(LINE).lineWidth(0.5).stroke();
    doc.y = y + rowH;
  };
  if (head) drawRow(cols.map((c) => c.label), true, '#E3EFF1');
  rows.forEach((r) => drawRow(r, false));
  doc.x = x0;
  doc.moveDown(0.8);
}

const h2 = (doc, t) => { if (doc.y > doc.page.height - 130) doc.addPage(); doc.x = doc.page.margins.left; doc.moveDown(0.4).fillColor(BRAND).font('Helvetica-Bold').fontSize(12).text(t).moveDown(0.3); doc.x = doc.page.margins.left; };

function barChart(doc, items, cur) {
  const x0 = doc.page.margins.left, w = 330, rowH = 20, max = Math.max(...items.map((i) => i.value), 1);
  if (doc.y + items.length * rowH > doc.page.height - 60) doc.addPage();
  let y = doc.y;
  for (const it of items) {
    doc.fillColor(INK).font('Helvetica').fontSize(8.5).text(it.label, x0, y + 4, { width: 90, lineBreak: false });
    doc.rect(x0 + 95, y + 2, Math.max(1, (it.value / max) * w), 13).fill(it.color);
    doc.fillColor(INK).text(`${cur} ${num(it.value, 0)}`, x0 + 100 + (it.value / max) * w, y + 4, { lineBreak: false });
    y += rowH;
  }
  doc.y = y + 6; doc.x = x0;
}

export function buildReportPdf(project, result, analysis, aiSummary = '') {
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Cost report - ${project.name}`, Author: 'EVM Cost Tracker' } });
  const t = result.totals, cur = project.currency, W = 515;
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(20).text('Earned Value Cost Report');
  doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(`${project.name}   |   Currency: ${cur}   |   Generated ${new Date().toISOString().slice(0, 10)}`).moveDown(0.8);
  doc.fillColor(INK).fontSize(10).text(`Schedule: ${WORDS.schedule[result.status.schedule]} (SPI ${num(t.spi)})    Cost: ${WORDS.cost[result.status.cost]} (CPI ${num(t.cpi)})    Planned ${num(result.plannedPctOverall, 1)}% vs actual ${num(result.actualPctOverall, 1)}% complete`).moveDown(0.5);

  h2(doc, '1. Project status');
  table(doc, [{ label: 'Metric', w: 150 }, { label: 'Formula', w: 150 }, { label: 'Value', w: 100, align: 'right' }, { label: 'Good sign', w: 115 }], [
    ['Budget at Completion (BAC)', 'Total budget', `${cur} ${num(t.bac, 0)}`, ''],
    ['Planned Value (PV)', 'Planned % x BAC', `${cur} ${num(t.pv, 0)}`, ''],
    ['Earned Value (EV)', 'Actual % x BAC', `${cur} ${num(t.ev, 0)}`, ''],
    ['Actual Cost (AC)', 'Time and expense records', `${cur} ${num(t.ac, 0)}`, ''],
    ['Schedule Variance (SV)', 'EV - PV', sign(t.sv), 'Positive'],
    ['Schedule Perf. Index (SPI)', 'EV / PV', num(t.spi), 'Above 1'],
    ['Cost Variance (CV)', 'EV - AC', sign(t.cv), 'Positive'],
    ['Cost Perf. Index (CPI)', 'EV / AC', num(t.cpi), 'Above 1'],
    ['Cost variance %', 'CV / EV x 100', Number.isFinite(t.cvPct) ? `${sign(t.cvPct, 1)}%` : 'n/a', 'Positive'],
  ]);

  h2(doc, '2. Forecast');
  table(doc, [{ label: 'Method', w: 190 }, { label: 'ETC', w: 100, align: 'right' }, { label: 'EAC', w: 115, align: 'right' }, { label: 'VAC (BAC - EAC)', w: 110, align: 'right' }],
    result.forecasts.map((f) => [f.label + (f.key === result.eacBasis ? '  (selected)' : ''), num(f.etc, 0), num(f.eac, 0), sign(f.vac)]));
  doc.fillColor(INK).font('Helvetica').fontSize(9).text(`TCPI to meet original budget: ${num(result.tcpi.toOriginal)}   |   TCPI to meet revised budget (selected EAC): ${num(result.tcpi.toRevised)}   |   Total EMV of risks: ${cur} ${num(result.emv.total, 0)}`);
  doc.fillColor(MUTED).fontSize(8).text('TCPI above 1 means the team must work more efficiently than it has so far.').moveDown(0.6);

  h2(doc, '3. Cost comparison');
  const sel = result.forecasts.find((f) => f.key === result.eacBasis);
  barChart(doc, [
    { label: 'BAC (budget)', value: t.bac, color: '#9AA7AD' }, { label: 'PV (planned)', value: t.pv, color: '#5B7C99' },
    { label: 'EV (earned)', value: t.ev, color: '#0F5C6E' }, { label: 'AC (actual)', value: t.ac, color: '#C2561A' },
    ...(Number.isFinite(sel?.eac) ? [{ label: 'EAC (forecast)', value: sel.eac, color: '#6B4C9A' }] : []),
  ], cur);

  if (result.pert?.available) {
    h2(doc, '4. PERT duration analysis');
    doc.fillColor(INK).font('Helvetica').fontSize(9).text(`Expected duration: ${num(result.pert.expectedDuration, 1)} days   |   Standard deviation: ${num(result.pert.standardDeviation, 1)} days   |   Approx. 95% range: ${num(result.pert.low95, 1)} to ${num(result.pert.high95, 1)} days   |   Critical path: ${result.pert.criticalPath.join(' -> ')}`).moveDown(0.4);
    table(doc, [{ label: 'Task', w: 105 }, { label: 'Predecessor', w: 90 }, { label: 'Optimistic', w: 65, align: 'right' }, { label: 'Most likely', w: 65, align: 'right' }, { label: 'Pessimistic', w: 65, align: 'right' }, { label: 'Expected', w: 65, align: 'right' }, { label: 'Std. dev.', w: 60, align: 'right' }], result.pert.rows.map((r) => [r.name, r.predecessor, num(r.optimisticDays, 0), num(r.mostLikelyDays, 0), num(r.pessimisticDays, 0), num(r.expectedDuration, 1), num(r.standardDeviation, 1)]));
  }

  h2(doc, '5. Tasks');
  table(doc, [{ label: 'Task', w: 125 }, { label: 'BAC', w: 55, align: 'right' }, { label: 'PV', w: 55, align: 'right' }, { label: 'EV', w: 55, align: 'right' }, { label: 'AC', w: 55, align: 'right' }, { label: 'CV', w: 60, align: 'right' }, { label: 'CPI', w: 55, align: 'right' }, { label: 'SPI', w: 55, align: 'right' }],
    result.tasks.map((r) => [r.name, num(r.bac, 0), num(r.pv, 0), num(r.ev, 0), num(r.ac, 0), sign(r.cv), num(r.cpi), num(r.spi)]));

  h2(doc, '6. AI cost analysis');
  const anomalies = analysis?.anomalies ?? detectAnomalies(result);
  doc.fillColor(INK).font('Helvetica').fontSize(9.5).text(aiSummary || analysis?.summary || '', { width: W, lineGap: 2 }).moveDown(0.6);
  if (anomalies.length) table(doc, [{ label: 'Severity', w: 55 }, { label: 'Task', w: 120 }, { label: 'Finding', w: 340 }], anomalies.slice(0, 25).map((a) => [a.severity, a.task, `${a.type}: ${a.message}`]));
  doc.fillColor(MUTED).fontSize(8).text('Generated by an automated analysis. Review flagged items against source records before acting on them.', doc.page.margins.left, doc.y + 4, { width: W });
  return doc;
}
