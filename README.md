# SCaD Redes

Panel de gestión de contenido y control de publicaciones en redes sociales (FB, YT, TikTok, etc.).
APP de la familia SCaD, integrada al **modelo multiempresa gestionado desde Panel SYS**.

## Estado

| Etapa | Estado |
|---|---|
| Prototipo funcional en Wix (scad.mx `/gestion-redes`, `#htmlPanel`) | Completo |
| Integración multiempresa (APP + EO) y modelo comercial (planes, colaboradores, sesión única) | v2 desarrollada · pendiente de publicar y probar en el sitio |

## Versión vigente

| Tipo | Archivo | Se instala en Wix como |
|---|---|---|
| BACKEND | `BACKEND/RED_BACKEND_redes.web.js` v2.2 | `backend/redes.web.js` |
| BACKEND · temporal | `BACKEND/migraciones/RED_BACKEND_redes-migracion.web.js` v1 | `backend/redes-migracion.web.js` (se elimina tras migrar) |
| VELO | `VELO/RED_VELO_gestion-redes_v5.js` | código de la página `/gestion-redes` (Solo miembros) |
| HTML | `HTML/RED_HTML_htmlPanel_v18.html` | componente `#htmlPanel` |

Instalación y verificación: [`docs/Instalacion_v2_Comercial.md`](docs/Instalacion_v2_Comercial.md).

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
