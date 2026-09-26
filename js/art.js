// Scene artwork, drawn as SVG strings. Every scene uses a 1200 x 750 view box.
// Clickable objects are wrapped in <g class="hot" data-go="..."> so the UI can wire them up.
(function (root) {
  'use strict';

  const W = 1200, H = 750;

  // ---------- small helpers ----------

  function star(cx, cy, r1, r2, n, rot = 0) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1;
      const a = rot + (i * Math.PI) / n;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(' ');
  }

  function zigzag(x1, x2, y, amp, step) {
    const pts = [];
    for (let x = x1, i = 0; x <= x2; x += step, i++) pts.push(`${x},${y + (i % 2 ? amp : -amp)}`);
    return pts.join(' ');
  }

  const hot = (id, tip, body) => `<g class="hot" data-go="${id}" data-tip="${tip}">${body}</g>`;

  // A pseudo-random but stable number for decoration, so scenes don't flicker between renders.
  const jitter = (i, salt = 1) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };

  function bunSmall(cx, cy) {
    return `<ellipse cx="${cx}" cy="${cy}" rx="30" ry="11" fill="#c9843f"/>
      <ellipse cx="${cx}" cy="${cy - 3}" rx="26" ry="6" fill="#e9ad6c"/>
      <polyline points="${zigzag(cx - 22, cx + 22, cy - 2, 2.5, 4)}" stroke="#f2cf2a" stroke-width="2.5" fill="none"/>`;
  }

  // ---------- shared definitions ----------

  function defs() {
    return `<defs>
      <pattern id="wallpaper" width="160" height="160" patternUnits="userSpaceOnUse">
        <rect width="160" height="160" fill="#4d7f6c"/>
        <polygon points="${star(30, 40, 17, 5, 8)}" fill="#c8323c"/>
        <polygon points="${star(115, 30, 12, 4, 6, 0.3)}" fill="#e8c43a"/>
        <polygon points="${star(85, 108, 19, 6, 9, 0.2)}" fill="#c8323c"/>
        <polygon points="${star(142, 132, 9, 3, 6)}" fill="#e8c43a"/>
        <polygon points="${star(24, 132, 10, 3, 7, 0.5)}" fill="#e8c43a"/>
        <circle cx="62" cy="68" r="2.5" fill="#e8c43a"/><circle cx="130" cy="80" r="2" fill="#c8323c"/>
        <circle cx="50" cy="150" r="2" fill="#c8323c"/><circle cx="150" cy="10" r="2.5" fill="#e8c43a"/>
      </pattern>
      <radialGradient id="vignette" cx=".5" cy=".4" r=".85">
        <stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/>
      </radialGradient>
      <pattern id="carpet" width="150" height="70" patternUnits="userSpaceOnUse">
        <rect width="150" height="70" fill="#6d1422"/>${bunSmall(40, 22)}${bunSmall(115, 57)}
      </pattern>
      <pattern id="wood" width="600" height="44" patternUnits="userSpaceOnUse">
        <rect width="600" height="44" fill="#bd7b3f"/>
        <path d="M0 8 Q150 1 300 10 T600 8" stroke="#94561f" stroke-width="3" fill="none" opacity=".55"/>
        <path d="M0 22 Q200 29 380 20 T600 23" stroke="#dc9e5e" stroke-width="2" fill="none" opacity=".7"/>
        <path d="M0 35 Q120 31 260 37 T600 34" stroke="#874b1c" stroke-width="2" fill="none" opacity=".45"/>
      </pattern>
      <pattern id="cork" width="14" height="14" patternUnits="userSpaceOnUse">
        <rect width="14" height="14" fill="#b87a44"/><circle cx="3" cy="4" r="1.3" fill="#8a552a"/>
        <circle cx="10" cy="10" r="1.1" fill="#d69c62"/><circle cx="11" cy="3" r=".8" fill="#6f4020"/>
      </pattern>
      <pattern id="granite" width="44" height="44" patternUnits="userSpaceOnUse">
        <rect width="44" height="44" fill="#5d948d"/>
        <circle cx="5" cy="7" r="2" fill="#3f6f69"/><circle cx="22" cy="18" r="1.5" fill="#9cc7c0"/>
        <circle cx="35" cy="6" r="2.5" fill="#2f5752"/><circle cx="12" cy="34" r="1.8" fill="#b9dcd6"/>
        <circle cx="38" cy="30" r="1.4" fill="#3f6f69"/><circle cx="27" cy="40" r="2.2" fill="#7fb0a9"/>
      </pattern>
      <pattern id="checker" width="120" height="120" patternUnits="userSpaceOnUse">
        <rect width="120" height="120" fill="#efefef"/><rect width="60" height="60" fill="#1d1d1d"/><rect x="60" y="60" width="60" height="60" fill="#1d1d1d"/>
      </pattern>
      <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fbfbfb"/><stop offset=".5" stop-color="#c4c4c4"/><stop offset="1" stop-color="#8b8b8b"/>
      </linearGradient>
      <linearGradient id="beige" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f1ecdd"/><stop offset="1" stop-color="#c9c1a8"/>
      </linearGradient>
      <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#bff0ff"/><stop offset="1" stop-color="#6cc4dc"/>
      </linearGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fbe7a1"/><stop offset=".45" stop-color="#d7ab4a"/><stop offset="1" stop-color="#8f6a1e"/>
      </linearGradient>
      <linearGradient id="frank" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#9c2f1a"/><stop offset=".35" stop-color="#d9553a"/><stop offset="1" stop-color="#8a2614"/>
      </linearGradient>
      <linearGradient id="bun" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f3c17f"/><stop offset="1" stop-color="#b8702f"/>
      </linearGradient>
      <linearGradient id="tvBody" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#f4c054"/><stop offset="1" stop-color="#c47f16"/>
      </linearGradient>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1c2e6b"/><stop offset="1" stop-color="#6f86c9"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="150%" height="150%">
        <feDropShadow dx="6" dy="9" stdDeviation="6" flood-color="#000" flood-opacity=".38"/>
      </filter>
      <filter id="blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.5"/></filter>
    </defs>`;
  }

  const svg = (body, extra = '') => `<svg class="scene-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" ${extra}>${defs()}${body}</svg>`;

  // ---------- characters ----------

  // Bunsley, the guide: a frank in a bun with a paper cap and a bow tie.
  function mascot(x, y, s = 1, pose = 'point') {
    const leftArm = pose === 'point'
      ? `<path d="M-34 -112 Q-80 -118 -118 -150" stroke="#7a3a1a" stroke-width="8" fill="none" stroke-linecap="round"/>
         <g transform="translate(-122 -154) rotate(-35)"><rect x="-26" y="-5" width="24" height="10" rx="5" fill="#fff" stroke="#333" stroke-width="2.5"/>
         <circle r="13" fill="#fff" stroke="#333" stroke-width="2.5"/></g>`
      : `<path d="M-34 -112 Q-80 -90 -96 -40" stroke="#7a3a1a" stroke-width="8" fill="none" stroke-linecap="round"/>
         <circle cx="-96" cy="-36" r="13" fill="#fff" stroke="#333" stroke-width="2.5"/>`;
    return `<g class="mascot" transform="translate(${x} ${y}) scale(${s})">
      <g class="mascot-bob">
        ${leftArm}
        <path d="M34 -104 Q76 -70 70 -26" stroke="#7a3a1a" stroke-width="8" fill="none" stroke-linecap="round"/>
        <circle cx="70" cy="-22" r="13" fill="#fff" stroke="#333" stroke-width="2.5"/>
        <rect x="-40" y="-236" width="80" height="262" rx="40" fill="url(#frank)" stroke="#5a1a0c" stroke-width="3"/>
        <polyline points="${zigzag(-30, 30, -96, 6, 10)}" stroke="#f2cf2a" stroke-width="7" fill="none" stroke-linecap="round"/>
        <path d="M-44 -228 L-36 -272 L36 -272 L44 -228 Z" fill="#fff" stroke="#bbb" stroke-width="2"/>
        <rect x="-46" y="-234" width="92" height="12" rx="3" fill="#d6333a"/>
        <ellipse cx="-16" cy="-196" rx="14" ry="18" fill="#fff" stroke="#222" stroke-width="3"/>
        <ellipse cx="16" cy="-196" rx="14" ry="18" fill="#fff" stroke="#222" stroke-width="3"/>
        <circle class="pupil" cx="-12" cy="-192" r="6.5" fill="#222"/><circle class="pupil" cx="20" cy="-192" r="6.5" fill="#222"/>
        <path d="M-30 -220 Q-16 -228 -4 -220" stroke="#3a0d05" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path d="M4 -220 Q16 -228 30 -220" stroke="#3a0d05" stroke-width="4" fill="none" stroke-linecap="round"/>
        <path class="mouth" d="M-22 -166 Q0 -140 22 -166 Z" fill="#5a1010" stroke="#222" stroke-width="3" stroke-linejoin="round"/>
        <path d="M0 -130 L-22 -142 L-22 -118 Z M0 -130 L22 -142 L22 -118 Z" fill="#2f63c9" stroke="#1b3c80" stroke-width="2"/>
        <circle cx="0" cy="-130" r="6" fill="#1b3c80"/>
        <path d="M-78 -46 Q-88 58 0 70 Q88 58 78 -46 Q44 14 0 16 Q-44 14 -78 -46 Z" fill="url(#bun)" stroke="#8a4f1c" stroke-width="3"/>
      </g>
    </g>`;
  }

  const SKIN = ['#f1c27d', '#c68642', '#8d5524', '#ffdbac', '#e0ac69', '#a86b3c'];
  const HAIR = ['#2b1a10', '#e8c35a', '#7b3f14', '#111', '#b84a1b', '#8e44ad', '#555'];
  const SHIRT = ['#d63031', '#0984e3', '#00b894', '#fdcb6e', '#6c5ce7', '#e17055', '#2d3436', '#e84393'];

  function fan(x, y, s, i) {
    const skin = SKIN[Math.floor(jitter(i, 2) * SKIN.length)];
    const hair = HAIR[Math.floor(jitter(i, 3) * HAIR.length)];
    const shirt = SHIRT[Math.floor(jitter(i, 4) * SHIRT.length)];
    const cap = jitter(i, 5) < 0.3;
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M-55 120 Q-55 40 0 40 Q55 40 55 120 Z" fill="${shirt}"/>
      <ellipse cx="0" cy="0" rx="34" ry="40" fill="${skin}"/>
      ${cap ? `<path d="M-36 -8 Q-34 -46 0 -46 Q34 -46 36 -8 Z" fill="${shirt}"/><rect x="-4" y="-14" width="52" height="9" rx="4" fill="${shirt}"/>`
            : `<path d="M-36 -2 Q-40 -48 0 -46 Q40 -48 36 -2 Q20 -26 0 -24 Q-20 -26 -36 -2 Z" fill="${hair}"/>`}
    </g>`;
  }

  // ---------- weather ----------

  function cloud(fill, stroke) {
    return `<g fill="${fill}" stroke="${stroke}" stroke-width="3">
      <circle cx="-30" cy="6" r="24"/><circle cx="4" cy="-10" r="32"/><circle cx="36" cy="6" r="22"/>
      <rect x="-54" y="4" width="112" height="28" rx="14" stroke="none"/></g>`;
  }
  function sun(r = 34) {
    const rays = Array.from({ length: 10 }, (_, i) => {
      const a = (i * Math.PI) / 5;
      return `<line x1="${(r + 8) * Math.cos(a)}" y1="${(r + 8) * Math.sin(a)}" x2="${(r + 24) * Math.cos(a)}" y2="${(r + 24) * Math.sin(a)}"/>`;
    }).join('');
    return `<g stroke="#f59e0b" stroke-width="6" stroke-linecap="round">${rays}</g><circle r="${r}" fill="#ffd23f" stroke="#f59e0b" stroke-width="4"/>`;
  }
  function weatherIcon(key, x, y, s = 1) {
    const art = {
      hot: sun(40),
      warm: `<g transform="translate(-18 -16)">${sun(30)}</g><g transform="translate(20 14)">${cloud('#fff', '#9fb3c8')}</g>`,
      cool: `<g transform="translate(-22 -14) scale(.8)">${cloud('#cfd8e3', '#8595a8')}</g><g transform="translate(14 12)">${cloud('#e9eef4', '#8595a8')}</g>`,
      cold: `${cloud('#dfe8f2', '#7a8ea6')}
        <g stroke="#5aa0e6" stroke-width="4" stroke-linecap="round">
          <path d="M-60 60 Q-20 48 20 60 T90 58" fill="none"/><path d="M-40 80 Q0 70 40 80 T100 78" fill="none"/></g>
        <text x="-30" y="72" font-size="28" fill="#fff" stroke="#5aa0e6" stroke-width="1">❄</text>`,
      rain: `<g stroke="#4a9be0" stroke-width="4" stroke-linecap="round">
          <line x1="-30" y1="40" x2="-40" y2="64"/><line x1="0" y1="42" x2="-10" y2="66"/><line x1="30" y1="40" x2="20" y2="64"/></g>
        <polygon points="6,20 -14,58 4,58 -8,90 26,46 8,46 20,20" fill="#ffd23f" stroke="#c98a00" stroke-width="2"/>
        ${cloud('#8793a6', '#4d5566')}`,
    }[key];
    return `<g transform="translate(${x} ${y}) scale(${s})">${art}</g>`;
  }

  // ---------- office (the main room) ----------

  function office(o) {
    const ringing = o.ringing ? `<g class="ring-badge" transform="translate(470 395)"><polygon points="${star(0, 0, 44, 26, 10)}" fill="#ffe14d" stroke="#c53030" stroke-width="3"/>
      <text y="7" text-anchor="middle" font-size="20" font-weight="bold" fill="#c53030">RING!</text></g>` : '';
    return svg(`
      <rect width="${W}" height="560" fill="url(#wallpaper)"/>
      <rect width="${W}" height="560" fill="url(#vignette)"/>
      <rect y="546" width="${W}" height="18" fill="#2f4d40"/>
      <rect y="562" width="${W}" height="188" fill="url(#carpet)"/>
      <rect y="562" width="${W}" height="188" fill="#000" opacity=".15"/>

      <!-- framed first dollar -->
      <g filter="url(#shadow)">
        <line x1="195" y1="40" x2="140" y2="96" stroke="#222" stroke-width="2"/><line x1="195" y1="40" x2="250" y2="96" stroke="#222" stroke-width="2"/>
        <rect x="110" y="94" width="170" height="120" rx="6" fill="#2d2d2d"/>
        <rect x="124" y="108" width="142" height="92" fill="#f6f1de"/>
        <rect x="140" y="124" width="110" height="50" rx="4" fill="#9fcf8f" stroke="#4d7a42" stroke-width="2"/>
        <circle cx="195" cy="149" r="15" fill="#c9e6bd" stroke="#4d7a42" stroke-width="2"/>
        <text x="195" y="155" text-anchor="middle" font-size="18" font-weight="bold" fill="#4d7a42">$1</text>
        <text x="195" y="192" text-anchor="middle" font-size="11" font-family="Georgia, serif" fill="#333">Our First Dollar!</text>
      </g>

      <!-- stadium pennant -->
      <g filter="url(#shadow)">
        <polygon points="760,90 940,125 760,160" fill="#d6333a"/><rect x="752" y="84" width="12" height="82" rx="3" fill="#f2f2f2"/>
        <text x="818" y="132" font-size="24" font-weight="bold" fill="#fff" font-family="Impact, sans-serif" letter-spacing="2">GO TEAM</text>
      </g>

      ${hot('board', 'The bulletin board: arena news, seating, tips and your inventory.', `
        <g filter="url(#shadow)">
          <rect x="360" y="66" width="360" height="256" rx="8" fill="#7a4a22"/>
          <rect x="374" y="80" width="332" height="228" fill="url(#cork)"/>
          <rect x="390" y="96" width="112" height="140" fill="#fff" transform="rotate(-2 446 166)"/>
          <text x="446" y="116" font-size="11" font-weight="bold" text-anchor="middle" transform="rotate(-2 446 166)">ARENA NEWS</text>
          ${[132, 144, 156, 168, 180, 192, 204].map((y) => `<line x1="400" y1="${y}" x2="${490 - jitter(y) * 20}" y2="${y}" stroke="#555" stroke-width="3" transform="rotate(-2 446 166)"/>`).join('')}
          <rect x="516" y="92" width="76" height="104" fill="#f7f7f7"/>
          <text x="554" y="110" font-size="10" font-weight="bold" text-anchor="middle">SEATS</text>
          ${[124, 136, 148, 160, 172].map((y) => `<line x1="524" y1="${y}" x2="584" y2="${y}" stroke="#666" stroke-width="2.5"/>`).join('')}
          <rect x="520" y="210" width="72" height="72" fill="#ffe56b" transform="rotate(4 556 246)"/>
          <text x="556" y="234" font-size="13" font-weight="bold" text-anchor="middle" transform="rotate(4 556 246)">TIP!</text>
          ${[248, 260].map((y) => `<line x1="530" y1="${y}" x2="582" y2="${y}" stroke="#7a6a10" stroke-width="2.5" transform="rotate(4 556 246)"/>`).join('')}
          <rect x="606" y="92" width="88" height="200" fill="#fff"/>
          <text x="650" y="110" font-size="10" font-weight="bold" text-anchor="middle">INVENTORY</text>
          ${[128, 150, 172, 194, 216, 238].map((y) => `<line x1="612" y1="${y}" x2="660" y2="${y}" stroke="#666" stroke-width="2.5"/><rect x="668" y="${y - 8}" width="18" height="12" fill="none" stroke="#333" stroke-width="1.5"/>`).join('')}
          <circle cx="446" cy="98" r="6" fill="#e53e3e"/><circle cx="554" cy="94" r="6" fill="#3182ce"/>
          <circle cx="556" cy="212" r="6" fill="#38a169"/><circle cx="650" cy="94" r="6" fill="#d69e2e"/>
        </g>`)}

      ${hot('tv', 'The TV: watch the weather report.', `
        <g filter="url(#shadow)">
          <line x1="110" y1="370" x2="60" y2="270" stroke="#555" stroke-width="5"/><line x1="130" y1="370" x2="190" y2="280" stroke="#555" stroke-width="5"/>
          <circle cx="60" cy="268" r="7" fill="#888"/><circle cx="190" cy="278" r="7" fill="#888"/>
          <line x1="70" y1="530" x2="50" y2="640" stroke="#444" stroke-width="10" stroke-linecap="round"/>
          <line x1="170" y1="530" x2="190" y2="640" stroke="#444" stroke-width="10" stroke-linecap="round"/>
          <rect x="20" y="365" width="210" height="175" rx="36" fill="url(#tvBody)" stroke="#8a5a0e" stroke-width="3"/>
          <rect x="42" y="388" width="140" height="120" rx="22" fill="#1c2a33"/>
          ${weatherIcon(o.forecast || 'warm', 112, 446, 0.55)}
          <circle cx="206" cy="410" r="10" fill="#fff5d6" stroke="#8a5a0e" stroke-width="2"/><circle cx="206" cy="444" r="10" fill="#fff5d6" stroke="#8a5a0e" stroke-width="2"/>
        </g>`)}

      ${hot('desk', 'Your desk: computer, phone, calendar, checkbook and more.', `
        <g filter="url(#shadow)">
          <rect x="560" y="300" width="190" height="150" rx="12" fill="url(#beige)" stroke="#8d8570" stroke-width="3"/>
          <rect x="578" y="316" width="154" height="112" rx="6" fill="url(#screen)"/>
          <rect x="620" y="450" width="70" height="20" fill="#c9c1a8"/>
          <polygon points="300,470 830,470 860,510 270,510" fill="url(#wood)" stroke="#6f3d14" stroke-width="3"/>
          <rect x="285" y="510" width="560" height="130" fill="url(#wood)" stroke="#6f3d14" stroke-width="3"/>
          <rect x="300" y="526" width="250" height="44" rx="4" fill="#a86a33" stroke="#6f3d14" stroke-width="2"/>
          <rect x="580" y="526" width="250" height="44" rx="4" fill="#a86a33" stroke="#6f3d14" stroke-width="2"/>
          <rect x="400" y="544" width="50" height="8" rx="4" fill="#e0c060"/><rect x="680" y="544" width="50" height="8" rx="4" fill="#e0c060"/>
          <rect x="300" y="584" width="530" height="44" rx="4" fill="#a86a33" stroke="#6f3d14" stroke-width="2"/>
          <rect x="540" y="602" width="50" height="8" rx="4" fill="#e0c060"/>
          <polygon points="340,458 420,458 426,474 334,474" fill="#8c8c8c"/><rect x="430" y="444" width="70" height="32" rx="6" fill="#9a9a9a"/>
          <rect x="380" y="476" width="150" height="4" fill="#3a6ea5"/>
          <polygon points="560,478 680,478 690,494 552,494" fill="#ddd" stroke="#999"/>
        </g>`)}
      ${ringing}

      ${hot('sign', "The menu board: set today's prices.", `
        <g filter="url(#shadow)">
          <line x1="210" y1="460" x2="180" y2="712" stroke="#6f3d14" stroke-width="10" stroke-linecap="round"/>
          <line x1="370" y1="460" x2="400" y2="712" stroke="#6f3d14" stroke-width="10" stroke-linecap="round"/>
          <rect x="190" y="450" width="200" height="220" rx="8" fill="#8b5a2b"/>
          <rect x="202" y="462" width="176" height="196" fill="#233b2d"/>
          <text x="290" y="494" text-anchor="middle" font-size="22" fill="#fdf6e3" font-family="'Comic Sans MS', 'Chalkboard SE', cursive">MENU</text>
          ${o.menu.map((m, i) => `<text x="214" y="${530 + i * 32}" font-size="15" fill="#fdf6e3" font-family="'Chalkboard SE', cursive">${m.name}</text>
            <text x="366" y="${530 + i * 32}" font-size="15" fill="#ffe14d" text-anchor="end" font-family="'Chalkboard SE', cursive">${m.price}</text>`).join('')}
        </g>`)}

      ${hot('cabinet', 'The filing cabinet: supplier price lists and orders.', `
        <g filter="url(#shadow)">
          <rect x="880" y="300" width="130" height="340" rx="6" fill="url(#metal)" stroke="#6f6f6f" stroke-width="3"/>
          ${[0, 1, 2].map((i) => `<rect x="892" y="${314 + i * 106}" width="106" height="94" rx="4" fill="#cfcfcf" stroke="#7a7a7a" stroke-width="2"/>
            <rect x="925" y="${334 + i * 106}" width="40" height="10" rx="5" fill="#777"/>
            <rect x="930" y="${352 + i * 106}" width="30" height="16" fill="#fff" stroke="#888"/>`).join('')}
          <text x="945" y="364" font-size="9" text-anchor="middle">ORDERS</text>
        </g>`)}

      <!-- bookshelf -->
      <g filter="url(#shadow)">
        <rect x="1030" y="60" width="170" height="640" fill="#7a4a22"/>
        <rect x="1044" y="74" width="156" height="612" fill="#4e2c12"/>
        ${[210, 350, 490].map((y) => `<rect x="1044" y="${y}" width="156" height="14" fill="#7a4a22"/>`).join('')}
        ${[[1050, 110, '#2f63c9'], [1080, 120, '#d6333a'], [1104, 100, '#e0a030'], [1130, 116, '#38a169'], [1050, 250, '#6c5ce7'], [1078, 262, '#e17055'], [1110, 240, '#2d3436']]
          .map(([x, y, c]) => `<rect x="${x}" y="${y}" width="26" height="${(y < 200 ? 210 : 350) - y}" fill="${c}" stroke="#222" stroke-width="1.5"/>`).join('')}
        <rect x="1060" y="410" width="80" height="80" fill="#d9b27a" stroke="#8a6534" stroke-width="2"/>
        <text x="1100" y="455" text-anchor="middle" font-size="12" font-weight="bold" fill="#6b4a1e">NAPKINS</text>
        <path d="M1160 350 q-20 -60 10 -90 q10 40 -10 90 Z" fill="#3a8f3a"/><path d="M1160 350 q30 -50 20 -100 q-25 40 -20 100 Z" fill="#2f7a2f"/>
        <rect x="1144" y="330" width="36" height="22" fill="#c0643a"/>
      </g>

      ${mascot(1010, 760, 0.95)}
    `);
  }

  // ---------- desk close-up ----------

  function desk(o) {
    return svg(`
      <rect width="${W}" height="${H}" fill="url(#carpet)"/>
      <polygon points="0,110 ${W},110 ${W},${H} 0,${H}" fill="url(#wood)"/>
      <rect y="100" width="${W}" height="16" fill="#8a4f1c"/>

      ${hot('computer', 'The computer: Franchise Report, Estimator and Calculator.', `
        <g filter="url(#shadow)">
          <rect x="60" y="4" width="410" height="330" rx="22" fill="url(#beige)" stroke="#8d8570" stroke-width="4"/>
          <rect x="92" y="34" width="346" height="250" rx="10" fill="url(#screen)"/>
          ${[['#8e44ad', 'Report', 70], ['#e67e22', 'Estimate', 140], ['#27ae60', 'Calc', 210]].map(([c, l, y]) =>
            `<rect x="370" y="${y - 30}" width="40" height="32" rx="4" fill="${c}"/><text x="390" y="${y + 16}" font-size="12" text-anchor="middle" fill="#123">${l}</text>`).join('')}
          <text x="110" y="62" font-size="15" font-weight="bold" fill="#145a6e">StandOS 3.1</text>
          <polygon points="140,340 500,340 540,440 100,440" fill="#e6e0cc" stroke="#8d8570" stroke-width="3"/>
          ${Array.from({ length: 4 }, (_, r) => Array.from({ length: 12 }, (_, c) =>
            `<rect x="${150 + c * 29 - r * 4 + (r * 10) / 3}" y="${352 + r * 21}" width="24" height="16" rx="3" fill="#f7f4ea" stroke="#aaa"/>`).join('')).join('')}
          <path d="M470 330 Q520 300 570 330" stroke="#ccc" stroke-width="5" fill="none"/>
          <ellipse cx="600" cy="352" rx="36" ry="24" fill="#f4f1e6" stroke="#999" stroke-width="2"/>
        </g>`)}

      ${hot('phone', o.ringing ? 'The phone is ringing! Answer it.' : 'The phone: call people who can help you.', `
        <g class="${o.ringing ? 'ringing' : ''}" filter="url(#shadow)">
          <rect x="800" y="210" width="260" height="190" rx="18" fill="url(#metal)" stroke="#666" stroke-width="3"/>
          <rect x="818" y="226" width="54" height="160" rx="18" fill="#dcdcdc" stroke="#777" stroke-width="3"/>
          <ellipse cx="960" cy="250" rx="60" ry="18" fill="#bbb"/>
          ${Array.from({ length: 12 }, (_, i) => `<rect x="${912 + (i % 3) * 34}" y="${280 + Math.floor(i / 3) * 26}" width="28" height="20" rx="4" fill="#eee" stroke="#888"/>`).join('')}
          <rect x="1018" y="270" width="30" height="110" fill="#fff" stroke="#999"/>
        </g>
        ${o.ringing ? `<g class="ring-badge" transform="translate(1100 200)"><polygon points="${star(0, 0, 50, 30, 10)}" fill="#ffe14d" stroke="#c53030" stroke-width="3"/>
          <text y="7" text-anchor="middle" font-size="22" font-weight="bold" fill="#c53030">RING!</text></g>` : ''}`)}

      ${hot('todo', 'Your list of things to do.', `
        <g transform="rotate(-8 330 560)" filter="url(#shadow)">
          <rect x="220" y="450" width="220" height="230" fill="#fffdf4"/>
          <text x="330" y="484" font-size="22" font-family="Georgia, serif" font-weight="bold" text-anchor="middle">To Do</text>
          ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="240" y1="${510 + i * 22}" x2="${380 - jitter(i, 9) * 50}" y2="${510 + i * 22}" stroke="#555" stroke-width="3"/>
            <rect x="404" y="${500 + i * 22}" width="14" height="14" fill="${o.todoDone && o.todoDone[i] ? '#38a169' : 'none'}" stroke="#333" stroke-width="2"/>`).join('')}
        </g>`)}

      ${hot('calendar', 'The calendar: see when the events are.', `
        <g filter="url(#shadow)">
          <polygon points="470,420 930,420 960,690 440,690" fill="#6b3f1c"/>
          <polygon points="482,432 918,432 944,660 456,660" fill="#fff"/>
          ${[0, 1, 2, 3, 4, 5].map((r) => `<line x1="${482 - r * 5}" y1="${432 + r * 45.6}" x2="${918 + r * 5}" y2="${432 + r * 45.6}" stroke="#222" stroke-width="2"/>`).join('')}
          ${[1, 2, 3, 4, 5, 6].map((c) => `<line x1="${482 + c * 62.3}" y1="432" x2="${456 + c * 69.7}" y2="660" stroke="#222" stroke-width="2"/>`).join('')}
          <rect x="456" y="660" width="488" height="24" fill="#fff"/>
          <text x="700" y="678" text-anchor="middle" font-size="16" font-weight="bold" font-family="Georgia, serif">Stadium Events</text>
        </g>`)}

      ${hot('checkbook', 'The checkbook: write checks to pay your suppliers.', `
        <g transform="rotate(10 1050 560)" filter="url(#shadow)">
          <rect x="950" y="480" width="220" height="130" rx="8" fill="#1f6f5c" stroke="#114036" stroke-width="3"/>
          <rect x="962" y="492" width="196" height="106" rx="4" fill="#dff1e6"/>
          <line x1="976" y1="530" x2="1140" y2="530" stroke="#6a9" stroke-width="2"/><line x1="976" y1="556" x2="1100" y2="556" stroke="#6a9" stroke-width="2"/>
          <text x="1060" y="516" text-anchor="middle" font-size="14" font-weight="bold" fill="#114036">CHECKS</text>
        </g>`)}

      ${hot('journal', 'Your journal: results from every event.', `
        <g transform="rotate(-4 120 580)" filter="url(#shadow)">
          <rect x="30" y="470" width="170" height="220" rx="6" fill="#c0392b" stroke="#7b241c" stroke-width="3"/>
          ${Array.from({ length: 9 }, (_, i) => `<circle cx="42" cy="${490 + i * 23}" r="6" fill="none" stroke="#ccc" stroke-width="3"/>`).join('')}
          <rect x="70" y="530" width="110" height="36" fill="#f6f1de"/>
          <text x="125" y="554" text-anchor="middle" font-size="16" font-weight="bold" font-family="Georgia, serif">Journal</text>
        </g>`)}
    `);
  }

  // ---------- zoomed backgrounds ----------

  function backdrop(kind) {
    const body = {
      desk: `<rect width="${W}" height="${H}" fill="url(#wood)"/><rect width="${W}" height="${H}" fill="url(#vignette)"/>`,
      wall: `<rect width="${W}" height="${H}" fill="url(#wallpaper)"/><rect width="${W}" height="${H}" fill="#000" opacity=".25"/>`,
      cork: `<rect width="${W}" height="${H}" fill="#7a4a22"/><rect x="30" y="24" width="${W - 60}" height="${H - 48}" fill="url(#cork)"/>`,
      drawer: `<rect width="${W}" height="${H}" fill="url(#wallpaper)"/><rect width="${W}" height="${H}" fill="#000" opacity=".3"/>
        <rect x="40" y="560" width="${W - 80}" height="200" fill="url(#metal)" stroke="#555" stroke-width="4"/>
        <rect x="520" y="660" width="160" height="30" rx="8" fill="#666"/>`,
      chalk: `<rect width="${W}" height="${H}" fill="#8b5a2b"/><rect x="40" y="30" width="${W - 80}" height="${H - 60}" fill="#233b2d"/>
        <rect x="40" y="30" width="${W - 80}" height="${H - 60}" fill="url(#vignette)"/>`,
    }[kind];
    return svg(body);
  }

  // ---------- TV weather report ----------

  function tv(o) {
    return svg(`
      <rect width="${W}" height="${H}" fill="url(#wallpaper)"/><rect width="${W}" height="${H}" fill="#000" opacity=".4"/>
      <line x1="560" y1="30" x2="360" y2="-60" stroke="#666" stroke-width="12"/><line x1="640" y1="30" x2="860" y2="-60" stroke="#666" stroke-width="12"/>
      <rect x="120" y="30" width="960" height="690" rx="120" fill="url(#tvBody)" stroke="#8a5a0e" stroke-width="6" filter="url(#shadow)"/>
      <rect x="200" y="90" width="700" height="560" rx="80" fill="#10181e"/>
      <g>
        <clipPath id="tvScreen"><rect x="214" y="104" width="672" height="532" rx="70"/></clipPath>
        <g clip-path="url(#tvScreen)">
          <rect x="214" y="104" width="672" height="532" fill="#9fd8ff"/>
          <path d="M214 250 Q320 190 430 240 T650 210 T886 250 L886 636 L214 636 Z" fill="#b7e39a"/>
          <path d="M430 240 Q520 300 480 420 Q560 470 700 440 Q760 380 886 400 L886 250 Q780 200 650 210 Q540 230 430 240 Z" fill="#f5e27a"/>
          <path d="M214 420 Q330 380 420 470 Q470 560 420 636 L214 636 Z" fill="#f4a3c4"/>
          <path d="M700 440 Q760 520 740 636 L886 636 L886 400 Q780 380 700 440 Z" fill="#9ad0ec"/>
          ${weatherIcon(o.weather, 650, 250, 1.6)}
          <text x="650" y="${o.weather === 'rain' || o.weather === 'cold' ? 430 : 400}" text-anchor="middle" font-size="64" font-weight="bold" fill="#fff" stroke="#1c2a33" stroke-width="3" font-family="Impact, sans-serif">${o.temp}°</text>
          ${mascot(370, 700, 1.25, 'point')}
          <rect x="214" y="104" width="672" height="532" fill="url(#vignette)" opacity=".6"/>
        </g>
      </g>
      <circle cx="990" cy="200" r="42" fill="#fff5d6" stroke="#8a5a0e" stroke-width="4"/><line x1="990" y1="200" x2="990" y2="168" stroke="#8a5a0e" stroke-width="6"/>
      <circle cx="990" cy="320" r="42" fill="#fff5d6" stroke="#8a5a0e" stroke-width="4"/><line x1="990" y1="320" x2="1018" y2="300" stroke="#8a5a0e" stroke-width="6"/>
      ${[0, 1, 2, 3, 4].map((i) => `<rect x="950" y="${420 + i * 22}" width="80" height="10" rx="5" fill="#8a5a0e" opacity=".6"/>`).join('')}
    `);
  }

  // ---------- phone close-up ----------

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

  function phone(o) {
    return svg(`
      <rect width="${W}" height="${H}" fill="url(#wood)"/><rect width="${W}" height="${H}" fill="url(#vignette)"/>
      <g filter="url(#shadow)">
        <rect x="150" y="60" width="820" height="640" rx="50" fill="url(#metal)" stroke="#666" stroke-width="5"/>
        <rect x="180" y="${o.offHook ? 40 : 90}" width="170" height="580" rx="60" fill="#e4e4e4" stroke="#777" stroke-width="5" ${o.offHook ? 'transform="rotate(-8 265 330)"' : ''}/>
        <rect x="205" y="${o.offHook ? 70 : 120}" width="120" height="110" rx="30" fill="#ccc" ${o.offHook ? 'transform="rotate(-8 265 330)"' : ''}/>
        <rect x="205" y="${o.offHook ? 480 : 530}" width="120" height="110" rx="30" fill="#ccc" ${o.offHook ? 'transform="rotate(-8 265 330)"' : ''}/>
        <ellipse cx="560" cy="160" rx="150" ry="60" fill="#b5b5b5" stroke="#888" stroke-width="3"/>
        ${Array.from({ length: 60 }, (_, i) => { const a = (i * 2.399) % (Math.PI * 2), r = Math.sqrt(i / 60); return `<circle cx="${560 + Math.cos(a) * r * 130}" cy="${160 + Math.sin(a) * r * 48}" r="4" fill="#555"/>`; }).join('')}
        <rect x="420" y="250" width="280" height="54" rx="6" fill="#9fb58a" stroke="#555" stroke-width="3"/>
        <text x="690" y="289" text-anchor="end" font-size="34" font-family="'Courier New', monospace" fill="#223">${o.dialed || ''}</text>
        ${KEYS.map((k, i) => `<g class="key" data-dial="${k}" transform="translate(${440 + (i % 3) * 86} ${322 + Math.floor(i / 3) * 86})">
          <rect width="72" height="72" rx="12" fill="#f4f4f4" stroke="#777" stroke-width="3"/>
          <text x="36" y="50" text-anchor="middle" font-size="38" font-family="Georgia, serif" fill="#222">${k}</text></g>`).join('')}
        <rect x="750" y="240" width="190" height="420" fill="#fff" stroke="#999" stroke-width="2"/>
      </g>
    `);
  }

  // ---------- the hot dog stand ----------

  function stand(o) {
    const s = o.stock;
    const people = Math.min(9, o.crowd);
    const fans = Array.from({ length: people }, (_, i) => {
      const slot = [[600, 250, 1.3], [450, 240, 1.1], [760, 245, 1.15], [520, 190, 0.8], [690, 185, 0.8], [390, 190, 0.7], [820, 180, 0.7], [600, 160, 0.6], [470, 150, 0.55]][i];
      return fan(slot[0], slot[1], slot[2], i + o.crowdSeed);
    }).reverse().join('');
    const franks = Math.min(10, Math.ceil((s.beef + s.turkey) / 12));
    const bunPacks = Math.min(8, Math.ceil(s.buns / 12));
    const cans = Math.min(16, Math.ceil(s.cola / 12));
    const bags = Math.min(12, Math.ceil(s.chips / 10));
    const kits = s.kits > 0;
    const hourAngle = o.clockAngle || 0;
    return svg(`
      <rect width="${W}" height="${H}" fill="url(#granite)"/>
      <rect width="${W}" height="${H}" fill="url(#vignette)" opacity=".7"/>

      ${hot('window', 'The service window. Fans line up here.', `
        <rect x="330" y="20" width="540" height="330" rx="20" fill="#3b3b3b"/>
        <clipPath id="win"><rect x="346" y="36" width="508" height="298" rx="12"/></clipPath>
        <g clip-path="url(#win)">
          <rect x="346" y="36" width="508" height="298" fill="url(#sky)"/>
          <path d="M346 150 L854 120 L854 334 L346 334 Z" fill="#3c4a5e"/>
          ${Array.from({ length: 40 }, (_, i) => `<circle cx="${350 + jitter(i, 7) * 500}" cy="${135 + jitter(i, 8) * 40}" r="5" fill="${SHIRT[i % SHIRT.length]}" opacity=".6"/>`).join('')}
          <g filter="url(#blur)">${fans}</g>
          <rect x="346" y="36" width="508" height="298" fill="#bfe3ff" opacity=".12"/>
          <polygon points="360,36 440,36 346,160 346,100" fill="#fff" opacity=".18"/>
        </g>`)}

      <g filter="url(#shadow)">
        <circle cx="200" cy="80" r="62" fill="#fff" stroke="#c0392b" stroke-width="8"/>
        ${Array.from({ length: 12 }, (_, i) => { const a = (i * Math.PI) / 6 - Math.PI / 2; return `<text x="${200 + Math.cos(a) * 44}" y="${86 + Math.sin(a) * 44}" font-size="14" text-anchor="middle" fill="#c0392b" font-weight="bold">${i || 12}</text>`; }).join('')}
        <line x1="200" y1="80" x2="200" y2="48" stroke="#222" stroke-width="5" stroke-linecap="round" transform="rotate(${hourAngle} 200 80)"/>
        <line x1="200" y1="80" x2="200" y2="36" stroke="#222" stroke-width="3" stroke-linecap="round" transform="rotate(${(hourAngle * 12) % 360} 200 80)"/>
        <circle cx="200" cy="80" r="5" fill="#222"/>
      </g>

      ${hot('register', 'The cash register.', `
        <g filter="url(#shadow)">
          <path d="M40 360 L60 190 L270 190 L290 360 Z" fill="url(#gold)" stroke="#6b4c10" stroke-width="3"/>
          <rect x="70" y="140" width="190" height="56" rx="6" fill="url(#gold)" stroke="#6b4c10" stroke-width="3"/>
          <rect x="84" y="150" width="162" height="36" rx="4" fill="#1b1b1b"/>
          <text x="236" y="178" text-anchor="end" font-size="24" fill="#6dff8a" font-family="'Courier New', monospace">${o.register || '0.00'}</text>
          ${Array.from({ length: 15 }, (_, i) => `<circle cx="${92 + (i % 5) * 36}" cy="${230 + Math.floor(i / 5) * 32}" r="12" fill="#2b2b2b" stroke="#e8d08a" stroke-width="2"/>`).join('')}
          <rect x="${o.drawerOpen ? 20 : 50}" y="330" width="230" height="36" rx="4" fill="#b8913a" stroke="#6b4c10" stroke-width="3" class="drawer"/>
        </g>`)}

      ${hot('chips', `Chips: ${s.chips} bags`, `
        <rect x="396" y="60" width="10" height="310" fill="#888"/><rect x="360" y="60" width="80" height="10" fill="#888"/>
        ${Array.from({ length: bags }, (_, i) => `<g transform="translate(${372 + (i % 2) * 34} ${80 + Math.floor(i / 2) * 46})">
          <path d="M0 0 L30 0 L32 40 L-2 40 Z" fill="#f3c623" stroke="#b7791f" stroke-width="2"/>
          <rect x="4" y="12" width="22" height="12" fill="#d63031"/></g>`).join('')}`)}

      <rect x="180" y="360" width="1020" height="46" fill="url(#granite)" stroke="#2f5752" stroke-width="3"/>
      <rect x="180" y="400" width="1020" height="10" fill="#2f5752"/>

      ${hot('kits', `Condiment kits: ${s.kits}`, `
        <g filter="url(#shadow)">
          <rect x="690" y="290" width="70" height="72" rx="6" fill="url(#metal)" stroke="#666" stroke-width="2"/>
          ${kits ? '<path d="M705 290 q20 -30 40 0" fill="#fff" stroke="#ccc"/>' : ''}
          <rect x="780" y="${kits ? 262 : 300}" width="26" height="${kits ? 100 : 62}" rx="10" fill="#d63031"/><rect x="786" y="${kits ? 246 : 284}" width="14" height="20" fill="#fff"/>
          <rect x="814" y="${kits ? 262 : 300}" width="26" height="${kits ? 100 : 62}" rx="10" fill="#f2cf2a"/><rect x="820" y="${kits ? 246 : 284}" width="14" height="20" fill="#fff"/>
        </g>`)}

      ${hot('open', o.open ? 'The stand is open!' : 'Flip the sign to open the stand!', `
        <g filter="url(#shadow)" class="${o.open ? '' : 'pulse'}">
          <line x1="960" y1="190" x2="930" y2="240" stroke="#555" stroke-width="3"/><line x1="960" y1="190" x2="1090" y2="240" stroke="#555" stroke-width="3"/>
          <circle cx="960" cy="188" r="6" fill="#555"/>
          <rect x="900" y="240" width="220" height="100" rx="12" fill="${o.open ? '#2f9e44' : '#c92a2a'}" stroke="#fff" stroke-width="6"/>
          <text x="1010" y="305" text-anchor="middle" font-size="46" font-weight="bold" fill="#fff" font-family="Impact, sans-serif">${o.open ? 'OPEN' : 'CLOSED'}</text>
        </g>`)}

      ${hot('grill', `Franks: ${s.beef} hot dogs, ${s.turkey} turkey dogs`, `
        <g filter="url(#shadow)">
          <rect x="0" y="410" width="280" height="190" fill="#2b2b2b"/>
          <rect x="10" y="420" width="260" height="70" fill="#444"/>
          ${[0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="14" y1="${424 + i * 10}" x2="266" y2="${424 + i * 10}" stroke="#777" stroke-width="3"/>`).join('')}
          ${Array.from({ length: franks }, (_, i) => `<rect x="${20 + (i % 5) * 50}" y="${428 + Math.floor(i / 5) * 28}" width="44" height="16" rx="8" fill="${i % 2 ? '#c96f4a' : '#b8432a'}" stroke="#5a1a0c" stroke-width="2"/>`).join('')}
          <circle cx="60" cy="540" r="16" fill="#999"/><circle cx="130" cy="540" r="16" fill="#999"/><circle cx="200" cy="540" r="16" fill="#999"/>
        </g>`)}

      <rect x="290" y="410" width="630" height="240" fill="#3a2f2a"/>
      ${hot('buns', `Buns: ${s.buns}`, `
        <rect x="300" y="480" width="610" height="10" fill="url(#metal)"/>
        ${Array.from({ length: bunPacks }, (_, i) => `<g transform="translate(${316 + i * 74} 430)">
          <rect width="66" height="48" rx="10" fill="#e6f0f8" opacity=".55" stroke="#aac" stroke-width="2"/>
          <ellipse cx="33" cy="30" rx="26" ry="14" fill="#d9954c"/><ellipse cx="33" cy="24" rx="22" ry="8" fill="#eeb577"/></g>`).join('')}`)}
      ${hot('cola', `Colas: ${s.cola} cans`, `
        <rect x="300" y="600" width="610" height="10" fill="url(#metal)"/>
        ${Array.from({ length: cans }, (_, i) => `<g transform="translate(${310 + i * 37} 536)">
          <rect width="30" height="62" rx="5" fill="#c0392b" stroke="#7b241c" stroke-width="2"/>
          <path d="M3 30 Q15 20 27 32" stroke="#fff" stroke-width="3" fill="none"/><rect x="2" y="2" width="26" height="6" fill="#ccc"/></g>`).join('')}`)}

      <g filter="url(#shadow)">
        <rect x="940" y="420" width="240" height="280" rx="30" fill="url(#metal)" stroke="#777" stroke-width="3"/>
        <rect x="956" y="436" width="208" height="248" rx="22" fill="#f2f2f2" opacity=".7"/>
        <rect x="1128" y="520" width="14" height="70" rx="7" fill="#888"/>
        <text x="1060" y="480" text-anchor="middle" font-size="14" fill="#777" font-weight="bold">FREEZER</text>
      </g>
      <rect y="690" width="${W}" height="60" fill="url(#checker)"/>
    `);
  }

  // ---------- title ----------

  function title() {
    return svg(`
      <rect width="${W}" height="${H}" fill="url(#wallpaper)"/>
      <rect width="${W}" height="${H}" fill="url(#vignette)"/>
      <rect y="600" width="${W}" height="150" fill="url(#carpet)"/>
      ${mascot(980, 700, 1.4, 'wave')}
    `);
  }

  root.ART = { office, desk, backdrop, tv, phone, stand, title, weatherIcon, mascot, KEYS };
})(window);
