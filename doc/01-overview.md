# 1. Visión general

## ¿Qué es Stars?

Stars comparte **todo el audio del sistema** de un PC hacia otro dispositivo, en **tiempo real**.
El PC actúa de **servidor** (captura y emite) y el dispositivo (Android) de **cliente** (recibe y
reproduce). La latencia típica en una red local es de **80–150 ms**.

## Casos de uso

- Escuchar el audio del PC en el móvil (música, vídeos, reuniones) sin depender de que el PC tenga
  altavoces potentes.
- Usar el móvil como altavoz remoto cuando el PC está en otra habitación.
- Conectar sin Wi-Fi: por **cable USB** o por **Bluetooth** cuando no hay red disponible.

## Capacidades

| Capacidad | Servidor | Cliente |
|-----------|:--------:|:-------:|
| Captura de la salida del sistema (WASAPI loopback) | ✅ Windows | — |
| Codificación Opus 48 kHz estéreo (20 ms/frame) | ✅ | — |
| Decodificación Opus + reproducción | — | ✅ |
| Broadcast a varios clientes a la vez | ✅ | — |
| Transporte Wi-Fi (TCP) | ✅ | ✅ |
| Transporte USB (adb reverse) | ✅ | ✅ |
| Transporte Bluetooth Classic (RFCOMM/SPP) | ✅ Windows | ✅ Android |
| Descubrimiento UDP automático en la LAN | ✅ | ✅ |
| Descubrimiento de dispositivos Bluetooth emparejados | — | ✅ Android |
| Silenciar el PC mientras transmite | ✅ Windows | — |
| Control de volumen en reproducción | — | ✅ |
| Selección de la salida de audio (genérica o del dispositivo) | — | ✅ |
| Jitter buffer adaptativo (métricas en vivo) | — | ✅ |
| Bitrate adaptativo y FEC configurables | ✅ | ✅ |
| UI por pestañas con tema claro/oscuro e iconos | ✅ | ✅ |
| Notificación de reproducción (Android) | — | ✅ |
| Reconexión automática ante caída | — | ✅ |

## Piezas

- **`Stars.Server`**: app MAUI (ejecutable principal en Windows). Captura, codifica, emite.
- **`Stars.Client`**: app MAUI (Android). Descubre, conecta, decodifica, reproduce.

Ambas comparten el mismo contrato de red (`Stars.Shared.StreamProtocol`).

## Flujo en una frase

`Salida del sistema → WASAPI loopback → PCM → Opus → TCP/UDP/Bluetooth → Opus → PCM → AudioTrack`

Siguiente: [2. Arquitectura](02-architecture.md).
