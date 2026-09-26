// Game simulation: pure logic, no DOM. Works in the browser (window.HDS) and in Node (require).
(function (root) {
  'use strict';

  const CONFIG = {
    seasonLength: 10,
    daysInMonth: 31,
    startCash: 500,
    goal: 2200,
    rent: 50,
    baseCapacity: 150,     // customers you can serve alone in one event
    helperCapacity: 120,   // extra customers per helper
    helperWage: 25,
    maxHelpers: 2,
    visitRate: 0.03,       // share of the crowd that visits a concession stand
    problemChance: 0.35,
    forecastAccuracy: 0.7,
  };

  // Wholesale goods. `base` is the typical price of one unit (a pack); suppliers vary around it.
  const SUPPLIES = {
    beef:   { name: 'Hot Dogs',      unit: '1 dozen',          size: 12,  base: 3.60,  storage: 480 },
    turkey: { name: 'Turkey Dogs',   unit: '1 dozen',          size: 12,  base: 4.75,  storage: 480 },
    buns:   { name: 'Buns',          unit: '1 dozen',          size: 12,  base: 2.50,  storage: 600, shelfLife: 2 },
    cola:   { name: 'Colas',         unit: '1 case (24 cans)', size: 24,  base: 9.50,  storage: 960 },
    chips:  { name: 'Chips',         unit: '1 box (50 bags)',  size: 50,  base: 22.90, storage: 600 },
    kits:   { name: 'Condiment Kits', unit: '1 box (150 kits)', size: 150, base: 30.75, storage: 900 },
  };

  // What customers buy. Every hot dog or turkey dog comes with a condiment kit (napkin, ketchup, mustard).
  const MENU = {
    hotdog: { name: 'Hot Dogs',    uses: { beef: 1, buns: 1, kits: 1 },   refPrice: 2.00, rate: 0.40 },
    turkey: { name: 'Turkey Dogs', uses: { turkey: 1, buns: 1, kits: 1 }, refPrice: 2.50, rate: 0.20 },
    chips:  { name: 'Chips',       uses: { chips: 1 },                    refPrice: 1.00, rate: 0.35 },
    cola:   { name: 'Cola',        uses: { cola: 1 },                     refPrice: 1.00, rate: 0.55 },
  };

  const SUPPLIERS = ['Maple Lane Farms', 'Big City Foods', "Uncle Sal's Sausage Supply"];
  const RIVALS = ['Wiener Wagon', "Frankfurter Fred's"];

  const WEATHER = {
    hot:  { label: 'Sunny and hot',   temp: 92, weight: 0.20, attendance: 1.00, prefs: { hotdog: 0.90, turkey: 0.90, chips: 1.00, cola: 1.60 } },
    warm: { label: 'Partly sunny',    temp: 78, weight: 0.30, attendance: 1.05, prefs: { hotdog: 1.00, turkey: 1.00, chips: 1.00, cola: 1.20 } },
    cool: { label: 'Cloudy and cool', temp: 61, weight: 0.25, attendance: 0.95, prefs: { hotdog: 1.10, turkey: 1.10, chips: 1.00, cola: 0.80 } },
    cold: { label: 'Cold and windy',  temp: 44, weight: 0.10, attendance: 0.85, prefs: { hotdog: 1.25, turkey: 1.20, chips: 1.00, cola: 0.50 } },
    rain: { label: 'Thunderstorms',   temp: 65, weight: 0.15, attendance: 0.65, prefs: { hotdog: 1.00, turkey: 1.00, chips: 0.90, cola: 0.70 } },
  };
  const WEATHER_ORDER = ['hot', 'warm', 'cool', 'cold', 'rain'];

  const EVENT_TYPES = {
    football: { name: 'Football', seats: 30000, attendance: [18000, 30000], time: '4pm', prefs: { hotdog: 1.2, turkey: 0.9, chips: 1.0, cola: 1.0 } },
    soccer:   { name: 'Soccer',   seats: 16000, attendance: [8000, 16000],  time: '7pm', prefs: { hotdog: 1.0, turkey: 1.1, chips: 1.0, cola: 1.1 } },
    baseball: { name: 'Baseball', seats: 22000, attendance: [10000, 22000], time: '7pm', prefs: { hotdog: 1.3, turkey: 1.0, chips: 1.1, cola: 1.0 } },
    concert:  { name: 'Concert',  seats: 28000, attendance: [14000, 28000], time: '8pm', prefs: { hotdog: 0.8, turkey: 1.0, chips: 0.9, cola: 1.4 } },
    circus:   { name: 'Circus',   seats: 14000, attendance: [6000, 14000],  time: '2pm', prefs: { hotdog: 0.9, turkey: 1.0, chips: 1.5, cola: 1.0 } },
  };
  const EVENT_ORDER = Object.keys(EVENT_TYPES);

  // Posted on the bulletin board before each event. Some change how many fans actually show up.
  const ANNOUNCEMENTS = [
    { text: "We will be paying for two full-size newspaper ads for today's event.", attendance: 1.12 },
    { text: 'The parking garage is closed for repairs. Some fans may stay home.', attendance: 0.88 },
    { text: 'Half-price tickets for students today!', attendance: 1.08 },
    { text: 'The visiting team is bringing busloads of fans.', attendance: 1.10 },
    { text: 'Road construction on Main Street may keep fans away.', attendance: 0.90 },
    { text: 'All stands must keep their counters clean. Inspectors may visit.', attendance: 1 },
    { text: 'Please remember to turn off your grill when you close.', attendance: 1 },
    { text: 'Stadium rent is due at the end of each event.', attendance: 1 },
  ];

  const TIPS = [
    'Hot weather makes people thirsty.',
    'Cold fans want something warm to eat.',
    'Buns go stale after two events. Don\'t buy too many!',
    'Compare prices. Suppliers change their prices every day.',
    'Every hot dog needs a bun AND a condiment kit.',
    'A big crowd can be too much for one person. Hire a helper!',
    'Circus crowds love chips.',
    'Concert crowds drink lots of cola.',
    'Check the Franchise Report to see what your rivals charge.',
    'Use the Estimator to see what fans bought last time.',
  ];

  // Surprise phone calls. Each choice may cost money and/or have an effect. `forced` costs are paid even into overdraft.
  const PROBLEMS = [
    { id: 'grill', caller: "Joe's Grill Repair",
      text: "Hi, it's Joe. I looked at your grill, and it's busted. I can fix it before the gates open for $40. Otherwise, no hot dogs or turkey dogs today!",
      choices: [{ label: 'Pay Joe $40', cost: 40 }, { label: 'Skip hot dogs today', effect: { noDogs: true } }] },
    { id: 'mice', caller: 'Stadium Maintenance',
      text: 'Bad news: mice got into your chips! An exterminator will save the rest for $25, or you can throw out the chewed bags (about a third of them).',
      choices: [{ label: 'Call the exterminator ($25)', cost: 25 }, { label: 'Throw out the chewed chips', effect: { lose: { chips: 0.33 } } }] },
    { id: 'ad', caller: 'The Daily Gazette',
      text: "Hello! We'd love to run an ad for your stand in today's sports section. Only $30, and we promise more customers!",
      choices: [{ label: 'Buy the ad ($30)', cost: 30, effect: { share: 1.2 } }, { label: 'No thanks' }] },
    { id: 'bunsale', caller: 'Sunrise Bakery',
      text: "Big news! Every supplier in town has our day-old buns at half price, today only. Remember, day-old buns only last through today's event.",
      choices: [{ label: 'Good to know!', effect: { bunDiscount: 0.5 } }] },
    { id: 'fee', caller: 'Arena Management',
      text: 'This is Arena Management. Every stand is being charged a $15 cleanup fee for today.',
      choices: [{ label: 'Pay the $15 fee', cost: 15, forced: true }] },
    { id: 'pricewar', caller: 'A friend',
      text: 'Psst! I just saw Wiener Wagon put up a sign: hot dogs for $1.50 today!',
      choices: [{ label: 'Uh oh. Thanks!', effect: { rivalPrice: { hotdog: 1.50 } } }] },
    { id: 'freezer', caller: 'Stadium Maintenance',
      text: 'Your freezer quit overnight! Buy dry ice for $20 to save your franks, or lose half of them.',
      choices: [{ label: 'Buy dry ice ($20)', cost: 20 }, { label: 'Lose half the franks', effect: { lose: { beef: 0.5, turkey: 0.5 } } }] },
    { id: 'boosters', caller: 'Band Boosters',
      text: 'Hi! The school band is raising money for new uniforms. Could you donate $20? We\'ll tell all our families to buy from you!',
      choices: [{ label: 'Donate $20', cost: 20, effect: { share: 1.1 } }, { label: 'Politely decline' }] },
  ];

  // ---------- random numbers (seeded, serializable) ----------

  function rand(state) {
    state.rng = (state.rng + 0x6D2B79F5) >>> 0;
    let t = state.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const randInt = (s, lo, hi) => lo + Math.floor(rand(s) * (hi - lo + 1));
  const pick = (s, arr) => arr[randInt(s, 0, arr.length - 1)];
  const noise = (s) => rand(s) + rand(s) + rand(s) - 1.5; // roughly -1.5..1.5, centered on 0

  function pickWeighted(state, keys, weightOf) {
    const total = keys.reduce((sum, k) => sum + weightOf(k), 0);
    let r = rand(state) * total;
    for (const k of keys) { r -= weightOf(k); if (r <= 0) return k; }
    return keys[keys.length - 1];
  }

  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const round2 = (x) => Math.round(x * 100) / 100;
  const roundPrice = (x) => Math.round(x * 20) / 20;

  // ---------- setup ----------

  function makeEvent(state, day) {
    const type = pick(state, EVENT_ORDER);
    const t = EVENT_TYPES[type];
    const expected = Math.round(randInt(state, t.attendance[0], t.attendance[1]) / 100) * 100;
    const weather = pickWeighted(state, WEATHER_ORDER, (k) => WEATHER[k].weight);
    let forecast = weather;
    if (rand(state) > CONFIG.forecastAccuracy) {
      const i = WEATHER_ORDER.indexOf(weather);
      const j = i === 0 ? 1 : i === WEATHER_ORDER.length - 1 ? i - 1 : i + (rand(state) < 0.5 ? -1 : 1);
      forecast = WEATHER_ORDER[j];
    }
    const announcement = randInt(state, 0, ANNOUNCEMENTS.length - 1);
    const tip = randInt(state, 0, TIPS.length - 1);
    const mult = WEATHER[weather].attendance * ANNOUNCEMENTS[announcement].attendance * (1 + noise(state) * 0.06);
    const attendance = Math.min(t.seats, Math.round(expected * mult));
    return { day, type, expected, weather, forecast, announcement, tip, attendance };
  }

  function newGame(seed) {
    const s = seed === undefined ? Date.now() : seed;
    const state = {
      rng: s >>> 0,
      eventIndex: 0,
      cash: CONFIG.startCash,
      prices: Object.fromEntries(Object.entries(MENU).map(([k, m]) => [k, m.refPrice])),
      stock: { beef: 0, turkey: 0, cola: 0, chips: 0, kits: 0 },
      bunLots: [],               // [{ qty, age }], oldest first
      reputation: 1.0,
      helpers: 0,
      schedule: [],
      rivals: RIVALS.map((name) => ({ name, prices: null, totalProfit: 0, last: null })),
      supplierPrices: [],
      invoices: [],
      nextInvoice: 1,
      nextCheck: 101,
      ledger: [{ event: 0, desc: 'Starting balance', amount: CONFIG.startCash, balance: CONFIG.startCash }],
      history: [],
      problem: null,
      modifiers: {},
      eventSpending: 0,
      over: false,
      bankrupt: false,
    };
    // Spread the events over one month, never before the 2nd so there's a day to prepare.
    const days = [];
    while (days.length < CONFIG.seasonLength) {
      const d = randInt(state, 2, CONFIG.daysInMonth);
      if (!days.includes(d)) days.push(d);
    }
    days.sort((a, b) => a - b);
    for (const d of days) state.schedule.push(makeEvent(state, d));
    beginEvent(state);
    return state;
  }

  function beginEvent(state) {
    state.modifiers = {};
    state.eventSpending = 0;
    for (const r of state.rivals) {
      r.prices = {};
      for (const k in MENU) r.prices[k] = roundPrice(MENU[k].refPrice * (0.85 + rand(state) * 0.3));
    }
    state.supplierPrices = SUPPLIERS.map(() =>
      Object.fromEntries(Object.entries(SUPPLIES).map(([k, s]) => [k, round2(s.base * (0.92 + rand(state) * 0.16))])));
    state.problem = null;
    if (state.eventIndex > 0 && rand(state) < CONFIG.problemChance) {
      state.problem = { id: pick(state, PROBLEMS).id };
    }
  }

  // ---------- queries ----------

  const currentEvent = (state) => state.schedule[state.eventIndex];
  const eventType = (ev) => EVENT_TYPES[ev.type];
  const problemDef = (id) => PROBLEMS.find((p) => p.id === id);
  const bunCount = (state) => state.bunLots.reduce((sum, l) => sum + l.qty, 0);
  const stockOf = (state, key) => (key === 'buns' ? bunCount(state) : state.stock[key]);
  const unpaidInvoices = (state) => state.invoices.filter((i) => i.status === 'unpaid');
  const capacity = (state) => CONFIG.baseCapacity + state.helpers * CONFIG.helperCapacity;

  function supplierPrice(state, supplier, key) {
    const discount = key === 'buns' && state.modifiers.bunDiscount ? state.modifiers.bunDiscount : 1;
    return round2(state.supplierPrices[supplier][key] * discount);
  }

  // Units already ordered but not yet paid for (and so not yet delivered).
  function incoming(state, key) {
    let n = 0;
    for (const inv of unpaidInvoices(state)) for (const l of inv.lines) if (l.key === key) n += l.packs * SUPPLIES[key].size;
    return n;
  }

  // Cost of one serving of a menu item at typical wholesale prices.
  function unitCost(item) {
    let c = 0;
    for (const [key, n] of Object.entries(MENU[item].uses)) c += (SUPPLIES[key].base / SUPPLIES[key].size) * n;
    return c;
  }

  // How many servings of a menu item the current stock can make.
  function servingsAvailable(state, item) {
    return Math.min(...Object.entries(MENU[item].uses).map(([key, n]) => Math.floor(stockOf(state, key) / n)));
  }

  // Buns that will go stale at the end of the current event.
  const bunsExpiringAfterEvent = (state) =>
    state.bunLots.filter((l) => l.age + 1 >= SUPPLIES.buns.shelfLife).reduce((sum, l) => sum + l.qty, 0);

  // ---------- money ----------

  function addLedger(state, desc, amount, extra) {
    state.cash = round2(state.cash + amount);
    state.ledger.push({ event: state.eventIndex + 1, desc, amount: round2(amount), balance: state.cash, ...extra });
  }

  function spend(state, desc, amount, extra) {
    addLedger(state, desc, -amount, extra);
    state.eventSpending = round2(state.eventSpending + amount);
  }

  // ---------- actions ----------

  // Send an order to a supplier. Nothing is delivered until you write them a check.
  function placeOrder(state, supplier, packsByKey) {
    if (state.over) return { ok: false, error: 'The season is over.' };
    if (!SUPPLIERS[supplier]) return { ok: false, error: 'Unknown supplier.' };
    const lines = [];
    for (const [key, packs] of Object.entries(packsByKey || {})) {
      if (!SUPPLIES[key] || !Number.isInteger(packs) || packs < 0) return { ok: false, error: 'Quantities must be whole numbers.' };
      if (!packs) continue;
      const price = supplierPrice(state, supplier, key);
      lines.push({ key, packs, price, amount: round2(price * packs) });
    }
    if (!lines.length) return { ok: false, error: 'Fill in a quantity for at least one item.' };
    for (const l of lines) {
      const s = SUPPLIES[l.key];
      if (stockOf(state, l.key) + incoming(state, l.key) + l.packs * s.size > s.storage) {
        return { ok: false, error: `Your stand doesn't have room for that many ${s.name.toLowerCase()}. (Room for ${s.storage}.)` };
      }
    }
    const invoice = {
      id: state.nextInvoice++,
      supplier: SUPPLIERS[supplier],
      event: state.eventIndex + 1,
      day: currentEvent(state).day,
      lines,
      total: round2(lines.reduce((sum, l) => sum + l.amount, 0)),
      dayOld: !!state.modifiers.bunDiscount,
      status: 'unpaid',
    };
    state.invoices.push(invoice);
    return { ok: true, invoice };
  }

  function cancelInvoice(state, id) {
    const inv = state.invoices.find((i) => i.id === id && i.status === 'unpaid');
    if (!inv) return { ok: false, error: 'No unpaid order with that number.' };
    inv.status = 'cancelled';
    return { ok: true };
  }

  // Pay a supplier's bill. The payee and amount have to match the bill exactly, like a real check.
  function writeCheck(state, payee, amount) {
    const name = String(payee || '').trim().toLowerCase();
    const amt = round2(Number(amount));
    if (!name) return { ok: false, error: 'Who is the check made out to? Fill in "Pay to the order of".' };
    if (!Number.isFinite(amt) || amt <= 0) return { ok: false, error: 'Fill in the amount of the check.' };
    const bills = unpaidInvoices(state).filter((i) => i.supplier.toLowerCase() === name);
    if (!bills.length) return { ok: false, error: `You don't have an unpaid bill from "${payee}". Check the spelling of the name.` };
    const bill = bills.find((b) => Math.abs(b.total - amt) < 0.005);
    if (!bill) return { ok: false, error: `That amount doesn't match what you owe ${bills[0].supplier}. Check the order again.` };
    if (amt > state.cash + 1e-9) return { ok: false, error: 'Insufficient funds! This check would bounce.' };

    bill.status = 'paid';
    bill.check = state.nextCheck++;
    for (const l of bill.lines) {
      const qty = l.packs * SUPPLIES[l.key].size;
      if (l.key === 'buns') state.bunLots.push({ qty, age: bill.dayOld ? 1 : 0 });
      else state.stock[l.key] += qty;
    }
    spend(state, `Check #${bill.check}: ${bill.supplier}`, amt, { check: bill.check });
    return { ok: true, invoice: bill };
  }

  function hireHelpers(state, n) {
    if (!Number.isInteger(n)) return;
    state.helpers = clamp(n, 0, CONFIG.maxHelpers);
  }

  function setPrice(state, item, price) {
    if (!MENU[item] || !Number.isFinite(price)) return;
    state.prices[item] = clamp(roundPrice(price), 0.25, 9.95);
  }

  function resolveProblem(state, choiceIndex) {
    if (!state.problem) return { ok: false, error: 'No problem to resolve.' };
    const def = problemDef(state.problem.id);
    const choice = def.choices[choiceIndex];
    if (!choice) return { ok: false, error: 'Invalid choice.' };
    if (choice.cost && !choice.forced && choice.cost > state.cash) return { ok: false, error: "You don't have enough money." };
    if (choice.cost) spend(state, def.caller, choice.cost, { check: state.nextCheck++ });
    const fx = choice.effect || {};
    if (fx.noDogs) state.modifiers.noDogs = true;
    if (fx.share) state.modifiers.share = (state.modifiers.share || 1) * fx.share;
    if (fx.bunDiscount) state.modifiers.bunDiscount = fx.bunDiscount;
    if (fx.rivalPrice) Object.assign(state.rivals[0].prices, fx.rivalPrice);
    if (fx.lose) {
      for (const [key, frac] of Object.entries(fx.lose)) state.stock[key] -= Math.round(state.stock[key] * frac);
    }
    state.problem = null;
    return { ok: true };
  }

  // ---------- running an event ----------

  function attractiveness(prices, noDogs) {
    const keys = Object.keys(MENU);
    const ratio = keys.reduce((sum, k) => sum + MENU[k].refPrice / prices[k], 0) / keys.length;
    return Math.pow(clamp(ratio, 0.4, 1.8), 2) * (noDogs ? 0.6 : 1);
  }

  function buyProbability(item, price, type, weather) {
    const m = MENU[item];
    return Math.min(0.95, m.rate * type.prefs[item] * weather.prefs[item] * Math.pow(m.refPrice / price, 1.5));
  }

  function takeBuns(state, n) {
    let left = n;
    for (const lot of state.bunLots) {
      const take = Math.min(lot.qty, left);
      lot.qty -= take;
      left -= take;
      if (!left) break;
    }
    state.bunLots = state.bunLots.filter((l) => l.qty > 0);
  }

  function consume(state, key, n) {
    if (key === 'buns') takeBuns(state, n);
    else state.stock[key] -= n;
  }

  function runEvent(state) {
    if (state.over) throw new Error('The season is over.');
    if (state.problem) throw new Error('Answer the phone first.');

    const ev = currentEvent(state);
    const type = eventType(ev);
    const weather = WEATHER[ev.weather];
    const mods = state.modifiers;

    // Orders that were never paid for are never delivered.
    const expiredOrders = unpaidInvoices(state).map((inv) => { inv.status = 'expired'; return inv.supplier; });

    const potential = ev.attendance * CONFIG.visitRate * (1 + noise(state) * 0.08);
    const yourAttr = attractiveness(state.prices, mods.noDogs) * state.reputation * (mods.share || 1);
    const rivalAttr = state.rivals.map((r) => attractiveness(r.prices, false));
    const totalAttr = yourAttr + rivalAttr.reduce((a, b) => a + b, 0);

    const cap = capacity(state);
    const wanted = Math.round(potential * yourAttr / totalAttr);
    const served = Math.min(wanted, cap);
    const turnedAway = wanted - served;

    const items = {};
    let revenue = 0, demandTotal = 0, missedTotal = 0;
    for (const item of Object.keys(MENU)) {
      const price = state.prices[item];
      const demand = Math.max(0, Math.round(served * buyProbability(item, price, type, weather) * (1 + noise(state) * 0.06)));
      const isDog = item === 'hotdog' || item === 'turkey';
      const available = isDog && mods.noDogs ? 0 : servingsAvailable(state, item);
      const sold = Math.min(demand, available);
      for (const [key, n] of Object.entries(MENU[item].uses)) consume(state, key, sold * n);

      const itemRevenue = round2(sold * price);
      items[item] = { price, demand, sold, missed: demand - sold, revenue: itemRevenue };
      revenue += itemRevenue;
      demandTotal += demand;
      missedTotal += demand - sold;
    }
    revenue = round2(revenue);

    if (revenue > 0) addLedger(state, `Sales: ${type.name}`, revenue);
    spend(state, 'Stadium rent', CONFIG.rent);
    const wages = state.helpers * CONFIG.helperWage;
    if (wages) spend(state, `Helper wages (${state.helpers})`, wages);

    // Buns age; stale ones get thrown out.
    for (const lot of state.bunLots) lot.age += 1;
    const staleBuns = state.bunLots.filter((l) => l.age >= SUPPLIES.buns.shelfLife).reduce((s, l) => s + l.qty, 0);
    state.bunLots = state.bunLots.filter((l) => l.age < SUPPLIES.buns.shelfLife);

    // Reputation: sellouts and long lines hurt, high prices grumble, good service slowly builds it.
    const stockoutRatio = missedTotal / Math.max(1, demandTotal);
    const lineRatio = turnedAway / Math.max(1, wanted);
    const repBefore = state.reputation;
    let rep = state.reputation + 0.02 - 0.25 * stockoutRatio - 0.1 * lineRatio;
    if (attractiveness(state.prices, false) < 0.7) rep -= 0.03;
    state.reputation = round2(clamp(rep, 0.6, 1.3));

    // Rivals hire the helpers each crowd needs and never run out; their profit is sales minus supplies, rent and wages.
    const rivalResults = state.rivals.map((r, i) => {
      const crowd = Math.round(potential * rivalAttr[i] / totalAttr);
      const helpers = clamp(Math.ceil((crowd - CONFIG.baseCapacity) / CONFIG.helperCapacity), 0, CONFIG.maxHelpers);
      const customers = Math.min(crowd, CONFIG.baseCapacity + helpers * CONFIG.helperCapacity);
      let rRevenue = 0, rCost = 0;
      for (const item of Object.keys(MENU)) {
        const n = Math.round(customers * buyProbability(item, r.prices[item], type, weather));
        rRevenue += n * r.prices[item];
        rCost += n * unitCost(item);
      }
      const profit = round2(rRevenue - rCost - CONFIG.rent - helpers * CONFIG.helperWage);
      r.totalProfit = round2(r.totalProfit + profit);
      r.last = { customers, revenue: round2(rRevenue), profit, prices: { ...r.prices } };
      return r.last;
    });

    const report = {
      eventNumber: state.eventIndex + 1,
      day: ev.day,
      type: ev.type,
      eventName: type.name,
      forecast: ev.forecast,
      weather: ev.weather,
      expected: ev.expected,
      attendance: ev.attendance,
      wanted, served, turnedAway, capacity: cap, helpers: state.helpers,
      items,
      revenue,
      rent: CONFIG.rent,
      wages,
      otherSpending: round2(state.eventSpending - CONFIG.rent - wages),
      profit: round2(revenue - state.eventSpending),
      staleBuns,
      expiredOrders,
      reputationBefore: repBefore,
      reputationAfter: state.reputation,
      stockoutRatio, lineRatio,
      rivals: rivalResults,
      cashAfter: state.cash,
    };
    state.history.push(report);

    state.eventIndex += 1;
    if (state.cash < 0) {
      // Can't cover the bills: the stadium takes the stand back.
      state.over = true;
      state.bankrupt = true;
      state.problem = null;
    } else if (state.eventIndex >= CONFIG.seasonLength) {
      state.over = true;
      state.problem = null;
    } else {
      beginEvent(state);
    }
    return report;
  }

  function finalStandings(state) {
    const you = { name: 'Your stand', totalProfit: round2(state.cash - CONFIG.startCash), you: true };
    return [you, ...state.rivals.map((r) => ({ name: r.name, totalProfit: r.totalProfit }))]
      .sort((a, b) => b.totalProfit - a.totalProfit);
  }

  const HDS = {
    CONFIG, SUPPLIES, MENU, SUPPLIERS, WEATHER, WEATHER_ORDER, EVENT_TYPES, EVENT_ORDER, ANNOUNCEMENTS, TIPS, PROBLEMS,
    newGame, placeOrder, cancelInvoice, writeCheck, hireHelpers, setPrice, resolveProblem, runEvent,
    currentEvent, eventType, problemDef, stockOf, incoming, unpaidInvoices, capacity, supplierPrice, unitCost,
    servingsAvailable, bunsExpiringAfterEvent, finalStandings,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = HDS;
  else root.HDS = HDS;
})(typeof window !== 'undefined' ? window : globalThis);
