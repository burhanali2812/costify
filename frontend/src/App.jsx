import { useEffect, useMemo, useState } from 'react';
import { computeProject } from './evm.js';
import { getHealth, uploadFile } from './api.js';
import { SAMPLE } from './sample.js';
import DataSection from './components/DataSection.jsx';
import StatusSection from './components/StatusSection.jsx';
import ForecastSection from './components/ForecastSection.jsx';
import ChartsSection from './components/ChartsSection.jsx';
import AiSection from './components/AiSection.jsx';
import ReportSection from './components/ReportSection.jsx';
import PertSection from './components/PertSection.jsx';
import ComparisonSection from './components/ComparisonSection.jsx';

let nextId = 1;
const newRow = (o = {}) => ({ id: nextId++, name: '', bac: '', plannedPct: '', actualPct: '', ac: '', predecessor: '', optimisticDays: '', mostLikelyDays: '', pessimisticDays: '', ...o });
const newRisk = (o = {}) => ({ id: nextId++, name: '', probability: '', impact: '', ...o });
const toNum = (s) => (String(s ?? '').trim() === '' ? NaN : Number(s));
const okMoney = (n) => Number.isFinite(n) && n >= 0 && n <= 1e12;
const okDays = (n) => Number.isFinite(n) && n >= 0 && n <= 1e6;
const okPct = (n) => Number.isFinite(n) && n >= 0 && n <= 100;

/** Turn the editable (string) rows into clean numbers; rows with bad values are reported, not silently dropped. */
function readRows(rows) {
  const tasks = [], issues = {};
  rows.forEach((r, i) => {
    if (['name', 'bac', 'plannedPct', 'actualPct', 'ac'].every((k) => String(r[k]).trim() === '')) return;
    const bac = toNum(r.bac), plannedPct = toNum(r.plannedPct), actualPct = toNum(r.actualPct), ac = toNum(r.ac);
    const pert = ['optimisticDays', 'mostLikelyDays', 'pessimisticDays'].map((k) => toNum(r[k]));
    const bad = [];
    if (!okMoney(bac)) bad.push('bac');
    if (!okPct(plannedPct)) bad.push('plannedPct');
    if (!okPct(actualPct)) bad.push('actualPct');
    if (!okMoney(ac)) bad.push('ac');
    const hasPert = pert.some(Number.isFinite);
    if (hasPert && pert.some((n) => !okDays(n))) bad.push('pert');
    if (hasPert && pert.every(Number.isFinite) && !(pert[0] <= pert[1] && pert[1] <= pert[2])) bad.push('pertOrder');
    if (bad.length) issues[r.id] = bad;
    else tasks.push({ name: r.name.trim() || `Task ${i + 1}`, bac, plannedPct, actualPct, ac, predecessor: r.predecessor.trim(), ...(hasPert ? { optimisticDays: pert[0], mostLikelyDays: pert[1], pessimisticDays: pert[2] } : {}) });
  });
  return { tasks, issues };
}
function readRisks(risks) {
  const out = [], issues = {};
  risks.forEach((r, i) => {
    if (['name', 'probability', 'impact'].every((k) => String(r[k]).trim() === '')) return;
    const probability = toNum(r.probability), impact = toNum(r.impact);
    const bad = [];
    if (!okPct(probability)) bad.push('probability');
    if (!okMoney(impact)) bad.push('impact');
    if (bad.length) issues[r.id] = bad; else out.push({ name: r.name.trim() || `Risk ${i + 1}`, probability, impact });
  });
  return { risks: out, issues };
}

export default function App() {
  const [name, setName] = useState(SAMPLE.name);
  const [currency, setCurrency] = useState('PKR');
  const [rows, setRows] = useState(() => SAMPLE.tasks.map(([n, bac, pp, ap, ac, predecessor, optimisticDays, mostLikelyDays, pessimisticDays]) => newRow({ name: n, bac: String(bac), plannedPct: String(pp), actualPct: String(ap), ac: String(ac), predecessor, optimisticDays: String(optimisticDays), mostLikelyDays: String(mostLikelyDays), pessimisticDays: String(pessimisticDays) })));
  const [riskRows, setRiskRows] = useState(() => SAMPLE.risks.map(([n, p, i]) => newRisk({ name: n, probability: String(p), impact: String(i) })));
  const [mgmtEtc, setMgmtEtc] = useState('');
  const [eacBasis, setEacBasis] = useState('eacCpi');
  const [usingSample, setUsingSample] = useState(true);
  const [upload, setUpload] = useState({ state: 'idle' });
  const [aiAvailable, setAiAvailable] = useState(false);
  const [ai, setAi] = useState(null);
  const [comparison, setComparison] = useState([{ state: 'idle' }, { state: 'idle' }]);

  useEffect(() => { getHealth().then((h) => setAiAvailable(Boolean(h.aiAvailable))).catch(() => {}); }, []);

  const { tasks, issues } = useMemo(() => readRows(rows), [rows]);
  const { risks, issues: riskIssues } = useMemo(() => readRisks(riskRows), [riskRows]);
  const etcValue = toNum(mgmtEtc);
  const managementEtc = okMoney(etcValue) ? etcValue : null;
  const result = useMemo(() => (tasks.length ? computeProject({ tasks, risks, managementEtc, eacBasis }) : null), [tasks, risks, managementEtc, eacBasis]);
  const payload = useMemo(() => ({ name: name.trim() || 'Untitled project', currency, tasks, risks, managementEtc, eacBasis }), [name, currency, tasks, risks, managementEtc, eacBasis]);

  const aiSummary = ai && ai.key === JSON.stringify(payload) ? ai.summary : ''; // only reuse the AI text while it still matches the data
  const edit = (setter) => (fn) => { setUsingSample(false); setter(fn); };

  async function handleFile(file) {
    if (!file) return;
    if (!/\.(xlsx|csv)$/i.test(file.name)) return setUpload({ state: 'error', message: 'Choose a .xlsx or .csv file.' });
    if (file.size > 2 * 1024 * 1024) return setUpload({ state: 'error', message: 'That file is over 2 MB. Remove extra sheets or rows and try again.' });
    setUpload({ state: 'loading', message: `Reading ${file.name}…` });
    try {
      const data = await uploadFile(file);
      setRows(data.tasks.map((t) => newRow({ name: t.name, bac: String(t.bac), plannedPct: String(t.plannedPct), actualPct: String(t.actualPct), ac: String(t.ac), predecessor: t.predecessor ?? '', optimisticDays: t.optimisticDays === undefined ? '' : String(t.optimisticDays), mostLikelyDays: t.mostLikelyDays === undefined ? '' : String(t.mostLikelyDays), pessimisticDays: t.pessimisticDays === undefined ? '' : String(t.pessimisticDays) })));
      if (data.risks?.length) setRiskRows(data.risks.map((r) => newRisk({ name: r.name, probability: String(r.probability), impact: String(r.impact) })));
      setName(file.name.replace(/\.(xlsx|csv)$/i, ''));
      setUsingSample(false);
      setUpload({ state: 'ok', message: `Loaded ${data.tasks.length} task${data.tasks.length === 1 ? '' : 's'} from ${file.name}.`, warnings: data.warnings });
    } catch (e) { setUpload({ state: 'error', message: e.message }); }
  }

  async function handleComparisonFile(index, file) {
    if (!file) return;
    if (!/\.(xlsx|csv)$/i.test(file.name)) return setComparison((items) => items.map((item, i) => i === index ? { state: 'error', message: 'Choose a .xlsx or .csv file.' } : item));
    if (file.size > 2 * 1024 * 1024) return setComparison((items) => items.map((item, i) => i === index ? { state: 'error', message: 'That file is over 2 MB.' } : item));
    setComparison((items) => items.map((item, i) => i === index ? { state: 'loading', message: `Reading ${file.name}…` } : item));
    try {
      const data = await uploadFile(file);
      setComparison((items) => items.map((item, i) => i === index ? { state: 'ok', name: file.name.replace(/\.(xlsx|csv)$/i, ''), data, message: `Loaded ${data.tasks.length} task${data.tasks.length === 1 ? '' : 's'}.` } : item));
    } catch (e) {
      setComparison((items) => items.map((item, i) => i === index ? { state: 'error', message: e.message } : item));
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="page topbar-in">
          <strong className="brand">EVM Cost Tracker</strong>
          <nav aria-label="Sections"><a href="#data">Data</a><a href="#status">Status</a><a href="#forecast">Forecast</a><a href="#pert">PERT</a><a href="#charts">Charts</a><a href="#compare">Compare</a><a href="#ai">AI review</a><a href="#report">Report</a></nav>
        </div>
      </header>
      <main className="page">
        <section className="intro">
          <h1>See what you planned, earned and spent.</h1>
          <p>Enter your task costs or upload an Excel or CSV file. The tracker works out schedule and cost variance, forecasts the final cost, flags unusual expenses and produces a report you can download.</p>
        </section>
        <DataSection {...{ name, setName, currency, setCurrency, rows, riskRows, issues, riskIssues, upload, handleFile, usingSample, newRow, newRisk }}
          setRows={edit(setRows)} setRiskRows={edit(setRiskRows)}
          onClear={() => { setRows([newRow()]); setRiskRows([]); setName(''); setUsingSample(false); setUpload({ state: 'idle' }); }} />
        {result ? (
          <>
            <StatusSection result={result} currency={currency} />
            <ForecastSection result={result} currency={currency} mgmtEtc={mgmtEtc} setMgmtEtc={setMgmtEtc} etcInvalid={mgmtEtc.trim() !== '' && managementEtc === null} eacBasis={eacBasis} setEacBasis={setEacBasis} />
            <PertSection result={result} currency={currency} />
            <ChartsSection result={result} currency={currency} />
            <AiSection payload={payload} aiAvailable={aiAvailable} onSummary={(a, key) => setAi({ summary: a.summary, key })} />
            <ReportSection payload={payload} aiSummary={aiSummary} />
          </>
        ) : (
          <section className="band"><div className="band-head"><h2>Results</h2></div><div className="band-body"><p className="empty">Add at least one complete task above, or upload a file. Results, charts and the report appear here.</p></div></section>
        )}
        <ComparisonSection comparison={comparison} currency={currency} onFile={handleComparisonFile} />
      </main>
      <footer className="page foot">Prototype for coursework. Figures are calculated with standard Earned Value Management formulas; review them before relying on them.</footer>
    </>
  );
}
