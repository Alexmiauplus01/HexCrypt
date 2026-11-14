// Estadísticas anónimas con GoatCounter (hexcrypt.goatcounter.com): sin cookies ni datos personales.
// Solo cuenta en la web publicada (github.io): la visita al abrir el juego y algunos momentos de la partida
// como "eventos" (modo, clase, mazmorras, Guardianes, muertes, huidas, evoluciones, secreto, app).
// Sin conexión no se envía nada y el juego funciona igual; si el contador falla o lo bloquean, se ignora.
const STATS_ON = /\.github\.io$/.test(location.hostname);
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
      s.onload = () => { const q = statsQ.splice(0); q.forEach(([p, t]) => track(p, t)); };
      document.head.appendChild(s);
    } catch (e) { /* sin estadísticas */ }
  }
  track(typeof isAppMode === 'function' && isAppMode() ? 'abierto/app' : 'abierto/navegador');
  if (G.cfg && G.cfg.lang === 'en') track('idioma/ingles');
}, 2000));
