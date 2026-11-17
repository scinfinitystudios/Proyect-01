"""WATCH1 CONNECT MANAGER — desktop BLE discovery prototype.

Read-only by design: scans, connects, and discovers GATT. No write operation
is exposed while the Watch1 protocol remains unknown.
"""
from __future__ import annotations

import asyncio
import sys
from typing import Optional

from bleak import BleakClient, BleakScanner
from PySide6.QtCore import QObject, Signal, Slot
from PySide6.QtWidgets import (
    QApplication, QHBoxLayout, QLabel, QMainWindow, QMessageBox,
    QPushButton, QTreeWidget, QTreeWidgetItem, QVBoxLayout, QWidget,
)


class BleWorker(QObject):
    devices_found = Signal(list)
    status = Signal(str)
    services_found = Signal(list)
    failed = Signal(str)

    def __init__(self) -> None:
        super().__init__()
        self.client: Optional[BleakClient] = None

    @Slot()
    def scan(self) -> None:
        asyncio.create_task(self._scan())

    async def _scan(self) -> None:
        self.status.emit("Buscando dispositivos BLE…")
        try:
            devices = await BleakScanner.discover(timeout=6.0)
            rows = [{"name": d.name or "Dispositivo sin nombre", "address": d.address}
                    for d in devices]
            self.devices_found.emit(rows)
            self.status.emit(f"Escaneo terminado: {len(rows)} dispositivo(s).")
        except Exception as exc:
            self.failed.emit(str(exc))

    @Slot(str)
    def connect_device(self, address: str) -> None:
        asyncio.create_task(self._connect(address))

    async def _connect(self, address: str) -> None:
        try:
            if self.client and self.client.is_connected:
                await self.client.disconnect()
            self.status.emit(f"Conectando a {address}…")
            self.client = BleakClient(address)
            await self.client.connect()
            services = []
            for service in self.client.services:
                chars = [{"uuid": c.uuid, "properties": list(c.properties)}
                         for c in service.characteristics]
                services.append({"uuid": service.uuid, "chars": chars})
            self.services_found.emit(services)
            self.status.emit("Conectado. Exploración GATT completada (solo lectura).")
        except Exception as exc:
            self.failed.emit(str(exc))
            self.status.emit("No se pudo completar la conexión.")

    @Slot()
    def disconnect_device(self) -> None:
        asyncio.create_task(self._disconnect())

    async def _disconnect(self) -> None:
        try:
            if self.client and self.client.is_connected:
                await self.client.disconnect()
            self.status.emit("Desconectado.")
        except Exception as exc:
            self.failed.emit(str(exc))


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("WATCH1 CONNECT MANAGER")
        self.resize(920, 640)
        self.worker = BleWorker()

        root = QWidget()
        layout = QVBoxLayout(root)
        heading = QLabel("WATCH1 CONNECT MANAGER")
        heading.setStyleSheet("font-size: 22px; font-weight: 700;")
        layout.addWidget(heading)
        layout.addWidget(QLabel("Exploración Bluetooth LE · modo seguro de solo lectura"))

        buttons = QHBoxLayout()
        self.scan_button = QPushButton("Buscar dispositivos")
        self.connect_button = QPushButton("Conectar seleccionado")
        self.disconnect_button = QPushButton("Desconectar")
        for button in (self.scan_button, self.connect_button, self.disconnect_button):
            buttons.addWidget(button)
        layout.addLayout(buttons)

        split = QHBoxLayout()
        self.devices = QTreeWidget()
        self.devices.setHeaderLabels(["Dispositivos BLE", "Dirección"])
        self.gatt = QTreeWidget()
        self.gatt.setHeaderLabels(["Servicios y características GATT", "Propiedades"])
        split.addWidget(self.devices, 1)
        split.addWidget(self.gatt, 2)
        layout.addLayout(split)

        self.status_label = QLabel("Listo. Pulsa «Buscar dispositivos».")
        layout.addWidget(self.status_label)
        self.setCentralWidget(root)

        self.scan_button.clicked.connect(self.worker.scan)
        self.connect_button.clicked.connect(self._connect_selected)
        self.disconnect_button.clicked.connect(self.worker.disconnect_device)
        self.worker.devices_found.connect(self._show_devices)
        self.worker.services_found.connect(self._show_services)
        self.worker.status.connect(self.status_label.setText)
        self.worker.failed.connect(self._show_error)

        self.setStyleSheet("""
            QMainWindow, QWidget { background: #101722; color: #e8eef7; }
            QPushButton { background: #1769aa; padding: 10px; border-radius: 6px; }
            QTreeWidget { background: #172231; border: 1px solid #34445a; }
        """)

    @Slot()
    def _connect_selected(self) -> None:
        item = self.devices.currentItem()
        if item is None:
            QMessageBox.information(self, "Selecciona un dispositivo",
                                    "Primero selecciona un dispositivo BLE.")
            return
        self.worker.connect_device(item.text(1))

    @Slot(list)
    def _show_devices(self, rows: list) -> None:
        self.devices.clear()
        for row in rows:
            QTreeWidgetItem(self.devices, [row["name"], row["address"]])

    @Slot(list)
    def _show_services(self, services: list) -> None:
        self.gatt.clear()
        for service in services:
            parent = QTreeWidgetItem(self.gatt, [service["uuid"], "Servicio"])
            for char in service["chars"]:
                QTreeWidgetItem(parent, [char["uuid"], ", ".join(char["properties"])])
        self.gatt.expandAll()

    @Slot(str)
    def _show_error(self, message: str) -> None:
        QMessageBox.warning(self, "Bluetooth LE", message)


def main() -> int:
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
