# Stars

[![Versión](https://img.shields.io/badge/versi%C3%B3n-1.0.0-7c5cff)](#)
[![GitHub](https://img.shields.io/badge/GitHub-CoolbreackerzSdo-181717?logo=github&logoColor=white)](https://github.com/CoollbreackerzSdo)

Stars es un sistema de **streaming de audio del sistema en tiempo real**. El servidor captura
toda la salida de audio de un PC (Windows, vía WASAPI loopback), la comprime con **Opus** y la
envía a un dispositivo cliente (Android) que la reproduce **en vivo**, con tres transportes
posibles: **Wi-Fi (TCP)**, **USB (adb reverse)** y **Bluetooth Classic (RFCOMM/SPP)**.

> **Versión 1.0.0**
>
> 🎯 **Próximo foco principal: mejorar la calidad del audio en todos los conectores.**
> Tras la 1.0.0, el objetivo central es elevar la calidad de audio de forma **uniforme en Wi-Fi,
> USB y Bluetooth**. Ver [10. Hoja de ruta](doc/10-roadmap.md).

```
┌─────────────────────────────┐        Opus @ 48 kHz estéreo         ┌──────────────────────────┐
│        Stars.Server         │ ───────────────────────────────────► │       Stars.Client        │
│  (Windows · captura + enc.) │   Wi-Fi / USB / Bluetooth            │  (Android · decod. + play)│
└─────────────────────────────┘                                       └──────────────────────────┘
```

---

## Índice de la documentación

| Documento | Contenido |
|-----------|-----------|
| [1. Visión general](doc/01-overview.md) | Qué resuelve, casos de uso y capacidades. |
| [2. Arquitectura](doc/02-architecture.md) | Vertical slices, kernel compartido y composition roots. |
| [3. Protocolo de streaming](doc/03-protocol.md) | Handshake, framing de frames y descubrimiento UDP. |
| [4. Servidor](doc/04-server.md) | Captura WASAPI, motor Opus, broadcast y silencio del sistema. |
| [5. Cliente](doc/05-client.md) | Transportes de entrada, decodificador y control de volumen. |
| [6. Transportes](doc/06-transports.md) | Wi-Fi, USB (adb reverse) y Bluetooth Classic en detalle. |
| [7. Interfaz y animaciones](doc/07-ui-and-animations.md) | Tema "esponjoso", componentes reutilizables y animaciones. |
| [8. Compilar y ejecutar](doc/08-build-and-run.md) | Requisitos, comandos y preparación de cada plataforma. |
| [9. Solución de problemas](doc/09-troubleshooting.md) | Diagnóstico de red, firewall, adb y Bluetooth. |
| [10. Hoja de ruta](doc/10-roadmap.md) | **Próximo foco: calidad de audio** y pendientes futuros. |

> 💡 También hay una **versión web** de esta documentación como **SPA + WASM**
> (Deno + AssemblyScript) en [`docs-site/`](docs-site/README.md):
> ```bash
> cd docs-site
> deno task dev      # genera y sirve en http://localhost:8000
> ```
>
> 🌐 Se publica automáticamente en **GitHub Pages** con el workflow
> [`.github/workflows/docs.yml`](.github/workflows/docs.yml).

---

## Resumen rápido

- **Tecnología**: .NET 11 · .NET MAUI · C# 14.
- **Códec**: Opus (paquete [Concentus](https://www.nuget.org/packages/Concentus), gestionado).
- **Captura (servidor, Windows)**: WASAPI loopback con [NAudio 3](https://www.nuget.org/packages/NAudio).
- **Reproducción (cliente)**: `WaveOut` en Windows, `AudioTrack` en Android.
- **MVVM**: [CommunityToolkit.Mvvm](https://learn.microsoft.com/dotnet/communitytoolkit/mvvm/) (source generators).
- **Extras de UI**: [CommunityToolkit.Maui](https://learn.microsoft.com/dotnet/communitytoolkit/maui/) (p. ej. `Toast`).
- **Bluetooth (servidor, Windows)**: [32feet.NET / InTheHand](https://www.nuget.org/packages/InTheHand.Net.Bluetooth).

## Empezar en 3 pasos

```powershell
# 1. Restaurar y compilar el servidor de Windows
dotnet build .\Stars.Server\Stars.Server.csproj -f net11.0-windows10.0.19041.0

# 2. Ejecutar el servidor y pulsar "Comenzar a transmitir"
dotnet run --project .\Stars.Server\Stars.Server.csproj -f net11.0-windows10.0.19041.0

# 3. Compilar/instalar el cliente en Android
dotnet build .\Stars.Client\Stars.Client.csproj -f net11.0-android
```

Detalles completos en [8. Compilar y ejecutar](doc/08-build-and-run.md).

## Estructura del repositorio

```
Stars/
├── Stars.slnx                 # Solución (.slnx)
├── Directory.Build.props      # Propiedades comunes de MSBuild
├── Stars.Shared/              # Biblioteca de código compartido (net11.0)
│   ├── StreamProtocol.cs      #   contrato de red (handshake, framing, control, descubrimiento)
│   ├── CircularByteBuffer.cs  #   buffer PCM en tiempo real
│   ├── DuplexStream.cs        #   une streams de entrada/salida
│   ├── NetworkHelper.cs       #   IPs locales / nombre de equipo
│   └── AnimationExtensions.cs #   helpers de animación de UI
├── Stars.Server/              # App MAUI: captura y emite audio
│   ├── Features/              # Vertical slices: Capture, Streaming, Discovery, Platforms, Connectivity
│   ├── Components/            # Controles XAML reutilizables (tema "Aurora")
│   ├── AppServices.cs         # Composition root
│   ├── MainViewModel.cs       # MVVM
│   └── MainPage.xaml          # UI
└── Stars.Client/              # App MAUI: recibe y reproduce audio
    ├── Shared/                # Convertidores de UI específicos
    ├── Features/              # Vertical slices: Transport, Playback, Discovery, Platforms
    ├── Components/
    ├── AppServices.cs
    ├── MainViewModel.cs
    └── MainPage.xaml
```