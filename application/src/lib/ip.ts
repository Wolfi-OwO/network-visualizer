// Small, dependency-free IPv4 helpers shared across services.

export function ipToInt(ip?: string): number | null {
  if (!ip) return null;
  const o = ip.split('.').map(Number);
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
}

export function intToIp(n: number): string {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff].join('.');
}

export function maskToPrefix(mask?: string): number | null {
  const m = ipToInt(mask);
  if (m === null) return null;
  let prefix = 0;
  let seenZero = false;
  for (let i = 31; i >= 0; i--) {
    const bit = (m >>> i) & 1;
    if (bit) {
      if (seenZero) return null; // non-contiguous mask
      prefix++;
    } else seenZero = true;
  }
  return prefix;
}

export function prefixOf(iface: { cidr?: string; subnetMask?: string }): number | null {
  if (iface.cidr) {
    const p = parseInt(iface.cidr.replace('/', ''), 10);
    if (Number.isFinite(p) && p >= 0 && p <= 32) return p;
  }
  return maskToPrefix(iface.subnetMask);
}

export function networkOf(ip: string, prefix: number): number | null {
  const a = ipToInt(ip);
  if (a === null) return null;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (a & mask) >>> 0;
}

export function inSubnet(candidate: string, ip: string, prefix: number): boolean {
  const c = networkOf(candidate, prefix);
  const n = networkOf(ip, prefix);
  return c !== null && n !== null && c === n;
}

export function isPrivate(ip: string): boolean {
  const n = ipToInt(ip);
  if (n === null) return false;
  return (
    inSubnet(ip, '10.0.0.0', 8) || inSubnet(ip, '172.16.0.0', 12) || inSubnet(ip, '192.168.0.0', 16)
  );
}
