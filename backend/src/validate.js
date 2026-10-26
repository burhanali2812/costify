// Strict server-side validation. Everything from the client or from an uploaded file passes through here.
export const LIMITS = { maxTasks: 500, maxRisks: 100, maxMoney: 1e12, maxDays: 1e6, maxName: 120 };
export const CURRENCIES = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'INR'];
export const EAC_KEYS = ['eacOneTime', 'eacCpi', 'eacCpiSpi', 'eac8020', 'eac8020Printed', 'eacNew'];

/** Remove control characters and cap the length. Output is still treated as untrusted text everywhere. */
export const cleanText = (s, max = LIMITS.maxName) =>
  String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

export function validateProject(body) {
  const errors = [];
  const err = (m) => { if (errors.length < 10) errors.push(m); };
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};

  if (!Array.isArray(b.tasks) || b.tasks.length === 0) err('tasks must be a non-empty list.');
  else if (b.tasks.length > LIMITS.maxTasks) err(`A project can have at most ${LIMITS.maxTasks} tasks.`);

  const tasks = [];
  if (Array.isArray(b.tasks) && b.tasks.length <= LIMITS.maxTasks) {
    b.tasks.forEach((t, i) => {
      const n = i + 1;
      if (!t || typeof t !== 'object') return err(`Task ${n} is not valid.`);
      const { bac, plannedPct, actualPct, ac } = t;
      const pertValues = [t.optimisticDays, t.mostLikelyDays, t.pessimisticDays];
      const hasPert = pertValues.some((value) => value !== undefined && value !== null);
      if (!isNum(bac) || bac < 0 || bac > LIMITS.maxMoney) err(`Task ${n}: BAC must be a number between 0 and ${LIMITS.maxMoney}.`);
      if (!isNum(plannedPct) || plannedPct < 0 || plannedPct > 100) err(`Task ${n}: planned % must be between 0 and 100.`);
      if (!isNum(actualPct) || actualPct < 0 || actualPct > 100) err(`Task ${n}: actual % must be between 0 and 100.`);
      if (!isNum(ac) || ac < 0 || ac > LIMITS.maxMoney) err(`Task ${n}: AC must be a number between 0 and ${LIMITS.maxMoney}.`);
      if (hasPert && pertValues.some((value) => !isNum(value) || value < 0 || value > LIMITS.maxDays)) err(`Task ${n}: PERT durations must be non-negative numbers between 0 and ${LIMITS.maxDays} days.`);
      if (hasPert && pertValues.every(isNum) && !(pertValues[0] <= pertValues[1] && pertValues[1] <= pertValues[2])) err(`Task ${n}: PERT estimates must be ordered optimistic <= most likely <= pessimistic.`);
      tasks.push({ name: cleanText(t.name) || `Task ${n}`, bac, plannedPct, actualPct, ac, predecessor: cleanText(t.predecessor, LIMITS.maxName), ...(hasPert ? { optimisticDays: pertValues[0], mostLikelyDays: pertValues[1], pessimisticDays: pertValues[2] } : {}) });
    });
  }

  const risks = [];
  if (b.risks !== undefined) {
    if (!Array.isArray(b.risks) || b.risks.length > LIMITS.maxRisks) err(`risks must be a list of at most ${LIMITS.maxRisks} items.`);
    else b.risks.forEach((r, i) => {
      if (!r || !isNum(r.probability) || r.probability < 0 || r.probability > 100 || !isNum(r.impact) || r.impact < 0 || r.impact > LIMITS.maxMoney)
        return err(`Risk ${i + 1}: probability must be 0–100 and impact a non-negative number.`);
      risks.push({ name: cleanText(r.name) || `Risk ${i + 1}`, probability: r.probability, impact: r.impact });
    });
  }

  let managementEtc = null;
  if (b.managementEtc !== undefined && b.managementEtc !== null) {
    if (!isNum(b.managementEtc) || b.managementEtc < 0 || b.managementEtc > LIMITS.maxMoney) err('managementEtc must be a non-negative number.');
    else managementEtc = b.managementEtc;
  }
  const eacBasis = EAC_KEYS.includes(b.eacBasis) ? b.eacBasis : 'eacCpi';
  const currency = CURRENCIES.includes(b.currency) ? b.currency : 'PKR';
  const aiSummary = typeof b.aiSummary === 'string' ? cleanText(b.aiSummary, 3000) : '';

  return {
    ok: errors.length === 0,
    errors,
    value: { name: cleanText(b.name, 80) || 'Untitled project', currency, tasks, risks, managementEtc, eacBasis, useLlm: b.useLlm === true, aiSummary },
  };
}
