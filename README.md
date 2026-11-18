# FPS Mobile

Prototipo de FPS 3D para navegador móvil, desarrollado con JavaScript y Three.js sin compilación y preparado para GitHub Pages.

## Estado
Primera fase: base de rendimiento, detección WebGL2, calidad adaptativa, diagnóstico y caché del shell web.

Consulta [PROYECTO.md](./PROYECTO.md) para la arquitectura, las reglas de rendimiento y el procedimiento de pruebas.

## Ejecución
Sirve la carpeta raíz con cualquier servidor HTTP estático o publica esta rama mediante GitHub Pages. No abras `index.html` directamente como archivo local: los módulos ES y el Service Worker requieren HTTP/HTTPS.

Three.js se carga desde jsDelivr; la primera carga requiere conexión a Internet.
