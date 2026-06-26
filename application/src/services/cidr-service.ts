import { CIDRResult } from '../types/index.js';

function ipToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0) >>> 0;
}

function intToIp(n: number): string {
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ].join('.');
}

function toBinary(n: number, bits = 32): string {
  return (n >>> 0).toString(2).padStart(bits, '0');
}

function formatBinaryIp(n: number): string {
  const bin = toBinary(n);
  return `${bin.slice(0, 8)}.${bin.slice(8, 16)}.${bin.slice(16, 24)}.${bin.slice(24)}`;
}

function getIpClass(ip: string): string {
  const first = parseInt(ip.split('.')[0], 10);
  if (first >= 1 && first <= 126) return 'A';
  if (first === 127) return 'Loopback';
  if (first >= 128 && first <= 191) return 'B';
  if (first >= 192 && first <= 223) return 'C';
  if (first >= 224 && first <= 239) return 'D (Multicast)';
  return 'E (Reserved)';
}

// RFC 1918 private space only. Loopback (127/8) and link-local (169.254/16)
// are special-use, NOT private — they are reported via getIpClass / scope.
function isPrivateIp(ip: string): boolean {
  const n = ipToInt(ip);
  const ranges = [
    { start: ipToInt('10.0.0.0'), end: ipToInt('10.255.255.255') },
    { start: ipToInt('172.16.0.0'), end: ipToInt('172.31.255.255') },
    { start: ipToInt('192.168.0.0'), end: ipToInt('192.168.255.255') },
  ];
  return ranges.some(r => n >= r.start && n <= r.end);
}

// Strict dotted-quad validation (each octet 0–255, no leading-zero tricks)
function assertValidIp(ip: string): void {
  const parts = ip.split('.');
  if (parts.length !== 4) throw new Error(`Invalid IP address: ${ip}`);
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) throw new Error(`Invalid IP address: ${ip}`);
    const n = parseInt(p, 10);
    if (n < 0 || n > 255 || String(n) !== p) throw new Error(`Invalid IP address: ${ip}`);
  }
}

function assertValidMask(mask: string): void {
  assertValidIp(mask);
  // A subnet mask must be contiguous 1s followed by contiguous 0s
  const n = ipToInt(mask);
  const inv = (~n) >>> 0;
  if (((inv + 1) & inv) !== 0 && n !== 0) throw new Error(`Invalid subnet mask: ${mask}`);
}

export function parseCIDR(input: string): CIDRResult {
  const trimmed = input.trim();
  let ipStr: string;
  let prefix: number;

  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    ipStr = parts[0].trim();
    assertValidIp(ipStr);
    if (!/^\d{1,2}$/.test(parts[1].trim())) throw new Error('Invalid prefix length');
    prefix = parseInt(parts[1].trim(), 10);
  } else if (trimmed.includes(' ')) {
    const parts = trimmed.split(/\s+/);
    ipStr = parts[0];
    assertValidIp(ipStr);
    const mask = parts[1];
    assertValidMask(mask);
    const maskInt = ipToInt(mask);
    prefix = 0;
    let m = maskInt;
    while (m & 0x80000000) {
      prefix++;
      m = (m << 1) >>> 0;
    }
  } else {
    throw new Error('Invalid CIDR notation. Use format: 192.168.1.0/24');
  }

  if (prefix < 0 || prefix > 32) {
    throw new Error('Prefix length must be between 0 and 32');
  }

  const ipInt = ipToInt(ipStr);
  const maskInt = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const networkInt = (ipInt & maskInt) >>> 0;
  const broadcastInt = (networkInt | (~maskInt >>> 0)) >>> 0;
  const firstHostInt = prefix < 31 ? networkInt + 1 : networkInt;
  const lastHostInt = prefix < 31 ? broadcastInt - 1 : broadcastInt;
  const wildcardInt = (~maskInt) >>> 0;

  const totalHosts = Math.pow(2, 32 - prefix);
  const usableHosts = prefix <= 30 ? totalHosts - 2 : totalHosts;

  return {
    input: trimmed,
    ipAddress: ipStr,
    cidrPrefix: prefix,
    networkAddress: intToIp(networkInt),
    broadcastAddress: intToIp(broadcastInt),
    firstHost: intToIp(firstHostInt),
    lastHost: intToIp(lastHostInt),
    subnetMask: intToIp(maskInt),
    wildcardMask: intToIp(wildcardInt),
    totalHosts,
    usableHosts: Math.max(0, usableHosts),
    binarySubnetMask: formatBinaryIp(maskInt),
    binaryNetworkAddress: formatBinaryIp(networkInt),
    binaryIpAddress: formatBinaryIp(ipInt),
    ipClass: getIpClass(ipStr),
    isPrivate: isPrivateIp(ipStr),
    octets: ipStr.split('.').map(Number),
    networkOctets: intToIp(networkInt).split('.').map(Number),
    broadcastOctets: intToIp(broadcastInt).split('.').map(Number),
  };
}

export function generateSubnets(network: string, count?: number, prefixLength?: number): CIDRResult[] {
  const base = parseCIDR(network);
  const networkInt = ipToInt(base.networkAddress);
  const currentPrefix = base.cidrPrefix;

  let newPrefix: number;
  if (prefixLength !== undefined) {
    newPrefix = prefixLength;
  } else if (count !== undefined) {
    const bitsNeeded = Math.ceil(Math.log2(count));
    newPrefix = currentPrefix + bitsNeeded;
  } else {
    newPrefix = currentPrefix + 1;
  }

  if (newPrefix > 32) throw new Error('Cannot subnet further — prefix too long');

  const subnetCount = count ?? Math.pow(2, newPrefix - currentPrefix);
  const subnetSize = Math.pow(2, 32 - newPrefix);
  const results: CIDRResult[] = [];

  for (let i = 0; i < subnetCount; i++) {
    const subnetNetworkInt = (networkInt + i * subnetSize) >>> 0;
    try {
      results.push(parseCIDR(`${intToIp(subnetNetworkInt)}/${newPrefix}`));
    } catch {
      break;
    }
  }

  return results;
}

export function findSupernet(networks: string[]): CIDRResult {
  if (networks.length === 0) throw new Error('No networks provided');

  const parsed = networks.map(n => parseCIDR(n));
  const networkInts = parsed.map(p => ipToInt(p.networkAddress));

  // Number of identical leading bits across all network addresses
  let commonBits = 32;
  for (let bit = 31; bit >= 0; bit--) {
    const mask = 1 << bit;
    const firstBit = networkInts[0] & mask;
    const allSame = networkInts.every(n => (n & mask) === firstBit);
    if (!allSame) {
      commonBits = 31 - bit;
      break;
    }
  }

  // The aggregate can never be more specific than the least-specific input,
  // otherwise it would not fully contain that input (correct route summarization).
  const minInputPrefix = Math.min(...parsed.map(p => p.cidrPrefix));
  const superPrefix = Math.min(commonBits, minInputPrefix);
  const superMask = superPrefix === 0 ? 0 : (0xffffffff << (32 - superPrefix)) >>> 0;
  const superNetwork = (networkInts[0] & superMask) >>> 0;

  return parseCIDR(`${intToIp(superNetwork)}/${superPrefix}`);
}

export function validateIpAddress(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => {
    const n = parseInt(p, 10);
    return !isNaN(n) && n >= 0 && n <= 255 && p === String(n);
  });
}

export function getIpInfo(ip: string): Partial<CIDRResult> {
  if (!validateIpAddress(ip)) throw new Error('Invalid IP address');
  const first = parseInt(ip.split('.')[0], 10);
  let defaultPrefix = 24;
  if (first <= 126) defaultPrefix = 8;
  else if (first <= 191) defaultPrefix = 16;
  return parseCIDR(`${ip}/${defaultPrefix}`);
}
