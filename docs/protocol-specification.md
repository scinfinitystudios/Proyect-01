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


## Analizador pasivo integrado (Android)

La aplicación ahora puede, después de conectar:

- Leer únicamente nivel de batería (0x2A19), revisión de hardware (0x2A27), firmware (0x2A26) y software (0x2A28), si el reloj expone esas características como READ.
- Excluir deliberadamente el número de serie (0x2A25).
- Suscribirse a características NOTIFY mediante su descriptor CCCD estándar (0x2902), cuando esté disponible.
- Mostrar los bytes recibidos en hexadecimal en el panel Analizador de protocolo.
- Serializar las escrituras de configuración CCCD y las lecturas GATT para evitar operaciones GATT simultáneas.

La escritura CCCD solo configura la suscripción estándar a notificaciones; no envía comandos del fabricante. No se escriben datos en 0xFFF1, 0xFFF3, NUS TX ni 0xFF02.

## Próxima evidencia necesaria

Conectar el Watch1 real desde WATCH1 CONNECT MANAGER, mantenerlo conectado y observar si aparecen eventos NOTIFY. Las lecturas de firmware/revisiones y los bytes de notificación permitirán avanzar en la identificación. No se debe clasificar ningún byte como comando hasta reproducirlo y verificar su efecto de forma controlada.
