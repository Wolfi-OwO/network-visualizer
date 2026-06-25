# Tests

Planned automated test suite for the backend.

Recommended first targets (pure, deterministic logic):

- `services/cidrService` — `parseCIDR`, `generateSubnets`, `findSupernet`, validation
- `services/packetSenderService` — routing (longest-prefix), firewall direction,
  NAT, TTL, VLAN/subnet segmentation, power-off blocking

Suggested tooling: [Vitest](https://vitest.dev) with `c8` coverage.

```bash
# once added to devDependencies + package.json scripts:
npm test
```
