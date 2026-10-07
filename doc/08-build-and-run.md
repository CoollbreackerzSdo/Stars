# 8. Compilar y ejecutar

## Requisitos

- **.NET SDK 11** (con workloads `maui` y `android`).
  ```powershell
  dotnet workload install maui android
  ```
- **Servidor**: Windows 10/11 (WASAPI loopback). Opcional: **Android Platform Tools** (`adb`) para
  USB y **Bluetooth** activo para el transporte Bluetooth.
- **Cliente**: Android 7.0 (API 24) o superior, o Windows para pruebas.

## Restaurar

```powershell
dotnet restore .\Stars.slnx
```

## Compilar

```powershell
# Servidor (Windows)
dotnet build .\Stars.Server\Stars.Server.csproj -f net11.0-windows10.0.19041.0

# Cliente (Android)
dotnet build .\Stars.Client\Stars.Client.csproj -f net11.0-android
```

> `Stars.Shared` (el proyecto con el contrato de red y utilidades comunes) se compila
> automáticamente como dependencia de ambas apps gracias al `ProjectReference`; no hace falta
> compilarlo por separado.

## Ejecutar el servidor

```powershell
dotnet run --project .\Stars.Server\Stars.Server.csproj -f net11.0-windows10.0.19041.0
```

1. Pulsa **Comenzar a transmitir**.
2. Anota la **dirección** que muestra (p. ej. `192.168.1.20:45890`).
3. Opcional: activa **Silenciar el PC** y/o **Bluetooth**.

## Ejecutar el cliente

### En un Android físico

```powershell
# Compilar y desplegar en el dispositivo conectado
dotnet build .\Stars.Client\Stars.Client.csproj -f net11.0-android -t:Run
```

O genera un APK e instálalo:

```powershell
dotnet publish .\Stars.Client\Stars.Client.csproj -f net11.0-android -c Release
```

### En Windows (para probar la UI)

```powershell
dotnet run --project .\Stars.Client\Stars.Client.csproj -f net11.0-windows10.0.19041.0
```

> El transporte Bluetooth del cliente solo está implementado en Android; en Windows se puede usar
> Wi-Fi/USB contra un servidor local.

## Conectar

En el cliente:

1. Elige el transporte en **Conexión**: Wi-Fi, USB o Bluetooth.
2. Pulsa **Buscar** (UDP en Wi-Fi, dispositivos emparejados en Bluetooth) o escribe la dirección.
3. Pulsa **Conectar**. El estado pasa a **En vivo**.

## Preparar cada transporte

- **Wi-Fi**: permite el puerto **45890** (TCP) y **45891** (UDP) en el Firewall de Windows para
  redes privadas.
  ```powershell
  New-NetFirewallRule -DisplayName "Stars" -Direction Inbound -Protocol TCP -LocalPort 45890 -Action Allow
  ```
- **USB**: activa la **depuración USB** en el móvil y conecta el cable. El servidor ejecuta
  `adb reverse` automáticamente.
- **Bluetooth**: empareja PC y móvil primero (Configuración de Windows ↔ Android).

## Estructura de compilación

Cada proyecto es multitarget; para el uso real solo necesitas `net11.0-windows10.0.19041.0`
(servidor) y `net11.0-android` (cliente). Las constantes `WINDOWS` / `ANDROID` se definen por
`TargetFramework` en el `.csproj`.

Siguiente: [9. Solución de problemas](09-troubleshooting.md).
