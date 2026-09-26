# Guía de trabajo para Rokko

## Al retomar el proyecto

1. Leer `CONTEXTO.md` para conocer los requisitos acordados, las decisiones y los pendientes.
2. Leer `README.md` para instalación, comandos, variables de entorno y límites operativos.
3. Revisar `git status` y el código relacionado con la tarea antes de editar. Conservar los cambios del usuario.

Estos documentos preservan el contexto del proyecto entre computadoras y conversaciones. No asumir que una sesión nueva conoce el chat original. Las instrucciones actuales del usuario prevalecen sobre estos documentos. Si el código y el contexto difieren, señalar la diferencia y comprobar qué comportamiento corresponde antes de cambiarlo.

## Forma de colaborar

- Comunicar en español, con explicaciones breves y claras.
- Ante una solicitud de implementación, completar el trabajo autorizado y verificarlo. Resolver decisiones rutinarias sin pedir confirmaciones repetidas.
- Distinguir requisitos confirmados, valores de ejemplo y funciones pendientes. No presentar una propuesta como una función implementada.
- Mantener el alcance acordado: sistema interno de heladería, sin pasarela de pagos ni facturación fiscal por ahora.
- Actualizar `CONTEXTO.md` cuando cambien reglas del negocio, arquitectura, estado del despliegue o pendientes relevantes. Mantener `README.md` alineado con la instalación y los comandos reales.

## Arquitectura y archivos

- Frontend: React, Vite y Bulma. Interfaz en `src/main.jsx`; estilos en `src/style.css`.
- Backend: Node.js y Express. API, validación y permisos en `server/app.js`; transacciones del negocio en `server/domain.js`.
- Base de datos: PostgreSQL. Esquema inicial en `server/schema.sql`; conexión y datos iniciales en `server/db.js`.
- Desarrollo local: PGlite con snapshot en `.data/postgres.tar`. Producción: PostgreSQL externo mediante `DATABASE_URL`.
- Autenticación: JWT en cookie HttpOnly con sesión revocable del lado servidor.
- Despliegue previsto: Render para API/base de datos y Vercel para frontend. Los archivos de configuración existentes son plantillas; verificar sus valores antes de usarlos.

## Reglas que deben conservarse

- Calcular precios y totales en el backend. Guardar dinero en centavos enteros y helado en gramos.
- Conservar el precio, los nombres y el envío de cada venta histórica aunque cambie el catálogo.
- Descontar stock al confirmar el pedido, con transacciones y bloqueo frente a insuficiencia. Mantener la protección contra ventas y cobros duplicados por reintentos.
- Obtener la sucursal del usuario autenticado y comprobar el alcance de acceso en el servidor.
- Registrar QR y tarjeta como cobros externos manualmente verificados; no simular una pasarela.
- Permitir anulaciones a ambos perfiles, con motivo, devolución registrada y reposición opcional de stock.
- No reponer automáticamente helado preparado; distinguir mercadería recuperable de merma.
- Mantener tickets internos sin validez fiscal y evitar incorporar datos de implementación innecesarios en la interfaz de operación.
- Mantener la identidad visual roja y crema de Rokko, legibilidad y adaptación a escritorio/tablet/móvil.

## Verificación según el cambio

- Instalar dependencias con `npm ci` al clonar el repositorio.
- `npm test`: pruebas de negocio/API con una base en memoria separada.
- `npm run build`: compilación del frontend.
- `npm run test:browser`: requiere `npm run dev` activo y Microsoft Edge; crea ventas en la base local de demostración y guarda capturas en `test-results/`.
- `npm run test:persistence`: requiere ventas locales previas y verifica su recuperación desde el snapshot.
- Para cambios de documentación, revisar contenido, enlaces locales y `git diff --check`; no hace falta repetir pruebas de aplicación sin una razón relacionada con el cambio.
- Informar qué verificaciones se ejecutaron y cuáles no se pudieron ejecutar. No presentar pruebas antiguas como resultados nuevos.

## Git, datos y entorno

- Repositorio público: `https://github.com/Juanma-puerta/rokko`; rama inicial `main`.
- No versionar `.env`, credenciales, tokens, `.data`, `node_modules`, `dist` ni resultados de pruebas. `.env.example` contiene únicamente ejemplos.
- No subir el historial completo del chat ni directorios personales de Codex: documentar solo decisiones útiles del proyecto sin información sensible.
- Revisar los archivos incluidos en cada commit y no sobrescribir cambios remotos con un push forzado.
- No asumir que los servidores de una sesión anterior siguen activos. Verificar frontend y `/api/health` antes de afirmar que la aplicación está disponible.
- En Windows, usar `npm.cmd` si PowerShell bloquea `npm.ps1`. Si se inicia un proceso auxiliar en segundo plano, mantener su ventana oculta.
- No trasladar rutas absolutas, procesos, credenciales de GitHub ni excepciones de permisos de la computadora original a una nueva como si fueran configuración del proyecto.
