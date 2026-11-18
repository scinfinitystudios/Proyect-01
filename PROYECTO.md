# PROYECTO — FPS web móvil

## Objetivo
Crear un FPS 3D para navegador móvil con JavaScript y Three.js, sin proceso de compilación y publicable en GitHub Pages. La prioridad técnica es la fluidez, la estabilidad térmica y el uso eficiente de memoria en teléfonos de gama media.

## Estado actual
- Fase 1: base de rendimiento y diagnóstico.
- El motor inicial valida WebGL2, configura el renderizador, selecciona calidad y mide el rendimiento.
- Esta fase no incluye todavía armas, enemigos, mapas ni combate.

## Arquitectura
- `index.html`: estructura y controles iniciales.
- `styles.css`: interfaz adaptable a móvil.
- `js/config.js`: límites y presupuestos centralizados.
- `js/engine/renderer.js`: creación del renderizador y escena inicial.
- `js/performance/quality-manager.js`: prueba inicial y calidad adaptativa.
- `js/performance/debug-panel.js`: métricas de diagnóstico.
- `js/main.js`: ciclo principal, paso fijo y eventos de página.
- `sw.js`: caché de recursos propios para GitHub Pages.

## Reglas de rendimiento
Todas las fases futuras deben cumplir estas reglas y actualizar esta sección al terminar:

### Renderizado
- WebGL2 obligatorio; informar claramente si no está disponible.
- Antialias desactivado y `powerPreference: "high-performance"`.
- Limitar el pixel ratio a 1.5 y aplicar resolución dinámica con histéresis.
- No usar sombras en tiempo real ni postprocesado por defecto.
- Preferir materiales baratos, materiales compartidos y pocas luces.
- Mantener texturas en 512 px o menos; atlas y KTX2 solo cuando aporten una mejora real.
- Usar niebla, frustum culling y LOD cuando haya escenarios y objetos que lo justifiquen.

### Geometría y llamadas de dibujado
- Usar `InstancedMesh` para repetición, geometría estática fusionada cuando proceda y materiales compartidos.
- Presupuesto orientativo: menos de 100 llamadas de dibujado y menos de 100.000 triángulos por fotograma.
- Desactivar `matrixAutoUpdate` en objetos realmente estáticos.
- Evitar grandes transparencias superpuestas y limitar partículas.

### Bucle y memoria
- No crear objetos temporales ni arrays nuevos en el bucle principal; reutilizar vectores, estructuras y pools.
- Usar paso de simulación fijo y limitar el delta acumulado.
- Pausar el renderizado cuando la pestaña no esté visible.
- Liberar geometrías, materiales y texturas mediante `dispose()` cuando dejen de utilizarse.

### Colisiones y física
- Usar cajas, cápsulas y colisionadores simplificados; nunca consultar mallas visuales completas.
- Incorporar cuadrícula espacial para consultas y limitar raycasts a objetos cercanos.

### IA, audio e interfaz
- Escalonar actualizaciones de IA y reducir su frecuencia según distancia.
- Limitar sonidos simultáneos y reutilizar nodos de audio.
- Actualizar el HUD solo cuando cambien los valores; priorizar `transform` y `opacity`.

### Calidad adaptativa
- Ejecutar una prueba breve de rendimiento en el primer arranque.
- Ofrecer calidad automática, baja, media y alta.
- Reducir calidad ante caídas sostenidas y evitar cambios constantes mediante histéresis.
- Ofrecer límite de 30/60 FPS y modo ahorro de batería.

### Carga y compatibilidad
- Mostrar pantalla de carga y cargar recursos pesados de forma diferida.
- Detectar WebGL2 y mostrar un aviso si no es compatible.
- Usar Service Worker para cachear recursos propios y permitir actualizaciones controladas.

### Medición
- Mantener un panel activable con FPS, ms/fotograma, llamadas de dibujado, triángulos y memoria de geometrías/texturas.
- Registrar caídas sostenidas en consola con una causa probable.
- No afirmar que se alcanzan 60 FPS sin medirlo en el dispositivo real.

### Organización
- Código modular, comentarios en español y un archivo por responsabilidad.
- Todos los límites y presupuestos deben vivir en `js/config.js`.
- Cada fase debe documentar archivos modificados, mediciones reales, limitaciones y pruebas pendientes.

## Cómo probar
1. Publicar la rama o desplegar GitHub Pages desde la rama elegida.
2. Abrir la URL en Chrome Android.
3. Esperar la calibración inicial.
4. Probar calidad automática y manual, 30/60 FPS y ahorro de batería.
5. Activar el panel de diagnóstico y comparar métricas durante al menos un minuto.
6. Repetir la prueba después de varios minutos para observar calentamiento y estabilidad.

## Cierre de la fase 1
- Base web modular creada en la rama `fps-mobile-performance`.
- Incluye detección WebGL2, renderizador sin antialias, pixel ratio limitado, calibración inicial heurística, control de calidad, límite de 30/60 FPS, ahorro de batería, pausa al ocultar la pestaña, panel de diagnóstico y caché del shell.
- La resolución adaptativa usa una ventana de muestras en búfer tipado e histéresis para evitar ajustes bruscos.
- No se añadieron todavía armas, enemigos, colisiones ni mapa; pertenecen a fases posteriores.
- No se han ejecutado pruebas reales en el teléfono ni mediciones automatizadas en un navegador desde este entorno.

## Registro de mediciones
Sin mediciones reales todavía. La calibración inicial es orientativa: el escenario de prueba es pequeño y no predice el rendimiento final de un mapa con enemigos y efectos. Los valores definitivos se registrarán después de probar el dispositivo durante al menos varios minutos.
