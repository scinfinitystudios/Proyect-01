# FPS Mobile para Android

Aplicación Android instalable que ejecuta el juego web 3D dentro de un WebView a pantalla completa.

## Cómo se construye

Cada push a `android-apk` y cada ejecución manual de **Build Android APK**:
1. Copia HTML, CSS y JavaScript a los assets privados de Android.
2. Descarga Three.js 0.180.0 y lo empaqueta localmente para que el motor no dependa de jsDelivr al iniciar.
3. Comprueba la sintaxis de los módulos JavaScript.
4. Compila el APK debug y verifica que los recursos principales estén dentro del paquete.
5. Publica el APK como artefacto de GitHub Actions durante 14 días.

En GitHub abre **Actions → Build Android APK → último run verde → Artifacts → FPS-Mobile-debug-apk** y descarga el ZIP que contiene el APK.

## Requisitos y compatibilidad

- Android 6.0 o posterior (minSdk 23).
- WebView de Android actualizado.
- GPU y controlador compatibles con WebGL 2.
- La aceleración por hardware debe estar disponible.
- El juego requiere WebGL 2; si el dispositivo o WebView no lo ofrece, mostrará un aviso de compatibilidad.

## Estado funcional actual

- Escenario 3D de práctica con bosque, camino y campamento.
- Joystick izquierdo para desplazamiento.
- Joystick derecho para orientar la cámara.
- Botón FUEGO para disparar a cinco blancos de práctica y sumar puntos.
- Ajustes de calidad gráfica, límite de 30/60 FPS, ahorro de batería y panel de diagnóstico.

Todavía es un prototipo: no incluye colisiones del jugador, enemigos con IA, armas modeladas, animaciones, sonido, multijugador ni un mapa final. Los blancos son objetivos de práctica, no enemigos.

## Diagnóstico

La aplicación registra errores de JavaScript y fallos de carga de recursos con la etiqueta `FPSMobile` en Logcat. La compilación correcta confirma el empaquetado, pero no sustituye una prueba de ejecución en un teléfono real.

## Compilar localmente

Requiere JDK 17, Android SDK plataforma 35 y Gradle 8.9. Ejecuta `gradle clean assembleDebug`. El APK queda en `app/build/outputs/apk/debug/app-debug.apk`.

El APK debug es para pruebas; todavía no es una versión firmada para Google Play.
