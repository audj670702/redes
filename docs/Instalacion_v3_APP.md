# SCaD Redes · Instalación v3 (APP + registro de EO en SYS)

Versión 3 · 12 de octubre de 2026

## 1. Qué incluye

| Pieza | Qué hace |
|---|---|
| **APP** (redes.scad.mx) | Presentación y compra, acceso al panel y accesos rápidos a las redes de la EO. La sesión se inicia con SYS y se mantiene abierta en el dispositivo hasta por 30 días |
| **Registro de EO en Panel SYS** | Al comprar PLAN REDES y registrar su empresa, el titular queda dado de alta en SYS: su **USR** con ficha completa, su **EO** con los datos mínimos de Panel SYS y la cuenta **admSYS** silenciosa para asistencia |
| **Colaboradores vinculados** | Los invitados quedan como USR de la EO (pre-registro). SYS los reconoce al iniciar sesión, porque la EO se crea con `accesoDirecto = true` |
| **Asistencia admSYS** | Entra sin plan, en solo lectura, y no aparece en Usuarios ni ocupa cupo |

## 2. Archivos y dónde van

### En Wix (scad.mx)

| # | Archivo del repositorio | Destino en Wix | Tipo de cambio |
|---|---|---|---|
| 1 | `SYS/BACKEND/SYS_BACKEND_nexusAuth_v0.1.4.js` | `backend/nexusAuth.js` | Reemplazar (solo agrega `REDES` a las apps válidas) |
| 2 | `SYS/BACKEND/SYS_BACKEND_sysToken.web_v0.1.2.js` | `backend/sysToken.web.js` | Reemplazar (agrega `REDES`) |
| 3 | `BACKEND/RED_BACKEND_redesCore.js` | `backend/redesCore.js` | **Nuevo** |
| 4 | `BACKEND/RED_BACKEND_redes.web.js` (v2.4) | `backend/redes.web.js` | Reemplazar, **después** del paso 3 |
| 5 | `SYS/BACKEND/SYS_BACKEND_http-functions_bloque-REDES_v1.js` | `backend/http-functions.js` | **Integrar, no reemplazar**: la línea de import junto a los demás imports y el bloque al final del archivo |
| 6 | `SYS/VELO/SYS_VELO_sys-autenticacion_v0.1.11.js` | Código de la página `sys-autenticacion` | Reemplazar |
| 7 | `HTML/RED_HTML_htmlPanel_v19.html` | Componente `#htmlPanel` de `/gestion-redes` | Reemplazar |

El VELO de `/gestion-redes` (v5) **no cambia**.

Haz los pasos 1 a 7 y publica una sola vez. Si publicas el paso 4 sin el 3, el panel deja de cargar.

### En GitHub (APP)

Los archivos de la APP ya están en la raíz del repositorio: `index.html`, `app.js`, `sw.js`, `manifest.webmanifest`, `icons/` y `CNAME`.

1. En GitHub, ve a **Settings → Pages**. En Source elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`.
2. En **Custom domain** debe aparecer `redes.scad.mx`, porque viene del archivo `CNAME`.
3. En el DNS de scad.mx, crea un registro **CNAME**: `redes` → `audj670702.github.io`.
4. Cuando GitHub lo permita, activa **Enforce HTTPS**.

## 3. Ajuste de datos ya aplicado (vía conector)

- EO007 · Canal Foro CX: `accesoDirecto = true`.

## 4. Flujos

| Quién | Flujo |
|---|---|
| Visitante | Abre redes.scad.mx y ve la presentación y los planes. "Adquirir PLAN REDES" lo lleva al panel (cuenta, compra y registro) |
| Titular nuevo | En el panel, "Registra tu empresa" con la ficha mínima de SYS. Se crean su USR (USU, ADM), la cuenta admSYS y su EO (`EO00N-REDES-<CORTO>`, `accesoDirecto`, `accesoPricing`, ambos planes, `limiteMarcas = 3`) |
| Titular en la APP | "Iniciar sesión" → `sys-autenticacion?app=REDES` → token SYS → vista de su EO y sus redes. La sesión se mantiene |
| Colaborador | El titular lo invita en el panel (pestaña Usuarios). El colaborador inicia sesión con ese correo, compra COLABORADOR REDES y entra según sus permisos y marcas |
| Usuario de REDES sin empresa en SYS | `sys-autenticacion` lo envía al panel para comprar y registrarse, en lugar de mostrarle la ficha genérica |
| admSYS | En Panel SYS, el selector de Operadoras muestra todas las EO de REDES. En las de autoservicio entra en modo asistencia (solo lectura) |
| Plan vencido | La APP muestra "Suscripción no vigente" con el botón para renovar; los datos se conservan |
| Baja del usuario | La siguiente renovación del token falla y la APP regresa a la presentación |

## 5. Lista de verificación

- [ ] La consola de `sys-autenticacion` muestra `SYS_AUTH_CTX_VELO_v0.1.11`.
- [ ] redes.scad.mx abre la presentación con HTTPS.
- [ ] "Iniciar sesión" con tu cuenta: eliges Operadora (tienes varias en REDES) y regresas a la APP con la vista de Canal Foro CX y los botones a sus Facebook.
- [ ] Al cerrar y reabrir la APP, la sesión sigue abierta.
- [ ] "Entrar al panel" abre `/gestion-redes` en la EO correcta.
- [ ] Con una cuenta de prueba nueva: compra PLAN REDES, registra la empresa y verifica en Panel SYS la nueva EO, su USR titular y el admSYS.
- [ ] Invita un colaborador de prueba, inicia sesión con él en la APP y confirma que SYS lo reconoce.
- [ ] Con admSYS, entra a la EO de prueba: aviso de asistencia y solo lectura.

## 6. Pruebas realizadas

- **Backend (redesCore + redes.web):** 59 casos con datos simulados del esquema real de SCaD. Incluyen el registro con ficha completa, admSYS, asistencia, colaboradores, planes, sesión única y el contexto de la APP. Todos aprobados, y el verificador de tipos no marca avisos.
- **Bloque HTTP + nexusAuth v0.1.4 (firma real):** contexto con token REDES, rechazo de token de otra APP y de EO ajena, renovación, límite de 30 días y baja de usuario. Todos aprobados.
- **Panel v19:** ficha de registro con nombre de presentación sugerido, vista de asistencia y botón App. Sin errores.
- **APP:** presentación, inicio de sesión, regreso con token, sesión persistente, renovación silenciosa, sin conexión, suspendida, acceso revocado, cerrar sesión, asistencia y ancho de 360 px sin desbordes. Sin errores.
- Pendiente: pruebas en el sitio y el dominio publicados.

## 7. Notas

- El rol nativo de cortesía no se evalúa en la APP, porque el token no trae roles de Wix. Sí se evalúa en el panel.
- La cuenta admSYS se configura en `CFG.ASISTENCIA_SYS` de `redesCore.js`. Cuando cambie la cuenta de asistencia, se ajusta solo ahí.
