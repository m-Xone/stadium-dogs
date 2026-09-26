// Every pre-recorded voice line. The game plays audio/<id>.m4a; tools/record_voice.py records them with Chatterbox.
// `text` is what the speech bubble shows; `spoken` (if present) is what gets recorded, spelled for the voice.
// `voice` names a reference sample in tools/voice-refs/ (made from the Kokoro voice of that name by make_voice_refs.py).
(function (root) {
  'use strict';

  const HDS = root.HDS || require('./sim.js');
  const BUNSLEY = 'am_puck';
  const LINES = {};
  const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

  // Rewrite text the way a person would say it: "$139.27" -> "139 dollars and 27 cents", "4pm" -> "four in the
  // afternoon". Speech engines otherwise read "$40" as "dollar forty" and stumble over "P.M.".
  const HOURS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
  function speakable(text) {
    return text
      .replace(/\b(an?) \$(\d+(?:,\d{3})*)\b(?!\.\d)/g, '$1 $2-dollar')   // "a $15 fee" -> "a 15-dollar fee"
      .replace(/\$(\d+(?:,\d{3})*)(?:\.(\d{2}))?/g, (_, d, c) => {
        const dollars = `${d} dollar${d === '1' ? '' : 's'}`;
        return c && c !== '00' ? `${dollars} and ${Number(c)} cent${c === '01' ? '' : 's'}` : dollars;
      })
      .replace(/\b(\d{1,2})\s*(am|pm)\b/gi, (_, h, ap) => {
        const hour = Number(h) % 12;
        const part = ap.toLowerCase() === 'am' ? 'in the morning' : hour < 5 ? 'in the afternoon' : hour < 9 ? 'in the evening' : 'at night';
        return `${HOURS[hour]} ${part}`;
      });
  }

  const add = (id, text, voice = BUNSLEY, spoken) => {
    const said = spoken || speakable(text);
    LINES[id] = said === text ? { text, voice } : { text, voice, spoken: said };
  };

  // ---------- Bunsley's guide lines ----------
  add('guide-desk', 'Click on things on your desk: the computer, phone, calendar, to-do list, checkbook or journal.');
  add('guide-board', 'The bulletin board has news from the arena, seating capacity, a tip, and your inventory.');
  add('guide-suppliers', 'Each supplier has different prices, and they change every day. Compare them, fill in how many you want, and send the order. Then pay with a check!');
  add('guide-checkbook', "Write a check for each bill. Fill in the supplier's name and the exact amount, then sign it.");
  add('guide-sign', 'Set your prices. Fans compare your prices with the other stands.');
  add('guide-stand', 'This is your stand. Point at your supplies to count them. When you are ready, flip the sign to OPEN!',
    BUNSLEY, 'This is your stand. Point at your supplies to count them. When you are ready, flip the sign to open!');
  add('guide-phone', 'Dial a number from the list, or click a name to call.');
  add('guide-calendar', 'The calendar shows every event this month.');
  add('guide-todo', 'Here is your list of things to do before each event.');
  add('guide-computer', 'Your computer has the Franchise Report, the Estimator, and a Calculator.');
  add('guide-journal', 'Your journal keeps the results of every event.');

  // The morning greeting is stitched from a date clip and an event clip.
  for (let d = 1; d <= HDS.CONFIG.daysInMonth; d++) add(`day-${d}`, `Today is the ${ordinal(d)}.`);
  for (const [key, t] of Object.entries(HDS.EVENT_TYPES)) {
    const what = key === 'circus' ? 'a circus' : key === 'concert' ? 'a concert' : `a ${t.name.toLowerCase()} game`;
    add(`event-${key}`, `There's ${what} at ${t.time}! Look at the to-do list on your desk to get ready.`);
  }

  add('forecast-intro', "Here's today's forecast.");
  for (const [key, w] of Object.entries(HDS.WEATHER)) {
    add(`weather-${key}`, `${w.label}, with a temperature around ${w.temp} degrees.`);
  }

  add('ring-office', 'Ring, ring! The phone on your desk is ringing. Click the desk to answer it.');
  add('ring-desk', 'The phone is ringing! Click the phone to answer it.');
  add('ring-stand', 'Wait! The phone is ringing back at the office. Better answer it first.');

  HDS.SUPPLIERS.forEach((s, i) => add(`order-${i}`, `Order sent to ${s}! Now write them a check. They deliver as soon as they're paid.`));
  add('check-sent', 'Your check is on its way! Your supplies are being delivered to the stand.');
  add('oops', "Hold on! That's not quite right. Check my note.");
  add('warn-unpaid', "You haven't paid all your suppliers! Unpaid orders won't be delivered. Flip the sign again to open anyway.");
  add('warn-empty', "Your stand is empty! You'll still have to pay rent. Flip the sign again to open anyway.");
  add('open', "We're open! Here come the fans!");
  for (const [key, m] of Object.entries(HDS.MENU)) add(`out-${key}`, `Oh no! We're out of ${m.name.toLowerCase()}!`);
  add('wrap-profit', "That's a wrap! Good job, we made a profit today.");
  add('wrap-loss', "That's a wrap. We lost money today. Let's read the journal and see what happened.");
  add('season-over', "The season is over! Let's see how you did.");

  // ---------- phone callers, each with their own voice ----------
  const CALLER_VOICE = {
    grill: 'am_fenrir', mice: 'am_michael', ad: 'bf_emma', bunsale: 'af_bella',
    fee: 'bm_george', pricewar: 'af_heart', freezer: 'am_michael', boosters: 'af_nicole',
  };
  for (const p of HDS.PROBLEMS) {
    add(`problem-${p.id}`, p.text, CALLER_VOICE[p.id]);
    add(`bye-${p.id}`, 'Okay, thanks! Bye!', CALLER_VOICE[p.id]);
  }
  const C = HDS.CONFIG;
  add('call-helpers', `Helping Hands! How many helpers do you want at your stand? Each one costs $${C.helperWage} per event, and helps you serve ${C.helperCapacity} more customers.`, 'af_sarah');
  add('hired-0', 'No helpers? Okay. Call us anytime!', 'af_sarah');
  add('hired-1', 'You got it! 1 helper will work at your stand for every event until you call us again.', 'af_sarah',
    'You got it! One helper will work at your stand for every event until you call us again.');
  add('hired-2', 'You got it! 2 helpers will work at your stand for every event until you call us again.', 'af_sarah',
    'You got it! Two helpers will work at your stand for every event until you call us again.');
  add('call-arena', "Arena office! Here are the numbers for today's event.", 'bm_george');
  add('call-bank', "First City Bank! Here's your account information.", 'bm_fable');
  add('call-joe', "Joe's Grill Repair! Your grill's running fine? Great. Call me if anything breaks!", 'am_fenrir');
  const WRONG = [
    ["Pizza Palace! Sorry, we don't sell hot dogs. Only pizza. Lots of pizza.", 'am_michael'],
    ['Hello? Grandma? ...Oh. Wrong number! Sorry!', 'af_kore'],
    ['Moo. (You have reached the answering machine at Happy Cow Dairy Farm.)', 'bm_george',
      'Moooo. You have reached the answering machine at Happy Cow Dairy Farm.'],
    ["You've reached the Time Lady. At the tone, the time will be... snack time.", 'af_aoede'],
    ["Hi, this is Carla's Car Wash. We're busy scrubbing right now. Call back later!", 'af_nova'],
  ];
  WRONG.forEach(([text, voice, spoken], i) => add(`wrong-${i}`, text, voice, spoken));
  const WRONG_COUNT = WRONG.length;

  // How much emotion each line is recorded with (Chatterbox "exaggeration": 0.25 flat ... 1.0 very animated).
  // The first matching pattern wins; everything else gets 0.55.
  const EMOTION = [
    [/^open$/, 1.0],
    [/^out-|^ring-|^problem-pricewar$/, 0.85],
    [/^event-|^problem-(ad|bunsale)$|^wrong-0$/, 0.8],
    [/^wrap-profit$|^season-over$|^check-sent$|^warn-|^problem-boosters$|^wrong-|^call-joe$/, 0.7],
    [/^order-|^hired-|^call-helpers$|^problem-(mice|freezer)$|^oops$/, 0.65],
    [/^wrap-loss$/, 0.45],
    [/^problem-fee$|^call-(arena|bank)$|^weather-/, 0.45],
  ];
  for (const [id, line] of Object.entries(LINES)) {
    const hit = EMOTION.find(([re]) => re.test(id));
    line.emotion = hit ? hit[1] : 0.55;
  }

  const VOICE = { LINES, WRONG_COUNT, BUNSLEY, speakable };
  if (typeof module !== 'undefined' && module.exports) module.exports = VOICE;
  else root.VOICE = VOICE;
})(typeof window !== 'undefined' ? window : globalThis);
