// Security tests with safe test data only. Run: npm run test:security
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { buildCsv, csvSafe } from '../src/exportCsv.js';

let server, base;
const servers = [];
const boot = (opts) => new Promise((resolve) => { const s = createApp({ staticDir: '/nonexistent', ...opts }).listen(0, () => { servers.push(s); resolve(`http://127.0.0.1:${s.address().port}`); }); });
before(async () => { base = await boot({ generalLimit: 1000, heavyLimit: 1000 }); });
after(() => servers.forEach((s) => s.close()));

const upload = (url, bytes, filename, type = 'text/csv') => {
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type }), filename);
  return fetch(`${url}/api/upload`, { method: 'POST', body: fd });
};
const goodTask = { name: 'Design', bac: 1000, plannedPct: 50, actualPct: 40, ac: 450 };
const post = (path, body, url = base, headers = {}) => fetch(`${url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

// ---------- Test 1: invalid file uploads ----------
test('T1a: rejects executable renamed to .xlsx (wrong magic bytes)', async () => {
  const fakeExe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200, 1)]);
  const res = await upload(base, fakeExe, 'budget.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(res.status, 400);
});
test('T1b: rejects disallowed extension (.exe, .html, .svg)', async () => {
  for (const name of ['setup.exe', 'page.html', 'image.svg', 'data.csv.exe']) assert.equal((await upload(base, 'a,b', name)).status, 415, name);
});
test('T1c: rejects binary data pretending to be CSV', async () => {
  assert.equal((await upload(base, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]), 'x.csv')).status, 400);
  assert.equal((await upload(base, Buffer.from('Task,BAC\u0000\u0000'), 'x.csv')).status, 400);
});
test('T1d: rejects oversized file (> 2 MB)', async () => {
  assert.equal((await upload(base, Buffer.alloc(2.5 * 1024 * 1024, 'a'), 'big.csv')).status, 413);
});
test('T1e: accepts a valid CSV and parses it', async () => {
  const res = await upload(base, 'Task,BAC,Planned % Complete,Actual % Complete,AC\nDesign,1000,50,40,450\n', 'ok.csv');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.tasks[0], { name: 'Design', bac: 1000, plannedPct: 50, actualPct: 40, ac: 450 });
});

// ---------- Test 2: excessive requests ----------
test('T2: rate limiting returns 429 after the limit', async () => {
  const url = await boot({ heavyLimit: 5, generalLimit: 1000 });
  const codes = [];
  for (let i = 0; i < 8; i++) codes.push((await post('/api/analyze', { tasks: [goodTask] }, url)).status);
  assert.deepEqual(codes.slice(0, 5), [200, 200, 200, 200, 200]);
  assert.ok(codes.slice(5).every((c) => c === 429), `got ${codes}`);
});

// ---------- Test 3: malicious or malformed input ----------
test('T3a: rejects out-of-range, wrong-type and oversized input', async () => {
  const bad = [
    [{ ...goodTask, bac: -5 }], [{ ...goodTask, plannedPct: 150 }], [{ ...goodTask, ac: '1e9999' }],
    [{ ...goodTask, bac: null }], [{ ...goodTask, actualPct: Infinity }], Array(501).fill(goodTask), 'not-a-list',
  ];
  for (const tasks of bad) assert.equal((await post('/api/calculate', { tasks })).status, 400, JSON.stringify(tasks).slice(0, 60));
});
test('T3b: oversized body and invalid JSON are refused cleanly', async () => {
  assert.equal((await post('/api/calculate', JSON.stringify({ tasks: [goodTask], pad: 'x'.repeat(300_000) }))).status, 413);
  const res = await post('/api/calculate', '{"tasks": [');
  assert.equal(res.status, 400);
  assert.ok(!JSON.stringify(await res.json()).includes('node_modules'), 'no stack trace or path leaked');
});
test('T3c: script and prototype-pollution payloads stay inert', async () => {
  const res = await post('/api/calculate', '{"tasks":[{"name":"<img src=x onerror=alert(1)>","bac":10,"plannedPct":1,"actualPct":1,"ac":1}],"__proto__":{"admin":true},"constructor":{"prototype":{"admin":true}}}');
  assert.equal(res.status, 200);
  assert.equal(({}).admin, undefined);
  assert.equal((await res.json()).result.tasks[0].name, '<img src=x onerror=alert(1)>'); // kept as plain text; React renders it escaped
});

// ---------- Test 4: spreadsheet formula injection ----------
test('T4: exported CSV neutralises formulas in task names', () => {
  for (const evil of ['=HYPERLINK("http://evil.test","x")', '+cmd|calc', '-2+3', '@SUM(A1)']) assert.ok(csvSafe(evil).replace(/^"/, '').startsWith("'"), evil);
  const csv = buildCsv({ name: '=1+1', currency: 'PKR' }, { totals: {}, tasks: [{ name: '=cmd()', bac: 1 }], forecasts: [], tcpi: {}, emv: { total: 0 } });
  assert.ok(csv.includes("'=cmd()") && csv.includes("'=1+1"));
});

// ---------- Test 5: headers, CORS and access ----------
test('T5a: security headers present, framework banner hidden', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.ok(res.headers.get('content-security-policy')); assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
});
test('T5b: CORS refuses unknown origins', async () => {
  const bad = await fetch(`${base}/api/health`, { headers: { origin: 'https://evil.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
  const good = await fetch(`${base}/api/health`, { headers: { origin: 'https://costify-eight.vercel.app/' } });
  assert.equal(good.headers.get('access-control-allow-origin'), 'https://costify-eight.vercel.app/');
});
test('T5c: no stored projects, secrets or unlisted routes are reachable', async () => {
  for (const p of ['/api/projects/1', '/api/projects', '/.env', '/api/../.env', '/server.js']) assert.equal((await fetch(`${base}${p}`)).status, 404, p);
});
test('T5d: AI key never reaches the client and LLM failure falls back safely', async () => {
  const url = await boot({ anthropicKey: 'sk-test-secret', fetchImpl: async () => { throw new Error('network down'); } });
  const res = await post('/api/analyze', { tasks: [goodTask], useLlm: true }, url);
  const text = await res.text();
  assert.equal(res.status, 200); assert.ok(!text.includes('sk-test-secret')); assert.equal(JSON.parse(text).analysis.source, 'rules');
});
