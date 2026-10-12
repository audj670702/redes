/* ==========================================================
   TIPO:      VELO (código de página)
   PROYECTO:  Panel de Publicaciones en Redes
   SITIO:     scad.mx · Página: /gestion-redes
   ELEMENTO:  #seccPanel › #htmlPanel
   ARCHIVO:   RED_VELO_gestion-redes_v3.js
   VERSIÓN:   v3 · 2026-10-11
   DEPENDE:   RED_HTML_htmlPanel_v3.html · colecciones RedesCanales
              (Redes · Marcas) y RedesPublicaciones
   BACKEND:   No aplica (lectura y escritura directa con permisos
              de "Miembros del sitio"; acceso a la página por rol nativo)
   CAMBIOS v3: guardado y eliminación en lote (series de fechas);
              campos nuevos: serie (publicaciones) y logo (marcas).
   ========================================================== */
import wixData from 'wix-data';
import { currentMember } from 'wix-members-frontend';

const COL = {
  marcas: 'RedesCanales',
  publicaciones: 'RedesPublicaciones'
};

// Campos permitidos por colección (lo que llegue del panel fuera de esta lista se ignora)
const CAMPOS = {
  marcas: ['nombre', 'descripcion', 'color', 'activo', 'orden', 'redesActivas', 'cuentas', 'logo'],
  publicaciones: ['titulo', 'canal', 'redes', 'texto', 'fechaProgramada', 'formato', 'estado',
    'responsable', 'urlMaterial', 'urlPublicada', 'fechaPublicada', 'notas', 'serie']
};
const CAMPOS_FECHA = ['fechaProgramada', 'fechaPublicada'];
const LIMITE = 1000;
const MAX_LOTE = 100;

let panel;

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
      case 'reload':
        await enviarDatos();
        break;
      case 'save':            // un registro
        await guardarLote(msg.col, [msg.item], msg.reqId);
        break;
      case 'saveMany':        // varios registros (serie de fechas)
        await guardarLote(msg.col, msg.items, msg.reqId);
        break;
      case 'remove':          // un registro
        await eliminarLote(msg.col, [msg.id], msg.reqId);
        break;
      case 'removeMany':      // varios registros (serie completa)
        await eliminarLote(msg.col, msg.ids, msg.reqId);
        break;
    }
  } catch (err) {
    responder(msg.reqId, false, null, err);
  }
}

async function enviarDatos() {
  const miembro = await currentMember.getMember().catch(() => null);
  if (!miembro) {
    panel.postMessage({ type: 'noauth' });
    return;
  }
  const [marcas, publicaciones] = await Promise.all([
    traer(COL.marcas, q => q.ascending('orden')),
    traer(COL.publicaciones, q => q.descending('fechaProgramada'))
  ]);
  panel.postMessage({
    type: 'data',
    marcas: marcas.map(limpiar),
    publicaciones: publicaciones.map(limpiar)
  });
}

async function traer(coleccion, ordenar) {
  const res = await ordenar(wixData.query(coleccion)).limit(LIMITE).find();
  return res.items;
}

// ---------- guardar ----------
function preparar(tipo, entrada) {
  const item = {};
  CAMPOS[tipo].forEach(k => {
    if (!(k in entrada)) return;
    let v = entrada[k];
    if (CAMPOS_FECHA.includes(k)) v = v ? new Date(v) : null;
    if (v === '') v = null;
    item[k] = v;
  });
  if (entrada._id) item._id = entrada._id;
  return item;
}

async function guardarLote(tipo, entradas, reqId) {
  if (!COL[tipo]) throw new Error('Colección no válida');
  if (!Array.isArray(entradas) || !entradas.length) throw new Error('Sin registros');
  if (entradas.length > MAX_LOTE) throw new Error('Demasiados registros en un solo envío');

  const guardados = [];
  // Secuencial: cada actualización conserva los campos que no envió el panel
  for (const entrada of entradas) {
    const item = preparar(tipo, entrada || {});
    let g;
    if (item._id) {
      const actual = await wixData.get(COL[tipo], item._id);
      g = await wixData.update(COL[tipo], { ...actual, ...item });
    } else {
      g = await wixData.insert(COL[tipo], item);
    }
    guardados.push(limpiar(g));
  }
  responder(reqId, true, guardados.length === 1 ? guardados[0] : guardados);
  await enviarDatos();
}

// ---------- eliminar ----------
async function eliminarLote(tipo, ids, reqId) {
  if (!COL[tipo]) throw new Error('Colección no válida');
  const lista = (ids || []).filter(Boolean);
  if (!lista.length) throw new Error('Sin registros');
  if (lista.length > MAX_LOTE) throw new Error('Demasiados registros en un solo envío');
  if (lista.length === 1) await wixData.remove(COL[tipo], lista[0]);
  else await wixData.bulkRemove(COL[tipo], lista);
  responder(reqId, true, null);
  await enviarDatos();
}

// ---------- utilidades ----------
function responder(reqId, ok, item, err) {
  if (!reqId) return;
  panel.postMessage({
    type: 'result', reqId, ok, item,
    error: err ? { code: String(err.code || ''), message: String(err.message || err) } : null
  });
}

// Fechas a texto ISO y referencias a solo el ID, para que viajen bien al componente
function limpiar(it) {
  const o = {};
  Object.keys(it || {}).forEach(k => {
    if (k === '_owner' || k.startsWith('link-')) return; // campos internos de páginas dinámicas
    let v = it[k];
    if (v instanceof Date) v = v.toISOString();
    else if (k === 'canal' && v && typeof v === 'object' && v._id) v = v._id;
    o[k] = v;
  });
  return o;
}