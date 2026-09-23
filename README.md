# BlackMamba DMX

Control y experimentación DMX para hardware uDMX, con una capa de routing diseñada para crecer desde un único universo hacia operación redundante y multi-salida.

## Estado actual

El repositorio ya incluye control directo de hardware para:
- canal individual;
- fades;
- channel sweep;
- RGB básico;
- blackout;
- detección uDMX.

La evolución "dual" no vive en otro proyecto: se incorpora aquí como una capa de routing independiente del hardware.

## Arquitectura

```text
Scene / Automation / Audio
          ↓
      DMX Frame
          ↓
  DualUniverseRouter
      ├── PRIMARY
      ├── MIRROR
      └── FAILOVER
          ↓
    Output adapters
      ├── Universe A
      └── Universe B
```

La lógica de routing es pura y testeable; los adaptadores físicos pueden seguir usando uDMX u otros transportes.

## Seguridad operativa

- `blackout` debe estar disponible independientemente del modo.
- Valores fuera de 0–255 se rechazan.
- Canales válidos: 1–512.
- El modo failover no decide por sí mismo si el hardware está sano; consume una señal explícita de salud.
- La redundancia no sustituye validación eléctrica ni pruebas con carga real.

## Archivos clave

- `control_dmx.py`: controlador uDMX existente.
- `dmx_router.py`: routing puro primary/mirror/failover.
- `test_dmx_router.py`: pruebas sin hardware.
- `docs/DUAL_UNIVERSE.md`: contrato de evolución dual.
