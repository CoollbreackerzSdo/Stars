# 2. Arquitectura

## Estilo: vertical slices

En lugar de organizar por tipo técnico (`Services/`, `Models/`, `Helpers/`), cada proyecto se
organiza por **funcionalidad** (un *slice* vertical por capacidad). Así, todo lo que compone una
función —interfaz, implementaciones por plataforma y orquestación— vive junto.

Sobre los slices hay un **proyecto compartido** (`Stars.Shared`), una biblioteca `net11.0` sin
dependencias de UI que contiene el contrato de red y utilidades comunes, referenciada por ambas
apps. Encima está la capa de **UI** (`Components/`, `MainViewModel`, `MainPage`) que enlaza con el
dominio a través de un **composition root** (`AppServices`).

### Stars.Shared (biblioteca)

```
Stars.Shared/
├── StreamProtocol.cs         # contrato de red (handshake, framing, control, descubrimiento)
├── CircularByteBuffer.cs     # buffer para PCM en tiempo real
├── DuplexStream.cs           # une InputStream + OutputStream en un Stream
├── NetworkHelper.cs          # IPs locales / nombre de equipo
└── AnimationExtensions.cs    # helpers de animación de UI (AnimateIn / Pop / Bounce)
```

### Servidor

```
Stars.Server/
├── Features/                     # Slices
│   ├── Platforms/                #   abstracción de captura y volumen + impl. Windows
│   ├── Capture/                  #   OpusStreamingEngine
│   ├── Streaming/                #   TcpAudioServer + BluetoothAudioServer
│   ├── Discovery/                #   UdpDiscoveryResponder
│   └── Connectivity/             #   UsbTunnel (adb reverse) + FirewallHelper
├── Components/                   # Controles XAML reutilizables
├── AppServices.cs                # Composition root
├── MainViewModel.cs              # MVVM (CommunityToolkit.Mvvm)
└── MainPage.xaml(.cs)            # Vistas (pestañas)
```

### Cliente

```
Stars.Client/
├── Shared/
│   └── LevelToHeightConverter.cs #   nivel → altura (ecualizador, específico del cliente)
├── Features/
│   ├── Platforms/                #   IAudioSink + impl. Windows / Android / Null + AudioOutputs
│   ├── Transport/                #   IAudioTransport + TCP / Bluetooth + StreamAudioTransport
│   ├── Playback/                 #   AudioPlayer + JitterBuffer
│   └── Discovery/                #   UdpDiscoveryClient, BluetoothDiscovery
├── Components/
├── AppServices.cs
├── MainViewModel.cs
└── MainPage.xaml(.cs)            # Vistas (pestañas)
```

## El código compartido

`Stars.Shared` es la **única fuente de verdad** para lo que usan ambas apps: `StreamProtocol` (el
contrato de red, incluido el descubrimiento UDP y el canal de control), `CircularByteBuffer`,
`DuplexStream`, `NetworkHelper` y `AnimationExtensions` (helpers de animación). Se referencia como
`ProjectReference` desde `Stars.Server` y `Stars.Client`, de modo que ya **no hay copias
duplicadas** que mantener en sincronía.

Queda fuera de `Stars.Shared` lo que es específico de una sola app: la captura/reproducción de
audio, los transportes, la lógica de ventana y los convertidores de UI del cliente.

## Abstracciones de plataforma

El código común nunca llama a APIs nativas directamente; usa interfaces con una fábrica que
resuelve la implementación por sistema en tiempo de compilación:

| Interfaz | Servidor | Cliente |
|----------|----------|---------|
| `ISystemAudioCapture` | captura loopback | — |
| `ISystemVolume` | silencio del render por defecto | — |
| `IAudioSink` | — | reproducción PCM |
| `IAudioTransport` | — | TCP / Bluetooth |

Ejemplo (servidor):

```csharp
public interface ISystemAudioCapture : IDisposable
{
    AudioFormat OutputFormat { get; }
    bool IsSupported { get; }
    event Action<byte[], int>? DataAvailable;
    event Action<string>? Log;
    void Start();
    void Stop();
}
```

Las implementaciones por SO se eligen con `#if WINDOWS` / `#if ANDROID` y constantes definidas en
el `.csproj` según el `TargetFramework`.

## Composition roots

`AppServices` es el único sitio que conoce todos los slices y los conecta. La UI solo habla con
`AppServices`; nunca instancia servidores o transportes directamente.

### Servidor

```
OpusStreamingEngine ──FrameEncoded──► AppServices ──► TcpAudioServer.Broadcast
                                                  └─► BluetoothAudioServer.Broadcast
```

### Cliente

```
IAudioTransport ──FrameReceived──► AudioPlayer ──► IAudioSink
```

## Concurrencia

- Cada cliente conectado (TCP o Bluetooth) tiene **su propia cola** y **su propia tarea de
  escritura**: un cliente lento nunca bloquea a los demás; si su cola se llena se descarta.
- La captura -> buffer circular -> codificador se apoya en un reloj para emitir **exactamente un
  frame de 20 ms** por tick, rellenando con silencio durante pausas.
- El cliente escribe en el `AudioTrack` en modo **bloqueante**, lo que aplica contrapresión natural.

Siguiente: [3. Protocolo de streaming](03-protocol.md).
