# FitCoach Pro

Plataforma web para entrenadores personales con modelo de licencias. Tres roles con paneles propios:

- **Administrador:** genera códigos de licencia (de 1 a 12 meses) para dar acceso a los entrenadores y ve las métricas generales.
- **Entrenador:** gestiona sus clientes, arma rutinas individuales dentro del perfil de cada cliente y registra los pagos de cada uno.
- **Cliente:** consulta su rutina y su progreso.

## Tecnologías

React 18 · Vite · JavaScript · SQL (esquema en `database/fitcoachpro.sql`)

## Ejecutar en local

```bash
npm install
npm run dev
```

Cuentas de demostración (datos ficticios, solo para probar el prototipo):

| Rol | Correo | Contraseña |
|---|---|---|
| Admin | admin@fitcoach.com | admin123 |
| Entrenador | carlos@fitcoach.com | coach123 |
| Cliente | sofia@fitcoach.com | user123 |

## Estado

Prototipo funcional del frontend. El siguiente paso es conectar el backend (autenticación, base de datos y almacenamiento).

---
Desarrollado por [Andersson Toapanta](https://anderssont-var.github.io/AnderssonT-var.github/)
