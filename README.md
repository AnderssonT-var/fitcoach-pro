# VYTRAFIT

Plataforma para entrenadores personales con modelo de licencias. Funciona en PC, en el navegador del celular y como app Android.

**Demo de la interfaz (datos ficticios, sin servidor):** [anderssont-var.github.io/AnderssonT-var.github/demos/fitcoach/](https://anderssont-var.github.io/AnderssonT-var.github/demos/fitcoach/)

## Capturas

**Entrenador: pendientes, cumplimiento semanal y cobros**

![Panel del entrenador](docs/capturas/entrenador.jpg)

**Administrador: licencias**

![Licencias del administrador](docs/capturas/admin.jpg)

**Cliente: entrenamiento del día**

![Inicio del cliente](docs/capturas/cliente.jpg)

## Roles

- **Administrador:** genera códigos de licencia (1, 3, 6 o 12 meses), los renueva o revoca, y ve a cada entrenador con sus clientes e ingresos por licencias.
- **Entrenador:** activa su cuenta con un código de licencia. Gestiona clientes, arma rutinas por días, controla mensualidades, chatea con sus clientes y anima a su comunidad. Si la licencia vence o se revoca, el panel se bloquea hasta pagar o canjear un código (sus datos se conservan).
- **Cliente:** ve su rutina, entrena en modo en vivo desde el celular, registra su peso, ve su progreso y sus pagos, y habla con su entrenador.

## Biblioteca de ejercicios

Cada entrenador empieza con **217 ejercicios precargados**, incluidas máquinas Hammer Strength (press de pecho, inclinado, declinado, de hombros, remo Iso-Lateral, remo alto, jalón), máquina Smith, poleas, sentadilla péndulo, belt squat, V-squat, hack, hip thrust en máquina y barra hexagonal. Cada uno trae:

- Fotos de la posición inicial y final (se animan en la ficha). Los 24 ejercicios que no existen en la base de imágenes muestran el mapa muscular en su lugar.
- Mapa muscular de frente y espalda con los músculos principales y secundarios resaltados.
- Pasos de ejecución, un consejo técnico y series/reps/descanso sugeridos que se usan al agregarlo a una rutina.

Se filtran por **categoría** (pecho, espalda, hombros, bíceps, tríceps, antebrazos, abdomen, glúteos, cuádriceps, isquiotibiales, pantorrillas, cuerpo completo, cardio y estiramiento), por **equipo** (incluye Hammer Strength y máquina Smith), por **nivel** y tocando un músculo en el cuerpo, con búsqueda por nombre o músculo. El entrenador puede crear los suyos con su propia imagen y músculos.

Imágenes y datos base: [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) (dominio público, Unlicense). Nombres, pasos y consejos traducidos y adaptados al español. Las imágenes están en `public/ejercicios/`.

## Mapa muscular

Siluetas anatómicas de frente y espalda, de hombre o de mujer (cada cliente elige la suya en su perfil). Se usa en:

- **Ficha del ejercicio:** músculos principales y secundarios; toca un músculo para ver su nombre.
- **Biblioteca y selector de rutinas:** botón *Por músculo*: toca un músculo en el cuerpo y solo aparecen los ejercicios que lo trabajan.
- **Crear ejercicio:** se marcan los músculos tocando el cuerpo (un toque principal, dos secundario, tres quita).
- **Progreso del cliente (cliente y entrenador):** mapa de calor de series por semana por músculo en 7 o 30 días, barras con el rango de 10–20 series y la lista de músculos sin trabajar.
- **Editor de rutinas:** balance muscular de las series semanales que plantea la rutina, antes de guardarla.
- **Al terminar un entrenamiento:** mapa de los músculos trabajados ese día.

Trazos de las siluetas basados en [react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter) © 2022 ELABBASSI Hicham, licencia MIT (`src/ui/bodyPaths.js`).

## Marca propia de cada entrenador

Cada entrenador personaliza su cuenta sin afectar a los demás:

- **Perfil:** foto, especialidad, años de experiencia, presentación, especialidades, certificaciones y lo que incluye su plan. Sus asesorados lo ven en su app.
- **Marca:** logo, nombre comercial, frase de bienvenida y color. La app de sus asesorados se pinta con ese color y muestra su logo.
- **Acceso propio:** cada entrenador tiene su enlace (por ejemplo `#mendez-strength` o `#torres-fit`). Ese login muestra su logo y su nombre, y solo deja entrar a él y a sus asesorados; una cuenta de otro entrenador recibe un aviso.

Los asesorados también tienen su perfil: foto, “Sobre mí” y lesiones o molestias que su entrenador debe conocer.

## Seguimiento de cada asesorado

En la ficha de cada cliente, el entrenador tiene:

- **Medidas:** peso, % de grasa, cintura, cadera, pecho, brazo y muslo, con gráfico de evolución.
- **Fotos de progreso:** subida de varias fotos (frente, perfil, espalda), galería por fecha y comparación antes/después. El cliente también puede subir las suyas.
- **Notas privadas:** por categoría (técnica, lesión, nutrición, pagos), fijables arriba. El cliente no las ve.

## Funciones principales

- **Técnicas en rutinas:** drop sets, superseries (se alternan sin descanso; el descanso llega al cerrar la ronda), intensidad por RIR o RPE y tempo (ej. 3-1-1-0).
- **Inscripción desde el enlace del entrenador:** si el entrenador la abre en *Perfil y marca*, los nuevos asesorados se registran solos, aceptan el aviso de privacidad y empiezan su plan de prueba con la rutina inicial que él eligió.

| Área | Qué hace |
|---|---|
| Licencias | Códigos `FIT-XXXX-XXXX`, activación en el registro, días restantes, aviso de vencimiento, renovación que suma tiempo, revocación y reactivación |
| Clientes | Alta con acceso temporal, filtros (sin rutina, pago vencido, inactivos), ficha con resumen, rutina, historial, pagos y datos |
| Rutinas | Varios días por rutina, ejercicios con series, reps, descanso y notas, orden, plantillas reutilizables |
| Entrenamiento en vivo | Serie por serie con la carga anterior, discos por lado de la barra, temporizador de descanso con vibración y sonido, sesión que se reanuda, dificultad percibida, récords y mensaje al entrenador |
| Pagos | Mensualidades automáticas del mes, pendientes y vencidos por fecha, registro con método de pago |
| Comunicación | Mensajes 1 a 1, comunidad con publicaciones, retos, me gusta, comentarios y tabla del mes |
| Progreso | Entrenamientos por semana, volumen, peso corporal y récords personales |

## Diseño

Lenguaje visual estilo Apple: tipografía del sistema (SF Pro en Mac y iPhone, Inter en el resto), fondos agrupados, listas con separadores finos, controles segmentados, barras translúcidas y colores de sistema de iOS. Tema claro y oscuro.

## Seguridad

- **Contraseñas** cifradas con bcrypt (costo 12). Reglas mínimas: 8 caracteres con letras y números.
- **Sesiones:** token de acceso de 15 minutos y token de renovación de 30 días que cambia en cada uso. Si alguien reusa uno viejo (posible robo), se cierran todas las sesiones de esa cuenta. Cambiar la contraseña también cierra las demás sesiones.
- **Intentos de acceso:** bloqueo de 15 minutos tras 5 contraseñas incorrectas y límite de peticiones por IP. El mensaje de error no revela si el correo existe.
- **Contraseñas temporales:** cuando el entrenador crea un asesorado (o el admin ayuda a un entrenador), la persona debe crear su propia contraseña al entrar.
- **Permisos en el servidor:** cada acción revisa el rol y que el dato pertenezca a ese entrenador. Un entrenador no puede ver ni tocar asesorados de otro; el asesorado no recibe las notas privadas de su entrenador; el administrador no recibe medidas, entrenamientos ni fotos.
- **Licencias:** códigos `FIT-XXXX-XXXX-XXXX` aleatorios de 60 bits, de un solo uso (el canje es atómico, aunque dos personas lo intenten a la vez) y con límite de intentos. La vigencia se verifica en el servidor en cada petición.
- **Archivos privados:** fotos y comprobantes fuera de la carpeta pública; se abren solo con enlaces firmados que vencen. Se valida el tipo real de cada imagen.
- **Cabeceras:** CSP estricta, HSTS, sin `X-Powered-By`, CORS solo para orígenes conocidos.

Las pruebas automáticas (más de 100 casos de API, probadas en SQLite y en MySQL/MariaDB) cubren todo lo anterior, además de rutinas, drop sets, chat, plan de prueba y cobros.

## Privacidad (datos sensibles)

- Al primer ingreso, el asesorado acepta el **aviso de privacidad**, que explica que sus medidas, lesiones y **fotos del cuerpo son datos sensibles**.
- Las fotos requieren un **permiso aparte**, que se puede dar o retirar desde «Mi perfil». Sin él, ni el entrenador ni el asesorado pueden subir fotos.
- El asesorado puede **descargar sus datos** y **eliminar su cuenta**; el entrenador puede eliminar a un asesorado con todos sus datos.
- Política de privacidad y términos en `#privacidad` y `#terminos`. El responsable y el correo de contacto los configura el administrador en *Cobros → Datos legales*.

## Cobros de licencias

El administrador fija el **precio por mes** y los descuentos de 3, 6 y 12 meses, y publica sus datos bancarios. El entrenador elige un plan, paga y sube el comprobante desde *Suscripción*; el administrador lo aprueba en *Cobros* y la licencia se extiende sola. El monto siempre lo calcula el servidor. También se pueden generar códigos para venta directa.

## Tecnologías

- **App:** React 18 · Vite 5 · JavaScript · CSS · SVG interactivo
- **Servidor:** Node.js · Express · Knex · MySQL (SQLite para desarrollo) · bcrypt · JWT · Zod · Helmet
- **Android:** Capacitor 7, compilado en GitHub Actions

## Publicar en producción (Hostinger u otro hosting con Node.js)

1. Crea una base de datos **MySQL** y un sitio con **Node.js** (versión 20 o superior).
2. Sube el repositorio (o conéctalo desde GitHub) y crea el archivo `.env` a partir de `.env.example` con tus secretos, la base de datos y `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
3. Comandos del sitio:
   - Instalar: `npm install`
   - Compilar: `npm run build`
   - Iniciar: `npm start`
4. Activa **HTTPS** en el dominio. Al arrancar, el servidor crea las tablas y el administrador.
5. Entra con el administrador, ve a **Cobros** y define el precio, tus datos bancarios y los datos legales. Luego genera la primera licencia en **Licencias**.

### Rendimiento y mantenimiento

- La app consulta cambios cada 20 s; si nada cambió, el servidor responde `304` sin datos (ahorra batería y megas).
- Se envía el detalle por serie de los últimos 4 meses y un resumen de los anteriores; los récords de todos los tiempos se guardan aparte. La exportación de datos siempre incluye el historial completo.
- Cada 6 horas se limpian sesiones vencidas y entrenamientos abandonados (más de 14 días sin terminar).
- El servidor se apaga de forma ordenada (`SIGTERM`) y la tipografía va incluida en la app (sin depender de Google Fonts).

### Notificaciones

- **Navegador y web instalada (Android, PC, iPhone agregado a la pantalla de inicio):** Web Push. No requiere configurar nada: las claves se crean solas.
- **App Android:** el fin del descanso y el recordatorio de entrenar funcionan con notificaciones locales, sin configuración. Para recibir también mensajes, pagos y avisos del servidor en la app, activa Firebase:
  1. Crea un proyecto gratis en [console.firebase.google.com](https://console.firebase.google.com) y agrega una app Android con el paquete `com.atdev.fitcoachpro`.
  2. Descarga `google-services.json` y pega su contenido en el secreto del repositorio `GOOGLE_SERVICES_JSON` (Settings → Secrets → Actions). El próximo APK ya lo incluye.
  3. En Firebase → Configuración → Cuentas de servicio, genera una clave privada (JSON) y pégala en la variable `FCM_SERVICE_ACCOUNT` del servidor (hPanel → Node.js → Variables de entorno).
- Avisos que se envían: mensajes nuevos, rutina actualizada, entrenamiento terminado (al entrenador), pago por vencer y vencido, prueba por terminar o terminada, licencia por vencer, inscripción nueva, recordatorio de entrenar (hora y días que elige el asesorado) y fin del descanso con la pantalla apagada. De noche (21:00–8:00) no salen avisos programados.

### Tareas programadas y monitoreo

- Los recordatorios y avisos corren cada 5 minutos dentro del servidor.
- `.github/workflows/uptime.yml` revisa cada 10 minutos que `https://vytra.fit/api/health` responda; si falla, GitHub te avisa por correo.
- Para asegurar las tareas aunque el servidor esté sin visitas, define `CRON_KEY` (un texto largo aleatorio) en el servidor **y** como secreto del repositorio con el mismo valor: el monitor llamará a `/api/cron` en cada revisión. También sirve un cron de hPanel: `curl -s -X POST -H "X-Cron-Key: TU_CLAVE" https://vytra.fit/api/cron`.
- Los errores del servidor y de la app (pantallas) quedan en **Sistema** (administrador), agrupados, y el administrador recibe una notificación cuando falla el servidor.

### Sin conexión

El entrenamiento en curso se guarda en el celular en cada cambio. Si no hay señal, la app abre igual (con lo último que recibió), se puede seguir entrenando y terminar: el entrenamiento queda en el celular y se sube solo al volver la conexión. El servidor ignora los duplicados, así que reintentar es seguro. Al cerrar sesión se borran los datos guardados para usar sin conexión.

### Copias de seguridad

Respalda dos cosas, idealmente cada día:

1. La base de datos: `mysqldump -u USUARIO -p BASE > respaldo-$(date +%F).sql` (en Hostinger también desde hPanel → Copias de seguridad).
2. La carpeta privada de archivos (`UPLOAD_DIR`, por defecto `data/uploads`): fotos de progreso y comprobantes.

También se puede crear o cambiar el administrador con `npm run create-admin -- correo@dominio.com "Contraseña-segura-1" "Nombre"`.

### Producción actual: https://vytra.fit

- Hosting Business de Hostinger, Node.js 22 (Express), MySQL `u753080405_vytrafit`, SSL activo y redirección a HTTPS.
- Las variables de entorno (secretos, base de datos, `DATA_DIR`/`UPLOAD_DIR` fuera de la carpeta pública) están en hPanel → Node.js → Variables de entorno. No están en el repositorio.
- Fotos y comprobantes: `/home/u753080405/domains/vytra.fit/vytrafit-data/uploads` (no se borran al redesplegar).
- Para redesplegar: se empaqueta `main` como `app.zip` en la rama `hostinger-deploy`, Hostinger la clona en `public_html/deploy-src` y compila desde ese archivo. Si conectas GitHub en hPanel (Sitios web → Administrar → Git), se puede activar el despliegue automático en cada push.

## App Android

El APK se compila en GitHub Actions (`.github/workflows/android.yml`) y se publica en **Releases**:

- Automático al subir una etiqueta: `git tag v1.0.0 && git push origin v1.0.0`
- O desde la pestaña **Actions → App Android → Run workflow**, escribiendo la dirección del servidor.

Por defecto la app usa `https://vytra.fit`. Para otro servidor, configura la variable del repositorio `API_URL` (Settings → Secrets and variables → Actions → Variables) con la dirección del servidor, por ejemplo `https://app.tudominio.com`. Si no está definida, la app la pregunta la primera vez.

Para publicar en Google Play, agrega estos secretos y el flujo firmará con tu clave y generará también el `.aab`: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## Desarrollo local

```bash
npm install
npm run dev:seed      # SOLO desarrollo: base SQLite con datos de prueba
npm run dev:server    # API en http://localhost:3000
npm run dev           # app en http://localhost:5173
```

Contraseñas de los datos de prueba: `Admin2026` (admin@fitcoach.com), `Coach2026` (entrenadores), `Cliente2026` (asesorados).

## Estructura

```
server/       API: autenticación, permisos, licencias, cobros, archivos privados
  routes/     auth · admin · coach · client (y compartidas)
  scripts/    create-admin · dev-seed
src/
  store/      conexión con la API (api.js) y datos de la app (db.js)
  pages/      auth · admin · coach · client · shared · legal
  workout/    entrenamiento en vivo, historial y progreso
  ui/         componentes, mapa muscular y gráficos
android/      proyecto Android (Capacitor)
```

---
Desarrollado por [Andersson Toapanta (A.T.)](https://anderssont-var.github.io/AnderssonT-var.github/)
