/* ==========================================================
   TIPO:      BACKEND (bloque para backend/http-functions.js)
   PROYECTO:  SCaD Redes · APP (redes.scad.mx)
   ARCHIVO:   SYS_BACKEND_http-functions_bloque-REDES_v1.js
   VERSIÓN:   v1 · 2026-10-12
   INSTALACIÓN: NO sustituye http-functions.js. Se integra en el vigente:
     1) La línea de IMPORT, junto a los demás imports al inicio del archivo.
     2) El BLOQUE completo, al final del archivo.
   REUTILIZA (ya existen en http-functions.js): response, ok, serverError,
     HEADERS, elevatedGetMember, nexusAuth, signNexusToken, verifyNexusToken.
   DEPENDE:   backend/redesCore.js · backend/nexusAuth.js v0.1.4 (REDES)
   FUNCIONES:
     GET  /_functions/redesPwaContext   contexto de la APP (token SYS obligatorio)
     POST /_functions/redesTokenRefresh renovación silenciosa (hasta 30 días)
   REGLAS: la identidad sale del token SYS, nunca del cliente. La EO es la del
     token. La validación (pertenencia, EO activa, planes) es la del Panel.
   ========================================================== */

// ─── 1) IMPORT · agregar junto a los demás imports ───────────
import { contextoApp as redesContextoApp } from 'backend/redesCore';

// ─── 2) BLOQUE · agregar al final del archivo ───────────────
// =====================================================
// REDES APP · CONTEXTO Y RENOVACIÓN DE TOKEN · v1
// =====================================================
const REDES_ORIGEN = 'https://redes.scad.mx';
const REDES_SESSION_MAX_SEC = 30 * 24 * 60 * 60;
const REDES_HEADERS = { ...HEADERS, 'Access-Control-Allow-Origin': REDES_ORIGEN };

function redesJson(status, body) {
  return response({ status, headers: REDES_HEADERS, body: JSON.stringify(body) });
}

// Identidad para redesCore a partir del memberId verificado en el token
async function redesIdentidad(memberId) {
  const member = await elevatedGetMember(memberId, { fieldsets: ['FULL'] }).catch(() => null);
  if (!member || !member._id) return null;
  return { memberId: member._id, loginEmail: String(member.loginEmail || '').trim(), nativo: false };
}

export function options_redesPwaContext() {
  return response({
    status: 204,
    headers: {
      ...REDES_HEADERS,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Cache-Control',
      'Access-Control-Max-Age': '86400'
    },
    body: ''
  });
}

export async function get_redesPwaContext(request) {
  try {
    const auth = await nexusAuth(request, { headers: REDES_HEADERS, app: 'REDES' });
    if (!auth.ok) return auth.response;

    const ident = await redesIdentidad(auth.memberId);
    if (!ident) return redesJson(401, { ok: false, code: 'AUTH_REQUIRED' });

    const r = await redesContextoApp(ident, { eo: auth.eo });
    if (!r.ok) {
      const sinAcceso = ['NOAUTH', 'SIN_ACCESO'].includes(r.error && r.error.code);
      return redesJson(sinAcceso ? 401 : 500, {
        ok: false,
        code: sinAcceso ? 'AUTH_REQUIRED' : 'REDES_CONTEXT_ERROR',
        mensaje: r.error && r.error.message
      });
    }
    return ok({ headers: REDES_HEADERS, body: { ok: true, ...r.data } });
  } catch (error) {
    console.error('[REDES_PWA_CONTEXT]', error);
    return serverError({ headers: REDES_HEADERS, body: { ok: false, code: 'REDES_CONTEXT_ERROR' } });
  }
}

export function options_redesTokenRefresh() {
  return response({
    status: 204,
    headers: {
      ...REDES_HEADERS,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    body: ''
  });
}

// La APP conserva la sesión en el teléfono y pide aquí un token nuevo antes
// de que venza (hasta 30 días después del inicio de sesión original).
// Se vuelve a validar que el usuario siga perteneciendo a la misma EO.
// Con la suscripción vencida el token se renueva igual: la APP muestra "renovar".
export async function post_redesTokenRefresh(request) {
  const denied = () => redesJson(401, { ok: false, code: 'AUTH_REQUIRED' });
  try {
    const raw = String((request && request.headers && (request.headers.authorization || request.headers.Authorization)) || '');
    const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
    if (!m) return denied();

    const v = await verifyNexusToken(m[1].trim(), { app: 'REDES', allowExpiredSec: REDES_SESSION_MAX_SEC });
    if (!v.ok) return denied();
    const now = Math.floor(Date.now() / 1000);
    if (!v.auth || now - v.auth > REDES_SESSION_MAX_SEC) return denied();

    const ident = await redesIdentidad(v.memberId);
    if (!ident) return denied();
    const ctx = await redesContextoApp(ident, { eo: v.eo });
    if (!ctx.ok) return denied();

    const firmado = await signNexusToken({ memberId: v.memberId, app: 'REDES', eo: v.eo, authAt: v.auth });
    return ok({ headers: REDES_HEADERS, body: { ok: true, token: firmado.token, exp: firmado.exp } });
  } catch (error) {
    console.error('[REDES_TOKEN_REFRESH]', error);
    return serverError({ headers: REDES_HEADERS, body: { ok: false, code: 'TOKEN_REFRESH_ERROR' } });
  }
}
