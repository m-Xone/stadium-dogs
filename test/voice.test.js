// Checks that every voice line the game can ask for has an up-to-date recording in audio/.
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const HDS = require('../js/sim.js');
const { LINES, WRONG_COUNT } = require('../js/voice-lines.js');

const AUDIO = path.join(__dirname, '..', 'audio');

test('every line has a recording made from its current text, voice and emotion', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(AUDIO, 'manifest.json'), 'utf8'));
  const refs = path.join(__dirname, '..', 'tools', 'voice-refs');
  const stale = [];
  for (const [id, line] of Object.entries(LINES)) {
    const rec = manifest[id];
    const exists = fs.existsSync(path.join(AUDIO, `${id}.m4a`));
    const ref = path.join(refs, `${line.voice}.wav`);
    const refHash = fs.existsSync(ref) ? crypto.createHash('sha1').update(fs.readFileSync(ref)).digest('hex').slice(0, 12) : null;
    if (!exists || !rec || rec.engine !== 'chatterbox' || rec.spoken !== (line.spoken || line.text) || rec.voice !== line.voice
      || rec.emotion !== line.emotion || rec.ref !== refHash || !rec.accent) stale.push(id);  // accent: passed the accent check
  }
  assert.deepStrictEqual(stale, [], 'Re-record with tools/record_voice.py');
});

test('clip ids built at runtime all exist', () => {
  const ids = [
    ...Array.from({ length: HDS.CONFIG.daysInMonth }, (_, i) => `day-${i + 1}`),
    ...HDS.EVENT_ORDER.map((k) => `event-${k}`),
    ...HDS.WEATHER_ORDER.map((k) => `weather-${k}`),
    ...Object.keys(HDS.MENU).map((k) => `out-${k}`),
    ...HDS.SUPPLIERS.map((_, i) => `order-${i}`),
    ...HDS.PROBLEMS.flatMap((p) => [`problem-${p.id}`, `bye-${p.id}`]),
    ...[0, 1, 2].map((n) => `hired-${n}`),
    ...Array.from({ length: WRONG_COUNT }, (_, i) => `wrong-${i}`),
    ...['desk', 'board', 'suppliers', 'checkbook', 'sign', 'stand', 'phone', 'calendar', 'todo', 'computer', 'journal'].map((v) => `guide-${v}`),
  ];
  assert.deepStrictEqual(ids.filter((id) => !LINES[id]), []);
});
