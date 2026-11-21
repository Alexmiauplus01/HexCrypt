// Pruebas con historia. Cada partida baraja un bote de 8 pruebas (G.trialDeck) y cada mazmorra coge las 2 siguientes,
// así que en 4 mazmorras salen las 8 sin repetirse. Cada prueba tiene su historia en 3 notas (pergaminos junto a
// cadáveres): la primera está en el nivel de entrada y cada una dice dónde está la siguiente y da parte de la pista.
//   · estatuas  (Aldric)  → golpear la estatua de los murales (js/puzzles.js)
//   · palancas  (Brannoc) → bajar tres palancas en el orden de las notas; si fallas, pinchos
//   · balanza   (Ysolde)  → depositar el oro exacto; si pones menos, se lo traga
//   · laberinto (Teodric) → acertijo de símbolos y puertas que cambian (js/labyrinth.js)
//   · campanas  (Mirela)  → repetir en las campanas la melodía de la caja de música; si fallas, espectros
//   · baldosas  (Oswin)   → cruzar pisando solo el símbolo de las notas; si no, pinchos y el suelo se hunde
//   · copas     (Varek)   → beber de la copa bendita; la envenenada envenena y maldice
//   · braseros  (Ilsa)    → encender con la antorcha solo los braseros que marca el mural; uno de más, la sala arde

const W_VAULT = 32, W_LEVER = 33, W_BELL = 40, W_STARS = 48; // losa; palancas 33..38; campanas 40..47; murales de estrellas 48..79
const LEVER_SYMS = [
  { id: 'fuego', es: 'la llama', en: 'the flame', clue: { es: 'lo que arde', en: 'what burns' } },
  { id: 'hielo', es: 'el copo', en: 'the snowflake', clue: { es: 'lo que hiela', en: 'what freezes' } },
  { id: 'rayo', es: 'el rayo', en: 'the lightning', clue: { es: 'lo que truena', en: 'what thunders' } },
];
const TILE_SYMS = [{ id: 'sol', es: 'el sol', en: 'the sun' }, { id: 'luna', es: 'la luna', en: 'the moon' }, { id: 'estrella', es: 'la estrella', en: 'the star' }, { id: 'calavera', es: 'la calavera', en: 'the skull' }];
const CUPS = [{ id: 'oro', es: 'la copa de oro', en: 'the gold cup', col: [230, 180, 60] }, { id: 'plata', es: 'la copa de plata', en: 'the silver cup', col: [200, 204, 214] }, { id: 'hueso', es: 'la copa de hueso', en: 'the bone cup', col: [222, 210, 180] }];
const BELL_COLS = [[236, 190, 80], [196, 200, 212], [200, 120, 70], [110, 170, 230]];
const TRIALS = ['estatuas', 'palancas', 'balanza', 'laberinto', 'campanas', 'baldosas', 'copas', 'braseros'];
const CHAIN_KINDS = TRIALS; // nombre anterior
const chEN = () => typeof LANG !== 'undefined' && LANG === 'en';
const lvEs = (z) => levelName(z).toLowerCase(), lvEn = (z) => levelName(z).replace('Nivel', 'level');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
DECOR.balance = { h: 0.9 }; DECOR.musicbox = { h: 0.42 }; DECOR.cups = { h: 0.62 }; DECOR.cupsEmpty = { h: 0.62 };
ROOM_NAME.palancas = 'sala de las palancas'; ROOM_HINT.palancas = 'Tres palancas en la pared y olor a óxido...';
ROOM_NAME.balanza = 'sala de la balanza'; ROOM_HINT.balanza = 'Una balanza de bronce espera una ofrenda...';
ROOM_NAME.campanas = 'sala de las campanas'; ROOM_HINT.campanas = 'Una caja de música y campanas en las paredes...';
ROOM_NAME.baldosas = 'sala de las losas'; ROOM_HINT.baldosas = 'Cada losa del suelo lleva un símbolo...';
ROOM_NAME.copas = 'altar de las copas'; ROOM_HINT.copas = 'Tres copas esperan sobre un altar...';
ROOM_NAME.braseros = 'sala de los braseros'; ROOM_HINT.braseros = 'Braseros apagados bajo un mural de estrellas...';

// qué dos pruebas tocan en la mazmorra n de esta partida
function trialsFor(n) {
  const D = (typeof G !== 'undefined' && Array.isArray(G.trialDeck) && G.trialDeck.length === TRIALS.length) ? G.trialDeck : TRIALS;
  const k = (3 * (n - 1)) % D.length;
  return [D[k], D[(k + 1) % D.length], D[(k + 2) % D.length]];
}
function newTrialDeck() { return TRIALS.slice().sort(() => Math.random() - 0.5); }

// ---------------------------------------------------------------- generación (desde Dungeon.build, paso 5c)
// tres pruebas en cadena: las notas del mapa llevan a la primera; al superarla aparece un pergamino con la pista de la
// segunda, y al superar esta, el de la tercera, la única con el tesoro (cofre y legendario)
function planTrials(dg) {
  const z0 = dg.start ? dg.start.z : 0, used = new Set(), done = [];
  const queue = (dg.trials || trialsFor(dg.n)).slice(), spare = TRIALS.filter(t => !queue.includes(t) && t !== 'laberinto').sort(() => Math.random() - 0.5);
  while (done.length < 3 && (queue.length || spare.length)) {
    const kind = queue.length ? queue.shift() : spare.shift();
    let trial = null;
    if (kind === 'estatuas') trial = planStatues(dg, z0);
    else if (kind === 'laberinto') { const z = dg.zs.find(z => dg.levels[z].maze); trial = z !== undefined ? { z, r: null, maze: dg.levels[z].maze } : null; }
    else if (kind === 'baldosas') trial = planTiles(dg, z0);
    else if (kind === 'copas') trial = planCups(dg, z0);
    else trial = planVaultRoom(dg, z0, kind);
    if (!trial) continue;
    if (trial.r) used.add(trial.r);
    trial.kind = kind; done.push(trial);
  }
  done.forEach((t, i) => {
    const T = t.maze || t.r.puzzle, nx = done[i + 1];
    T.step = i; T.final = !nx; T.nextNote = nx ? bundleText(nx.kind, nx) : null;
  });
  if (done.length) placeChainNotes(dg, done[0].kind, done[0], z0, used);
  dg.trials = done.map(t => t.kind);
}
// tres notas: la primera en el nivel de entrada; las otras dos donde caigan (mejor en niveles distintos)
function placeChainNotes(dg, kind, trial, z0, used) {
  const others = dg.zs.filter(z => z !== z0);
  const spot = (z) => { const c = []; dg.levels[z].rooms.forEach(r => { if ((r.type === 'normal' || r.type === 'entrada') && r.doors.length && !used.has(r) && !r.note) c.push(r); }); return c.length ? pick(c) : null; };
  const z2 = others.length ? pick(others) : z0, z3 = others.length > 1 ? pick(others.filter(z => z !== z2)) : pick(dg.zs);
  const zs = [z0, z2, z3], rooms = [];
  for (const z of zs) {
    let r = spot(z), zz = z;
    if (!r) for (const alt of dg.zs) { r = spot(alt); if (r) { zz = alt; break; } }
    if (!r) return;
    zs[rooms.length] = zz; used.add(r); rooms.push(r);
  }
  const texts = chainTexts(kind, trial, zs);
  rooms.forEach((r, k) => { r.note = Object.assign(texts[k], { part: k + 1, kind }); });
}
const roomOk = (r, w, h) => r.type === 'normal' && !r.stair && r.shape !== 'round' && r.w >= w && r.h >= h && r.doors.length;
function trialCands(dg, z0, w, h) {
  const c = [];
  for (const z of dg.zs) dg.levels[z].rooms.forEach(r => { if (roomOk(r, w, h)) c.push({ z, r }); });
  return c.sort(() => Math.random() - 0.5).sort((a, b) => (a.z === z0) - (b.z === z0)); // mejor fuera del nivel de entrada
}
// salas con cámara sellada (palancas, balanza, campanas, braseros)
function planVaultRoom(dg, z0, kind) {
  for (const c of trialCands(dg, z0, kind === 'braseros' ? 6 : 5, kind === 'braseros' ? 6 : 5)) {
    const lv = dg.levels[c.z], v = carveVault(lv, c.r); if (!v) continue;
    const undo = () => { c.r.type = 'normal'; c.r.puzzle = null; closeVault(lv, v); };
    c.r.type = kind;
    if (kind === 'palancas') {
      c.r.puzzle = { kind, order: [0, 1, 2].sort(() => Math.random() - 0.5), pulled: [], state: 0, vault: v };
      if (!placeWallSet(lv, c.r, 3, W_LEVER)) { undo(); continue; }
    } else if (kind === 'campanas') {
      const len = dg.n >= 3 ? 5 : 4, seq = [];
      for (let k = 0; k < len; k++) { let b; do b = randi(0, 3); while (k && b === seq[k - 1]); seq.push(b); }
      c.r.puzzle = { kind, seq, input: [], state: 0, vault: v };
      const cells = placeWallSet(lv, c.r, 4, W_BELL); if (!cells) { undo(); continue; }
      c.r.puzzle.bells = cells;
    } else if (kind === 'braseros') {
      const b = placeBraziers(lv, c.r, v); if (!b) { undo(); continue; }
      c.r.puzzle = Object.assign({ kind, lit: 0, state: 0, vault: v }, b);
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
  const o = pick(opts), cells = [];
  for (let a = 1; a <= 3; a++) for (let b = -1; b <= 1; b++) { const i = (o.y + o.dy * a + o.py * b) * MW + o.x + o.dx * a + o.px * b; lv.cells[i] = 0; lv.floorTex[i] = 2; cells.push(i); }
  const door = o.y * MW + o.x, prev = lv.cells[door];
  lv.cells[door] = W_VAULT;
  const L = { x: o.x + o.dx * 2 + 0.5, y: o.y + o.dy * 2 + 0.5, c: [1.3, 1.05, 0.55], rad: 3.5 };
  lv.lights.push(L);
  return { door, x: L.x, y: L.y, cells, prev };
}
function closeVault(lv, v) { for (const i of v.cells) lv.cells[i] = 1; lv.cells[v.door] = v.prev || 1; lv.lights = lv.lights.filter(l => !(l.x === v.x && l.y === v.y)); }
// paredes lisas repartidas alrededor de la sala para palancas (3) o campanas (4); devuelve sus celdas en orden de k
function placeWallSet(lv, r, n, base) {
  const ri = lv.rooms.indexOf(r), cx = r.cx + 0.5, cy = r.cy + 0.5, walls = [];
  for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
    const i = y * MW + x;
    if (!lv.plainWall(i) || lv.nearSpecial(x, y)) continue;
    if (DIRS4.some(([dx, dy]) => lv.at(x + dx, y + dy) === 0 && lv.roomOf[(y + dy) * MW + x + dx] === ri)) walls.push([x, y, Math.atan2(y + 0.5 - cy, x + 0.5 - cx)]);
  }
  if (walls.length < n * 2) return null;
  walls.sort((a, b) => a[2] - b[2]);
  const off = randi(0, walls.length - 1), syms = [...Array(n).keys()].sort(() => Math.random() - 0.5), out = [];
  for (let k = 0; k < n; k++) { const [x, y] = walls[(off + Math.floor(k * walls.length / n)) % walls.length]; lv.cells[y * MW + x] = base + syms[k]; out[syms[k]] = y * MW + x; }
  return out;
}
// braseros: un mural de estrellas en una pared y cinco braseros en fila delante, de izquierda a derecha según lo miras
function placeBraziers(lv, r, v) {
  const ri = lv.rooms.indexOf(r), inR = (x, y) => lv.at(x, y) === 0 && lv.roomOf[y * MW + x] === ri && !lv.nearSpecial(x, y);
  const opts = [];
  for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
    const i = y * MW + x;
    if (i === v.door || !lv.plainWall(i) || lv.nearSpecial(x, y)) continue;
    for (const [dx, dy] of DIRS4) { // (dx,dy): de la sala hacia el mural
      if (!inR(x - dx, y - dy)) continue;
      const rx = -dy, ry = dx; let ok = true; // derecha de quien mira el mural
      for (let k = -2; k <= 2 && ok; k++) if (!inR(x - dx * 2 + rx * k, y - dy * 2 + ry * k)) ok = false;
      if (ok) opts.push({ x, y, dx, dy, rx, ry });
    }
  }
  if (!opts.length) return null;
  const o = pick(opts);
  let mask = 0; while ([0, 1, 2, 3, 4].filter(k => mask & (1 << k)).length < randi(2, 3)) mask |= 1 << randi(0, 4);
  lv.cells[o.y * MW + o.x] = W_STARS + mask;
  const pos = []; for (let k = 0; k < 5; k++) pos.push({ x: o.x + 0.5 - o.dx * 1.6 + o.rx * (k - 2) * 0.95, y: o.y + 0.5 - o.dy * 1.6 + o.ry * (k - 2) * 0.95 });
  return { mask, mural: o.y * MW + o.x, pos };
}
// baldosas: cada losa con un símbolo; hay un camino seguro desde cada puerta hasta el cofre del centro
function planTiles(dg, z0) {
  const cand = trialCands(dg, z0, 5, 5).sort((a, b) => (a.r.doors.length > 1) - (b.r.doors.length > 1));
  for (const c of cand) {
    const lv = dg.levels[c.z], r = c.r, ri = lv.rooms.indexOf(r), safe = randi(0, 3);
    const inR = (x, y) => lv.at(x, y) === 0 && lv.roomOf[y * MW + x] === ri;
    const sym = new Int8Array(MW * MH).fill(-1);
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inR(x, y)) sym[y * MW + x] = Math.random() < 0.18 ? safe : pick([0, 1, 2, 3].filter(s => s !== safe));
    const target = r.cy * MW + r.cx; if (!inR(r.cx, r.cy)) continue;
    for (const d of r.doors) { // camino serpenteante de la entrada al centro
      let x = d.x + (d.side === 'E' ? -1 : d.side === 'W' ? 1 : 0), y = d.y + (d.side === 'S' ? -1 : d.side === 'N' ? 1 : 0);
      for (let s = 0; s < 80 && inR(x, y); s++) {
        sym[y * MW + x] = safe;
        if (y * MW + x === target) break;
        const steps = DIRS4.filter(([ex, ey]) => inR(x + ex, y + ey)).sort((a, b) => (Math.abs(x + a[0] - r.cx) + Math.abs(y + a[1] - r.cy)) - (Math.abs(x + b[0] - r.cx) + Math.abs(y + b[1] - r.cy)) + (Math.random() - 0.5) * 1.6);
        if (!steps.length) break; x += steps[0][0]; y += steps[0][1];
      }
    }
    sym[target] = safe;
    for (let i = 0; i < MW * MH; i++) if (sym[i] >= 0) lv.floorTex[i] = 4 + sym[i];
    r.type = 'baldosas'; r.puzzle = { kind: 'baldosas', safe, fails: 0, state: 0 };
    return { z: c.z, r };
  }
  return null;
}
function planCups(dg, z0) {
  const c = trialCands(dg, z0, 4, 4)[0]; if (!c) return null;
  const order = [0, 1, 2].sort(() => Math.random() - 0.5);
  c.r.type = 'copas'; c.r.puzzle = { kind: 'copas', good: order[0], bad: order[1], state: 0 };
  return { z: c.z, r: c.r };
}

// ---------------------------------------------------------------- historias
function chainTexts(kind, trial, zs) {
  const [, z2, z3] = zs, zT = trial.z, L2 = lvEs(z2), L3 = lvEs(z3), LT = lvEs(zT), E2 = lvEn(z2), E3 = lvEn(z3), ET = lvEn(zT);
  const page = (es, en, jes, jen) => ({ es, en, jot: { es: jes, en: jen } });
  if (kind === 'estatuas') {
    const b = puzBeast(trial.broken), n3 = puzzleNote(zT, z3, trial.broken);
    return [
      page(['Diario de Aldric. Somos cinco y bajamos a por el tesoro del rey ciego.', null, `Dicen que lo guardan tres estatuas. Seguiré escribiendo en el ${L2}.`],
        ["Aldric's journal. There are five of us, going down for the blind king's treasure.", null, `They say three statues guard it. I will keep writing on ${E2}.`],
        `Encontré la primera página del diario de Aldric: buscaban un tesoro guardado por tres estatuas. Sigue en el ${L2}.`, `I found the first page of Aldric's journal: they were after a treasure guarded by three statues. It continues on ${E2}.`),
      page(['Día tres. Dos de los nuestros no volvieron.', null, `Las estatuas están en el ${LT}. En las paredes, los murales repiten una sola criatura.`, `La última página, en el ${L3}.`],
        ['Day three. Two of us did not come back.', null, `The statues are on ${ET}. On the walls, the murals repeat a single creature.`, `The last page, on ${E3}.`],
        `Segunda página de Aldric: las estatuas están en el ${LT} y los murales repiten una criatura. La última, en el ${L3}.`, `Aldric's second page: the statues are on ${ET} and the murals repeat one creature. The last one, on ${E3}.`),
      Object.assign(n3, { jot: { es: `Última página de Aldric: rompieron ${b.art} ${b.es} en el ${LT} y algo terrible los siguió.`, en: `Aldric's last page: they broke the ${b.en} on ${ET} and something terrible followed them.` } }),
    ];
  }
  if (kind === 'palancas') {
    const o = trial.r.puzzle.order.map(k => LEVER_SYMS[k]);
    return [
      page(['Páginas del ingeniero Brannoc. El rey me pidió un cierre que nadie pudiera forzar.', null, `Tres palancas: la llama, el copo y el rayo. El orden lo guardo en mis páginas; la siguiente está en el ${L2}.`],
        ['Pages of Brannoc the engineer. The king asked me for a lock no one could force.', null, `Three levers: the flame, the snowflake and the lightning. I keep the order in my pages; the next one is on ${E2}.`],
        `Encontré páginas del ingeniero Brannoc: un cierre con tres palancas (llama, copo y rayo). Sigue en el ${L2}.`, `I found pages from Brannoc the engineer: a lock with three levers (flame, snowflake and lightning). It continues on ${E2}.`),
      page([`Primero, ${o[0].clue.es}.`, null, `Después, ${o[1].clue.es}. Si se equivoca el orden, el suelo muerde. Sigo en el ${L3}.`],
        [`First, ${o[0].clue.en}.`, null, `Then, ${o[1].clue.en}. Get the order wrong and the floor bites. I continue on ${E3}.`],
        `Brannoc: primero ${o[0].clue.es}; después ${o[1].clue.es}. Sigue en el ${L3}.`, `Brannoc: first ${o[0].clue.en}; then ${o[1].clue.en}. It continues on ${E3}.`),
      page([`Y al final, ${o[2].clue.es}.`, null, `La cámara está en el ${LT}. Que nadie más baje a buscar mi oro...`],
        [`And at the end, ${o[2].clue.en}.`, null, `The vault is on ${ET}. Let no one else come down for my gold...`],
        `Brannoc: al final ${o[2].clue.es}. La cámara de las palancas está en el ${LT}.`, `Brannoc: at the end ${o[2].clue.en}. The lever vault is on ${ET}.`),
    ];
  }
  if (kind === 'balanza') {
    const P = trial.r.puzzle;
    return [
      page(['Cuentas de la mercader Ysolde. Debo oro al guardián de la balanza.', null, `Pide la cantidad exacta: si pones menos, se lo traga todo. Mi socio apuntó la cifra; su nota está en el ${L2}.`],
        ['Ledger of Ysolde the merchant. I owe gold to the keeper of the scales.', null, `It asks for the exact amount: put in less and it swallows everything. My partner wrote the figure down; his note is on ${E2}.`],
        `Encontré las cuentas de la mercader Ysolde: una balanza pide oro exacto. La cifra sigue en el ${L2}.`, `I found the ledger of Ysolde the merchant: some scales ask for exact gold. The figure continues on ${E2}.`),
      page([`La balanza del ${LT} pide ${P.bags} bolsas de oro.`, null, `Cuánto pesa cada bolsa... lo dejé escrito en el ${L3}.`],
        [`The scales on ${ET} ask for ${P.bags} bags of gold.`, null, `How much each bag weighs... I wrote it down on ${E3}.`],
        `El socio de Ysolde: la balanza del ${LT} pide ${P.bags} bolsas de oro. El peso de cada bolsa, en el ${L3}.`, `Ysolde's partner: the scales on ${ET} ask for ${P.bags} bags of gold. The weight of each bag, on ${E3}.`),
      page([`Cada bolsa, ${P.unit} monedas.`, null, 'Ni una menos. Y lo que sobre, la balanza también se lo queda.'],
        [`Each bag, ${P.unit} coins.`, null, 'Not one less. And whatever is left over, the scales keep too.'],
        `Última nota de Ysolde: cada bolsa pesa ${P.unit} monedas.`, `Ysolde's last note: each bag weighs ${P.unit} coins.`),
    ];
  }
  if (kind === 'laberinto') return [
    page(['Mapa de Teodric, cartógrafo. Me pagaron por cartografiar un laberinto bajo esta mazmorra.', null, `Dejé mis apuntes en el ${L2}.`],
      ['Map of Teodric the cartographer. I was paid to map a labyrinth under this dungeon.', null, `I left my notes on ${E2}.`],
      `Encontré el mapa de Teodric, cartógrafo: hay un laberinto en esta mazmorra. Sus apuntes siguen en el ${L2}.`, `I found Teodric's map: there is a labyrinth in this dungeon. His notes continue on ${E2}.`),
    page([`El laberinto está en el ${LT}. Una bestia con cuernos guarda su entrada.`, null, `Lo que aprendí dentro, en el ${L3}.`],
      [`The labyrinth is on ${ET}. A horned beast guards its entrance.`, null, `What I learned inside, on ${E3}.`],
      `Teodric: el laberinto está en el ${LT} y una bestia con cuernos guarda la entrada. Sigue en el ${L3}.`, `Teodric: the labyrinth is on ${ET} and a horned beast guards the entrance. It continues on ${E3}.`),
    page(['Una tablilla plantea un acertijo; la respuesta es un símbolo.', null, 'Las puertas mienten: cada vez que fallas, sus símbolos cambian de sitio. Piensa antes de cruzar.'],
      ['A tablet poses a riddle; the answer is a symbol.', null, 'The doors lie: every time you fail, their symbols move. Think before you cross.'],
      'Teodric: la respuesta del acertijo es un símbolo, y las puertas cambian cada vez que fallas.', 'Teodric: the answer to the riddle is a symbol, and the doors change every time you fail.'),
  ];
  if (kind === 'campanas') return [
    page(['Cuaderno de Mirela, campanera de la reina. La reina no dormía sin su canción.', null, `Escondí la caja de música lejos de aquí; mis notas siguen en el ${L2}.`],
      ["Notebook of Mirela, the queen's bell-ringer. The queen could not sleep without her song.", null, `I hid the music box far from here; my notes continue on ${E2}.`],
      `Encontré el cuaderno de Mirela, la campanera: una caja de música guarda la canción de la reina. Sigue en el ${L2}.`, `I found Mirela's notebook: a music box keeps the queen's song. It continues on ${E2}.`),
    page([`La caja de música está en el ${LT}. Recuerda la canción, y las campanas de la pared deben contestarla igual.`, null, `Lo demás, en el ${L3}.`],
      [`The music box is on ${ET}. It remembers the song, and the bells on the wall must answer it the same.`, null, `The rest, on ${E3}.`],
      `Mirela: la caja de música está en el ${LT}; las campanas deben repetir su canción. Sigue en el ${L3}.`, `Mirela: the music box is on ${ET}; the bells must repeat its song. It continues on ${E3}.`),
    page(['Escucha y mira: cada campana brilla cuando suena.', null, 'Si una suena fuera de lugar, despiertan los que guardaban su sueño.'],
      ['Listen and watch: each bell glows when it rings.', null, 'If one rings out of place, those who guarded her sleep will wake.'],
      'Mirela: cada campana brilla al sonar; si fallo una nota, despiertan los guardianes.', 'Mirela: each bell glows as it rings; if I miss a note, the guardians wake.'),
  ];
  if (kind === 'baldosas') {
    const s = TILE_SYMS[trial.r.puzzle.safe];
    return [
      page(['Diario de Oswin, aprendiz de albañil. Mi maestro enlosó una sala con trampas para el tesorero.', null, `Lo que sé lo escribí en el ${L2}.`],
        ["Diary of Oswin, a mason's apprentice. My master paved a trapped room for the treasurer.", null, `What I know, I wrote down on ${E2}.`],
        `Encontré el diario de Oswin, aprendiz de albañil: una sala con el suelo trampeado. Sigue en el ${L2}.`, `I found Oswin's diary: a room with a trapped floor. It continues on ${E2}.`),
      page([`La sala está en el ${LT}. Cada losa lleva un símbolo y solo uno aguanta.`, null, `Cuál... lo dejé escrito en el ${L3}.`],
        [`The room is on ${ET}. Each tile bears a symbol and only one holds.`, null, `Which one... I wrote it down on ${E3}.`],
        `Oswin: la sala de las losas está en el ${LT}; solo un símbolo aguanta. Sigue en el ${L3}.`, `Oswin: the tile room is on ${ET}; only one symbol holds. It continues on ${E3}.`),
      page([`Pisa solo las losas con ${s.es}.`, null, 'Mi maestro pisó otra. No volví a verle.'],
        [`Step only on the tiles with ${s.en}.`, null, 'My master stepped on another. I never saw him again.'],
        `Oswin: hay que pisar solo las losas con ${s.es}.`, `Oswin: step only on the tiles with ${s.en}.`),
    ];
  }
  if (kind === 'copas') {
    const P = trial.r.puzzle, good = CUPS[P.good], bad = CUPS[P.bad];
    return [
      page(['Confesión de Varek, copero del rey. Envenené una de las tres copas del altar.', null, `Que los dioses me perdonen. Sigo en el ${L2}.`],
        ["Confession of Varek, the king's cupbearer. I poisoned one of the three cups on the altar.", null, `May the gods forgive me. I continue on ${E2}.`],
        `Encontré la confesión de Varek, el copero: envenenó una de las tres copas de un altar. Sigue en el ${L2}.`, `I found Varek's confession: he poisoned one of three cups on an altar. It continues on ${E2}.`),
      page([`El altar está en el ${LT}. ${cap(bad.es)} mató al príncipe.`, null, `En el ${L3} cuento cuál salvó al rey.`],
        [`The altar is on ${ET}. ${cap(bad.en)} killed the prince.`, null, `On ${E3} I tell which one saved the king.`],
        `Varek: el altar está en el ${LT}; ${bad.es} mató al príncipe. Sigue en el ${L3}.`, `Varek: the altar is on ${ET}; ${bad.en} killed the prince. It continues on ${E3}.`),
      page([`El rey bebió de ${good.es} y vivió para verme ahorcado.`, null, 'La tercera solo tiene agua rancia.'],
        [`The king drank from ${good.en} and lived to see me hanged.`, null, 'The third holds only stale water.'],
        `Varek: el rey bebió de ${good.es} y vivió.`, `Varek: the king drank from ${good.en} and lived.`),
    ];
  }
  // braseros
  return [
    page(['Cartas de Ilsa, astrónoma. Sellé mi cámara con fuego y estrellas.', null, `Mi siguiente carta está en el ${L2}.`],
      ['Letters of Ilsa the astronomer. I sealed my vault with fire and stars.', null, `My next letter is on ${E2}.`],
      `Encontré cartas de Ilsa, la astrónoma: selló su cámara con fuego y estrellas. Sigue en el ${L2}.`, `I found letters from Ilsa the astronomer: she sealed her vault with fire and stars. It continues on ${E2}.`),
    page([`La cámara está en el ${LT}. El mural de la pared muestra mi constelación.`, null, `Más en el ${L3}.`],
      [`The vault is on ${ET}. The mural on the wall shows my constellation.`, null, `More on ${E3}.`],
      `Ilsa: la cámara está en el ${LT}; el mural muestra su constelación. Sigue en el ${L3}.`, `Ilsa: the vault is on ${ET}; the mural shows her constellation. It continues on ${E3}.`),
    page(['Enciende con tu antorcha solo los braseros que el mural enciende, de izquierda a derecha según lo miras.', null, 'Un fuego de más, y la sala arde.'],
      ['Light with your torch only the braziers the mural lights, left to right as you face it.', null, 'One fire too many, and the room burns.'],
      'Ilsa: encender con la antorcha solo los braseros que marca el mural, de izquierda a derecha mirándolo.', 'Ilsa: light with the torch only the braziers the mural marks, left to right as you face it.'),
  ];
}
function bundleText(kind, trial) {
  const zT = trial.z, LT = lvEs(zT), ET = lvEn(zT), P = trial.r ? trial.r.puzzle : null;
  const T = {
    estatuas: () => { const b = puzBeast(trial.broken); return [['Páginas sueltas del diario de Aldric.', null, `Tres estatuas en el ${LT}; los murales repiten la criatura buena.`, `Rompimos ${b.art} ${b.es}... y algo terrible nos siguió.`], ["Loose pages from Aldric's journal.", null, `Three statues on ${ET}; the murals repeat the right creature.`, `We broke the ${b.en}... and something terrible followed us.`]]; },
    palancas: () => { const o = P.order.map(k => LEVER_SYMS[k]); return [['Páginas del ingeniero Brannoc.', null, `Su cámara está en el ${LT}: tres palancas, llama, copo y rayo.`, `Primero ${o[0].clue.es}, después ${o[1].clue.es} y al final ${o[2].clue.es}. Si se equivoca el orden, el suelo muerde.`], ['Pages of Brannoc the engineer.', null, `His vault is on ${ET}: three levers, flame, snowflake and lightning.`, `First ${o[0].clue.en}, then ${o[1].clue.en} and at the end ${o[2].clue.en}. Get the order wrong and the floor bites.`]]; },
    balanza: () => [['Cuentas de la mercader Ysolde.', null, `La balanza del ${LT} pide ${P.bags} bolsas de ${P.unit} monedas.`, 'Ni una menos; y lo que sobre, también se lo queda.'], ['Ledger of Ysolde the merchant.', null, `The scales on ${ET} ask for ${P.bags} bags of ${P.unit} coins.`, 'Not one less; and whatever is left over, they keep too.']],
    laberinto: () => [['Mapa de Teodric, cartógrafo.', null, `Hay un laberinto en el ${LT}; una bestia con cuernos guarda su entrada.`, 'La tablilla plantea un acertijo y la respuesta es un símbolo. Si fallas, las puertas cambian.'], ['Map of Teodric the cartographer.', null, `There is a labyrinth on ${ET}; a horned beast guards its entrance.`, 'The tablet poses a riddle and the answer is a symbol. If you fail, the doors change.']],
    campanas: () => [['Cuaderno de Mirela, campanera de la reina.', null, `La caja de música está en el ${LT}. Las campanas deben repetir su canción; cada una brilla al sonar.`, 'Una nota fuera de lugar despierta a los guardianes.'], ["Notebook of Mirela, the queen's bell-ringer.", null, `The music box is on ${ET}. The bells must repeat its song; each one glows as it rings.`, 'A note out of place wakes the guardians.']],
    baldosas: () => { const s = TILE_SYMS[P.safe]; return [['Diario de Oswin, aprendiz de albañil.', null, `La sala de las losas está en el ${LT}.`, `Pisa solo las losas con ${s.es}. Mi maestro pisó otra.`], ["Diary of Oswin, a mason's apprentice.", null, `The tile room is on ${ET}.`, `Step only on the tiles with ${s.en}. My master stepped on another.`]]; },
    copas: () => { const g = CUPS[P.good], b = CUPS[P.bad]; return [['Confesión de Varek, copero del rey.', null, `El altar está en el ${LT}. ${cap(b.es)} mató al príncipe; el rey bebió de ${g.es} y vivió.`, 'La tercera solo tiene agua rancia.'], ["Confession of Varek, the king's cupbearer.", null, `The altar is on ${ET}. ${cap(b.en)} killed the prince; the king drank from ${g.en} and lived.`, 'The third holds only stale water.']]; },
    braseros: () => [['Cartas de Ilsa, astrónoma.', null, `Su cámara está en el ${LT}, bajo un mural con su constelación.`, 'Enciende con la antorcha solo los braseros que el mural enciende, de izquierda a derecha según lo miras. Uno de más y la sala arde.'], ['Letters of Ilsa the astronomer.', null, `Her vault is on ${ET}, under a mural of her constellation.`, 'Light with the torch only the braziers the mural lights, left to right as you face it. One too many and the room burns.']],
  }[kind]();
  const join = (L) => L.filter(Boolean).join(' ');
  return { es: T[0], en: T[1], jot: { es: 'Otro pergamino: ' + join(T[0]), en: 'Another scroll: ' + join(T[1]) }, part: 1, kind, bundle: true };
}
// premio de una prueba superada: si no es la última, el pergamino de la siguiente; si es la última, el tesoro
function trialPayoff(T, x, y, finalFn) {
  if (T && T.final === false && T.nextNote) {
    G.pickups.push({ type: 'note', x, y, t: 0, note: T.nextNote });
    toast(chEN() ? 'A SCROLL APPEARS: THE NEXT TRIAL' : 'APARECE UN PERGAMINO: LA SIGUIENTE PRUEBA', true);
    return false;
  }
  finalFn();
  if (T && T.final) toast(chEN() ? 'THE LAST TRIAL: THE TREASURE IS YOURS!' : 'LA ÚLTIMA PRUEBA: ¡EL TESORO ES TUYO!', true);
  return true;
}
// fallar una prueba que no es la última: se pierde el rastro de la siguiente
function chainLost(T) {
  if (!T || T.final !== false) return;
  jot('chainlost' + G.dg.n, chEN() ? 'I failed a trial: the trail to the next one is lost.' : 'Fallé una prueba: se perdió el rastro de la siguiente.');
}
const finalChest = (x, y, gold) => G.pickups.push({ type: 'chest', x, y, t: 0, gold: Math.round(gold || 9 * G.floor * rand(14, 20) * lootMul()), item: 'potion', eqItem: makeItem('vault', null, { rar: 'legendario' }) });
function chainStrike(kind) {
  const n = G.dg.n;
  for (let k = 1; k <= 3; k++) { strike('note' + n + '_' + kind + '_' + k); strike('note' + n + '_' + k); }
  strike('puzzleroom' + n + '_' + kind); strike('note' + n); strike('puzzleroom' + n);
}
const trialJot = (kind, es, en) => jot('puzzle' + G.dg.n + '_' + kind, chEN() ? en : es);

// ---------------------------------------------------------------- arte
function leverSymMask(id, x, y) {
  const dx = x - 7.5, dy = y - 7.5;
  if (id === 'fuego') return labSymMask('llama', x, y);
  if (id === 'hielo') { const r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), arm = Math.abs(Math.sin(3 * a)) < 0.16 + 0.5 / (r + 1); return (r < 7 && arm) || r < 1.5; }
  const t = (dy + 7.5) / 15, cx = t < 0.5 ? 9 - t * 6 : 3 + (t - 0.5) * 10; // rayo
  return t >= 0 && t <= 1 && Math.abs(dx + 7.5 - cx) < 1.4 + (Math.abs(t - 0.5) < 0.08 ? 3 : 0);
}
function leverTex(wall, k, down) {
  const t = wall.slice(), sym = LEVER_SYMS[k];
  for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) { const e = !x || !y || x === 17 || y === 17; t[(10 + y) * TS + 23 + x] = e ? rgb(52, 40, 26) : rgb(92, 70, 40); }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (leverSymMask(sym.id, x, y)) t[(11 + y) * TS + 24 + x] = sym.id === 'hielo' ? rgb(170, 220, 255, 250) : sym.id === 'rayo' ? rgb(255, 240, 120, 250) : rgb(255, 140, 60, 250);
  for (let y = 38; y < 46; y++) for (let x = 27; x < 37; x++) t[y * TS + x] = (x === 27 || x === 36 || y === 38 || y === 45) ? rgb(40, 38, 42) : rgb(86, 84, 92);
  const len = 14;
  for (let s = 0; s < len; s++) { const yy = down ? 42 + s : 42 - s; for (let w = -1; w <= 1; w++) if (yy >= 0 && yy < TS) t[yy * TS + 32 + w] = rgb(120 + w * 30, 112 + w * 30, 100 + w * 30); }
  for (let w = -2; w <= 2; w++) for (let h = -1; h <= 1; h++) { const yy = (down ? 42 + len : 42 - len) + h; if (yy >= 0 && yy < TS) t[yy * TS + 32 + w] = rgb(170, 46, 34); }
  return t;
}
function vaultTex(wall) {
  const t = wall.slice();
  for (let y = 6; y < 62; y++) for (let x = 12; x < 52; x++) { const e = x === 12 || x === 51 || y === 6, n = (hash2(x, y, 91) - 0.5) * 14; t[y * TS + x] = e ? rgb(50, 46, 44) : rgb(112 + n, 106 + n, 98 + n); }
  for (let y = 22; y < 44; y++) for (let x = 22; x < 42; x++) { const d = Math.hypot(x - 31.5, y - 32.5); if (Math.abs(d - 9) < 1.1 || (d < 4 && hash2(x, y, 92) > 0.4)) t[y * TS + x] = rgb(230, 190, 90, 250); }
  return t;
}
function bellTex(wall, k, lit) {
  const t = wall.slice(), c = BELL_COLS[k];
  for (let y = 4; y < 10; y++) for (let x = 20; x < 44; x++) t[y * TS + x] = y === 4 || y === 9 ? rgb(46, 32, 20) : rgb(96, 66, 38); // viga
  for (let y = 10; y < 14; y++) t[y * TS + 31] = t[y * TS + 32] = rgb(70, 70, 76);
  for (let y = 14; y < 44; y++) { // campana
    const v = (y - 14) / 30, half = 4 + v * v * 12 + (y > 40 ? 2 : 0);
    for (let x = Math.round(31.5 - half); x <= Math.round(31.5 + half); x++) {
      const u = (x - 31.5) / half, sh = 0.62 + 0.45 * Math.cos(u * 1.4 - 0.5) - (y > 40 ? 0.15 : 0), e = Math.abs(u) > 0.9 || y === 14;
      t[y * TS + x] = e ? rgb(c[0] * 0.35, c[1] * 0.35, c[2] * 0.35, lit ? 250 : 255) : lit ? rgb(Math.min(255, c[0] * sh * 1.3 + 30), Math.min(255, c[1] * sh * 1.3 + 30), Math.min(255, c[2] * sh * 1.3 + 30), 250) : rgb(c[0] * sh, c[1] * sh, c[2] * sh);
    }
  }
  for (let y = 44; y < 49; y++) for (let x = 30; x < 34; x++) t[y * TS + x] = rgb(60, 56, 54); // badajo
  return t;
}
function starsTex(wall, mask) {
  const t = wall.slice();
  for (let y = 12; y < 52; y++) for (let x = 3; x < 61; x++) { const e = x < 5 || x > 58 || y < 14 || y > 49, n = (hash2(x, y, 61) - 0.5) * 10; t[y * TS + x] = e ? rgb(120, 96, 50) : rgb(28 + n, 30 + n, 58 + n); }
  for (let k = 0; k < 5; k++) {
    const cx = 53 - k * 11, cy = 32 + (k % 2 ? -5 : 4), on = mask & (1 << k); // el motor muestra las paredes reflejadas: x=0 queda a la derecha
    for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
      const r = Math.hypot(x, y), a = Math.atan2(y, x), star = r < 1.6 + 2.6 * Math.pow(Math.max(0, Math.cos(2 * a)), 8) + 2.6 * Math.pow(Math.max(0, Math.cos(2 * a + Math.PI)), 8);
      if (on ? star : r < 1.6) t[(cy + y) * TS + cx + x] = on ? rgb(255, 236, 140, 250) : rgb(84, 88, 110);
    }
  }
  return t;
}
function tileFloor(base, k) {
  const t = base.slice(), id = TILE_SYMS[k].id;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (labSymMask(id, x, y)) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    const i = (16 + y * 2 + a) * TS + 16 + x * 2 + b, c = t[i];
    t[i] = rgb(Math.min(255, (c & 255) * 0.45 + 110), Math.min(255, ((c >> 8) & 255) * 0.45 + 92), Math.min(255, ((c >> 16) & 255) * 0.45 + 60));
  }
  return t;
}
function spriteFrom(w, h, fn) { const px = new Uint32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); if (c) px[y * w + x] = c; } return { w, h, px, flash: px }; }
function balanceSprite() {
  const w = 30, h = 32, px = new Uint32Array(w * h), g = (x, y, c) => { if (x >= 0 && y >= 0 && x < w && y < h) px[y * w + x] = c; };
  const br = (k) => rgb(176 * k, 128 * k, 60 * k);
  for (let y = 6; y < h - 3; y++) { g(14, y, br(1)); g(15, y, br(0.7)); }
  for (let x = 9; x < 21; x++) for (let y = h - 3; y < h; y++) g(x, y, br(y === h - 3 ? 1.1 : 0.6));
  for (let x = 2; x < 28; x++) g(x, 6, br(1.15));
  g(14, 4, br(1.2)); g(15, 4, br(1.2)); g(14, 5, br(1)); g(15, 5, br(1));
  for (const cx of [4, 25]) {
    for (let y = 7; y < 18; y++) { g(cx - 2 + Math.round((y - 7) * -0.15), y, br(0.8)); g(cx + 2 + Math.round((y - 7) * 0.15), y, br(0.8)); }
    for (let x = cx - 4; x <= cx + 4; x++) { g(x, 18, br(1.1)); g(x, 19, br(0.75)); }
    for (let x = cx - 3; x <= cx + 3; x++) g(x, 20, br(0.5));
  }
  return { w, h, px, flash: px };
}
const musicboxSprite = () => spriteFrom(22, 16, (x, y) => {
  if (y < 4) return x > 1 && x < 20 && y > 0 ? rgb(150, 92, 50) : (x > 0 && x < 21 ? rgb(90, 54, 30) : 0); // tapa
  if (y >= 4 && y < 16 && x > 1 && x < 20) { const e = x === 2 || x === 19 || y === 15; return e ? rgb(70, 40, 22) : (y === 9 && x > 5 && x < 16) ? rgb(220, 180, 80) : rgb(126 + (hash2(x, y, 7) - 0.5) * 16, 78, 42); }
  if (x >= 20 && x < 22 && y > 6 && y < 11) return rgb(200, 170, 90); // manivela
  return 0;
});
function cupsSprite(full) {
  return spriteFrom(34, 26, (x, y) => {
    if (y >= 14) { // altar de piedra: losa superior clara, frente con sombra y una franja tallada
      if (x < 2 || x > 31 || (y > 16 && (x < 4 || x > 29))) return 0;
      const n = (hash2(x, y, 3) - 0.5) * 12, top = y < 17, e = x === 2 || x === 31 || y === 14 || y === 25 || (y === 17) || ((x === 4 || x === 29) && y > 16);
      const k = top ? 0.95 : 0.62 - (y - 17) * 0.02 + (y === 20 || y === 21 ? -0.12 : 0);
      return e ? rgb(44, 40, 40) : rgb(118 * k + n, 112 * k + n, 106 * k + n);
    }
    if (!full) return 0;
    for (let k = 0; k < 3; k++) {
      const cx = 7 + k * 10, c = CUPS[k].col, dx = x - cx;
      const bowl = y >= 4 && y < 9 && Math.abs(dx) <= 3 - (y > 7 ? 1 : 0), stem = y >= 9 && y < 13 && Math.abs(dx) < 1, foot = y === 13 && Math.abs(dx) <= 2;
      if (bowl || stem || foot) { const k2 = dx < 0 ? 1.1 : 0.8; return rgb(c[0] * k2, c[1] * k2, c[2] * k2); }
    }
    return 0;
  });
}
function brazierOffSprite() { // el brasero sin llama: brasas oscuras
  const s = SPR.brazier[0], px = new Uint32Array(s.w * s.h);
  for (let i = 0; i < px.length; i++) {
    const c = s.px[i]; if (!(c >>> 24)) continue;
    const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
    if (r > 150 && r > b * 1.6 && g > 40) { if (((i / s.w) | 0) > s.h * 0.45) px[i] = rgb(60, 30, 24); } else px[i] = c;
  }
  return { w: s.w, h: s.h, px, flash: px };
}
// objetos de las pruebas hechos con Pixellab (assets/pixellab/obj_*.png): si existen, sustituyen a los dibujados por código
const OBJ_PIX = [['balance', 'obj_balance'], ['musicbox', 'obj_musicbox'], ['cups', 'obj_cups'], ['cupsEmpty', 'obj_cups_empty'], ['tablet', 'obj_tablet'], ['noteItem', 'obj_scroll']];
function chainArt(lv) {
  if (SPR.pixReady && !chainArt.objs) { chainArt.objs = true; if (!SPR.tablet && typeof labArt === 'function') labArt(lv); for (const [k, n] of OBJ_PIX) if (SPR[n]) SPR[k] = k === 'noteItem' ? trimSprite(SPR[n]) : [trimSprite(SPR[n])]; }
  if (!SPR.balance) { SPR.balance = [balanceSprite()]; SPR.musicbox = [musicboxSprite()]; SPR.cups = [cupsSprite(true)]; SPR.cupsEmpty = [cupsSprite(false)]; }
  if (!SPR.brazierOff && SPR.brazier) SPR.brazierOff = [brazierOffSprite()];
  const T = lv.themeObj;
  if (T && T.chainArt !== 2) {
    T.chainArt = 2;
    T.walls[W_VAULT] = vaultTex(T.walls[4] || T.walls[1]);
    for (let k = 0; k < 3; k++) { T.walls[W_LEVER + k] = leverTex(T.walls[1], k, false); T.walls[W_LEVER + 3 + k] = leverTex(T.walls[1], k, true); }
    for (let k = 0; k < 4; k++) { T.walls[W_BELL + k] = bellTex(T.walls[1], k, false); T.walls[W_BELL + 4 + k] = bellTex(T.walls[1], k, true); }
    for (let m = 0; m < 32; m++) T.walls[W_STARS + m] = starsTex(T.walls[4] || T.walls[1], m);
    for (let k = 0; k < 4; k++) T.floors[4 + k] = tileFloor(T.floors[2] || T.floors[0], k);
  }
}

// ---------------------------------------------------------------- en partida
function furnishChain(lv, r) {
  const P = r.puzzle; if (!P) return;
  const c = { x: r.cx + 0.5, y: r.cy + 0.5 };
  if (r.type === 'balanza') { lv.addDecor('balance', c.x, c.y, false); lv.lights.push({ x: c.x, y: c.y, c: [1.15, 0.95, 0.55], rad: 4.2 }); }
  if (r.type === 'palancas') lv.lights.push({ x: c.x, y: c.y, c: [0.8, 0.75, 0.65], rad: 4 });
  if (r.type === 'campanas') { lv.addDecor('musicbox', c.x, c.y, false); lv.lights.push({ x: c.x, y: c.y, c: [0.85, 0.8, 1.1], rad: 4.4 }); }
  if (r.type === 'copas') { lv.addDecor('cups', c.x, c.y, false); lv.lights.push({ x: c.x, y: c.y, c: [1.1, 0.9, 0.7], rad: 4 }); }
  if (r.type === 'baldosas') lv.lights.push({ x: c.x, y: c.y, c: [0.9, 0.85, 0.75], rad: 4.6 });
  if (r.type === 'braseros') { P.pos.forEach((q, k) => { const d = lv.addDecor('brazier', q.x, q.y, false); d.used = true; d.bz = k; }); lv.lights.push({ x: c.x, y: c.y, c: [0.5, 0.5, 0.8], rad: 3.6 }); }
}
// ¿está el jugador en mitad de una prueba? (sala de prueba sin resolver o laberinto sin resolver): no aparecen monstruos
function inTrialArea() {
  const lv = G.lv, p = G.p; if (!lv || !p) return false;
  const x = Math.floor(p.x), y = Math.floor(p.y);
  if (lv.maze && !lv.maze.state && inMaze(lv, x, y)) return true;
  const ri = lv.roomOf[y * MW + x], r = ri >= 0 ? lv.rooms[ri] : null;
  return !!(r && r.puzzle && !r.puzzle.state);
}
function relight(lv) { lv.lightMap = lv.computeLightMap(); }
function chainRoomNear(lv, i) { const x = i % MW, y = (i / MW) | 0; for (const [dx, dy] of DIRS4) { const r = lv.roomOf[(y + dy) * MW + x + dx]; if (r >= 0 && lv.rooms[r].puzzle) return lv.rooms[r]; } return null; }
// hit: true cuando se golpea (arma o disparo); al caminar contra una palanca o campana solo se avisa, para no fallar sin querer
function chainTouch(lv, i, v, hit = false) {
  if (v === W_VAULT) { toast(chEN() ? 'A SEALED SLAB: SOME MECHANISM OPENS IT' : 'UNA LOSA SELLADA: ALGÚN MECANISMO LA ABRE', false); Sfx.play('locked'); G.touchCd = 1.2; return true; }
  const bell = v >= W_BELL && v < W_BELL + 8, lever = v >= W_LEVER && v < W_LEVER + 6;
  if (!bell && !lever) return false;
  if (!hit) {
    if (bell || v < W_LEVER + 3) toast(bell ? (chEN() ? 'STRIKE THE BELL TO RING IT' : 'GOLPEA LA CAMPANA PARA QUE SUENE') : (chEN() ? 'STRIKE THE LEVER TO PULL IT' : 'GOLPEA LA PALANCA PARA BAJARLA'), false);
    G.touchCd = 1.5; return true;
  }
  if (bell) return bellTouch(lv, i, v);
  G.touchCd = 0.6;
  if (v >= W_LEVER + 3) { Sfx.play('locked'); return true; }
  const r = chainRoomNear(lv, i), P = r && r.puzzle; if (!P) return true;
  if (P.state) { toast(chEN() ? 'THE LEVER IS JAMMED' : 'LA PALANCA ESTÁ ATASCADA', false); Sfx.play('locked'); return true; }
  const k = v - W_LEVER, en = chEN();
  lv.cells[i] = W_LEVER + 3 + k; Sfx.play('unlock'); G.shake = Math.max(G.shake, 0.12);
  P.pulled.push(k);
  if (P.order[P.pulled.length - 1] !== k) { // orden equivocado: pinchos por toda la sala y el mecanismo se atasca
    P.state = 2; spikeRoom(lv, r);
    const p = G.p; hurtPlayer(Math.round(p.maxHp * 0.3), p.x + 0.1, p.y + 0.1);
    Sfx.play('trap'); G.shake = Math.max(G.shake, 0.6);
    toast(en ? 'WRONG ORDER! THE FLOOR BITES' : '¡ORDEN EQUIVOCADO! EL SUELO MUERDE', true);
    logMsg(en ? 'Spikes burst out of the floor and the mechanism jams' : 'Brotan pinchos del suelo y el mecanismo se atasca', C.red);
    trialJot('palancas', 'Bajé las palancas en mal orden: brotaron pinchos y el mecanismo se atascó.', 'I pulled the levers in the wrong order: spikes burst out and the mechanism jammed.');
    chainStrike('palancas'); chainLost(P); if (typeof track === 'function') track('palancas/fallado');
    return true;
  }
  logMsg(en ? `The lever of ${LEVER_SYMS[k].en} goes down with a clunk` : `La palanca de ${LEVER_SYMS[k].es} baja con un chasquido`, C.dim);
  if (P.pulled.length === 3) {
    P.state = 1; openVault(lv, P);
    toast(en ? 'THE MECHANISM GIVES WAY: THE VAULT OPENS' : 'EL MECANISMO CEDE: LA CÁMARA SE ABRE', true);
    trialJot('palancas', 'Bajé las palancas de Brannoc en el orden correcto y se abrió su cámara.', "I pulled Brannoc's levers in the right order and opened his vault.");
    chainStrike('palancas'); if (typeof track === 'function') track('palancas/resuelto');
  }
  return true;
}
function spikeRoom(lv, r) { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (lv.inRoom(r, x, y) && lv.at(x, y) === 0 && ((x + y) & 1) === 0 && !lv.spikes.some(s => s.x === x && s.y === y)) lv.spikes.push({ x, y, ph: ((x * 3 + y * 5) % 4) * 0.55 }); }
// abre la losa y pone el tesoro dentro (cofre con oro y un épico, o legendario al 50%)
function openVault(lv, P, gold) {
  const V = P.vault; lv.openCell(V.door);
  Sfx.play('portal'); G.flashFx = 0.6; G.shake = Math.max(G.shake, 0.35);
  burst(V.x, V.y, 0.4, 20, rgb(255, 220, 140), 2, 0.8, true, 0.05);
  trialPayoff(P, V.x, V.y, () => finalChest(V.x, V.y, gold));
}
// ---- campanas
function bellTouch(lv, i, v) {
  const k = (v - W_BELL) % 4, r = chainRoomNear(lv, i), P = r && r.puzzle;
  G.touchCd = 0.8;
  Sfx.bell(k); flashBell(lv, i, k);
  if (!P || P.state || (G.bellShow && G.bellShow.r === r)) return true;
  const en = chEN();
  P.input.push(k);
  if (P.seq[P.input.length - 1] !== k) {
    P.state = 2;
    const n = 3 + (G.dg ? G.dg.n : 1), p = G.p, cells = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (lv.at(x, y) === 0 && Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) > 2.2) cells.push([x, y]);
    for (let j = 0; j < n && cells.length; j++) { const [x, y] = pick(cells), e = spawnEnemy('wraith', x + 0.5, y + 0.5); e.sleep = false; vfxBlink(e.x, e.y, 'void'); }
    Sfx.play('roar'); G.shake = Math.max(G.shake, 0.5);
    toast(en ? 'A WRONG NOTE! THE GUARDIANS WAKE' : '¡NOTA EQUIVOCADA! DESPIERTAN LOS GUARDIANES', true);
    trialJot('campanas', 'Fallé una nota de la canción de la reina y despertaron sus espectros.', "I missed a note of the queen's song and her wraiths woke up.");
    chainStrike('campanas'); chainLost(P); if (typeof track === 'function') track('campanas/fallado');
    return true;
  }
  if (P.input.length === P.seq.length) {
    P.state = 1; later(0.6, () => openVault(lv, P));
    toast(en ? 'THE SONG IS COMPLETE: THE VAULT OPENS' : 'LA CANCIÓN ESTÁ COMPLETA: LA CÁMARA SE ABRE', true);
    trialJot('campanas', 'Repetí en las campanas la canción de la reina y se abrió la cámara de Mirela.', "I played the queen's song on the bells and Mirela's vault opened.");
    chainStrike('campanas'); if (typeof track === 'function') track('campanas/resuelto');
  }
  return true;
}
function flashBell(lv, i, k) {
  lv.cells[i] = W_BELL + 4 + k;
  const t = G.time + 0.4; (G.bellFlash || (G.bellFlash = [])).push({ lv, i, k, t });
}
// ---- actualización por fotograma: caja de música, campanas, baldosas, braseros, balanza y copas
function chainUpdate() {
  const lv = G.lv, p = G.p; if (!lv) return;
  if (G.bellFlash && G.bellFlash.length) G.bellFlash = G.bellFlash.filter(f => { if (G.time < f.t) return true; if (f.lv.cells[f.i] === W_BELL + 4 + f.k) f.lv.cells[f.i] = W_BELL + f.k; return false; });
  const S = G.bellShow;
  if (S) { // la caja de música toca la canción: cada nota suena y su campana brilla
    if (S.lv !== lv) G.bellShow = null;
    else if (G.time >= S.next) {
      if (S.i >= S.r.puzzle.seq.length) { G.bellShow = null; logMsg(chEN() ? 'The music box falls silent. Your turn.' : 'La caja de música calla. Te toca.', C.cyan); }
      else { const k = S.r.puzzle.seq[S.i++]; Sfx.bell(k); flashBell(lv, S.r.puzzle.bells[k], k); S.next = G.time + 0.7; }
    }
  }
  const ri = lv.roomOf[Math.floor(p.y) * MW + Math.floor(p.x)], r = ri >= 0 ? lv.rooms[ri] : null, P = r && r.puzzle;
  if (!P) { G.tileCell = -1; return; }
  const dc = Math.hypot(r.cx + 0.5 - p.x, r.cy + 0.5 - p.y);
  // los objetos de las pruebas se activan golpeándolos (chainMelee / chainProj), no al acercarse: aquí solo se avisa
  if (!P.state && !P.hinted && TRIAL_HINT[r.type]) {
    const near = r.type === 'braseros' ? G.decor.some(d => d.type === 'brazier' && d.bz !== undefined && d.used && Math.hypot(d.x - p.x, d.y - p.y) < 1.6) : dc < 1.8;
    if (near) { P.hinted = true; toast(TRIAL_HINT[r.type][chEN() ? 1 : 0], false); }
  }
  if (r.type === 'baldosas' && !P.state) {
    const c = Math.floor(p.y) * MW + Math.floor(p.x);
    if (c !== G.tileCell) {
      G.tileCell = c;
      const s = lv.floorTex[c] - 4;
      if (s >= 0 && s < 4 && s !== P.safe) tileFail(lv, r, P, c);
    }
    const ch = G.pickups.find(k => k.trial === 'baldosas');
    if (!ch || ch.open || ch.dead) { P.state = 1; trialJot('baldosas', 'Crucé la sala de las losas pisando solo el símbolo bueno y abrí el cofre.', 'I crossed the tile room stepping only on the right symbol and opened the chest.'); chainStrike('baldosas'); if (typeof track === 'function') track('baldosas/resuelto'); }
  }
}
const TRIAL_HINT = {
  campanas: ['GOLPEA LA CAJA DE MÚSICA PARA QUE SUENE', 'STRIKE THE MUSIC BOX TO MAKE IT PLAY'],
  braseros: ['GOLPEA UN BRASERO CON LA ANTORCHA ENCENDIDA PARA PRENDERLO', 'STRIKE A BRAZIER WITH A LIT TORCH TO LIGHT IT'],
  balanza: ['GOLPEA LA BALANZA PARA DEPOSITAR ORO', 'STRIKE THE SCALES TO PUT GOLD ON THEM'],
  copas: ['GOLPEA EL ALTAR PARA ELEGIR UNA COPA', 'STRIKE THE ALTAR TO CHOOSE A CUP'],
};
// ---- golpear los objetos de las pruebas (caja de música, braseros, balanza y copas)
function trialObj(d) {
  if (d.type === 'brazier') return d.bz !== undefined;
  return d.type === 'musicbox' || d.type === 'balance' || d.type === 'cups' || d.type === 'cupsEmpty';
}
function chainMelee(p, w) {
  let best = null, bs = Infinity;
  for (const d of G.decor) { // el que tienes más delante (cerca y centrado)
    if (!trialObj(d)) continue;
    const dx = d.x - p.x, dy = d.y - p.y, dist = Math.hypot(dx, dy);
    if (dist > w.range + 0.35) continue;
    let da = Math.atan2(dy, dx) - p.a; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > w.arc / 2 && dist > 0.8) continue;
    if (!G.lv.los(p.x, p.y, d.x, d.y)) continue;
    const sc = dist + Math.abs(da) * 1.2;
    if (sc < bs) { bs = sc; best = d; }
  }
  if (best) return strikeTrialObj(best) ? 1 : 0;
  return chainWallHit(p.x, p.y, p.a, w.range + 0.45) ? 1 : 0;
}
// palancas y campanas: la primera pared delante a tiro del arma
function chainWallHit(x, y, a, reach) {
  const lv = G.lv, c = Math.cos(a), s = Math.sin(a);
  for (let t = 0.2; t <= reach; t += 0.05) {
    const cx = Math.floor(x + c * t), cy = Math.floor(y + s * t), v = lv.at(cx, cy);
    if (v === 0) continue;
    if ((v >= W_LEVER && v < W_LEVER + 6) || (v >= W_BELL && v < W_BELL + 8)) { burst(x + c * (t - 0.1), y + s * (t - 0.1), 0.5, 6, rgb(255, 235, 170), 1.6, 0.4); return chainTouch(lv, cy * MW + cx, v, true); }
    return false;
  }
  return false;
}
function chainProjWall(pr) {
  if (!pr.friendly || !pr.basic) return;
  const lv = G.lv, cx = Math.floor(pr.x), cy = Math.floor(pr.y), v = lv.at(cx, cy);
  if ((v >= W_LEVER && v < W_LEVER + 6) || (v >= W_BELL && v < W_BELL + 8)) chainTouch(lv, cy * MW + cx, v, true);
}
function chainProj(pr) {
  if (!pr.basic) return false;
  for (const d of G.decor) { if (!trialObj(d)) continue; const dx = d.x - pr.x, dy = d.y - pr.y; if (dx * dx + dy * dy < 0.32 * 0.32) return strikeTrialObj(d); }
  return false;
}
function strikeTrialObj(d) {
  const lv = G.lv, r = puzzleRoomOf(d), P = r && r.puzzle, en = chEN(), p = G.p;
  if (!P) return false;
  if (d.type === 'brazier') {
    burst(d.x, d.y, 0.5, 6, rgb(255, 200, 120), 1.4, 0.4, true);
    if (!d.used || P.state) { Sfx.play('blade'); return true; }
    if (!(p.off === 'torch' && p.torchFuel > 0)) { Sfx.play('blade'); toast(en ? 'YOU NEED A LIT TORCH IN HAND' : 'NECESITAS UNA ANTORCHA ENCENDIDA EN LA MANO', false); return true; }
    lightBrazier(lv, r, P, d); return true;
  }
  vfxImpact(d.x, d.y, 0.4, 'steel', 0.6); Sfx.play('blade');
  if (d.type === 'musicbox') {
    if (P.state) { toast(en ? 'THE MUSIC BOX IS SILENT' : 'LA CAJA DE MÚSICA YA NO SUENA', false); return true; }
    if (!G.bellShow) { P.input = []; G.bellShow = { lv, r, i: 0, next: G.time + 0.4 }; toast(en ? 'THE MUSIC BOX PLAYS...' : 'LA CAJA DE MÚSICA SUENA...', false); }
    return true;
  }
  if (P.state) { toast(r.type === 'copas' ? (en ? 'THE CUPS ARE EMPTY' : 'LAS COPAS ESTÁN VACÍAS') : (en ? 'THE SCALES NO LONGER MOVE' : 'LA BALANZA YA NO SE MUEVE'), false); return true; }
  if (G.state === 'play') openTrialMenu(r);
  return true;
}
function tileFail(lv, r, P, c) {
  const p = G.p, en = chEN(); P.fails++;
  burst(p.x, p.y, 0.1, 14, rgb(200, 200, 210), 2.2, 0.5, false, 0.05); Sfx.play('trap'); G.shake = Math.max(G.shake, 0.35);
  hurtPlayer(Math.round(p.maxHp * 0.12), p.x + 0.1, p.y + 0.1);
  if (P.fails < 3) { toast(en ? `WRONG TILE! (${P.fails}/3)` : `¡LOSA EQUIVOCADA! (${P.fails}/3)`, false); return; }
  P.state = 2;
  const ch = G.pickups.find(k => k.trial === 'baldosas' && !k.open);
  if (ch) { ch.dead = true; ch.lost = true; burst(ch.x, ch.y, 0.2, 30, rgb(110, 96, 80), 2.6, 0.9, false, 0.08); }
  toast(en ? 'THE FLOOR SINKS UNDER THE CHEST!' : '¡EL SUELO SE HUNDE BAJO EL COFRE!', true);
  trialJot('baldosas', 'Pisé tres losas equivocadas y el suelo se tragó el cofre.', 'I stepped on three wrong tiles and the floor swallowed the chest.');
  chainStrike('baldosas'); chainLost(P); if (typeof track === 'function') track('baldosas/fallado');
}
function lightBrazier(lv, r, P, d) {
  const en = chEN(), bit = 1 << d.bz;
  d.used = false; P.lit |= bit; Sfx.play('torchOut'); burst(d.x, d.y, 0.55, 10, rgb(255, 170, 60), 1.4, 0.6, true);
  lv.lights.push({ x: d.x, y: d.y, c: LIGHT_FIRE, rad: 3.4, bz: true }); relight(lv);
  if (!(P.mask & bit)) { // fuego de más: la sala arde y los braseros se apagan
    P.state = 2;
    for (const b of G.decor) if (b.type === 'brazier' && b.bz !== undefined) { b.used = true; burst(b.x, b.y, 0.6, 26, rgb(255, 120, 40), 3, 0.9, true); }
    lv.lights = lv.lights.filter(l => !l.bz); relight(lv);
    const p = G.p; hurtPlayer(Math.round(p.maxHp * 0.3), p.x + 0.1, p.y + 0.1); applyFxPlayerBurn();
    G.flashFx = 0.6; G.shake = Math.max(G.shake, 0.6); Sfx.play('boss');
    toast(en ? 'ONE FIRE TOO MANY! THE ROOM BURNS' : '¡UN FUEGO DE MÁS! LA SALA ARDE', true);
    trialJot('braseros', 'Encendí un brasero que no marcaba el mural: la sala ardió y todos se apagaron.', 'I lit a brazier the mural did not mark: the room burned and they all went out.');
    chainStrike('braseros'); chainLost(P); if (typeof track === 'function') track('braseros/fallado');
    return;
  }
  if (P.lit === P.mask) {
    P.state = 1; openVault(lv, P);
    toast(en ? 'THE CONSTELLATION BURNS: THE VAULT OPENS' : 'LA CONSTELACIÓN ARDE: LA CÁMARA SE ABRE', true);
    trialJot('braseros', 'Encendí los braseros de la constelación de Ilsa y se abrió su cámara.', "I lit the braziers of Ilsa's constellation and her vault opened.");
    chainStrike('braseros'); if (typeof track === 'function') track('braseros/resuelto');
  }
}
function applyFxPlayerBurn() { const p = G.p; for (let k = 0; k < 6; k++) later(0.3 * k, () => { if (G.state === 'play') burst(p.x, p.y, 0.4, 6, rgb(255, 140, 50), 1.6, 0.5, true); }); }

// ---- menús de la balanza y de las copas
function openTrialMenu(r) {
  const P = r.puzzle, en = chEN();
  if (r.type === 'balanza') {
    const base = P.price, opts = [...new Set([base, Math.round(base * 0.7 / 5) * 5, Math.round(base * 1.3 / 5) * 5, Math.round(base * 1.8 / 5) * 5])].sort((a, b) => a - b);
    G.tmenu = { r, title: 'LA BALANZA', sub: en ? 'IT ASKS FOR EXACT GOLD: LESS AND IT SWALLOWS EVERYTHING' : 'PIDE ORO EXACTO: SI PONES MENOS, SE LO TRAGA TODO', gold: true,
      opts: opts.map(a => en ? `PUT ${a} GOLD` : `DEPOSITAR ${a} DE ORO`), pick: (i) => balancePay(r, opts[i]) };
  } else {
    G.tmenu = { r, title: 'LAS TRES COPAS', sub: en ? 'ONE BLESSES, ONE KILLS, ONE IS ONLY WATER' : 'UNA BENDICE, OTRA MATA Y OTRA SOLO ES AGUA',
      opts: CUPS.map(c => (en ? 'DRINK FROM ' : 'BEBER DE ') + (en ? c.en : c.es).toUpperCase()), pick: (i) => drinkCup(r, i) };
  }
  G.state = 'tmenu'; mouse.fire = false; if (document.exitPointerLock) document.exitPointerLock();
}
function tmenuChoose(i) {
  const M = G.tmenu; if (!M) return;
  if (i >= M.opts.length) { closeTrialMenu(); return; }
  M.pick(i);
}
function closeTrialMenu() { G.tmenu = null; if (G.state === 'tmenu') G.state = 'play'; G.touchCd = 0.4; lockMouse(); }
function balancePay(r, amt) {
  const P = r.puzzle, en = chEN();
  if (G.loot < amt) { toast(en ? 'YOU DO NOT HAVE ENOUGH GOLD' : 'NO TE ALCANZA EL ORO', false); Sfx.play('locked'); return; }
  G.loot -= amt; closeTrialMenu(); Sfx.play('coin');
  if (amt < P.price) {
    P.state = 2; Sfx.play('locked'); G.shake = Math.max(G.shake, 0.3);
    toast(en ? 'THE SCALES SWALLOW YOUR GOLD' : 'LA BALANZA SE TRAGA TU ORO', true);
    logMsg(en ? `Too little: ${amt} gold lost and the scales lock up` : `Demasiado poco: pierdes ${amt} de oro y la balanza se bloquea`, C.red);
    trialJot('balanza', `Puse ${amt} de oro en la balanza. No era bastante: se lo tragó todo.`, `I put ${amt} gold on the scales. It was not enough: it swallowed everything.`);
    chainStrike('balanza'); chainLost(P); if (typeof track === 'function') track('balanza/fallado');
    return;
  }
  P.state = 1; openVault(G.lv, P, Math.round(P.price * 2.5));
  if (P.final === false) for (let k = 0; k < 3; k++) G.pickups.push({ type: 'gold', x: P.vault.x + rand(-0.6, 0.6), y: P.vault.y + rand(-0.6, 0.6), v: Math.round(P.price / 3), t: rand(0, 6) }); // te devuelve lo pagado
  toast(amt === P.price ? (en ? 'THE SCALES BALANCE: THE VAULT OPENS' : 'LA BALANZA SE EQUILIBRA: LA CÁMARA SE ABRE') : (en ? 'IT TIPS TOO FAR: THE EXCESS IS LOST' : 'SE INCLINA DE MÁS: EL EXCESO SE PIERDE'), true);
  trialJot('balanza', `Pagué ${amt} de oro a la balanza y se abrió la cámara.`, `I paid ${amt} gold to the scales and the vault opened.`);
  chainStrike('balanza'); if (typeof track === 'function') track('balanza/resuelto');
}
function drinkCup(r, i) {
  const P = r.puzzle, en = chEN(), p = G.p, cup = CUPS[i];
  closeTrialMenu(); Sfx.play('potion');
  for (const d of G.decor) if (d.type === 'cups' && Math.hypot(d.x - r.cx - 0.5, d.y - r.cy - 0.5) < 0.6) d.type = 'cupsEmpty';
  if (i === P.good) {
    P.state = 1; p.hp = p.maxHp; p.poisT = 0;
    addBuff('cupBless', en ? 'Royal blessing' : 'Bendición real', 240, { dmg: 1.3, spd: 1.1, regenPct: 0.01 }, C.gold);
    trialPayoff(P, r.cx + 0.9, r.cy + 0.5, () => dropItem('vault', r.cx + 0.9, r.cy + 0.5, { rar: 'legendario' }));
    G.flashFx = 0.6; Sfx.play('shrine');
    toast(en ? `${cup.en.toUpperCase()} WAS BLESSED!` : `¡${cup.es.toUpperCase()} ESTABA BENDITA!`, true);
    const fin = P.final !== false || !P.nextNote;
    trialJot('copas', `Bebí de ${cup.es}: estaba bendita. Me curó, me bendijo y bajo el altar había ${fin ? 'un tesoro' : 'otro pergamino'}.`, `I drank from ${cup.en}: it was blessed. It healed me, blessed me, and under the altar there was ${fin ? 'a treasure' : 'another scroll'}.`);
    if (typeof track === 'function') track('copas/bendita');
  } else if (i === P.bad) {
    P.state = 2; p.poisT = 12; p.poisDps = Math.max(2, p.maxHp * 0.025);
    addBuff('cupCurse', en ? 'Curse of the cupbearer' : 'Maldición del copero', 150, { dmg: 0.75, spd: 0.9 }, C.red);
    G.flashFx = 0.4; Sfx.play('roar');
    toast(en ? `${cup.en.toUpperCase()} WAS POISONED!` : `¡${cup.es.toUpperCase()} ESTABA ENVENENADA!`, true);
    trialJot('copas', `Bebí de ${cup.es}: estaba envenenada. Veneno y una maldición que me debilita.`, `I drank from ${cup.en}: it was poisoned. Poison and a weakening curse.`);
    chainLost(P); if (typeof track === 'function') track('copas/envenenada');
  } else {
    P.state = 2;
    toast(en ? 'STALE WATER... THE OTHER CUPS SPILL' : 'AGUA RANCIA... LAS OTRAS COPAS SE VUELCAN', true);
    trialJot('copas', `Bebí de ${cup.es}: solo era agua rancia. Las otras copas se volcaron.`, `I drank from ${cup.en}: only stale water. The other cups spilled.`);
    chainLost(P); if (typeof track === 'function') track('copas/agua');
  }
  chainStrike('copas');
}
