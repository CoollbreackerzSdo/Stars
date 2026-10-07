# 3. Protocolo de streaming

Toda la definición vive en `Stars.Shared.StreamProtocol` (proyecto compartido).

## Parámetros

| Parámetro | Valor |
|-----------|-------|
| Puerto TCP de streaming | `45890` |
| Puerto UDP de descubrimiento | `45891` |
| Frecuencia de muestreo | `48000` Hz |
| Canales | `2` (estéreo) |
| Duración de frame | `20` ms |
| Muestras por canal y frame | `960` |
| Tamaño máximo de paquete Opus | `1275` bytes |

## Handshake (servidor → cliente)

En cuanto un cliente se conecta, el servidor envía **14 bytes** con el formato del stream:

```
 0        4      5               6                     10           14
 ┌────────┬──────┬───────┬───────────────────────┬───────────────────────┐
 │ "STRS" │ ver  │ canales│ sampleRate (int32 LE) │ samplesPerFrame (int32 LE)│
 └────────┴──────┴───────┴───────────────────────┴───────────────────────┘
```

- `[0..3]` — magic `'S','T','R','S'` (bytes UTF-8 `"STRS"`).
- `[4]` — versión del protocolo (`1`).
- `[5]` — número de canales (1 o 2).
- `[6..9]` — `int32` little-endian: frecuencia de muestreo.
- `[10..13]` — `int32` little-endian: muestras por canal y frame.

Código:

```csharp
public static bool TryParseStreamHeader(
    ReadOnlySpan<byte> buffer,
    out int sampleRate,
    out int channels,
    out int frameSamplesPerChannel);
```

## Framing de audio (servidor → cliente, continuo)

Tras el handshake el servidor envía frames Opus, cada uno precedido por su longitud:

```
 0        2                      2 + length
 ┌────────┬───────────────────────────────────┐
 │ length │        %payload Opus               │
 │ uint16 │                                    │
 └────────┴───────────────────────────────────┘
```

- `length` — `uint16` little-endian.
- `payload` — un paquete Opus de hasta 1275 bytes.

El cliente lee 2 bytes, obtiene la longitud y luego lee exactamente esa cantidad. Si `length` es
`0` o mayor que `MaxPacketBytes`, la conexión se considera inválida y se cierra.

```csharp
StreamProtocol.WriteFrameLength(destination, length);
var length = StreamProtocol.ReadFrameLength(source);
```

## Descubrimiento UDP (cliente → servidor → cliente)

1. El cliente envía por **broadcast** (y a loopback) al puerto `45891` el texto:
   `STARS_DISCOVER_V1`.
2. El servidor responde al remitente con:
   `STARS_SERVER_V1|<nombreEquipo>|<ip>|<puertoTcp>`.

El cliente muestra cada respuesta como un servidor seleccionable. También se puede introducir la
dirección a mano.

## Byte-prefixes sin asignación

Los prefijos y el magic se exponen como `ReadOnlySpan<byte>` creados con literales UTF-8
(`"STRS"u8`), de modo que comparar o copiar no reserva memoria:

```csharp
public static ReadOnlySpan<byte> Magic => "STRS"u8;
```

Siguiente: [4. Servidor](04-server.md).
