# WATCH1 CONNECT MANAGER

Aplicación Android y herramienta de escritorio para explorar y diagnosticar la conexión Bluetooth Low Energy (BLE) del reloj Watch1.

> **Estado:** Fase 1 — base Bluetooth LE. El protocolo propietario del reloj todavía no está identificado. La aplicación no envía comandos ni datos de escritura al dispositivo.

## Componentes

- `android/`: aplicación Android nativa con Kotlin, Jetpack Compose y Android BLE APIs.
- `desktop/`: herramienta de escritorio Python con PySide6 y Bleak.
- `docs/`: perfil del dispositivo, inventario GATT, protocolo y decisiones técnicas.

## Funciones iniciales

- Escanear dispositivos BLE cercanos.
- Identificar el Watch1 por el nombre anunciado y, cuando esté disponible, su dirección.
- Conectar y desconectar.
- Descubrir y mostrar servicios y características GATT.
- Mostrar propiedades READ, WRITE, WRITE WITHOUT RESPONSE, NOTIFY e INDICATE.
- Diagnóstico básico y estados explícitos.

La escritura BLE y los comandos propietarios permanecen deshabilitados hasta documentar el protocolo y validar una operación segura. La compatibilidad de archivos, aplicaciones y APK no está demostrada.

## Requisitos

### Android
- Android Studio compatible con Android Gradle Plugin 8.13.2.
- JDK 17.
- Android 8.0 (API 26) o superior; permisos BLE modernos solicitados en tiempo de ejecución.

### Escritorio
- Python 3.11 o superior.
- Bluetooth LE compatible en el equipo y sistema operativo.
- Instalar dependencias desde `desktop/requirements.txt`.

## Ejecutar la herramienta de escritorio

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r desktop/requirements.txt
python desktop/main.py
```

## Seguridad y honestidad técnica

- No se inventan UUID, comandos ni formatos de paquetes.
- Los UUID observados se documentan como datos de la inspección, no como prueba de un protocolo funcional.
- No se envían escrituras al Watch1 en esta fase.
- Las funciones no verificadas deben mostrarse como no disponibles o pendientes, con explicación.

## Licencia

Este repositorio es **propietario**. Consulta `LICENSE`. No se concede permiso para copiar, modificar, distribuir ni utilizar el software sin autorización expresa del titular de los derechos.
