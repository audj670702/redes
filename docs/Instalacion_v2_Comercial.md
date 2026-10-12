# SCaD Redes · Instalación v2 (multiempresa + modelo comercial)

Versión 2 · 11 de octubre de 2026
Componentes: BACKEND `redes.web.js` v2 · VELO v5 · HTML v18 · migración v1 (temporal)

## 1. Qué cambia respecto a la v1

- **Alineado al esquema real de SCaD.** La pertenencia se resuelve por `SCaD_USR.enteOperador`, comparándolo con `SCaD_EO.codigoContexto`. `accesoDirecto` se lee de la EO, `admSys` es una pertenencia normal y el logo sale de `logoEo`.
- **Modelo comercial:** PLAN REDES para el titular y COLABORADOR REDES para cada colaborador.
- **Autorregistro del titular:** al entrar con el plan vigente, crea su usuario (USR) y su empresa (EO).
- **Colaboradores:** el titular los invita y define sus permisos por función y por marca.
- **Límite de 3 marcas por empresa.** Se ajusta por EO con el campo `limiteMarcas` de SCaD_EO.
- **Sesión única por usuario:** la nueva sesión se rechaza mientras la otra tenga actividad en los últimos 30 minutos.

## 2. Ya instalado en el sitio (vía conector)

| Elemento | Estado |
|---|---|
| Campo `eoId` en `RedesCanales` y `RedesPublicaciones` | Creado |
| Colección `RedesPermisos` (permisos Admin) | Creada |
| Colección `RedesSesiones` (permisos Admin) | Creada |
| EO007 · Canal Foro CX · `EO007-REDES-CFCX` | Registrada desde Panel SYS |
| USR0012 · titular de EO007 | Registrado desde Panel SYS |
| Planes PLAN REDES ($49) y COLABORADOR REDES ($39) | Creados |

## 3. Pasos pendientes, en orden

1. **BACKEND**: reemplaza `backend/redes.web.js` con `BACKEND/RED_BACKEND_redes.web.js` v2.
   - Si tienes un rol nativo de cortesía, escribe su nombre en `CFG.ROLES_NATIVOS` (por ejemplo `['REDES']`).
2. **Migración** (si no la corriste con la v1): `backend/redes-migracion.web.js`, desde "Probar función":
   1. `migrarEoId("4411e39b-aaf1-4682-bfd5-02bc6e4092f4", true)` para simular.
   2. `migrarEoId("4411e39b-aaf1-4682-bfd5-02bc6e4092f4", false)` para aplicar. Asigna las marcas y publicaciones actuales a EO007 Canal Foro CX.
3. **VELO**: reemplaza el código de `/gestion-redes` con `VELO/RED_VELO_gestion-redes_v5.js`.
4. **HTML**: reemplaza el contenido de `#htmlPanel` con `HTML/RED_HTML_htmlPanel_v18.html`.
5. **Permisos de la página** `/gestion-redes`: **Solo miembros**. No la restrinjas al plan ni al rol: los colaboradores tienen otro plan, y el backend decide el acceso.
6. **Permisos de colecciones**: `RedesCanales` y `RedesPublicaciones` en **Admin** (leer, crear, actualizar y eliminar).
7. **Publicar.** Los pasos 3 a 6 van juntos en la misma publicación.
8. Cuando la simulación de migración reporte 0 registros sin `eoId`, **elimina** `backend/redes-migracion.web.js`.

## 4. Flujos

| Quién | Flujo |
|---|---|
| Visitante sin plan | Ve la pantalla de venta y adquiere PLAN REDES |
| Comprador de PLAN REDES | "Registra tu empresa". Se crea su USR (`USU`,`ADM`) y su EO (`EO00N-REDES-<CORTO>`, `limiteUsuarios = 1`, `accesoPricing`, `pricingPlanIds`, `admPrincipal`) |
| Titular | Pestaña **Usuarios**: invita por correo y define permisos y marcas |
| Colaborador invitado | Entra con ese correo. Si no tiene plan, ve la pantalla para adquirir COLABORADOR REDES. Con el plan, accede según sus permisos |
| Colaborador con plan pero sin invitación | Aviso para pedir la invitación al titular |
| Plan del titular vencido | EO suspendida para todos; los datos se conservan; el titular ve el botón para renovar |
| Plan del colaborador vencido | Solo él pierde el acceso |
| Segundo dispositivo | "Sesión activa en otro dispositivo"; se libera con "Cerrar sesión" o tras 30 minutos sin actividad |
| EO de cortesía (`accesoPricing ≠ true`, como EO007) | No exige planes; basta la pertenencia |

### Permisos del colaborador

| Permiso | Habilita |
|---|---|
| (siempre) | Ver listado, calendario y tablero |
| `editar` | Registrar, editar y duplicar publicaciones |
| `estado` | Marcar como publicado, no publicado, etc. |
| `eliminar` | Eliminar publicaciones |
| `marcas` | Editar marcas (crear marcas nuevas solo si tiene acceso a todas) |
| `exportar` | PDF e impresión |
| Marcas | Todas, o solo las elegidas: ve y opera únicamente esas |

## 5. Lista de verificación

- [ ] Jorge (USR0012) entra a EO007 sin plan, por ser EO de cortesía, y ve sus marcas.
- [ ] En un segundo navegador con la misma cuenta aparece "Sesión activa en otro dispositivo".
- [ ] "Cerrar sesión" libera la sesión de inmediato.
- [ ] Una 4.ª marca se rechaza.
- [ ] Al invitar a un colaborador se crea un USR en pre-registro (`memberId` vacío) y su registro en `RedesPermisos`.
- [ ] El colaborador, al entrar con su correo, ve la pantalla de COLABORADOR REDES; al comprar, entra con sus permisos.
- [ ] Un colaborador limitado a una marca no ve las demás.
- [ ] Una cuenta nueva con PLAN REDES registra su empresa y obtiene `EO008` y su USR consecutivo.
- [ ] Al cancelar el plan del titular de prueba, la EO aparece suspendida.

## 6. Pruebas realizadas

- **BACKEND v2**: 44 casos con datos simulados que reproducen el esquema real de SCaD_EO y SCaD_USR. Cubren EO de cortesía, sesión única, límite de marcas, invitación, permisos por función y marca, registro con códigos consecutivos, planes, suspensión y conservación de datos. Todos aprobados.
- **HTML v18**: navegador sin interfaz, con todas las pantallas de acceso, la pestaña Usuarios, los permisos ocultando acciones, cerrar sesión y el envío del id de sesión. Sin errores.
- Pendiente: prueba en el sitio publicado. Los planes de precios solo funcionan en un sitio publicado.

## 7. Notas

- El permiso `exportar` oculta el botón en el panel. El PDF se genera en el navegador con los datos que el usuario ya puede ver, así que no expone información adicional.
- La cuenta admSYS silenciosa no se crea automáticamente en las EO de autoservicio. Si hace falta asistencia, agrégala desde Panel SYS.
- El logo de la empresa se captura desde Panel SYS (`logoEo`). El registro de autoservicio solo pide nombre, nombre corto, nombre del titular y teléfono.
