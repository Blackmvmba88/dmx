# Dual Universe Routing

The old `dmx-dual` idea is absorbed into the active `dmx` repository as a routing capability rather than maintained as a second controller project.

## Logical universes

- **A** — primary output.
- **B** — secondary output.

These are logical outputs. A future adapter may map them to two physical uDMX interfaces, Art-Net universes, sACN universes or another transport.

## Modes

### primary
A receives the scene. B remains blacked out.

### mirror
Both outputs receive independent copies of the same 512-channel frame.

Use case: mirrored rigs, validation or staged transition to redundant output.

### failover
A receives the scene while the caller reports it healthy. If health becomes false, B receives the scene and A blacks out.

The router deliberately does not infer hardware health. Health detection belongs to the transport/observer layer.

## Next implementation gates

1. Define a transport adapter protocol.
2. Wrap the current uDMX device as one adapter.
3. Add two-device enumeration.
4. Add explicit heartbeat/health evidence.
5. Exercise failover with simulated adapters.
6. Only then test with two physical DMX outputs.

## Non-goals

This layer does not:
- guess fixture addressing;
- auto-detect electrical faults;
- guarantee seamless physical failover;
- bypass manual blackout or emergency controls.
