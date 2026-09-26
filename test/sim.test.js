// Run with: npm test
const { test } = require('node:test');
const assert = require('node:assert');
const HDS = require('../js/sim.js');

// A reasonable player: reads the forecast and the announcement's crowd estimate, buys each item from the
// cheapest supplier, pays every bill, hires helpers for big crowds, and keeps default prices.
function playSensibly(state) {
  const { WEATHER, EVENT_TYPES, SUPPLIES, SUPPLIERS, CONFIG, MENU } = HDS;
  while (!state.over) {
    if (state.problem) {
      const def = HDS.problemDef(state.problem.id);
      const idx = def.choices.findIndex((c) => !c.cost || c.forced || c.cost <= state.cash);
      HDS.resolveProblem(state, idx);
    }
    const ev = HDS.currentEvent(state);
    const w = WEATHER[ev.forecast];
    const type = EVENT_TYPES[ev.type];
    const fans = (ev.expected * w.attendance * CONFIG.visitRate) / 3;
    HDS.hireHelpers(state, fans > 330 ? 2 : fans > 190 ? 1 : 0);
    const customers = Math.min(HDS.capacity(state), fans);
    const servings = {};
    for (const item of Object.keys(MENU)) servings[item] = customers * MENU[item].rate * type.prefs[item] * w.prefs[item] * 1.1;
    const want = {
      beef: servings.hotdog, turkey: servings.turkey, buns: servings.hotdog + servings.turkey,
      kits: servings.hotdog + servings.turkey, cola: servings.cola, chips: servings.chips,
    };
    const orders = SUPPLIERS.map(() => ({}));
    for (const key of Object.keys(want)) {
      const packs = Math.max(0, Math.ceil((want[key] - HDS.stockOf(state, key)) / SUPPLIES[key].size));
      if (!packs) continue;
      let best = 0;
      for (let s = 1; s < SUPPLIERS.length; s++) if (HDS.supplierPrice(state, s, key) < HDS.supplierPrice(state, best, key)) best = s;
      orders[best][key] = packs;
    }
    orders.forEach((o, s) => { if (Object.keys(o).length) HDS.placeOrder(state, s, o); });
    // Pay the bills we can afford, cheapest first; cancel the rest.
    for (const inv of HDS.unpaidInvoices(state).sort((a, b) => a.total - b.total)) {
      if (!HDS.writeCheck(state, inv.supplier, inv.total).ok) HDS.cancelInvoice(state, inv.id);
    }
    HDS.runEvent(state);
  }
  return state;
}

test('same seed gives the same season', () => {
  const a = playSensibly(HDS.newGame(42));
  const b = playSensibly(HDS.newGame(42));
  assert.deepStrictEqual(a.history, b.history);
});

test('stock never goes negative and the checkbook balances', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const s = playSensibly(HDS.newGame(seed));
    for (const v of Object.values(s.stock)) assert.ok(v >= 0);
    for (const l of s.bunLots) assert.ok(l.qty > 0);
    const sum = s.ledger.reduce((acc, l) => acc + l.amount, 0);
    assert.ok(Math.abs(sum - s.cash) < 0.01, `seed ${seed}: ledger ${sum} vs cash ${s.cash}`);
  }
});

test('events fall on distinct days of the month, in order', () => {
  const s = HDS.newGame(5);
  const days = s.schedule.map((e) => e.day);
  assert.strictEqual(new Set(days).size, days.length);
  assert.deepStrictEqual(days, [...days].sort((a, b) => a - b));
  assert.ok(days[0] >= 2 && days[days.length - 1] <= HDS.CONFIG.daysInMonth);
});

test('orders are delivered only after a matching check is written', () => {
  const s = HDS.newGame(1);
  const { invoice } = HDS.placeOrder(s, 0, { beef: 2, buns: 2 });
  assert.strictEqual(HDS.stockOf(s, 'beef'), 0);
  assert.strictEqual(HDS.writeCheck(s, 'Nobody Inc', invoice.total).ok, false);
  assert.strictEqual(HDS.writeCheck(s, invoice.supplier, invoice.total + 1).ok, false);
  assert.strictEqual(HDS.writeCheck(s, invoice.supplier.toUpperCase(), invoice.total).ok, true);
  assert.strictEqual(HDS.stockOf(s, 'beef'), 24);
  assert.strictEqual(HDS.stockOf(s, 'buns'), 24);
  assert.strictEqual(s.cash, Math.round((500 - invoice.total) * 100) / 100);
  assert.strictEqual(HDS.writeCheck(s, invoice.supplier, invoice.total).ok, false); // already paid
});

test('checks bounce when the balance is too low, and storage is limited', () => {
  const s = HDS.newGame(1);
  const { invoice } = HDS.placeOrder(s, 0, { chips: 12 }); // ~$275
  HDS.placeOrder(s, 1, { cola: 30 });                       // ~$285
  assert.strictEqual(HDS.writeCheck(s, invoice.supplier, invoice.total).ok, true);
  const cola = HDS.unpaidInvoices(s)[0];
  assert.match(HDS.writeCheck(s, cola.supplier, cola.total).error, /bounce/);
  assert.strictEqual(HDS.placeOrder(s, 2, { beef: 41 }).ok, false); // 492 > 480
});

test('unpaid orders expire when the stand opens', () => {
  const s = HDS.newGame(9);
  HDS.placeOrder(s, 0, { cola: 1 });
  const r = HDS.runEvent(s);
  assert.deepStrictEqual(r.expiredOrders, [HDS.SUPPLIERS[0]]);
  assert.strictEqual(HDS.stockOf(s, 'cola'), 0);
});

test('buns go stale after two events', () => {
  const s = HDS.newGame(7);
  const { invoice } = HDS.placeOrder(s, 0, { buns: 5 });
  HDS.writeCheck(s, invoice.supplier, invoice.total);
  HDS.runEvent(s); // no franks, so no buns get used
  s.problem = null;
  assert.strictEqual(HDS.stockOf(s, 'buns'), 60);
  const r = HDS.runEvent(s);
  assert.strictEqual(r.staleBuns, 60);
  assert.strictEqual(HDS.stockOf(s, 'buns'), 0);
});

test('helpers raise capacity and cost wages', () => {
  const s = HDS.newGame(2);
  HDS.hireHelpers(s, 5);
  assert.strictEqual(s.helpers, HDS.CONFIG.maxHelpers);
  assert.strictEqual(HDS.capacity(s), HDS.CONFIG.baseCapacity + 2 * HDS.CONFIG.helperCapacity);
  const r = HDS.runEvent(s);
  assert.strictEqual(r.wages, 2 * HDS.CONFIG.helperWage);
});

test('an idle player goes bankrupt on rent', () => {
  const s = HDS.newGame(3);
  s.cash = 60;
  while (!s.over) {
    if (s.problem) HDS.resolveProblem(s, HDS.problemDef(s.problem.id).choices.length - 1);
    HDS.runEvent(s);
  }
  assert.ok(s.bankrupt);
  assert.ok(s.eventIndex < HDS.CONFIG.seasonLength);
});

test('balance: sensible play usually, but not always, reaches the goal', () => {
  const finals = [];
  let first = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const s = playSensibly(HDS.newGame(seed));
    finals.push(s.cash);
    if (HDS.finalStandings(s)[0].you) first++;
  }
  finals.sort((a, b) => a - b);
  const winRate = finals.filter((c) => c >= HDS.CONFIG.goal).length / finals.length;
  console.log(`  sensible play: median $${finals[150].toFixed(0)}, min $${finals[0].toFixed(0)}, max $${finals[299].toFixed(0)}, goal ${(winRate * 100).toFixed(0)}%, 1st place ${(first / 3).toFixed(0)}%`);
  assert.ok(winRate > 0.3 && winRate < 0.95, `win rate ${winRate}`);
});
