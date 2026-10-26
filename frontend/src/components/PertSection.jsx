import { money, num } from '../format.js';

export default function PertSection({ result, currency }) {
  const { pert } = result;
  return (
    <section className="band" id="pert" aria-labelledby="h-pert">
      <div className="band-head"><h2 id="h-pert">PERT cost analysis</h2><p>Uses optimistic, most-likely and pessimistic estimates to calculate a weighted expected cost and uncertainty range.</p></div>
      <div className="band-body">
        {!pert.available ? <p className="empty">Add all three PERT estimates to at least one task to see the analysis.</p> : (
          <>
            <div className="facts">
              <div><h3>Expected cost</h3><p className="big">{money(pert.expected, currency)}</p><p className="muted">Weighted average across {pert.rows.length} task{pert.rows.length === 1 ? '' : 's'}.</p></div>
              <div><h3>Standard deviation</h3><p className="big">{money(pert.standardDeviation, currency)}</p><p className="muted">Combined task uncertainty.</p></div>
              <div><h3>Approx. 95% range</h3><p className="big">{money(pert.low95, currency)} – {money(pert.high95, currency)}</p><p className="muted">Expected cost ± 1.96 standard deviations.</p></div>
            </div>
            <div className="scroll"><table className="tbl"><thead><tr><th>Task</th><th className="num">Expected</th><th className="num">Std. deviation</th><th className="num">Variance</th></tr></thead><tbody>
              {pert.rows.map((r) => <tr key={r.name}><th scope="row">{r.name}</th><td className="num">{num(r.expected)}</td><td className="num">{num(r.standardDeviation)}</td><td className="num">{num(r.variance)}</td></tr>)}
            </tbody></table></div>
          </>
        )}
      </div>
    </section>
  );
}