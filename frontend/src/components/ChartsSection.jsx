import { Bar, BarChart, CartesianGrid, Cell, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compact, index } from '../format.js';

const C = { bac: '#9AA7AD', pv: '#5B7C99', ev: '#0F5C6E', ac: '#C2561A', eac: '#6B4C9A' };
const axis = { fontSize: 12, fill: '#586871' };

export default function ChartsSection({ result, currency }) {
  const t = result.totals;
  const eac = result.forecasts.find((f) => f.key === result.eacBasis);
  const overall = [
    { name: 'BAC (budget)', v: t.bac, c: C.bac }, { name: 'PV (planned)', v: t.pv, c: C.pv }, { name: 'EV (earned)', v: t.ev, c: C.ev }, { name: 'AC (actual)', v: t.ac, c: C.ac },
    ...(Number.isFinite(eac?.eac) ? [{ name: 'EAC (forecast)', v: eac.eac, c: C.eac }] : []),
  ];
  const perTask = result.tasks.map((r) => ({ name: r.name.length > 14 ? `${r.name.slice(0, 13)}…` : r.name, full: r.name, Estimated: r.bac, Earned: r.ev, Actual: r.ac, CPI: r.cpi, SPI: r.spi }));
  const money = (v) => `${currency} ${Math.round(v).toLocaleString('en-US')}`;
  const tall = 300;
  return (
    <section className="band" id="charts" aria-labelledby="h-charts">
      <div className="band-head"><h2 id="h-charts">4. Compare the costs</h2><p>Three views of the same numbers: the whole project, each task's estimate against its spend, and each task's performance indices.</p></div>
      <div className="band-body">
        <figure className="fig">
          <figcaption><strong>Budget, plan, earned value, actual cost and forecast</strong><span>Project totals. The forecast uses the EAC method selected above.</span></figcaption>
          <div role="img" aria-label={`Bar chart: ${overall.map((o) => `${o.name} ${money(o.v)}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height={tall}>
              <BarChart data={overall} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} stroke="#D3DCDE" strokeDasharray="2 4" />
                <XAxis dataKey="name" tick={axis} /><YAxis tickFormatter={compact} tick={axis} width={52} />
                <Tooltip formatter={(v) => money(v)} cursor={{ fill: 'rgba(15,92,110,0.06)' }} />
                <Bar dataKey="v" name="Amount" radius={[2, 2, 0, 0]}>{overall.map((o) => <Cell key={o.name} fill={o.c} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
        <figure className="fig">
          <figcaption><strong>Estimated cost, earned value and actual cost by task</strong><span>Where the orange bar is taller than the teal bar, a task has cost more than the work it delivered.</span></figcaption>
          <div role="img" aria-label="Grouped bar chart of estimated, earned and actual cost for each task">
            <ResponsiveContainer width="100%" height={tall}>
              <BarChart data={perTask} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} stroke="#D3DCDE" strokeDasharray="2 4" />
                <XAxis dataKey="name" tick={axis} interval={0} /><YAxis tickFormatter={compact} tick={axis} width={52} />
                <Tooltip formatter={(v) => money(v)} labelFormatter={(_, p) => p?.[0]?.payload?.full} cursor={{ fill: 'rgba(15,92,110,0.06)' }} />
                <Legend />
                <Bar dataKey="Estimated" fill={C.bac} radius={[2, 2, 0, 0]} /><Bar dataKey="Earned" fill={C.ev} radius={[2, 2, 0, 0]} /><Bar dataKey="Actual" fill={C.ac} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
        <figure className="fig">
          <figcaption><strong>Cost and schedule performance index by task</strong><span>Bars below the line at 1.0 are over budget (CPI) or behind schedule (SPI).</span></figcaption>
          <div role="img" aria-label="Bar chart of CPI and SPI for each task with a reference line at 1">
            <ResponsiveContainer width="100%" height={tall}>
              <BarChart data={perTask} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} stroke="#D3DCDE" strokeDasharray="2 4" />
                <XAxis dataKey="name" tick={axis} interval={0} /><YAxis tick={axis} width={40} domain={[0, (max) => Math.max(1.5, Math.ceil(max * 10) / 10)]} />
                <Tooltip formatter={(v) => index(v)} labelFormatter={(_, p) => p?.[0]?.payload?.full} cursor={{ fill: 'rgba(15,92,110,0.06)' }} />
                <Legend /><ReferenceLine y={1} stroke="#14232B" strokeWidth={1.4} label={{ value: 'On target (1.0)', position: 'insideTopRight', fontSize: 11 }} />
                <Bar dataKey="CPI" fill={C.ac} radius={[2, 2, 0, 0]} /><Bar dataKey="SPI" fill={C.pv} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </figure>
      </div>
    </section>
  );
}
