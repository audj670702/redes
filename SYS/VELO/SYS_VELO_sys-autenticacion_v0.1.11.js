// SYS · AUT + CTX · Velo página v0.1.0
// v0.1.11: REDES recibe token SYS. Un usuario de REDES sin empresa se envía al
//          Panel REDES (/gestion-redes), donde compra PLAN REDES y registra su EO.

        // Página Wix: /sys-autenticacion

import wixLocation from 'wix-location';

import { currentMember, authentication } from 'wix-members-frontend';

import { customPurchaseFlow } from 'wix-pricing-plans-frontend';

import {

          getUsrContext,

          listPublicEOs,

          resolveEOByAccessCode,

          registerUsrContext,

          validateUsrAdmission

        } from 'backend/scadUsr.web';

import { issueAppToken } from 'backend/sysToken.web';

const VERSION = 'SYS_AUTH_CTX_VELO_v0.1.11';

// ── TOKEN (paso 2 del plan) ──────────────────────────────────
// Apps que reciben token firmado al regresar del login.
// v0.1.10: CPC se incorpora al token SYS.
const APPS_CON_TOKEN = ['NEXUS', 'MNS', 'CPC', 'REDES'];

// false = periodo de transición: si el token falla, el usuario
//         entra igual que antes (NEXUS todavía no lo exige).
// true  = obligatorio: si el token falla, NO se regresa a la app.
//         Cambiar a true cuando NEXUS ya use el token (paso 3).
const TOKEN_OBLIGATORIO = true;

// Apps que ya NO reciben memberId / enteOperador / codigoContexto en la
// dirección de regreso: su identidad viaja sólo en el token (#t=).
// Las demás apps siguen recibiendo esos datos como hasta hoy.
const APPS_SOLO_TOKEN = ['NEXUS', 'CPC', 'REDES'];

// REDES: el alta de la Operadora la hace el propio titular en su Panel (autoservicio)
const URL_PANEL_REDES = 'https://www.scad.mx/gestion-redes';

const HTML_AUTH = '#htmlAutenticacion';

const HTML_USR = '#htmlRegistroUSR';

const SECC_AUTH = '#seccAutenticacion';

const SECC_USR = '#seccRegistroUSR';

const APP = normalizarAppEntrada(wixLocation.query?.app);

const RETURN_URL = normalizarRetorno(wixLocation.query?.returnUrl || wixLocation.query?.retorno);

if (!APP) {

throw new Error('SYS AUT+CTX | Falta parámetro APP.');

    }

if (!RETURN_URL) {

throw new Error('SYS AUT+CTX | Falta retorno válido.');

    }

let memberActual = null;

let validando = false;

let guardando = false;

        $w.onReady(async function () {

          console.log(VERSION);

          instalarAuth();

          instalarRegistroUSR();

if (wixLocation.query?.logout === '1') {

try {

if (authentication.loggedIn()) {

await authentication.logout();

              }

            } catch (error) {

              console.error(

                'SYS AUT+CTX | logout:',

                error

              );

            } finally {

              memberActual = null;

              wixLocation.to(construirRetorno({ logoutDone: '1', t: String(Date.now()) }));

            }

return;

          }

await mostrarEtapa('autenticacion');

await validarAcceso();

        });

async function mostrarEtapa(etapa) {

const auth = etapa === 'autenticacion';

try {

if (auth) {

await $w(SECC_AUTH).show();

await $w(SECC_USR).hide();

            } else {

await $w(SECC_AUTH).hide();

await $w(SECC_USR).show();

            }

          } catch (error) {

            console.warn(

              'SYS AUT+CTX | No se pudo cambiar etapa:',

              error

            );

          }

        }

function instalarAuth() {

          $w(HTML_AUTH).onMessage(async (event) => {

const msg = event.data || {};

if (msg.source !== 'SYS_HTML_AUTH') return;

if (

              msg.type === 'SYS_AUTH_READY' ||

              msg.type === 'SYS_AUTH_REVALIDATE'

            ) {

await validarAcceso();

return;

            }

if (msg.type === 'SYS_AUTH_LOGIN') {

try {

await authentication.promptLogin({

                  mode: 'login'

                });

                memberActual = null;

await validarAcceso();

              } catch (error) {

                enviarAuthError(

                  normalizarError(error)

                );

              }

            }

if (msg.type === 'SYS_AUTH_SELECT_CONTEXT') {

await validarContextoSeleccionado(

                msg.payload?.enteOperador

              );

return;

            }

          });

        }

function instalarRegistroUSR() {

          $w(HTML_USR).onMessage(async (event) => {

const msg = event.data || {};

if (msg.source !== 'SYS_HTML_USR') return;

if (msg.type === 'SYS_USR_READY') {

await prepararRegistro();

return;

            }

if (msg.type === 'SYS_USR_SELECT_EO') {

await validarPreRegistroSeleccionEO(

              msg.payload || {}

            );

return;

          }

if (

              msg.type ===

              'SYS_USR_VALIDATE_EO_CODE'

            ) {

await validarCodigoEO(

                msg.payload?.codigo

              );

return;

            }

if (msg.type === 'SYS_USR_VALIDATE_ADMISSION') {

await validarAdmisionUSR(

                msg.payload || {}

              );

return;

            }

if (msg.type === 'SYS_USR_BUY_PLAN') {

await comprarPlanUSR(

                msg.payload || {}

              );

return;

            }

if (msg.type === 'SYS_USR_SAVE') {

await guardarUSR(

                msg.payload || {}

              );

            }

          });

        }

async function validarAcceso() {

if (validando) return;

        validando = true;

try {

const member = await obtenerMiembro();

if (!member?._id) {

await mostrarEtapa(

              'autenticacion'

            );

            enviarAuthState({

              sesionOk: false,

              mensajeSistema:

                'Inicia sesión para continuar.'

            });

return;

          }

const identity =

            mapearIdentidadWix(member);

const contexto =

await getUsrContext({

              app: APP

            });

if (!contexto?.ok) {

throw new Error(

              contexto?.mensaje ||

              'No se pudo validar el contexto SCaD.'

            );

          }

if (contexto.requiereSeleccionEO === true) {

await mostrarEtapa('autenticacion');

            enviarAuthState({

              sesionOk: true,

              memberNombre:

                identity.nombreReferencia,

              memberEmail:

                identity.email,

              requiereSeleccionEO: true,

              contextos:

                Array.isArray(contexto.contextos)

                  ? contexto.contextos

                  : [],

              mensajeSistema:

                'Selecciona la Operadora con la que deseas ingresar.'

            });

return;

          }

if (contexto.encontrado === true) {

if (

              contexto.usuario?.activo === true

            ) {

              enviarAuthState({

                sesionOk: true,

                memberNombre:

                  identity.nombreReferencia,

                memberEmail:

                  identity.email,

                mensajeSistema:

                  'Acceso validado.'

              });

              await irARetorno({ memberId: member._id });

return;

            }

await mostrarEtapa(

              'autenticacion'

            );

            enviarAuthState({

              sesionOk: true,

              memberNombre:

                identity.nombreReferencia,

              memberEmail:

                identity.email,

              mensajeSistema:

                `Tu acceso a ${APP} no está activo.`

            });

return;

          }

          // REDES no usa la ficha genérica: el titular compra y registra su EO en el Panel REDES.
          if (APP === 'REDES') {
            wixLocation.to(URL_PANEL_REDES);
            return;
          }

          enviarAuthState({

            sesionOk: true,

            memberNombre:

              identity.nombreReferencia,

            memberEmail:

              identity.email,

            mensajeSistema:

              'Completa tu registro.'

          });

await mostrarEtapa('registro');

await prepararRegistro();

        } catch (error) {

          console.error(

            'SYS AUT+CTX | validarAcceso:',

            error

          );

await mostrarEtapa(

            'autenticacion'

          );

          enviarAuthError(

            normalizarError(error)

          );

        } finally {

          validando = false;

        }

      }

async function validarContextoSeleccionado(enteOperador) {

const contextoEO = String(enteOperador || '').trim();

if (!contextoEO) {

          enviarAuthError('Selecciona una Operadora para continuar.');

return;

        }

try {

const member = await obtenerMiembro();

if (!member?._id) {

await mostrarEtapa('autenticacion');

          enviarAuthState({

            sesionOk: false,

            mensajeSistema: 'Inicia sesión para continuar.'

          });

return;

        }

const identity = mapearIdentidadWix(member);

const contexto = await getUsrContext({

          app: APP,

          enteOperador: contextoEO

        });

if (!contexto?.ok) {

throw new Error(

            contexto?.mensaje ||

            'No se pudo validar el contexto seleccionado.'

          );

        }

if (

          contexto.encontrado !== true ||

          contexto.requiereSeleccionEO === true ||

          !contexto.usuario

        ) {

throw new Error(

            'No existe un contexto válido para la Operadora seleccionada.'

          );

        }

if (contexto.usuario.activo !== true) {

          enviarAuthState({

            sesionOk: true,

            memberNombre: identity.nombreReferencia,

            memberEmail: identity.email,

            mensajeSistema:

              `Tu acceso a ${APP} no está activo para la Operadora seleccionada.`

          });

return;

        }

        enviarAuthState({

          sesionOk: true,

          memberNombre: identity.nombreReferencia,

          memberEmail: identity.email,

          mensajeSistema: 'Acceso validado.'

        });

        await irARetorno({

            memberId: member._id,

            enteOperador: contexto.usuario.enteOperador,

            codigoContexto:

              contexto.usuario.codigoContexto ||

              contexto.usuario.enteOperador

          });

      } catch (error) {

        console.error(

          'SYS AUT+CTX | validarContextoSeleccionado:',

          error

        );

        enviarAuthError(normalizarError(error));

      }

    }

async function prepararRegistro() {

const member =

await obtenerMiembro();

if (!member?._id) {

await mostrarEtapa(

              'autenticacion'

            );

return;

          }

const identity =

            mapearIdentidadWix(member);

          $w(HTML_USR).postMessage({

            source: 'SYS_VELO_USR',

            type: 'SYS_USR_IDENTITY',

            payload: identity

          });

try {

const result =

await listPublicEOs({

                app: APP

              });

            $w(HTML_USR).postMessage({

              source: 'SYS_VELO_USR',

              type: 'SYS_USR_EO_LIST',

              payload: {

                items:

                  result?.ok

                    ? result.items

                    : []

              }

            });

          } catch (error) {

            console.error(

              'SYS AUT+CTX | EO públicas:',

              error

            );

            $w(HTML_USR).postMessage({

              source: 'SYS_VELO_USR',

              type: 'SYS_USR_EO_LIST',

              payload: {

                items: []

              }

            });

          }

        }

async function validarPreRegistroSeleccionEO(payload = {}) {
  const eoId = String(payload.eoId || '').trim();
  if (!eoId) {
    $w(HTML_USR).postMessage({
      source: 'SYS_VELO_USR',
      type: 'SYS_USR_PREREG_RESULT',
      payload: { ok: false, encontrado: false, continuarAdmision: false, mensaje: 'Selecciona una Operadora para continuar.' }
    });
    return;
  }
  try {
    const member = await obtenerMiembro();
    if (!member?._id) {
      await mostrarEtapa('autenticacion');
      enviarAuthState({ sesionOk: false, mensajeSistema: 'Inicia sesión para continuar.' });
      return;
    }
    const contexto = await getUsrContext({ app: APP, eoId });
    if (!contexto?.ok) {
      throw new Error(contexto?.mensaje || 'No se pudo validar el pre-registro.');
    }
    if (contexto.encontrado === true && contexto.usuario) {
      if (contexto.usuario.activo !== true) {
        $w(HTML_USR).postMessage({
          source: 'SYS_VELO_USR',
          type: 'SYS_USR_PREREG_RESULT',
          payload: {
            ok: true,
            encontrado: true,
            activo: false,
            continuarAdmision: false,
            mensaje: `Tu acceso a ${APP} no está activo para la Operadora seleccionada.`
          }
        });
        return;
      }
      await irARetorno({
        memberId: member._id,
        enteOperador: contexto.usuario.enteOperador,
        codigoContexto: contexto.usuario.codigoContexto || contexto.usuario.enteOperador
      });
      return;
    }
    $w(HTML_USR).postMessage({
      source: 'SYS_VELO_USR',
      type: 'SYS_USR_PREREG_RESULT',
      payload: { ok: true, encontrado: false, continuarAdmision: true, mensaje: '' }
    });
  } catch (error) {
    console.error('SYS AUT+CTX | validarPreRegistroSeleccionEO:', error);
    $w(HTML_USR).postMessage({
      source: 'SYS_VELO_USR',
      type: 'SYS_USR_PREREG_RESULT',
      payload: { ok: false, encontrado: false, continuarAdmision: false, mensaje: normalizarError(error) }
    });
  }
}

async function validarCodigoEO(codigo) {

try {

const result =

await resolveEOByAccessCode({

                app: APP,

                codigo:

                  String(codigo || '').trim()

              });

            $w(HTML_USR).postMessage({

              source: 'SYS_VELO_USR',

              type:

                'SYS_USR_EO_CODE_RESULT',

              payload:

                result || {

                  ok: false,

                  mensaje:

                    'Código no válido.'

                }

            });

          } catch (error) {

            $w(HTML_USR).postMessage({

              source: 'SYS_VELO_USR',

              type:

                'SYS_USR_EO_CODE_RESULT',

              payload: {

                ok: false,

                mensaje:

                  normalizarError(error)

              }

            });

          }

        }

async function validarAdmisionUSR(payload) {

try {

const result =

await validateUsrAdmission({

                app: APP,

                eoId:

                  String(

                    payload.eoId || ''

                  ).trim(),

                codigoLocalizacion:

                  String(

                    payload.codigoLocalizacion || ''

                  ).trim(),

                codigoAutorizacion:

                  String(

                    payload.codigoAutorizacion || ''

                  ).trim()

              });

            $w(HTML_USR).postMessage({

              source: 'SYS_VELO_USR',

              type: 'SYS_USR_ADMISSION_RESULT',

              payload: result

            });

          } catch (error) {

            console.error(

              'SYS AUT+CTX | validarAdmisionUSR:',

              error

            );

            $w(HTML_USR).postMessage({

              source: 'SYS_VELO_USR',

              type: 'SYS_USR_ADMISSION_RESULT',

              payload: {

                ok: false,

                autorizado: false,

                mensaje:

                  normalizarError(error)

              }

            });

          }

        }

async function comprarPlanUSR(payload = {}) {

const planId =

            String(

              payload.planId || ''

            ).trim();

if (!planId) {

            $w(HTML_USR).postMessage({

              source: 'SYS_VELO_USR',

              type: 'SYS_USR_PLAN_PURCHASE_RESULT',

              payload: {

                ok: false,

                mensaje: 'No se identificó el Plan de pago.'

              }

            });

return;

          }

try {

await customPurchaseFlow.navigateToCheckout({

              planId

            });

          } catch (error) {

            console.error(

              'SYS AUT+CTX | checkout Plan de pago:',

              error

            );

            $w(HTML_USR).postMessage({

              source: 'SYS_VELO_USR',

              type: 'SYS_USR_PLAN_PURCHASE_RESULT',

              payload: {

                ok: false,

                mensaje:

                  'No fue posible abrir el pago del Plan.'

              }

            });

          }

        }

async function guardarUSR(payload) {

if (guardando) return;

          guardando = true;

try {

const result =

await registerUsrContext({

                app: APP,

                eoId:

                  String(

                    payload.eoId || ''

                  ).trim(),

                // Código histórico de localización de EO privada.

                codigoLocalizacion:

                  String(

                    payload.codigoLocalizacion ||

                    ''

                  ).trim(),

                // Código individual de autorización.

                codigoAutorizacion:

                  String(

                    payload.codigoAutorizacion ||

                    ''

                  ).trim(),

                nombre:

                  String(

                    payload.nombre || ''

                  ).trim(),

                apellidoPaterno:

                  String(

                    payload.apellidoPaterno ||

                    ''

                  ).trim(),

                apellidoMaterno:

                  String(

                    payload.apellidoMaterno ||

                    ''

                  ).trim(),

                nombreVisible:

                  String(

                    payload.nombreVisible ||

                    ''

                  ).trim(),

                telefono:

                  String(

                    payload.telefono || ''

                  ).trim()

              });

            $w(HTML_USR).postMessage({

              source: 'SYS_VELO_USR',

              type:

                'SYS_USR_SAVE_RESULT',

              payload: result

            });

if (!result?.ok) return;

const member =

await obtenerMiembro();

            await irARetorno({ memberId: member._id });

          } catch (error) {

            console.error(

              'SYS AUT+CTX | guardarUSR:',

              error

            );

            $w(HTML_USR).postMessage({

              source: 'SYS_VELO_USR',

              type:

                'SYS_USR_SAVE_RESULT',

              payload: {

                ok: false,

                mensaje:

                  normalizarError(error)

              }

            });

          } finally {

            guardando = false;

          }

        }

async function obtenerMiembro() {

if (memberActual?._id) {

return memberActual;

          }

try {

            memberActual =

await currentMember.getMember();

return memberActual;

          } catch (error) {

return null;

          }

        }

function mapearIdentidadWix(member) {

const c =

            member?.contactDetails || {};

const nombre =

            String(

              c.firstName || ''

            ).trim();

const apellidoWix =

            String(

              c.lastName || ''

            ).trim();

const email =

            obtenerEmail(member);

return {

            memberId:

              member?._id || '',

            nombreReferencia:

              [nombre, apellidoWix]

                .filter(Boolean)

                .join(' ') ||

              member?.profile?.nickname ||

              email ||

              'Usuario',

            nombre,

            apellidoPaterno: '',

            apellidoMaterno: '',

            nombreVisible: '',

            email,

            telefono:

              obtenerTelefono(member),

            avatar: ''

          };

        }

function obtenerEmail(member) {

if (member?.loginEmail) {

return member.loginEmail;

          }

const emails =

            member?.contactDetails?.emails ||

            [];

if (

            !Array.isArray(emails) ||

            !emails.length

          ) {

return '';

          }

const first = emails[0];

return typeof first === 'string'

            ? first

            : first?.email ||

              first?.value ||

              '';

        }

function obtenerTelefono(member) {

const phones =

            member?.contactDetails?.phones ||

            [];

if (

            !Array.isArray(phones) ||

            !phones.length

          ) {

return '';

          }

const first = phones[0];

return typeof first === 'string'

            ? first

            : first?.phone ||

              first?.value ||

              '';

        }

function enviarAuthState(payload) {

          $w(HTML_AUTH).postMessage({

            source: 'SYS_VELO_AUTH',

            type: 'SYS_AUTH_STATE',

            payload

          });

        }

function enviarAuthError(mensaje) {

          $w(HTML_AUTH).postMessage({

            source: 'SYS_VELO_AUTH',

            type: 'SYS_AUTH_ERROR',

            payload: {

              mensaje

            }

          });

        }

function normalizarAppEntrada(value) {

const app = String(value || '').trim().toUpperCase();

return /^[A-Z0-9_-]{2,20}$/.test(app) ? app : '';

    }

function normalizarRetorno(value) {

const raw = String(value || '').trim();

if (!raw) return '';

try {

const url = new URL(raw);

if (url.protocol !== 'https:') return '';

const host = url.hostname.toLowerCase();

if (host === 'scad.mx' || host.endsWith('.scad.mx')) {

return url.toString();

        }

return '';

      } catch (_) {

return '';

      }

    }

function construirRetorno(extra = {}) {

const url = new URL(RETURN_URL);

      Object.entries(extra).forEach(([key, value]) => {

if (value !== undefined && value !== null && String(value) !== '') {

          url.searchParams.set(key, String(value));

        }

      });

return url.toString();

    }

// Regresa a la app. Si la app usa token, primero lo pide al backend
// y lo agrega al final de la dirección como  #t=...
// (esa parte de la dirección no viaja a ningún servidor).
async function irARetorno(extra = {}) {

  const url = new URL(construirRetorno(extra));

  if (APPS_CON_TOKEN.includes(APP)) {

    try {

      const r = await issueAppToken({
        app: APP,
        enteOperador: extra.enteOperador || ''
      });

      if (!r || r.ok !== true || !r.token) {
        throw new Error((r && r.mensaje) || 'No se pudo emitir el token de acceso.');
      }

      url.hash = 't=' + r.token;

      if (APPS_SOLO_TOKEN.includes(APP)) {
        ['memberId', 'enteOperador', 'codigoContexto'].forEach((k) => url.searchParams.delete(k));
      }

    } catch (error) {

      console.error('SYS AUT+CTX | token:', error);

      if (TOKEN_OBLIGATORIO) {
        enviarAuthError(normalizarError(error));
        return;
      }

    }

  }

  wixLocation.to(url.toString());

}

function normalizarError(error) {

if (!error) {

return 'Error de autenticación.';

          }

if (

typeof error === 'string'

          ) {

return error;

          }

return (

            error.message ||

            'Error de autenticación.'

          );

        }