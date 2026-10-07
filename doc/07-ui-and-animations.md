# 7. Interfaz y animaciones

## Identidad visual: "esponjoso"

Un tema suave y redondeado, nada minimalista: superficies claras sobre un **degradado pastel**,
tarjetas con esquinas muy redondeadas, sombras amplias y suaves, y botones tipo **píldora**.

Definido en `Resources/Styles/FluffyTheme.xaml` (registrado en `App.xaml`).

### Paleta

| Rol | Color |
|-----|-------|
| Tinta | `#2B2350` · tinta suave `#6E668F` |
| Lila | `#7C5CFF` |
| Cielo | `#4EA8FF` |
| Rubor | `#FF7AC6` |
| Melocotón | `#FF9E6D` |
| Menta | `#4ED8B4` |
| Superficie | `#FFFFFF` · alternativa `#F4F1FF` |

Se exponen brushes de degradado reutilizables: `FluffyBackdropBrush`, `FluffyPrimaryBrush`
(lila→cielo), `FluffyAccentBrush` (rubor→melocotón) y `FluffyMintBrush` (menta→cielo).

### Estilos clave

- `FluffyCard` — tarjeta con `CornerRadius=30`, borde `#ECE7FF` y sombra lila.
- `FluffyPill` / `FluffyPillWarm` / `FluffyPillSoft` — botones píldora con degradado y sombra.
- `FluffyEntry` — campos de texto altos y redondeados.
- Tipografía: `FluffyTitle`, `FluffySection`, `FluffySubtitle`, `FluffyCaption`.

> Las sombras usan un `Brush` de color ARGB (p. ej. `#2E7C5CFF`), no un `SolidColorBrush`, para
> dar el halo suave.

## Componentes reutilizables

La UI se compone con `ContentView`s con propiedades enlazables, evitando repetir XAML.

### Compartidos por ambos proyectos

| Componente | Propósito | Propiedades |
|-----------|-----------|-------------|
| `FluffyCard` | superficie tipo tarjeta (hereda de `Border`) | contenido anidado |
| `HeroHeader` | título + subtítulo | `Title`, `Subtitle` |
| `StatusBadge` | etiqueta de estado tipo píldora | `Text`, `BadgeColor` |
| `ActivityLog` | lista de mensajes con título | `Title`, `ItemsSource`, `ListHeight` |

### Específicos del cliente

| Componente | Propósito | Propiedades / eventos |
|-----------|-----------|----------------------|
| `TransportSelector` | elegir Wi-Fi / USB / Bluetooth | `SelectedKind`, `BluetoothSupported` |
| `ConnectForm` | host + puerto + botones | `Host`, `Port`, `ConnectCommand`, `DiscoverCommand` |
| `ServerList` | servidores encontrados | `ItemsSource`, evento `ServerSelected` |
| `Equalizer` | barras animadas por nivel | `Level` |

Ejemplo de uso en `MainPage.xaml` del cliente:

```xml
<components:FluffyCard>
    <components:TransportSelector SelectedKind="{Binding SelectedKind, Mode=TwoWay}"
                                  BluetoothSupported="{Binding BluetoothSupported}" />
</components:FluffyCard>
```

## Animaciones

`Shared/AnimationExtensions.cs` define tres utilidades:

| Método | Efecto |
|--------|--------|
| `AnimateInAsync(delay)` | aparecer con fundido + deslizamiento hacia arriba |
| `PopAsync()` | "pop" táctil (escala 1 → 1.12 → 1) |
| `BounceAsync(token, amp)` | latido continuo (escala 1 ↔ 1+amp) |

### Entrada escalonada

Cada página anima sus tarjetas en cascada al aparecer:

```csharp
protected override async void OnAppearing()
{
    base.OnAppearing();
    await Hero.AnimateInAsync(40);
    await StatusCard.AnimateInAsync(120);
    await OptionsCard.AnimateInAsync(200);
    await ActivityCard.AnimateInAsync(320);
}
```

### Feedback táctil

Los botones y opciones hacen `PopAsync()` al pulsarse (p. ej. elegir transporte o un servidor).

### Latido en vivo

- **Servidor**: el badge de estado late con `BounceAsync` mientras `IsRunning`.
- **Cliente**: el componente `Equalizer` refleja el nivel (`Level`) que el ViewModel actualiza
  ~2 veces por segundo, animando las barras.

Siguiente: [8. Compilar y ejecutar](08-build-and-run.md).
