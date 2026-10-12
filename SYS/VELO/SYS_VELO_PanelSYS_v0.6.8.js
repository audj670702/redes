// =====================================================

// SYS_Panel · Velo página · EO + Autorización de programas

// Versión: v0.6.8

// v0.6.8: REDES en el acceso como admSYS (Panel /gestion-redes).

// Elementos HTML:

//   #htmlTopBar

//   #htmlEO

//   #htmlAutProgramas

// Secciones:

//   #seccPanel

//   #seccEO

//   #seccAutProgramas

// Integra sin alterar:

// - Gestión EO v0.4.5.

// - Asignación/cambio de ADM Principal y admSYS.

// - Modalidad LIBRE/LIMITADO y límites contractuales.

// Nuevo:

// - Navegación AUT_PROGRAMAS.

// - Listado de EO activas.

// - Catálogo de Wix Programs y autorización por EO.

// - Modalidad LIBRE/LIMITADO y límite por programa autorizado.

// =====================================================

import wixLocationFrontend from "wix-location-frontend";

import {

    sysListApps,

    sysListEO,

    sysGetEO,

    sysSaveEO,

    sysSetEOActive,

    sysValidateEOAdmEmail,

    sysSetEOAdmPrincipal,

    sysValidateEOAdmSysEmail,

    sysSetEOAdmSys

} from "backend/sys.web";

import {

    sysListEOForProgramAuthorization,

    sysListProgramsForEO,

    sysSetEOProgramAuthorization,

    sysListProgramParticipantsForEO,

    sysUnenrollProgramParticipantForEO,

    sysUnenrollAllProgramParticipantsForEO

} from "backend/sysCapacitacion.web";

const HTML_TOPBAR = "#htmlTopBar";

const HTML_EO = "#htmlEO";

const HTML_AUT_PROGRAMAS = "#htmlAutProgramas";

const SECC_PANEL = "#seccPanel";

const SECC_EO = "#seccEO";

const SECC_AUT_PROGRAMAS = "#seccAutProgramas";

const SOURCE_TOPBAR_HTML = "SYS_HTML_TOPBAR";

const SOURCE_TOPBAR_VELO = "SYS_VELO_TOPBAR";

const SOURCE_EO_HTML = "SYS_HTML_EO";

const SOURCE_EO_VELO = "SYS_VELO_EO";

const SOURCE_AUT_PROGRAMAS_HTML = "SYS_HTML_AUT_PROGRAMAS";

const SOURCE_AUT_PROGRAMAS_VELO = "SYS_VELO_AUT_PROGRAMAS";

$w.onReady(function () {

    console.log("SYS_PANEL_AUT_PROGRAMAS_V0.6.8");

    aplicarEstadoInicial();

    conectarTopBar();

    conectarEO();

    conectarAutProgramas();

});

// =====================================================

// TOPBAR

// =====================================================

function conectarTopBar() {

    $w(HTML_TOPBAR).onMessage(async (event) => {

const message = event?.data || {};

if (message.source !== SOURCE_TOPBAR_HTML) {

return;

        }

const type = String(message.type || "").trim();

const payload = message.payload || {};

try {

switch (type) {

case "SYS_TOPBAR_READY":

                    enviarTopBar("PANEL");

break;

case "SYS_TOPBAR_SECTION":

await mostrarSeccionSYS(payload.section);

break;

default:

                    console.warn("SYS_PANEL_TOPBAR | mensaje no reconocido:", type);

            }

        } catch (error) {

            console.error("SYS_PANEL_TOPBAR | error:", error);

        }

    });

}

function aplicarEstadoInicial() {

try {

        mostrarElementoInicial(SECC_PANEL);

        ocultarElementoInicial(SECC_EO);

        ocultarElementoInicial(SECC_AUT_PROGRAMAS);

    } catch (error) {

        console.error("SYS_PANEL | no fue posible aplicar estado inicial:", error);

    }

}

function mostrarElementoInicial(selector) {

const element = $w(selector);

if (typeof element.show === "function") element.show();

if (typeof element.expand === "function") element.expand();

}

function ocultarElementoInicial(selector) {

const element = $w(selector);

if (typeof element.hide === "function") element.hide();

if (typeof element.collapse === "function") element.collapse();

}

async function mostrarSeccionSYS(section) {

const target = String(section || "").trim().toUpperCase();

await Promise.all([

        ocultarSeccion(SECC_PANEL),

        ocultarSeccion(SECC_EO),

        ocultarSeccion(SECC_AUT_PROGRAMAS)

    ]);

if (target === "EO") {

await mostrarSeccion(SECC_EO);

        enviarTopBar("EO");

return;

    }

if (target === "AUT_PROGRAMAS") {

await mostrarSeccion(SECC_AUT_PROGRAMAS);

        enviarTopBar("AUT_PROGRAMAS");

await cargarEOsAutProgramas();

return;

    }

await mostrarSeccion(SECC_PANEL);

    enviarTopBar("PANEL");

}

async function mostrarSeccion(selector) {

const element = $w(selector);

if (typeof element.expand === "function") await element.expand();

if (typeof element.show === "function") element.show();

}

async function ocultarSeccion(selector) {

const element = $w(selector);

if (typeof element.collapse === "function") await element.collapse();

if (typeof element.hide === "function") element.hide();

}

function enviarTopBar(section) {

    $w(HTML_TOPBAR).postMessage({

        source: SOURCE_TOPBAR_VELO,

        type: "SYS_TOPBAR_SET_SECTION",

        payload: { section }

    });

}

// =====================================================

// GESTIÓN EO · MENSAJES

// =====================================================

function conectarEO() {

    $w(HTML_EO).onMessage(async (event) => {

const message = event?.data || {};

if (message.source !== SOURCE_EO_HTML) {

return;

        }

const type = String(message.type || "").trim();

const payload = message.payload || {};

        console.log("SYS_PANEL_EO | recibido:", type, payload);

try {

switch (type) {

case "SYS_EO_READY":

case "SYS_EO_REFRESH":

await cargarApps();

await cargarEOs();

break;

case "SYS_EO_SELECT":

await cargarDetalleEO(payload.id);

break;

case "SYS_EO_SAVE":

await guardarEO(payload);

break;

case "SYS_EO_SET_ACTIVE":

await cambiarActivoEO(payload);

break;

case "SYS_EO_VALIDATE_ADM":

await validarAdm(payload);

break;

case "SYS_EO_SET_ADM":

await cambiarAdm(payload);

break;

case "SYS_EO_VALIDATE_ADM_SYS":

await validarAdmSys(payload);

break;

case "SYS_EO_SET_ADM_SYS":

await cambiarAdmSys(payload);

break;

case "SYS_EO_ENTER_AS_ADM_SYS":

await entrarEOComoAdmSys(payload);

break;

default:

                    console.warn("SYS_PANEL_EO | mensaje no reconocido:", type);

            }

        } catch (error) {

            console.error("SYS_PANEL_EO | error:", type, error);

            enviarEO("SYS_EO_ERROR", {

                ok: false,

                mensaje: normalizarError(error)

            });

        }

    });

}

async function cargarApps() {

const result = await sysListApps();

if (!result?.ok) {

throw new Error(result?.mensaje || "No se pudo cargar el catálogo de APPs.");

    }

    enviarEO("SYS_EO_APPS", {

        items: Array.isArray(result.items) ? result.items : []

    });

}

async function cargarEOs() {

const result = await sysListEO();

if (!result?.ok) {

throw new Error(result?.mensaje || "No se pudieron cargar las Empresas Operadoras.");

    }

    enviarEO("SYS_EO_LIST", {

        items: Array.isArray(result.items) ? result.items : []

    });

}

async function cargarDetalleEO(id) {

const eoId = String(id || "").trim();

if (!eoId) {

throw new Error("EO no especificada.");

    }

const result = await sysGetEO({ id: eoId });

if (!result?.ok) {

throw new Error(result?.mensaje || "No se pudo cargar la Empresa Operadora.");

    }

    enviarEO("SYS_EO_DETAIL", { eo: result.eo || {} });

}

async function validarAdm(payload = {}) {

const email = String(payload.email || "").trim().toLowerCase();

const result = await sysValidateEOAdmEmail({ email });

    enviarEO("SYS_EO_VALIDATE_ADM_RESULT", {

        ok: result?.ok === true,

        mensaje: result?.mensaje || "",

        memberId: result?.memberId || "",

        email: result?.email || email

    });

}

async function validarAdmSys(payload = {}) {

const email = String(payload.email || "").trim().toLowerCase();

const result = await sysValidateEOAdmSysEmail({ email });

    enviarEO("SYS_EO_VALIDATE_ADM_SYS_RESULT", {

        ok: result?.ok === true,

        mensaje: result?.mensaje || "",

        memberId: result?.memberId || "",

        email: result?.email || email

    });

}

async function guardarEO(payload = {}) {

const usuariosIlimitados = payload.usuariosIlimitados === true;

const limiteUsuarios = usuariosIlimitados

        ? null

        : normalizarLimiteObligatorio(payload.limiteUsuarios, "usuarios");

const limiteDocumentos = normalizarLimiteObligatorio(payload.limiteDocumentos, "documentos");

const limiteRoles = normalizarLimiteRoles(payload.limiteRoles);

const limiteTiposEvento = normalizarLimiteObligatorio(payload.limiteTiposEvento, "Tipos de Evento BIT");

const evidenciasBit = payload.evidenciasBit === true;

const payloadEO = {

        ...payload,

        usuariosIlimitados,

        limiteUsuarios,

        limiteDocumentos,

       limiteRoles,

       limiteTiposEvento,

       evidenciasBit

   };

const esEdicion = Boolean(String(payload.id || "").trim());

const saveResult = await sysSaveEO(payloadEO);

if (!saveResult?.ok) {

        enviarEO("SYS_EO_SAVE_RESULT", {

            ok: false,

            mensaje: saveResult?.mensaje || "No se pudo guardar la Empresa Operadora."

        });

return;

    }

let eo = saveResult.eo || null;

const adm = payload?.admPrincipal || null;

if (esEdicion && adm && String(adm.memberId || "").trim()) {

const admResult = await sysSetEOAdmPrincipal({

            id: payload.id,

            admPrincipal: adm

        });

if (!admResult?.ok) {

            enviarEO("SYS_EO_SAVE_RESULT", {

                ok: false,

                mensaje: "Los datos de la EO se actualizaron, pero no fue posible actualizar el ADM Principal. " + (admResult?.mensaje || "")

            });

await cargarEOs();

await cargarDetalleEO(payload.id);

return;

        }

        eo = admResult.eo || eo;

    }

const admSys = payload?.admSys || null;

if (esEdicion && admSys && String(admSys.memberId || "").trim()) {

const admSysResult = await sysSetEOAdmSys({

            id: payload.id,

            admSys

        });

if (!admSysResult?.ok) {

            enviarEO("SYS_EO_SAVE_RESULT", {

                ok: false,

                mensaje: "Los datos de la EO se actualizaron, pero no fue posible actualizar admSYS. " + (admSysResult?.mensaje || "")

            });

await cargarEOs();

await cargarDetalleEO(payload.id);

return;

        }

        eo = admSysResult.eo || eo;

    }

    enviarEO("SYS_EO_SAVE_RESULT", {

        ok: true,

        mensaje: esEdicion

            ? "Empresa Operadora actualizada."

            : (saveResult?.mensaje || "Empresa Operadora creada."),

        eo

    });

await cargarEOs();

const eoId = String(eo?.id || eo?._id || payload.id || "").trim();

if (eoId) await cargarDetalleEO(eoId);

}

function normalizarLimiteObligatorio(value, recurso) {

if (value === null || value === undefined || value === "") {

throw new Error(`Captura el límite de ${recurso}.`);

    }

const limite = Number(value);

if (!Number.isInteger(limite) || limite < 0) {

throw new Error(`El límite de ${recurso} debe ser un número entero mayor o igual a 0.`);

    }

return limite;

}

function normalizarLimiteRoles(value) {

const limite = normalizarLimiteObligatorio(value, "roles");

if (limite > 26) {

throw new Error("El límite de roles no puede ser mayor a 26.");

    }

return limite;

}

async function cambiarAdm(payload = {}) {

const id = String(payload.id || "").trim();

if (!id) throw new Error("EO no especificada.");

const result = await sysSetEOAdmPrincipal({

        id,

        admPrincipal: payload.admPrincipal || null

    });

    enviarEO("SYS_EO_SET_ADM_RESULT", {

        ok: result?.ok === true,

        mensaje: result?.mensaje || (result?.ok ? "ADM Principal actualizado." : "No se pudo actualizar el ADM Principal."),

        eo: result?.eo || null

    });

if (result?.ok) {

await cargarEOs();

await cargarDetalleEO(id);

    }

}

async function cambiarAdmSys(payload = {}) {

const id = String(payload.id || "").trim();

if (!id) throw new Error("EO no especificada.");

const result = await sysSetEOAdmSys({

        id,

        admSys: payload.admSys || null

    });

    enviarEO("SYS_EO_SET_ADM_SYS_RESULT", {

        ok: result?.ok === true,

        mensaje: result?.mensaje || (result?.ok ? "admSYS actualizado." : "No se pudo actualizar admSYS."),

        eo: result?.eo || null

    });

if (result?.ok) {

await cargarEOs();

await cargarDetalleEO(id);

    }

}

async function cambiarActivoEO(payload = {}) {

const id = String(payload.id || "").trim();

const activo = payload.activo === true;

if (!id) throw new Error("EO no especificada.");

const result = await sysSetEOActive({ id, activo });

if (!result?.ok) {

throw new Error(result?.mensaje || "No se pudo cambiar el estado de la Empresa Operadora.");

    }

await cargarEOs();

await cargarDetalleEO(id);

}

async function entrarEOComoAdmSys(payload = {}) {

const id = String(payload.id || "").trim();

const app = String(payload.app || "").trim().toUpperCase();

const codigoEO = String(payload.codigoEO || "").trim();

if (!id) throw new Error("EO no especificada.");

if (!app) throw new Error("APP no especificada.");

if (!codigoEO) throw new Error("Código EO no especificado.");

 // Revalida la EO desde SYS antes de abrir la APP.

 // No crea ni modifica usuarios propios de la EO.

const result = await sysGetEO({ id });

if (!result?.ok || !result?.eo) {

throw new Error(result?.mensaje || "No se pudo validar la Empresa Operadora.");

 }

const eo = result.eo;

if (eo.activo !== true) {

throw new Error("La Empresa Operadora está inactiva.");

 }

if (String(eo.app || "").trim().toUpperCase() !== app) {

throw new Error("La APP de la EO ya no coincide con la seleccionada.");

 }

if (String(eo.codigoEO || "").trim() !== codigoEO) {

throw new Error("El Código EO ya no coincide con la EO seleccionada.");

 }

if (!eo.admSys || !String(eo.admSys.usrId || "").trim()) {

throw new Error("La Empresa Operadora no tiene admSYS asignado.");

 }

const PANEL_ADM_POR_APP = {
        GYM: "/panel-de-entrenador",
        ODIN: "/panel-odin",
        "PORTAL OPERATIVO": "/portaloperativo",
        PORTALOPERATIVO: "/portaloperativo",
        MORENA: "/mor-panel-adm",
        ARCADE: "/arc-panel",
        COM: "/com-panel",
        COMUNIDAD: "/com-panel",
        CPC: "/cpc-panel",
        "TV DIGITAL": "/qtv-panel-control",
        TVDIGITAL: "/qtv-panel-control",
        MNS: "/mns-adm",
        NEXUS: "/nexus-panel",
        RESIDENCIAL: "https://residencial.scad.mx",
        REDES: "/gestion-redes"
    };

    const panelAdm = PANEL_ADM_POR_APP[app];

    if (!panelAdm) {
        throw new Error(`No existe una dirección de Panel ADM configurada para la APP ${app}.`);
    }

    const separador = panelAdm.includes("?") ? "&" : "?";

    wixLocationFrontend.to(
        `${panelAdm}${separador}scadEO=${encodeURIComponent(codigoEO)}`
    );
    return;
}

function enviarEO(type, payload = {}) {

    $w(HTML_EO).postMessage({

        source: SOURCE_EO_VELO,

        type,

        payload

    });

}

// =====================================================

// AUTORIZACIÓN DE PROGRAMAS · MENSAJES

// =====================================================

function conectarAutProgramas() {

    $w(HTML_AUT_PROGRAMAS).onMessage(async (event) => {

const message = event?.data || {};

if (message.source !== SOURCE_AUT_PROGRAMAS_HTML) {

return;

        }

const type = String(message.type || "").trim();

const payload = message.payload || {};

        console.log("SYS_PANEL_AUT_PROGRAMAS | recibido:", type, payload);

try {

switch (type) {

case "SYS_AUT_PROGRAMAS_READY":

await cargarEOsAutProgramas();

break;

case "SYS_AUT_PROGRAMAS_REFRESH":

await cargarEOsAutProgramas();

if (String(payload.eoId || "").trim()) {

await cargarProgramasEO(payload);

                    }

break;

case "SYS_AUT_PROGRAMAS_SELECT_EO":

await cargarProgramasEO(payload);

break;

case "SYS_AUT_PROGRAMAS_SET":

await actualizarAutorizacionPrograma(payload);

break;

case "SYS_AUT_PROGRAMAS_PARTICIPANTS":

await cargarParticipantesProgramaSYS(payload);

break;

case "SYS_AUT_PROGRAMAS_UNENROLL_PARTICIPANT":

await retirarParticipanteProgramaSYS(payload);

break;

case "SYS_AUT_PROGRAMAS_UNENROLL_ALL":

await retirarParticipantesProgramaSYS(payload);

break;

default:

                    console.warn("SYS_PANEL_AUT_PROGRAMAS | mensaje no reconocido:", type);

            }

        } catch (error) {

            console.error("SYS_PANEL_AUT_PROGRAMAS | error:", type, error);

            enviarAutProgramas("SYS_AUT_PROGRAMAS_ERROR", {

                ok: false,

                mensaje: normalizarError(error)

            });

        }

    });

}

async function cargarEOsAutProgramas() {

const result = await sysListEOForProgramAuthorization();

if (!result?.ok) {

throw new Error(result?.mensaje || "No se pudieron cargar las EO activas para autorización de programas.");

    }

    enviarAutProgramas("SYS_AUT_PROGRAMAS_EO_LIST", {

        items: Array.isArray(result.items) ? result.items : []

    });

}

async function cargarProgramasEO(payload = {}) {

const eoId = String(payload.eoId || "").trim();

const codigoEO = String(payload.codigoEO || "").trim();

if (!eoId) {

throw new Error("Selecciona una Empresa Operadora.");

    }

const result = await sysListProgramsForEO({ eoId, codigoEO });

if (!result?.ok) {

throw new Error(result?.mensaje || "No se pudo cargar el catálogo de Wix Programs para la EO seleccionada.");

    }

    enviarAutProgramas("SYS_AUT_PROGRAMAS_PROGRAM_LIST", {

        eoId,

        items: Array.isArray(result.items) ? result.items : []

    });

}

async function actualizarAutorizacionPrograma(payload = {}) {

const eoId = String(payload.eoId || "").trim();

const codigoEO = String(payload.codigoEO || "").trim();

const programId = String(payload.programId || "").trim();

const autorizado = payload.autorizado === true;

const modalidad = autorizado

        ? normalizarModalidadPrograma(payload.modalidad)

        : "";

const limiteParticipantes = autorizado && modalidad === "LIMITADO"

        ? normalizarLimitePrograma(payload.limiteParticipantes)

        : null;

if (!eoId) throw new Error("Empresa Operadora no especificada.");

if (!programId) throw new Error("Programa Wix no especificado.");

const result = await sysSetEOProgramAuthorization({

        eoId,

        codigoEO,

        programId,

        autorizado,

        modalidad,

        limiteParticipantes

    });

    enviarAutProgramas("SYS_AUT_PROGRAMAS_SET_RESULT", {

        ok: result?.ok === true,

        mensaje: result?.mensaje || (

            result?.ok

                ? autorizado

                    ? "Programa autorizado para la EO."

                    : "Autorización retirada."

                : "No fue posible actualizar la autorización del programa."

        ),

        eoId,

        programId,

        autorizado: result?.ok === true ? autorizado : !autorizado,

        modalidad: result?.ok === true && autorizado

            ? normalizarModalidadPrograma(result?.modalidad || modalidad)

            : "",

        limiteParticipantes: result?.ok === true && autorizado &&

            normalizarModalidadPrograma(result?.modalidad || modalidad) === "LIMITADO"

                ? normalizarLimitePrograma(

                    result?.limiteParticipantes ?? limiteParticipantes

                )

                : null

    });

if (result?.ok) {

await cargarEOsAutProgramas();

    }

}

async function cargarParticipantesProgramaSYS(payload = {}) {

const eoId = String(payload.eoId || "").trim();

const codigoEO = String(payload.codigoEO || "").trim();

const programId = String(payload.programId || "").trim();

if (!eoId) throw new Error("Empresa Operadora no especificada.");

if (!programId) throw new Error("Programa Wix no especificado.");

const result = await sysListProgramParticipantsForEO({ eoId, codigoEO, programId });

    enviarAutProgramas("SYS_AUT_PROGRAMAS_PARTICIPANTS_RESULT", {

        ok: result?.ok === true,

        mensaje: result?.mensaje || "",

        eoId,

        programId,

        items: Array.isArray(result?.items)

            ? result.items

            : Array.isArray(result?.participants) ? result.participants : []

    });

}

async function retirarParticipanteProgramaSYS(payload = {}) {

const eoId = String(payload.eoId || "").trim();

const codigoEO = String(payload.codigoEO || "").trim();

const programId = String(payload.programId || "").trim();

const memberId = String(payload.memberId || "").trim();

if (!eoId) throw new Error("Empresa Operadora no especificada.");

if (!programId) throw new Error("Programa Wix no especificado.");

if (!memberId) throw new Error("Participante no especificado.");

const result = await sysUnenrollProgramParticipantForEO({

        eoId, codigoEO, programId, memberId

    });

    enviarAutProgramas("SYS_AUT_PROGRAMAS_UNENROLL_RESULT", {

        ok: result?.ok === true,

        mensaje: result?.mensaje || (result?.ok

            ? "Participante retirado correctamente."

            : "No fue posible retirar al participante."),

        eoId,

        programId,

        memberId

    });

}

async function retirarParticipantesProgramaSYS(payload = {}) {

const eoId = String(payload.eoId || "").trim();

const codigoEO = String(payload.codigoEO || "").trim();

const programId = String(payload.programId || "").trim();

if (!eoId) throw new Error("Empresa Operadora no especificada.");

if (!programId) throw new Error("Programa Wix no especificado.");

const result = await sysUnenrollAllProgramParticipantsForEO({

        eoId, codigoEO, programId

    });

    enviarAutProgramas("SYS_AUT_PROGRAMAS_UNENROLL_ALL_RESULT", {

        ok: result?.ok === true,

        mensaje: result?.mensaje || (result?.ok

            ? "Participantes gestionados por la EO retirados correctamente."

            : "No fue posible retirar los participantes gestionados por la EO."),

        eoId,

        programId,

        retirados: Number(result?.retirados || 0),

        errores: Array.isArray(result?.errores) ? result.errores : []

    });

}

function normalizarModalidadPrograma(value) {

const modalidad = String(value || "").trim().toUpperCase();

if (modalidad !== "LIBRE" && modalidad !== "LIMITADO") {

throw new Error("Selecciona una modalidad válida para el programa: LIBRE o LIMITADO.");

    }

return modalidad;

}

function normalizarLimitePrograma(value) {

if (value === null || value === undefined || value === "") {

throw new Error("Captura el límite de participantes del programa.");

    }

const limite = Number(value);

if (!Number.isInteger(limite) || limite < 1) {

throw new Error("El límite de participantes debe ser un número entero mayor o igual a 1.");

    }

return limite;

}

function enviarAutProgramas(type, payload = {}) {

    $w(HTML_AUT_PROGRAMAS).postMessage({

        source: SOURCE_AUT_PROGRAMAS_VELO,

        type,

        payload

    });

}

// =====================================================

// ERROR

// =====================================================

function normalizarError(error) {

if (!error) return "Error de Gestión del Sistema.";

if (typeof error === "string") return error;

return error.message || "Error de Gestión del Sistema.";

}
