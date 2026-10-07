# 4. Servidor

`Stars.Server` captura la salida de audio del sistema, la codifica en Opus y la emite por todos
los transportes activos.

## Pipeline

```
WasapiRecorder (loopback)          WindowsSystemAudioCapture
        │  PCM (formato del mix)
        ▼
MediaFoundationResampler  ──►  PCM 48 kHz / 16 bit / estéreo
        │
        ▼
CircularByteBuffer  (≈1 s de margen, descarta lo más viejo)
        │
        ▼
OpusStreamingEngine  (reloj de 20 ms → 1 frame por tick)
        │  FrameEncoded(buffer, offset, length)
        ▼
AppServices  (prefija longitud)
        ├──► TcpAudioServer.Broadcast
        └──► BluetoothAudioServer.Broadcast
```

## `WindowsSystemAudioCapture` (slice `Features/Platforms`)

Usa el API moderno de **NAudio 3**:

```csharp
var recorder = new WasapiRecorderBuilder()
    .WithDevice(renderDevice)      // endpoint de render por defecto
    .WithLoopbackCapture()         // captura lo que suena, no el micrófono
    .WithSharedMode()
    .WithEventSync()
    .Build();
```

El evento `DataAvailable` es **zero-copy** (recibe un `ReadOnlySpan<byte>` válido solo durante el
callback) y se copia a un `BufferedWaveProvider`. El resampler a 48 kHz estéreo se lee desde una
tarea con *pacing* de ~5 ms y se entrega al motor.

> En otras plataformas se usa `UnsupportedSystemAudioCapture`, que solo registra un aviso.

## `OpusStreamingEngine` (slice `Features/Capture`)

- Crea el codificador con `OpusCodecFactory.CreateEncoder(48000, 2, OPUS_APPLICATION_AUDIO)`.
- Configuración: `Bitrate = 128000`, `Complexity = 10`, `UseVBR = true`,
  `SignalType = OPUS_SIGNAL_MUSIC`.
- Un **reloj** compara el tiempo transcurrido con las muestras emitidas y produce exactamente un
  frame por cada 20 ms; si no hay audio disponible, rellena con **silencio** (así el cliente nunca
  se queda sin datos y no se oyen cortes).
- Expone `FrameEncoded` (se dispara con el paquete Opus) y `EncodedFrames` (contador).

## `TcpAudioServer` (slice `Features/Streaming`)

- `TcpListener` en `IPAddress.Any` y el puerto configurado.
- Por cada cliente: envía el handshake y arranca una **cola propia** (`BlockingCollection`, 32
  frames) con una tarea de escritura. Si la cola se llena, se descarta el cliente lento.
- `Broadcast(frame, offset, length)` recorre los clientes y encola una copia.
- Eventos: `ClientCountChanged`, `Log`.

## `BluetoothAudioServer` (slice `Features/Streaming`, Windows)

- Publica un servicio **RFCOMM/SPP** con `BluetoothListener` (UUID de `StreamProtocol`) y nombre
  `StarsAudioService`.
- Igual patrón que el TCP: cola de 16 frames por cliente (Bluetooth tiene menos ancho de banda).
- `IsSupported` consulta `BluetoothRadio.Default`.

## `UdpDiscoveryResponder` (slice `Features/Discovery`)

Escucha en `0.0.0.0:45891`, valida el prefijo `STARS_DISCOVER_V1` y responde con nombre de equipo,
IP y puerto TCP.

## Silencio del sistema (slice `Features/Platforms`)

`ISystemVolume` / `WindowsSystemVolume` usan `MMDeviceEnumerator` + `AudioEndpointVolume.Mute`
para silenciar el **endpoint de render por defecto**. `AppServices.SetSystemMuted(bool)` lo aplica
y se restaura automáticamente al detener el streaming o al disponer los servicios.

## `UsbTunnel` (slice `Features/Connectivity`)

Ejecuta `adb reverse tcp:PORT tcp:PORT` para que un Android conectado por USB alcance el servidor
en `127.0.0.1`. Localiza `adb` en el `PATH` o en
`%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`.

## `AppServices` (composition root)

Expone `Start(port)` / `StopAsync()`, arranca y para cada transporte, agrega el conteo de clientes
(TCP + Bluetooth) y reenvía los frames codificados a todos los transportes.

Siguiente: [5. Cliente](05-client.md).
