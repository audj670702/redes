/* ==========================================================
   TIPO:      HTML (APP · lógica)
   PROYECTO:  SCaD Redes · APP (redes.scad.mx)
   ARCHIVO:   app.js
   VERSIÓN:   v1.0.0 · 2026-10-12
   SESIÓN:    Token SYS (sys-autenticacion?app=REDES → #t=<token>).
              Se guarda en el dispositivo y se renueva en silencio antes de
              vencer (hasta 30 días desde el inicio de sesión), así la sesión
              sigue abierta aunque la app se cierre o se minimice.
              Solo "Cerrar sesión", la baja del usuario o los 30 días la terminan.
   ========================================================== */
const VERSION = 'v1.0.0';
const CFG = {
  AUTH: 'https://www.scad.mx/sys-autenticacion',
  CTX: 'https://www.scad.mx/_functions/redesPwaContext',
  REFRESH: 'https://www.scad.mx/_functions/redesTokenRefresh',
  PANEL: 'https://www.scad.mx/gestion-redes',
  APP: 'REDES',
  RENOVAR_ANTES_SEG: 2 * 60 * 60
};
const K = { token: 'redes.sys.token', ctx: 'redes.sys.ctx' };

const NETS = {
  facebook: { n: 'Facebook', c: '#1877F2', a: 'f' }, instagram: { n: 'Instagram', c: '#C13584', a: 'IG' },
  youtube: { n: 'YouTube', c: '#FF0000', a: '▶' }, tiktok: { n: 'TikTok', c: '#111111', a: '♪' },
  x: { n: 'X', c: '#111111', a: 'X' }, threads: { n: 'Threads', c: '#111111', a: '@' },
  linkedin: { n: 'LinkedIn', c: '#0A66C2', a: 'in' }, whatsapp: { n: 'Canal WhatsApp', c: '#25D366', a: 'W' }
};

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = u => /^https:\/\//i.test(String(u || '')) ? String(u) : '';
const safeImg = u => /^data:image\/(png|jpeg|webp);base64,/i.test(String(u || '')) || /^https:\/\//i.test(String(u || '')) ? String(u) : '';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } }
};
const appUrl = () => location.origin + location.pathname;
let aviso = '';
let instalar = null;

/* ---------- token ---------- */
function expDe(token) {
  try {
    const p = String(token || '').split('.')[1] || '';
    return Number(JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/'))).exp) || 0;
  } catch { return 0; }
}
function capturarToken() {
  const m = /(?:^#|&)t=([^&]+)/.exec(location.hash || '');
  const q = new URLSearchParams(location.search);
  if (q.get('logoutDone') === '1') { store.del(K.token); store.del(K.ctx); }
  if (m) { store.set(K.token, decodeURIComponent(m[1])); store.del(K.ctx); }
  if (m || q.toString()) history.replaceState({}, '', appUrl());
}
function cerrarLocal(msg) { store.del(K.token); store.del(K.ctx); aviso = msg || ''; }

async function renovarSiHaceFalta(forzar) {
  const token = store.get(K.token);
  if (!token) return false;
  const falta = expDe(token) - Math.floor(Date.now() / 1000);
  if (!forzar && falta > CFG.RENOVAR_ANTES_SEG) return true;
  try {
    const r = await fetch(CFG.REFRESH, { method: 'POST', mode: 'cors', cache: 'no-store', credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}' });
    if (r.status === 401) { cerrarLocal('Tu sesión terminó. Inicia sesión de nuevo.'); return false; }
    const d = await r.json().catch(() => null);
    if (r.ok && d && d.ok && d.token) { store.set(K.token, d.token); return true; }
  } catch { /* sin conexión: se conserva el token actual */ }
  return falta > 0;
}

/* ---------- contexto ---------- */
async function cargarContexto() {
  const token = store.get(K.token);
  if (!token) return null;
  const r = await fetch(CFG.CTX, { method: 'GET', mode: 'cors', cache: 'no-store', credentials: 'omit',
    headers: { Accept: 'application/json', Authorization: 'Bearer ' + token } });
  if (r.status === 401) {
    if (await renovarSiHaceFalta(true)) return cargarContexto();
    cerrarLocal('Tu sesión terminó o tu acceso ya no está activo. Inicia sesión de nuevo.');
    return null;
  }
  const d = await r.json().catch(() => null);
  if (!r.ok || !d || !d.ok) throw new Error((d && d.mensaje) || 'No fue posible cargar tu empresa.');
  store.set(K.ctx, JSON.stringify(d));
  return d;
}

/* ---------- acciones ---------- */
function iniciarSesion() {
  const u = new URL(CFG.AUTH);
  u.searchParams.set('app', CFG.APP);
  u.searchParams.set('returnUrl', appUrl());
  location.assign(u.toString());
}
function cerrarSesion() {
  cerrarLocal('');
  const u = new URL(CFG.AUTH);
  u.searchParams.set('app', CFG.APP);
  u.searchParams.set('returnUrl', appUrl());
  u.searchParams.set('logout', '1');
  location.assign(u.toString());
}

/* ---------- vistas ---------- */
function vistaPresentacion() {
  $('#onair').hidden = true;
  return `
  <section class="hero">
    <h1>Tus redes, <em>al aire</em> y bajo control.</h1>
    <p>Registra, programa y da seguimiento a las publicaciones de tus marcas en Facebook, YouTube, TikTok, Instagram y más, desde un solo panel.</p>
    <div class="acts">
      <a class="btn accent block" href="${CFG.PANEL}">Adquirir PLAN REDES</a>
      <button class="btn primary block" data-act="login" type="button">Iniciar sesión</button>
      <button class="btn block" data-act="instalar" type="button" ${instalar ? '' : 'hidden'}>Instalar en este dispositivo</button>
    </div>
    ${aviso ? `<p class="note">${esc(aviso)}</p>` : ''}
  </section>
  <h2 class="sec">Qué incluye</h2>
  <ul class="feats">
    <li><span class="ic" aria-hidden="true">📅</span><div><b>Calendario y tablero</b><span>Ve de un vistazo qué sale hoy, esta semana y qué está atrasado.</span></div></li>
    <li><span class="ic" aria-hidden="true">🏷️</span><div><b>Por marca y por red</b><span>Hasta 3 marcas, cada una con sus redes activas y sus ligas.</span></div></li>
    <li><span class="ic" aria-hidden="true">🔁</span><div><b>Series de fechas</b><span>La misma publicación programada en varias fechas, en un solo paso.</span></div></li>
    <li><span class="ic" aria-hidden="true">✅</span><div><b>Control de estado</b><span>Idea, borrador, revisión, programado, publicado; con alertas de lo que no se registró.</span></div></li>
    <li><span class="ic" aria-hidden="true">📄</span><div><b>Reportes en PDF</b><span>Exporta lo programado o publicado con la identidad de tu marca.</span></div></li>
    <li><span class="ic" aria-hidden="true">👥</span><div><b>Colaboradores</b><span>Invita a tu equipo y define qué puede hacer cada quien y en qué marcas.</span></div></li>
  </ul>
  <h2 class="sec">Planes</h2>
  <div class="prices">
    <div class="price main"><div class="n">PLAN REDES</div><div class="p">$49 <small>MXN / mes</small></div><div class="d">Titular de la empresa. Incluye el panel completo y hasta 3 marcas.</div></div>
    <div class="price"><div class="n">Colaborador</div><div class="p">$39 <small>MXN / mes</small></div><div class="d">Por cada colaborador que invites, con su propia cuenta.</div></div>
  </div>
  <a class="btn accent block" href="${CFG.PANEL}">Empezar ahora</a>`;
}

function iniciales(nombre) {
  return esc(String(nombre || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'EO');
}

function vistaEO(c) {
  $('#onair').hidden = false;
  const a = c.activa || {}, u = c.usuario || {};
  const rol = { TITULAR: 'Titular', COLABORADOR: 'Colaborador', ASISTENCIA: 'Asistencia SYS' }[u.rol] || '';
  const lg = safeImg(a.logo);
  let h = `
  <section class="eo">
    <div class="lg">${lg ? `<img src="${esc(lg)}" alt="">` : `<span>${iniciales(a.nombre)}</span>`}</div>
    <div><h1>${esc(a.nombre || 'Mi empresa')}</h1>
      <div class="who">${esc(u.nombre || '')}${rol ? `<span class="tag ${u.rol === 'ASISTENCIA' ? 'asis' : ''}">${rol}</span>` : ''}</div></div>
  </section>`;

  if (c.estado === 'ok') {
    h += `<a class="btn primary block" href="${esc(safeUrl(c.urlPanel) || CFG.PANEL)}">Entrar al panel</a>`;
    const marcas = Array.isArray(c.marcas) ? c.marcas : [];
    if (!marcas.length) {
      h += `<div class="brands"><div class="empty">Aún no hay marcas con redes.<br>Agrégalas desde el panel, en la pestaña Marcas.</div></div>`;
    } else {
      h += `<div class="brands">` + marcas.map(m => {
        const color = /^#[0-9a-f]{3,8}$/i.test(m.color || '') ? m.color : '#042B62';
        const mlg = safeImg(m.logo);
        const redes = (m.redes || []).filter(r => safeUrl(r.url));
        return `<section class="brand" style="--c:${color}">
          <header>${mlg ? `<img src="${esc(mlg)}" alt="">` : `<span class="dot"></span>`}
            <div><h3>${esc(m.nombre)}</h3>${m.descripcion ? `<div class="ds">${esc(m.descripcion)}</div>` : ''}</div></header>
          ${redes.length ? `<div class="nets">${redes.map(r => {
            const n = NETS[r.red] || { n: r.red, c: '#5D6675', a: '•' };
            return `<a class="net" href="${esc(r.url)}" target="_blank" rel="noopener"><span class="b" style="background:${n.c}" aria-hidden="true">${esc(n.a)}</span>${esc(n.n)}</a>`;
          }).join('')}</div>` : `<div class="nets"><span class="muted" style="font-size:13px">Sin ligas de redes registradas.</span></div>`}
        </section>`;
      }).join('') + `</div>`;
    }
  } else {
    const t = {
      suspendida: ['Suscripción no vigente', u.rol === 'TITULAR'
        ? 'Tu suscripción PLAN REDES no está activa. Tus datos se conservan; renuévala para continuar.'
        : 'La suscripción de esta empresa no está activa. Pide al titular que la renueve.'],
      comprar_colaborador: ['Activa tu acceso', 'Te invitaron como colaborador. Para entrar necesitas tu suscripción COLABORADOR REDES ($39 MXN / mes).']
    }[c.estado] || ['Acceso no disponible', 'Entra al panel para revisar el estado de tu cuenta.'];
    const boton = c.estado === 'comprar_colaborador' ? 'Adquirir COLABORADOR REDES'
      : (c.estado === 'suspendida' && u.rol === 'TITULAR' ? 'Renovar PLAN REDES' : 'Ir al panel');
    h += `<section class="state card"><h2>${t[0]}</h2><p class="muted" style="margin:0 0 14px">${t[1]}</p>
      <a class="btn accent block" href="${esc(safeUrl(c.urlPanel) || CFG.PANEL)}">${boton}</a></section>`;
  }

  h += `<div class="foot">
    ${c.varias ? `<button class="btn ghost" data-act="cambiar" type="button">Cambiar empresa</button>` : ''}
    <button class="btn ghost" data-act="instalar" type="button" ${instalar ? '' : 'hidden'}>Instalar app</button>
    <button class="btn ghost" data-act="logout" type="button">Cerrar sesión</button>
  </div>`;
  if (c._offline) h += `<p class="note">Sin conexión: se muestra la última información guardada.</p>`;
  return h;
}

function pintar(html) { $('#view').innerHTML = html; }

/* ---------- arranque ---------- */
async function iniciar() {
  capturarToken();
  if (!store.get(K.token)) { pintar(vistaPresentacion()); return; }

  // Muestra de inmediato lo último guardado y luego actualiza
  let guardado = null;
  try { guardado = JSON.parse(store.get(K.ctx) || 'null'); } catch { guardado = null; }
  if (guardado) pintar(vistaEO(guardado));

  try {
    await renovarSiHaceFalta(false);
    const c = await cargarContexto();
    if (!c) { pintar(vistaPresentacion()); return; }
    pintar(vistaEO(c));
  } catch (e) {
    if (guardado) pintar(vistaEO({ ...guardado, _offline: true }));
    else { aviso = 'No fue posible conectar. Revisa tu conexión e intenta de nuevo.'; pintar(vistaPresentacion()); }
  }
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'login' || act === 'cambiar') { b.disabled = true; iniciarSesion(); }
  else if (act === 'logout') { b.disabled = true; cerrarSesion(); }
  else if (act === 'instalar' && instalar) { instalar.prompt(); instalar = null; b.hidden = true; }
});

// Regreso del login a la misma página (solo cambia el #t=)
window.addEventListener('hashchange', () => { if (/(?:^#|&)t=/.test(location.hash)) iniciar(); });

// Al volver a la app (desde segundo plano) se renueva y actualiza en silencio
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && store.get(K.token)) iniciar();
});
setInterval(() => { if (store.get(K.token)) renovarSiHaceFalta(false); }, 30 * 60 * 1000);

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); instalar = e;
  document.querySelectorAll('[data-act="instalar"]').forEach(b => { b.hidden = false; });
});

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sin service worker */ });
}

$('#ver').textContent = VERSION;
iniciar();
