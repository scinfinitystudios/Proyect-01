package com.scinfinitystudios.watch1connect

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import java.util.UUID

private val Navy = Color(0xFF08111F)
private val Panel = Color(0xFF121F32)
private val PanelSoft = Color(0xFF192A40)
private val Cyan = Color(0xFF54D6D0)
private val Muted = Color(0xFF9CB0C7)
private val Good = Color(0xFF78E0AE)

private val WatchColors = darkColorScheme(
    primary = Cyan,
    onPrimary = Navy,
    secondary = Color(0xFF9BBAFF),
    background = Navy,
    onBackground = Color(0xFFF3F7FC),
    surface = Panel,
    onSurface = Color(0xFFF3F7FC),
    surfaceVariant = PanelSoft,
    onSurfaceVariant = Muted
)

data class BleEntry(val name: String, val address: String, val device: BluetoothDevice)

class MainActivity : ComponentActivity() {
    private val devices = mutableStateListOf<BleEntry>()
    private val gattRows = mutableStateListOf<String>()
    private val protocolRows = mutableStateListOf<String>()
    private val pendingReads = ArrayDeque<BluetoothGattCharacteristic>()
    private val pendingDescriptors = ArrayDeque<BluetoothGattDescriptor>()
    private var activeRead: BluetoothGattCharacteristic? = null
    private var status by mutableStateOf("Listo para buscar dispositivos cercanos.")
    private var isScanning by mutableStateOf(false)
    private var isConnected by mutableStateOf(false)
    private var connectedName by mutableStateOf("")
    private var connectedGatt: BluetoothGatt? = null
    private var selectedWallpaper by mutableStateOf<Bitmap?>(null)
    private var wallpaperMessage by mutableStateOf("Elige una fotografía para previsualizarla.")
    private val diagnosticResults = mutableStateListOf<Pair<String, String>>()
    private var diagnosticMessage by mutableStateOf("Pulsa VALIDAR FUNCIONES para ejecutar las comprobaciones disponibles.")

    private val wallpaperPicker = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri == null) return@registerForActivityResult
        try {
            contentResolver.openInputStream(uri)?.use { stream ->
                selectedWallpaper = BitmapFactory.decodeStream(stream)
            }
            wallpaperMessage = if (selectedWallpaper != null) {
                "Fotografía cargada. La transferencia al reloj aún requiere validar su protocolo."
            } else "No se pudo abrir esta imagen. Prueba con otra fotografía."
        } catch (e: Exception) {
            selectedWallpaper = null
            wallpaperMessage = "No se pudo cargar la fotografía: ${e.localizedMessage ?: "error desconocido"}"
        }
    }

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
            val name = result.scanRecord?.deviceName
                ?: try { device.name } catch (_: SecurityException) { null }
                ?: "Dispositivo BLE"
            if (devices.none { it.address == address }) {
                devices.add(BleEntry(name, address, device))
            }
        }

        override fun onScanFailed(errorCode: Int) {
            isScanning = false
            status = "No se pudo completar el escaneo (código $errorCode)."
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
            isScanning = true
            val scanner = bluetoothAdapter.bluetoothLeScanner
            if (scanner == null) {
                isScanning = false
                status = "El escáner Bluetooth LE no está disponible."
                return
            }
            scanner.startScan(scanCallback)
            window.decorView.postDelayed({
                stopScan()
                if (status.startsWith("Buscando")) {
                    status = "Búsqueda finalizada: ${devices.size} dispositivo(s) encontrado(s)."
                }
            }, 10_000)
        } catch (e: SecurityException) {
            isScanning = false
            status = "Permiso Bluetooth insuficiente: ${e.message}"
        }
    }

    private fun stopScan() {
        try {
            adapter?.bluetoothLeScanner?.stopScan(scanCallback)
        } catch (_: SecurityException) {
            status = "No se pudo detener el escaneo por falta de permiso."
        }
        isScanning = false
    }

    private fun connect(entry: BleEntry) {
        try {
            stopScan()
            status = "Conectando con ${entry.name}…"
            connectedGatt?.close()
            connectedGatt = entry.device.connectGatt(this, false, object : BluetoothGattCallback() {
                override fun onConnectionStateChange(gatt: BluetoothGatt, statusCode: Int, newState: Int) {
                    runOnUiThread {
                        if (newState == BluetoothProfile.STATE_CONNECTED && statusCode == BluetoothGatt.GATT_SUCCESS) {
                            isConnected = true
                            connectedName = entry.name
                            status = "Conexión establecida. Explorando servicios…"
                            gatt.discoverServices()
                        } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                            isConnected = false
                            connectedName = ""
                            status = if (statusCode == BluetoothGatt.GATT_SUCCESS) "Reloj desconectado."
                                else "Conexión finalizada (código $statusCode)."
                            gattRows.clear()
                        }
                    }
                }

                override fun onDescriptorWrite(
                    gatt: BluetoothGatt,
                    descriptor: BluetoothGattDescriptor,
                    statusCode: Int
                ) {
                    runOnUiThread {
                        protocolRows.add(
                            if (statusCode == BluetoothGatt.GATT_SUCCESS) "CCCD ${descriptor.characteristic.uuid}: listo"
                            else "CCCD ${descriptor.characteristic.uuid}: error GATT $statusCode"
                        )
                        writeNextDescriptor(gatt)
                    }
                }

                @Suppress("DEPRECATION")
                override fun onCharacteristicRead(
                    gatt: BluetoothGatt,
                    characteristic: BluetoothGattCharacteristic,
                    statusCode: Int
                ) {
                    runOnUiThread {
                        if (statusCode == BluetoothGatt.GATT_SUCCESS) {
                            val bytes = characteristic.value ?: byteArrayOf()
                            val hex = bytes.joinToString(" ") { "%02X".format(it) }
                            val decoded = bytes.toString(Charsets.UTF_8).filter { it.isLetterOrDigit() || it.isWhitespace() || it in "-_./:" }
                            protocolRows.add("READ ${characteristic.uuid}: ${hex.ifBlank { "(vacío)" }}${if (decoded.isNotBlank()) " | $decoded" else ""}")
                        } else {
                            protocolRows.add("READ ${characteristic.uuid}: error GATT $statusCode")
                        }
                        activeRead = null
                        readNextSafeCharacteristic(gatt)
                    }
                }

                @Suppress("DEPRECATION")
                override fun onCharacteristicChanged(
                    gatt: BluetoothGatt,
                    characteristic: BluetoothGattCharacteristic
                ) {
                    val bytes = characteristic.value ?: byteArrayOf()
                    val hex = bytes.joinToString(" ") { "%02X".format(it) }
                    runOnUiThread {
                        protocolRows.add("NOTIFY ${characteristic.uuid}: ${hex.ifBlank { "(vacío)" }}")
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
                                        if (p and 0x02 != 0) add("LECTURA")
                                        if (p and 0x04 != 0) add("ESCRITURA SIN RESPUESTA")
                                        if (p and 0x08 != 0) add("ESCRITURA")
                                        if (p and 0x10 != 0) add("NOTIFY")
                                        if (p and 0x20 != 0) add("INDICATE")
                                    }.joinToString(" · ")
                                    gattRows.add("  ${characteristic.uuid}\n  ${flags.ifBlank { "Propiedades no identificadas" }}")
                                }
                            }
                            status = "Servicios detectados. Analizando datos estándar y escuchando notificaciones…"
                            beginSafeProtocolInspection(gatt)
                        } else {
                            status = "No se pudieron descubrir los servicios GATT (código $statusCode)."
                        }
                    }
                }
            }, BluetoothDevice.TRANSPORT_LE)
        } catch (_: SecurityException) {
            status = "No se pudo conectar: falta permiso Bluetooth."
        }
    }

    private fun beginSafeProtocolInspection(gatt: BluetoothGatt) {
        pendingReads.clear()
        pendingDescriptors.clear()
        activeRead = null
        protocolRows.clear()
        val readableStandardIds = setOf(
            UUID.fromString("00002a19-0000-1000-8000-00805f9b34fb"),
            UUID.fromString("00002a27-0000-1000-8000-00805f9b34fb"),
            UUID.fromString("00002a26-0000-1000-8000-00805f9b34fb"),
            UUID.fromString("00002a28-0000-1000-8000-00805f9b34fb")
        )
        gatt.services.forEach { service ->
            service.characteristics.forEach { characteristic ->
                val properties = characteristic.properties
                if (properties and BluetoothGattCharacteristic.PROPERTY_READ != 0 &&
                    characteristic.uuid in readableStandardIds
                ) pendingReads.add(characteristic)

                if (properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0) {
                    val enabled = gatt.setCharacteristicNotification(characteristic, true)
                    val cccd = characteristic.getDescriptor(
                        UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
                    )
                    if (enabled && cccd != null) {
                        @Suppress("DEPRECATION")
                        cccd.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                        pendingDescriptors.add(cccd)
                    } else {
                        protocolRows.add("LISTEN ${characteristic.uuid}: no compatible descriptor")
                    }
                }
            }
        }
        protocolRows.add("INFO: número de serie excluido por privacidad.")
        protocolRows.add("INFO: no se envían comandos propietarios ni escrituras de datos.")
        writeNextDescriptor(gatt)
    }

    @Suppress("DEPRECATION")
    private fun writeNextDescriptor(gatt: BluetoothGatt) {
        if (pendingDescriptors.isEmpty()) {
            readNextSafeCharacteristic(gatt)
            return
        }
        val descriptor = pendingDescriptors.removeFirst()
        val started = try { gatt.writeDescriptor(descriptor) } catch (_: SecurityException) { false }
        if (!started) {
            protocolRows.add("CCCD ${descriptor.characteristic.uuid}: no se pudo iniciar")
            writeNextDescriptor(gatt)
        }
    }

    @Suppress("DEPRECATION")
    private fun readNextSafeCharacteristic(gatt: BluetoothGatt) {
        if (activeRead != null || pendingReads.isEmpty()) {
            if (activeRead == null && pendingReads.isEmpty()) {
                status = "Análisis pasivo terminado. Esperando datos del reloj…"
            }
            return
        }
        val next = pendingReads.removeFirst()
        activeRead = next
        val started = try { gatt.readCharacteristic(next) } catch (_: SecurityException) { false }
        if (!started) {
            protocolRows.add("READ ${next.uuid}: no se pudo iniciar")
            activeRead = null
            readNextSafeCharacteristic(gatt)
        }
    }

    private fun runDiagnostics() {
        diagnosticResults.clear()
        diagnosticMessage = "Comprobación completada. Los resultados distinguen funciones detectables de funciones que requieren protocolo."
        val bluetoothOn = try { adapter?.isEnabled == true } catch (_: SecurityException) { false }
        diagnosticResults.add("Bluetooth del teléfono" to if (bluetoothOn) "VALIDADO · Activado" else "NO DISPONIBLE · Activa Bluetooth")
        val permissionsOk = hasPermissions()
        diagnosticResults.add("Permisos Bluetooth" to if (permissionsOk) "VALIDADO · Concedidos" else "PENDIENTE · Concede permisos de dispositivos cercanos")
        val gatt = connectedGatt
        val connected = isConnected && gatt != null
        diagnosticResults.add("Conexión con Watch1" to if (connected) "VALIDADO · Conectado" else "SIN CONEXIÓN · Conecta el reloj primero")
        val services = if (connected) try { gatt!!.services } catch (_: SecurityException) { emptyList() } else emptyList()
        val allCharacteristics = services.flatMap { it.characteristics }
        val batteryUuid = UUID.fromString("00002a19-0000-1000-8000-00805f9b34fb")
        val infoUuids = setOf(
            UUID.fromString("00002a26-0000-1000-8000-00805f9b34fb"),
            UUID.fromString("00002a27-0000-1000-8000-00805f9b34fb"),
            UUID.fromString("00002a28-0000-1000-8000-00805f9b34fb")
        )
        val hasBattery = allCharacteristics.any { it.uuid == batteryUuid && it.properties and BluetoothGattCharacteristic.PROPERTY_READ != 0 }
        val hasInfo = allCharacteristics.any { it.uuid in infoUuids && it.properties and BluetoothGattCharacteristic.PROPERTY_READ != 0 }
        val hasNotify = allCharacteristics.any { it.properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0 }
        diagnosticResults.add("Lectura de batería" to when {
            !connected -> "SIN CONEXIÓN · No se puede comprobar"
            hasBattery -> "DISPONIBLE · Característica estándar detectada; lectura pendiente/en curso"
            else -> "NO DETECTADA · El reloj no expone la característica estándar"
        })
        diagnosticResults.add("Información del dispositivo" to when {
            !connected -> "SIN CONEXIÓN · No se puede comprobar"
            hasInfo -> "DISPONIBLE · Características estándar detectadas"
            else -> "NO DETECTADA · No se encontraron datos estándar compatibles"
        })
        diagnosticResults.add("Canal de notificaciones BLE" to when {
            !connected -> "SIN CONEXIÓN · No se puede comprobar"
            hasNotify -> "DISPONIBLE · Hay características NOTIFY; no confirma avisos del teléfono"
            else -> "NO DETECTADO · No hay características NOTIFY"
        })
        val notificationAccess = try {
            Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
                ?.split(":")
                ?.any { it.contains(packageName, ignoreCase = true) } == true
        } catch (_: Exception) { false }
        diagnosticResults.add("Acceso a notificaciones del teléfono" to if (notificationAccess) {
            "VALIDADO · Acceso concedido"
        } else {
            "PENDIENTE · Acceso especial no concedido"
        })
        diagnosticResults.add("Llamadas, alarmas, música y sincronización" to "PENDIENTE · Requiere identificar y probar comandos compatibles")
        diagnosticResults.add("Transferencia de fondo al reloj" to if (selectedWallpaper != null) {
            "PENDIENTE · Foto cargada en el teléfono; transferencia no probada"
        } else {
            "PENDIENTE · Selecciona una foto; protocolo de transferencia no validado"
        })
        diagnosticResults.add("Carátulas y firmware" to "BLOQUEADO POR SEGURIDAD · No se envían comandos propietarios desconocidos")
    }

    private fun disconnect() {
        try {
            connectedGatt?.disconnect()
            status = "Desconectando del reloj…"
        } catch (_: SecurityException) {
            status = "No se pudo desconectar: falta permiso Bluetooth."
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = WatchColors) {
                Surface(modifier = Modifier.fillMaxSize(), color = Navy) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                Brush.verticalGradient(
                                    listOf(Color(0xFF10243A), Navy, Color(0xFF070D17))
                                )
                            )
                    ) {
                        Column(
                            modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 18.dp),
                            verticalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            HeaderSection()
                            ConnectionStatusCard(
                                connected = isConnected,
                                scanning = isScanning,
                                deviceName = connectedName,
                                status = status
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                Button(
                                    onClick = { requestPermissionsAndScan() },
                                    enabled = !isScanning,
                                    modifier = Modifier.weight(1f).height(50.dp),
                                    shape = RoundedCornerShape(16.dp),
                                    colors = ButtonDefaults.buttonColors(
                                        containerColor = Cyan,
                                        contentColor = Navy
                                    )
                                ) {
                                    Text(if (isScanning) "BUSCANDO…" else "BUSCAR RELOJ", fontWeight = FontWeight.Bold)
                                }
                                OutlinedButton(
                                    onClick = { if (isScanning) stopScan() else disconnect() },
                                    modifier = Modifier.height(50.dp),
                                    shape = RoundedCornerShape(16.dp),
                                    border = BorderStroke(1.dp, Color(0xFF38516B))
                                ) {
                                    Text(if (isScanning) "DETENER" else "DESCONECTAR", fontWeight = FontWeight.SemiBold)
                                }
                            }

                            SectionHeading("Dispositivos cercanos", "${devices.size} encontrados")
                            LazyColumn(
                                modifier = Modifier.weight(1f),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                item {
                                    WallpaperSection(
                                        bitmap = selectedWallpaper,
                                        message = wallpaperMessage,
                                        onChoose = { wallpaperPicker.launch("image/*") },
                                        onClear = {
                                            selectedWallpaper = null
                                            wallpaperMessage = "Elige una fotografía para previsualizarla."
                                        }
                                    )
                                }
                                item {
                                    DiagnosticSection(
                                        message = diagnosticMessage,
                                        results = diagnosticResults,
                                        onValidate = { runDiagnostics() }
                                    )
                                }
                                item { FeatureSections(connected = isConnected) }
                                if (devices.isEmpty()) {
                                    item {
                                        EmptyDevicesCard(scanning = isScanning)
                                    }
                                }
                                items(devices, key = { it.address }) { entry ->
                                    DeviceCard(entry = entry, onConnect = { connect(entry) })
                                }
                                if (gattRows.isNotEmpty()) {
                                    item {
                                        Spacer(Modifier.height(4.dp))
                                        SectionHeading("Explorador GATT", "${gattRows.count { it.startsWith("SERVICIO") }} servicios")
                                    }
                                    items(gattRows) { row -> GattRow(row) }
                                }
                                if (protocolRows.isNotEmpty()) {
                                    item {
                                        Spacer(Modifier.height(4.dp))
                                        SectionHeading("Analizador de protocolo", "${protocolRows.size} eventos")
                                    }
                                    items(protocolRows) { row -> GattRow(row) }
                                }
                                item {
                                    SafetyNote()
                                    Spacer(Modifier.height(10.dp))
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onDestroy() {
        try {
            adapter?.bluetoothLeScanner?.stopScan(scanCallback)
            connectedGatt?.close()
        } catch (_: SecurityException) { }
        connectedGatt = null
        super.onDestroy()
    }
}

@androidx.compose.runtime.Composable
private fun HeaderSection() {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(42.dp).background(
                    Brush.linearGradient(listOf(Cyan, Color(0xFF6B9FFF))),
                    RoundedCornerShape(14.dp)
                ),
                contentAlignment = Alignment.Center
            ) {
                Text("W1", color = Navy, fontWeight = FontWeight.Black, fontSize = 17.sp)
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Text("WATCH1", fontSize = 23.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.4.sp)
                Text("CONNECT MANAGER", fontSize = 11.sp, color = Muted, letterSpacing = 2.2.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.weight(1f))
            Surface(color = Color(0xFF173A3C), shape = CircleShape) {
                Text("BETA", color = Cyan, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 11.dp, vertical = 6.dp))
            }
        }
        Text(
            "Gestiona y diagnostica tu conexión Bluetooth LE.",
            color = Muted,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

@androidx.compose.runtime.Composable
private fun ConnectionStatusCard(connected: Boolean, scanning: Boolean, deviceName: String, status: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = Panel),
        border = BorderStroke(1.dp, Color(0xFF263B52))
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(9.dp).background(
                        when {
                            connected -> Good
                            scanning -> Cyan
                            else -> Color(0xFF71849B)
                        }, CircleShape
                    )
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    when {
                        connected -> "RELOJ CONECTADO"
                        scanning -> "ESCANEANDO DISPOSITIVOS"
                        else -> "ESTADO DE CONEXIÓN"
                    },
                    color = when {
                        connected -> Good
                        scanning -> Cyan
                        else -> Muted
                    },
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.2.sp
                )
            }
            Text(
                when {
                    connected -> deviceName.ifBlank { "Watch1" }
                    scanning -> "Buscando tu Watch1"
                    else -> "Listo para conectar"
                },
                fontSize = 21.sp,
                fontWeight = FontWeight.Bold
            )
            Text(status, color = Muted, style = MaterialTheme.typography.bodySmall)
            if (scanning) LinearProgressIndicator(
                modifier = Modifier.fillMaxWidth(),
                color = Cyan,
                trackColor = PanelSoft
            )
        }
    }
}

@androidx.compose.runtime.Composable
private fun SectionHeading(title: String, detail: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(title, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.weight(1f))
        Text(detail, color = Muted, fontSize = 11.sp)
    }
}

@androidx.compose.runtime.Composable
private fun DeviceCard(entry: BleEntry, onConnect: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Panel),
        border = BorderStroke(1.dp, Color(0xFF263B52))
    ) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier.size(38.dp).background(PanelSoft, RoundedCornerShape(12.dp)),
                    contentAlignment = Alignment.Center
                ) { Text("⌚", fontSize = 19.sp) }
                Spacer(Modifier.width(11.dp))
                Column(Modifier.weight(1f)) {
                    Text(entry.name, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    Text(entry.address, color = Muted, fontSize = 11.sp)
                }
                Surface(color = Color(0xFF173A3C), shape = CircleShape) {
                    Text("BLE", color = Cyan, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp))
                }
            }
            FilledTonalButton(
                onClick = onConnect,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.filledTonalButtonColors(containerColor = PanelSoft, contentColor = Cyan)
            ) {
                Text("CONECTAR Y EXPLORAR", fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun EmptyDevicesCard(scanning: Boolean) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Panel.copy(alpha = 0.8f)),
        border = BorderStroke(1.dp, Color(0xFF263B52))
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(vertical = 26.dp, horizontal = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text("⌚", fontSize = 30.sp)
            Text(if (scanning) "Buscando dispositivos…" else "Aún no hay dispositivos", fontWeight = FontWeight.Bold)
            Text(
                if (scanning) "Mantén el reloj encendido y cerca del teléfono."
                else "Pulsa «Buscar reloj» para comenzar el escaneo Bluetooth.",
                color = Muted,
                fontSize = 12.sp
            )
        }
    }
}

@androidx.compose.runtime.Composable
private fun GattRow(row: String) {
    val isService = row.startsWith("SERVICIO")
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(13.dp),
        colors = CardDefaults.cardColors(containerColor = if (isService) PanelSoft else Panel)
    ) {
        Text(
            row,
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 11.dp),
            color = if (isService) Cyan else Muted,
            fontSize = if (isService) 11.sp else 10.sp,
            fontWeight = if (isService) FontWeight.Bold else FontWeight.Normal,
            lineHeight = 16.sp
        )
    }
}

@androidx.compose.runtime.Composable
private fun SafetyNote() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF302817)),
        border = BorderStroke(1.dp, Color(0xFF62502B))
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text("MODO SEGURO · SOLO LECTURA", color = Color(0xFFFFD58A), fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp)
            Text(
                "Las escrituras y los comandos todavía no están habilitados. Primero debemos identificar y validar el protocolo del Watch1.",
                color = Color(0xFFD8C9A8),
                fontSize = 11.sp,
                lineHeight = 16.sp
            )
        }
    }
}


@androidx.compose.runtime.Composable
private fun WallpaperSection(
    bitmap: Bitmap?,
    message: String,
    onChoose: () -> Unit,
    onClear: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Panel),
        border = BorderStroke(1.dp, Color(0xFF263B52))
    ) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SectionHeading("Personalizar fondo", "Galería")
            Text("Selecciona una foto de tu teléfono y revisa la vista previa.", color = Muted, fontSize = 12.sp)
            if (bitmap != null) {
                Image(
                    bitmap = bitmap.asImageBitmap(),
                    contentDescription = "Vista previa del fondo seleccionado",
                    modifier = Modifier.fillMaxWidth().height(180.dp)
                )
            } else {
                Box(
                    Modifier.fillMaxWidth().height(110.dp)
                        .background(PanelSoft, RoundedCornerShape(14.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("⌚  Vista previa del fondo", color = Muted, fontSize = 13.sp)
                }
            }
            Text(message, color = Muted, fontSize = 11.sp, lineHeight = 15.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = onChoose,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(12.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Cyan, contentColor = Navy)
                ) { Text("ELEGIR FOTO", fontWeight = FontWeight.Bold, fontSize = 11.sp) }
                if (bitmap != null) {
                    OutlinedButton(onClick = onClear, shape = RoundedCornerShape(12.dp)) {
                        Text("QUITAR", fontSize = 11.sp)
                    }
                }
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun DiagnosticSection(
    message: String,
    results: List<Pair<String, String>>,
    onValidate: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Panel),
        border = BorderStroke(1.dp, Color(0xFF263B52))
    ) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SectionHeading("Diagnóstico automático", "Pruebas seguras")
            Text(
                "Comprueba Bluetooth, conexión, permisos y servicios que el reloj realmente expone. Las funciones propietarias no se marcarán como compatibles sin pruebas.",
                color = Muted,
                fontSize = 11.sp,
                lineHeight = 16.sp
            )
            Button(
                onClick = onValidate,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Cyan, contentColor = Navy)
            ) {
                Text("VALIDAR FUNCIONES", fontWeight = FontWeight.Bold)
            }
            Text(message, color = Muted, fontSize = 10.sp)
            results.forEach { (name, result) ->
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(name, color = Color(0xFFF3F7FC), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text(result, color = when {
                        result.startsWith("VALIDADO") || result.startsWith("DISPONIBLE") -> Good
                        result.startsWith("PENDIENTE") || result.startsWith("SIN CONEXIÓN") -> Color(0xFFFFD58A)
                        else -> Muted
                    }, fontSize = 10.sp, lineHeight = 14.sp)
                }
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun FeatureSections(connected: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        SectionHeading("Control del reloj", if (connected) "Conectado" else "Requiere conexión")
        FeatureCard(
            title = "Notificaciones y llamadas",
            detail = "Preparado para integrar avisos de WhatsApp, mensajes y llamadas cuando se valide el servicio compatible.",
            status = "POR VALIDAR"
        )
        FeatureCard(
            title = "Alarmas, hora y sincronización",
            detail = "La app podrá mostrar controles cuando identifiquemos los comandos admitidos por el Watch1.",
            status = "POR VALIDAR"
        )
        FeatureCard(
            title = "Música, clima y encontrar teléfono",
            detail = "Funciones sujetas a compatibilidad del firmware y al protocolo Bluetooth del reloj.",
            status = "POR VALIDAR"
        )
        SectionHeading("Herramientas", "Diagnóstico")
        FeatureCard(
            title = "Batería y datos del dispositivo",
            detail = "Lectura de características GATT estándar disponibles. El explorador actual muestra los servicios detectados.",
            status = if (connected) "EXPLORACIÓN DISPONIBLE" else "ESPERANDO RELOJ"
        )
        FeatureCard(
            title = "Carátulas y widgets",
            detail = "Diseños y elementos visuales personalizados; la aplicación verificará primero qué formatos acepta el reloj.",
            status = "POR VALIDAR"
        )
        FeatureCard(
            title = "Firmware y copias de seguridad",
            detail = "No se enviarán actualizaciones ni escrituras propietarias sin documentación y validación del fabricante.",
            status = "BLOQUEADO POR SEGURIDAD"
        )
    }
}

@androidx.compose.runtime.Composable
private fun FeatureCard(title: String, detail: String, status: String) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(15.dp),
        colors = CardDefaults.cardColors(containerColor = Panel),
        border = BorderStroke(1.dp, Color(0xFF263B52))
    ) {
        Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, modifier = Modifier.weight(1f), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                Text(status, color = Cyan, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
            Text(detail, color = Muted, fontSize = 11.sp, lineHeight = 15.sp)
        }
    }
}
