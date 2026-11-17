// Laberinto con acertijo. En un nivel de la mazmorra se excava un laberinto en la roca. En su entrada, una tablilla de
// piedra plantea un acertijo cuya respuesta es un símbolo (sol, luna, estrella, espada...). Varias puertas del borde del
// laberinto llevan un símbolo: las falsas te arrastran a otro punto de la mazmorra al que se llega sin llaves; la buena
// se abre a la sala del premio, que sale por un corredor (cerrado con una reja hasta resolverlo) a otro pasillo.
// Un minotauro (minijefe) guarda el pasillo de la entrada.

const W_GATE = 23, W_SYM = 24; // reja de la sala del premio; puertas con símbolo 24..31
const LAB_SYMS = [
  { id: 'sol', es: 'el sol', en: 'the sun' }, { id: 'luna', es: 'la luna', en: 'the moon' },
  { id: 'estrella', es: 'la estrella', en: 'the star' }, { id: 'espada', es: 'la espada', en: 'the sword' },
  { id: 'calavera', es: 'la calavera', en: 'the skull' }, { id: 'llama', es: 'la llama', en: 'the flame' },
  { id: 'llave', es: 'la llave', en: 'the key' }, { id: 'ojo', es: 'el ojo', en: 'the eye' },
];
const LAB_RIDDLES = [
  { ok: 'luna', es: ['En forma de astros,', 'el paladín reza al sol,', 'el nigromante a la...'], en: ['In the shape of stars,', 'the paladin prays to the sun,', 'the necromancer to the...'] },
  { ok: 'sol', es: ['Nace cada mañana y muere cada tarde.', 'El paladín le reza', 'y la noche le teme.'], en: ['Born every morning, dead every evening.', 'The paladin prays to it', 'and the night fears it.'] },
  { ok: 'estrella', es: ['Guía a los marinos en la noche', 'y no es la luna.', 'Hay miles y solo una cuenta.'], en: ['It guides sailors through the night', 'and it is not the moon.', 'There are thousands; only one counts.'] },
  { ok: 'espada', es: ['Tiene filo y no lengua;', 'hiere y no muerde.', 'El guerrero nunca la suelta.'], en: ['It has an edge but no tongue;', 'it wounds but does not bite.', 'The warrior never lets it go.'] },
  { ok: 'calavera', es: ['Todos la llevamos dentro', 'y nadie la ve en vida.'], en: ['We all carry it inside', 'and no one sees it while alive.'] },
  { ok: 'llama', es: ['Come y nunca se sacia;', 'si bebe, muere.'], en: ['It eats and is never full;', 'if it drinks, it dies.'] },
  { ok: 'llave', es: ['Abro sin fuerza', 'y cierro sin ruido.', 'Sin mí, ninguna puerta cede.'], en: ['I open without force', 'and close without a sound.', 'Without me, no door gives way.'] },
  { ok: 'ojo', es: ['Lo ve todo', 'y no se ve a sí mismo.'], en: ['It sees everything', 'and cannot see itself.'] },
];
const labEN = () => typeof LANG !== 'undefined' && LANG === 'en';
DECOR.tablet = { h: 0.62 };
ENEMY.minotaur = { name: 'Minotauro', hp: 300, spd: 1.7, dmg: 24, r: 0.5, h: 1.45, z: 0, spr: 'minotaur', xp: 30, mini: true, charge: { cd: 5, mul: 2.6, dur: 1.0, min: 2.5, max: 9 } };
SLAM.minotaur = 1;

// ---------------------------------------------------------------- generación (antes de pintar el nivel)
function carveMaze(lv) {
  const isRock = (x, y) => x >= 1 && y >= 1 && x < MW - 1 && y < MH - 1 && lv.cells[y * MW + x] !== 0 && lv.roomOf[y * MW + x] < 0;
  for (let tries = 0; tries < 400; tries++) {
    const mw = randi(4, 6), mh = randi(3, 5), W = 2 * mw + 1, H = 2 * mh + 1, pw = 4, ph = 4, TW = W + pw, TH = H;
    const x0 = randi(3, MW - TW - 4), y0 = randi(3, MH - TH - 4);
    let ok = true;
    for (let y = y0 - 2; y < y0 + TH + 2 && ok; y++) for (let x = x0 - 2; x < x0 + TW + 2; x++) if (!isRock(x, y)) { ok = false; break; }
    if (!ok) continue;
    const before = lv.cells.slice();
    // laberinto perfecto (backtracker)
    const cx = (i) => x0 + 1 + 2 * i, cy = (j) => y0 + 1 + 2 * j, vis = new Uint8Array(mw * mh), deg = new Uint8Array(mw * mh), st = [[0, 0]];
    vis[0] = 1; lv.cells[cy(0) * MW + cx(0)] = 0;
    while (st.length) {
      const [i, j] = st[st.length - 1], nb = [];
      for (const [di, dj] of DIRS4) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < mw && b < mh && !vis[b * mw + a]) nb.push([a, b, di, dj]); }
      if (!nb.length) { st.pop(); continue; }
      const [a, b, di, dj] = pick(nb);
      vis[b * mw + a] = 1; deg[j * mw + i]++; deg[b * mw + a]++;
      lv.cells[(cy(j) + dj) * MW + cx(i) + di] = 0; lv.cells[cy(b) * MW + cx(a)] = 0;
      st.push([a, b]);
    }
    // entrada por la izquierda y pasillo hasta la mazmorra
    const ej = randi(0, mh - 1), ey = cy(ej);
    lv.cells[ey * MW + x0] = 0;
    // sala del premio a la derecha; la puerta buena, en la pared derecha del laberinto
    const py0 = clamp(cy(randi(0, mh - 1)) - 1, y0, y0 + TH - ph), rx = x0 + W;
    for (let y = py0; y < py0 + ph; y++) for (let x = rx; x < rx + pw - 1; x++) lv.cells[y * MW + x] = 0;
    const rows = []; for (let j = 0; j < mh; j++) if (cy(j) >= py0 && cy(j) < py0 + ph) rows.push(j);
    if (!rows.length) { lv.cells.set(before); continue; }
    const gj = pick(rows), goodI = cy(gj) * MW + x0 + W - 1;
    // puertas falsas: callejones sin salida del borde (sin contar la entrada ni la buena)
    const dead = [];
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) {
      if (deg[j * mw + i] !== 1 || (i === 0 && j === ej) || (i === mw - 1 && j === gj)) continue;
      const out = i === 0 ? [-1, 0] : i === mw - 1 ? [1, 0] : j === 0 ? [0, -1] : j === mh - 1 ? [0, 1] : null;
      if (out && !(out[0] === 1 && cy(j) >= py0 - 1 && cy(j) <= py0 + ph)) dead.push((cy(j) + out[1]) * MW + cx(i) + out[0]);
    }
    if (dead.length < 2) { lv.cells.set(before); continue; }
    const falseDoors = dead.sort(() => Math.random() - 0.5).slice(0, Math.min(4, dead.length));
    // salida de la sala del premio: reja en su pared derecha y corredor a otro pasillo
    const gy = py0 + 1 + randi(0, ph - 3), gateI = gy * MW + rx + pw - 1;
    lv.buildMask();
    for (let y = y0 - 1; y <= y0 + TH; y++) for (let x = x0 - 1; x <= x0 + TW; x++) lv.mask[y * MW + x] = 1;
    const floorFree = []; for (let i = 0; i < MW * MH; i++) if (lv.cells[i] === 0 && !lv.mask[i]) floorFree.push(i);
    const near = (sx, sy, far) => floorFree.slice().sort((a, b) => Math.hypot(a % MW - sx, ((a / MW) | 0) - sy) - Math.hypot(b % MW - sx, ((b / MW) | 0) - sy) + (far ? 0 : 0));
    let inPath = null;
    for (const t of near(x0 - 1, ey).slice(0, 6)) { lv.mask[ey * MW + x0 - 1] = 0; inPath = lv.astar(x0 - 1, ey, t % MW, (t / MW) | 0); if (inPath) break; }
    if (!inPath) { lv.cells.set(before); lv.buildMask(); continue; }
    for (const i of inPath) lv.cells[i] = 0;
    // la salida del premio debe ir a un pasillo distinto (lejos de la entrada)
    const inEnd = inPath[0];
    let outPath = null;
    const cands = near(rx + pw, gy).filter(t => Math.hypot(t % MW - inEnd % MW, ((t / MW) | 0) - ((inEnd / MW) | 0)) > 8).slice(0, 8);
    for (const t of cands) { lv.mask[gy * MW + rx + pw] = 0; outPath = lv.astar(rx + pw, gy, t % MW, (t / MW) | 0); if (outPath) break; }
    if (outPath) for (const i of outPath) lv.cells[i] = 0;
    lv.buildMask();
    // símbolos: el del acertijo en la buena y otros distintos en las falsas
    const rd = pick(LAB_RIDDLES), others = LAB_SYMS.map(s => s.id).filter(s => s !== rd.ok).sort(() => Math.random() - 0.5);
    const doors = [{ i: goodI, sym: rd.ok }].concat(falseDoors.map((i, k) => ({ i, sym: others[k] })));
    const mino = inPath[Math.min(inPath.length - 1, Math.max(0, inPath.length - 4))];
    lv.maze = {
      x0, y0, w: TW, h: TH, state: 0, ok: rd.ok, goodI, riddle: LAB_RIDDLES.indexOf(rd), doors, gate: outPath ? gateI : -1,
      prize: { x: rx, y: py0, w: pw - 1, h: ph }, entry: { x: x0 + 1.5, y: ey + 0.5 }, tablet: { x: x0 + 1.25, y: ey + 0.5 },
      mino: { x: mino % MW + 0.5, y: ((mino / MW) | 0) + 0.5 },
    };
    if (!outPath) lv.cells[gateI] = 1;
    return true;
  }
  return false;
}
// tras pintar: puertas con símbolo, reja, tablilla y luces
function applyMaze(lv) {
  const M = lv.maze; if (!M) return;
  for (const d of M.doors) lv.cells[d.i] = W_SYM + LAB_SYMS.findIndex(s => s.id === d.sym);
  if (M.gate >= 0) lv.cells[M.gate] = W_GATE;
  for (let y = M.prize.y; y < M.prize.y + M.prize.h; y++) for (let x = M.prize.x; x < M.prize.x + M.prize.w; x++) lv.floorTex[y * MW + x] = 2;
  lv.addDecor('tablet', M.tablet.x, M.tablet.y, false);
  lv.lights.push({ x: M.entry.x, y: M.entry.y, c: [0.6, 0.6, 0.9], rad: 3 });
  lv.lights.push({ x: M.prize.x + M.prize.w / 2, y: M.prize.y + M.prize.h / 2, c: [1.5, 1.2, 0.65], rad: 5 });
  for (const d of M.doors) lv.lights.push({ x: (d.i % MW) + 0.5, y: ((d.i / MW) | 0) + 0.5, c: [0.55, 0.5, 0.75], rad: 1.8 });
}
function inMaze(lv, x, y) { const M = lv && lv.maze; return !!M && x >= M.x0 - 1 && y >= M.y0 - 1 && x <= M.x0 + M.w && y <= M.y0 + M.h; }

// al poblar el nivel: el minotauro en el pasillo de entrada y el cofre del premio
function populateMaze(lv, P) {
  const M = lv.maze; if (!M) return;
  const e = spawnEnemy('minotaur', M.mino.x, M.mino.y); e.sleep = true;
  const g = 9 * G.floor, item = makeItem('vault', null, { rar: Math.random() < 0.5 ? 'legendario' : 'epico' });
  P.push({ type: 'chest', x: M.prize.x + M.prize.w / 2, y: M.prize.y + Math.floor(M.prize.h / 2) + 0.5, t: 0, gold: Math.round(g * rand(14, 20)), item: 'potion', eqItem: item });
}

// ---------------------------------------------------------------- arte: puertas con símbolo y tablilla
function labSymMask(id, x, y) { // 16x16, centro (7.5, 7.5)
  const dx = x - 7.5, dy = y - 7.5, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
  switch (id) {
    case 'sol': return r < 3.6 || (r < 7.4 && r > 5 && Math.abs(((a / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) > 0.32);
    case 'luna': return r < 6.5 && Math.hypot(dx - 2.8, dy + 1.2) > 5.2;
    case 'estrella': { const k = Math.cos(5 * (a + Math.PI / 2)) * 0.5 + 0.5; return r < 3 + 4.4 * Math.pow(k, 2.2); }
    case 'espada': return (Math.abs(dx) < 1.2 && dy > -7 && dy < 3) || (Math.abs(dy - 3) < 0.9 && Math.abs(dx) < 4.5) || (Math.abs(dx) < 0.9 && dy > 3 && dy < 7);
    case 'calavera': { const head = Math.hypot(dx, (dy + 1) * 1.1) < 5.6, jaw = Math.abs(dx) < 3 && dy > 3 && dy < 6.5, eye = Math.hypot(Math.abs(dx) - 2.2, dy + 0.5) < 1.5, nose = Math.abs(dx) < 0.6 && dy > 1.5 && dy < 3; return (head || jaw) && !eye && !nose && !(jaw && dy > 4.5 && (x & 1)); }
    case 'llama': { const t = (dy + 7) / 14; return t > 0 && t < 1 && Math.abs(dx + Math.sin(t * 6) * 0.8) < 5 * Math.sin(Math.PI * Math.pow(t, 0.7)) * (0.4 + 0.6 * t); }
    case 'llave': return (Math.abs(Math.hypot(dx + 3.5, dy) - 2.6) < 1) || (Math.abs(dy) < 0.9 && dx > -1 && dx < 7) || (dx > 3.5 && dx < 5 && dy > 0 && dy < 3.5) || (dx > 5.8 && dy > 0 && dy < 2.5);
    case 'ojo': { const al = Math.abs(dy) < 4.2 * (1 - Math.pow(dx / 7.5, 2)); return al && !(r < 2.6 && r > 1.2) || (al && r < 1.2); }
  }
  return false;
}
function symbolDoor(door, id) {
  const t = door.slice();
  for (let y = 0; y < 22; y++) for (let x = 0; x < 22; x++) { // placa de bronce
    const e = x === 0 || y === 0 || x === 21 || y === 21;
    t[(18 + y) * TS + 21 + x] = e ? rgb(60, 44, 26) : rgb(96, 72, 40);
  }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (labSymMask(id, x, y)) t[(21 + y) * TS + 24 + x] = rgb(255, 214, 120, 250); // símbolo dorado que brilla
  return t;
}
function tabletSprite() {
  const w = 22, h = 26, px = new Uint32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const top = y < 6 && Math.hypot(x - 10.5, y - 6) > 10.5, base = y >= h - 4;
    if (top) continue;
    const bx = base ? x : x, edge = bx === 0 || bx === w - 1 || y === h - 1 || (y < 7 && Math.hypot(x - 10.5, y - 6) > 9.6);
    const line = !base && y > 8 && y < h - 6 && (y % 3 === 0) && x > 3 && x < w - 4 && hash2(x, y, 12) > 0.25;
    const k = edge ? 0.5 : line ? 0.45 : 0.85 + (hash2(x, y, 13) - 0.5) * 0.12;
    px[y * w + x] = rgb(140 * k, 136 * k, 128 * k);
  }
  return { w, h, px, flash: px };
}
function labArt(lv) {
  if (!SPR.tablet) SPR.tablet = [tabletSprite()];
  const T = lv.themeObj;
  if (T && !T.labDoors && T.walls[9] instanceof Uint32Array) {
    T.labDoors = true;
    T.walls[W_GATE] = T.walls[W_BARS];
    LAB_SYMS.forEach((s, k) => { T.walls[W_SYM + k] = symbolDoor(T.walls[9], s.id); });
  }
}

// ---------------------------------------------------------------- en partida
function labTouch(lv, i, v) {
  const M = lv.maze; if (!M) return false;
  if (v === W_GATE) {
    toast(labEN() ? 'A SEALED GATE: IT WILL NOT BUDGE FROM THIS SIDE' : 'UNA REJA SELLADA: NO CEDE DESDE ESTE LADO', false); Sfx.play('locked'); G.touchCd = 1.2;
    return true;
  }
  if (v < W_SYM || v >= W_SYM + LAB_SYMS.length) return false;
  const sym = LAB_SYMS[v - W_SYM], en = labEN();
  if (M.state) { toast(en ? 'THE DOOR DOES NOT MOVE' : 'LA PUERTA NO SE MUEVE', false); G.touchCd = 1; return true; }
  if (sym.id === M.ok) {
    const goodI = M.goodI !== undefined ? M.goodI : M.doors[0].i;
    M.state = 1; lv.openCell(goodI); if (M.gate >= 0) lv.openCell(M.gate);
    if (i !== goodI) { // el símbolo bueno se movió a otra puerta: un pasaje te lleva a la sala del tesoro
      const p = G.p; vfxBlink(p.x, p.y, 'void'); p.x = M.prize.x + M.prize.w / 2; p.y = M.prize.y + 0.6; vfxBlink(p.x, p.y, 'holy');
      logMsg(en ? 'A hidden passage takes you to the treasure room' : 'Un pasaje oculto te lleva a la sala del tesoro', C.cyan);
    }
    Sfx.play('portal'); G.flashFx = 0.6; G.shake = Math.max(G.shake, 0.3);
    toast(en ? 'THE RIGHT SYMBOL: THE DOOR OPENS' : 'EL SÍMBOLO CORRECTO: LA PUERTA SE ABRE', true);
    logMsg(en ? `It was ${sym.en}. The treasure room awaits` : `Era ${sym.es}. Te espera la sala del tesoro`, C.gold);
    jot('maze' + G.dg.n, en ? `I solved the labyrinth riddle: the answer was ${sym.en}.` : `Resolví el acertijo del laberinto: la respuesta era ${sym.es}.`);
    strike('mazeriddle' + G.dg.n); chainStrike('laberinto');
    if (typeof track === 'function') track('laberinto/resuelto');
  } else {
    toast(en ? 'A FALSE DOOR! SOMETHING DRAGS YOU AWAY...' : '¡UNA PUERTA FALSA! ALGO TE ARRASTRA LEJOS...', true);
    logMsg(en ? `It was not ${sym.en}...` : `No era ${sym.es}...`, C.red);
    if (typeof track === 'function') track('laberinto/puerta-falsa');
    labShuffle(lv);
    labTeleport();
  }
  G.touchCd = 1;
  return true;
}
// el laberinto cambia: tras cada puerta falsa los símbolos se recolocan (el bueno, en otra puerta)
function labShuffle(lv) {
  const M = lv.maze, n = M.doors.length; if (n < 2) return;
  const syms = M.doors.map(d => d.sym), before = syms.indexOf(M.ok);
  for (let t = 0; t < 12; t++) { syms.sort(() => Math.random() - 0.5); if (syms.indexOf(M.ok) !== before) break; }
  M.doors.forEach((d, k) => { d.sym = syms[k]; lv.cells[d.i] = W_SYM + LAB_SYMS.findIndex(s => s.id === d.sym); });
  M.shifts = (M.shifts || 0) + 1;
  if (M.shifts === 1) jot('mazeshift' + G.dg.n, labEN() ? 'The labyrinth doors change their symbols every time I get one wrong.' : 'Las puertas del laberinto cambian de símbolo cada vez que me equivoco.');
}
// a un punto al azar de la mazmorra al que se llega sin llaves (nunca tras una puerta cerrada)
function labTeleport() {
  const dg = G.dg, reach = dg.reach(0), cand = [];
  for (const z of dg.zs) {
    const lv = dg.lv(z), R = reach[z]; if (!R) continue;
    for (let c = 0; c < MW * MH; c++) {
      if (R.d[c] < 0 || lv.cells[c] !== 0 || lv.roomOf[c] < 0) continue;
      const x = c % MW, y = (c / MW) | 0, r = lv.rooms[lv.roomOf[c]];
      if (inMaze(lv, x, y) || ['arena', 'guarida', 'secreta'].includes(r.type)) continue;
      cand.push([z, x, y]);
    }
  }
  if (!cand.length) return;
  const [z, x, y] = pick(cand), p = G.p;
  vfxBlink(p.x, p.y, 'void'); Sfx.play('dash');
  if (z !== G.z) enterLevel(z, { x: x + 0.5, y: y + 0.5, a: p.a });
  else { p.x = x + 0.5; p.y = y + 0.5; }
  vfxBlink(p.x, p.y, 'void'); G.flashFx = 0.5; p.inv = Math.max(p.inv || 0, 1);
}
// la tablilla de la entrada: se lee al acercarse (otra vez solo tras alejarse)
function labUpdate() {
  const M = G.lv && G.lv.maze, p = G.p; if (!M) return;
  const d = Math.hypot(M.tablet.x - p.x, M.tablet.y - p.y);
  if (d > 1.6) { M.near = false; return; }
  if (d < 0.85 && !M.near) {
    M.near = true;
    const rd = LAB_RIDDLES[M.riddle], en = labEN();
    G.noteOpen = { stone: true, title: { es: 'UNA TABLILLA DE PIEDRA', en: 'A STONE TABLET' }, es: rd.es.concat(['', 'Solo una puerta es la verdadera.']), en: rd.en.concat(['', 'Only one door is the true one.']) };
    G.state = 'note'; mouse.fire = false; if (document.exitPointerLock) document.exitPointerLock();
    Sfx.play('shrine');
    jot('mazeriddle' + G.dg.n, en ? `At the entrance of a labyrinth on ${levelName(G.z).replace('Nivel', 'level')}, a tablet says: "${rd.en.join(' ')}". Each door bears a symbol.`
      : `En la entrada de un laberinto del ${levelName(G.z).toLowerCase()}, una tablilla dice: «${rd.es.join(' ')}». Cada puerta lleva un símbolo.`);
  }
}
// el minotauro: barra de vida de élite al despertar y buen botín
function miniWake(e) {
  if (!e.def.mini || e.announced) return;
  e.announced = true; G.elite = e;
  toast(labEN() ? 'THE MINOTAUR!' : '¡EL MINOTAURO!', true); logMsg(labEN() ? 'A bellow echoes through the labyrinth' : 'Un bramido retumba en el laberinto', C.red);
  Sfx.play('roar'); G.shake = Math.max(G.shake, 0.5);
}
function miniKilled(e) {
  if (!e.def.mini) return;
  if (G.elite === e) G.elite = null;
  dropItem('vault', e.x, e.y + 0.3, { rar: Math.random() < 0.35 ? 'legendario' : 'epico' });
  for (let k = 0; k < 3; k++) G.pickups.push({ type: 'gold', x: e.x + rand(-0.5, 0.5), y: e.y + rand(-0.5, 0.5), v: Math.round(15 * G.floor * lootMul()), t: rand(0, 6) });
  for (let i = 0; i < 6; i++) dropGem(e.x + rand(-0.8, 0.8), e.y + rand(-0.8, 0.8), 4 * (1 + 0.5 * (G.floor - 1)));
  toast(labEN() ? 'THE MINOTAUR FALLS!' : '¡EL MINOTAURO HA CAÍDO!', true);
  jot('mino' + G.dg.n, labEN() ? 'I killed the minotaur guarding the labyrinth.' : 'Maté al minotauro que guardaba el laberinto.');
}
