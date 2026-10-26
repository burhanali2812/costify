import { useMemo, useRef } from 'react';
import { computeProject } from '../evm.js';
import { index, money, percent } from '../format.js';

function ProjectCard({ item, currency, label, onFile }) {
  const inputRef = useRef(null);
  const result = useMemo(() => item.data ? computeProject({ tasks: item.data.tasks, risks: item.data.risks ?? [] }) : null, [item.data]);
  const selected = result?.forecasts.find((f) => f.key === result.eacBasis);
  return (
    <div className="compare-card">
      <div className="compare-upload">
        <h3>{label}</h3>
        <input ref={inputRef} type="file" hidden accept=".csv,.xlsx" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
        <button type="button" className="btn secondary" onClick={() => inputRef.current?.click()}>{item.data ? 'Replace file' : 'Choose file'}</button>
        {item.message && <p className={`note ${item.state === 'error' ? 'bad' : item.state === 'ok' ? 'good' : ''}`} role={item.state === 'error' ? 'alert' : undefined}>{item.message}</p>}
      </div>
      {result ? <>
        <p className="compare-name">{item.name}</p>
        <table className="tbl compare-table"><tbody>
          <tr><th>Tasks</th><td className="num">{result.tasks.length}</td></tr>
          <tr><th>BAC</th><td className="num">{money(result.totals.bac, currency)}</td></tr>
          <tr><th>Actual cost</th><td className="num">{money(result.totals.ac, currency)}</td></tr>
          <tr><th>Completion</th><td className="num">{percent(result.actualPctOverall)}</td></tr>
          <tr><th>SPI / CPI</th><td className="num">{index(result.totals.spi)} / {index(result.totals.cpi)}</td></tr>
          <tr><th>Status</th><td>{result.status.schedule}, {result.status.cost}</td></tr>
          <tr><th>Selected EAC</th><td className="num">{money(result.eacRevised, currency)}</td></tr>
          <tr><th>VAC</th><td className="num">{money(selected?.vac, currency)}</td></tr>
          <tr><th>Risk EMV</th><td className="num">{money(result.emv.total, currency)}</td></tr>
          <tr><th>PERT expected duration</th><td className="num">{result.pert.available ? `${result.pert.expectedDuration.toFixed(1)} days` : 'Not provided'}</td></tr>
          <tr><th>PERT 95% range</th><td className="num">{result.pert.available ? `${result.pert.low95.toFixed(1)} – ${result.pert.high95.toFixed(1)} days` : 'Not provided'}</td></tr>
        </tbody></table>
      </> : <p className="empty">Choose a CSV or Excel file to add this project.</p>}
    </div>
  );
}

export default function ComparisonSection({ comparison, currency, onFile }) {
  return (
    <section className="band" id="compare" aria-labelledby="h-compare">
      <div className="band-head"><h2 id="h-compare">Compare two projects</h2><p>Upload two project files to compare their costs, performance, forecasts, risks and PERT durations using the same formulas.</p></div>
      <div className="band-body">
        <div className="compare-grid">
          <ProjectCard item={comparison[0]} currency={currency} label="Project A" onFile={(file) => onFile(0, file)} />
          <ProjectCard item={comparison[1]} currency={currency} label="Project B" onFile={(file) => onFile(1, file)} />
        </div>
        {comparison[0].data && comparison[1].data && <p className="muted small">Both files are compared in {currency}. The comparison uses the same validated formulas for both projects.</p>}
      </div>
    </section>
  );
}