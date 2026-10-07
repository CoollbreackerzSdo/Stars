# 6. Transportes

El cliente soporta tres formas de alcanzar al servidor. Todas transportan **exactamente el mismo**
stream Opus, descrito en [3. Protocolo](03-protocol.md).

## Resumen

| Transporte | Cuándo usarlo | Servidor | Cliente | Requisitos |
|-----------|----------------|----------|---------|------------|
| Wi-Fi (TCP) | Red local normal | ✅ | ✅ | Misma red; puerto 45890 permitido |
| USB (adb reverse) | Sin Wi-Fi, con cable | ✅ | ✅ | Depuración USB + adb en el PC |
| Bluetooth Classic | Sin Wi-Fi ni cable | ✅ Windows | ✅ Android | Emparejamiento previo |

---

## Wi-Fi (TCP)

- Servidor: `TcpAudioServer` en `IPAddress.Any:45890`.
- Cliente: `TcpAudioTransport` conecta a `host:port`. `NoDelay = true` para minimizar latencia.
- Descubrimiento automático por UDP (ver protocolo).

**Ventajas**: máximo ancho de banda y calidad, varios clientes. **Límite**: depende de la red.

---

## USB (adb reverse)

El cable USB no transporta TCP por sí solo; `adb` crea el puente:

```
[Android] 127.0.0.1:45890 ──USB/adb──► [PC] 127.0.0.1:45890 (Stars.Server)
```

Pasos:

1. En el dispositivo Android activa **Opciones de desarrollador → Depuración USB** y conéctalo.
2. En el servidor, `AppServices.Start` llama a `UsbTunnel.Start(Port)`, que ejecuta:
   ```
   adb reverse tcp:45890 tcp:45890
   ```
3. En el cliente, selecciona **USB** y conecta (usa `127.0.0.1`).

`UsbTunnel` localiza `adb` en el `PATH` o en
`%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`.

> `adb reverse` se pierde si se reconecta el cable; vuelve a pulsar el interruptor USB para
> reinstalarlo.

---

## Bluetooth Classic (RFCOMM / SPP)

Servidor (`BluetoothAudioServer`, Windows) y cliente (`BluetoothAudioTransport`, Android).

- **UUID del servicio**: `5A7C4B60-53E1-4B8E-9C2A-4C6F9F0A1B2C`.
- **Nombre SDP**: `StarsAudioService`.
- Servidor: `BluetoothListener` publica el servicio y acepta clientes.
- Cliente: obtiene el `BluetoothAdapter` vía `BluetoothManager` (API moderna), busca el servicio
  RFCOMM y conecta. El socket expone `InputStream`/`OutputStream`, unidos por `DuplexStream`.

Calidad: RFCOMM sostiene cómodamente los ~128 kbps de Opus. La cola por cliente se limita a 16
frames para no acumular latencia si el enlace es lento.

**Preparación**: empareja PC y móvil primero; luego en el cliente pulsa **Buscar** (lista los
dispositivos emparejados) o escribe la dirección MAC.

**Permisos Android** (ya en `Platforms/Android/AndroidManifest.xml`):
`BLUETOOTH`/`BLUETOOTH_ADMIN` (≤ Android 11) y `BLUETOOTH_CONNECT`/`BLUETOOTH_SCAN` (12+).

**Capacidad Windows** (ya en `Platforms/Windows/Package.appxmanifest`): `<DeviceCapability
Name="bluetooth" />`.

Siguiente: [7. Interfaz y animaciones](07-ui-and-animations.md).
