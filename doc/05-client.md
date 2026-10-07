# 5. Cliente

`Stars.Client` descubre o recibe una dirección, conecta por el transporte elegido, decodifica Opus
y reproduce el audio.

## Pipeline

```
IAudioTransport.Connect ──handshake──► formato (48 kHz / 2 ch)
        │  FrameReceived(buffer, offset, length)   ← un paquete Opus
        ▼
AudioPlayer.Enqueue  ──►  OpusCodecFactory.CreateDecoder(...).Decode(...)
        │  PCM int16
        ▼
ApplyGain(volume)  ──►  IAudioSink.Write(pcm)
                              ├── WindowsAudioSink (WaveOut)
                              ├── AndroidAudioSink (AudioTrack)
                              └── NullAudioSink
```

## Transportes (slice `Features/Transport`)

`IAudioTransport` abstrae el canal de entrada. `StreamAudioTransport` implementa la lógica común
(leer handshake, bucle de recepción con framing) y las implementaciones concretas solo aportan el
`Stream`:

```csharp
public interface IAudioTransport : IDisposable
{
    string Name { get; }
    bool IsConnected { get; }
    int SampleRate { get; }
    int Channels { get; }
    int FrameSamplesPerChannel { get; }
    event Action<byte[], int, int>? FrameReceived;
    event Action<string>? Log;
    event Action? Disconnected;
    Task ConnectAsync(TransportEndpoint endpoint, CancellationToken cancellationToken = default);
    void Disconnect();
}
```

`TransportEndpoint` describe destino y tipo:

```csharp
TransportEndpoint.Wifi(host, port);        // TransportKind.Wifi
TransportEndpoint.Usb(port);               // → 127.0.0.1
TransportEndpoint.Bluetooth(address);      // TransportKind.Bluetooth
```

## `AudioPlayer` (slice `Features/Playback`)

Reproduce a través de un **pipeline con jitter buffer** que desacopla la recepción de red de la
reproducción:

1. Los paquetes recibidos entran en un `JitterBuffer` (adaptativo).
2. Un temporizador libera **exactamente un frame cada 20 ms**, lo decodifica y lo escribe al sink.
3. Si no hay frame (hueco de red), escribe **silencio** para que el reloj del dispositivo siga
   estable.

- `Volume` (0..1) se aplica como ganancia sobre cada frame decodificado.
- `SetOutput(...)` cambia la salida en caliente.

### `JitterBuffer` adaptativo

- Hace *pre-roll* de unos frames antes de arrancar (absorbe el jitter inicial).
- Estima el **jitter de llegada** (media móvil exponencial de la desviación respecto a 20 ms) y
  ajusta la profundidad objetivo entre `minDepth` y `maxDepth`: enlace estable → buffer pequeño
  (menos latencia); enlace irregular → buffer más profundo (menos cortes).
- Descarta los frames más antiguos por encima del máximo: la latencia nunca crece sin límite.
- Expone métricas: `BufferMilliseconds`, `JitterMilliseconds`, `Underruns`.

La UI muestra estas métricas ("Buffer N ms · jitter N ms") para diagnosticar la calidad del enlace.

### Estabilidad

La reproducción corre en un **bucle dedicado y único** (no en un `System.Threading.Timer`, cuyos
callbacks pueden solaparse y, si lanzan una excepción, cierran el proceso). Todo el bucle está
protegido con `try/catch`, y la app instala manejadores globales
(`AndroidEnvironment.UnhandledExceptionRaiser`, `TaskScheduler.UnobservedTaskException`) para que
ningún fallo de fondo cierre la aplicación al conectar.

## Sinks (slice `Features/Platforms`)

| Plataforma | Implementación | Detalle |
|-----------|----------------|---------|
| Windows | `WindowsAudioSink` | `WaveOut` + `BufferedWaveProvider` (250 ms, descarta lo viejo) |
| Android | `AndroidAudioSink` | `AudioTrack` en modo stream, buffer ~40 ms, `WriteMode.Blocking` |
| Otros | `NullAudioSink` | descarta el audio |

El `AudioTrack` se construye con `AudioAttributes` de tipo `Media`/`Music`, lo que da baja latencia
sin cortes.

## Selección de salida de audio

El usuario puede elegir por dónde suena, además del enrutado genérico del sistema:

- **Genérica de Android**: deja que el sistema decida (altavoz, auriculares, Bluetooth…). Es la
  opción **Predeterminado del sistema**.
- **Dispositivo concreto**: fija la reproducción a una salida concreta.

`AudioOutputs.List()` enumera los destinos disponibles:

| Plataforma | Enumeración | Selección |
|-----------|-------------|-----------|
| Android | `AudioManager.GetDevices(Outputs)` | `AudioTrack.Builder.SetPreferredDevice(...)` |
| Windows | `WaveOut.DeviceCount` / `GetCapabilities` | `WaveOut.DeviceNumber` |

`AudioPlayer.SetOutput(device)` cambia la salida **en caliente**: reconstruye solo el sink y
mantiene decodificador y buffers, sin cortar la conexión. En la app se elige desde un `Picker`
(cuando no estás reproduciendo) o al cambiar de dispositivo.

## Descubrimiento (slice `Features/Discovery`)

- `UdpDiscoveryClient.DiscoverAsync(timeout)` emite el sondeo y recoge respuestas.
- `BluetoothDiscovery.GetBondedDevices()` (Android) lista los dispositivos **emparejados**.
- `DiscoveredServer` lleva `Kind` para saber por qué transporte conectar.

## Calidad de audio configurable

El cliente puede pedir al servidor, por el **canal de control** (ver [3. Protocolo](03-protocol.md)),
los parámetros del codificador Opus:

- **Bitrate** manual (64–256 kbps) o **adaptativo** (se ajusta según jitter y pérdidas medidos).
- **FEC** (corrección de errores en banda) para ocultar pérdidas en enlaces inestables.
- **Porcentaje de pérdida estimado**, calculado a partir de los *underruns*.

`AppServices.ApplyAudioSettings()` envía el mensaje de control; el servidor lo aplica en vivo con
`OpusStreamingEngine.ApplySettings(...)`.

## Reconexión automática

En `AppServices`, si `Disconnected` se dispara y `AutoReconnectEnabled` está activo, se lanza un
bucle con **backoff** (1–6 s, hasta 8 intentos). Mientras dura, la UI muestra "Reconectando…".

## Notificación de reproducción (Android)

Mientras se reproduce audio, el cliente muestra una **notificación persistente** ("Stars ·
reproduciendo audio de …") en un canal de importancia baja (`stars_playback`). Se crea al conectar
(`INotificationService.ShowPlaying`) y se elimina al detener (`Clear`). En Android 13+ se solicita
el permiso `POST_NOTIFICATIONS` al conectar; si se deniega, la reproducción sigue igual.

## Animaciones de entrada

La animación escalonada de las tarjetas se ejecuta **solo la primera vez** que se abre la app
(`AppState.ConsumeIntro()` devuelve `true` una única vez por lanzamiento); al cambiar de pestaña no
se repite.

## `AppServices` (composition root)

- `StartAsync(endpoint)` crea el transporte según `Kind`, enlaza `FrameReceived` con el player y
  arranca la reproducción.
- `Volume` se delega al player.
- `Stop()` cancela reconexión, cierra el transporte y detiene el player.

Siguiente: [6. Transportes](06-transports.md).
