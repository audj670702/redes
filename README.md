# SCaD Redes

Panel de gestión de contenido y control de publicaciones en redes sociales (FB, YT, TikTok, etc.).
APP de la familia SCaD, integrada al **modelo multiempresa gestionado desde Panel SYS**.

## Estado

| Etapa | Estado |
|---|---|
| Prototipo funcional en Wix (scad.mx `/gestion-redes`, `#htmlPanel`) | Completo |
| Integración al modelo multiempresa (APP + EO) | En diseño |

## Estructura del repositorio

Los códigos se identifican por tipo:

| Carpeta | Tipo | Contenido |
|---|---|---|
| `HTML/` | HTML | Panel embebido en el componente `#htmlPanel` |
| `VELO/` | VELO | Código de la página `/gestion-redes` |
| `BACKEND/` | BACKEND | Métodos web (`redes.web.js`) con validación de contexto |
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
