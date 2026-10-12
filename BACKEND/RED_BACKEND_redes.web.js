/* ==========================================================
   TIPO:      BACKEND (módulo web)
   PROYECTO:  SCaD Redes · Panel de Publicaciones en Redes
   SITIO:     scad.mx
   ARCHIVO:   RED_BACKEND_redes.web.js
              En Wix se instala como:  backend/redes.web.js
   VERSIÓN:   v1 · 2026-10-11
   MODELO:    Multiempresa gestionado desde Panel SYS (Tarjeta técnica v1.0.0)
   DEPENDE:   Colecciones transversales SCaD_EO y SCaD_USR
              Colecciones de la APP: RedesCanales (marcas) y RedesPublicaciones
              (ambas con el campo de texto eoId y permisos "Solo admin")
   USADO POR: RED_VELO_gestion-redes_v4.js
   SEGURIDAD:
     · La identidad sale SIEMPRE de la sesión (currentMember del backend);
       ningún memberId o email enviado por el cliente se usa para autorizar.
     · Cada operación vuelve a validar APP + EO + activo + rol en SCaD_USR.
     · El eoId de los registros lo asigna este módulo, nunca el panel.
     · Actualizar o eliminar por _id verifica que el registro sea de la EO.
     · La cuenta de asistencia admSYS entra en solo lectura y en silencio
       (no se registra ni se modifica nada en la EO).
   ========================================================== */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';

/* ---------- CONFIGURACIÓN (ajustar aquí a los nombres reales) ---------- */
const CFG = {
  APP: 'REDES',          // identificador de esta APP en SCaD_USR
  APP_SYS: 'SYS',        // registros de SCaD_USR que identifican a admSYS
  COL: {
    usr: 'SCaD_USR',
    eo: 'SCaD_EO',
    marcas: 'RedesCanales',
    publicaciones: 'RedesPublicaciones'
  },
  USR: {                 // campos de SCaD_USR
    app: 'app',
    eo: 'eo',            // referencia a SCaD_EO (o texto con su _id)
    email: 'email',      // se compara en minúsculas
    activo: 'activo',
    roles: 'roles',      // texto ("ADM") o lista (["ADM","USU"])
    accesoDirecto: 'accesoDirecto',
    memberId: 'memberId'
  },
  EO: {                  // campos de SCaD_EO
    nombre: 'nombre',
    logo: 'logo',
    activo: 'activo'
  },
  CAMPO_EO: 'eoId',      // campo agregado a las colecciones de la APP
  ROLES: {               // roles con permiso de escritura por colección
    publicaciones: ['ADM', 'USU'],
    marcas: ['ADM']
  },
  VINCULAR_MEMBERID: true // guarda memberId en el primer acceso con accesoDirecto
};

/* ---------- reglas de datos (mismas que el VELO v3) ---------- */
const CAMPOS = {
  marcas: ['nombre', 'descripcion', 'color', 'activo', 'orden', 'redesActivas', 'cuentas', 'logo'],
  publicaciones: ['titulo', 'canal', 'redes', 'texto', 'fechaProgramada', 'formato', 'estado',
    'responsable', 'urlMaterial', 'urlPublicada', 'fechaPublicada', 'notas', 'serie']
};
const CAMPOS_FECHA = ['fechaProgramada', 'fechaPublicada'];
const LIMITE = 1000;
const MAX_LOTE = 100;
const OPT = { suppressAuth: true }; // las colecciones son "Solo admin"; el control lo hace este módulo

/* ==========================================================
   MÉTODOS WEB
   Todos responden { ok:true, data } o { ok:false, error:{code,message} }
   ========================================================== */

// Contexto del usuario: EO disponibles, EO activa y rol.
// eoSolicitada: la EO que pide la página (por ejemplo, la que abre Panel SYS).
export const obtenerContexto = webMethod(Permissions.SiteMember, async (eoSolicitada) => {
  return ejecutar(async () => {
    const ctx = await resolverContexto(texto(eoSolicitada));
    return {
      app: CFG.APP,
      eos: ctx.eos,
      activa: ctx.activa,
      rol: ctx.rol,
      asistencia: ctx.asistencia,
      permisos: permisosDe(ctx)
    };
  });
});

export const cargarDatos = webMethod(Permissions.SiteMember, async (eoId) => {
  return ejecutar(async () => {
    const ctx = await contextoActivo(eoId);
    const [marcas, publicaciones] = await Promise.all([
      wixData.query(CFG.COL.marcas).eq(CFG.CAMPO_EO, ctx.activa._id)
        .ascending('orden').limit(LIMITE).find(OPT),
      wixData.query(CFG.COL.publicaciones).eq(CFG.CAMPO_EO, ctx.activa._id)
        .descending('fechaProgramada').limit(LIMITE).find(OPT)
    ]);
    return {
      eo: ctx.activa._id,
      marcas: marcas.items.map(limpiar),
      publicaciones: publicaciones.items.map(limpiar)
    };
  });
});

export const guardar = webMethod(Permissions.SiteMember, async (eoId, tipo, entradas) => {
  return ejecutar(async () => {
    const ctx = await contextoActivo(eoId);
    exigirEscritura(ctx, tipo);
    const lista = validarLote(entradas, x => x && typeof x === 'object');
    const eo = ctx.activa._id;
    const col = CFG.COL[tipo];

    const items = lista.map(e => preparar(tipo, e));

    // Las marcas (canal) referidas deben pertenecer a la misma EO
    if (tipo === 'publicaciones') {
      items.forEach(it => {
        if (!it._id && !it.canal) throw falla('DATOS', 'Elige una marca para la publicación.');
      });
      const canales = [...new Set(items.map(it => it.canal).filter(Boolean))];
      if (canales.length) {
        const r = await wixData.query(CFG.COL.marcas)
          .hasSome('_id', canales).eq(CFG.CAMPO_EO, eo).limit(MAX_LOTE).find(OPT);
        if (r.items.length !== canales.length) throw falla('NO_ENCONTRADO', 'La marca elegida no pertenece a esta empresa.');
      }
    }

    // Registros existentes: deben ser de la EO activa
    const ids = [...new Set(items.map(it => it._id).filter(Boolean))];
    const actuales = {};
    if (ids.length) {
      const r = await wixData.query(col).hasSome('_id', ids).eq(CFG.CAMPO_EO, eo).limit(MAX_LOTE).find(OPT);
      r.items.forEach(it => { actuales[it._id] = it; });
      if (Object.keys(actuales).length !== ids.length) throw falla('NO_ENCONTRADO', 'El registro no existe o no pertenece a esta empresa.');
    }

    // Secuencial: cada actualización conserva los campos que no envió el panel
    const guardados = [];
    for (const it of items) {
      let g;
      if (it._id) g = await wixData.update(col, { ...actuales[it._id], ...it, [CFG.CAMPO_EO]: eo }, OPT);
      else g = await wixData.insert(col, { ...it, [CFG.CAMPO_EO]: eo }, OPT);
      guardados.push(limpiar(g));
    }
    return guardados;
  });
});

export const eliminar = webMethod(Permissions.SiteMember, async (eoId, tipo, ids) => {
  return ejecutar(async () => {
    const ctx = await contextoActivo(eoId);
    exigirEscritura(ctx, tipo);
    const lista = [...new Set(validarLote(ids, x => typeof x === 'string' && x))];
    const eo = ctx.activa._id;
    const col = CFG.COL[tipo];

    const r = await wixData.query(col).hasSome('_id', lista).eq(CFG.CAMPO_EO, eo).limit(MAX_LOTE).find(OPT);
    if (r.items.length !== lista.length) throw falla('NO_ENCONTRADO', 'Algún registro no existe o no pertenece a esta empresa.');

    if (tipo === 'marcas') {
      const usadas = await wixData.query(CFG.COL.publicaciones)
        .hasSome('canal', lista).eq(CFG.CAMPO_EO, eo).count(OPT);
      if (usadas > 0) throw falla('EN_USO', 'La marca tiene publicaciones registradas; desactívala en lugar de eliminarla.');
    }

    if (lista.length === 1) await wixData.remove(col, lista[0], OPT);
    else await wixData.bulkRemove(col, lista, OPT);
    return { eliminados: lista.length };
  });
});

/* ==========================================================
   CONTEXTO APP + EO
   ========================================================== */

// Resuelve la pertenencia del usuario de la sesión en esta APP.
async function resolverContexto(eoSolicitada) {
  const miembro = await currentMember.getMember({ fieldsets: ['FULL'] }).catch(() => null);
  if (!miembro || !miembro._id) throw falla('NOAUTH', 'Inicia sesión en el sitio.');
  const memberId = miembro._id;
  const email = texto(miembro.loginEmail).toLowerCase();
  const U = CFG.USR;

  // 1) Pertenencias ya vinculadas a este miembro
  const vinculadas = await wixData.query(CFG.COL.usr)
    .eq(U.app, CFG.APP).eq(U.activo, true).eq(U.memberId, memberId)
    .limit(LIMITE).find(OPT);
  const pertenencias = [...vinculadas.items];

  // 2) Pre-registro por correo (accesoDirecto) aún sin memberId: se vincula en el primer acceso
  if (email) {
    const porCorreo = await wixData.query(CFG.COL.usr)
      .eq(U.app, CFG.APP).eq(U.activo, true).eq(U.email, email)
      .limit(LIMITE).find(OPT);
    for (const r of porCorreo.items) {
      if (r[U.memberId] || r[U.accesoDirecto] !== true) continue;
      if (pertenencias.some(p => p._id === r._id)) continue;
      if (CFG.VINCULAR_MEMBERID) {
        await wixData.update(CFG.COL.usr, { ...r, [U.memberId]: memberId }, OPT);
      }
      pertenencias.push(r);
    }
  }

  // 3) EO activas a las que pertenece (un rol por EO; si hubiera varios registros se suman)
  const porEo = {};
  pertenencias.forEach(p => {
    const id = idDe(p[U.eo]);
    if (!id) return;
    porEo[id] = [...new Set([...(porEo[id] || []), ...rolesDe(p[U.roles])])];
  });
  const eoIds = Object.keys(porEo);
  const eosActivas = eoIds.length
    ? (await wixData.query(CFG.COL.eo).hasSome('_id', eoIds).limit(LIMITE).find(OPT)).items
      .filter(e => e[CFG.EO.activo] !== false)
    : [];
  const eos = eosActivas
    .map(e => ({ ...resumenEO(e), rol: rolPrincipal(porEo[e._id]) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  // 4) EO activa
  let activa = null, rol = null, asistencia = false;
  if (eoSolicitada) {
    const propia = eos.find(e => e._id === eoSolicitada);
    if (propia) {
      activa = propia; rol = propia.rol;
    } else if (await esAdmSys(memberId)) {
      const eo = await wixData.get(CFG.COL.eo, eoSolicitada, OPT).catch(() => null);
      if (!eo || eo[CFG.EO.activo] === false) throw falla('SIN_ACCESO', 'La empresa no existe o no está activa.');
      activa = resumenEO(eo); rol = 'ASIS'; asistencia = true;
    } else if (!eos.length) {
      throw falla('SIN_ACCESO', 'Tu cuenta no tiene acceso a SCaD Redes en esta empresa.');
    }
    // Si pidió una EO que no es suya pero tiene otras, se le pide elegir (activa = null)
  } else if (eos.length === 1) {
    activa = eos[0]; rol = eos[0].rol;
  } else if (!eos.length) {
    throw falla('SIN_ACCESO', 'Tu cuenta no tiene acceso a SCaD Redes.');
  }

  return {
    memberId,
    eos: eos.map(({ _id, nombre, logo, rol }) => ({ _id, nombre, logo, rol })),
    activa: activa ? { _id: activa._id, nombre: activa.nombre, logo: activa.logo } : null,
    rol,
    asistencia
  };
}

// Exige una EO activa válida para operar con datos
async function contextoActivo(eoId) {
  const id = texto(eoId);
  if (!id) throw falla('CONTEXTO', 'No hay una empresa seleccionada.');
  const ctx = await resolverContexto(id);
  if (!ctx.activa || ctx.activa._id !== id) throw falla('SIN_ACCESO', 'No tienes acceso a esta empresa.');
  return ctx;
}

async function esAdmSys(memberId) {
  const U = CFG.USR;
  const r = await wixData.query(CFG.COL.usr)
    .eq(U.app, CFG.APP_SYS).eq(U.activo, true).eq(U.memberId, memberId)
    .limit(10).find(OPT);
  return r.items.some(x => rolesDe(x[U.roles]).includes('ADM'));
}

function permisosDe(ctx) {
  const r = ctx.rol;
  return {
    publicaciones: !ctx.asistencia && CFG.ROLES.publicaciones.includes(r),
    marcas: !ctx.asistencia && CFG.ROLES.marcas.includes(r)
  };
}

function exigirEscritura(ctx, tipo) {
  if (!CFG.COL[tipo] || !CAMPOS[tipo]) throw falla('DATOS', 'Colección no válida.');
  if (ctx.asistencia) throw falla('SOLO_LECTURA', 'La cuenta de asistencia es de solo lectura. Para crear contenido se requiere alta como usuario de la empresa.');
  if (!permisosDe(ctx)[tipo]) {
    throw falla('SIN_PERMISO', tipo === 'marcas'
      ? 'Solo un administrador de la empresa puede gestionar marcas.'
      : 'Tu rol no permite registrar publicaciones.');
  }
}

/* ==========================================================
   UTILIDADES
   ========================================================== */
async function ejecutar(fn) {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    const code = err && err.codigoRedes ? err.codigoRedes : 'ERROR';
    if (code === 'ERROR') console.error('[redes.web]', err);
    return { ok: false, error: { code, message: code === 'ERROR' ? 'Error del servidor. Intenta de nuevo.' : String(err.message) } };
  }
}

function falla(code, message) {
  const e = new Error(message);
  e.codigoRedes = code;
  return e;
}

function validarLote(lista, valido) {
  if (!Array.isArray(lista) || !lista.length) throw falla('DATOS', 'Sin registros.');
  if (lista.length > MAX_LOTE) throw falla('DATOS', 'Demasiados registros en un solo envío.');
  if (!lista.every(valido)) throw falla('DATOS', 'Registros no válidos.');
  return lista;
}

// Solo campos permitidos; el eoId que llegue del panel se ignora
function preparar(tipo, entrada) {
  const item = {};
  CAMPOS[tipo].forEach(k => {
    if (!(k in entrada)) return;
    let v = entrada[k];
    if (CAMPOS_FECHA.includes(k)) v = v ? new Date(v) : null;
    if (v === '') v = null;
    item[k] = v;
  });
  if (tipo === 'publicaciones' && item.canal && typeof item.canal !== 'string') item.canal = idDe(item.canal);
  if (entrada._id) item._id = texto(entrada._id);
  return item;
}

// Fechas a texto ISO y referencias a solo el ID
function limpiar(it) {
  const o = {};
  Object.keys(it || {}).forEach(k => {
    if (k === '_owner' || k === CFG.CAMPO_EO || k.startsWith('link-')) return;
    let v = it[k];
    if (v instanceof Date) v = v.toISOString();
    else if (k === 'canal' && v && typeof v === 'object' && v._id) v = v._id;
    o[k] = v;
  });
  return o;
}

function resumenEO(e) {
  return { _id: e._id, nombre: texto(e[CFG.EO.nombre]) || 'Empresa', logo: urlImagen(e[CFG.EO.logo]) };
}

// wix:image://v1/<id>/<nombre>#... → https://static.wixstatic.com/media/<id>
function urlImagen(v) {
  const s = texto(v);
  const m = s.match(/^wix:image:\/\/v1\/([^/]+)\//);
  if (m) return 'https://static.wixstatic.com/media/' + m[1];
  return /^https:\/\//i.test(s) ? s : '';
}

function rolesDe(v) {
  const lista = Array.isArray(v) ? v : texto(v).split(/[,;\s]+/);
  return lista.map(r => texto(r).toUpperCase()).filter(Boolean);
}

// Rol con más permisos para mostrar y autorizar.
// Sin rol = USU (rol base). Un rol adicional no listado en CFG.ROLES queda en solo lectura.
function rolPrincipal(roles) {
  if (roles.includes('ADM')) return 'ADM';
  if (roles.includes('USU')) return 'USU';
  return roles[0] || 'USU';
}

function idDe(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return texto(v._id);
}

function texto(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}
