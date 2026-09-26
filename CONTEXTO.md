# Contexto de Rokko

Última actualización: 26 de septiembre de 2026.

Este archivo resume las decisiones del usuario y el estado comprobado del proyecto para continuar desde otra computadora o conversación. No es una transcripción del chat ni una lista de tareas autorizadas para ejecutar automáticamente. Leer también `AGENTS.md` y `README.md`.

## Objetivo y estado actual

Crear un sistema interno para la heladería **Rokko**, que opera en Argentina. Se acordó primero la arquitectura y las reglas; luego el usuario autorizó la programación.

Existe una primera versión funcional local con frontend, API, base de datos y pruebas. El código fue publicado, por pedido del usuario, en el repositorio **público** `https://github.com/Juanma-puerta/rokko`, rama `main`. El commit inicial de implementación es `47440e5`.

**Publicar el repositorio no desplegó la aplicación.** No se han creado servicios de producción en Render/Vercel ni una base de datos de producción. Los enlaces `localhost` y `127.0.0.1` requieren servidores activos en la misma computadora desde la que se abre el navegador.

## Arquitectura acordada e implementada

| Componente          | Decisión                                                           |
| ------------------- | ------------------------------------------------------------------ |
| Backend             | Node.js + Express, API REST modular dentro de una única aplicación |
| Frontend            | React + Vite                                                       |
| Estilos             | Bulma y estilos propios                                            |
| Datos               | PostgreSQL                                                         |
| Autenticación       | JWT y perfiles administrador/heladero                              |
| Despliegue previsto | API y PostgreSQL en Render; frontend en Vercel                     |
| Operación           | Requiere internet cuando se despliegue en la nube                  |
| Moneda              | Pesos argentinos; importes internos en centavos enteros            |

La versión local usa PGlite, PostgreSQL embebido, si no se configura `DATABASE_URL`. Para evitar un problema encontrado con el filesystem nativo en Windows, persiste snapshots atómicos en `.data/postgres.tar`. Esta solución es exclusiva de desarrollo y no equivale a un modo de ventas sin internet. Producción exige PostgreSQL externo.

Las sesiones implementadas duran 8 horas, usan cookies HttpOnly y un registro revocable en la base. No se implementó renovación silenciosa; al vencer hay que volver a ingresar. Si no se configura `JWT_SECRET` en desarrollo, el secreto se genera al arrancar y un reinicio invalida los tokens anteriores.

## Requisitos confirmados por el usuario

### Productos y sabores

| Presentación           | Peso o regla                                                    | Máximo de sabores                                     |
| ---------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| Cucurucho de 1 sabor   | Una bocha estimada                                              | 1                                                     |
| Cucurucho de 2 sabores | Dos bochas estimadas                                            | 2                                                     |
| Cucurucho de 3 sabores | Tres bochas estimadas                                           | 3                                                     |
| Pote de ¼ kg           | 250 g                                                           | 2                                                     |
| Pote de ½ kg           | 500 g                                                           | 3                                                     |
| Pote de 1 kg           | 1.000 g                                                         | 4                                                     |
| Barquillos             | Con helado por bochas; la configuración inicial tiene una bocha | 1 en el ejemplo inicial                               |
| Helados de agua        | Por unidad/variedad                                             | Sin selección de sabores en la implementación inicial |

El usuario indicó que una bocha puede pesar entre 80 y 125 g, sin un peso real fijo. Se adoptó **100 g por bocha como estimación configurable**, no como medición física. La presentación determina el número de bochas.

El peso se reparte en partes iguales entre los sabores elegidos. El sistema trabaja en gramos enteros y distribuye el resto sin alterar el peso total: por ejemplo, 500 g con tres sabores se descuentan como 167, 167 y 166 g.

### Inventario

- Controlar sabores en kilos/gramos y productos en unidades.
- **Bloquear la venta cuando el stock registrado sea insuficiente.**
- Descontar al confirmar el pedido, aunque un delivery todavía no esté pagado.
- Registrar ajustes de existencias con motivo: ingreso, recuento, merma, etc.
- El stock de helado es estimado por la variación de las bochas y requiere recuentos/ajustes.
- En el modelo inicial, las unidades de las presentaciones de pote/cucurucho/barquillo representan su disponibilidad de envases; los helados de agua representan productos terminados. No hay un inventario separado de ingredientes ni recetas de producción.

### Caja y pagos

- Una sola caja en la sucursal inicial.
- Apertura con efectivo inicial, retiros con motivo y cierre con efectivo contado, esperado y diferencia.
- Los turnos por empleado no fueron definidos. La apertura de caja es independiente del turno laboral; cada operación identifica a su usuario.
- Medios: **efectivo, QR y tarjeta bancaria**. Se permiten pagos combinados.
- No hay pasarela de pagos. El operador confirma el cobro externo en la aplicación/terminal correspondiente.
- El efectivo recibido y el vuelto se distinguen del importe aplicado a la venta.
- QR y tarjeta aparecen en el resumen de cobros, pero no incrementan el efectivo físico.
- En la implementación inicial, un pedido presencial se confirma pagado. El delivery permite saldo pendiente.

### Pedidos y delivery

- Diferenciar presencial y delivery.
- Delivery registra cliente, teléfono y dirección; no gestiona repartidores ni rutas.
- Se cobra un monto fijo de envío, configurable por sucursal.
- Delivery puede cobrarse antes o al entregar. El sistema exige completar el cobro para marcar la entrega.
- Estados implementados: pendiente, en preparación, listo, entregado y anulado.
- El estado de cobro se calcula por separado del estado operativo.
- Conservar precios, nombres de productos/sabores y cargo de envío de cada pedido histórico.

### Anulaciones

- **Tanto el heladero como el administrador pueden anular.** No restringirlo solo al administrador.
- Pedir un motivo y conservar el registro original.
- La implementación registra devolución total por los medios originales. El operador realiza la devolución externa; el sistema no mueve dinero en un banco.
- Permitir reponer stock solo si la mercadería es recuperable o aún no se preparó. En caso contrario, el consumo queda asociado a la merma por anulación.
- No hay devoluciones parciales en esta versión.

### Comprobantes e impresión

- Se opera en Argentina y se emiten **comprobantes internos sin validez fiscal**.
- No hay integración fiscal por ahora.
- Ticket de venta con productos, importes, total, medios/estado de cobro y leyenda de no validez fiscal.
- Comanda para identificar el empaquetado: etiquetas por unidad/envase con número de pedido, posición (1 de 2, etc.), producto, sabores y observaciones.
- El usuario aún no sabe qué impresora tendrá. Se preparó impresión desde el navegador con ancho de contenido pensado para ticket térmico de 80 mm.
- Falta verificar hardware, papel adhesivo, ancho, márgenes y corte. No hay impresión automática sin diálogo.

### Sucursales y perfiles

- Contemplar expansión a varias sucursales desde el modelo de datos.
- Implementado: sucursal asociada a usuarios, productos, stock, pedidos, caja y auditoría; validación de alcance en el backend. Categorías compartidas y precios por producto/sucursal.
- **Pendiente:** interfaz de alta/cambio de sucursales, asignación múltiple de usuarios y reportes consolidados. La interfaz actual opera la sucursal asignada al usuario.
- Administrador: catálogo, ajustes de inventario, usuarios y configuración, además de operación de caja/pedidos.
- Heladero: operación de venta, pedidos y caja, incluida anulación. Las mutaciones administrativas se protegen en el servidor.

## Branding

El usuario proporcionó una imagen de referencia de Rokko: rojo intenso, fondo crema, tipografía e ilustración de estética retro, con la identidad “Casa de helados”.

La interfaz usa esa paleta, títulos con carácter retro y controles legibles. El logo actual es una composición tipográfica y las ilustraciones de productos son SVG creados en código. La imagen adjunta original y archivos oficiales de marca no forman parte del repositorio; no afirmar que ya se cuenta con esos recursos para futuras modificaciones.

## Qué está implementado

- Login/logout, revocación de sesión, roles, alta/desactivación de usuarios y cambio de contraseña desde el perfil.
- Punto de venta, búsqueda, categorías, selección de sabores/cantidades y carrito.
- Pedidos presenciales/delivery, pagos combinados, saldos y avance de estados.
- Verificación y descuento transaccional de stock, protección ante concurrencia y reintentos de venta/cobro.
- Caja, retiros, devoluciones, resumen de medios, arqueo e historial de aperturas/cierres.
- Alta de productos, edición de nombre/precio/activación, alta de categorías y sabores, ajustes de stock.
- Historial, dashboard, actividad reciente de auditoría, comprobantes y etiquetas imprimibles.
- Interfaz adaptable a escritorio y móvil.

El catálogo, precios, existencias y cargo de envío iniciales son **ejemplos de desarrollo**. El envío comienza en $1.500; ese importe no fue fijado por el usuario. En producción, el seed crea stock cero y exige credenciales de administrador configuradas. Revisar los valores comerciales antes de operar.

## Verificación histórica y límites conocidos

Al finalizar la implementación se verificaron **13 pruebas de negocio/API**, compilación de producción, recorrido de venta en Microsoft Edge y persistencia del snapshot local. Las pruebas cubren, entre otros casos, insuficiencia de stock con rollback, concurrencia, cobros combinados, reintentos, anulaciones, permisos y aislamiento entre sucursales.

Estos son resultados históricos de la primera implementación, no una garantía de que cualquier cambio posterior siga pasando. Las pruebas de base de datos usaron PGlite; aún falta validar un despliegue real con PostgreSQL externo, dominios definitivos y hardware térmico.

Otros límites:

- Dashboard e historial de pedidos operan sobre los últimos 500 pedidos. Faltan paginación y agregaciones globales del lado servidor para mayor volumen.
- La consulta del historial de caja y de auditoría está limitada a los últimos 100 registros respectivos.
- El esquema inicial usa `CREATE TABLE IF NOT EXISTS`; futuras modificaciones estructurales necesitan migraciones versionadas.
- Falta recuperación de contraseña por correo.
- Las pantallas y flujos están concentrados en `src/main.jsx`; conviene separarlos por módulo al ampliar la aplicación, sin cambiar las reglas del negocio incidentalmente.
- Copias de seguridad y restauración de producción aún no están configuradas ni verificadas.
- No se incluyeron comercio electrónico para clientes, descuentos, devoluciones parciales, pasarela, facturación fiscal, reparto ni funcionamiento offline.

## Continuar desde otra computadora

1. Instalar Git, Node.js compatible con `package.json` y el editor con Codex.
2. Clonar e instalar:

   ```bash
   git clone https://github.com/Juanma-puerta/rokko.git
   cd rokko
   npm ci
   npm run dev
   ```

3. Abrir `http://localhost:5173` o `http://127.0.0.1:5173`. La API utiliza el puerto 3001; su comprobación es `/api/health`.
4. Leer `README.md` para las cuentas de demostración y las variables de entorno. No copiar credenciales reales al repositorio público.
5. Iniciar una nueva conversación con: “Leé AGENTS.md, CONTEXTO.md y README.md. Revisá el estado actual del repositorio antes de continuar con mi tarea”.

GitHub contiene código y documentación, **no el historial del chat ni la base de datos local**. `.data`, `.env`, dependencias y capturas están excluidos. Un clon nuevo genera una base de demostración propia si no se configura una base externa. Para conservar ventas/stock existentes hay que migrar los datos por separado, con un respaldo consistente; no subirlos al repositorio.

Antes de cambiar de computadora, guardar los cambios con commit y push. En un clon que ya exista, revisar el estado local y actualizar desde GitHub antes de trabajar; no sobrescribir modificaciones sin revisar.

## Incidencias resueltas y próximas decisiones

- El enlace local dejó de abrir porque los servidores se habían detenido. Se reiniciaron en segundo plano en la computadora original. Ese proceso no se transfiere por GitHub ni se garantiza que siga activo; usar `npm run dev` y comprobar ambos servicios.
- Se resolvió la persistencia local en Windows usando snapshots de PGlite. No volver al filesystem nativo sin investigar y probar el problema original.
- El repositorio se creó público por indicación expresa del usuario. Solo se publicaron código, documentación y ejemplos; no credenciales reales ni datos locales.
- Antes de desplegar: definir URLs, reemplazar el destino de ejemplo de `vercel.json`, configurar variables de backend y PostgreSQL, revisar catálogo/precios/envío/stock y probar respaldo/restauración.
- Para la siguiente tarea, seguir la indicación concreta del usuario. La documentación de estos pendientes no implica que se deba desplegar, cambiar el stack o ampliar el alcance automáticamente.
