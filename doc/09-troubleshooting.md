# 9. Solución de problemas

## No hay sonido en el cliente

1. Comprueba que el servidor muestra un cliente conectado (**"1 dispositivo conectado"**).
2. Sube el **Volumen** en el cliente y el volumen multimedia del dispositivo.
3. Verifica que el PC está reproduciendo audio (el motor envía silencio si no suena nada, así que
   "no se oye" puede ser simplemente que no hay nada reproduciéndose).
4. En el servidor, revisa la tarjeta **Actividad** para mensajes de error de captura o de red.

## El cliente no conecta por Wi-Fi

El servidor ya hace casi todo por su cuenta, pero comprueba esto:

1. **Dirección correcta**: el servidor muestra la IP **de la interfaz con gateway** (Ethernet/Wi-Fi
   física), no la de adaptadores virtuales (WSL, VPN, Hyper-V). En el móvil escribe exactamente esa
   IP y el puerto que aparecen en la tarjeta *Conecta tu dispositivo* (o pulsa **Copiar dirección**).
2. **Firewall**: al pulsar *Comenzar a transmitir* el servidor intenta crear una regla de entrada
   para el puerto. Si el log dice que **requiere permisos de administrador**, ejecuta el servidor
   como administrador una vez, o crea la regla a mano:
   ```powershell
   New-NetFirewallRule -DisplayName "Stars" -Direction Inbound -Protocol TCP -LocalPort 45890 -Action Allow
   ```
3. **Misma red**: ambos dispositivos en la misma subred y sin *AP isolation*.
4. Si el descubrimiento automático no encuentra nada, **escribe la IP a mano**: el cliente ahora
   falla rápido (timeout de **5 s**) en vez de quedarse colgado.
5. Revisa la **Actividad** del servidor: si aparece *"No se pudo iniciar el descubrimiento
   automático"*, el streaming sigue funcionando igual; solo usa la IP manual.


## USB no funciona

- Falta `adb`: instala las **Android Platform Tools** y asegúrate de que está en el `PATH` (o en
  `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`).
- El dispositivo no aparece: activa **Depuración USB** y acepta el diálogo de autorización del PC.
  Comprueba con `adb devices` (debe figurar como `device`, no `unauthorized`).
- Tras reconectar el cable el túnel se pierde: vuelve a activar el interruptor **USB**.

## Bluetooth no funciona

- **Empareja** antes los dispositivos (Configuración de Windows ↔ Android).
- En el servidor, activa el interruptor **Bluetooth** (solo Windows).
- En Android 12+, concede permisos **Dispositivos cercanos** (`BLUETOOTH_CONNECT`/`BLUETOOTH_SCAN`).
- Si el enlace se satura, baja el bitrate en `OpusStreamingEngine` (p. ej. a `96000`).

## Audio entrecortado, con chasquidos o distorsión

- El motor de captura se **auto-sincroniza con el dispositivo de audio** (envía los frames en cuanto
  hay datos, en vez de un reloj libre). Esto evita la deriva que provocaba *underruns* periódicos
  (los clics); durante las pausas solo envía un frame de relleno cada 20 ms para mantener vivo el
  decodificador.
- Los clics por *underrun* además mantienen la última muestra en lugar de poner un cero.
- El buffer de captura descarta lo viejo (`DiscardOnBufferOverflow`) para que la latencia no crezca.
- **Wi-Fi saturada**: reduce el bitrate de Opus en `OpusStreamingEngine` (p. ej.
  `_encoder.Bitrate = 96000`).
- **Bluetooth**: igual, baja el bitrate; RFCOMM tiene menos margen que TCP.
- Acércate al router o usa 5 GHz; reduce interferencias.

## Latencia alta

- El sistema ya viene afinado para baja latencia (buffer PCM de ~160 ms en el servidor, lectura del
  resampler en trozos de 20 ms, y buffer de `AudioTrack` de ~40 ms). Si necesitas aún menos:
  - Baja el buffer de `AndroidAudioSink` (`PreferredBufferDurationMs`), a costa de más riesgo de cortes.
  - Baja `BufferMilliseconds`/`NumberOfBuffers` en `WindowsAudioSink`.
- Evita saltos de red y usa 5 GHz o USB.

## Logs

- **Servidor**: tarjeta **Actividad** en la app; en Debug también salida de depuración.
- **Cliente**: tarjeta **Actividad** (incluye mensajes del transporte y de reconexión).
- **adb**: `adb logcat` para ver el tráfico del cliente Android.

Volver al [índice](../README.md).
