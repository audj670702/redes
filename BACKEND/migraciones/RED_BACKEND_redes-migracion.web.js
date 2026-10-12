/* ==========================================================
   TIPO:      BACKEND (módulo web · uso único)
   PROYECTO:  SCaD Redes · Panel de Publicaciones en Redes
   ARCHIVO:   RED_BACKEND_redes-migracion.web.js
              En Wix se instala como:  backend/redes-migracion.web.js
   VERSIÓN:   v1 · 2026-10-11
   PROPÓSITO: Asignar eoId a las marcas y publicaciones existentes
              (versión monoempresa) antes de activar el modelo multiempresa.
   USO:       Desde el editor de Wix, con "Probar función" (functional testing)
              sobre migrarEoId:
                1) migrarEoId("<_id de la EO en SCaD_EO>", true)  → simulación
                2) migrarEoId("<_id de la EO en SCaD_EO>", false) → aplica
              Solo asigna eoId a registros que aún no lo tienen; puede
              ejecutarse más de una vez sin duplicar ni sobrescribir.
              Al terminar la migración, este archivo puede eliminarse.
   ========================================================== */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

const COL_EO = 'SCaD_EO';
const COLS = ['RedesCanales', 'RedesPublicaciones'];
const CAMPO_EO = 'eoId';
const OPT = { suppressAuth: true };

export const migrarEoId = webMethod(Permissions.Admin, async (eoId, simular = true) => {
  const eo = await wixData.get(COL_EO, String(eoId || ''), OPT).catch(() => null);
  if (!eo) return { ok: false, error: 'La EO no existe en ' + COL_EO };

  const resultado = { eo: eo._id, simulacion: simular !== false, colecciones: {} };
  for (const col of COLS) {
    const pendientes = await todos(wixData.query(col).isEmpty(CAMPO_EO));
    resultado.colecciones[col] = { sinEoId: pendientes.length, actualizados: 0 };
    if (simular === false && pendientes.length) {
      for (let i = 0; i < pendientes.length; i += 1000) {
        const lote = pendientes.slice(i, i + 1000).map(it => ({ ...it, [CAMPO_EO]: eo._id }));
        const r = await wixData.bulkUpdate(col, lote, OPT);
        resultado.colecciones[col].actualizados += r.updated || 0;
      }
    }
  }
  return { ok: true, ...resultado };
});

async function todos(query) {
  let r = await query.limit(1000).find(OPT);
  const items = [...r.items];
  while (r.hasNext()) { r = await r.next(); items.push(...r.items); }
  return items;
}
