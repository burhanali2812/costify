import { useMemo, useState } from 'react';
import { analyze } from '../api.js';

const LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

export default function AiSection({ payload, aiAvailable, onSummary }) {
  const [useLlm, setUseLlm] = useState(false);
  const [state, setState] = useState({ status: 'idle' });
  const key = useMemo(() => JSON.stringify(payload), [payload]);
  const stale = state.status === 'done' && state.key !== key;

  async function run() {
    setState({ status: 'loading' });
    try {
      const { analysis } = await analyze({ ...payload, useLlm: useLlm && aiAvailable });
      setState({ status: 'done', analysis, key });
      onSummary?.(analysis);
    } catch (e) { setState({ status: 'error', message: e.message }); }
  }
  const a = state.analysis;

  return (
    <section className="band" id="ai" aria-labelledby="h-ai">
      <div className="band-head">
        <h2 id="h-ai">5. AI cost review</h2>
        <p>Looks for unusual expenses and writes a plain-language summary of what the numbers mean.</p>
      </div>
      <div className="band-body">
        <div className="actions">
          <button type="button" className="btn primary" onClick={run} disabled={state.status === 'loading'}>{state.status === 'loading' ? 'Reviewing…' : a ? 'Review again' : 'Review costs with AI'}</button>
          <label className={`check ${aiAvailable ? '' : 'off'}`}>
            <input type="checkbox" checked={useLlm && aiAvailable} disabled={!aiAvailable} onChange={(e) => setUseLlm(e.target.checked)} />
            <span>Have Claude write the summary <span className="muted">{aiAvailable ? '(sends task names and totals to Anthropic)' : '(needs an API key on the server)'}</span></span>
          </label>
        </div>
        <div aria-live="polite">
          {state.status === 'error' && <p className="note bad" role="alert">{state.message}</p>}
          {stale && <p className="note warn">The data has changed since this review. Review again to refresh it.</p>}
        </div>
        {a && (
          <div className="ai-out">
            <p className="muted small">{a.source === 'claude' ? 'Summary written by Claude.' : 'Summary built from the numbers by the app’s own analysis rules.'}{a.note ? ` ${a.note}` : ''}</p>
            {a.summary.split('\n\n').map((p, i) => <p key={i} className="summary">{p}</p>)}
            <h3>Unusual expenses and data checks</h3>
            {a.anomalies.length === 0 ? <p>Nothing unusual found.</p> : (
              <div className="scroll">
                <table className="tbl">
                  <thead><tr><th scope="col">Priority</th><th scope="col">Task</th><th scope="col">Finding</th></tr></thead>
                  <tbody>{a.anomalies.map((x, i) => <tr key={i}><td><span className={`sev ${x.severity}`}>{LABEL[x.severity]}</span></td><th scope="row">{x.task}</th><td><strong>{x.type}.</strong> {x.message}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
