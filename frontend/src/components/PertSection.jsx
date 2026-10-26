import { num } from '../format.js';

export default function PertSection({ result, currency }) {
  const { pert } = result;
  return (
    <section className="band" id="pert" aria-labelledby="h-pert">
      <div className="band-head"><h2 id="h-pert">PERT duration analysis</h2><p>Uses predecessor links plus optimistic, most-likely and pessimistic durations to calculate the critical path and uncertainty range.</p></div>
      <div className="band-body">
        {!pert.available ? <p className="empty">Add all three PERT duration estimates to at least one task to see the analysis.</p> : (
          <>
            <div className="facts">
              <div><h3>Expected duration</h3><p className="big">{num(pert.expectedDuration)} days</p><p className="muted">Critical path duration across {pert.rows.length} task{pert.rows.length === 1 ? '' : 's'}.</p></div>
              <div><h3>Standard deviation</h3><p className="big">{num(pert.standardDeviation)} days</p><p className="muted">Critical path uncertainty.</p></div>
              <div><h3>Approx. 95% range</h3><p className="big">{num(pert.low95)} – {num(pert.high95)} days</p><p className="muted">Expected duration ± 1.96 standard deviations.</p></div>
            </div>
            <p className="muted small">Critical path: {pert.criticalPath.join(' → ') || 'Not available'}</p>
            <div className="scroll"><table className="tbl"><thead><tr><th>Task</th><th>Predecessor</th><th className="num">Expected Duration (days)</th><th className="num">Std Dev</th><th className="num">Variance</th></tr></thead><tbody>
              {pert.rows.map((r) => <tr key={r.name}><th scope="row">{r.name}</th><td>{r.predecessor || '—'}</td><td className="num">{num(r.expectedDuration)}</td><td className="num">{num(r.standardDeviation)}</td><td className="num">{num(r.variance)}</td></tr>)}
            </tbody></table></div>
          </>
        )}
      </div>
    </section>
  );
}