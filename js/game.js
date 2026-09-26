// UI layer: point-and-click rooms on top of the simulation in sim.js, using artwork from art.js.
(function () {
  'use strict';

  const { CONFIG, SUPPLIES, MENU, SUPPLIERS, WEATHER, EVENT_TYPES, EVENT_ORDER, ANNOUNCEMENTS, TIPS } = HDS;
  const SAVE_KEY = 'stadiumdogs.save.v2';
  const SOUND_KEY = 'stadiumdogs.sound';
  const app = document.getElementById('app');

  let state = null;
  let ui = freshUi('title');

  function freshUi(view) {
    return {
      view, stack: [], supplierTab: 0, qty: SUPPLIERS.map(() => ({})), tool: null, app: null,
      dialed: '', call: null, check: { payee: '', amount: '' }, journalPage: 0,
      say: '', sayVisible: false, said: new Set(), done: freshDone(), confirmOpen: null,
      anim: null, standDone: false, report: null, est: { fans: '', pct: '' },
      calc: { display: '0', acc: null, op: null, fresh: true },
    };
  }
  function freshDone() { return { calendar: false, tv: false, sup: SUPPLIERS.map(() => false), ordered: false, sign: false, inventory: false }; }

  // ---------- storage (best effort) ----------

  function save() {
    try { if (state && !state.over) localStorage.setItem(SAVE_KEY, JSON.stringify(state)); else localStorage.removeItem(SAVE_KEY); } catch (e) { /* unavailable */ }
  }
  function loadSaved() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && !s.over && s.supplierPrices ? s : null; } catch (e) { return null; }
  }
  function loadPref(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v === '1'; } catch (e) { return fallback; } }
  function savePref(key, on) { try { localStorage.setItem(key, on ? '1' : '0'); } catch (e) { /* ignore */ } }

  // ---------- sound: synthesized blips plus the browser's speech voice for the guide ----------

  const Sound = {
    on: loadPref(SOUND_KEY, true), ctx: null, crowdNode: null,
    ac() {
      if (!this.on) return null;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
      } catch (e) { return null; }
    },
    tone(freq, dur, { type = 'square', vol = 0.05, at = 0 } = {}) {
      const c = this.ac(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at;
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    },
    click() { this.tone(880, 0.04, { vol: 0.03 }); },
    ring() { for (let i = 0; i < 2; i++) for (let j = 0; j < 10; j++) this.tone(j % 2 ? 480 : 440, 0.05, { type: 'sine', vol: 0.08, at: i * 0.8 + j * 0.05 }); },
    ching() { this.tone(1318, 0.07, { type: 'triangle', vol: 0.07 }); this.tone(2093, 0.3, { type: 'triangle', vol: 0.07, at: 0.07 }); },
    buzz() { this.tone(140, 0.25, { type: 'sawtooth', vol: 0.05 }); },
    crowd(on) {
      if (!on) { if (this.crowdNode) { try { this.crowdNode.stop(); } catch (e) { /* already stopped */ } this.crowdNode = null; } return; }
      const c = this.ac(); if (!c || this.crowdNode) return;
      const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      src.buffer = buf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 450; f.Q.value = 0.6; g.gain.value = 0.04;
      src.connect(f).connect(g).connect(c.destination); src.start(); this.crowdNode = src;
    },
    hush() { Voice.stop(); this.crowd(false); },
  };

  // ---------- voice: pre-recorded clips (audio/*.m4a), falling back to the best installed system voice ----------

  const LINES = VOICE.LINES;
  // Joke and sound-effect voices that ship with macOS; never use them for speech.
  const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|wobble|good news|jester|organ|superstar|trinoids|whisper|zarvox|fred|junior|ralph|kathy|grandma|grandpa|rocko|eddy|flo|reed|sandy|shelley)\b/i;

  function voiceScore(v) {
    if (!/^en[-_]/i.test(v.lang) || NOVELTY.test(v.name)) return -1;
    let score = 0;
    if (/premium/i.test(v.name)) score += 100;
    else if (/enhanced/i.test(v.name)) score += 80;
    if (/natural|neural/i.test(v.name)) score += 70;          // Microsoft Edge online voices
    if (/^google/i.test(v.name)) score += 50;                  // Chrome's network voices
    if (/^(samantha|alex|ava|allison|evan|nathan|tom|zoe|daniel|karen|moira|tessa|serena|aaron|nicky)\b/i.test(v.name)) score += 30;
    if (/^en[-_]US/i.test(v.lang)) score += 10;
    return score;
  }

  const Voice = {
    audio: null,
    systemVoice: undefined,
    bestSystemVoice() {
      if (this.systemVoice !== undefined) return this.systemVoice;
      let best = null, bestScore = -1;
      for (const v of speechSynthesis.getVoices()) {
        const sc = voiceScore(v);
        if (sc > bestScore) { best = v; bestScore = sc; }
      }
      // The voice list loads asynchronously; only remember the answer once it has arrived.
      if (speechSynthesis.getVoices().length) this.systemVoice = best;
      return best;
    },
    // Play one clip id or a list of them in order; speak `fallbackText` if there is no clip.
    play(clips, fallbackText) {
      this.stop();
      if (!Sound.on) return;
      const list = [].concat(clips || []).filter((id) => LINES[id]);
      if (list.length) this.playList(list);
      else if (fallbackText) this.speak(fallbackText);
    },
    playList(list) {
      const [id, ...rest] = list;
      const a = new Audio(`audio/${id}.m4a`);
      this.audio = a;
      a.onended = () => { if (this.audio === a) { this.audio = null; if (rest.length) this.playList(rest); } };
      // A missing or unplayable clip reads the rest of the line with the system voice instead.
      a.onerror = () => { if (this.audio === a) { this.audio = null; this.speak(list.map((c) => LINES[c].spoken || LINES[c].text).join(' ')); } };
      a.play().catch(() => { /* blocked until the first click; the next line will play */ });
    },
    speak(text) {
      if (!('speechSynthesis' in window)) return;
      try {
        const u = new SpeechSynthesisUtterance(VOICE.speakable(text));
        const v = this.bestSystemVoice();
        if (v) { u.voice = v; u.lang = v.lang; }
        u.rate = 1.05;
        u.pitch = 1.15;
        speechSynthesis.speak(u);
      } catch (e) { /* no speech available */ }
    },
    stop() {
      if (this.audio) { this.audio.pause(); this.audio = null; }
      try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    },
  };
  if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', () => { Voice.systemVoice = undefined; });

  // ---------- formatting ----------

  const money = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const signed = (n) => `<span class="${n >= 0 ? 'pos' : 'neg'}">${n >= 0 ? '+' : ''}${money(n)}</span>`;
  const num = (n) => Math.round(n).toLocaleString('en-US');
  const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const box = (x, y, w, h) => `left:${x / 12}%;top:${y / 7.5}%;width:${w / 12}%;height:${h / 7.5}%`;
  const cur = () => HDS.currentEvent(state);
  const ICON = { football: '🏈', soccer: '⚽', baseball: '⚾', concert: '🎸', circus: '🎪' };

  function words(n) {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
      'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const w = (x) => x < 20 ? ones[x] : x < 100 ? tens[Math.floor(x / 10)] + (x % 10 ? '-' + ones[x % 10] : '')
      : x < 1000 ? ones[Math.floor(x / 100)] + ' hundred' + (x % 100 ? ' ' + w(x % 100) : '')
      : w(Math.floor(x / 1000)) + ' thousand' + (x % 1000 ? ' ' + w(x % 1000) : '');
    const dollars = Math.floor(n), cents = Math.round((n - dollars) * 100);
    const s = dollars ? w(dollars) : 'zero';
    return `${s[0].toUpperCase()}${s.slice(1)} and ${String(cents).padStart(2, '0')}/100 dollars`;
  }

  // ---------- the guide ----------

  let sayTimer = null;
  // Show `text` in Bunsley's bubble and play `clips` (ids from voice-lines.js), or read the text aloud if none.
  function say(text, clips) {
    ui.say = text;
    ui.sayClips = clips || null;
    ui.sayVisible = true;
    Voice.play(clips, text);
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => {
      if (ui.say !== text || !ui.sayVisible) return;
      ui.sayVisible = false;
      const b = app.querySelector('.bubble');
      if (b) b.remove();
    }, Math.max(5000, text.length * 75));
  }

  function guideOnce(key, text, clips) {
    if (ui.said.has(key)) return;
    ui.said.add(key);
    say(text, clips);
  }

  function greet() {
    const ev = cur(), t = EVENT_TYPES[ev.type];
    if (state.problem) {
      Sound.ring();
      say(LINES['ring-office'].text, 'ring-office');
      return;
    }
    guideOnce('office', `${LINES[`day-${ev.day}`].text} ${LINES[`event-${ev.type}`].text}`, [`day-${ev.day}`, `event-${ev.type}`]);
  }

  // Views with a one-time explanation from Bunsley (lines 'guide-<view>' in voice-lines.js).
  const guideLine = (view) => LINES[`guide-${view}`];

  // ---------- navigation ----------

  const PARENT = { desk: 'office', tv: 'office', board: 'office', sign: 'office', suppliers: 'office',
    computer: 'desk', phone: 'desk', todo: 'desk', calendar: 'desk', checkbook: 'desk', journal: 'desk' };

  function navigate(view) {
    if (ui.anim || view === ui.view) return;
    ui.stack.push(ui.view);
    enter(view);
  }

  function enter(view) {
    ui.view = view;
    ui.sayVisible = false;
    ui.app = null;
    const ev = cur();
    switch (view) {
      case 'office': greet(); break;
      case 'calendar': ui.done.calendar = true; break;
      case 'tv': {
        ui.done.tv = true;
        guideOnce('tv', `${LINES['forecast-intro'].text} ${LINES[`weather-${ev.forecast}`].text}`, ['forecast-intro', `weather-${ev.forecast}`]);
        break;
      }
      case 'suppliers': if (typeof ui.supplierTab === 'number') ui.done.sup[ui.supplierTab] = true; break;
      case 'sign': ui.done.sign = true; break;
      case 'stand': ui.done.inventory = true; break;
      case 'phone':
        ui.dialed = '';
        ui.call = state.problem ? { problem: true } : null;
        if (state.problem) { ui.said.add('phone'); Voice.play(`problem-${state.problem.id}`); return; }
        break;
      case 'journal': ui.journalPage = Math.max(0, state.history.length - 1); break;
      default: break;
    }
    if (view === 'desk' && state.problem) { say(LINES['ring-desk'].text, 'ring-desk'); return; }
    if (guideLine(view)) guideOnce(view, guideLine(view).text, `guide-${view}`);
  }

  function backup() {
    if (ui.anim) return;
    const prev = ui.stack.pop() || PARENT[ui.view];
    if (prev) enter(prev);
  }

  function startEvent() {
    Object.assign(ui, {
      stack: [], done: freshDone(), said: new Set(), qty: SUPPLIERS.map(() => ({})), check: { payee: '', amount: '' },
      confirmOpen: null, standDone: false, report: null, call: null, tool: null, supplierTab: 0,
    });
    enter('office');
  }

  // ---------- rendering ----------

  function render() {
    if (ui.view === 'title') { app.innerHTML = renderTitle(); return; }
    const scene = SCENES[ui.view]();
    app.innerHTML = `<div class="stage">
      <div class="scene">${scene}${guideEl()}${toolWindow()}
        <button class="sound-toggle" data-act="sound" data-tip="${Sound.on ? 'Turn sound off' : 'Turn sound on'}">${Sound.on ? '🔊' : '🔇'}</button>
        <div class="tooltip" hidden></div>
      </div>
      ${bar()}
    </div>`;
  }

  function bar() {
    const inStand = ui.view === 'stand';
    const busy = !!ui.anim;
    const canBack = !busy && ui.view !== 'end' && (ui.stack.length || PARENT[ui.view]);
    return `<nav class="bar">
      <button class="btn-bottle ketchup" data-act="quit" data-tip="Save and go back to the title screen." ${busy ? 'disabled' : ''}><span>Quit</span></button>
      <button class="btn-dog" data-act="journal" data-tip="Read your journal of past events." ${busy ? 'disabled' : ''}><span>Journal</span></button>
      <button class="btn-dog wide" data-act="${inStand ? 'office' : 'stand'}" data-tip="${inStand ? 'Walk back to your office.' : 'Walk over to your hot dog stand.'}" ${busy || (state.over && !ui.standDone) ? 'disabled' : ''}>
        <span>${inStand ? 'Go to the Office' : 'Go to the Stand'}</span></button>
      <button class="btn-dog" data-act="replay" data-tip="Hear the last thing Bunsley said again." ${ui.say ? '' : 'disabled'}><span>Replay</span></button>
      <button class="btn-bottle mustard" data-act="backup" data-tip="Step back to the last place you were." ${canBack ? '' : 'disabled'}><span>Back</span></button>
    </nav>`;
  }

  // The event being played or just finished, if any. (After the last event there is no "current" one.)
  const playingEvent = () => (ui.anim ? ui.anim.ev : ui.standDone && ui.report ? state.schedule[ui.report.eventNumber - 1] : null);

  function plaque(y = 12) {
    const playing = playingEvent();
    const ev = playing || cur(), t = EVENT_TYPES[ev.type];
    const line = playing ? (ui.anim ? 'Open for business!' : 'Closed for the day.') : `Bank balance: ${money(state.cash)}`;
    return `<div class="plaque" style="${box(16, y, 330, 64)}">
      <b>${ordinal(ev.day)}</b> · ${ICON[ev.type]} ${t.name} ${t.time}<br><span>${line}</span></div>`;
  }

  function guideEl() {
    if (ui.view === 'tv') return bubble('tv-bubble', box(700, 20, 360, 150));
    if (ui.view === 'office') return bubble('office-bubble', 'right:10%;bottom:30%;width:36%');
    const mini = `<svg viewBox="-110 -290 220 380" class="mini-mascot">${ART.mascot(0, 60, 1, 'point')}</svg>`;
    return `<button class="guide" data-act="replay" style="${box(1070, 540, 130, 210)}" data-tip="Bunsley, your guide. Click to hear him again.">${mini}</button>
      ${bubble('corner-bubble', 'right:3%;bottom:31%;width:32%')}`;
  }

  function bubble(cls, style) {
    if (!ui.sayVisible || !ui.say) return '';
    return `<div class="bubble ${cls}" style="${style}"><button class="x" data-act="hide-say" aria-label="Close">×</button>${ui.say}</div>`;
  }

  // ---------- scenes ----------

  const SCENES = {
    office() {
      const menu = Object.entries(MENU).map(([k, m]) => ({ name: m.name, price: money(state.prices[k]) }));
      return ART.office({ ringing: !!state.problem, forecast: cur().forecast, menu }) + plaque();
    },

    desk() {
      const d = todoState();
      return ART.desk({ ringing: !!state.problem, todoDone: d }) + plaque();
    },

    board() {
      const ev = cur(), t = EVENT_TYPES[ev.type];
      const seats = EVENT_ORDER.map((k) => `<tr><td>${EVENT_TYPES[k].name}</td><td class="num">${num(EVENT_TYPES[k].seats)}</td></tr>`).join('');
      const inv = Object.entries(SUPPLIES).map(([k, s]) => {
        const inc = HDS.incoming(state, k);
        return `<tr><td>${s.name}</td><td class="num">${num(HDS.stockOf(state, k))}</td><td class="muted">${inc ? `+${inc} unpaid` : ''}</td></tr>`;
      }).join('');
      const expiring = HDS.bunsExpiringAfterEvent(state);
      return ART.backdrop('cork') + `
        <div class="note paper" style="${box(70, 60, 440, 360)}">
          <h3>Arena Management Announcement</h3>
          <p>${ANNOUNCEMENTS[ev.announcement].text}</p>
          <p>Advance ticket sales for today's ${t.name.toLowerCase()}: <b>about ${num(ev.expected)} fans</b>.</p>
        </div>
        <div class="note paper" style="${box(560, 50, 270, 330)}">
          <h3>Seating Capacity</h3><table>${seats}</table>
        </div>
        <div class="note sticky" style="${box(120, 460, 300, 220)}"><h3>Tip!</h3><p>${TIPS[ev.tip]}</p></div>
        <div class="note paper" style="${box(870, 50, 290, 520)}">
          <h3>Inventory</h3><table>${inv}</table>
          ${expiring ? `<p class="warn">${num(expiring)} buns go stale after today!</p>` : ''}
          <p>Helpers hired: <b>${state.helpers}</b></p>
        </div>
        <div class="pin" style="${box(282, 52, 20, 20)}"></div><div class="pin blue" style="${box(688, 42, 20, 20)}"></div>
        <div class="pin green" style="${box(262, 452, 20, 20)}"></div><div class="pin yellow" style="${box(1008, 42, 20, 20)}"></div>`;
    },

    tv() {
      const ev = cur(), w = WEATHER[ev.forecast];
      return ART.tv({ weather: ev.forecast, temp: w.temp }) +
        `<div class="ticker" style="${box(230, 560, 640, 56)}">FORECAST FOR THE ${ordinal(ev.day).toUpperCase()} · ${w.label.toUpperCase()} · ${w.temp}°</div>`;
    },

    sign() {
      const ev = cur();
      const icons = EVENT_ORDER.map((k) => `<div class="event-icon ${k === ev.type ? 'today' : ''}" data-tip="${EVENT_TYPES[k].name}">${ICON[k]}</div>`).join('');
      const rows = Object.entries(MENU).map(([k, m]) => `<div class="menu-row">
          <span class="chalk">${m.name}</span>
          <span class="price-edit">
            <button class="chalk-btn" data-act="price" data-item="${k}" data-delta="-0.05" aria-label="Lower price">−</button>
            <input class="price-input" data-item="${k}" type="number" step="0.05" min="0.25" max="9.95" value="${state.prices[k].toFixed(2)}" aria-label="${m.name} price">
            <button class="chalk-btn" data-act="price" data-item="${k}" data-delta="0.05" aria-label="Raise price">+</button>
          </span></div>`).join('');
      return ART.backdrop('chalk') + `
        <div class="event-strip" style="${box(60, 50, 110, 650)}">${icons}</div>
        <h2 class="chalk title" style="${box(220, 50, 900, 120)}">Today's Menu</h2>
        <div class="menu-rows" style="${box(240, 170, 800, 420)}">${rows}</div>`;
    },

    suppliers() {
      const tabs = SUPPLIERS.map((_, i) => `<button class="tab ${ui.supplierTab === i ? 'active' : ''}" data-act="tab" data-tab="${i}">Supplier ${i + 1}</button>`).join('') +
        `<button class="tab ${ui.supplierTab === 'old' ? 'active' : ''}" data-act="tab" data-tab="old">Old Orders</button>`;
      return ART.backdrop('drawer') + `
        <div class="folder" style="${box(60, 64, 990, 610)}">
          <div class="tabs">${tabs}</div>
          <div class="folder-body">${ui.supplierTab === 'old' ? oldOrders() : supplierSheet(ui.supplierTab)}</div>
          <div class="folder-tools">
            <button class="oval" data-act="tool" data-tool="calc">Calculator</button>
            <button class="oval" data-act="tool" data-tool="estimator">Estimator</button>
            <button class="oval" data-act="goto" data-view="checkbook">Checkbook</button>
            <div class="balance"><small>Bank Balance</small><b>${money(state.cash)}</b></div>
          </div>
        </div>`;
    },

    checkbook() {
      const unpaid = HDS.unpaidInvoices(state);
      const bills = unpaid.length ? unpaid.map((inv) => `<li><button class="link" data-act="fill-payee" data-name="${inv.supplier}" data-tip="Fill in this name on the check">${inv.supplier}</button>
          <span class="muted">order #${inv.id}</span> <b>${money(inv.total)}</b></li>`).join('')
        : '<li class="muted">No unpaid bills. 👍</li>';
      const register = state.ledger.slice().reverse().map((l) => `<tr><td>${l.check || ''}</td><td>${l.event ? ordinal(state.schedule[l.event - 1].day) : ''}</td>
          <td>${l.desc}</td><td class="num">${l.amount < 0 ? money(-l.amount) : ''}</td><td class="num">${l.amount >= 0 ? money(l.amount) : ''}</td><td class="num">${money(l.balance)}</td></tr>`).join('');
      const amt = parseFloat(ui.check.amount);
      return ART.backdrop('desk') + `
        <div class="check" style="${box(90, 24, 1020, 300)}">
          <div class="check-top"><span class="bank">FIRST CITY BANK</span><span>No. ${state.nextCheck}</span></div>
          <div class="check-date">Date: the ${ordinal(cur().day)}</div>
          <label class="check-line">Pay to the order of
            <input id="payee" list="payees" value="${ui.check.payee.replace(/"/g, '&quot;')}" autocomplete="off"></label>
          <datalist id="payees">${SUPPLIERS.map((s) => `<option value="${s}">`).join('')}</datalist>
          <label class="check-amount">$ <input id="amount" inputmode="decimal" value="${ui.check.amount}" autocomplete="off"></label>
          <div class="check-words" data-words>${Number.isFinite(amt) && amt > 0 ? words(amt) : '&nbsp;'}</div>
          <div class="check-bottom"><span class="memo">Memo: supplies</span><button class="sign-btn" data-act="sign-check">✍ Sign &amp; send</button></div>
        </div>
        <div class="card" style="${box(90, 340, 400, 390)}"><h3>Bills to pay</h3><ul class="bills">${bills}</ul></div>
        <div class="card register" style="${box(510, 340, 600, 390)}"><h3>Check register</h3>
          <div class="scroll"><table><tr><th>No.</th><th>Date</th><th>Description</th><th class="num">Payment</th><th class="num">Deposit</th><th class="num">Balance</th></tr>${register}</table></div></div>`;
    },

    phone() {
      const contacts = CONTACTS.map((c) => `<li><button class="link" data-act="call" data-number="${c.number}">${c.name}</button><br><span>${c.number.slice(0, 3)}-${c.number.slice(3)}</span></li>`).join('');
      return ART.phone({ dialed: formatDial(ui.dialed), offHook: !!ui.call }) + `
        <div class="phone-list" style="${box(752, 244, 186, 412)}"><h4>Important Numbers</h4><ul>${contacts}</ul></div>
        ${ui.call ? callBubble() : ''}`;
    },

    todo() {
      const d = todoState();
      const items = TODO.map((t, i) => `<li><span>${i + 1}. ${t}</span><span class="box">${d[i] ? '✔' : ''}</span></li>`).join('');
      return ART.backdrop('desk') + `<div class="todo-paper" style="${box(320, 30, 560, 680)}"><h2>Things To Do</h2><ol>${items}</ol></div>`;
    },

    calendar() {
      const cells = [];
      const byDay = Object.fromEntries(state.schedule.map((e, i) => [e.day, { e, i }]));
      for (let d = 1; d <= 35; d++) {
        if (d > CONFIG.daysInMonth) { cells.push('<div class="day empty"></div>'); continue; }
        const hit = byDay[d];
        let body = '';
        let cls = '';
        if (hit) {
          const t = EVENT_TYPES[hit.e.type];
          cls = hit.i < state.eventIndex ? 'past' : hit.i === state.eventIndex ? 'today' : 'future';
          body = `<div class="ev">${ICON[hit.e.type]} ${t.name}<br>${t.time}</div>`;
        }
        cells.push(`<div class="day ${cls}"><span class="n">${d}</span>${body}</div>`);
      }
      const heads = ['Sun.', 'Mon.', 'Tues.', 'Wed.', 'Thur.', 'Fri.', 'Sat.'].map((h) => `<div class="head">${h}</div>`).join('');
      return ART.backdrop('desk') + `<div class="calendar" style="${box(50, 20, 1000, 700)}">
        <div class="grid">${heads}${cells.join('')}</div><div class="cal-foot">Stadium Events · Season Schedule</div></div>`;
    },

    computer() {
      const icons = [['report', '📊', 'Franchise Report'], ['estimator', '🧮', 'Estimator'], ['calc', '🔢', 'Calculator']]
        .map(([id, ic, label]) => `<button class="desk-icon" data-act="app" data-app="${id}"><span>${ic}</span>${label}</button>`).join('');
      return ART.backdrop('desk') + `<div class="monitor" style="${box(160, 20, 880, 660)}">
        <div class="screen"><div class="icons">${icons}</div>${ui.app === 'report' ? franchiseWindow() : ''}</div>
        <div class="brand">StandOS 3.1</div></div>`;
    },

    journal() {
      return ART.backdrop('desk') + `<div class="notebook" style="${box(110, 16, 980, 710)}">${journalPage()}</div>`;
    },

    stand() {
      const view = standView();
      return ART.stand(view) + plaque(628) + (ui.anim ? `<button class="skip" data-act="skip" style="${box(1010, 20, 170, 50)}">Skip ▶▶</button>` : '') +
        (ui.standDone ? `<button class="big-go" data-act="results" style="${box(420, 640, 360, 70)}">Read today's journal ▶</button>` : '');
    },

    end() {
      return ART.backdrop('desk') + `<div class="notebook" style="${box(110, 16, 980, 710)}">${endPage()}</div>`;
    },
  };

  function renderTitle() {
    const saved = loadSaved();
    return `<div class="stage"><div class="scene">${ART.title()}
      <h1 class="logo" style="${box(60, 40, 820, 220)}">Stadium<br>Dogs</h1>
      <div class="note paper intro" style="${box(80, 300, 620, 240)}">
        <p>The city stadium has given you a hot dog stand for the season! Start with <b>${money(CONFIG.startCash)}</b>, and try to have
        <b>${money(CONFIG.goal)}</b> in the bank after ${CONFIG.seasonLength} events. Beat the rival stands, Wiener Wagon and Frankfurter Fred's.</p>
        <p>Before each event: read the calendar and the weather, order from suppliers, pay with checks, set your prices, then open the stand!</p>
      </div>
      <div class="title-buttons" style="${box(80, 620, 700, 90)}">
        ${saved ? '<button class="btn-dog wide" data-act="continue"><span>Continue Season</span></button>' : ''}
        <button class="btn-dog wide" data-act="new"><span>New Season</span></button>
      </div>
      <button class="sound-toggle" data-act="sound">${Sound.on ? '🔊' : '🔇'}</button>
    </div><div class="bar"></div></div>`;
  }

  // ---------- pieces ----------

  function supplierSheet(i) {
    const rows = Object.entries(SUPPLIES).map(([k, s]) => {
      const price = HDS.supplierPrice(state, i, k);
      const q = ui.qty[i][k] || '';
      const amt = q ? money(price * q).slice(1) : '';
      const sale = price < state.supplierPrices[i][k] ? ' <span class="sale">½ OFF</span>' : '';
      return `<tr><td>${s.name}</td><td>${s.unit}</td><td class="num">${money(price)}${sale}</td>
        <td><input class="qty" data-key="${k}" inputmode="numeric" value="${q}" aria-label="${s.name} quantity"></td>
        <td><div class="amt" data-amt="${k}">${amt}</div></td><td class="num muted">${num(HDS.stockOf(state, k))}</td></tr>`;
    }).join('');
    return `<div class="sheet-head"><span>Supplier: <b>${SUPPLIERS[i]}</b></span><span>Date: the ${ordinal(cur().day)}</span></div>
      <table class="sheet"><tr><th>Item</th><th>Unit</th><th class="num">Price</th><th>Quantity</th><th>Amount</th><th class="num">On hand</th></tr>${rows}
        <tr><td colspan="4" class="num"><b>Grand Total</b></td><td><div class="amt total" data-grand>${grandTotal(i)}</div></td><td></td></tr></table>
      <div class="sheet-actions"><button class="btn-small" data-act="clear-order">Clear</button><button class="btn-small primary" data-act="send-order">Send Order to ${SUPPLIERS[i]}</button></div>`;
  }

  function grandTotal(i) {
    let t = 0;
    for (const [k, q] of Object.entries(ui.qty[i])) if (q > 0) t += HDS.supplierPrice(state, i, k) * q;
    return t ? money(t).slice(1) : '';
  }

  function oldOrders() {
    if (!state.invoices.length) return '<p class="muted">No orders yet.</p>';
    const label = { unpaid: '<span class="warn">Unpaid</span>', paid: 'Paid', cancelled: 'Cancelled', expired: 'Never paid' };
    const rows = state.invoices.slice().reverse().map((inv) => `<tr><td>#${inv.id}</td><td>the ${ordinal(inv.day)}</td><td>${inv.supplier}</td>
      <td>${inv.lines.map((l) => `${l.packs} ${SUPPLIES[l.key].name}`).join(', ')}</td><td class="num">${money(inv.total)}</td>
      <td>${label[inv.status]}${inv.check ? ` (check #${inv.check})` : ''}</td>
      <td>${inv.status === 'unpaid' ? `<button class="btn-small" data-act="cancel-inv" data-id="${inv.id}">Cancel</button>` : ''}</td></tr>`).join('');
    return `<div class="scroll"><table class="sheet"><tr><th>Order</th><th>Date</th><th>Supplier</th><th>Items</th><th class="num">Total</th><th>Status</th><th></th></tr>${rows}</table></div>`;
  }

  function franchiseWindow() {
    const last = state.history[state.history.length - 1];
    let body;
    if (!last) body = '<p>No events yet. Check back after your first event!</p>';
    else {
      const cells = (p) => Object.keys(MENU).map((k) => `<td class="num">${money(p[k])}</td>`).join('');
      const yours = Object.fromEntries(Object.entries(last.items).map(([k, v]) => [k, v.price]));
      body = `<p>Last event: <b>${last.eventName}</b> on the ${ordinal(last.day)}</p>
        <table><tr><th>Stand</th><th class="num">Customers</th>${Object.values(MENU).map((m) => `<th class="num">${m.name}</th>`).join('')}<th class="num">Profit</th><th class="num">Season</th></tr>
        <tr><td><b>Your stand</b></td><td class="num">${num(last.served)}</td>${cells(yours)}<td class="num">${signed(last.profit)}</td><td class="num">${signed(state.cash - CONFIG.startCash)}</td></tr>
        ${state.rivals.map((r) => `<tr><td>${r.name}</td><td class="num">${num(r.last.customers)}</td>${cells(r.last.prices)}<td class="num">${signed(r.last.profit)}</td><td class="num">${signed(r.totalProfit)}</td></tr>`).join('')}
        </table><p>What fans say about your stand: <b>${reputationWord(state.reputation)}</b></p>`;
    }
    return `<div class="win" style="inset:4% 2% 5% 17%"><div class="win-title">Franchise Report<button class="x" data-act="close-app">×</button></div><div class="win-body">${body}</div></div>`;
  }

  function reputationWord(r) {
    if (r >= 1.2) return 'They love it!';
    if (r >= 1.05) return 'Good';
    if (r >= 0.95) return 'Okay';
    if (r >= 0.8) return 'Some fans are unhappy';
    return 'Fans are avoiding you';
  }

  function toolWindow() {
    if (ui.tool === 'calc') {
      const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];
      return `<div class="win tool" style="${box(760, 60, 320, 440)}"><div class="win-title">Calculator<button class="x" data-act="close-tool">×</button></div>
        <div class="win-body calc"><div class="calc-display">${ui.calc.display}</div>
        <div class="calc-keys">${keys.map((k) => `<button data-act="calc" data-k="${k}">${k}</button>`).join('')}<button class="wide" data-act="calc" data-k="C">Clear</button></div></div></div>`;
    }
    if (ui.tool === 'estimator') {
      const items = Object.keys(MENU);
      const rows = state.history.length ? state.history.map((h) => `<tr><td>the ${ordinal(h.day)}</td><td>${h.eventName}</td><td>${WEATHER[h.weather].label}</td>
          <td class="num">${num(h.attendance)}</td><td class="num">${num(h.served)}${h.turnedAway ? `<small> (+${num(h.turnedAway)} left)</small>` : ''}</td>
          <td class="num">${((h.wanted / h.attendance) * 1000).toFixed(1)}</td>
          ${items.map((k) => `<td class="num">${num(h.items[k].demand)}<small> (${Math.round((h.items[k].demand / Math.max(1, h.served)) * 100)}%)</small></td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${6 + items.length}" class="muted">After your first event, this shows how many customers came and what they wanted.</td></tr>`;
      return `<div class="win tool" style="${box(40, 40, 1010, 440)}"><div class="win-title">Estimator<button class="x" data-act="close-tool">×</button></div>
        <div class="win-body"><div class="scroll short"><table><tr><th>Date</th><th>Event</th><th>Weather</th><th class="num">Fans</th><th class="num">Customers</th>
          <th class="num">Visitors per<br>1,000 fans</th>${items.map((k) => `<th class="num">${MENU[k].name}<br>wanted</th>`).join('')}</tr>${rows}</table></div>
        <div class="estimate">Estimate: <input id="est-fans" inputmode="numeric" value="${ui.est.fans}" placeholder="number"> ×
          <input id="est-pct" inputmode="decimal" value="${ui.est.pct}" placeholder="%">% = <b data-est>${estimate()}</b></div>
        <p class="muted">Percents in the table are out of your customers. Today's ticket sales are on the bulletin board, and the weather changes what people buy!</p></div></div>`;
    }
    return '';
  }

  const estimate = () => {
    const f = parseFloat(ui.est.fans), p = parseFloat(ui.est.pct);
    return Number.isFinite(f) && Number.isFinite(p) ? num((f * p) / 100) : '?';
  };

  // ---------- phone ----------

  const CONTACTS = [
    { name: 'Helping Hands (helpers)', number: '5554357' },
    { name: 'Arena Office', number: '5552273' },
    { name: 'First City Bank', number: '5552265' },
    { name: "Joe's Grill Repair", number: '5555637' },
  ];

  const formatDial = (d) => (d.length > 3 ? d.slice(0, 3) + '-' + d.slice(3) : d);

  function dial(k) {
    if (ui.call) return;
    Sound.tone(600 + '123456789*0#'.indexOf(k) * 40, 0.12, { type: 'sine', vol: 0.06 });
    if (!/\d/.test(k)) return render();
    ui.dialed += k;
    if (ui.dialed.length === 7) connect();
    render();
  }

  function connect() {
    const c = CONTACTS.find((x) => x.number === ui.dialed);
    const ev = cur();
    if (!c) {
      const clip = `wrong-${Math.floor(Math.random() * VOICE.WRONG_COUNT)}`;
      ui.call = { who: 'Wrong number', text: LINES[clip].text, clip };
    } else if (c.number === '5554357') {
      ui.call = { who: c.name, text: `${LINES['call-helpers'].text} You have ${state.helpers} now.`, clip: 'call-helpers',
        choices: [0, 1, 2].map((n) => ({ label: n ? `${n} helper${n > 1 ? 's' : ''}` : 'No helpers', act: 'hire', n })) };
    } else if (c.number === '5552273') {
      const t = EVENT_TYPES[ev.type];
      ui.call = { who: c.name, clip: 'call-arena',
        text: `${LINES['call-arena'].text} For the ${t.name.toLowerCase()} on the ${ordinal(ev.day)} at ${t.time}, we've sold about ${num(ev.expected)} tickets. We have ${num(t.seats)} seats.` };
    } else if (c.number === '5552265') {
      const unpaid = HDS.unpaidInvoices(state);
      const owed = unpaid.reduce((s, i) => s + i.total, 0);
      ui.call = { who: c.name, clip: 'call-bank', text: `${LINES['call-bank'].text} Your balance is ${money(state.cash)}. ${unpaid.length ? `You have ${unpaid.length} unpaid bill${unpaid.length > 1 ? 's' : ''} for ${money(owed)}.` : 'You have no unpaid bills.'}` };
    } else {
      ui.call = { who: c.name, text: LINES['call-joe'].text, clip: 'call-joe' };
    }
    Voice.play(ui.call.clip, ui.call.text);
  }

  function callBubble() {
    let who, text, choices = '';
    if (ui.call.problem) {
      const def = HDS.problemDef(state.problem.id);
      who = def.caller; text = def.text;
      choices = def.choices.map((c, i) => {
        const cant = c.cost && !c.forced && c.cost > state.cash;
        return `<button class="btn-small" data-act="choose" data-i="${i}" ${cant ? 'disabled' : ''}>${c.label}${cant ? ' (not enough money)' : ''}</button>`;
      }).join('');
    } else {
      who = ui.call.who; text = ui.call.text;
      choices = (ui.call.choices || []).map((c) => `<button class="btn-small" data-act="${c.act}" data-n="${c.n}">${c.label}</button>`).join('');
    }
    const hang = ui.call.problem ? '' : '<button class="btn-small" data-act="hangup">Hang up</button>';
    return `<div class="call-bubble" style="${box(330, 16, 620, 250)}"><div class="who">📞 ${who}</div><p>${text}</p><div class="choices">${choices}${hang}</div></div>`;
  }

  // ---------- to-do list ----------

  const TODO = [
    'Look at the calendar and the TV weather report.',
    'Compare prices from all three suppliers.',
    'Send your supply orders.',
    'Pay each supplier by writing a check.',
    "Put today's prices on the menu board.",
    'Go to the stand and count your supplies.',
    'Open the stand!',
  ];

  function todoState() {
    const d = ui.done;
    const paidSome = state.invoices.some((i) => i.event === state.eventIndex + 1 && i.status === 'paid');
    return [d.calendar && d.tv, d.sup.every(Boolean), d.ordered, d.ordered && paidSome && !HDS.unpaidInvoices(state).length, d.sign, d.inventory, false];
  }

  // ---------- the stand and the event animation ----------

  function standView() {
    const s = {};
    for (const k of Object.keys(SUPPLIES)) s[k] = HDS.stockOf(state, k);
    const ev = playingEvent() || cur();
    const startHour = parseInt(EVENT_TYPES[ev.type].time, 10);
    let crowd = ui.standDone ? 0 : 3, register = null, clockAngle = (startHour % 12) * 30 - 30, drawerOpen = false;
    if (ui.anim) {
      const a = ui.anim, p = Math.min(1, (Date.now() - a.start) / a.duration);
      let cash = 0;
      for (const k of Object.keys(SUPPLIES)) s[k] = a.pre[k];
      for (const [item, it] of Object.entries(a.report.items)) {
        const n = Math.min(it.sold, Math.floor(it.demand * p));
        cash += n * it.price;
        for (const [key, per] of Object.entries(MENU[item].uses)) s[key] -= n * per;
      }
      register = cash.toFixed(2);
      crowd = Math.max(1, Math.round(9 * Math.min(1, a.report.wanted / 150) * (1 - p * 0.75)));
      clockAngle = (startHour % 12) * 30 + p * 90;
      drawerOpen = a.t % 6 < 2;
    } else if (ui.standDone && ui.report) {
      register = ui.report.revenue.toFixed(2);
      clockAngle = (startHour % 12) * 30 + 90;
    }
    return { stock: s, crowd, crowdSeed: state.eventIndex * 7, register, clockAngle, drawerOpen, open: !!ui.anim || ui.standDone };
  }

  function standClick(id) {
    if (id === 'open') return tryOpen();
    if (ui.anim) return;
    const st = (k) => num(HDS.stockOf(state, k));
    const lines = {
      grill: `You have ${st('beef')} hot dogs and ${st('turkey')} turkey dogs.`,
      buns: `You have ${st('buns')} buns.${HDS.bunsExpiringAfterEvent(state) ? ` ${num(HDS.bunsExpiringAfterEvent(state))} of them go stale after today!` : ''}`,
      cola: `You have ${st('cola')} cans of cola.`,
      chips: `You have ${st('chips')} bags of chips.`,
      kits: `You have ${st('kits')} condiment kits. Every hot dog needs one!`,
      register: `Your bank balance is ${money(state.cash)}.`,
      window: ui.standDone || state.over ? 'The fans have all gone home.' : `The gates open at ${EVENT_TYPES[cur().type].time}. You can serve about ${HDS.capacity(state)} customers with ${state.helpers} helper${state.helpers === 1 ? '' : 's'}.`,
    };
    if (lines[id]) say(lines[id]);
  }

  function hasSomethingToSell() {
    return Object.keys(MENU).some((k) => HDS.servingsAvailable(state, k) > 0);
  }

  function tryOpen() {
    if (ui.anim || ui.standDone) return;
    if (state.problem) { Sound.buzz(); say(LINES['ring-stand'].text, 'ring-stand'); return; }
    const unpaid = HDS.unpaidInvoices(state);
    if (unpaid.length && ui.confirmOpen !== 'unpaid' && ui.confirmOpen !== 'empty') {
      ui.confirmOpen = 'unpaid';
      Sound.buzz();
      say(`You haven't paid ${[...new Set(unpaid.map((i) => i.supplier))].join(' and ')}. Unpaid orders won't be delivered! Flip the sign again to open anyway.`, 'warn-unpaid');
      return;
    }
    if (!hasSomethingToSell() && ui.confirmOpen !== 'empty') {
      ui.confirmOpen = 'empty';
      Sound.buzz();
      say(`Your stand is empty! You'll still have to pay ${money(CONFIG.rent)} rent. Flip the sign again to open anyway.`, 'warn-empty');
      return;
    }
    startAnimation();
  }

  function startAnimation() {
    const pre = {};
    for (const k of Object.keys(SUPPLIES)) pre[k] = HDS.stockOf(state, k);
    const ev = cur();
    const report = HDS.runEvent(state);
    save();
    ui.report = report;
    ui.anim = { start: Date.now(), duration: 9000, t: 0, pre, report, ev, out: {} };
    ui.confirmOpen = null;
    Sound.crowd(true);
    say(LINES.open.text, 'open');
    ui.timer = setInterval(tick, 100);
  }

  function tick() {
    const a = ui.anim;
    if (!a) return;
    a.t++;
    const p = Math.min(1, (Date.now() - a.start) / a.duration);
    for (const [item, it] of Object.entries(a.report.items)) {
      if (it.missed > 0 && !a.out[item] && it.demand * p >= it.sold) {
        a.out[item] = true;
        say(LINES[`out-${item}`].text, `out-${item}`);
      }
    }
    if (a.t % 6 === 0 && Object.values(a.report.items).some((it) => it.demand * p < it.sold)) Sound.ching();
    if (p >= 1) return finishAnimation();
    render();
  }

  function finishAnimation() {
    clearInterval(ui.timer);
    ui.anim = null;
    ui.standDone = true;
    Sound.crowd(false);
    const r = ui.report;
    say(r.profit >= 0 ? `That's a wrap! Good job, we made a profit of ${money(r.profit)} today.`
      : `That's a wrap. We lost ${money(-r.profit)} today. Let's read the journal and see what happened.`,
    r.profit >= 0 ? 'wrap-profit' : 'wrap-loss');
    render();
  }

  // ---------- journal ----------

  function reportPage(r) {
    const itemRows = Object.entries(r.items).map(([k, it]) => `<tr><td>${MENU[k].name}</td><td class="num">${money(it.price)}</td>
      <td class="num">${num(it.demand)}</td><td class="num">${num(it.sold)}</td><td class="num ${it.missed ? 'neg' : ''}">${num(it.missed)}</td><td class="num">${money(it.revenue)}</td></tr>`).join('');
    const notes = [];
    if (r.turnedAway) notes.push(`${num(r.turnedAway)} fans gave up waiting in line. More helpers would have served them.`);
    for (const [k, it] of Object.entries(r.items)) if (it.missed) notes.push(`Ran out of ${MENU[k].name.toLowerCase()}: ${num(it.missed)} fans wanted one and couldn't get it.`);
    if (r.staleBuns) notes.push(`Threw out ${num(r.staleBuns)} stale buns.`);
    if (r.expiredOrders.length) notes.push(`Never paid ${r.expiredOrders.join(', ')}, so those supplies never came.`);
    if (r.reputationAfter > r.reputationBefore) notes.push('Fans are saying good things about the stand!');
    if (r.reputationAfter < r.reputationBefore) notes.push('Some fans were unhappy today.');
    const w = WEATHER[r.weather];
    return `<h2>The ${ordinal(r.day)}: ${ICON[r.type]} ${r.eventName}</h2>
      <p>Weather: <b>${w.label}, ${w.temp}°</b> ${r.forecast !== r.weather ? `(TV said ${WEATHER[r.forecast].label.toLowerCase()})` : ''}<br>
      Fans at the stadium: <b>${num(r.attendance)}</b> · Customers served: <b>${num(r.served)}</b> (room for ${num(r.capacity)})</p>
      <table><tr><th>Item</th><th class="num">Price</th><th class="num">Wanted</th><th class="num">Sold</th><th class="num">Missed</th><th class="num">Sales</th></tr>${itemRows}</table>
      <table class="money"><tr><td>Sales</td><td class="num">${money(r.revenue)}</td></tr>
        <tr><td>Supplies and other costs</td><td class="num">${money(-r.otherSpending)}</td></tr>
        <tr><td>Stadium rent</td><td class="num">${money(-r.rent)}</td></tr>
        ${r.wages ? `<tr><td>Helper wages</td><td class="num">${money(-r.wages)}</td></tr>` : ''}
        <tr class="total"><td>Profit</td><td class="num">${signed(r.profit)}</td></tr></table>
      ${notes.map((n) => `<p class="note-line">• ${n}</p>`).join('')}`;
  }

  function journalPage() {
    const h = state.history;
    if (ui.standDone && ui.report) {
      return `${reportPage(ui.report)}<div class="page-nav"><span></span><button class="btn-small primary" data-act="after-report">${state.over ? 'See the season results ▶' : 'Get ready for the next event ▶'}</button></div>`;
    }
    if (!h.length) return `<h2>My Journal</h2><p>No entries yet. The first event is on the ${ordinal(state.schedule[0].day)}. Good luck!</p>`;
    const i = Math.min(ui.journalPage, h.length - 1);
    return `${reportPage(h[i])}<div class="page-nav">
      <button class="btn-small" data-act="page" data-delta="-1" ${i ? '' : 'disabled'}>◀ Earlier</button>
      <span>Page ${i + 1} of ${h.length}</span>
      <button class="btn-small" data-act="page" data-delta="1" ${i < h.length - 1 ? '' : 'disabled'}>Later ▶</button></div>`;
  }

  function endPage() {
    const standings = HDS.finalStandings(state);
    const place = standings.findIndex((s) => s.you) + 1;
    const reached = state.cash >= CONFIG.goal;
    const headline = state.bankrupt ? `💸 Out of money! You couldn't pay your bills, and the stadium took back your stand.`
      : reached && place === 1 ? '🏆 Top of the league! You reached your goal and beat every rival stand.'
      : reached ? `You reached your goal! But you came in #${place} of the three stands.`
      : `You finished with ${money(state.cash)}, short of your ${money(CONFIG.goal)} goal.`;
    const rows = standings.map((s, i) => `<tr><td>${i + 1}</td><td>${s.you ? '<b>Your stand</b>' : s.name}</td><td class="num">${signed(s.totalProfit)}</td></tr>`).join('');
    const events = state.history.map((h) => `<tr><td>the ${ordinal(h.day)}</td><td>${ICON[h.type]} ${h.eventName}</td><td>${WEATHER[h.weather].label}</td><td class="num">${num(h.served)}</td><td class="num">${signed(h.profit)}</td></tr>`).join('');
    return `<h2>Season Over!</h2><p class="headline">${headline}</p>
      <table><tr><th>Place</th><th>Stand</th><th class="num">Season profit</th></tr>${rows}</table>
      <table><tr><th>Date</th><th>Event</th><th>Weather</th><th class="num">Customers</th><th class="num">Profit</th></tr>${events}</table>
      <div class="page-nav"><span></span><button class="btn-small primary" data-act="new">Play another season ▶</button></div>`;
  }

  // ---------- actions ----------

  function act(name, d) {
    switch (name) {
      case 'new':
        Sound.hush();
        state = HDS.newGame();
        ui = freshUi('office');
        save();
        startEvent();
        break;
      case 'continue':
        state = loadSaved();
        ui = freshUi('title');
        if (state) startEvent();
        break;
      case 'quit':
        Sound.hush();
        save();
        ui.view = 'title';
        break;
      case 'sound':
        Sound.on = !Sound.on;
        savePref(SOUND_KEY, Sound.on);
        if (!Sound.on) Sound.hush();
        break;
      case 'journal': navigate('journal'); break;
      case 'stand': ui.stack = []; enter('stand'); break;
      case 'office':
        if (ui.standDone) { ui.stack = []; enter('journal'); break; }
        ui.stack = []; enter('office');
        break;
      case 'results': ui.stack = []; enter('journal'); break;
      case 'after-report':
        ui.standDone = false;
        if (state.over) { ui.view = 'end'; Voice.play('season-over'); } else startEvent();
        break;
      case 'replay': if (ui.say) say(ui.say, ui.sayClips); break;
      case 'hide-say': ui.sayVisible = false; Sound.hush(); break;
      case 'backup': backup(); break;
      case 'goto': navigate(d.view); break;
      case 'tab':
        ui.supplierTab = d.tab === 'old' ? 'old' : Number(d.tab);
        if (typeof ui.supplierTab === 'number') ui.done.sup[ui.supplierTab] = true;
        break;
      case 'clear-order': if (typeof ui.supplierTab === 'number') ui.qty[ui.supplierTab] = {}; break;
      case 'send-order': {
        const i = ui.supplierTab;
        const res = HDS.placeOrder(state, i, ui.qty[i]);
        if (res.ok) {
          ui.qty[i] = {};
          ui.done.ordered = true;
          say(`Order sent to ${SUPPLIERS[i]}! Now write them a check for ${money(res.invoice.total)}. They deliver as soon as they're paid.`, `order-${i}`);
          save();
        } else { Sound.buzz(); say(res.error, 'oops'); }
        break;
      }
      case 'cancel-inv': HDS.cancelInvoice(state, Number(d.id)); save(); break;
      case 'tool': ui.tool = d.tool; break;
      case 'close-tool': ui.tool = null; break;
      case 'app':
        if (d.app === 'report') ui.app = 'report'; else ui.tool = d.app;
        break;
      case 'close-app': ui.app = null; break;
      case 'calc': calcPress(d.k); break;
      case 'price':
        HDS.setPrice(state, d.item, state.prices[d.item] + Number(d.delta));
        save();
        break;
      case 'fill-payee': ui.check.payee = d.name; break;
      case 'sign-check': {
        const res = HDS.writeCheck(state, ui.check.payee, ui.check.amount);
        if (res.ok) {
          Sound.ching();
          say(`Check number ${res.invoice.check} is on its way to ${res.invoice.supplier}. Your supplies are being delivered to the stand!`, 'check-sent');
          ui.check = { payee: '', amount: '' };
          save();
        } else { Sound.buzz(); say(res.error, 'oops'); }
        break;
      }
      case 'call': ui.dialed = d.number; connect(); break;
      case 'hangup': ui.call = null; ui.dialed = ''; Sound.hush(); break;
      case 'choose': {
        const def = HDS.problemDef(state.problem.id);
        const res = HDS.resolveProblem(state, Number(d.i));
        if (res.ok) {
          ui.call = { who: def.caller, text: LINES[`bye-${def.id}`].text };
          Voice.play(`bye-${def.id}`);
          save();
        } else { Sound.buzz(); say(res.error, 'oops'); }
        break;
      }
      case 'hire': {
        const n = Number(d.n);
        HDS.hireHelpers(state, n);
        ui.call = { who: 'Helping Hands', text: LINES[`hired-${n}`].text };
        Voice.play(`hired-${n}`);
        save();
        break;
      }
      case 'page': ui.journalPage = Math.max(0, ui.journalPage + Number(d.delta)); break;
      case 'skip':
        if (ui.anim) { ui.anim.start -= ui.anim.duration; tick(); return; }
        break;
      default: return;
    }
    render();
  }

  function calcPress(k) {
    const c = ui.calc;
    const run = () => {
      const a = c.acc, b = parseFloat(c.display);
      const r = c.op === '+' ? a + b : c.op === '−' ? a - b : c.op === '×' ? a * b : b === 0 ? NaN : a / b;
      c.display = Number.isFinite(r) ? String(+r.toFixed(8)) : 'Error';
      c.acc = r;
    };
    if (/^\d$/.test(k)) { c.display = c.fresh || c.display === '0' ? k : c.display + k; c.fresh = false; }
    else if (k === '.') { if (c.fresh) { c.display = '0.'; c.fresh = false; } else if (!c.display.includes('.')) c.display += '.'; }
    else if (k === 'C') Object.assign(c, { display: '0', acc: null, op: null, fresh: true });
    else if ('+−×÷'.includes(k)) { if (c.op && !c.fresh) run(); else c.acc = parseFloat(c.display); c.op = k; c.fresh = true; }
    else if (k === '=' && c.op) { run(); c.op = null; c.fresh = true; }
  }

  // ---------- input wiring ----------

  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act],[data-go],[data-dial]');
    if (!el || el.disabled) return;
    Sound.click();
    if (el.dataset.dial) return dial(el.dataset.dial);
    if (el.dataset.go) {
      if (ui.view === 'stand') standClick(el.dataset.go);
      else navigate({ cabinet: 'suppliers' }[el.dataset.go] || el.dataset.go);
      return render();
    }
    act(el.dataset.act, el.dataset);
  });

  // Typing updates totals in place, so the text box keeps focus.
  app.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('.qty')) {
      const i = ui.supplierTab;
      const q = parseInt(t.value, 10);
      ui.qty[i][t.dataset.key] = Number.isInteger(q) && q > 0 ? q : 0;
      const cell = app.querySelector(`[data-amt="${t.dataset.key}"]`);
      if (cell) cell.textContent = ui.qty[i][t.dataset.key] ? money(HDS.supplierPrice(state, i, t.dataset.key) * ui.qty[i][t.dataset.key]).slice(1) : '';
      const g = app.querySelector('[data-grand]');
      if (g) g.textContent = grandTotal(i);
    } else if (t.id === 'payee') {
      ui.check.payee = t.value;
    } else if (t.id === 'amount') {
      ui.check.amount = t.value;
      const a = parseFloat(t.value);
      const w = app.querySelector('[data-words]');
      if (w) w.innerHTML = Number.isFinite(a) && a > 0 ? words(a) : '&nbsp;';
    } else if (t.id === 'est-fans' || t.id === 'est-pct') {
      ui.est[t.id === 'est-fans' ? 'fans' : 'pct'] = t.value;
      const out = app.querySelector('[data-est]');
      if (out) out.textContent = estimate();
    }
  });

  app.addEventListener('change', (e) => {
    if (!e.target.matches('.price-input')) return;
    HDS.setPrice(state, e.target.dataset.item, parseFloat(e.target.value));
    save();
    render();
  });

  document.addEventListener('keydown', (e) => {
    if (ui.tool === 'calc' && !e.target.matches('input')) {
      const map = { '*': '×', '/': '÷', '-': '−', '+': '+', Enter: '=', '=': '=', Escape: 'C', Backspace: 'C' };
      const k = /^[\d.]$/.test(e.key) ? e.key : map[e.key];
      if (k) { e.preventDefault(); calcPress(k); render(); }
    }
  });

  // Hover tooltips, like the pale-yellow help boxes of the era.
  let tipTimer = null;
  app.addEventListener('mouseover', (e) => {
    const tipEl = app.querySelector('.tooltip');
    if (!tipEl) return;
    clearTimeout(tipTimer);
    const t = e.target.closest('[data-tip]');
    if (!t) { tipEl.hidden = true; return; }
    tipTimer = setTimeout(() => { tipEl.textContent = t.dataset.tip; tipEl.hidden = false; }, 350);
  });
  app.addEventListener('mousemove', (e) => {
    const tipEl = app.querySelector('.tooltip'), scene = app.querySelector('.scene');
    if (!tipEl || !scene) return;
    const r = scene.getBoundingClientRect();
    const x = Math.min(e.clientX - r.left + 16, r.width - 240);
    const y = Math.min(e.clientY - r.top + 18, r.height - 80);
    tipEl.style.left = `${x}px`;
    tipEl.style.top = `${y}px`;
  });

  // Testing aid: open index.html?debug to reach the game state from the browser console.
  if (/[?&]debug\b/.test(location.search)) window.stadiumDogs = { get state() { return state; }, ui: () => ui, render };

  render();
})();
