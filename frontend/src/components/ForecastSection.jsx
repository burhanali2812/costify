import { index, money, num, signedNum, toneOf } from '../format.js';

export default function ForecastSection({ result, currency, mgmtEtc, setMgmtEtc, etcInvalid, eacBasis, setEacBasis }) {
  const { tcpi, emv } = result;
  const tcpiText = (v, label) => {
    if (v === null) return label === 'original' && tcpi.originalBudgetExhausted ? 'The original budget is already used up while work remains, so it cannot be met.' : 'Not enough information to calculate.';
    if (v > 1.0005) return `The team must work ${index(v)} times as efficiently as it has so far. Above 1 is hard to sustain.`;
    return 'The remaining work can be done at the efficiency achieved so far or lower.';
  };
  return (
    <section className="band" id="forecast" aria-labelledby="h-forecast">
      <div className="band-head">
        <h2 id="h-forecast">3. Where are we going?</h2>
        <p>Each EAC method answers a different question about the past. Pick the one that matches your situation. The selected row sets the revised budget used for TCPI.</p>
      </div>
      <div className="band-body">
        <div className="etc">
          <div><span className="label">ETC, past performance</span><strong>{money(result.etcPast, currency)}</strong><span className="muted">(BAC − EV) / CPI. Use when past efficiency will continue.</span></div>
          <label className="field">ETC, management estimate ({currency})
            <input type="number" min="0" step="any" inputMode="decimal" value={mgmtEtc} onChange={(e) => setMgmtEtc(e.target.value)} placeholder="New bottom-up estimate" aria-invalid={etcInvalid || undefined} className={etcInvalid ? 'invalid' : ''} />
            <span className="muted">{etcInvalid ? 'Enter a number of 0 or more.' : 'Use when past trends will not continue. Fills the "new estimate" row.'}</span>
          </label>
        </div>
        <div className="scroll">
          <table className="tbl">
            <thead><tr><th scope="col"><span className="sr">Use for TCPI</span></th><th scope="col">Method</th><th scope="col">Formula</th><th scope="col">Use when</th><th scope="col" className="num">ETC</th><th scope="col" className="num">EAC</th><th scope="col" className="num">VAC</th></tr></thead>
            <tbody>
              {result.forecasts.map((f) => (
                <tr key={f.key} className={f.key === eacBasis ? 'picked' : ''}>
                  <td><input type="radio" name="eac" aria-label={`Use ${f.label} as the revised budget`} checked={f.key === eacBasis} onChange={() => setEacBasis(f.key)} /></td>
                  <th scope="row">{f.label}</th><td className="muted">{f.formula}</td><td className="muted">{f.useWhen}</td>
                  <td className="num">{num(f.etc)}</td><td className="num strong">{num(f.eac)}</td><td className={`num ${toneOf(f.vac)}`}>{signedNum(f.vac)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Variance at completion (VAC) = BAC − EAC; negative means a forecast overrun. The 80/20 formula printed on the slide multiplies 0.8·CPI by 0.2·SPI, which looks like a typo, so the corrected weighted sum (0.8·CPI + 0.2·SPI) is shown beside it.</p>
        <div className="facts">
          <div><h3>TCPI to meet original budget</h3><p className={`big ${tcpi.toOriginal !== null && tcpi.toOriginal > 1.0005 ? 'bad' : ''}`}>{index(tcpi.toOriginal)}</p><p className="muted">(BAC − EV) / (BAC − AC). {tcpiText(tcpi.toOriginal, 'original')}</p></div>
          <div><h3>TCPI to meet revised budget</h3><p className={`big ${tcpi.toRevised !== null && tcpi.toRevised > 1.0005 ? 'bad' : ''}`}>{index(tcpi.toRevised)}</p><p className="muted">(BAC − EV) / (EAC − AC), using the selected EAC. {tcpiText(tcpi.toRevised, 'revised')}</p></div>
          <div><h3>Expected monetary value of risks</h3><p className="big">{money(emv.total, currency)}</p><p className="muted">Probability × impact, added up. {emv.rows.length ? `${emv.rows.length} risk${emv.rows.length === 1 ? '' : 's'} listed.` : 'No risks listed yet.'}</p></div>
        </div>
      </div>
    </section>
  );
}
