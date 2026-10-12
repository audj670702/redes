# SCaD Redes · Instalación v4 (prueba gratuita y compra directa)

Versión 4 · 12 de octubre de 2026

## 1. Qué cambia

| Punto | Cambio |
|---|---|
| Video | La presentación de redes.scad.mx incluye el video promocional (`media/promo-scad-redes.mp4`, con portada). Se descarga solo cuando la persona toca reproducir |
| Prueba gratuita | PLAN REDES se presenta como **prueba gratis de 14 días** (después $49 MXN / mes, cancela cuando quieras). COLABORADOR REDES sigue como pago directo, sin prueba |
| Compra directa | Todos los botones de compra llevan a `/gestion-redes?comprar=titular` o `?comprar=colaborador`. La página abre el pago del plan correcto, sin pasar por la página de planes de Wix |
| Tarjetas de planes | PLAN REDES lleva a la prueba. Colaborador explica primero cómo funciona (invitación del titular) y después ofrece "Ya me invitaron: activar mi acceso" |
| Tarjetas de módulos | Al tocarlas muestran la captura del panel de ese módulo (datos de ejemplo, `media/app/*.webp`) |

## 2. Pasos en Wix (scad.mx)

| # | Qué | Dónde | Cómo |
|---|---|---|---|
| 1 | **Permiso de la página** | Página `/gestion-redes` → Configuración → Permisos | Cambiar de **"Planes de precios"** a **"Solo miembros"**. Esto quita la pantalla "Obtén un plan para acceder a esta página". El backend sigue validando plan, empresa y permisos en cada consulta |
| 2 | `VELO/RED_VELO_gestion-redes_v6.js` | Código de la página `/gestion-redes` | Reemplazar todo |
| 3 | `HTML/RED_HTML_htmlPanel_v20.html` | Componente `#htmlPanel` | Reemplazar todo |

Publica una vez al terminar los 3 pasos. El BACKEND no cambia.

## 3. En GitHub (APP v1.1.0)

Ya está publicado en el repositorio: `index.html`, `app.js`, `sw.js`, `media/promo-scad-redes.mp4` (antes "PROMO SCaD REDES.mp4", mismo contenido), `media/promo-scad-redes.jpg` y `media/app/`. GitHub Pages lo despliega solo.

## 4. Cómo se comporta `?comprar=`

| Estado de la cuenta | `?comprar=titular` | `?comprar=colaborador` |
|---|---|---|
| Sin empresa ni plan | Abre el pago de PLAN REDES (prueba 14 días) | No cobra; avisa que no hay invitación para su correo |
| Invitado sin plan | Muestra su pantalla de colaborador | Abre el pago de COLABORADOR REDES |
| Titular con plan vencido | Abre el pago de PLAN REDES (renovación) | No cobra |
| Ya tiene plan / falta registrar empresa / activo | No cobra; muestra el panel normal | No cobra |

El parámetro se usa una sola vez y se quita de la dirección.

## 5. Lista de verificación

- [ ] `/gestion-redes` tiene permiso "Solo miembros".
- [ ] La consola del panel muestra la versión v20 al pie.
- [ ] En redes.scad.mx (sin sesión): el video se reproduce y las 6 tarjetas de módulos abren su captura.
- [ ] "Comenzar prueba gratis de 14 días" con una cuenta nueva: pide iniciar sesión, abre directamente el pago del PLAN REDES y al terminar muestra "Registra tu empresa".
- [ ] Durante la prueba, el panel deja entrar (Wix debe reportar la suscripción como activa).
- [ ] Colaborador → "Ya me invitaron" con una cuenta **sin** invitación: no abre el pago y muestra el aviso.
