// CSV export with spreadsheet-formula-injection protection.
const csvSafe = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 10000) / 10000) : '';
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // Excel/Sheets would run this as a formula otherwise
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export { csvSafe };

export function buildCsv(project, result) {
  const line = (...cells) => cells.map(csvSafe).join(',');
  const t = result.totals;
  const out = [line('Project', project.name), line('Currency', project.currency), '',
    line('Task', 'Estimated cost (BAC)', 'Planned %', 'Actual %', 'PV', 'EV', 'AC', 'SV', 'SPI', 'CV', 'CPI', 'CV %')];
  for (const r of result.tasks) out.push(line(r.name, r.bac, r.plannedPct, r.actualPct, r.pv, r.ev, r.ac, r.sv, r.spi, r.cv, r.cpi, r.cvPct));
  out.push(line('TOTAL', t.bac, result.plannedPctOverall, result.actualPctOverall, t.pv, t.ev, t.ac, t.sv, t.spi, t.cv, t.cpi, t.cvPct), '',
    line('Forecast method', 'ETC', 'EAC', 'VAC'));
  for (const f of result.forecasts) out.push(line(f.label, f.etc, f.eac, f.vac));
  out.push('', line('TCPI (original budget)', result.tcpi.toOriginal), line('TCPI (revised budget)', result.tcpi.toRevised), line('EMV total', result.emv.total));
  if (result.pert?.available) {
    out.push('', line('Task', 'Predecessor', 'Optimistic (days)', 'Most Likely (days)', 'Pessimistic (days)', 'Expected Duration (days)', 'Std Dev', 'Variance'));
    for (const r of result.pert.rows) out.push(line(r.name, r.predecessor, r.optimisticDays, r.mostLikelyDays, r.pessimisticDays, r.expectedDuration, r.standardDeviation, r.variance));
    out.push(line('PERT TOTAL', '', '', '', '', result.pert.expectedDuration, result.pert.standardDeviation, result.pert.variance), line('PERT 95% range (days)', result.pert.low95, result.pert.high95));
  }
  return out.join('\r\n') + '\r\n';
}
