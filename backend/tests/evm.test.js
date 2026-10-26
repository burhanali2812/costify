import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeProject } from '../src/evm.js';

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} should be close to ${b}`);

// Hand-calculated example: BAC 1000, planned 50%, actual 40%, AC 450
const r = computeProject({
  tasks: [{ name: 'A', bac: 1000, plannedPct: 50, actualPct: 40, ac: 450 }],
  risks: [{ name: 'Supplier delay', probability: 30, impact: 10000 }],
  managementEtc: 700,
});

test('earned value inputs and status', () => {
  const t = r.totals;
  assert.equal(t.pv, 500); assert.equal(t.ev, 400); assert.equal(t.sv, -100); assert.equal(t.cv, -50);
  near(t.spi, 0.8); near(t.cpi, 0.8889, 0.0001); near(t.cvPct, -12.5);
});

test('forecasting formulas', () => {
  const f = Object.fromEntries(r.forecasts.map((x) => [x.key, x]));
  near(r.etcPast, 675);
  near(f.eacOneTime.eac, 1050);
  near(f.eacCpi.eac, 1125); near(f.eacCpi.vac, -125);
  near(f.eacCpiSpi.eac, 1293.75);
  near(f.eac8020.eac, 1138.78);
  near(f.eacNew.eac, 1150); // 450 + management ETC 700
});

test('TCPI and EMV', () => {
  near(r.tcpi.toOriginal, 600 / 550, 0.0001);
  near(r.tcpi.toRevised, 600 / 675, 0.0001); // revised budget = EAC (present CPI)
  near(r.emv.total, 3000);
});

test('division by zero never produces Infinity or NaN', () => {
  const z = computeProject({ tasks: [{ name: 'Z', bac: 0, plannedPct: 0, actualPct: 0, ac: 0 }] });
  assert.equal(z.totals.spi, null); assert.equal(z.totals.cpi, null);
  assert.ok(z.forecasts.every((f) => f.eac === null || Number.isFinite(f.eac)));
});
