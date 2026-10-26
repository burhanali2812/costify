import { useRef, useState } from 'react';
import { templateUrl } from '../api.js';
import { CURRENCIES } from '../format.js';

const COLS = [['name', 'Task', 'text'], ['bac', 'Estimated cost (BAC)', 'number'], ['plannedPct', 'Planned % complete', 'number'], ['actualPct', 'Actual % complete', 'number'], ['ac', 'Actual cost (AC)', 'number'], ['optimistic', 'PERT optimistic', 'number'], ['mostLikely', 'PERT most likely', 'number'], ['pessimistic', 'PERT pessimistic', 'number']];

export default function DataSection({ name, setName, currency, setCurrency, rows, setRows, riskRows, setRiskRows, issues, riskIssues, upload, handleFile, usingSample, newRow, newRisk, onClear }) {
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const setCell = (id, key, value) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  const setRisk = (id, key, value) => setRiskRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  const badCount = Object.keys(issues).length;

  return (
    <section className="band" id="data" aria-labelledby="h-data">
      <div className="band-head">
        <h2 id="h-data">1. Your data</h2>
          <p>Upload a spreadsheet or type the values in. Planned and actual percentages are used with the budget to work out PV and EV. PERT estimates are optional.</p>
      </div>
      <div className="band-body">
        <div className="row-fields">
          <label className="field grow">Project name<input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website redesign" /></label>
          <label className="field">Currency<select value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>

        <div className={`drop ${drag ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]); }}>
          <div>
            <strong>Upload an Excel or CSV file</strong>
            <p>Drop it here or <button type="button" className="linkbtn" onClick={() => fileRef.current?.click()}>choose a file</button>. Accepts .xlsx and .csv up to 2 MB with the columns Task, BAC, Planned % Complete, Actual % Complete, AC and optional PERT estimates. An optional sheet named Risks (Risk, Probability, Impact) fills the risk list.</p>
          </div>
          <a className="btn secondary" href={templateUrl} download>Download template</a>
          <input ref={fileRef} type="file" hidden accept=".xlsx,.csv" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <div aria-live="polite" className="notes">
          {upload.state === 'loading' && <p className="note">{upload.message}</p>}
          {upload.state === 'ok' && <p className="note good">{upload.message}</p>}
          {upload.state === 'error' && <p className="note bad" role="alert">{upload.message}</p>}
          {upload.warnings?.map((w) => <p key={w} className="note warn">{w}</p>)}
          {usingSample && <p className="note">Sample data is loaded so you can see how it works. Upload a file or edit the table to use your own.</p>}
        </div>

        <div className="scroll">
          <table className="tbl entry">
            <caption className="sr">Task cost data</caption>
            <thead><tr>{COLS.map(([k, label]) => <th key={k} scope="col" className={k === 'name' ? '' : 'num'}>{label}</th>)}<th scope="col" className="num">PV</th><th scope="col" className="num">EV</th><th scope="col"><span className="sr">Remove</span></th></tr></thead>
            <tbody>
              {rows.map((r, i) => {
                const pv = (Number(r.plannedPct) / 100) * Number(r.bac), ev = (Number(r.actualPct) / 100) * Number(r.bac);
                return (
                  <tr key={r.id} className={issues[r.id] ? 'has-issue' : ''}>
                    {COLS.map(([k, label, type]) => (
                      <td key={k}><input aria-label={`${label}, row ${i + 1}`} type={type} inputMode={type === 'number' ? 'decimal' : undefined} min={type === 'number' ? 0 : undefined} step="any" maxLength={type === 'text' ? 120 : undefined}
                        className={`${k === 'name' ? '' : 'num'} ${issues[r.id]?.includes(k) || (['optimistic', 'mostLikely', 'pessimistic'].includes(k) && issues[r.id]?.some((x) => ['pert', 'pertOrder'].includes(x))) ? 'invalid' : ''}`} aria-invalid={issues[r.id]?.includes(k) || undefined}
                        value={r[k]} onChange={(e) => setCell(r.id, k, e.target.value)} /></td>
                    ))}
                    <td className="num calc">{Number.isFinite(pv) ? Math.round(pv).toLocaleString('en-US') : '—'}</td>
                    <td className="num calc">{Number.isFinite(ev) ? Math.round(ev).toLocaleString('en-US') : '—'}</td>
                    <td><button type="button" className="iconbtn" aria-label={`Remove row ${i + 1}`} onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.id !== r.id) : [newRow()]))}>×</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {badCount > 0 && <p className="note bad" role="alert">{badCount} row{badCount === 1 ? ' has' : 's have'} a value that is missing, out of range, or has PERT estimates out of order. {badCount === 1 ? 'It is' : 'They are'} left out of the results until fixed.</p>}
        <div className="actions">
          <button type="button" className="btn secondary" disabled={rows.length >= 500} onClick={() => setRows((rs) => [...rs, newRow()])}>Add task</button>
          <button type="button" className="btn ghost" onClick={onClear}>Clear all</button>
        </div>

        <details className="risks">
          <summary>Risk list for expected monetary value (EMV) <span className="muted">{riskRows.length ? `${riskRows.length} risk${riskRows.length === 1 ? '' : 's'}` : 'optional'}</span></summary>
          <div className="scroll">
            <table className="tbl entry">
              <thead><tr><th scope="col">Risk</th><th scope="col" className="num">Probability %</th><th scope="col" className="num">Impact</th><th scope="col" className="num">EMV</th><th scope="col"><span className="sr">Remove</span></th></tr></thead>
              <tbody>
                {riskRows.map((r, i) => {
                  const emv = (Number(r.probability) / 100) * Number(r.impact);
                  return (
                    <tr key={r.id}>
                      <td><input aria-label={`Risk name, row ${i + 1}`} maxLength={120} value={r.name} onChange={(e) => setRisk(r.id, 'name', e.target.value)} /></td>
                      <td><input aria-label={`Probability percent, row ${i + 1}`} type="number" min="0" max="100" step="any" className={`num ${riskIssues[r.id]?.includes('probability') ? 'invalid' : ''}`} value={r.probability} onChange={(e) => setRisk(r.id, 'probability', e.target.value)} /></td>
                      <td><input aria-label={`Impact, row ${i + 1}`} type="number" min="0" step="any" className={`num ${riskIssues[r.id]?.includes('impact') ? 'invalid' : ''}`} value={r.impact} onChange={(e) => setRisk(r.id, 'impact', e.target.value)} /></td>
                      <td className="num calc">{Number.isFinite(emv) ? Math.round(emv).toLocaleString('en-US') : '—'}</td>
                      <td><button type="button" className="iconbtn" aria-label={`Remove risk ${i + 1}`} onClick={() => setRiskRows((rs) => rs.filter((x) => x.id !== r.id))}>×</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn secondary" disabled={riskRows.length >= 100} onClick={() => setRiskRows((rs) => [...rs, newRisk()])}>Add risk</button>
        </details>
      </div>
    </section>
  );
}
