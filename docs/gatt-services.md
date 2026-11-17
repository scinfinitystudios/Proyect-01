# Inventario GATT observado

Fuente: inspección manual con nRF Connect for Mobile. Debe verificarse de nuevo desde la aplicación.

| Servicio | Característica | Propiedades observadas | Estado |
|---|---|---|---|
| 0x180F Battery Service | No documentada | Servicio detectado | Parcial |
| 0x180A Device Information | 0x2A25 Serial Number String | READ | Observada; no registrar el valor |
| 0x180A Device Information | 0x2A27 Hardware Revision String | READ | Lectura pendiente |
| 0x180A Device Information | 0x2A26 Firmware Revision String | READ | Lectura pendiente |
| 0x180A Device Information | 0x2A28 Software Revision String | READ | Lectura pendiente |
| 0xFF10 | 0xFFF1 | WRITE, WRITE WITHOUT RESPONSE | Observado |
| 0xFF12 | 0xFFF3 | WRITE | Observado |
| 0xFF12 | 0xFFF4 | READ, NOTIFY | Observado |
| NUS 6e400001-b5a3-f393-e0a9-e50e24dcca9f | 6e400002-b5a3-f393-e0a9-e50e24dcca9f | WRITE, WRITE WITHOUT RESPONSE | Observado |
| NUS 6e400001-b5a3-f393-e0a9-e50e24dcca9f | 6e400003-b5a3-f393-e0a9-e50e24dcca9f | READ, NOTIFY | Observado |
| 0xFF00 | 0xFF01 | READ, NOTIFY | Observado; notificaciones habilitadas sin datos |
| 0xFF00 | 0xFF02 | WRITE, WRITE WITHOUT RESPONSE | Observado |

## Interpretación prudente

La estructura NUS coincide con el servicio Nordic UART habitual. Esto no demuestra que los mensajes propietarios del reloj utilicen el protocolo NUS estándar.

WRITE indica que una característica acepta escrituras GATT, no que conozcamos el formato o efecto de los datos.

## Política

La versión inicial solo descubre y presenta el inventario. No incluye controles de escritura ni envía comandos.
