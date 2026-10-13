# FitCoach Pro

Plataforma para entrenadores personales con modelo de licencias. Funciona en PC y en el celular (se puede instalar como app).

**Demo interactiva:** [anderssont-var.github.io/AnderssonT-var.github/demos/fitcoach/](https://anderssont-var.github.io/AnderssonT-var.github/demos/fitcoach/)

## Capturas

**Entrenador: pendientes, cumplimiento semanal y cobros**

![Panel del entrenador](docs/capturas/entrenador.jpg)

**Administrador: licencias**

![Licencias del administrador](docs/capturas/admin.jpg)

**Cliente: entrenamiento del día**

![Inicio del cliente](docs/capturas/cliente.jpg)

## Roles

- **Administrador:** genera códigos de licencia (1, 3, 6 o 12 meses), los renueva o revoca, y ve a cada entrenador con sus clientes e ingresos por licencias.
- **Entrenador:** activa su cuenta con un código de licencia. Gestiona clientes, arma rutinas por días, controla mensualidades, chatea con sus clientes y anima a su comunidad. Si la licencia vence o se revoca, el panel se bloquea hasta canjear un código nuevo (sus datos se conservan).
- **Cliente:** ve su rutina, entrena en modo en vivo desde el celular, registra su peso, ve su progreso y sus pagos, y habla con su entrenador.

## Funciones principales

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

## Tecnologías

React 18 · Vite · JavaScript · SQL (esquema en `database/fitcoachpro.sql`)

## Ejecutar en local

```bash
npm install
npm run dev
```

Cuentas de demostración (datos ficticios):

| Rol | Correo | Contraseña |
|---|---|---|
| Admin | admin@fitcoach.com | admin123 |
| Entrenador | carlos@fitcoach.com | coach123 |
| Cliente | sofia@fitcoach.com | user123 |

En la pantalla de inicio también hay acceso con un toque y, dentro de la app, un selector para cambiar de rol y otro para restablecer los datos.

## Estructura

```
src/
  store/      datos del demo (seed.js) y todas las operaciones (db.js)
  lib/        formatos de fecha, dinero y pesos
  ui/         iconos, componentes base y gráficos
  layout/     barra lateral (PC) y pestañas (móvil)
  pages/      auth · admin · coach · client · shared
  workout/    entrenamiento en vivo, historial y gráficos de progreso
```

## Estado

Prototipo funcional completo del frontend. Los datos se guardan en el navegador (`localStorage`). Cada función de `src/store/db.js` corresponde a un endpoint del backend que falta conectar (autenticación, base de datos y almacenamiento).

---
Desarrollado por [Andersson Toapanta](https://anderssont-var.github.io/AnderssonT-var.github/)
