// Notas en cadena: cada mazmorra cuenta una de tres historias en tres notas (la primera, en el nivel de entrada; cada
// una dice dónde está la siguiente) que llevan a su prueba:
//   · La expedición de Aldric   → las estatuas (js/puzzles.js)
//   · Las páginas del ingeniero → tres palancas en la pared que hay que bajar en orden; si fallas, el suelo se llena
//                                 de pinchos; si aciertas, se abre una cámara sellada con el tesoro
//   · La deuda del mercader     → una balanza que pide oro exacto: menos, se lo traga; justo (o de más), abre la cámara
// Las tres historias rotan entre mazmorras (G.chainSeed) para que en tres seguidas salgan las tres.

const W_VAULT = 32, W_LEVER = 33; // losa de la cámara; palancas 33..35 arriba y 36..38 bajadas
const LEVER_SYMS = [
  { id: 'fuego', es: 'la llama', en: 'the flame', clue: { es: 'lo que arde', en: 'what burns' } },
  { id: 'hielo', es: 'el copo', en: 'the snowflake', clue: { es: 'lo que hiela', en: 'what freezes' } },
  { id: 'rayo', es: 'el rayo', en: 'the lightning', clue: { es: 'lo que truena', en: 'what thunders' } },
];
const CHAIN_KINDS = ['estatuas', 'palancas', 'balanza'];
const chEN = () => typeof LANG !== 'undefined' && LANG === 'en';
const lvEs = (z) => levelName(z).toLowerCase(), lvEn = (z) => levelName(z).replace('Nivel', 'level');
DECOR.balance = { h: 0.9 };
ROOM_NAME.palancas = 'sala de las palancas'; ROOM_HINT.palancas = 'Tres palancas en la pared y olor a óxido...';
ROOM_NAME.balanza = 'sala de la balanza'; ROOM_HINT.balanza = 'Una balanza de bronce espera una ofrenda...';

// ---------------------------------------------------------------- generación (desde Dungeon.build, paso 5c)
function planChain(dg) {
  const z0 = dg.start ? dg.start.z : 0;
  const kind = CHAIN_KINDS[((dg.n - 1) + ((typeof G !== 'undefined' && G.chainSeed) || 0)) % 3];
  let trial = null;
  if (kind === 'estatuas') trial = planStatues(dg, z0);
  else trial = planVaultRoom(dg, z0, kind);
  if (!trial) return;
  // tres notas: la primera en el nivel de entrada; las otras dos donde caigan (mejor en niveles distintos)
  const used = new Set([trial.r]), others = dg.zs.filter(z => z !== z0);
  const spot = (z) => { const c = []; dg.levels[z].rooms.forEach(r => { if ((r.type === 'normal' || r.type === 'entrada') && r.doors.length && !used.has(r)) c.push(r); }); return c.length ? pick(c) : null; };
  const z2 = others.length ? pick(others) : z0, z3 = others.length > 1 ? pick(others.filter(z => z !== z2)) : pick(dg.zs);
  const zs = [z0, z2, z3], rooms = [];
  for (const z of zs) { const r = spot(z) || spot(z0); if (!r) return; used.add(r); rooms.push(r); }
  const lvOf = (r) => zs[rooms.indexOf(r)];
  const texts = chainTexts(kind, trial, zs);
  rooms.forEach((r, k) => { r.note = Object.assign(texts[k], { part: k + 1, kind }); });
}
// cámara sellada junto a una sala (palancas o balanza)
function planVaultRoom(dg, z0, kind) {
  const cand = [];
  for (const z of dg.zs) dg.levels[z].rooms.forEach(r => {
    if (r.type === 'normal' && !r.stair && r.shape !== 'round' && r.w >= 5 && r.h >= 5 && r.doors.length) cand.push({ z, r });
  });
  cand.sort(() => Math.random() - 0.5).sort((a, b) => (a.z === z0) - (b.z === z0)); // mejor fuera del nivel de entrada
  for (const c of cand) {
    const lv = dg.levels[c.z], v = carveVault(lv, c.r); if (!v) continue;
    c.r.type = kind;
    if (kind === 'palancas') {
      const order = [0, 1, 2].sort(() => Math.random() - 0.5);
      c.r.puzzle = { kind, order, pulled: [], state: 0, vault: v };
      if (!placeLevers(lv, c.r)) { c.r.type = 'normal'; c.r.puzzle = null; lv.cells[v.door] = 1; continue; }
    } else {
      const n = dg.n, k = randi(2, 5), unit = Math.round(pick([20, 25, 30, 40]) * (1 + 0.5 * (n - 1)) / 5) * 5;
      c.r.puzzle = { kind, bags: k, unit, price: k * unit, state: 0, vault: v };
    }
    return { z: c.z, r: c.r };
  }
  return null;
}
// cámara de 3x3 detrás de una pared lisa de la sala, en roca virgen; la pared se vuelve una losa sellada
function carveVault(lv, r) {
  const ri = lv.rooms.indexOf(r), opts = [];
  const rock = (x, y) => x > 1 && y > 1 && x < MW - 2 && y < MH - 2 && lv.cells[y * MW + x] !== 0 && lv.roomOf[y * MW + x] < 0 && lv.cells[y * MW + x] < W_DOOR && !lv.secret.has(y * MW + x) && !inMaze(lv, x, y);
  for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
    const i = y * MW + x;
    if (!lv.plainWall(i) || lv.nearSpecial(x, y)) continue;
    for (const [dx, dy] of DIRS4) {
      if (lv.at(x - dx, y - dy) !== 0 || lv.roomOf[(y - dy) * MW + x - dx] !== ri) continue; // del suelo de la sala hacia la pared
      const px = -dy, py = dx; let ok = true;
      for (let a = 1; a <= 4 && ok; a++) for (let b = -2; b <= 2; b++) if (!rock(x + dx * a + px * b, y + dy * a + py * b)) { ok = false; break; }
      if (!ok || !rock(x + px, y + py) || !rock(x - px, y - py)) continue;
      opts.push({ x, y, dx, dy, px, py });
    }
  }
  if (!opts.length) return null;
  const o = pick(opts);
  for (let a = 1; a <= 3; a++) for (let b = -1; b <= 1; b++) { const i = (o.y + o.dy * a + o.py * b) * MW + o.x + o.dx * a + o.px * b; lv.cells[i] = 0; lv.floorTex[i] = 2; }
  const door = o.y * MW + o.x;
  lv.cells[door] = W_VAULT;
  lv.lights.push({ x: o.x + o.dx * 2 + 0.5, y: o.y + o.dy * 2 + 0.5, c: [1.3, 1.05, 0.55], rad: 3.5 });
  return { door, x: o.x + o.dx * 2 + 0.5, y: o.y + o.dy * 2 + 0.5 };
}
function placeLevers(lv, r) {
  const ri = lv.rooms.indexOf(r), cx = r.cx + 0.5, cy = r.cy + 0.5, walls = [];
  for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
    const i = y * MW + x;
    if (!lv.plainWall(i) || lv.nearSpecial(x, y)) continue;
    if (DIRS4.some(([dx, dy]) => lv.at(x + dx, y + dy) === 0 && lv.roomOf[(y + dy) * MW + x + dx] === ri)) walls.push([x, y, Math.atan2(y + 0.5 - cy, x + 0.5 - cx)]);
  }
  if (walls.length < 6) return false;
  walls.sort((a, b) => a[2] - b[2]);
  const off = randi(0, walls.length - 1), syms = [0, 1, 2].sort(() => Math.random() - 0.5);
  for (let k = 0; k < 3; k++) { const [x, y] = walls[(off + Math.floor(k * walls.length / 3)) % walls.length]; lv.cells[y * MW + x] = W_LEVER + syms[k]; }
  return true;
}

// textos de las tres notas de cada historia (frases separadas por manchas de sangre: null) y lo que apunta el diario
function chainTexts(kind, trial, zs) {
  const [, z2, z3] = zs, zT = trial.z;
  if (kind === 'estatuas') {
    const b = puzBeast(trial.broken), n3 = puzzleNote(zT, z3, trial.broken);
    return [
      { es: ['Diario de Aldric. Somos cinco y bajamos a por el tesoro del rey ciego.', null, `Dicen que lo guardan tres estatuas. Seguiré escribiendo en el ${lvEs(z2)}.`],
        en: ["Aldric's journal. There are five of us, going down for the blind king's treasure.", null, `They say three statues guard it. I will keep writing on ${lvEn(z2)}.`],
        jot: { es: `Encontré la primera página del diario de Aldric: buscaban un tesoro guardado por tres estatuas. Sigue en el ${lvEs(z2)}.`, en: `I found the first page of Aldric's journal: they were after a treasure guarded by three statues. It continues on ${lvEn(z2)}.` } },
      { es: ['Día tres. Dos de los nuestros no volvieron.', null, `Las estatuas están en el ${lvEs(zT)}. En las paredes, los murales repiten una sola criatura.`, `La última página, en el ${lvEs(z3)}.`],
        en: ['Day three. Two of us did not come back.', null, `The statues are on ${lvEn(zT)}. On the walls, the murals repeat a single creature.`, `The last page, on ${lvEn(z3)}.`],
        jot: { es: `Segunda página de Aldric: las estatuas están en el ${lvEs(zT)} y los murales repiten una criatura. La última, en el ${lvEs(z3)}.`, en: `Aldric's second page: the statues are on ${lvEn(zT)} and the murals repeat one creature. The last one, on ${lvEn(z3)}.` } },
      Object.assign(n3, { jot: { es: `Última página de Aldric: rompieron ${b.art} ${b.es} en el ${lvEs(zT)} y algo terrible los siguió.`, en: `Aldric's last page: they broke the ${b.en} on ${lvEn(zT)} and something terrible followed them.` } }),
    ];
  }
  if (kind === 'palancas') {
    const o = trial.r.puzzle.order.map(k => LEVER_SYMS[k]);
    return [
      { es: ['Páginas del ingeniero Brannoc. El rey me pidió un cierre que nadie pudiera forzar.', null, `Tres palancas: la llama, el copo y el rayo. El orden lo guardo en mis páginas; la siguiente está en el ${lvEs(z2)}.`],
        en: ['Pages of Brannoc the engineer. The king asked me for a lock no one could force.', null, `Three levers: the flame, the snowflake and the lightning. I keep the order in my pages; the next one is on ${lvEn(z2)}.`],
        jot: { es: `Encontré páginas del ingeniero Brannoc: un cierre con tres palancas (llama, copo y rayo). Sigue en el ${lvEs(z2)}.`, en: `I found pages from Brannoc the engineer: a lock with three levers (flame, snowflake and lightning). It continues on ${lvEn(z2)}.` } },
      { es: [`Primero, ${o[0].clue.es}.`, null, `Después, ${o[1].clue.es}. Si se equivoca el orden, el suelo muerde. Sigo en el ${lvEs(z3)}.`],
        en: [`First, ${o[0].clue.en}.`, null, `Then, ${o[1].clue.en}. Get the order wrong and the floor bites. I continue on ${lvEn(z3)}.`],
        jot: { es: `Brannoc: primero ${o[0].clue.es}; después ${o[1].clue.es}. Sigue en el ${lvEs(z3)}.`, en: `Brannoc: first ${o[0].clue.en}; then ${o[1].clue.en}. It continues on ${lvEn(z3)}.` } },
      { es: [`Y al final, ${o[2].clue.es}.`, null, `La cámara está en el ${lvEs(zT)}. Que nadie más baje a buscar mi oro...`],
        en: [`And at the end, ${o[2].clue.en}.`, null, `The vault is on ${lvEn(zT)}. Let no one else come down for my gold...`],
        jot: { es: `Brannoc: al final ${o[2].clue.es}. La cámara de las palancas está en el ${lvEs(zT)}.`, en: `Brannoc: at the end ${o[2].clue.en}. The lever vault is on ${lvEn(zT)}.` } },
    ];
  }
  const P = trial.r.puzzle;
  return [
    { es: ['Cuentas de la mercader Ysolde. Debo oro al guardián de la balanza.', null, `Pide la cantidad exacta: si pones menos, se lo traga todo. Mi socio apuntó la cifra; su nota está en el ${lvEs(z2)}.`],
      en: ['Ledger of Ysolde the merchant. I owe gold to the keeper of the scales.', null, `It asks for the exact amount: put in less and it swallows everything. My partner wrote the figure down; his note is on ${lvEn(z2)}.`],
      jot: { es: `Encontré las cuentas de la mercader Ysolde: una balanza pide oro exacto. La cifra sigue en el ${lvEs(z2)}.`, en: `I found the ledger of Ysolde the merchant: some scales ask for exact gold. The figure continues on ${lvEn(z2)}.` } },
    { es: [`La balanza del ${lvEs(zT)} pide ${P.bags} bolsas de oro.`, null, `Cuánto pesa cada bolsa... lo dejé escrito en el ${lvEs(z3)}.`],
      en: [`The scales on ${lvEn(zT)} ask for ${P.bags} bags of gold.`, null, `How much each bag weighs... I wrote it down on ${lvEn(z3)}.`],
      jot: { es: `El socio de Ysolde: la balanza del ${lvEs(zT)} pide ${P.bags} bolsas de oro. El peso de cada bolsa, en el ${lvEs(z3)}.`, en: `Ysolde's partner: the scales on ${lvEn(zT)} ask for ${P.bags} bags of gold. The weight of each bag, on ${lvEn(z3)}.` } },
    { es: [`Cada bolsa, ${P.unit} monedas.`, null, 'Ni una menos. Y lo que sobre, la balanza también se lo queda.'],
      en: [`Each bag, ${P.unit} coins.`, null, 'Not one less. And whatever is left over, the scales keep too.'],
      jot: { es: `Última nota de Ysolde: cada bolsa pesa ${P.unit} monedas.`, en: `Ysolde's last note: each bag weighs ${P.unit} coins.` } },
  ];
}
function chainStrike() { for (let k = 1; k <= 3; k++) strike('note' + G.dg.n + '_' + k); strike('note' + G.dg.n); strike('puzzleroom' + G.dg.n); }

// ---------------------------------------------------------------- arte
function leverSymMask(id, x, y) {
  const dx = x - 7.5, dy = y - 7.5;
  if (id === 'fuego') return labSymMask('llama', x, y);
  if (id === 'hielo') { const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), arm = Math.abs(Math.sin(3 * a)) < 0.16 + 0.5 / (r + 1); return (r < 7 && arm) || r < 1.5; }
  // rayo
  const t = (dy + 7.5) / 15, cx = t < 0.5 ? 9 - t * 6 : 3 + (t - 0.5) * 10;
  return t >= 0 && t <= 1 && Math.abs(dx + 7.5 - cx) < 1.4 + (Math.abs(t - 0.5) < 0.08 ? 3 : 0);
}
function leverTex(wall, k, down) {
  const t = wall.slice(), sym = LEVER_SYMS[k];
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) { const e = !x || !y || x === 17 || y === 17; t[(10 + y) * TS + 23 + x] = e ? rgb(52, 40, 26) : rgb(92, 70, 40); }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (leverSymMask(sym.id, x, y)) t[(11 + y) * TS + 24 + x] = sym.id === 'hielo' ? rgb(170, 220, 255, 250) : sym.id === 'rayo' ? rgb(255, 240, 120, 250) : rgb(255, 140, 60, 250);
  // base y mango (arriba o bajado)
  for (let y = 38; y < 46; y++) for (let x = 27; x < 37; x++) t[y * TS + x] = (x === 27 || x === 36 || y === 38 || y === 45) ? rgb(40, 38, 42) : rgb(86, 84, 92);
  const len = 14;
  for (let s = 0; s < len; s++) {
    const yy = down ? 42 + s : 42 - s, k2 = s === len - 1 ? 1 : 0;
    for (let w = -1; w <= 1; w++) { const xx = 32 + w; if (yy >= 0 && yy < TS) t[yy * TS + xx] = k2 ? rgb(160, 40, 30) : rgb(120 + w * 30, 112 + w * 30, 100 + w * 30); }
  }
  for (let w = -2; w <= 2; w++) for (let h = -1; h <= 1; h++) { const yy = (down ? 42 + len : 42 - len) + h; if (yy >= 0 && yy < TS) t[yy * TS + 32 + w] = rgb(170, 46, 34); }
  return t;
}
function vaultTex(wall) {
  const t = wall.slice();
  for (let y = 6; y < 62; y++) for (let x = 12; x < 52; x++) {
    const e = x === 12 || x === 51 || y === 6, n = (hash2(x, y, 91) - 0.5) * 14;
    t[y * TS + x] = e ? rgb(50, 46, 44) : rgb(112 + n, 106 + n, 98 + n);
  }
  for (let y = 22; y < 44; y++) for (let x = 22; x < 42; x++) { // sello circular con runas
    const d = Math.hypot(x - 31.5, y - 32.5);
    if (Math.abs(d - 9) < 1.1 || (d < 4 && hash2(x, y, 92) > 0.4)) t[y * TS + x] = rgb(230, 190, 90, 250);
  }
  return t;
}
function balanceSprite() {
  const w = 30, h = 32, px = new Uint32Array(w * h), g = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = c; };
  const br = (k) => rgb(176 * k, 128 * k, 60 * k);
  for (let y = 6; y < h - 3; y++) { g(14, y, br(1)); g(15, y, br(0.7)); } // poste
  for (let x = 9; x < 21; x++) for (let y = h - 3; y < h; y++) g(x, y, br(y === h - 3 ? 1.1 : 0.6)); // pie
  for (let x = 2; x < 28; x++) g(x, 6, br(1.15)); // brazo
  g(14, 4, br(1.2)); g(15, 4, br(1.2)); g(14, 5, br(1)); g(15, 5, br(1));
  for (const cx of [4, 25]) {
    for (let y = 7; y < 18; y++) { g(cx - 2 + Math.round((y - 7) * -0.15), y, br(0.8)); g(cx + 2 + Math.round((y - 7) * 0.15), y, br(0.8)); } // cadenas
    for (let x = cx - 4; x <= cx + 4; x++) { g(x, 18, br(1.1)); g(x, 19, br(0.75)); } // platillo
    for (let x = cx - 3; x <= cx + 3; x++) g(x, 20, br(0.5));
  }
  return { w, h, px, flash: px };
}
function chainArt(lv) {
  if (!SPR.balance) SPR.balance = [balanceSprite()];
  const T = lv.themeObj;
  if (T && !T.chainArt) {
    T.chainArt = true;
    T.walls[W_VAULT] = vaultTex(T.walls[4] || T.walls[1]);
    for (let k = 0; k < 3; k++) { T.walls[W_LEVER + k] = leverTex(T.walls[1], k, false); T.walls[W_LEVER + 3 + k] = leverTex(T.walls[1], k, true); }
  }
}

// ---------------------------------------------------------------- en partida
function furnishChain(lv, r) {
  if (r.type === 'balanza' && r.puzzle) { lv.addDecor('balance', r.cx + 0.5, r.cy + 0.5, false); lv.lights.push({ x: r.cx + 0.5, y: r.cy + 0.5, c: [1.15, 0.95, 0.55], rad: 4.2 }); }
  if (r.type === 'palancas') lv.lights.push({ x: r.cx + 0.5, y: r.cy + 0.5, c: [0.8, 0.75, 0.65], rad: 4 });
}
function chainRoomOfDoor(lv, i) { for (const r of lv.rooms) if (r.puzzle && r.puzzle.vault && r.puzzle.vault.door === i) return r; return null; }
function chainTouch(lv, i, v) {
  if (v === W_VAULT) { toast(chEN() ? 'A SEALED SLAB: SOME MECHANISM OPENS IT' : 'UNA LOSA SELLADA: ALGÚN MECANISMO LA ABRE', false); Sfx.play('locked'); G.touchCd = 1.2; return true; }
  if (v < W_LEVER || v >= W_LEVER + 6) return false;
  G.touchCd = 0.6;
  if (v >= W_LEVER + 3) { Sfx.play('locked'); return true; } // ya bajada
  const ri = (() => { const x = i % MW, y = (i / MW) | 0; for (const [dx, dy] of DIRS4) { const r = lv.roomOf[(y + dy) * MW + x + dx]; if (r >= 0 && lv.rooms[r].puzzle) return r; } return -1; })();
  const r = lv.rooms[ri], P = r && r.puzzle; if (!P) return true;
  if (P.state) { toast(chEN() ? 'THE LEVER IS JAMMED' : 'LA PALANCA ESTÁ ATASCADA', false); Sfx.play('locked'); return true; }
  const k = v - W_LEVER, en = chEN();
  lv.cells[i] = W_LEVER + 3 + k; Sfx.play('unlock'); G.shake = Math.max(G.shake, 0.12);
  P.pulled.push(k);
  if (P.order[P.pulled.length - 1] !== k) { // orden equivocado: pinchos por toda la sala y el mecanismo se atasca
    P.state = 2;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (lv.inRoom(r, x, y) && lv.at(x, y) === 0 && ((x + y) & 1) === 0 && !lv.spikes.some(s => s.x === x && s.y === y)) lv.spikes.push({ x, y, ph: ((x * 3 + y * 5) % 4) * 0.55 });
    const p = G.p; hurtPlayer(Math.round(p.maxHp * 0.3), p.x + 0.1, p.y + 0.1);
    Sfx.play('trap'); G.shake = Math.max(G.shake, 0.6);
    toast(en ? 'WRONG ORDER! THE FLOOR BITES' : '¡ORDEN EQUIVOCADO! EL SUELO MUERDE', true);
    logMsg(en ? 'Spikes burst out of the floor and the mechanism jams' : 'Brotan pinchos del suelo y el mecanismo se atasca', C.red);
    jot('puzzle' + G.dg.n, en ? 'I pulled the levers in the wrong order: spikes burst out and the mechanism jammed.' : 'Bajé las palancas en mal orden: brotaron pinchos y el mecanismo se atascó.');
    chainStrike(); if (typeof track === 'function') track('palancas/fallado');
    return true;
  }
  logMsg(en ? `The lever of ${LEVER_SYMS[k].en} goes down with a clunk` : `La palanca de ${LEVER_SYMS[k].es} baja con un chasquido`, C.dim);
  if (P.pulled.length === 3) {
    P.state = 1; openVault(lv, P);
    toast(en ? 'THE MECHANISM GIVES WAY: THE VAULT OPENS' : 'EL MECANISMO CEDE: LA CÁMARA SE ABRE', true);
    jot('puzzle' + G.dg.n, en ? "I pulled Brannoc's levers in the right order and opened his vault." : 'Bajé las palancas de Brannoc en el orden correcto y se abrió su cámara.');
    chainStrike(); if (typeof track === 'function') track('palancas/resuelto');
  }
  return true;
}
// abre la losa y pone el tesoro dentro (cofre con oro y un épico, o legendario al 50%)
function openVault(lv, P, gold) {
  const V = P.vault; lv.openCell(V.door);
  Sfx.play('portal'); G.flashFx = 0.6; G.shake = Math.max(G.shake, 0.35);
  burst(V.x, V.y, 0.4, 20, rgb(255, 220, 140), 2, 0.8, true, 0.05);
  const item = makeItem('vault', null, { rar: Math.random() < 0.5 ? 'legendario' : 'epico' });
  G.pickups.push({ type: 'chest', x: V.x, y: V.y, t: 0, gold: Math.round(gold || 9 * G.floor * rand(12, 18) * lootMul()), item: 'potion', eqItem: item });
}
// la balanza: se abre al acercarse (otra vez solo tras alejarse)
function chainUpdate() {
  const lv = G.lv, p = G.p; if (!lv) return;
  const ri = lv.roomOf[Math.floor(p.y) * MW + Math.floor(p.x)], r = ri >= 0 ? lv.rooms[ri] : null;
  if (!r || r.type !== 'balanza' || !r.puzzle) return;
  const d = Math.hypot(r.cx + 0.5 - p.x, r.cy + 0.5 - p.y);
  if (d > 1.7) { r.puzzle.near = false; return; }
  if (d < 1.0 && !r.puzzle.near) {
    r.puzzle.near = true;
    if (r.puzzle.state) { toast(chEN() ? 'THE SCALES NO LONGER MOVE' : 'LA BALANZA YA NO SE MUEVE', false); return; }
    const P = r.puzzle, base = P.price, opts = [base, Math.round(base * 0.7 / 5) * 5, Math.round(base * 1.3 / 5) * 5, Math.round(base * 1.8 / 5) * 5];
    G.balance = { r, opts: [...new Set(opts)].sort((a, b) => a - b) };
    G.state = 'balance'; mouse.fire = false; if (document.exitPointerLock) document.exitPointerLock();
  }
}
function balanceChoose(i) {
  const B = G.balance; if (!B) return;
  if (i >= B.opts.length) { closeBalance(); return; }
  const amt = B.opts[i], P = B.r.puzzle, en = chEN();
  if (G.loot < amt) { toast(en ? 'YOU DO NOT HAVE ENOUGH GOLD' : 'NO TE ALCANZA EL ORO', false); Sfx.play('locked'); return; }
  G.loot -= amt; closeBalance(); Sfx.play('coin');
  if (amt < P.price) {
    P.state = 2; Sfx.play('locked'); G.shake = Math.max(G.shake, 0.3);
    toast(en ? 'THE SCALES SWALLOW YOUR GOLD' : 'LA BALANZA SE TRAGA TU ORO', true);
    logMsg(en ? `Too little: ${amt} gold lost and the scales lock up` : `Demasiado poco: pierdes ${amt} de oro y la balanza se bloquea`, C.red);
    jot('puzzle' + G.dg.n, en ? `I put ${amt} gold on the scales. It was not enough: it swallowed everything.` : `Puse ${amt} de oro en la balanza. No era bastante: se lo tragó todo.`);
    chainStrike(); if (typeof track === 'function') track('balanza/fallado');
    return;
  }
  P.state = 1; openVault(G.lv, P, Math.round(P.price * 2.5));
  toast(amt === P.price ? (en ? 'THE SCALES BALANCE: THE VAULT OPENS' : 'LA BALANZA SE EQUILIBRA: LA CÁMARA SE ABRE') : (en ? 'IT TIPS TOO FAR: THE EXCESS IS LOST' : 'SE INCLINA DE MÁS: EL EXCESO SE PIERDE'), true);
  jot('puzzle' + G.dg.n, en ? `I paid ${amt} gold to the scales and the vault opened.` : `Pagué ${amt} de oro a la balanza y se abrió la cámara.`);
  chainStrike(); if (typeof track === 'function') track('balanza/resuelto');
}
function closeBalance() { G.balance = null; G.state = 'play'; G.touchCd = 0.4; lockMouse(); }
