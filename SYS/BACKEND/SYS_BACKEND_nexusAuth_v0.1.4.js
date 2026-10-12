// backend/nexusAuth.js
// ─────────────────────────────────────────────────────────────
// NEXUS · Token firmado (HMAC-SHA256, formato JWT HS256) · v0.1.4
// v0.1.4: REDES se agrega a las apps que reciben token SYS.
// v0.1.3: CPC se agrega a las apps que reciben token SYS (normalización CPC).
// v0.1.2: claim `auth` (momento del login original) y verificación con
//         `allowExpiredSec` para la renovación silenciosa del token.
//
// IMPORTANTE: este archivo es .js (NO .jsw ni .web.js) a propósito.
// Así sólo lo pueden usar otros archivos del backend
// (http-functions.js, sys-autenticacion) y nunca el navegador.
//
// Requiere en Wix Secrets Manager:  NEXUS_TOKEN_SECRET
// ─────────────────────────────────────────────────────────────

import crypto from 'crypto';
import { getSecret } from 'wix-secrets-backend';
import { response } from 'wix-http-functions';

const SECRET_NAME = 'NEXUS_TOKEN_SECRET';
const DEFAULT_TTL_SEC = 8 * 60 * 60;   // 8 horas (un turno)
const CLOCK_SKEW_SEC = 60;             // tolerancia de reloj
const APPS_VALIDAS = ['NEXUS', 'MNS', 'CPC', 'REDES'];

// ── Secreto (se cachea mientras el contenedor siga vivo) ─────
let _secretCache = null;

async function getTokenSecret() {
  if (_secretCache) return _secretCache;
  const s = await getSecret(SECRET_NAME);
  if (!s || s.length < 32) {
    // Error de configuración: no es culpa del usuario.
    throw new Error('NEXUS_TOKEN_SECRET no configurado o demasiado corto');
  }
  _secretCache = s;
  return s;
}

// ── Utilidades base64url ─────────────────────────────────────
function b64urlEncode(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return Buffer.from(b64 + pad, 'base64');
}

function hmac(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest();
}

const HEADER_B64 = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

// ── FIRMAR ───────────────────────────────────────────────────
// Emite un token. Llamar SOLO desde backend con la sesión real de Wix
// (sys-autenticacion), nunca con un memberId que venga del navegador.
//   datos = { memberId, eo, app: 'NEXUS' | 'MNS' | 'CPC' | 'REDES' (opcional), ttlSec (opcional) }
//   devuelve { token, exp }   (exp en segundos)
export async function signNexusToken(datos) {
  const d = datos || {};
  const authAt = typeof d.authAt === 'number' ? d.authAt : null;
  const memberId = d.memberId;
  const eo = d.eo;
  const app = d.app || 'NEXUS';
  const ttlSec = typeof d.ttlSec === 'number' ? d.ttlSec : DEFAULT_TTL_SEC;
  if (!memberId || typeof memberId !== 'string') throw new Error('signNexusToken: memberId requerido');
  if (!eo || typeof eo !== 'string') throw new Error('signNexusToken: eo requerido');
  if (!APPS_VALIDAS.includes(app)) throw new Error('signNexusToken: app inválida');

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: memberId,
    app,
    eo,
    iat: now,
    exp: now + ttlSec,
    auth: authAt || now, // momento del login original (se conserva al renovar)
    jti: crypto.randomBytes(8).toString('hex'), // id único del token (útil para bitácora)
  };

  const secret = await getTokenSecret();
  const body = HEADER_B64 + '.' + b64urlEncode(JSON.stringify(payload));
  const sig = b64urlEncode(hmac(secret, body));
  return { token: body + '.' + sig, exp: payload.exp };
}

// ── VERIFICAR ────────────────────────────────────────────────
// Verifica firma y vencimiento.
//   opciones = { app: 'NEXUS' | 'MNS' }  (opcional)
//   devuelve { ok: true, memberId, app, eo, exp, jti }  o  { ok: false, reason }
export async function verifyNexusToken(token, opciones) {
  const app = (opciones || {}).app;
  const allowExpiredSec = Number((opciones || {}).allowExpiredSec) || 0;
  if (!token || typeof token !== 'string') return { ok: false, reason: 'MISSING' };

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'MALFORMED' };
  const [h, p, s] = parts;
  if (h !== HEADER_B64) return { ok: false, reason: 'BAD_HEADER' }; // bloquea alg:none y similares

  const secret = await getTokenSecret();
  const expected = hmac(secret, h + '.' + p);
  let given;
  try { given = b64urlDecode(s); } catch (e) { return { ok: false, reason: 'MALFORMED' }; }

  // Comparación en tiempo constante (timingSafeEqual exige mismo largo)
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'BAD_SIGNATURE' };
  }

  let payload;
  try { payload = JSON.parse(b64urlDecode(p).toString('utf8')); } catch (e) {
    return { ok: false, reason: 'MALFORMED' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || now > payload.exp + CLOCK_SKEW_SEC + allowExpiredSec) return { ok: false, reason: 'EXPIRED' };
  if (typeof payload.iat === 'number' && payload.iat > now + CLOCK_SKEW_SEC) return { ok: false, reason: 'NOT_YET_VALID' };
  if (!payload.sub || !payload.eo) return { ok: false, reason: 'MALFORMED' };
  if (app && payload.app !== app) return { ok: false, reason: 'WRONG_APP' };

  return {
    ok: true, memberId: payload.sub, app: payload.app, eo: payload.eo,
    exp: payload.exp, jti: payload.jti,
    auth: typeof payload.auth === 'number' ? payload.auth : payload.iat
  };
}

// ── HELPER PARA HTTP-FUNCTIONS ───────────────────────────────
function readAuthHeader(request) {
  const h = (request && request.headers) || {};
  const raw = h.authorization || h.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(raw).trim());
  return m ? m[1].trim() : null;
}

// Úsalo al inicio de cada función nexus* / sysPwaProfile / mnsBridge:
//
//   const auth = await nexusAuth(request, { headers: NEXUS_HEADERS });
//   if (!auth.ok) return auth.response;
//   const memberId = auth.memberId;   // ← ÚNICA fuente de memberId
//
//   opciones = {
//     app:     'NEXUS' | 'MNS'  (opcional: exige esa app)
//     eo:      codigoEO que manda el cliente (opcional: si no coincide con
//              el del token, se rechaza con 403)
//     headers: headers CORS a incluir en la respuesta de error
//   }
export async function nexusAuth(request, opciones) {
  const o = opciones || {};
  const app = o.app;
  const eo = o.eo;
  const headers = o.headers || {};
  const token = readAuthHeader(request);
  /** @type {any} */
  let v;
  try {
    v = await verifyNexusToken(token, { app });
  } catch (e) {
    // Falla de configuración (secreto ausente): 500, no 401,
    // para no mandar al usuario a un login infinito.
    console.error('nexusAuth config error:', e.message);
    return { ok: false, response: jsonResponse(500, { ok: false, code: 'AUTH_CONFIG' }, headers) };
  }

  if (!v.ok) {
    return {
      ok: false,
      reason: v.reason,
      response: jsonResponse(401, { ok: false, code: 'AUTH_REQUIRED' }, headers),
    };
  }

  if (eo && eo !== v.eo) {
    return {
      ok: false,
      reason: 'EO_MISMATCH',
      response: jsonResponse(403, { ok: false, code: 'EO_MISMATCH' }, headers),
    };
  }

  // token: se reenvía a los módulos web (sysBitacora, sys, mnsCore) como prueba de identidad.
  return { ok: true, memberId: v.memberId, eo: v.eo, app: v.app, exp: v.exp, jti: v.jti, token };
}

function jsonResponse(status, body, headers) {
  return response({
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}