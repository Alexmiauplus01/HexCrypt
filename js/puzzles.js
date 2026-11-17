// Acertijos: la sala de las estatuas.
// En un nivel de la mazmorra hay una sala con tres estatuas de criaturas y murales que repiten una de ellas. En otro
// nivel, junto a un cadáver, una nota ensangrentada cuenta que una expedición rompió una de las estatuas (la
// equivocada) en ese nivel y no salió bien. Golpear la estatua correcta (la de los murales) da un legendario y oro;
// golpear otra derrumba las tres y atrae a una horda. Solo cuentan los golpes del arma (cuerpo a cuerpo, flechas y
// hechizos básicos), no las habilidades ni las pasivas, para que nadie rompa una por accidente.

const PUZ_BEASTS = [
  { id: 'harpy', es: 'arpía', art: 'la', en: 'harpy', spr: () => SPR.harpy && SPR.harpy[0] },
  { id: 'dragon', es: 'dragón', art: 'el', en: 'dragon', spr: () => SPR.dragon && SPR.dragon[0] },
  { id: 'wolf', es: 'lobo', art: 'el', en: 'wolf', spr: () => SPR.wolf },
  { id: 'bear', es: 'oso', art: 'el', en: 'bear', spr: () => SPR.bear },
  { id: 'spider', es: 'araña', art: 'la', en: 'spider', spr: () => SPR.spider },
  { id: 'bat', es: 'murciélago', art: 'el', en: 'bat', spr: () => SPR.bat && SPR.bat[0] },
];
const W_MURAL = 17; // celdas de pared 17..22: mural con la criatura PUZ_BEASTS[v - W_MURAL]
const puzBeast = (id) => PUZ_BEASTS.find(b => b.id === id) || PUZ_BEASTS[0];
const puzEN = () => typeof LANG !== 'undefined' && LANG === 'en';
for (const b of PUZ_BEASTS) DECOR['statue_' + b.id] = { h: 1.0 };
DECOR.statueBroken = { h: 0.42 };
ROOM_NAME.estatuas = 'sala de las estatuas';
ROOM_HINT.estatuas = 'Esta sala está impregnada de fuerzas místicas...';

// ---------------------------------------------------------------- generación (desde Dungeon.build)
// sala de las estatuas (la usa la historia de Aldric en js/chains.js): nunca en el nivel de entrada
function planStatues(dg, z0) {
  const cand = [];
  for (const z of dg.zs) if (z !== z0) dg.levels[z].rooms.forEach(r => {
    if (r.type === 'normal' && !r.stair && r.shape !== 'round' && r.w >= 6 && r.h >= 5 && r.doors.length) cand.push({ z, r });
  });
  if (!cand.length) return null;
  const c = pick(cand);
  const ids = PUZ_BEASTS.map(b => b.id).sort(() => Math.random() - 0.5).slice(0, 3);
  const ok = pick(ids), broken = pick(ids.filter(i => i !== ok));
  c.r.type = 'estatuas';
  c.r.puzzle = { ids, ok, state: 0 };
  return { z: c.z, r: c.r, broken };
}

// texto de la nota: frases sueltas separadas por manchas de sangre (null)
function puzzleNote(zP, zN, broken) {
  const b = puzBeast(broken), down = zP < zN, lvl = levelName(zP).toLowerCase(), lvEn = levelName(zP).replace('Nivel', 'level');
  return {
    es: [`${down ? 'Bajamos' : 'Subimos'} al ${lvl}...`, null, 'tres estatuas...', null,
      `Rompimos ${b.art} ${b.es}... Un ruido tremendo. Conseguimos ${down ? 'subir' : 'bajar'}, pero nos siguieron. No sé cuánto dur`],
    en: [`We went ${down ? 'down' : 'up'} to ${lvEn}...`, null, 'three statues...', null,
      `We broke the ${b.en}... A tremendous noise. We made it back ${down ? 'up' : 'down'}, but they followed us. I don't know how long we'll la`],
    z: zP, broken,
  };
}

// amueblado de la sala: tres estatuas en fila, luz mística y murales de la criatura correcta en las paredes
function furnishPuzzle(lv, r) {
  const P = r.puzzle; if (!P) return;
  const horiz = r.w >= r.h, cx = r.cx + 0.5, cy = r.cy + 0.5;
  P.ids.forEach((id, k) => {
    const off = (k - 1) * 1.45;
    lv.addDecor('statue_' + id, horiz ? cx + off : cx, horiz ? cy : cy + off, false);
  });
  lv.lights.push({ x: cx, y: cy, c: [0.95, 0.75, 1.35], rad: 5.2 });
  const ri = lv.rooms.indexOf(r), walls = [];
  for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
    const i = y * MW + x;
    if (!lv.plainWall(i) || lv.nearSpecial(x, y)) continue;
    if (DIRS4.some(([dx, dy]) => lv.at(x + dx, y + dy) === 0 && lv.roomOf[(y + dy) * MW + x + dx] === ri)) walls.push([x, y, Math.atan2(y + 0.5 - cy, x + 0.5 - cx)]);
  }
  walls.sort((a, b) => a[2] - b[2]);
  const n = Math.min(4, walls.length), v = W_MURAL + PUZ_BEASTS.findIndex(b => b.id === P.ok);
  for (let k = 0; k < n; k++) { const [x, y] = walls[Math.floor((k + 0.5) * walls.length / n)]; lv.cells[y * MW + x] = v; }
}

// ---------------------------------------------------------------- arte: estatuas de piedra y murales pintados
function statueSprite(src) {
  const w = src.w, ph = Math.max(6, Math.round(src.h * 0.16)), h = src.h + ph, px = new Uint32Array(w * h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < w; x++) {
    const c = src.px[y * w + x]; if (!(c >>> 24)) continue;
    const l = ((c & 255) + ((c >> 8) & 255) + ((c >> 16) & 255)) / 765, n = (hash2(x, y, 7) - 0.5) * 0.12;
    const k = 0.35 + 0.85 * Math.pow(l, 0.8) + n;
    px[y * w + x] = rgb(150 * k, 146 * k, 138 * k);
  }
  // pedestal
  const pw = Math.round(w * 0.7), x0 = Math.round((w - pw) / 2);
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const edge = x === 0 || x === pw - 1 || y === 0 || y === ph - 1, top = y < 2;
    const k = edge ? 0.45 : top ? 1.05 : 0.8 - y / ph * 0.25 + (hash2(x, y, 3) - 0.5) * 0.08;
    px[(src.h + y) * w + x0 + x] = rgb(132 * k, 126 * k, 118 * k);
  }
  return { w, h, px, flash: px };
}
function rubbleSprite() {
  const w = 40, h = 18, px = new Uint32Array(w * h);
  for (let k = 0; k < 14; k++) {
    const cx = 4 + hash2(k, 1, 9) * 32, cy = 6 + hash2(k, 2, 9) * 10, r = 1.5 + hash2(k, 3, 9) * 3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.3);
      if (d < r) { const s = d > r - 1 ? 0.45 : 0.75 + (hash2(x, y, k) - 0.5) * 0.2; px[y * w + x] = rgb(140 * s, 134 * s, 126 * s); }
    }
  }
  return { w, h, px, flash: px };
}
// mural: un panel de yeso con dos figuras de la criatura pintadas en ocre y rojo
function muralTex(base, src) {
  const t = base.slice();
  for (let y = 8; y < 56; y++) for (let x = 5; x < 59; x++) {
    const frame = x < 7 || x > 56 || y < 10 || y > 53;
    const n = (hash2(x, y, 41) - 0.5) * 18, crack = hash2(x >> 1, y >> 2, 42) > 0.96;
    t[y * TS + x] = frame ? rgb(96 + n * 0.5, 70 + n * 0.4, 40) : crack ? rgb(120, 104, 86) : rgb(196 + n, 176 + n, 140 + n * 0.8);
  }
  if (!src) return t;
  const bw = 22, bh = 34, sc = Math.min(bw / src.w, bh / src.h);
  for (const ox of [18, 46]) {
    const dw = Math.round(src.w * sc), dh = Math.round(src.h * sc), x0 = ox - (dw >> 1), y0 = 48 - dh;
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const c = src.px[Math.min(src.h - 1, Math.floor(y / sc)) * src.w + Math.min(src.w - 1, Math.floor(x / sc))];
      if (!(c >>> 24)) continue;
      const l = ((c & 255) + ((c >> 8) & 255) + ((c >> 16) & 255)) / 765;
      t[(y0 + y) * TS + x0 + x] = l < 0.22 ? rgb(70, 30, 22) : l < 0.45 ? rgb(150, 54, 36) : rgb(196, 126, 58);
    }
  }
  return t;
}
// se prepara al entrar en un nivel (los sprites ya están cargados): estatuas una vez y murales por tema
function puzzleArt(lv) {
  // la mazmorra del título puede crearse antes de que acaben de cargar los sprites de Pixellab (SPR.pixReady se pone
  // al terminar): mientras tanto se usa una versión provisional y se rehace todo en cuanto están listos
  const ready = !!SPR.pixReady;
  if (ready && !puzzleArt.final) { puzzleArt.final = true; SPR.statueBroken = null; puzzleArt.gen = (puzzleArt.gen || 0) + 1; }
  if (!SPR.statueBroken) {
    for (const b of PUZ_BEASTS) { const s = b.spr(); SPR['statue_' + b.id] = [statueSprite(s && s.px ? s : SPR.skeleton[0])]; }
    SPR.statueBroken = [rubbleSprite()];
    SPR.noteItem = (() => { // pergamino enrollado: cuerpo de papel y dos rollos en los extremos
      const w = 16, h = 9, px = new Uint32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const roll = x < 3 || x > 12, body = !roll && y > 0 && y < h - 1;
        if (roll) { const k = 0.6 + 0.5 * Math.sin((y + 0.5) / h * Math.PI); px[y * w + x] = (x === 0 || x === w - 1) ? rgb(110, 80, 46) : rgb(214 * k, 184 * k, 128 * k); }
        else if (body) { const ink = y > 2 && y < h - 2 && (y & 1) && x > 4 && x < 11 && hash2(x, y, 5) > 0.35; px[y * w + x] = ink ? rgb(80, 52, 34) : hash2(x, y, 6) > 0.9 ? rgb(150, 30, 24) : rgb(232, 214, 168); }
      }
      return { w, h, px, flash: px };
    })();
  }
  const T = lv.themeObj;
  if (T && T.murals !== (puzzleArt.gen || 0) + 1) { T.murals = (puzzleArt.gen || 0) + 1; PUZ_BEASTS.forEach((b, k) => { const s = b.spr(); T.walls[W_MURAL + k] = muralTex(T.walls[4] || T.walls[1], s && s.px ? s : null); }); }
}

// ---------------------------------------------------------------- en partida
// la nota: un cadáver con un pergamino al lado (se coloca al poblar el nivel)
function placeNote(lv, r, P, used) {
  if (!r.note) return;
  const [x, y] = roomSpot(lv, r, used);
  lv.addDecor('bonepile', x - 0.2, y + 0.05, false);
  P.push({ type: 'note', x: x + 0.22, y: y - 0.05, t: 0, note: r.note });
}
function readNote(k) {
  k.dead = true; G.noteOpen = k.note; G.state = 'note'; mouse.fire = false;
  if (document.exitPointerLock) document.exitPointerLock();
  Sfx.play('unlock');
  const N = k.note, en = puzEN();
  if (N.jot) { jot('note' + G.dg.n + '_' + (N.kind || 'x') + '_' + (N.part || 1), en ? N.jot.en : N.jot.es); return; }
  const b = puzBeast(N.broken), lvl = levelName(N.z); // notas de partidas guardadas antes de las historias
  jot('note' + G.dg.n, en
    ? `I found a note next to a corpse: it spoke of three statues on ${lvl.replace('Nivel', 'level')} and said they broke the ${b.en}.`
    : `Encontré una nota junto a un cadáver: hablaba de tres estatuas en el ${lvl.toLowerCase()} y de que rompieron ${b.art} ${b.es}.`);
}
function closeNote() { G.noteOpen = null; G.state = 'play'; G.touchCd = 0.4; lockMouse(); }

// golpes del arma contra las estatuas (cuerpo a cuerpo)
function puzzleMelee(p, w) {
  let best = null, bs = Infinity;
  for (const d of G.decor) { // la que tienes más delante (cerca y centrada), no la primera a tiro
    if (!d.type.startsWith('statue_')) continue;
    const dx = d.x - p.x, dy = d.y - p.y, dist = Math.hypot(dx, dy);
    if (dist > w.range + 0.35) continue;
    let da = Math.atan2(dy, dx) - p.a; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > w.arc / 2 && dist > 0.8) continue;
    if (!G.lv.los(p.x, p.y, d.x, d.y)) continue;
    const sc = dist + Math.abs(da) * 1.2;
    if (sc < bs) { bs = sc; best = d; }
  }
  return best && strikeStatue(best) ? 1 : 0;
}
// flechas y hechizos básicos
function puzzleProj(pr) {
  if (!pr.basic) return false;
  for (const d of G.decor) {
    if (!d.type.startsWith('statue_')) continue;
    const dx = d.x - pr.x, dy = d.y - pr.y;
    if (dx * dx + dy * dy < 0.35 * 0.35) return strikeStatue(d);
  }
  return false;
}
function puzzleRoomOf(d) { const lv = G.lv, ri = lv.roomOf[Math.floor(d.y) * MW + Math.floor(d.x)]; return ri >= 0 ? lv.rooms[ri] : null; }
function strikeStatue(d) {
  const r = puzzleRoomOf(d), P = r && r.puzzle;
  if (!P || P.state) { vfxImpact(d.x, d.y, 0.5, 'steel', 0.7); Sfx.play('blade'); return true; }
  const b = puzBeast(d.type.slice(7)), en = puzEN();
  if (b.id === P.ok) {
    P.state = 1; d.glow = true;
    G.flashFx = 0.8; G.shake = Math.max(G.shake, 0.3); Sfx.play('portal');
    vfxPowerUp('holy'); burst(d.x, d.y, 0.6, 24, rgb(255, 230, 150), 2.4, 0.9, true, 0.05);
    G.lv.lights.push({ x: d.x, y: d.y, c: [1.2, 1.0, 0.6], rad: 4 });
    const legend = P.final !== false || !P.nextNote; // la última prueba: legendario y lluvia de cofres; si no, el pergamino de la siguiente
    trialPayoff(P, d.x + 0.45, d.y + 0.3, () => {
      dropItem('vault', d.x + 0.45, d.y + 0.3, { rar: 'legendario' });
      const n = randi(3, 4);
      for (let k = 0; k < n; k++) {
        const a = k / n * TAU + rand(-0.3, 0.3); let x = d.x + Math.cos(a) * 1.1, y = d.y + Math.sin(a) * 1.1;
        if (G.lv.solid(x, y)) { x = d.x + Math.cos(a) * 0.6; y = d.y + Math.sin(a) * 0.6; }
        G.pickups.push({ type: 'chest', x, y, t: 0, gold: Math.round(9 * G.floor * rand(6, 9) * lootMul()), item: null, fall: 1 + k * 0.35 });
      }
    });
    toast(en ? `THE ${b.en.toUpperCase()} STATUE OPENS UP!` : `¡LA ESTATUA DE${b.art === 'el' ? 'L' : ' LA'} ${b.es.toUpperCase()} SE ABRE!`, true);
    logMsg(legend ? (en ? 'A legendary treasure, and chests fall from the ceiling!' : '¡Un tesoro legendario, y caen cofres del techo!') : (en ? 'The statue was hiding another scroll' : 'La estatua escondía otro pergamino'), C.gold);
    trialJot('estatuas', `Resolví el acertijo de las estatuas: era ${b.art} ${b.es}, como en los murales. ${legend ? 'Dentro había un tesoro legendario y cayeron cofres del techo.' : 'Dentro había otro pergamino.'}`, `I solved the statues: it was the ${b.en}, like in the murals. ${legend ? 'Inside there was a legendary treasure and chests fell from the ceiling.' : 'Inside there was another scroll.'}`);
    chainStrike('estatuas');
    if (typeof track === 'function') track('acertijo/resuelto');
    return true;
  }
  // estatua equivocada: se derrumban las tres y acude una horda
  P.state = 2;
  for (const s of G.decor) if (s.type.startsWith('statue_') && puzzleRoomOf(s) === r) { s.type = 'statueBroken'; burst(s.x, s.y, 0.5, 22, rgb(150, 144, 136), 2.2, 0.9, false, 0.07); }
  G.shake = Math.max(G.shake, 0.7); Sfx.play('roar'); Sfx.play('boss');
  const n = Math.min(22, 8 + 2 * (G.dg ? G.dg.n : 1)), types = [pickType(), pickType(), pickType()], p = G.p;
  const cells = [];
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (G.lv.at(x, y) === 0 && Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) > 2.5) cells.push([x, y]);
  for (let i = 0; i < n && cells.length; i++) {
    const [x, y] = pick(cells), e = spawnEnemy(types[i % 3], x + rand(0.25, 0.75), y + rand(0.25, 0.75));
    e.sleep = false; vfxBlink(e.x, e.y, 'void');
  }
  toast(en ? 'THE STATUES CRUMBLE!' : '¡LAS ESTATUAS SE DESMORONAN!', true);
  logMsg(en ? `It was not the ${b.en}... a horde answers the noise` : `No era ${b.art} ${b.es}... una horda acude al estruendo`, C.red);
  trialJot('estatuas', `Rompí la estatua de${b.art === 'el' ? 'l' : ' la'} ${b.es}. No era la buena: las estatuas se derrumbaron y vino una horda a por mí.`, `I broke the ${b.en} statue. It was the wrong one: the statues crumbled and a horde came for me.`);
  chainStrike('estatuas'); chainLost(P);
  if (typeof track === 'function') track('acertijo/fallado');
  return true;
}
// al entrar por primera vez en una sala de prueba, el diario apunta lo que hay
function puzzleEnter(r) {
  const P = r.puzzle; if (!P || r.jotted) return;
  r.jotted = true;
  const en = puzEN(), L = en ? levelName(G.z).replace('Nivel', 'level') : levelName(G.z).toLowerCase();
  let t;
  const T = {
    palancas: [`En el ${L} hay una sala con tres palancas (llama, copo y rayo) y una losa sellada.`, `On ${L} there is a room with three levers (flame, snowflake and lightning) and a sealed slab.`],
    balanza: [`En el ${L} hay una balanza de bronce junto a una losa sellada. Pide oro.`, `On ${L} there is a bronze scale next to a sealed slab. It asks for gold.`],
    campanas: [`En el ${L} hay una caja de música, cuatro campanas en las paredes y una losa sellada.`, `On ${L} there is a music box, four bells on the walls and a sealed slab.`],
    baldosas: [`En el ${L} hay una sala con losas marcadas con símbolos y un cofre en el centro.`, `On ${L} there is a room with tiles marked with symbols and a chest in the middle.`],
    copas: [`En el ${L} hay un altar con tres copas: de oro, de plata y de hueso.`, `On ${L} there is an altar with three cups: gold, silver and bone.`],
    braseros: [`En el ${L} hay cinco braseros apagados bajo un mural de estrellas, y una losa sellada.`, `On ${L} there are five unlit braziers under a star mural, and a sealed slab.`],
  }[r.type];
  if (T) t = en ? T[1] : T[0];
  else { const names = P.ids.map(puzBeast); t = en ? `On ${L} there is a room with three statues: ${names.map(b => 'a ' + b.en).join(', ')}. The murals keep repeating one creature.` : `En el ${L} hay una sala con tres estatuas: ${names.map(b => (b.art === 'la' ? 'una ' : 'un ') + b.es).join(', ')}. Los murales repiten una de las criaturas.`; }
  jot('puzzleroom' + G.dg.n + '_' + r.type, t);
}
