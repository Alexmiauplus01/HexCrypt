// Estadísticas anónimas con GoatCounter (hexcrypt.goatcounter.com): sin cookies ni datos personales.
// Solo cuenta en la web publicada (github.io): la visita al abrir el juego y algunos momentos de la partida
// como "eventos" (modo, clase, mazmorras, Guardianes, muertes, huidas, evoluciones, secreto, app).
// Sin conexión no se envía nada y el juego funciona igual; si el contador falla o lo bloquean, se ignora.
const STATS_ON = /\.github\.io$/.test(location.hostname) || ON_ITCH; // en itch.io también (dentro de su iframe)
const statsQ = [];
function track(path, title) {
  if (!STATS_ON) return;
  try {
    const gc = window.goatcounter;
    if (gc && typeof gc.count === 'function') gc.count({ path: path, title: title || path, event: true });
    else if (statsQ.length < 30) statsQ.push([path, title]); // aún cargando el contador: se envían al terminar
  } catch (e) { /* nunca debe afectar al juego */ }
}
// cómo se abre el juego (app instalada o navegador) e idioma, una vez por sesión
// El contador se carga cuando el juego ya ha arrancado: así un fallo suyo nunca dispara el aviso de arranque.
window.addEventListener('load', () => setTimeout(() => {
  if (STATS_ON && window.__booted) {
    try {
      const s = document.createElement('script');
      s.async = true; s.src = 'https://gc.zgo.at/count.js';
      s.dataset.goatcounter = 'https://hexcrypt.goatcounter.com/count'; // con esto cuenta la visita sola al cargar
      if (ON_ITCH) s.dataset.goatcounterSettings = JSON.stringify({ allow_frame: true, path: '/itch' }); // itch mete el juego en un iframe
      s.onload = () => { const q = statsQ.splice(0); q.forEach(([p, t]) => track(p, t)); };
      document.head.appendChild(s);
    } catch (e) { /* sin estadísticas */ }
  }
  track(ON_ITCH ? 'abierto/itch' : typeof isAppMode === 'function' && isAppMode() ? 'abierto/app' : 'abierto/navegador');
  if (G.cfg && G.cfg.lang === 'en') track('idioma/ingles');
}, 2000));

// ---------------------------------------------------------------- Opinión (formulario de Tally)
// Abre el formulario con datos de la partida como campos ocultos de Tally (version, clase, nivel, mazmorra, modo,
// idioma, dispositivo): el jugador no los ve y si el formulario no los tiene creados, Tally los ignora.
const FEEDBACK_URL = 'https://tally.so/r/q5Dyed';
function feedbackUrl() {
  const q = {}, m = document.querySelector('meta[name=version]');
  q.version = m ? m.content : 'dev';
  let run = null;
  if (G.state === 'title' || G.state === 'options') { // en el título: la partida guardada, si hay
    try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (d && d.player) run = { cls: d.player.cls, lvl: d.player.lvl, n: d.dg && d.dg.n, night: d.runNight }; } catch (e) { /* sin partida */ }
  } else if (G.p && G.dg) run = { cls: G.p.cls, lvl: G.p.lvl, n: G.dg.n, night: G.runNight };
  if (run) { q.clase = run.cls; q.nivel = run.lvl; q.mazmorra = run.n; q.modo = run.night ? 'pesadilla' : 'normal'; }
  q.idioma = (G.cfg && G.cfg.lang) || 'es';
  const ua = navigator.userAgent || '';
  const os = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(ua) ? 'android' : 'pc';
  q.dispositivo = [os, ON_ITCH ? 'itch' : isAppMode() ? 'app' : 'navegador', G.padMode ? 'mando' : G.touchMode ? 'tactil' : 'teclado'].join('-');
  return FEEDBACK_URL + '?' + Object.keys(q).filter(k => q[k] !== undefined && q[k] !== null).map(k => k + '=' + encodeURIComponent(q[k])).join('&');
}
function openFeedback() {
  track('opinion/abierta');
  if (document.exitPointerLock) document.exitPointerLock();
  mouse.fire = false;
  const url = feedbackUrl();
  const go = () => { const w = window.open(url, '_blank'); if (w) { try { w.opener = null; } catch (e) { /* nada */ } } else toast('PERMITE LAS VENTANAS EMERGENTES PARA ABRIR EL FORMULARIO'); };
  // los navegadores solo abren pestañas en respuesta a un clic, una tecla o al levantar el dedo (no en touchstart):
  // si este momento no vale, se abre en cuanto el dedo se levanta
  const ua = navigator.userActivation;
  if (ua && !ua.isActive) {
    let done = false;
    const once = () => { if (done) return; done = true; document.removeEventListener('touchend', once, true); document.removeEventListener('pointerup', once, true); go(); };
    document.addEventListener('touchend', once, true); document.addEventListener('pointerup', once, true);
    setTimeout(() => { if (!done) { done = true; document.removeEventListener('touchend', once, true); document.removeEventListener('pointerup', once, true); toast('TOCA O HAZ CLIC EN DAR OPINIÓN PARA ABRIR EL FORMULARIO'); } }, 1500);
  } else go();
}
