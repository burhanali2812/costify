// Earned Value Management formulas. This file is identical in frontend/src and backend/src:
// the browser uses it for instant feedback, the server recomputes everything before it
// builds a report or an AI analysis (so tampered client numbers are never trusted).

const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const div = (a, b) => (finite(a) && finite(b) && b !== 0 ? a / b : null);
const sub = (a, b) => (finite(a) && finite(b) ? a - b : null);
const add = (a, b) => (finite(a) && finite(b) ? a + b : null);
const pct = (x) => (x === null ? null : x * 100);

export const EAC_METHODS = [
  { key: 'eacOneTime', label: 'EAC (one-time overrun)', formula: 'AC + (BAC − EV)', useWhen: 'The variance was a one-time event' },
  { key: 'eacCpi', label: 'EAC (present CPI)', formula: 'AC + (BAC − EV) / CPI', useWhen: 'Past cost performance will continue' },
  { key: 'eacCpiSpi', label: 'EAC (CPI and SPI)', formula: 'AC + (BAC − EV) / (CPI × SPI)', useWhen: 'Schedule also affects cost' },
  { key: 'eac8020', label: 'EAC (80/20 weighting)', formula: 'AC + (BAC − EV) / (0.8·CPI + 0.2·SPI)', useWhen: 'Weighted CPI/SPI (corrected form, see note)' },
  { key: 'eac8020Printed', label: 'EAC (80/20, as printed on slide)', formula: 'AC + (BAC − EV) / (0.8·CPI × 0.2·SPI)', useWhen: 'Slide version, probably a typo: multiplies instead of adds' },
  { key: 'eacNew', label: 'EAC (new estimate)', formula: 'AC + ETC (management)', useWhen: 'A new bottom-up estimate is made' },
];

/** Core status metrics from the four earned-value inputs. */
export function computeMetrics({ bac, pv, ev, ac }) {
  const sv = sub(ev, pv);
  const cv = sub(ev, ac);
  return {
    bac, pv, ev, ac,
    sv, spi: div(ev, pv),
    cv, cpi: div(ev, ac),
    svPct: pct(div(sv, pv)),
    cvPct: pct(div(cv, ev)), // percentage variance: CV as a share of the value actually earned
  };
}

export function computeTask(t) {
  const bac = Number(t.bac);
  const pv = (Number(t.plannedPct) / 100) * bac; // PV = planned % complete × BAC
  const ev = (Number(t.actualPct) / 100) * bac; // EV = actual % complete × BAC
  return { name: t.name, plannedPct: Number(t.plannedPct), actualPct: Number(t.actualPct), ...computeMetrics({ bac, pv, ev, ac: Number(t.ac) }) };
}

export function computeForecasts(m, managementEtc = null) {
  const remaining = sub(m.bac, m.ev); // BAC − EV: work still to be earned
  const { cpi, spi, ac } = m;
  const cpiSpi = finite(cpi) && finite(spi) ? cpi * spi : null;
  const weightedSum = finite(cpi) && finite(spi) ? 0.8 * cpi + 0.2 * spi : null;
  const weightedPrinted = finite(cpi) && finite(spi) ? 0.8 * cpi * 0.2 * spi : null;

  const etcByKey = {
    eacOneTime: remaining,
    eacCpi: div(remaining, cpi),
    eacCpiSpi: div(remaining, cpiSpi),
    eac8020: div(remaining, weightedSum),
    eac8020Printed: div(remaining, weightedPrinted),
    eacNew: finite(managementEtc) ? managementEtc : null,
  };
  return EAC_METHODS.map((meth) => {
    const etc = etcByKey[meth.key];
    const eac = add(ac, etc);
    return { ...meth, etc, eac, vac: sub(m.bac, eac) }; // VAC = BAC − EAC
  });
}

export function computeTcpi(m, eacRevised) {
  const toOriginal = m.bac - m.ac > 0 ? div(m.bac - m.ev, m.bac - m.ac) : null;
  const toRevised = finite(eacRevised) && eacRevised - m.ac > 0 ? div(m.bac - m.ev, eacRevised - m.ac) : null;
  return { toOriginal, toRevised, originalBudgetExhausted: m.bac - m.ac <= 0 && m.bac - m.ev > 0 };
}

export function computeEmv(risks = []) {
  const rows = risks.map((r) => ({ ...r, emv: (Number(r.probability) / 100) * Number(r.impact) })); // EMV = probability × impact
  return { rows, total: rows.reduce((s, r) => s + r.emv, 0) };
}

export function describe(index) {
  if (!finite(index)) return 'unknown';
  if (index > 1.0005) return 'good';
  if (index < 0.9995) return 'bad';
  return 'on target';
}

export function computeProject({ tasks, risks = [], managementEtc = null, eacBasis = 'eacCpi' }) {
  const rows = tasks.map(computeTask);
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const totals = computeMetrics({ bac: sum('bac'), pv: sum('pv'), ev: sum('ev'), ac: sum('ac') });
  const forecasts = computeForecasts(totals, managementEtc);
  const basis = forecasts.find((f) => f.key === eacBasis) ?? forecasts[1];
  return {
    tasks: rows,
    totals,
    plannedPctOverall: pct(div(totals.pv, totals.bac)),
    actualPctOverall: pct(div(totals.ev, totals.bac)),
    etcPast: forecasts[1].etc, // ETC (past performance) = (BAC − EV) / CPI
    etcManagement: finite(managementEtc) ? managementEtc : null,
    forecasts,
    eacBasis: basis.key,
    eacRevised: basis.eac,
    tcpi: computeTcpi(totals, basis.eac),
    emv: computeEmv(risks),
    status: { schedule: describe(totals.spi), cost: describe(totals.cpi) },
  };
}
