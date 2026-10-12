/* ==========================================================
   TIPO:      BACKEND (módulo web)
   PROYECTO:  SCaD Redes · Panel de Publicaciones en Redes
   SITIO:     scad.mx
   ARCHIVO:   RED_BACKEND_redes.web.js
              En Wix se instala como:  backend/redes.web.js
   VERSIÓN:   v2.4 · 2026-10-12
   DEPENDE:   backend/redesCore.js (RED_BACKEND_redesCore.js v1)
   USADO POR: RED_VELO_gestion-redes_v5.js
   FUNCIÓN:   Métodos web del Panel. Toma la identidad de la sesión de Wix
              (nunca del navegador) y delega toda la lógica en redesCore,
              la misma que usa la APP vía http-functions.
   CAMBIOS v2.4: lógica movida a redesCore.js; registro con ficha SYS
              completa; EO con accesoDirecto, ambos planes y cuenta admSYS;
              acceso de asistencia (solo lectura).
   CAMBIOS v2.3 y anteriores: ver historial del repositorio.
   ========================================================== */
import { Permissions, webMethod } from 'wix-web-module';
import { currentMember } from 'wix-members-backend';
import * as core from 'backend/redesCore';

// Identidad desde la sesión real de Wix
async function identidad() {
  const m = await currentMember.getMember({ fieldsets: ['FULL'] }).catch(() => null);
  if (!m || !m._id) return null;
  const roles = await currentMember.getRoles().catch(() => []);
  return { memberId: m._id, loginEmail: String(m.loginEmail || '').trim(), nativo: core.esRolNativo(roles) };
}

export const obtenerContexto = webMethod(Permissions.SiteMember, async (req) =>
  core.obtenerContexto(await identidad(), req));

export const ping = webMethod(Permissions.SiteMember, async (req) =>
  core.ping(await identidad(), req));

export const cerrarSesion = webMethod(Permissions.SiteMember, async (req) =>
  core.cerrarSesion(await identidad(), req));

export const cargarDatos = webMethod(Permissions.SiteMember, async (req) =>
  core.cargarDatos(await identidad(), req));

export const guardar = webMethod(Permissions.SiteMember, async (req, tipo, entradas) =>
  core.guardar(await identidad(), req, tipo, entradas));

export const eliminar = webMethod(Permissions.SiteMember, async (req, tipo, ids) =>
  core.eliminar(await identidad(), req, tipo, ids));

export const registrarEmpresa = webMethod(Permissions.SiteMember, async (req, datos) =>
  core.registrarEmpresa(await identidad(), req, datos));

export const listarUsuarios = webMethod(Permissions.SiteMember, async (req) =>
  core.listarUsuarios(await identidad(), req));

export const invitarUsuario = webMethod(Permissions.SiteMember, async (req, datos) =>
  core.invitarUsuario(await identidad(), req, datos));

export const actualizarUsuario = webMethod(Permissions.SiteMember, async (req, usrId, datos) =>
  core.actualizarUsuario(await identidad(), req, usrId, datos));

export const quitarUsuario = webMethod(Permissions.SiteMember, async (req, usrId) =>
  core.quitarUsuario(await identidad(), req, usrId));
