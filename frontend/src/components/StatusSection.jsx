import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts';
import { index, num, percent, signedNum, toneOf } from '../format.js';

const SCHED = { good: 'Ahead of schedule', bad: 'Behind schedule', 'on target': 'On schedule', unknown: 'Schedule unknown' };
const COST = { good: 'Under budget', bad: 'Over budget', 'on target': 'On budget', unknown: 'Cost unknown' };

function Quadrant({ result }) {
  const pts = result.tasks.filter((t) => t.spi !== null && t.cpi !== null).map((t) => ({ name: t.name, spi: t.spi, cpi: t.cpi }));
  const all = [...pts, ...(result.totals.spi !== null && result.totals.cpi !== null ? [{ name: 'Whole project', spi: result.totals.spi, cpi: result.totals.cpi }] : [])];
  const top = Math.min(3, Math.max(1.5, Math.ceil(Math.max(...all.flatMap((p) => [p.spi, p.cpi]), 1) * 11) / 10));
  const clamp = (p) => ({ ...p, x: Math.min(p.spi, top), y: Math.min(p.cpi, top) });
  const tip = ({ active, payload }) => (active && payload?.length ? <div className="tip"><strong>{payload[0].payload.name}</strong><br />SPI {index(payload[0].payload.spi)} · CPI {index(payload[0].payload.cpi)}</div> : null);
  return (
    <figure className="fig">
      <figcaption><strong>Performance quadrant</strong><span>Each dot is one task, the large dot is the whole project. Up and right is healthy.</span></figcaption>
      <div role="img" aria-label={`Quadrant chart of cost and schedule performance. Whole project: SPI ${index(result.totals.spi)}, CPI ${index(result.totals.cpi)}.`}>
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
            <ReferenceArea x1={1} x2={top} y1={1} y2={top} fill="#17703F" fillOpacity={0.09} />
            <ReferenceArea x1={0} x2={1} y1={0} y2={1} fill="#B42318" fillOpacity={0.09} />
            <ReferenceArea x1={1} x2={top} y1={0} y2={1} fill="#9A6700" fillOpacity={0.09} />
            <ReferenceArea x1={0} x2={1} y1={1} y2={top} fill="#9A6700" fillOpacity={0.09} />
            <CartesianGrid stroke="#D3DCDE" strokeDasharray="2 4" />
            <XAxis type="number" dataKey="x" name="SPI" domain={[0, top]} tickCount={7} tick={{ fontSize: 12 }} label={{ value: 'Schedule performance (SPI)', position: 'insideBottom', offset: -16, fontSize: 12 }} />
            <YAxis type="number" dataKey="y" name="CPI" domain={[0, top]} tickCount={7} tick={{ fontSize: 12 }} width={44} label={{ value: 'Cost performance (CPI)', angle: -90, position: 'insideLeft', fontSize: 12 }} />
            <ReferenceLine x={1} stroke="#14232B" strokeWidth={1.2} />
            <ReferenceLine y={1} stroke="#14232B" strokeWidth={1.2} />
            <Tooltip content={tip} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Tasks" data={pts.map(clamp)} fill="#0F5C6E" fillOpacity={0.75} />
            {all.length > pts.length && <Scatter name="Project" data={[clamp(all[all.length - 1])]} fill="#14232B" shape="diamond" legendType="diamond" />}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export default function StatusSection({ result, currency }) {
  const t = result.totals;
  const rows = [
    ['Budget at Completion (BAC)', 'Total budget (the total PV)', num(t.bac), '', ''],
    ['Planned Value (PV)', 'Planned % complete × BAC', num(t.pv), '', ''],
    ['Earned Value (EV)', 'Actual % complete × BAC', num(t.ev), '', ''],
    ['Actual Cost (AC)', 'From time and expense records', num(t.ac), '', ''],
  ];
  const status = [
    ['Schedule Variance (SV)', 'EV − PV', signedNum(t.sv), 'Positive', toneOf(t.sv)],
    ['Schedule Performance Index (SPI)', 'EV / PV', index(t.spi), 'Above 1', toneOf(t.spi, 1)],
    ['Cost Variance (CV)', 'EV − AC', signedNum(t.cv), 'Positive', toneOf(t.cv)],
    ['Cost Performance Index (CPI)', 'EV / AC', index(t.cpi), 'Above 1', toneOf(t.cpi, 1)],
    ['Cost variance %', 'CV / EV × 100', percent(t.cvPct), 'Positive', toneOf(t.cvPct)],
  ];
  return (
    <section className="band" id="status" aria-labelledby="h-status">
      <div className="band-head">
        <h2 id="h-status">2. Where are we now?</h2>
        <p>Earned value compares the work done with the work planned and the money spent. Green text means a good sign, red means attention is needed.</p>
      </div>
      <div className="band-body">
        <p className="verdict">
          <span className={result.status.schedule}>{SCHED[result.status.schedule]}</span> and <span className={result.status.cost}>{COST[result.status.cost].toLowerCase()}</span>.
          <small>{percent(result.actualPctOverall)} complete against {percent(result.plannedPctOverall)} planned.</small>
        </p>
        <div className="split">
          <Quadrant result={result} />
          <div className="scroll">
            <table className="tbl">
              <thead><tr><th scope="col">Measure</th><th scope="col">Formula</th><th scope="col" className="num">Value ({currency})</th><th scope="col">Good sign</th></tr></thead>
              <tbody>
                {rows.map(([a, b, c]) => <tr key={a}><th scope="row">{a}</th><td className="muted">{b}</td><td className="num">{c}</td><td /></tr>)}
                {status.map(([a, b, c, d, tone]) => <tr key={a}><th scope="row">{a}</th><td className="muted">{b}</td><td className={`num strong ${tone}`}>{c}</td><td className="muted">{d}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
        <h3>By task <span className="muted cur">({currency})</span></h3>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th scope="col">Task</th><th scope="col" className="num">Estimated (BAC)</th><th scope="col" className="num">PV</th><th scope="col" className="num">EV</th><th scope="col" className="num">Actual (AC)</th><th scope="col" className="num">CV</th><th scope="col" className="num">CV %</th><th scope="col" className="num">SPI</th><th scope="col" className="num">CPI</th></tr></thead>
            <tbody>
              {result.tasks.map((r, i) => (
                <tr key={i}><th scope="row">{r.name}</th><td className="num">{num(r.bac)}</td><td className="num">{num(r.pv)}</td><td className="num">{num(r.ev)}</td><td className="num">{num(r.ac)}</td>
                  <td className={`num ${toneOf(r.cv)}`}>{signedNum(r.cv)}</td><td className={`num ${toneOf(r.cvPct)}`}>{percent(r.cvPct)}</td><td className={`num ${toneOf(r.spi, 1)}`}>{index(r.spi)}</td><td className={`num ${toneOf(r.cpi, 1)}`}>{index(r.cpi)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><th scope="row">Total</th><td className="num">{num(t.bac)}</td><td className="num">{num(t.pv)}</td><td className="num">{num(t.ev)}</td><td className="num">{num(t.ac)}</td><td className={`num ${toneOf(t.cv)}`}>{signedNum(t.cv)}</td><td className={`num ${toneOf(t.cvPct)}`}>{percent(t.cvPct)}</td><td className={`num ${toneOf(t.spi, 1)}`}>{index(t.spi)}</td><td className={`num ${toneOf(t.cpi, 1)}`}>{index(t.cpi)}</td></tr></tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
