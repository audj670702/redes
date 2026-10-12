/* ==========================================================
   TIPO:      VELO (código de página)
   PROYECTO:  SCaD Redes · Panel de Publicaciones en Redes
   SITIO:     scad.mx · Página: /gestion-redes
   ELEMENTO:  #seccPanel › #htmlPanel
   ARCHIVO:   RED_VELO_gestion-redes_v4.js
   VERSIÓN:   v4 · 2026-10-11
   DEPENDE:   RED_HTML_htmlPanel_v17.html
              backend/redes.web.js (RED_BACKEND_redes.web.js v1)
   MODELO:    Multiempresa (APP + EO). Esta página ya no lee ni escribe
              colecciones: es el puente entre el panel y el BACKEND, que
              valida el contexto en cada operación.
   CONTEXTO:  La EO se toma del parámetro ?eo=<_id de SCaD_EO> (Panel SYS
              abre la APP así) o de la selección del usuario en el panel.
              El parámetro solo indica qué EO se pide; el BACKEND decide
              si el usuario de la sesión tiene acceso.
   CAMBIOS v4: integración multiempresa; mensajes nuevos: context,
              sinacceso y switchEO; cada operación viaja con su EO y se
              rechaza si ya no es la EO activa.
   ========================================================== */
import wixLocationFrontend from 'wix-location-frontend';
import { obtenerContexto, cargarDatos, guardar, eliminar } from 'backend/redes.web';

let panel;
let eoActiva = null;     // _id de la EO activa ya validada por el BACKEND
let ctxActual = null;    // último contexto enviado al panel
let gen = 0;             // generación de contexto: descarta respuestas de una EO anterior
let iniciando = null;

$w.onReady(function () {
  panel = $w('#htmlPanel');
  panel.onMessage(event => atender(event.data));
});

// ---------- mensajes del panel ----------
async function atender(msg) {
  if (!msg || typeof msg !== 'object') return;
  try {
    switch (msg.type) {
      case 'ready':
        if (ctxActual) { panel.postMessage(ctxActual); if (eoActiva) await enviarDatos(gen); }
        else await iniciar(wixLocationFrontend.query.eo || '');
        break;
      case 'reload':
        if (eoActiva) await enviarDatos(gen);
        else await iniciar(wixLocationFrontend.query.eo || '');
        break;
      case 'switchEO':
        await cambiarEO(String(msg.eoId || ''));
        break;
      case 'save':            // un registro
        await operar(msg, () => guardar(eoActiva, msg.col, [msg.item]), true);
        break;
      case 'saveMany':        // varios registros (serie de fechas)
        await operar(msg, () => guardar(eoActiva, msg.col, msg.items), false);
        break;
      case 'remove':          // un registro
        await operar(msg, () => eliminar(eoActiva, msg.col, [msg.id]), false);
        break;
      case 'removeMany':      // varios registros (serie completa)
        await operar(msg, () => eliminar(eoActiva, msg.col, msg.ids), false);
        break;
    }
  } catch (err) {
    responder(msg.reqId, false, null, { code: 'ERROR', message: 'No se pudo completar la operación.' });
  }
}

// ---------- contexto ----------
async function iniciar(eoPedida) {
  if (iniciando) return iniciando;
  iniciando = (async () => {
    const mi = ++gen;
    eoActiva = null;
    const r = await obtenerContexto(eoPedida || null);
    if (mi !== gen) return;
    if (!r.ok) {
      ctxActual = null;
      panel.postMessage(r.error.code === 'NOAUTH'
        ? { type: 'noauth' }
        : { type: 'sinacceso', message: r.error.message });
      return;
    }
    const c = r.data;
    eoActiva = c.activa ? c.activa._id : null;
    ctxActual = {
      type: 'context',
      app: c.app,
      eos: c.eos,
      activa: c.activa,
      rol: c.rol,
      asistencia: c.asistencia,
      permisos: c.permisos,
      aviso: eoPedida && !c.activa ? 'No tienes acceso a la empresa solicitada. Elige una de tus empresas.' : ''
    };
    panel.postMessage(ctxActual);
    if (eoActiva) {
      if (wixLocationFrontend.query.eo !== eoActiva) wixLocationFrontend.queryParams.add({ eo: eoActiva });
      await enviarDatos(mi);
    }
  })();
  try { await iniciando; } finally { iniciando = null; }
}

async function cambiarEO(eoId) {
  if (!eoId || eoId === eoActiva) return;
  // Se descarta el contexto anterior antes de pedir el nuevo
  ctxActual = null;
  eoActiva = null;
  gen++;
  if (iniciando) await iniciando.catch(() => null);
  await iniciar(eoId);
}

async function enviarDatos(mi) {
  const eo = eoActiva;
  if (!eo) return;
  const r = await cargarDatos(eo);
  if (mi !== gen || eo !== eoActiva) return;   // cambió la EO mientras se cargaba
  if (!r.ok) {
    if (r.error.code === 'NOAUTH') panel.postMessage({ type: 'noauth' });
    else panel.postMessage({ type: 'sinacceso', message: r.error.message });
    return;
  }
  panel.postMessage({ type: 'data', eo, marcas: r.data.marcas, publicaciones: r.data.publicaciones });
}

// ---------- operaciones ----------
// Rechaza operaciones pedidas para una EO que ya no es la activa
async function operar(msg, fn, uno) {
  if (!eoActiva || msg.eo !== eoActiva) {
    responder(msg.reqId, false, null, { code: 'CONTEXTO', message: 'La empresa activa cambió. Vuelve a intentarlo.' });
    return;
  }
  const mi = gen;
  const r = await fn();
  if (!r.ok) { responder(msg.reqId, false, null, r.error); return; }
  const item = Array.isArray(r.data) ? (uno && r.data.length === 1 ? r.data[0] : r.data) : null;
  responder(msg.reqId, true, item);
  await enviarDatos(mi);
}

function responder(reqId, ok, item, error) {
  if (!reqId) return;
  panel.postMessage({
    type: 'result', reqId, ok, item,
    error: error ? { code: String(error.code || ''), message: String(error.message || '') } : null
  });
}
