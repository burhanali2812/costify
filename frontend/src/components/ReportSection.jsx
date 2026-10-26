import { useState } from 'react';
import { download } from '../api.js';

export default function ReportSection({ payload, aiSummary }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function go(kind) {
    setBusy(kind); setError('');
    try { await download(kind, { ...payload, aiSummary: aiSummary || undefined }); }
    catch (e) { setError(e.message); }
    finally { setBusy(''); }
  }
  return (
    <section className="band" id="report" aria-labelledby="h-report">
      <div className="band-head"><h2 id="h-report">6. Download</h2><p>The server recalculates everything from your inputs, so the report always matches the formulas.</p></div>
      <div className="band-body">
        <div className="actions">
          <button type="button" className="btn primary" disabled={!!busy} onClick={() => go('pdf')}>{busy === 'pdf' ? 'Building PDF…' : 'Download PDF report'}</button>
          <button type="button" className="btn secondary" disabled={!!busy} onClick={() => go('csv')}>{busy === 'csv' ? 'Preparing…' : 'Download results as CSV'}</button>
        </div>
        <p className="muted">The PDF contains the status table, every forecast, a cost comparison chart, the task table{aiSummary ? ' and the AI review you just ran' : ' and an automatic review of unusual expenses'}.</p>
        {error && <p className="note bad" role="alert">{error}</p>}
      </div>
    </section>
  );
}
