# Rokko · Gestión de heladería

Aplicación React + Bulma, API Node.js/Express, PostgreSQL y sesiones JWT revocables. Interfaz en español, importes en ARS y comprobantes internos sin validez fiscal.

Para retomar el trabajo desde otra computadora o conversación, leer [CONTEXTO.md](CONTEXTO.md) (requisitos, decisiones y pendientes) y [AGENTS.md](AGENTS.md) (guía para trabajar con Codex). Estos documentos se versionan junto al código; el chat y la base local no se sincronizan mediante Git.

## Ejecutar en desarrollo

Requiere Node.js 22.12 o superior.

```powershell
npm install
npm run dev
```

Abrir http://localhost:5173. La API corre en http://localhost:3001.

Sin `DATABASE_URL`, usa PostgreSQL embebido mediante PGlite, persistido como un archivo atómico `.data/postgres.tar` después de cada escritura. Este adaptador evita incompatibilidades del filesystem nativo en Windows. Es una comodidad exclusiva de desarrollo, no un modo offline del sistema de caja. En producción se exige PostgreSQL externo.

Usuarios locales:

| Perfil        | Email             | Contraseña     |
| ------------- | ----------------- | -------------- |
| Administrador | admin@rokko.local | RokkoDemo2026! |
| Heladero      | caja@rokko.local  | RokkoDemo2026! |

El entorno local inicia con catálogo, precios y existencias de ejemplo. La caja empieza cerrada y no se inventan ventas. Abrir caja antes de confirmar pedidos. Los valores del catálogo deben revisarse con el negocio.

## Funciones

- Inicio de sesión, cierre con revocación, roles, cambio de contraseña desde el perfil y desactivación de usuarios.
- Punto de venta con categorías, búsqueda, presentaciones, selección de sabores y cantidades.
- Pesos de potes de 250/500/1000 g; bochas configurables entre 80 y 125 g (100 g iniciales); distribución equitativa con gramos enteros que conservan el peso total.
- Stock por sucursal en gramos y unidades, ajuste con motivo, bloqueo por insuficiencia y consumo transaccional. Las unidades de potes/cucuruchos/barquillos representan sus envases disponibles; helados de agua representan productos terminados.
- Cobros combinados en efectivo, QR y tarjeta; efectivo recibido y vuelto; saldo pendiente de delivery.
- Delivery con cliente, teléfono, dirección y cargo fijo configurable ($1.500 de ejemplo).
- Pedidos pendientes, en preparación, listos, entregados y anulados. Entrega exige pago completo.
- Anulación por ambos roles con motivo, devolución total por medios originales y reposición opcional. No repone automáticamente helado preparado. El dinero externo se devuelve manualmente.
- Apertura de caja, retiros, cierre, efectivo esperado y diferencia de arqueo.
- Catálogo: creación, edición de nombre/precio, activación; creación de categorías y sabores.
- Tickets y comandas imprimibles desde el navegador, con CSS para 80 mm.
- Historial y dashboard sobre los últimos 500 pedidos; actividad reciente de auditoría para administración.

## Arquitectura y reglas

`src/main.jsx` contiene interfaz y flujos, `src/style.css` el tema Rokko, `server/app.js` la API, `server/domain.js` las transacciones de negocio, `server/schema.sql` el esquema inicial y `server/db.js` conexión/inicialización.

Los importes se almacenan en centavos enteros y el backend recalcula los precios. Las ventas guardan copias de nombres, sabores, precios y envío. El cierre de caja no elimina pedidos pendientes; un cobro posterior se aplica a la nueva apertura.

Una fila de sucursal se bloquea durante mutaciones de stock/caja/pedidos para serializar operaciones concurrentes en PostgreSQL. La clave única de solicitud protege la creación de pedidos frente a reintentos. SQL parametrizado, cookies HttpOnly, comprobación de Origin en operaciones de escritura, validación Zod, hash bcrypt, Helmet y límite de intentos de login. Las sesiones duran 8 horas, requieren nuevo ingreso al vencer y se pueden revocar; no hay renovación silenciosa en esta versión.

Modelo preparado para más sucursales: inventario, productos, pedidos, caja, usuarios y auditoría se asocian a sucursal; el servidor toma la sucursal del usuario autenticado. Esta primera interfaz opera la sucursal asignada: falta el alta/cambio de sucursales y el reporte consolidado. Los precios se guardan por producto y sucursal. Categorías compartidas.

## Verificación

```powershell
npm test
npm run build
```

Pruebas de integración con PostgreSQL embebido en memoria: autenticación, roles, revocación, CSRF por origen, apertura única, reparto, stock insuficiente con rollback, concurrencia, idempotencia, pagos combinados, delivery pendiente, anulación y cierre.

Con `npm run dev` activo y Microsoft Edge instalado, `npm run test:browser` verifica el recorrido de venta y genera capturas en `test-results/`. Esta prueba crea ventas en la base local de demostración. `npm run test:persistence` comprueba que esas ventas se recuperan al abrir nuevamente la base. Las pruebas de negocio de `npm test` usan una base en memoria separada.

## Despliegue

No se ha publicado ni creado infraestructura externa.

1. Crear PostgreSQL y servicio Node en Render utilizando `render.yaml` como base. Elegir los planes según necesidad; el archivo no garantiza alojamiento gratuito.
2. Configurar `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` aleatorio (mínimo 32 caracteres), `APP_ORIGIN` con origen exacto del frontend, `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo 12 caracteres).
3. El primer arranque crea tablas y usuario administrador. En producción el catálogo de ejemplo inicia con stock cero; revisar precios/configuración y cargar existencias. No se crean usuarios con claves de demostración.
4. En `vercel.json`, reemplazar `REEMPLAZAR-ROKKO-API` por el hostname real del backend, antes de desplegar. El proxy `/api` mantiene las peticiones en el origen del frontend. Publicar Vite en Vercel con `npm run build` y salida `dist`.
5. Verificar login, persistencia, venta, cierre e impresión usando los dominios definitivos. Configurar copias de seguridad y probar restauración de PostgreSQL antes del uso comercial.

Los servidores escuchan por HTTP detrás del TLS de la plataforma. En producción las cookies son Secure. No exponer variables de backend con prefijo `VITE_`.

## Límites y siguientes iteraciones

- Hardware térmico aún no definido: impresión mediante diálogo del navegador; probar ancho, márgenes, adhesivo y corte con el equipo real. La comanda genera una etiqueta por unidad/envase, identificada con el número de pedido y su posición (por ejemplo, envase 1 de 2).
- Stock por sabor estimado: el peso real de cada bocha varía. Ajustar por recuento y merma.
- No incluye pasarela ni facturación fiscal, repartidores, trabajo sin internet, descuentos ni devoluciones parciales.
- Dashboard/historial limitados a los últimos 500 pedidos; para mayor volumen se requieren paginación y agregaciones del lado servidor.
- El esquema es inicial e idempotente (`CREATE TABLE IF NOT EXISTS`); futuras modificaciones requieren migraciones versionadas y respaldo, no cambios manuales sobre producción.
- No incluye recuperación de contraseña por correo ni asignación múltiple de sucursales. Se deben incorporar antes de ampliar el uso operativo.
- El logo es una composición tipográfica y las ilustraciones son SVG propios en código; reemplazar por los archivos oficiales de marca cuando estén disponibles.
