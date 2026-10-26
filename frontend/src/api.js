const BASE = import.meta.env.VITE_API_URL ?? '';

async function request(path, options) {
  let res;
  try { res = await fetch(BASE + path, options); }
  catch { throw new Error('Cannot reach the server. Check that the backend is running.'); }
  if (!res.ok) {
    let message = res.status === 429 ? 'Too many requests. Please wait a minute and try again.' : 'The request failed.';
    try { const j = await res.json(); if (j.error) message = j.error; if (j.details?.length) message += ` ${j.details.slice(0, 3).join(' ')}`; } catch { /* keep default */ }
    throw new Error(message);
  }
  return res;
}
const postJson = (path, body) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const getHealth = () => request('/api/health').then((r) => r.json());
export const templateUrl = `${BASE}/api/template.csv`;
export const uploadFile = (file) => { const fd = new FormData(); fd.append('file', file); return request('/api/upload', { method: 'POST', body: fd }).then((r) => r.json()); };
export const analyze = (payload) => postJson('/api/analyze', payload).then((r) => r.json());

export async function download(kind, payload) {
  const res = await postJson(kind === 'pdf' ? '/api/report' : '/api/export/csv', payload);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url; a.download = kind === 'pdf' ? 'cost-report.pdf' : 'cost-results.csv';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
