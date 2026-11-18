# FPS Mobile para Android

Aplicación Android instalable que ejecuta Three.js en un WebView a pantalla completa. HTML, CSS, JavaScript y Three.js se empaquetan dentro del APK; no necesita abrir Chrome ni descargar el motor al iniciar.

## Obtener el APK

Cada push a `android-apk` y cada ejecución manual del workflow **Build Android APK** compila `app-debug.apk`. En GitHub abre **Actions → Build Android APK → último run verde → Artifacts → FPS-Mobile-debug-apk** y descarga el ZIP que contiene el APK.

## Compilar localmente

Requiere JDK 17, Android SDK plataforma 35 y Gradle 8.9. Ejecuta `gradle assembleDebug`. El APK queda en `app/build/outputs/apk/debug/app-debug.apk`.

## Estado funcional

El APK incluye la base gráfica de la fase 1. Todavía no es el FPS completo: no incluye movimiento del jugador, armas, enemigos, mapa ni combate. El APK debug es para pruebas; no es todavía una versión firmada para Google Play.
