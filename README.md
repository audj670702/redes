# SCaD Redes

Panel de gestión de contenido y control de publicaciones en redes sociales (FB, YT, TikTok, etc.).
APP de la familia SCaD, integrada al **modelo multiempresa gestionado desde Panel SYS**.

## Estado

| Etapa | Estado |
|---|---|
| Prototipo funcional en Wix (scad.mx `/gestion-redes`, `#htmlPanel`) | Completo |
| Integración multiempresa (APP + EO) y modelo comercial (planes, colaboradores, sesión única) | v2.3 publicada y verificada en el sitio (12 oct 2026) |
| APP redes.scad.mx + registro de EO en Panel SYS + admSYS | v3 instalada y funcionando (12 oct 2026) · pendiente prueba comercial con cuenta nueva |

## Versión vigente

| Tipo | Archivo | Destino |
|---|---|---|
| HTML (APP) | `index.html`, `app.js`, `sw.js`, `manifest.webmanifest`, `icons/` | GitHub Pages · redes.scad.mx |
| BACKEND | `BACKEND/RED_BACKEND_redesCore.js` v1 | `backend/redesCore.js` |
| BACKEND | `BACKEND/RED_BACKEND_redes.web.js` v2.4 | `backend/redes.web.js` |
| VELO | `VELO/RED_VELO_gestion-redes_v5.js` | página `/gestion-redes` (Solo miembros) |
| HTML | `HTML/RED_HTML_htmlPanel_v19.html` | componente `#htmlPanel` |
| BACKEND · SYS | `SYS/BACKEND/SYS_BACKEND_nexusAuth_v0.1.4.js` | `backend/nexusAuth.js` |
| BACKEND · SYS | `SYS/BACKEND/SYS_BACKEND_sysToken.web_v0.1.2.js` | `backend/sysToken.web.js` |
| BACKEND · SYS | `SYS/BACKEND/SYS_BACKEND_http-functions_bloque-REDES_v1.js` | se integra en `backend/http-functions.js` |
| VELO · SYS | `SYS/VELO/SYS_VELO_sys-autenticacion_v0.1.11.js` | página `sys-autenticacion` |
| BACKEND · temporal | `BACKEND/migraciones/RED_BACKEND_redes-migracion.web.js` v1 | se elimina tras migrar |

Instalación vigente: [`docs/Instalacion_v3_APP.md`](docs/Instalacion_v3_APP.md) · anterior: [`docs/Instalacion_v2_Comercial.md`](docs/Instalacion_v2_Comercial.md).

## Modelo comercial

| Plan | Precio | Acceso |
|---|---|---|
| PLAN REDES | $49 MXN / mes | Titular: registra su empresa (EO) y es su ADM principal |
| COLABORADOR REDES | $39 MXN / mes | Colaborador invitado por el titular, con permisos por función y por marca |

- Hasta 3 marcas por empresa. Una sesión activa por usuario (30 min de inactividad la liberan).
- Colecciones propias: `RedesCanales`, `RedesPublicaciones`, `RedesPermisos`, `RedesSesiones`.
- EO actual: EO007 · Canal Foro CX · `EO007-REDES-CFCX` (cortesía, sin plan).
La versión monoempresa anterior (HTML v16, VELO v3) está en el historial, commit *Versión base monoempresa*.

## Estructura del repositorio

Los códigos se identifican por tipo:

| Carpeta | Tipo | Contenido |
|---|---|---|
| `HTML/` | HTML | Panel embebido en el componente `#htmlPanel` |
| `VELO/` | VELO | Código de la página `/gestion-redes` |
| `BACKEND/` | BACKEND | Métodos web (`redes.web.js`) con validación de contexto |
| `BACKEND/migraciones/` | BACKEND | Scripts de uso único; no forman parte de la instalación permanente |
| `SYS/` | BACKEND · VELO | Archivos compartidos de SYS en scad.mx que REDES modifica (token, autenticación, http-functions) |
| raíz | HTML | APP PWA publicada en redes.scad.mx |
| `docs/` | — | Documentación técnica |

## Modelo multiempresa (resumen)

Referencia completa: [`docs/Tarjeta_Tecnica_Multiempresa_Panel_SYS_v1.0.0.txt`](docs/Tarjeta_Tecnica_Multiempresa_Panel_SYS_v1.0.0.txt)

- **Contexto de acceso:** APP + EO + email + activo.
- **Entidades transversales:** `SCaD_EO` (empresas operadoras) y `SCaD_USR` (pertenencia, roles, memberId). Redes no duplica identidad ni pertenencia.
- **Datos propios de Redes:** cada registro lleva `eoId`.
- **Seguridad:** toda consulta, modificación y exportación se valida en BACKEND contra la sesión y el contexto APP + EO. Nunca se autoriza con un memberId enviado por el cliente.
- **Cambio de EO:** se reemplaza el contexto y se limpian datos, cachés y pendientes.

## Nota de seguridad

Repositorio **público**: no subir claves, tokens ni identificadores sensibles de sitios o colecciones.
