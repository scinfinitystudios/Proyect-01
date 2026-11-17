package com.scinfinitystudios.watch1connect

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import java.util.UUID

data class BleEntry(val name: String, val address: String, val device: BluetoothDevice)

class MainActivity : ComponentActivity() {
    private val devices = mutableStateListOf<BleEntry>()
    private val gattRows = mutableStateListOf<String>()
    private var status by mutableStateOf("Listo. Activa Bluetooth y busca el reloj.")
    private var connectedGatt: BluetoothGatt? = null
    private val adapter: BluetoothAdapter? by lazy {
        (getSystemService(BLUETOOTH_SERVICE) as android.bluetooth.BluetoothManager).adapter
    }

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            if (result.values.all { it }) startScan()
            else status = "Permisos Bluetooth denegados. Autorízalos para continuar."
        }

    private fun requiredPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }

    private fun hasPermissions(): Boolean = requiredPermissions().all {
        ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
    }

    private fun requestPermissionsAndScan() {
        if (hasPermissions()) startScan() else permissionLauncher.launch(requiredPermissions())
    }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device
            val address = try { device.address } catch (_: SecurityException) { "Dirección protegida" }
            val name = result.scanRecord?.deviceName ?: try { device.name } catch (_: SecurityException) { null } ?: "Dispositivo BLE"
            if (devices.none { it.address == address }) {
                devices.add(BleEntry(name, address, device))
            }
        }

        override fun onScanFailed(errorCode: Int) {
            status = "Error de escaneo BLE: $errorCode"
        }
    }

    private fun startScan() {
        val bluetoothAdapter = adapter
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) {
            status = "Bluetooth está apagado o no está disponible."
            return
        }
        try {
            devices.clear()
            gattRows.clear()
            status = "Buscando dispositivos BLE durante 10 segundos…"
            bluetoothAdapter.bluetoothLeScanner?.startScan(scanCallback)
            window.decorView.postDelayed({
                try { bluetoothAdapter.bluetoothLeScanner?.stopScan(scanCallback) } catch (_: SecurityException) { }
                status = "Escaneo finalizado: ${devices.size} dispositivo(s)."
            }, 10_000)
        } catch (e: SecurityException) {
            status = "Permiso Bluetooth insuficiente: ${e.message}"
        }
    }

    private fun connect(entry: BleEntry) {
        try {
            status = "Conectando a ${entry.name}…"
            connectedGatt?.close()
            connectedGatt = entry.device.connectGatt(this, false, object : BluetoothGattCallback() {
                override fun onConnectionStateChange(gatt: BluetoothGatt, statusCode: Int, newState: Int) {
                    runOnUiThread {
                        if (newState == BluetoothProfile.STATE_CONNECTED) {
                            status = "Conectado. Descubriendo servicios GATT…"
                            gatt.discoverServices()
                        } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                            status = "Desconectado."
                            gattRows.clear()
                        }
                    }
                }

                override fun onServicesDiscovered(gatt: BluetoothGatt, statusCode: Int) {
                    runOnUiThread {
                        gattRows.clear()
                        if (statusCode == BluetoothGatt.GATT_SUCCESS) {
                            gatt.services.forEach { service ->
                                gattRows.add("SERVICIO  ${service.uuid}")
                                service.characteristics.forEach { characteristic ->
                                    val p = characteristic.properties
                                    val flags = buildList {
                                        if (p and 0x02 != 0) add("READ")
                                        if (p and 0x04 != 0) add("WRITE NO RESPONSE")
                                        if (p and 0x08 != 0) add("WRITE")
                                        if (p and 0x10 != 0) add("NOTIFY")
                                        if (p and 0x20 != 0) add("INDICATE")
                                    }.joinToString(", ")
                                    gattRows.add("  ${characteristic.uuid}  [${flags.ifBlank { "sin propiedades conocidas" }}]")
                                }
                            }
                            status = "Conectado. ${gattRows.count { it.startsWith("SERVICIO") }} servicio(s) descubiertos. Solo lectura."
                        } else status = "Falló el descubrimiento GATT: $statusCode"
                    }
                }
            }, BluetoothDevice.TRANSPORT_LE)
        } catch (e: SecurityException) {
            status = "No se pudo conectar: permiso Bluetooth insuficiente."
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    Column(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("WATCH1 CONNECT MANAGER", style = MaterialTheme.typography.headlineSmall)
                        Text("Bluetooth LE · Exploración segura de solo lectura")
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = { requestPermissionsAndScan() }) { Text("Buscar") }
                            Button(onClick = {
                                try { connectedGatt?.disconnect(); status = "Desconectando…" }
                                catch (_: SecurityException) { status = "Permiso Bluetooth insuficiente." }
                            }) { Text("Desconectar") }
                        }
                        Text(status, style = MaterialTheme.typography.bodyMedium)
                        Text("Dispositivos encontrados", style = MaterialTheme.typography.titleMedium)
                        LazyColumn(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(devices, key = { it.address }) { entry ->
                                Card(Modifier.fillMaxWidth()) {
                                    Column(Modifier.padding(12.dp)) {
                                        Text(entry.name, style = MaterialTheme.typography.titleMedium)
                                        Text(entry.address, style = MaterialTheme.typography.bodySmall)
                                        Button(onClick = { connect(entry) }) { Text("Conectar y explorar GATT") }
                                    }
                                }
                            }
                            item { Text("Servicios y características GATT", style = MaterialTheme.typography.titleMedium) }
                            items(gattRows) { row -> Text(row, style = MaterialTheme.typography.bodySmall) }
                        }
                        Text("Las escrituras y comandos están deshabilitados: protocolo aún no identificado.",
                            style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        try { connectedGatt?.close() } catch (_: SecurityException) { }
        connectedGatt = null
        super.onDestroy()
    }
}
