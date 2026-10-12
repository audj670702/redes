# SCaD Redes

Panel de gestión de contenido y control de publicaciones en redes sociales (FB, YT, TikTok, etc.).
APP de la familia SCaD, integrada al **modelo multiempresa gestionado desde Panel SYS**.

## Estado

| Etapa | Estado |
|---|---|
| Prototipo funcional en Wix (scad.mx `/gestion-redes`, `#htmlPanel`) | Completo |
| Integración al modelo multiempresa (APP + EO) | Desarrollada · pendiente de instalar y probar en el sitio |

## Versión vigente

| Tipo | Archivo | Se instala en Wix como |
|---|---|---|
| BACKEND | `BACKEND/RED_BACKEND_redes.web.js` v1 | `backend/redes.web.js` |
| BACKEND · temporal | `BACKEND/migraciones/RED_BACKEND_redes-migracion.web.js` v1 | `backend/redes-migracion.web.js` (se elimina tras migrar) |
| VELO | `VELO/RED_VELO_gestion-redes_v4.js` | código de la página `/gestion-redes` |
| HTML | `HTML/RED_HTML_htmlPanel_v17.html` | componente `#htmlPanel` |

Instalación y verificación: [`docs/Instalacion_Multiempresa_v1.md`](docs/Instalacion_Multiempresa_v1.md).
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
