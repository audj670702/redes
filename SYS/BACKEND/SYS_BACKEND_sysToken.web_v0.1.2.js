// backend/sysToken.web.js
// ─────────────────────────────────────────────────────────────
// SYS · Emisión de token para NEXUS / MNS / CPC / REDES   v0.1.2
// v0.1.2: REDES se incorpora al token SYS.
// v0.1.1: CPC se incorpora al token SYS (normalización CPC).
//
// La página sys-autenticacion llama a issueAppToken() justo antes de
// regresar al usuario a la app. El memberId se toma de la SESIÓN REAL
// de Wix (nunca de lo que mande el navegador) y se vuelve a validar
// que el usuario tenga un acceso activo para esa app y Operadora.
// ─────────────────────────────────────────────────────────────

import { Permissions, webMethod } from 'wix-web-module';
import { currentMember } from 'wix-members-backend';
import { signNexusToken } from 'backend/nexusAuth';
import { getUsrContext } from 'backend/scadUsr.web';

const APPS_CON_TOKEN = ['NEXUS', 'MNS', 'CPC', 'REDES'];

// datos = { app: 'NEXUS' | 'MNS' | 'CPC' | 'REDES', enteOperador: '...' (opcional) }
// devuelve { ok: true, token, exp }  o  { ok: false, mensaje }
export const issueAppToken = webMethod(Permissions.SiteMember, async (datos) => {
  const d = datos || {};
  const app = String(d.app || '').trim().toUpperCase();
  const enteOperador = String(d.enteOperador || '').trim();

  if (!APPS_CON_TOKEN.includes(app)) {
    return { ok: false, mensaje: 'Esta app no usa token.' };
  }

  try {
    // 1) ¿Quién es? → sesión real de Wix
    const member = await currentMember.getMember();
    if (!member || !member._id) {
      return { ok: false, mensaje: 'Sesión no válida. Inicia sesión de nuevo.' };
    }

    // 2) ¿Tiene acceso activo a esta app / Operadora?
    const contexto = enteOperador
      ? await getUsrContext({ app, enteOperador })
      : await getUsrContext({ app });

    const usuario = contexto && contexto.usuario;
    if (
      !contexto ||
      contexto.ok !== true ||
      contexto.encontrado !== true ||
      contexto.requiereSeleccionEO === true ||
      !usuario ||
      usuario.activo !== true
    ) {
      return { ok: false, mensaje: `No tienes un acceso activo a ${app} para esta Operadora.` };
    }

    // Defensa extra: el contexto debe pertenecer a la misma persona
    if (usuario.memberId && usuario.memberId !== member._id) {
      return { ok: false, mensaje: 'El contexto no corresponde a la sesión.' };
    }

    const eo = String(usuario.enteOperador || usuario.codigoContexto || '').trim();
    if (!eo) {
      return { ok: false, mensaje: 'No se identificó la Operadora del acceso.' };
    }

    // 3) Firmar
    const firmado = await signNexusToken({ memberId: member._id, app, eo });
    return { ok: true, token: firmado.token, exp: firmado.exp };
  } catch (error) {
    console.error('SYS TOKEN | issueAppToken:', error);
    return { ok: false, mensaje: 'No se pudo emitir el token de acceso.' };
  }
});
