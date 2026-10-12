/* ==========================================================
   TIPO:      BACKEND (módulo web)
   PROYECTO:  SCaD Redes · Panel de Publicaciones en Redes
   SITIO:     scad.mx
   ARCHIVO:   RED_BACKEND_redes.web.js
              En Wix se instala como:  backend/redes.web.js
   VERSIÓN:   v2.1 · 2026-10-11
   MODELO:    Multiempresa gestionado desde Panel SYS + modelo comercial
   DEPENDE:   SCaD_EO, SCaD_USR (transversales, esquema real de SYS)
              RedesCanales, RedesPublicaciones (campo eoId)
              RedesPermisos, RedesSesiones (propias de la APP)
              Wix Pricing Plans: PLAN REDES y COLABORADOR REDES
   USADO POR: RED_VELO_gestion-redes_v5.js
   REGLAS:
     · Identidad: siempre la sesión (currentMember); nunca datos del cliente.
     · Pertenencia: SCaD_USR (app=REDES, activo, memberId) → enteOperador =
       SCaD_EO.codigoContexto (app=REDES, activo).
     · Roles: titular (ADM, admPrincipal) y colaborador (USU). El alcance del
       colaborador lo fija el titular en RedesPermisos (funciones y marcas).
     · EO comercial (accesoPricing=true): titular con PLAN REDES vigente;
       colaborador con COLABORADOR REDES vigente y titular vigente.
       Rol nativo de cortesía: no requiere plan propio.
       EO de cortesía (accesoPricing≠true): basta la pertenencia.
     · Sesión única por usuario: la nueva se rechaza mientras la otra tenga
       actividad en los últimos 30 minutos.
     · Límite de marcas por EO: 3 (SCaD_EO.limiteMarcas lo puede ajustar).
   CAMBIOS v2.1: los paquetes de planes se cargan bajo demanda; si no están
              instalados, el módulo carga igual (EO de cortesía funcionan y las
              EO comerciales se ven suspendidas hasta instalarlos).
   CAMBIOS v2: esquema real de SCaD (enteOperador/codigoContexto, admSys como
              pertenencia normal, accesoDirecto en la EO, logoEo); planes;
              registro de empresa; colaboradores e invitaciones; permisos
              por función y por marca; límite de marcas; sesión única.
   ========================================================== */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
// @wix/pricing-plans y @wix/essentials se cargan solo al consultar planes (ver listarOrdenes),
// para que el módulo cargue aunque esos paquetes no estén instalados en el sitio.

/* ---------- CONFIGURACIÓN ---------- */
const CFG = {
  APP: 'REDES',
  COL: {
    usr: 'SCaD_USR',
    eo: 'SCaD_EO',
    marcas: 'RedesCanales',
    publicaciones: 'RedesPublicaciones',
    permisos: 'RedesPermisos',
    sesiones: 'RedesSesiones'
  },
  PLAN_TITULAR: '72971ae6-8235-4e95-b595-c924edf36f2b',     // PLAN REDES · $49
  PLAN_COLABORADOR: '099b36c6-c746-407c-9b15-2ba19661ddd4', // COLABORADOR REDES · $39
  ROLES_NATIVOS: [],      // título o _id del rol nativo de cortesía (ej. ['REDES'])
  LIMITE_MARCAS: 3,
  SESION_MINUTOS: 30,
  CAMPO_EO: 'eoId',
  URL_PANEL: 'https://www.scad.mx/gestion-redes'
};

const PERMISOS = ['editar', 'estado', 'eliminar', 'marcas', 'exportar'];
const CAMPOS = {
  marcas: ['nombre', 'descripcion', 'color', 'activo', 'orden', 'redesActivas', 'cuentas', 'logo'],
  publicaciones: ['titulo', 'canal', 'redes', 'texto', 'fechaProgramada', 'formato', 'estado',
    'responsable', 'urlMaterial', 'urlPublicada', 'fechaPublicada', 'notas', 'serie']
};
const CAMPOS_ESTADO = ['estado', 'fechaPublicada', 'urlPublicada'];
const CAMPOS_FECHA = ['fechaProgramada', 'fechaPublicada'];
const LIMITE = 1000;
const MAX_LOTE = 100;
const OPT = { suppressAuth: true };
let ordenesElevadas = null;
async function listarOrdenes(opciones) {
  if (!ordenesElevadas) {
    const [{ orders }, { auth }] = await Promise.all([import('@wix/pricing-plans'), import('@wix/essentials')]);
    ordenesElevadas = auth.elevate(orders.managementListOrders);
  }
  return ordenesElevadas(opciones);
}

/* ==========================================================
   MÉTODOS WEB · todos responden { ok:true, data } o { ok:false, error }
   req = { eo: _id o codigoContexto de la EO, ses: id de sesión del dispositivo }
   ========================================================== */

export const obtenerContexto = webMethod(Permissions.SiteMember, async (req) => {
  return ejecutar(async () => publico(await resolver(req)));
});

export const ping = webMethod(Permissions.SiteMember, async (req) => {
  return ejecutar(async () => {
    const m = await miembroActual();
    return { sesion: await reclamarSesion(m._id, texto(req && req.ses)) };
  });
});

export const cerrarSesion = webMethod(Permissions.SiteMember, async (req) => {
  return ejecutar(async () => {
    const m = await miembroActual();
    const ses = texto(req && req.ses);
    const r = await wixData.query(CFG.COL.sesiones).eq('memberId', m._id).limit(10).find(OPT);
    const mias = r.items.filter(x => x.sesionId === ses).map(x => x._id);
    if (mias.length) await wixData.bulkRemove(CFG.COL.sesiones, mias, OPT);
    return { cerrada: mias.length > 0 };
  });
});

export const cargarDatos = webMethod(Permissions.SiteMember, async (req) => {
  return ejecutar(async () => {
    const ctx = await operativo(req);
    const eo = ctx.activa._id;
    let qm = wixData.query(CFG.COL.marcas).eq(CFG.CAMPO_EO, eo);
    let qp = wixData.query(CFG.COL.publicaciones).eq(CFG.CAMPO_EO, eo);
    if (ctx.marcasPermitidas) {
      qm = qm.hasSome('_id', ctx.marcasPermitidas.length ? ctx.marcasPermitidas : ['-']);
      qp = qp.hasSome('canal', ctx.marcasPermitidas.length ? ctx.marcasPermitidas : ['-']);
    }
    const [marcas, publicaciones] = await Promise.all([
      qm.ascending('orden').limit(LIMITE).find(OPT),
      qp.descending('fechaProgramada').limit(LIMITE).find(OPT)
    ]);
    return { eo, marcas: marcas.items.map(limpiar), publicaciones: publicaciones.items.map(limpiar) };
  });
});

export const guardar = webMethod(Permissions.SiteMember, async (req, tipo, entradas) => {
  return ejecutar(async () => {
    const ctx = await operativo(req);
    if (!CAMPOS[tipo]) throw falla('DATOS', 'Colección no válida.');
    const lista = validarLote(entradas, x => x && typeof x === 'object');
    const eo = ctx.activa._id;
    const col = CFG.COL[tipo];
    const items = lista.map(e => preparar(tipo, e));

    // Registros existentes: deben ser de la EO activa
    const ids = [...new Set(items.map(it => it._id).filter(Boolean))];
    const actuales = {};
    if (ids.length) {
      const r = await wixData.query(col).hasSome('_id', ids).eq(CFG.CAMPO_EO, eo).limit(MAX_LOTE).find(OPT);
      r.items.forEach(it => { actuales[it._id] = it; });
      if (Object.keys(actuales).length !== ids.length) throw falla('NO_ENCONTRADO', 'El registro no existe o no pertenece a esta empresa.');
    }

    if (tipo === 'marcas') {
      exigir(ctx, 'marcas');
      const nuevas = items.filter(it => !it._id).length;
      if (nuevas && ctx.marcasPermitidas) throw falla('SIN_PERMISO', 'Tu acceso está limitado a ciertas marcas; solo el titular puede crear marcas nuevas.');
      items.filter(it => it._id).forEach(it => exigirMarca(ctx, it._id));
      if (nuevas) {
        const total = await wixData.query(col).eq(CFG.CAMPO_EO, eo).count(OPT);
        if (total + nuevas > ctx.limiteMarcas) throw falla('LIMITE', `El plan permite hasta ${ctx.limiteMarcas} marcas por empresa.`);
      }
    } else {
      for (const it of items) {
        if (!it._id) {
          exigir(ctx, 'editar');
          if (!it.canal) throw falla('DATOS', 'Elige una marca para la publicación.');
        } else {
          const soloEstado = Object.keys(it).filter(k => k !== '_id').every(k => CAMPOS_ESTADO.includes(k));
          if (!(ctx.permisos.editar || (soloEstado && ctx.permisos.estado))) {
            throw falla('SIN_PERMISO', soloEstado ? 'No tienes permiso para cambiar el estado.' : 'No tienes permiso para editar publicaciones.');
          }
          exigirMarca(ctx, idDe(actuales[it._id].canal));
        }
        if (it.canal) exigirMarca(ctx, it.canal);
      }
      const canales = [...new Set(items.map(it => it.canal).filter(Boolean))];
      if (canales.length) {
        const r = await wixData.query(CFG.COL.marcas).hasSome('_id', canales).eq(CFG.CAMPO_EO, eo).limit(MAX_LOTE).find(OPT);
        if (r.items.length !== canales.length) throw falla('NO_ENCONTRADO', 'La marca elegida no pertenece a esta empresa.');
      }
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

export const eliminar = webMethod(Permissions.SiteMember, async (req, tipo, ids) => {
  return ejecutar(async () => {
    const ctx = await operativo(req);
    if (!CAMPOS[tipo]) throw falla('DATOS', 'Colección no válida.');
    exigir(ctx, tipo === 'marcas' ? 'marcas' : 'eliminar');
    const lista = [...new Set(validarLote(ids, x => typeof x === 'string' && x))];
    const eo = ctx.activa._id;
    const col = CFG.COL[tipo];

    const r = await wixData.query(col).hasSome('_id', lista).eq(CFG.CAMPO_EO, eo).limit(MAX_LOTE).find(OPT);
    if (r.items.length !== lista.length) throw falla('NO_ENCONTRADO', 'Algún registro no existe o no pertenece a esta empresa.');
    r.items.forEach(it => exigirMarca(ctx, tipo === 'marcas' ? it._id : idDe(it.canal)));

    if (tipo === 'marcas') {
      const usadas = await wixData.query(CFG.COL.publicaciones).hasSome('canal', lista).eq(CFG.CAMPO_EO, eo).count(OPT);
      if (usadas > 0) throw falla('EN_USO', 'La marca tiene publicaciones registradas; desactívala en lugar de eliminarla.');
    }
    if (lista.length === 1) await wixData.remove(col, lista[0], OPT);
    else await wixData.bulkRemove(col, lista, OPT);
    return { eliminados: lista.length };
  });
});

/* ---------- registro de empresa (titular) ---------- */
export const registrarEmpresa = webMethod(Permissions.SiteMember, async (req, datos) => {
  return ejecutar(async () => {
    const ctx = await resolver({ ses: req && req.ses });
    if (ctx.estado !== 'registro') throw falla('DATOS', 'Tu cuenta no puede registrar una empresa en este momento.');
    const d = datos || {};
    const nombre = texto(d.nombre).slice(0, 80);
    const persona = texto(d.persona).slice(0, 80);
    if (nombre.length < 2) throw falla('DATOS', 'Escribe el nombre de la empresa.');
    if (persona.length < 2) throw falla('DATOS', 'Escribe tu nombre.');
    const telefono = texto(d.telefono).replace(/[^\d+]/g, '').slice(0, 15);

    const corto = await codigoClienteLibre(texto(d.corto) || nombre);
    const codigoEO = await siguienteCodigo(CFG.COL.eo, 'codigoEO', /^EO(\d+)$/, 'EO', 3);
    const codigoUSR = await siguienteCodigo(CFG.COL.usr, 'codigoUSR', /^USR(\d+)$/, 'USR', 4);
    const contextoEO = `${codigoEO}-${CFG.APP}-${corto}`;
    const ahora = new Date();
    const comercial = ctx._planes.has(CFG.PLAN_TITULAR);

    // 1) Usuario titular
    const usr = await wixData.insert(CFG.COL.usr, {
      app: CFG.APP, enteOperador: contextoEO, codigoUSR,
      codigoContexto: `${codigoUSR}-${CFG.APP}-${contextoEO}`,
      memberId: ctx._memberId, email: ctx._email,
      nombre: persona, apellidoPaterno: '', apellidoMaterno: '',
      nombreCompleto: persona, nombreVisible: persona, telefono,
      roles: ['USU', 'ADM'], activo: true, activoCodigo: false, activoPricing: comercial,
      fechaAlta: ahora, fechaActualizacion: ahora, ultimaVerificacionAcceso: ahora
    }, OPT);

    // 2) Empresa operadora
    const eo = await wixData.insert(CFG.COL.eo, {
      app: CFG.APP, codigoEO, codigoCliente: corto, codigoContexto: contextoEO,
      nombre, nombreVisible: nombre, activo: true, localizable: false,
      accesoPricing: comercial, pricingPlanIds: comercial ? [CFG.PLAN_TITULAR] : [],
      accesoCodigo: false, accesoDirecto: false, codigoAcceso: '', modoAcceso: 'CONTROLADO',
      limiteUsuarios: 1, usuariosIlimitados: false, limiteRoles: 2, limiteDocumentos: 1,
      limiteTiposEvento: 1, limiteMarcas: CFG.LIMITE_MARCAS, evidenciasBit: false, sysPagos: false,
      admPrincipal: usr._id, fechaAlta: ahora, fechaActualizacion: ahora
    }, OPT);

    return publico(await resolver({ eo: eo._id, ses: req && req.ses }));
  });
});

/* ---------- colaboradores (solo titular) ---------- */
export const listarUsuarios = webMethod(Permissions.SiteMember, async (req) => {
  return ejecutar(async () => {
    const ctx = await operativo(req);
    exigirTitular(ctx);
    const usrs = await usuariosDeEO(ctx._eo);
    const permisos = await permisosDeEO(ctx.activa._id);
    return {
      urlInvitacion: CFG.URL_PANEL,
      precioColaborador: '$39 MXN / mes',
      usuarios: usrs
        .filter(u => u._id !== ctx._usr._id && u._id !== idDe(ctx._eo.admSys))
        .map(u => {
          const p = permisos[u._id] || {};
          return {
            usrId: u._id, nombre: u.nombreVisible || u.nombreCompleto || u.nombre || '', email: u.email || '',
            activo: u.activo !== false, vinculado: !!u.memberId, plan: u.activoPricing === true,
            permisos: normPermisos(p.permisos), marcas: Array.isArray(p.marcas) ? p.marcas : []
          };
        })
    };
  });
});

export const invitarUsuario = webMethod(Permissions.SiteMember, async (req, datos) => {
  return ejecutar(async () => {
    const ctx = await operativo(req);
    exigirTitular(ctx);
    const d = datos || {};
    const email = texto(d.email).toLowerCase();
    const nombre = texto(d.nombre).slice(0, 80);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw falla('DATOS', 'Escribe un correo válido.');
    if (nombre.length < 2) throw falla('DATOS', 'Escribe el nombre del colaborador.');
    if (email === ctx._email) throw falla('DATOS', 'Ese correo es el tuyo.');
    const marcas = await marcasValidas(ctx.activa._id, d.marcas);

    const existentes = (await usuariosDeEO(ctx._eo)).filter(u => texto(u.email).toLowerCase() === email);
    const ahora = new Date();
    let usr;
    if (existentes.some(u => u.activo !== false)) throw falla('DATOS', 'Ese correo ya está registrado en tu empresa.');
    if (existentes.length) {
      usr = await wixData.update(CFG.COL.usr, { ...existentes[0], nombre, nombreCompleto: nombre, nombreVisible: nombre, activo: true, fechaBaja: null, fechaActualizacion: ahora }, OPT);
    } else {
      const codigoUSR = await siguienteCodigo(CFG.COL.usr, 'codigoUSR', /^USR(\d+)$/, 'USR', 4);
      usr = await wixData.insert(CFG.COL.usr, {
        app: CFG.APP, enteOperador: ctx._eo.codigoContexto, codigoUSR,
        codigoContexto: `${codigoUSR}-${CFG.APP}-${ctx._eo.codigoContexto}`,
        memberId: '', email, nombre, apellidoPaterno: '', apellidoMaterno: '',
        nombreCompleto: nombre, nombreVisible: nombre, telefono: '',
        roles: ['USU'], activo: true, activoCodigo: false, activoPricing: false,
        fechaAlta: ahora, fechaActualizacion: ahora
      }, OPT);
    }
    await guardarPermisos(ctx.activa._id, usr._id, email, d.permisos, marcas, ctx._usr._id);
    await ajustarLimiteUsuarios(ctx._eo);
    return { usrId: usr._id, urlInvitacion: CFG.URL_PANEL };
  });
});

export const actualizarUsuario = webMethod(Permissions.SiteMember, async (req, usrId, datos) => {
  return ejecutar(async () => {
    const ctx = await operativo(req);
    exigirTitular(ctx);
    const u = await usuarioColaborador(ctx, usrId);
    const d = datos || {};
    const marcas = await marcasValidas(ctx.activa._id, d.marcas);
    await guardarPermisos(ctx.activa._id, u._id, texto(u.email).toLowerCase(), d.permisos, marcas, ctx._usr._id);
    const nombre = texto(d.nombre).slice(0, 80);
    if (nombre.length >= 2 && nombre !== u.nombreVisible) {
      await wixData.update(CFG.COL.usr, { ...u, nombre, nombreCompleto: nombre, nombreVisible: nombre, fechaActualizacion: new Date() }, OPT);
    }
    return { usrId: u._id };
  });
});

export const quitarUsuario = webMethod(Permissions.SiteMember, async (req, usrId) => {
  return ejecutar(async () => {
    const ctx = await operativo(req);
    exigirTitular(ctx);
    const u = await usuarioColaborador(ctx, usrId);
    const ahora = new Date();
    await wixData.update(CFG.COL.usr, { ...u, activo: false, fechaBaja: ahora, fechaActualizacion: ahora }, OPT);
    const p = await wixData.query(CFG.COL.permisos).eq('eoId', ctx.activa._id).eq('usrId', u._id).limit(10).find(OPT);
    if (p.items.length) await wixData.bulkRemove(CFG.COL.permisos, p.items.map(x => x._id), OPT);
    if (u.memberId) {
      const s = await wixData.query(CFG.COL.sesiones).eq('memberId', u.memberId).limit(10).find(OPT);
      if (s.items.length) await wixData.bulkRemove(CFG.COL.sesiones, s.items.map(x => x._id), OPT);
    }
    await ajustarLimiteUsuarios(ctx._eo);
    return { usrId: u._id };
  });
});

/* ==========================================================
   CONTEXTO
   ========================================================== */

// Estados: ok · elegir · registro · comprar_titular · comprar_colaborador ·
//          sin_invitacion · suspendida · sesion_activa
async function resolver(req) {
  const r = req || {};
  const miembro = await miembroActual();
  const memberId = miembro._id;
  const email = texto(miembro.loginEmail).toLowerCase();
  const [nativo, planes] = await Promise.all([esNativo(), planesActivos(memberId)]);

  // 1) Pertenencias activas en REDES (vinculadas o pre-registro por correo)
  const vinculadas = (await wixData.query(CFG.COL.usr)
    .eq('app', CFG.APP).eq('activo', true).eq('memberId', memberId).limit(LIMITE).find(OPT)).items;
  const correos = [...new Set([email, texto(miembro.loginEmail)].filter(Boolean))];
  const pendientes = correos.length ? (await wixData.query(CFG.COL.usr)
    .eq('app', CFG.APP).eq('activo', true).hasSome('email', correos).limit(LIMITE).find(OPT)).items
    .filter(u => !u.memberId && !vinculadas.some(v => v._id === u._id)) : [];

  const contextos = [...new Set([...vinculadas, ...pendientes].map(u => texto(u.enteOperador)).filter(Boolean))];
  const eosPorCodigo = {};
  if (contextos.length) {
    (await wixData.query(CFG.COL.eo).eq('app', CFG.APP).hasSome('codigoContexto', contextos).limit(LIMITE).find(OPT))
      .items.filter(e => e.activo !== false).forEach(e => { eosPorCodigo[e.codigoContexto] = e; });
  }

  // Pre-registro: se vincula si la EO tiene accesoDirecto o si hay invitación del titular
  const invitaciones = pendientes.length ? (await wixData.query(CFG.COL.permisos)
    .hasSome('usrId', pendientes.map(u => u._id)).limit(LIMITE).find(OPT)).items : [];
  const pertenencias = [...vinculadas];
  for (const u of pendientes) {
    const eo = eosPorCodigo[texto(u.enteOperador)];
    if (!eo) continue;
    if (eo.accesoDirecto !== true && !invitaciones.some(i => i.usrId === u._id)) continue;
    const vinc = await wixData.update(CFG.COL.usr, { ...u, memberId, fechaActualizacion: new Date() }, OPT);
    pertenencias.push(vinc);
  }

  // 2) Estado de cada pertenencia
  const lista = [];
  for (const u of pertenencias) {
    const eo = eosPorCodigo[texto(u.enteOperador)];
    if (!eo || lista.some(x => x.eo._id === eo._id)) continue;
    const titular = rolesDe(u.roles).includes('ADM') || idDe(eo.admPrincipal) === u._id;
    let estado = 'ok';
    if (eo.accesoPricing === true) {
      const propio = nativo || planes.has(titular ? CFG.PLAN_TITULAR : CFG.PLAN_COLABORADOR);
      const titularVigente = titular ? propio : await titularVigenteDe(eo);
      if (!titularVigente) estado = 'suspendida';
      else if (!propio) estado = titular ? 'suspendida' : 'comprar_colaborador';
    }
    lista.push({ eo, usr: u, titular, estado });
  }
  lista.sort((a, b) => texto(a.eo.nombreVisible || a.eo.nombre).localeCompare(texto(b.eo.nombreVisible || b.eo.nombre), 'es'));

  const base = {
    _memberId: memberId, _email: email, _planes: planes, nativo,
    eos: lista.map(x => ({ ...resumenEO(x.eo), rol: x.titular ? 'TITULAR' : 'COLABORADOR', estado: x.estado })),
    planes: { titular: CFG.PLAN_TITULAR, colaborador: CFG.PLAN_COLABORADOR },
    email
  };

  // 3) Sin pertenencias
  if (!lista.length) {
    let estado = 'comprar_titular';
    if (nativo || planes.has(CFG.PLAN_TITULAR)) estado = 'registro';
    else if (planes.has(CFG.PLAN_COLABORADOR)) estado = 'sin_invitacion';
    return { ...base, estado, activa: null };
  }

  // 4) EO activa
  const pedida = texto(r.eo);
  let sel = pedida ? lista.find(x => x.eo._id === pedida || x.eo.codigoContexto === pedida) : null;
  let aviso = '';
  if (pedida && !sel) aviso = 'No tienes acceso a la empresa solicitada.';
  if (!sel && lista.length === 1) sel = lista[0];
  if (!sel) return { ...base, estado: 'elegir', activa: null, aviso };

  const activa = resumenEO(sel.eo);
  const usuario = { nombre: sel.usr.nombreVisible || sel.usr.nombreCompleto || sel.usr.nombre || email, rol: sel.titular ? 'TITULAR' : 'COLABORADOR' };
  await registrarVerificacion(sel.usr, sel.estado === 'ok' && sel.eo.accesoPricing === true);
  if (sel.estado !== 'ok') return { ...base, estado: sel.estado, activa, usuario, aviso };

  // 5) Sesión única
  const sesion = await reclamarSesion(memberId, texto(r.ses));
  if (!sesion.ok) return { ...base, estado: 'sesion_activa', activa, usuario, aviso };

  // 6) Alcance
  let permisos = {}, marcasPermitidas = null;
  if (sel.titular) PERMISOS.forEach(k => { permisos[k] = true; });
  else {
    const p = (await wixData.query(CFG.COL.permisos).eq('eoId', sel.eo._id).eq('usrId', sel.usr._id).limit(1).find(OPT)).items[0];
    permisos = normPermisos(p && p.permisos);
    marcasPermitidas = p && Array.isArray(p.marcas) && p.marcas.length ? p.marcas : null;
  }
  return {
    ...base, estado: 'ok', activa, usuario, aviso, permisos, marcasPermitidas,
    titular: sel.titular,
    limiteMarcas: Number(sel.eo.limiteMarcas) > 0 ? Number(sel.eo.limiteMarcas) : CFG.LIMITE_MARCAS,
    _eo: sel.eo, _usr: sel.usr
  };
}

// Contexto exigido para operar con datos
async function operativo(req) {
  const r = req || {};
  if (!texto(r.eo)) throw falla('CONTEXTO', 'No hay una empresa seleccionada.');
  const ctx = await resolver(r);
  if (!ctx.activa || (ctx.activa._id !== texto(r.eo) && ctx.activa.codigo !== texto(r.eo))) throw falla('SIN_ACCESO', 'No tienes acceso a esta empresa.');
  const mensajes = {
    suspendida: 'La suscripción de esta empresa no está vigente.',
    comprar_colaborador: 'Necesitas la suscripción COLABORADOR REDES para entrar.',
    sesion_activa: 'Tu cuenta tiene una sesión activa en otro dispositivo.'
  };
  if (ctx.estado !== 'ok') throw falla(ctx.estado === 'sesion_activa' ? 'SESION' : 'SUSPENDIDA', mensajes[ctx.estado] || 'Acceso no disponible.');
  return ctx;
}

// Lo que viaja al panel (sin campos internos)
function publico(ctx) {
  const o = {};
  Object.keys(ctx).forEach(k => { if (!k.startsWith('_')) o[k] = ctx[k]; });
  return o;
}

async function miembroActual() {
  const m = await currentMember.getMember({ fieldsets: ['FULL'] }).catch(() => null);
  if (!m || !m._id) throw falla('NOAUTH', 'Inicia sesión en el sitio.');
  return m;
}

async function esNativo() {
  if (!CFG.ROLES_NATIVOS.length) return false;
  const roles = await currentMember.getRoles().catch(() => []);
  const buscados = CFG.ROLES_NATIVOS.map(x => texto(x).toLowerCase());
  return (roles || []).some(r => buscados.includes(texto(r.title).toLowerCase()) || buscados.includes(texto(r._id).toLowerCase()));
}

// Planes de REDES vigentes de un miembro
async function planesActivos(memberId) {
  const res = await listarOrdenes({
    buyerIds: [memberId],
    planIds: [CFG.PLAN_TITULAR, CFG.PLAN_COLABORADOR],
    orderStatuses: ['ACTIVE']
  }).catch(err => { console.error('[redes.web] planes', err); return { orders: [] }; });
  return new Set((res.orders || []).filter(o => o.status === 'ACTIVE').map(o => o.planId));
}

async function titularVigenteDe(eo) {
  const t = idDe(eo.admPrincipal) ? await wixData.get(CFG.COL.usr, idDe(eo.admPrincipal), OPT).catch(() => null) : null;
  if (!t || t.activo === false || !t.memberId) return false;
  return (await planesActivos(t.memberId)).has(CFG.PLAN_TITULAR);
}

// Actualiza activoPricing y ultimaVerificacionAcceso (como máximo cada 10 min)
async function registrarVerificacion(u, conPlan) {
  const ultima = u.ultimaVerificacionAcceso ? new Date(u.ultimaVerificacionAcceso).getTime() : 0;
  if (u.activoPricing === conPlan && Date.now() - ultima < 10 * 60000) return;
  await wixData.update(CFG.COL.usr, { ...u, activoPricing: conPlan, ultimaVerificacionAcceso: new Date() }, OPT).catch(() => null);
}

/* ---------- sesión única ---------- */
async function reclamarSesion(memberId, sesionId) {
  if (!sesionId) return { ok: false, motivo: 'SIN_SESION' };
  const ahora = Date.now();
  const r = await wixData.query(CFG.COL.sesiones).eq('memberId', memberId).limit(10).find(OPT);
  const rec = r.items[0];
  if (r.items.length > 1) await wixData.bulkRemove(CFG.COL.sesiones, r.items.slice(1).map(x => x._id), OPT);
  if (!rec) {
    await wixData.insert(CFG.COL.sesiones, { memberId, sesionId, inicio: new Date(), ultimaActividad: new Date() }, OPT);
    return { ok: true };
  }
  const ultima = rec.ultimaActividad ? new Date(rec.ultimaActividad).getTime() : 0;
  const vencida = ahora - ultima > CFG.SESION_MINUTOS * 60000;
  if (rec.sesionId === sesionId) {
    if (ahora - ultima > 60000) await wixData.update(CFG.COL.sesiones, { ...rec, ultimaActividad: new Date() }, OPT);
    return { ok: true };
  }
  if (!vencida) return { ok: false, motivo: 'SESION_ACTIVA' };
  await wixData.update(CFG.COL.sesiones, { ...rec, sesionId, inicio: new Date(), ultimaActividad: new Date() }, OPT);
  return { ok: true };
}

/* ---------- permisos ---------- */
function exigir(ctx, permiso) {
  if (!ctx.permisos || !ctx.permisos[permiso]) {
    const t = { editar: 'editar publicaciones', estado: 'cambiar el estado', eliminar: 'eliminar publicaciones', marcas: 'gestionar marcas', exportar: 'exportar reportes' };
    throw falla('SIN_PERMISO', `No tienes permiso para ${t[permiso] || 'esta acción'}.`);
  }
}

function exigirMarca(ctx, marcaId) {
  if (ctx.marcasPermitidas && !ctx.marcasPermitidas.includes(texto(marcaId))) {
    throw falla('SIN_PERMISO', 'No tienes acceso a esa marca.');
  }
}

function exigirTitular(ctx) {
  if (!ctx.titular) throw falla('SIN_PERMISO', 'Solo el titular de la empresa puede gestionar colaboradores.');
}

function normPermisos(p) {
  const o = {};
  PERMISOS.forEach(k => { o[k] = !!(p && p[k] === true); });
  return o;
}

async function guardarPermisos(eoId, usrId, email, permisos, marcas, porUsrId) {
  const r = await wixData.query(CFG.COL.permisos).eq('eoId', eoId).eq('usrId', usrId).limit(10).find(OPT);
  const datos = { eoId, usrId, email, permisos: normPermisos(permisos), marcas, actualizadoPor: porUsrId, fechaActualizacion: new Date() };
  if (r.items[0]) await wixData.update(CFG.COL.permisos, { ...r.items[0], ...datos }, OPT);
  else await wixData.insert(CFG.COL.permisos, { ...datos, fechaInvitacion: new Date() }, OPT);
  if (r.items.length > 1) await wixData.bulkRemove(CFG.COL.permisos, r.items.slice(1).map(x => x._id), OPT);
}

async function permisosDeEO(eoId) {
  const r = await wixData.query(CFG.COL.permisos).eq('eoId', eoId).limit(LIMITE).find(OPT);
  const o = {};
  r.items.forEach(x => { o[x.usrId] = x; });
  return o;
}

// Marcas: lista vacía = todas; las indicadas deben ser de la EO
async function marcasValidas(eoId, lista) {
  const ids = [...new Set((Array.isArray(lista) ? lista : []).map(texto).filter(Boolean))];
  if (!ids.length) return [];
  const r = await wixData.query(CFG.COL.marcas).hasSome('_id', ids).eq(CFG.CAMPO_EO, eoId).limit(MAX_LOTE).find(OPT);
  if (r.items.length !== ids.length) throw falla('DATOS', 'Alguna marca no pertenece a tu empresa.');
  return ids;
}

/* ---------- usuarios de la EO ---------- */
async function usuariosDeEO(eo) {
  return (await wixData.query(CFG.COL.usr).eq('app', CFG.APP).eq('enteOperador', eo.codigoContexto).limit(LIMITE).find(OPT)).items;
}

async function usuarioColaborador(ctx, usrId) {
  const u = await wixData.get(CFG.COL.usr, texto(usrId), OPT).catch(() => null);
  if (!u || u.app !== CFG.APP || u.enteOperador !== ctx._eo.codigoContexto) throw falla('NO_ENCONTRADO', 'El colaborador no pertenece a tu empresa.');
  if (u._id === ctx._usr._id || u._id === idDe(ctx._eo.admPrincipal)) throw falla('DATOS', 'El titular no se modifica desde aquí.');
  return u;
}

// limiteUsuarios = titular + colaboradores activos (la cuenta admSys silenciosa no ocupa cupo,
// salvo que sea el propio titular)
async function ajustarLimiteUsuarios(eo) {
  const silenciosa = idDe(eo.admSys) && idDe(eo.admSys) !== idDe(eo.admPrincipal) ? idDe(eo.admSys) : '';
  const activos = (await usuariosDeEO(eo)).filter(u => u.activo !== false && u._id !== silenciosa).length;
  const actual = await wixData.get(CFG.COL.eo, eo._id, OPT);
  await wixData.update(CFG.COL.eo, { ...actual, limiteUsuarios: Math.max(1, activos), fechaActualizacion: new Date() }, OPT);
}

/* ---------- códigos consecutivos ---------- */
async function siguienteCodigo(col, campo, patron, prefijo, digitos) {
  let r = await wixData.query(col).isNotEmpty(campo).limit(LIMITE).find(OPT);
  let max = 0;
  for (;;) {
    r.items.forEach(it => { const m = texto(it[campo]).match(patron); if (m) max = Math.max(max, Number(m[1])); });
    if (!r.hasNext()) break;
    r = await r.next();
  }
  return prefijo + String(max + 1).padStart(digitos, '0');
}

async function codigoClienteLibre(base) {
  let c = texto(base).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (c.length < 2) c = 'EMP';
  const usados = new Set((await wixData.query(CFG.COL.eo).eq('app', CFG.APP).limit(LIMITE).find(OPT)).items.map(e => texto(e.codigoCliente)));
  if (!usados.has(c)) return c;
  for (let i = 2; i < 100; i++) { const x = c.slice(0, 8) + i; if (!usados.has(x)) return x; }
  return c.slice(0, 6) + Date.now().toString(36).slice(-4).toUpperCase();
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
  return {
    _id: e._id,
    codigo: texto(e.codigoContexto),
    nombre: texto(e.nombreVisible) || texto(e.nombre) || 'Empresa',
    logo: urlImagen(e.logoEo) || urlImagen(e.logoEO)
  };
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

function idDe(v) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return texto(v._id);
}

function texto(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}
