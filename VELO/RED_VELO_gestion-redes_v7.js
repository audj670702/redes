/* ==========================================================
   TIPO:      VELO (código de página)
   PROYECTO:  SCaD Redes · Panel de Publicaciones en Redes
   SITIO:     scad.mx · Página: /gestion-redes (permiso: Solo miembros)
   ELEMENTO:  #seccPanel › #htmlPanel
   ARCHIVO:   RED_VELO_gestion-redes_v7.js
   VERSIÓN:   v7 · 2026-10-12
   DEPENDE:   RED_HTML_htmlPanel_v20.html
              backend/redes.web.js (RED_BACKEND_redes.web.js v2.4)
              backend/redesCore.js v1.1 (reconoce ?scadEO=)
   MODELO:    Puente entre el panel y el BACKEND. No lee ni escribe
              colecciones. El BACKEND valida en cada llamada: sesión de
              Wix, pertenencia APP + EO, planes, permisos y sesión única.
   CONTEXTO:  ?eo=<_id o codigoContexto>, ?scadEO=<codigoEO> (Panel SYS,
              acceso admSYS) o selección en el panel.
   COMPRA:    ?comprar=titular | colaborador (desde redes.scad.mx) abre el
              pago del plan en cuanto se conoce el estado de la cuenta, sin
              pasar por la página de planes de Wix. Requiere que la página
              tenga el permiso "Solo miembros" (no "Planes de precios").
   CAMBIOS v7: acepta ?scadEO= de Panel SYS.
   CAMBIOS v6: compra directa por parámetro ?comprar.
   CAMBIOS v5: sesión única (id del dispositivo que envía el panel);
              compra de planes; registro de empresa; colaboradores;
              cerrar sesión.
   ========================================================== */
import wixLocationFrontend from 'wix-location-frontend';
import { checkout } from 'wix-pricing-plans-frontend';
import { authentication } from 'wix-members-frontend';
import {
  obtenerContexto, cargarDatos, guardar, eliminar, registrarEmpresa,
  listarUsuarios, invitarUsuario, actualizarUsuario, quitarUsuario,
  ping, cerrarSesion
} from 'backend/redes.web';

let panel;
let ses = '';            // id de sesión del dispositivo (lo genera el panel)
let eoActiva = null;     // _id de la EO activa ya validada por el BACKEND
let ctxActual = null;    // último contexto enviado al panel
let gen = 0;             // descarta respuestas de un contexto anterior
let iniciando = null;
let compraPendiente = '';  // ?comprar= recibido al abrir la página (se usa una vez)

$w.onReady(function () {
  panel = $w('#htmlPanel');
  const q = String(wixLocationFrontend.query.comprar || '').toLowerCase();
  if (q === 'titular' || q === 'colaborador') compraPendiente = q;
  panel.onMessage(event => atender(event.data));
});

const req = () => ({ eo: eoActiva, ses });
// EO pedida en la dirección: ?eo= (panel / app) o ?scadEO= (Panel SYS)
const eoDeUrl = () => String(wixLocationFrontend.query.eo || wixLocationFrontend.query.scadEO || '');

// ---------- mensajes del panel ----------
async function atender(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.ses) ses = String(msg.ses);
  try {
    switch (msg.type) {
      case 'ready':
        if (ctxActual) { panel.postMessage(ctxActual); if (eoActiva) await enviarDatos(gen); }
        else await iniciar(eoDeUrl());
        break;
      case 'reload':
        if (eoActiva) await enviarDatos(gen);
        else { ctxActual = null; await iniciar(eoDeUrl()); }
        break;
      case 'switchEO':
        await cambiarEO(String(msg.eoId || ''));
        break;
      case 'retry':
        ctxActual = null; eoActiva = null; gen++;
        await iniciar(String(msg.eoId || eoDeUrl()));
        break;
      case 'ping':
        if (eoActiva) await ping(req());
        break;
      case 'comprar':
        await comprar(msg.plan);
        break;
      case 'logout':
        await cerrarSesion(req()).catch(() => null);
        ctxActual = null; eoActiva = null; gen++;
        await authentication.logout();
        break;
      case 'registrar': {
        const r = await registrarEmpresa({ ses }, msg.datos || {});
        if (!r.ok) { responder(msg.reqId, false, null, r.error); break; }
        responder(msg.reqId, true, null);
        await aplicar(r.data, ++gen, '');
        break;
      }
      case 'save':            // un registro
        await operar(msg, () => guardar(req(), msg.col, [msg.item]), true, true);
        break;
      case 'saveMany':        // varios registros (serie de fechas)
        await operar(msg, () => guardar(req(), msg.col, msg.items), false, true);
        break;
      case 'remove':          // un registro
        await operar(msg, () => eliminar(req(), msg.col, [msg.id]), false, true);
        break;
      case 'removeMany':      // varios registros (serie completa)
        await operar(msg, () => eliminar(req(), msg.col, msg.ids), false, true);
        break;
      case 'usrList':
        await operar(msg, () => listarUsuarios(req()), false, false);
        break;
      case 'usrInvite':
        await operar(msg, () => invitarUsuario(req(), msg.datos || {}), false, false);
        break;
      case 'usrUpdate':
        await operar(msg, () => actualizarUsuario(req(), msg.usrId, msg.datos || {}), false, false);
        break;
      case 'usrRemove':
        await operar(msg, () => quitarUsuario(req(), msg.usrId), false, false);
        break;
    }
  } catch (err) {
    console.error('[gestion-redes]', err);
    responder(msg.reqId, false, null, { code: 'ERROR', message: 'No se pudo completar la operación.' });
  }
}

// ---------- contexto ----------
async function iniciar(eoPedida) {
  if (iniciando) return iniciando;
  iniciando = (async () => {
    const mi = ++gen;
    eoActiva = null;
    const r = await obtenerContexto({ eo: eoPedida || null, ses });
    if (mi !== gen) return;
    if (!r.ok) {
      ctxActual = null;
      panel.postMessage(r.error.code === 'NOAUTH' ? { type: 'noauth' } : { type: 'sinacceso', message: r.error.message });
      return;
    }
    await aplicar(r.data, mi, eoPedida);
  })();
  try { await iniciando; } finally { iniciando = null; }
  if (compraPendiente && ctxActual) await compraDirecta();
}

// Compra pedida desde la APP: solo se abre el pago cuando el estado lo requiere
async function compraDirecta() {
  const tipo = compraPendiente;
  compraPendiente = '';
  wixLocationFrontend.queryParams.remove(['comprar']);
  const e = ctxActual.estado;
  const titular = ctxActual.titular || ((ctxActual.usuario || {}).rol === 'TITULAR');
  if (tipo === 'titular' && (e === 'comprar_titular' || (e === 'suspendida' && titular))) return comprar('titular');
  if (tipo === 'colaborador' && e === 'comprar_colaborador') return comprar('colaborador');
  if (tipo === 'colaborador' && e === 'comprar_titular') {
    // Aún no hay invitación para este correo: no se cobra
    ctxActual = Object.assign({}, ctxActual, {
      aviso: 'No encontramos una invitación para ' + (ctxActual.email || 'tu correo') +
        '. Pide al titular que te invite desde su pestaña Usuarios; después activa aquí tu acceso de colaborador.'
    });
    panel.postMessage(ctxActual);
  }
  // En cualquier otro estado (ya tiene plan, registro, ok…) se muestra el panel normal
}

async function aplicar(c, mi, eoPedida) {
  eoActiva = c.estado === 'ok' && c.activa ? c.activa._id : null;
  ctxActual = {
    type: 'context',
    estado: c.estado,
    eos: c.eos || [],
    activa: c.activa || null,
    usuario: c.usuario || null,
    email: c.email || '',
    titular: !!c.titular,
    permisos: c.permisos || {},
    marcasPermitidas: c.marcasPermitidas || null,
    limiteMarcas: c.limiteMarcas || 3,
    aviso: c.aviso || (eoPedida && !c.activa && c.estado === 'elegir' ? 'No tienes acceso a la empresa solicitada. Elige una de tus empresas.' : '')
  };
  panel.postMessage(ctxActual);
  if (eoActiva) {
    if (wixLocationFrontend.query.eo !== eoActiva && wixLocationFrontend.query.eo !== (c.activa && c.activa.codigo)) {
      wixLocationFrontend.queryParams.add({ eo: c.activa.codigo || eoActiva });
    }
    await enviarDatos(mi);
  }
}

async function cambiarEO(eoId) {
  if (!eoId || eoId === eoActiva) return;
  ctxActual = null;
  eoActiva = null;
  gen++;
  if (iniciando) await iniciando.catch(() => null);
  await iniciar(eoId);
}

async function enviarDatos(mi) {
  const eo = eoActiva;
  if (!eo) return;
  const r = await cargarDatos({ eo, ses });
  if (mi !== gen || eo !== eoActiva) return;   // cambió la EO mientras se cargaba
  if (!r.ok) {
    if (r.error.code === 'NOAUTH') panel.postMessage({ type: 'noauth' });
    else if (r.error.code === 'SESION' || r.error.code === 'SUSPENDIDA') { ctxActual = null; await iniciar(eo); }
    else panel.postMessage({ type: 'sinacceso', message: r.error.message });
    return;
  }
  panel.postMessage({ type: 'data', eo, marcas: r.data.marcas, publicaciones: r.data.publicaciones });
}

// ---------- compra de planes ----------
async function comprar(tipo) {
  const planes = { titular: '72971ae6-8235-4e95-b595-c924edf36f2b', colaborador: '099b36c6-c746-407c-9b15-2ba19661ddd4' };
  const planId = planes[tipo];
  if (!planId) return;
  try {
    await checkout.startOnlinePurchase(planId);
  } catch (err) {
    console.warn('[gestion-redes] compra', err);
  }
  // Al volver de la compra se recalcula el acceso
  ctxActual = null; eoActiva = null; gen++;
  await iniciar(eoDeUrl());
}

// ---------- operaciones ----------
// Rechaza operaciones pedidas para una EO que ya no es la activa
async function operar(msg, fn, uno, recargar) {
  if (!eoActiva || msg.eo !== eoActiva) {
    responder(msg.reqId, false, null, { code: 'CONTEXTO', message: 'La empresa activa cambió. Vuelve a intentarlo.' });
    return;
  }
  const mi = gen;
  const r = await fn();
  if (!r.ok) {
    responder(msg.reqId, false, null, r.error);
    if (r.error.code === 'SESION' || r.error.code === 'SUSPENDIDA') { ctxActual = null; await iniciar(eoActiva); }
    return;
  }
  const item = Array.isArray(r.data) ? (uno && r.data.length === 1 ? r.data[0] : r.data) : r.data;
  responder(msg.reqId, true, item);
  if (recargar) await enviarDatos(mi);
}

function responder(reqId, ok, item, error) {
  if (!reqId) return;
  panel.postMessage({
    type: 'result', reqId, ok, item,
    error: error ? { code: String(error.code || ''), message: String(error.message || '') } : null
  });
}
