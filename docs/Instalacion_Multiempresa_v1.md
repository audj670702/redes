# SCaD Redes · Instalación del modelo multiempresa

Versión 1 · 11 de octubre de 2026
Componentes: BACKEND `redes.web.js` v1 · VELO v4 · HTML v17 · migración v1

## 1. Supuestos que debes confirmar

Los nombres reales de Panel SYS no estaban disponibles. Todos están en el bloque `CFG` al inicio de `BACKEND/RED_BACKEND_redes.web.js`. Si alguno difiere, **solo se cambia ahí**.

| Concepto | Valor supuesto | Dónde se ajusta |
|---|---|---|
| Identificador de la APP | `REDES` | `CFG.APP` |
| APP que identifica a admSYS | `SYS` (registro en SCaD_USR con rol ADM) | `CFG.APP_SYS` |
| Campos de SCaD_USR | `app`, `eo`, `email`, `activo`, `roles`, `accesoDirecto`, `memberId` | `CFG.USR` |
| Campos de SCaD_EO | `nombre`, `logo`, `activo` | `CFG.EO` |
| `eo` en SCaD_USR | referencia a SCaD_EO o texto con su `_id` (ambos funcionan) | — |
| `roles` | texto (`"ADM"`) o lista (`["ADM","USU"]`) | — |
| `email` | guardado en **minúsculas** | — |
| Roles con escritura | publicaciones: ADM, USU · marcas: ADM | `CFG.ROLES` |
| Cómo abre Panel SYS la APP | `/gestion-redes?eo=<_id de SCaD_EO>` | — |
| Marcas | Canal Foro CX y TV Digital Internet son marcas (publicadores) dentro de una EO | — |

Un rol adicional definido por SYS que no esté en `CFG.ROLES` entra en **solo lectura** hasta que se agregue ahí.

## 2. Orden de instalación

1. **Colecciones de la APP**: agregar el campo de texto `eoId` a `RedesCanales` y `RedesPublicaciones`.
2. **BACKEND**: crear `backend/redes.web.js` con el contenido de `RED_BACKEND_redes.web.js`, y, de forma temporal, `backend/redes-migracion.web.js` con `BACKEND/migraciones/RED_BACKEND_redes-migracion.web.js`.
3. **Migración**: en el editor, probar la función `migrarEoId`:
   1. `migrarEoId("<_id de la EO>", true)`: simulación; revisa los conteos.
   2. `migrarEoId("<_id de la EO>", false)`: asigna `eoId` a los registros sin él.
   3. Verifica el panel y repite la simulación: si reporta 0 registros sin `eoId` en ambas colecciones, **elimina `backend/redes-migracion.web.js` del sitio**. El archivo se conserva en el repositorio como registro.
4. **Pertenencias**: dar de alta en SCaD_USR, con `app = REDES`, a los usuarios actuales del panel (con su EO, rol y `accesoDirecto = true` si deben entrar sin código).
5. **VELO**: reemplazar el código de la página `/gestion-redes` por `RED_VELO_gestion-redes_v4.js`.
6. **HTML**: reemplazar el contenido de `#htmlPanel` por `RED_HTML_htmlPanel_v17.html`.
7. **Permisos de colecciones** (paso de cierre, ver sección 3).
8. **Panel SYS**: que la opción de abrir la APP use `/gestion-redes?eo=<_id>` en ventana nueva.

Los pasos 5 a 7 deben hacerse juntos y publicarse en el mismo momento: la VELO v4 ya no lee las colecciones directamente, y la v3 deja de funcionar al cerrar los permisos.

## 3. Permisos

| Colección | Leer | Crear | Actualizar | Eliminar |
|---|---|---|---|---|
| `RedesCanales` | Admin | Admin | Admin | Admin |
| `RedesPublicaciones` | Admin | Admin | Admin | Admin |

El acceso de los usuarios es a través de `redes.web.js`, que valida sesión, APP, EO, pertenencia activa y rol en cada operación. Los permisos de SCaD_EO y SCaD_USR los define Panel SYS; Redes los lee con privilegios de backend.

## 4. Lista de verificación (criterio de aceptación)

- [ ] Usuario con una sola EO entra directo a su EO.
- [ ] Usuario con varias EO ve la pantalla "Elige una empresa" y el selector en el encabezado.
- [ ] Al cambiar de EO, no queda ningún dato, filtro ni ventana de la anterior.
- [ ] Un USU registra y edita publicaciones, pero no ve botones de marcas.
- [ ] Un ADM gestiona marcas y publicaciones.
- [ ] `?eo=` con una EO ajena: el usuario no ve sus datos.
- [ ] Panel SYS abre la EO seleccionada como admSYS: banner de asistencia, solo lectura, sin aparecer en usuarios de la EO.
- [ ] Pre-registro con `accesoDirecto = true`: en el primer acceso se guarda `memberId`.
- [ ] El PDF y la impresión muestran el nombre de la EO.
- [ ] Con permisos "Admin", un miembro no puede consultar las colecciones fuera del panel.

## 5. Pruebas realizadas

- **BACKEND**: 25 casos con datos simulados (dos EO y usuarios con distintos roles): aislamiento por EO, edición o eliminación cruzada por `_id`, marca de otra EO, pre-registro, pertenencia inactiva, correo vinculado a otro miembro, asistencia en solo lectura y migración. Todos aprobados.
- **HTML**: navegador sin interfaz, mensajes simulados de la página: selección de EO, descarte de datos de otra EO, ocultamiento por rol, reinicio al cambiar de EO, asistencia y sin acceso. Sin errores.
- Pendiente: prueba en el sitio real con las colecciones de Panel SYS.

## 6. Fuera de alcance de esta versión

- El flujo de **código de acceso** y **plan de pago** lo resuelve la autenticación compartida de SCaD. Redes solo reconoce pertenencias activas, con pre-registro `accesoDirecto`.
- El campo **Responsable** sigue siendo texto libre (no se liga a usuarios de SCaD_USR).
