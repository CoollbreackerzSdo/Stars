# 10. Hoja de ruta

**Versión actual: 1.0.0** — funcional y estable para el caso de uso principal (PC → dispositivo).

---

## 🎯 Próximo foco principal: calidad de audio en todos los conectores

> **Prioridad #1.** Una vez cubiertas conexión y reproducción, el objetivo central es
> **mejorar la calidad del audio en general en los tres transportes** — **Wi-Fi (TCP)**,
> **USB (adb reverse)** y **Bluetooth Classic (RFCOMM)** — de forma uniforme.

Líneas de trabajo previstas:

| Área | Idea | Afecta a |
|------|------|----------|
| **Códec** | ✅ **Implementado en 1.0.0** (bitrate adaptativo + FEC) | Todos |
| **Jitter buffer** | ✅ **Implementado en 1.0.0** (profundidad adaptativa) | Todos |
| **Recuperación** | ✅ **Implementado en 1.0.0** (FEC/PLC de Opus) | Wi-Fi |
| **Resampling** | Remuestreo de mayor calidad y dithering al convertir a 48 kHz | Servidor |
| **Profundidad** | Conversión a `float`/32 bit en el pipeline para evitar *clipping* | Servidor |
| **Sincronización** | Alineación de relojes servidor/cliente para reproducir sin deriva | Todos |
| **Medición** | Métricas de jitter, pérdida y latencia por transporte en la UI | Todos |
| **Bluetooth** | Ajuste de perfil/MTU y reconexión para enlaces RFCOMM débiles | Bluetooth |

El objetivo es que **los tres conectores ofrezcan una experiencia de audio equivalente**, sin que
ninguno destaque por artefactos, cortes o retraso notable.

---

## Estado por transporte

| Transporte | Estado v1.0.0 | Calidad a mejorar |
|------------|:-------------:|-------------------|
| Wi-Fi (TCP) | ✅ | jitter buffer, FEC |
| USB (adb reverse) | ✅ | estabilidad del túnel |
| Bluetooth Classic | ✅ | ancho de banda / MTU |

### Avances aplicados (1.0.0)

- ✅ **Selección de salida de audio** en el cliente (genérica del sistema o dispositivo concreto).
- ✅ **Motor auto-sincronizado** por el dispositivo de audio (menos deriva y *underruns*).
- ✅ **Jitter buffer adaptativo** en el cliente (absorbe el jitter de red, profundidad dinámica).
- ✅ **Bitrate adaptativo** (el encoder se ajusta al estado del enlace).
- ✅ **FEC / recuperación de pérdidas** configurable desde el cliente.
- ✅ Buffers reducidos y descarte de lo viejo para evitar latencia acumulada.
- ✅ **Rediseño de UI**: navegación por pestañas, tema claro/oscuro e iconos.

---

## Otros pendientes (posteriores)

- Selección de dispositivo de salida de audio en el servidor.
- Perfil de baja latencia (*low latency*) con buffers aún menores.
- Empaquetado firmado para distribución en Android.
- Persistencia de la última conexión en el cliente.

---

Volver al [índice](../README.md).
