# VYTRAFIT · app nativa (Flutter)

App Android (y lista para iOS) para **entrenadores y asesorados**. Usa el mismo servidor y las mismas cuentas que la web (`https://vytra.fit`). El administrador sigue en la web.

- `lib/core/` — API con renovación de sesión, estado (`/api/state` con ETag), sin conexión (entrenamientos guardados en el celular y subidos después), notificaciones locales, lógica de superseries/drop sets/RIR/tempo y plan de prueba.
- `lib/ui/` — tema (Sora + Inter, color de marca del entrenador, claro/oscuro), componentes, mapa muscular y gráficas.
- `lib/screens/` — acceso, asesorado, entrenador, entrenamiento en vivo y pantallas compartidas.
- `assets/` — biblioteca de 217 ejercicios con imágenes (funciona sin internet), siluetas del mapa muscular, fuentes e íconos.

## Compilar

```bash
flutter pub get
flutter run --dart-define=API_URL=https://vytra.fit          # en un teléfono conectado
flutter build apk --release --dart-define=API_URL=https://vytra.fit
```

En GitHub, un commit a `main` con `[apk]` en el mensaje compila el APK y lo publica en *Releases* (workflow `App Android`).
Para firmar con una clave propia (y actualizar sin desinstalar), agrega los secretos `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` y `ANDROID_KEY_PASSWORD`.
