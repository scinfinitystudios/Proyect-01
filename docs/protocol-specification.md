# Especificación de protocolo — estado inicial

## Estado

**Desconocido / no implementado.**

No se ha capturado una sesión de comunicación de la aplicación complementaria ni se ha identificado el formato de mensajes del fabricante.

## Reglas

1. No inventar comandos, cabeceras, checksums, delimitadores ni secuencias de inicialización.
2. No escribir en características propietarias desde la aplicación durante la Fase 1.
3. Registrar por separado UUID, propiedades GATT, valores leídos y mensajes observados.
4. Una capacidad solo pasa a "verificada" después de una prueba reproducible y documentada.
5. Los canales 0xFFF1, 0xFFF3, NUS TX y 0xFF02 quedan identificados como características con permiso de escritura, no como comandos conocidos.

## Evidencias pendientes

- Valores de firmware/software/hardware leídos desde 0x180A.
- Identificación del chipset o plataforma, si está disponible.
- Identificación de la aplicación complementaria.
- Captura pasiva de mensajes durante operaciones normales, si es posible sin alterar el reloj.
- Pruebas controladas solo después de comprender el protocolo y evaluar el riesgo.
