import { Packet, PacketStats, EthernetLayer, IpLayer, UdpLayer, TcpLayer, ProtoView } from '../types';

const HOSTS = [
  { ip: '10.0.0.1', mac: '00:1a:2b:3c:4d:01', name: 'gateway' },
  { ip: '10.0.0.10', mac: '00:1a:2b:3c:4d:10', name: 'pc1' },
  { ip: '10.0.0.11', mac: '00:1a:2b:3c:4d:11', name: 'pc2' },
  { ip: '10.0.0.20', mac: '00:1a:2b:3c:4d:20', name: 'server' },
  { ip: '10.0.0.30', mac: '00:1a:2b:3c:4d:30', name: 'switch' },
  { ip: '8.8.8.8', mac: 'aa:bb:cc:dd:ee:ff', name: 'dns-google' },
  { ip: '1.1.1.1', mac: 'aa:bb:cc:00:11:22', name: 'dns-cloudflare' },
  { ip: '93.184.216.34', mac: 'bb:cc:dd:ee:ff:00', name: 'web-server' },
  { ip: '151.101.1.140', mac: 'cc:dd:ee:ff:00:11', name: 'cdn' },
  { ip: '172.217.23.110', mac: 'dd:ee:ff:00:11:22', name: 'google' },
];

const BROADCAST_MAC = 'ff:ff:ff:ff:ff:ff';

let packetIdCounter = 1;
let captureStartTime = Date.now();
const packetBuffer: Packet[] = [];
let isCapturing = false;
let captureInterval: NodeJS.Timeout | null = null;

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomHex(bytes: number): string {
  return Array.from({ length: bytes }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('');
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function ipToOctets(ip: string): number[] {
  return ip.split('.').map(Number);
}

function generateHexDump(bytes: number[]): string[] {
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const offset = i.toString(16).padStart(4, '0');
    const hex = chunk.map(b => b.toString(16).padStart(2, '0')).join(' ');
    const hexPadded = hex.padEnd(47, ' ');
    const ascii = chunk.map(b => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${offset}  ${hexPadded}  ${ascii}`);
  }
  return lines;
}

function generateEthernetBytes(srcMac: string, dstMac: string, etherType: number): number[] {
  const dstBytes = dstMac.split(':').map(h => parseInt(h, 16));
  const srcBytes = srcMac.split(':').map(h => parseInt(h, 16));
  const typeBytes = [(etherType >> 8) & 0xff, etherType & 0xff];
  return [...dstBytes, ...srcBytes, ...typeBytes];
}

function generateIpBytes(src: string, dst: string, protocol: number, payloadLength: number): number[] {
  const totalLength = 20 + payloadLength;
  const srcOctets = ipToOctets(src);
  const dstOctets = ipToOctets(dst);
  return [
    0x45, 0x00,
    (totalLength >> 8) & 0xff, totalLength & 0xff,
    randomBetween(0, 255), randomBetween(0, 255),
    0x40, 0x00,
    64, protocol,
    randomBetween(0, 255), randomBetween(0, 255),
    ...srcOctets,
    ...dstOctets,
  ];
}

function generateTcpBytes(srcPort: number, dstPort: number, flags: number, seq: number): number[] {
  return [
    (srcPort >> 8) & 0xff, srcPort & 0xff,
    (dstPort >> 8) & 0xff, dstPort & 0xff,
    (seq >> 24) & 0xff, (seq >> 16) & 0xff, (seq >> 8) & 0xff, seq & 0xff,
    0x00, 0x00, 0x00, 0x00,
    0x50, flags,
    0xff, 0xff,
    randomBetween(0, 255), randomBetween(0, 255),
    0x00, 0x00,
  ];
}

function generateUdpBytes(srcPort: number, dstPort: number, payloadLen: number): number[] {
  const length = 8 + payloadLen;
  return [
    (srcPort >> 8) & 0xff, srcPort & 0xff,
    (dstPort >> 8) & 0xff, dstPort & 0xff,
    (length >> 8) & 0xff, length & 0xff,
    randomBetween(0, 255), randomBetween(0, 255),
  ];
}

function getProtocolColor(protocol: string): string {
  const colors: Record<string, string> = {
    HTTP: '#1b4332',
    HTTPS: '#0d3b2e',
    DNS: '#1a3a5c',
    mDNS: '#16304a',
    TCP: '#1a1a2e',
    UDP: '#3d3300',
    ICMP: '#4a1020',
    ARP: '#3d3200',
    TLS: '#2d1b4e',
    SSH: '#1a2e1a',
    SMTP: '#2e1a2e',
    FTP: '#2e2a1a',
    DHCP: '#103d3a',
    STP: '#3a2a10',
    NTP: '#10303d',
    LLDP: '#2a103d',
    SNMP: '#3d1030',
    OSPF: '#103d1a',
    SSDP: '#2a2a3d',
    SIP: '#3d2010',
  };
  return colors[protocol] || '#1a1a1a';
}

// ── Shared packet factory for the richer protocol generators ─────────────────
function makePacket(opts: {
  protocol: string;
  info: string;
  ethernet: EthernetLayer;
  rawBytes: number[];
  ip?: IpLayer;
  udp?: UdpLayer;
  tcp?: TcpLayer;
  protoViews?: ProtoView[];
}): Packet {
  const id = packetIdCounter++;
  const now = Date.now();
  return {
    id,
    timestamp: now,
    relativeTime: parseFloat(((now - captureStartTime) / 1000).toFixed(6)),
    length: opts.rawBytes.length,
    capturedLength: opts.rawBytes.length,
    protocol: opts.protocol,
    info: opts.info,
    color: getProtocolColor(opts.protocol),
    ethernet: opts.ethernet,
    ip: opts.ip,
    udp: opts.udp,
    tcp: opts.tcp,
    protoViews: opts.protoViews,
    hexDump: generateHexDump(opts.rawBytes),
    rawBytes: opts.rawBytes,
  };
}

function eth(srcMac: string, dstMac: string, etherType: string, etherTypeName: string): EthernetLayer {
  return { srcMac, dstMac, etherType, etherTypeName };
}

function ipLayer(src: string, dst: string, proto: number, protoName: string, payloadLen: number, ttl = 64): IpLayer {
  return {
    version: 4, headerLength: 20, dscp: 0, ecn: 0,
    totalLength: 20 + payloadLen, identification: `0x${randomHex(2)}`,
    flags: '0x00', fragmentOffset: 0, ttl, protocol: proto, protocolName: protoName,
    checksum: `0x${randomHex(2)}`, srcIp: src, dstIp: dst,
  };
}

function udpLayer(srcPort: number, dstPort: number, payloadLen: number): UdpLayer {
  return { srcPort, dstPort, length: 8 + payloadLen, checksum: `0x${randomHex(2)}` };
}

function randomPayload(len: number): number[] {
  return Array.from({ length: len }, () => randomBetween(0, 255));
}

function generateHttpPacket(src: typeof HOSTS[0], dst: typeof HOSTS[0]): Packet {
  const isRequest = Math.random() > 0.5;
  const methods = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'];
  const uris = ['/index.html', '/api/data', '/images/logo.png', '/style.css', '/favicon.ico', '/api/users', '/search?q=test'];
  const statusCodes = [200, 201, 301, 302, 304, 400, 401, 403, 404, 500];
  const statusMessages: Record<number, string> = {
    200: 'OK', 201: 'Created', 301: 'Moved Permanently', 302: 'Found',
    304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized',
    403: 'Forbidden', 404: 'Not Found', 500: 'Internal Server Error',
  };

  const method = randomChoice(methods);
  const uri = randomChoice(uris);
  const status = randomChoice(statusCodes);
  const srcPort = randomBetween(49152, 65535);
  const dstPort = 80;
  const seq = randomBetween(0, 2147483647);

  const payload = isRequest
    ? `${method} ${uri} HTTP/1.1\r\nHost: ${dst.ip}\r\nUser-Agent: Mozilla/5.0\r\nAccept: */*\r\n\r\n`
    : `HTTP/1.1 ${status} ${statusMessages[status]}\r\nContent-Type: text/html\r\nContent-Length: 1234\r\n\r\n`;

  const payloadBytes = Array.from(payload).map(c => c.charCodeAt(0));
  const etherBytes = generateEthernetBytes(src.mac, dst.mac, 0x0800);
  const ipBytes = generateIpBytes(src.ip, dst.ip, 6, 20 + payloadBytes.length);
  const tcpBytes = generateTcpBytes(isRequest ? srcPort : dstPort, isRequest ? dstPort : srcPort, 0x18, seq);
  const rawBytes = [...etherBytes, ...ipBytes, ...tcpBytes, ...payloadBytes];

  const id = packetIdCounter++;
  const now = Date.now();

  return {
    id,
    timestamp: now,
    relativeTime: parseFloat(((now - captureStartTime) / 1000).toFixed(6)),
    length: rawBytes.length,
    capturedLength: rawBytes.length,
    protocol: 'HTTP',
    info: isRequest
      ? `${method} ${uri} HTTP/1.1`
      : `HTTP/1.1 ${status} ${statusMessages[status]}`,
    color: getProtocolColor('HTTP'),
    ethernet: {
      srcMac: src.mac,
      dstMac: dst.mac,
      etherType: '0x0800',
      etherTypeName: 'IPv4',
    },
    ip: {
      version: 4,
      headerLength: 20,
      dscp: 0,
      ecn: 0,
      totalLength: 20 + 20 + payloadBytes.length,
      identification: `0x${randomHex(2)}`,
      flags: '0x40',
      fragmentOffset: 0,
      ttl: 64,
      protocol: 6,
      protocolName: 'TCP',
      checksum: `0x${randomHex(2)}`,
      srcIp: src.ip,
      dstIp: dst.ip,
    },
    tcp: {
      srcPort: isRequest ? srcPort : dstPort,
      dstPort: isRequest ? dstPort : srcPort,
      sequenceNumber: seq,
      acknowledgmentNumber: randomBetween(0, 2147483647),
      dataOffset: 5,
      flags: { fin: false, syn: false, rst: false, psh: true, ack: true, urg: false },
      windowSize: 65535,
      checksum: `0x${randomHex(2)}`,
      urgentPointer: 0,
    },
    http: {
      isRequest,
      method: isRequest ? method : undefined,
      uri: isRequest ? uri : undefined,
      version: 'HTTP/1.1',
      statusCode: isRequest ? undefined : status,
      statusMessage: isRequest ? undefined : statusMessages[status],
      headers: isRequest
        ? { Host: dst.ip, 'User-Agent': 'Mozilla/5.0', Accept: '*/*' }
        : { 'Content-Type': 'text/html', 'Content-Length': '1234', Server: 'nginx/1.24.0' },
    },
    hexDump: generateHexDump(rawBytes),
    rawBytes,
  };
}

function generateDnsPacket(src: typeof HOSTS[0]): Packet {
  const domains = ['google.com', 'github.com', 'cloudflare.com', 'amazon.com', 'microsoft.com', 'apple.com', 'netflix.com', 'youtube.com'];
  const domain = randomChoice(domains);
  const isResponse = Math.random() > 0.5;
  const dnsServer = randomChoice([HOSTS[5], HOSTS[6]]);
  const srcPort = randomBetween(49152, 65535);
  const transId = randomBetween(0, 65535);
  const resolvedIp = `${randomBetween(1, 254)}.${randomBetween(1, 254)}.${randomBetween(1, 254)}.${randomBetween(1, 254)}`;

  const etherBytes = generateEthernetBytes(src.mac, dnsServer.mac, 0x0800);
  const udpPayloadLen = isResponse ? 60 : 30;
  const ipBytes = generateIpBytes(isResponse ? dnsServer.ip : src.ip, isResponse ? src.ip : dnsServer.ip, 17, 8 + udpPayloadLen);
  const udpBytes = generateUdpBytes(isResponse ? 53 : srcPort, isResponse ? srcPort : 53, udpPayloadLen);
  const dnsPayload = Array.from({ length: udpPayloadLen }, () => randomBetween(0, 255));
  const rawBytes = [...etherBytes, ...ipBytes, ...udpBytes, ...dnsPayload];

  const id = packetIdCounter++;
  const now = Date.now();

  return {
    id,
    timestamp: now,
    relativeTime: parseFloat(((now - captureStartTime) / 1000).toFixed(6)),
    length: rawBytes.length,
    capturedLength: rawBytes.length,
    protocol: 'DNS',
    info: isResponse
      ? `Standard query response 0x${transId.toString(16).padStart(4, '0')} A ${domain} A ${resolvedIp}`
      : `Standard query 0x${transId.toString(16).padStart(4, '0')} A ${domain}`,
    color: getProtocolColor('DNS'),
    ethernet: {
      srcMac: isResponse ? dnsServer.mac : src.mac,
      dstMac: isResponse ? src.mac : dnsServer.mac,
      etherType: '0x0800',
      etherTypeName: 'IPv4',
    },
    ip: {
      version: 4,
      headerLength: 20,
      dscp: 0,
      ecn: 0,
      totalLength: 20 + 8 + udpPayloadLen,
      identification: `0x${randomHex(2)}`,
      flags: '0x00',
      fragmentOffset: 0,
      ttl: 64,
      protocol: 17,
      protocolName: 'UDP',
      checksum: `0x${randomHex(2)}`,
      srcIp: isResponse ? dnsServer.ip : src.ip,
      dstIp: isResponse ? src.ip : dnsServer.ip,
    },
    udp: {
      srcPort: isResponse ? 53 : srcPort,
      dstPort: isResponse ? srcPort : 53,
      length: 8 + udpPayloadLen,
      checksum: `0x${randomHex(2)}`,
    },
    dns: {
      transactionId: `0x${transId.toString(16).padStart(4, '0')}`,
      flags: isResponse ? '0x8180' : '0x0100',
      isResponse,
      opcode: 'Standard query',
      questions: 1,
      answerRRs: isResponse ? 1 : 0,
      authorityRRs: 0,
      additionalRRs: 0,
      queries: [{ name: domain, type: 'A', class: 'IN' }],
      answers: isResponse
        ? [{ name: domain, type: 'A', class: 'IN', ttl: 300, dataLength: 4, address: resolvedIp }]
        : [],
    },
    hexDump: generateHexDump(rawBytes),
    rawBytes,
  };
}

function generateIcmpPacket(src: typeof HOSTS[0], dst: typeof HOSTS[0]): Packet {
  const isReply = Math.random() > 0.5;
  const seq = randomBetween(1, 256);
  const identifier = randomBetween(1, 65535);

  const icmpPayload = Array.from({ length: 32 }, () => randomBetween(0, 255));
  const etherBytes = generateEthernetBytes(src.mac, dst.mac, 0x0800);
  const ipBytes = generateIpBytes(src.ip, dst.ip, 1, 8 + icmpPayload.length);
  const icmpHeader = [isReply ? 0 : 8, 0, randomBetween(0, 255), randomBetween(0, 255),
    (identifier >> 8) & 0xff, identifier & 0xff, (seq >> 8) & 0xff, seq & 0xff];
  const rawBytes = [...etherBytes, ...ipBytes, ...icmpHeader, ...icmpPayload];

  const id = packetIdCounter++;
  const now = Date.now();

  return {
    id,
    timestamp: now,
    relativeTime: parseFloat(((now - captureStartTime) / 1000).toFixed(6)),
    length: rawBytes.length,
    capturedLength: rawBytes.length,
    protocol: 'ICMP',
    info: isReply
      ? `Echo (ping) reply    id=0x${identifier.toString(16).padStart(4, '0')}, seq=${seq}/256, ttl=64`
      : `Echo (ping) request  id=0x${identifier.toString(16).padStart(4, '0')}, seq=${seq}/256, ttl=64`,
    color: getProtocolColor('ICMP'),
    ethernet: {
      srcMac: src.mac,
      dstMac: dst.mac,
      etherType: '0x0800',
      etherTypeName: 'IPv4',
    },
    ip: {
      version: 4,
      headerLength: 20,
      dscp: 0,
      ecn: 0,
      totalLength: 20 + 8 + icmpPayload.length,
      identification: `0x${randomHex(2)}`,
      flags: '0x00',
      fragmentOffset: 0,
      ttl: 64,
      protocol: 1,
      protocolName: 'ICMP',
      checksum: `0x${randomHex(2)}`,
      srcIp: src.ip,
      dstIp: dst.ip,
    },
    icmp: {
      type: isReply ? 0 : 8,
      typeName: isReply ? 'Echo (ping) reply' : 'Echo (ping) request',
      code: 0,
      checksum: `0x${randomHex(2)}`,
      identifier,
      sequenceNumber: seq,
    },
    hexDump: generateHexDump(rawBytes),
    rawBytes,
  };
}

function generateArpPacket(src: typeof HOSTS[0]): Packet {
  const targetIp = `10.0.0.${randomBetween(1, 50)}`;
  const isReply = Math.random() > 0.7;

  const etherBytes = generateEthernetBytes(src.mac, isReply ? src.mac : BROADCAST_MAC, 0x0806);
  const arpBytes = [
    0x00, 0x01,
    0x08, 0x00,
    0x06, 0x04,
    0x00, isReply ? 0x02 : 0x01,
    ...src.mac.split(':').map(h => parseInt(h, 16)),
    ...ipToOctets(src.ip),
    ...(isReply ? src.mac : BROADCAST_MAC).split(':').map(h => parseInt(h, 16)),
    ...ipToOctets(targetIp),
  ];
  const rawBytes = [...etherBytes, ...arpBytes];

  const id = packetIdCounter++;
  const now = Date.now();

  return {
    id,
    timestamp: now,
    relativeTime: parseFloat(((now - captureStartTime) / 1000).toFixed(6)),
    length: rawBytes.length,
    capturedLength: rawBytes.length,
    protocol: 'ARP',
    info: isReply
      ? `${src.ip} is at ${src.mac}`
      : `Who has ${targetIp}? Tell ${src.ip}`,
    color: getProtocolColor('ARP'),
    ethernet: {
      srcMac: src.mac,
      dstMac: isReply ? src.mac : BROADCAST_MAC,
      etherType: '0x0806',
      etherTypeName: 'ARP',
    },
    arp: {
      hardwareType: 1,
      protocolType: '0x0800',
      hardwareSize: 6,
      protocolSize: 4,
      opcode: isReply ? 2 : 1,
      opcodeName: isReply ? 'reply' : 'request',
      senderMac: src.mac,
      senderIp: src.ip,
      targetMac: isReply ? src.mac : BROADCAST_MAC,
      targetIp: targetIp,
    },
    hexDump: generateHexDump(rawBytes),
    rawBytes,
  };
}

function generateTcpHandshakePacket(src: typeof HOSTS[0], dst: typeof HOSTS[0], phase: 'SYN' | 'SYN-ACK' | 'ACK'): Packet {
  const srcPort = randomBetween(49152, 65535);
  const dstPort = randomChoice([80, 443, 22, 25, 3306, 5432, 8080]);
  const seq = randomBetween(0, 2147483647);
  const ack = phase !== 'SYN' ? randomBetween(0, 2147483647) : 0;

  const flags = phase === 'SYN' ? 0x02 : phase === 'SYN-ACK' ? 0x12 : 0x10;
  const etherBytes = generateEthernetBytes(src.mac, dst.mac, 0x0800);
  const ipBytes = generateIpBytes(src.ip, dst.ip, 6, 20);
  const tcpBytes = generateTcpBytes(srcPort, dstPort, flags, seq);
  const rawBytes = [...etherBytes, ...ipBytes, ...tcpBytes];

  const id = packetIdCounter++;
  const now = Date.now();

  const flagStr = phase === 'SYN' ? '[SYN]' : phase === 'SYN-ACK' ? '[SYN, ACK]' : '[ACK]';
  const services: Record<number, string> = { 80: 'http', 443: 'https', 22: 'ssh', 25: 'smtp', 3306: 'mysql', 5432: 'postgresql', 8080: 'http-alt' };

  return {
    id,
    timestamp: now,
    relativeTime: parseFloat(((now - captureStartTime) / 1000).toFixed(6)),
    length: rawBytes.length,
    capturedLength: rawBytes.length,
    protocol: 'TCP',
    info: `${srcPort} → ${dstPort} ${flagStr} Seq=${seq} ${phase !== 'SYN' ? `Ack=${ack} ` : ''}Win=65535 Len=0 MSS=1460`,
    color: getProtocolColor('TCP'),
    ethernet: {
      srcMac: src.mac,
      dstMac: dst.mac,
      etherType: '0x0800',
      etherTypeName: 'IPv4',
    },
    ip: {
      version: 4,
      headerLength: 20,
      dscp: 0,
      ecn: 0,
      totalLength: 40,
      identification: `0x${randomHex(2)}`,
      flags: '0x40',
      fragmentOffset: 0,
      ttl: 64,
      protocol: 6,
      protocolName: 'TCP',
      checksum: `0x${randomHex(2)}`,
      srcIp: src.ip,
      dstIp: dst.ip,
    },
    tcp: {
      srcPort,
      dstPort,
      sequenceNumber: seq,
      acknowledgmentNumber: ack,
      dataOffset: 5,
      flags: {
        fin: false,
        syn: phase === 'SYN' || phase === 'SYN-ACK',
        rst: false,
        psh: false,
        ack: phase === 'SYN-ACK' || phase === 'ACK',
        urg: false,
      },
      windowSize: 65535,
      checksum: `0x${randomHex(2)}`,
      urgentPointer: 0,
    },
    hexDump: generateHexDump(rawBytes),
    rawBytes,
  };
}

function generateTlsPacket(src: typeof HOSTS[0], dst: typeof HOSTS[0]): Packet {
  const srcPort = randomBetween(49152, 65535);
  const dstPort = 443;
  const isClientHello = Math.random() > 0.5;
  const domains = ['github.com', 'google.com', 'cloudflare.com', 'aws.amazon.com'];
  const domain = randomChoice(domains);

  const tlsPayload = Array.from({ length: isClientHello ? 200 : 100 }, () => randomBetween(0, 255));
  const etherBytes = generateEthernetBytes(src.mac, dst.mac, 0x0800);
  const ipBytes = generateIpBytes(src.ip, dst.ip, 6, 20 + tlsPayload.length);
  const tcpBytes = generateTcpBytes(srcPort, dstPort, 0x18, randomBetween(0, 2147483647));
  const rawBytes = [...etherBytes, ...ipBytes, ...tcpBytes, ...tlsPayload];

  const id = packetIdCounter++;
  const now = Date.now();

  return {
    id,
    timestamp: now,
    relativeTime: parseFloat(((now - captureStartTime) / 1000).toFixed(6)),
    length: rawBytes.length,
    capturedLength: rawBytes.length,
    protocol: 'TLS',
    info: isClientHello
      ? `Client Hello (SNI=${domain})`
      : `Server Hello, Certificate, Server Hello Done`,
    color: getProtocolColor('TLS'),
    ethernet: {
      srcMac: src.mac,
      dstMac: dst.mac,
      etherType: '0x0800',
      etherTypeName: 'IPv4',
    },
    ip: {
      version: 4,
      headerLength: 20,
      dscp: 0,
      ecn: 0,
      totalLength: 20 + 20 + tlsPayload.length,
      identification: `0x${randomHex(2)}`,
      flags: '0x40',
      fragmentOffset: 0,
      ttl: 64,
      protocol: 6,
      protocolName: 'TCP',
      checksum: `0x${randomHex(2)}`,
      srcIp: src.ip,
      dstIp: dst.ip,
    },
    tcp: {
      srcPort,
      dstPort,
      sequenceNumber: randomBetween(0, 2147483647),
      acknowledgmentNumber: randomBetween(0, 2147483647),
      dataOffset: 5,
      flags: { fin: false, syn: false, rst: false, psh: true, ack: true, urg: false },
      windowSize: 65535,
      checksum: `0x${randomHex(2)}`,
      urgentPointer: 0,
    },
    tls: {
      contentType: 'Handshake',
      version: 'TLS 1.3',
      length: tlsPayload.length,
      handshakeType: isClientHello ? 'Client Hello' : 'Server Hello',
      cipherSuites: ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256'],
      serverName: isClientHello ? domain : undefined,
    },
    hexDump: generateHexDump(rawBytes),
    rawBytes,
  };
}

function generateUdpPacket(src: typeof HOSTS[0], dst: typeof HOSTS[0]): Packet {
  const srcPort = randomBetween(49152, 65535);
  const dstPort = randomChoice([1194, 500, 4500, 5353, 67, 68, 123, 5060]);
  const services: Record<number, string> = {
    1194: 'OpenVPN', 500: 'ISAKMP', 4500: 'NAT-T', 5353: 'mDNS',
    67: 'DHCP', 68: 'DHCP', 123: 'NTP', 5060: 'SIP',
  };
  const payload = Array.from({ length: randomBetween(20, 100) }, () => randomBetween(0, 255));
  const etherBytes = generateEthernetBytes(src.mac, dst.mac, 0x0800);
  const ipBytes = generateIpBytes(src.ip, dst.ip, 17, 8 + payload.length);
  const udpBytes = generateUdpBytes(srcPort, dstPort, payload.length);
  const rawBytes = [...etherBytes, ...ipBytes, ...udpBytes, ...payload];

  const id = packetIdCounter++;
  const now = Date.now();

  return {
    id,
    timestamp: now,
    relativeTime: parseFloat(((now - captureStartTime) / 1000).toFixed(6)),
    length: rawBytes.length,
    capturedLength: rawBytes.length,
    protocol: 'UDP',
    info: `${srcPort} → ${dstPort} ${services[dstPort] ? `(${services[dstPort]})` : ''} Len=${payload.length}`,
    color: getProtocolColor('UDP'),
    ethernet: {
      srcMac: src.mac,
      dstMac: dst.mac,
      etherType: '0x0800',
      etherTypeName: 'IPv4',
    },
    ip: {
      version: 4,
      headerLength: 20,
      dscp: 0,
      ecn: 0,
      totalLength: 20 + 8 + payload.length,
      identification: `0x${randomHex(2)}`,
      flags: '0x00',
      fragmentOffset: 0,
      ttl: 64,
      protocol: 17,
      protocolName: 'UDP',
      checksum: `0x${randomHex(2)}`,
      srcIp: src.ip,
      dstIp: dst.ip,
    },
    udp: {
      srcPort,
      dstPort,
      length: 8 + payload.length,
      checksum: `0x${randomHex(2)}`,
    },
    hexDump: generateHexDump(rawBytes),
    rawBytes,
  };
}

const STP_MAC = '01:80:c2:00:00:00';
const LLDP_MAC = '01:80:c2:00:00:0e';

// ── DHCP (DORA) ──────────────────────────────────────────────────────────────
function generateDhcpPacket(): Packet {
  const phase = randomChoice(['Discover', 'Offer', 'Request', 'ACK'] as const);
  const client = randomChoice([HOSTS[1], HOSTS[2]]);
  const server = HOSTS[0];
  const fromClient = phase === 'Discover' || phase === 'Request';
  const offered = `10.0.0.${randomBetween(100, 200)}`;
  const xid = `0x${randomHex(4)}`;

  const srcMac = fromClient ? client.mac : server.mac;
  const dstMac = phase === 'ACK' || phase === 'Offer' ? client.mac : BROADCAST_MAC;
  const srcIp = fromClient ? '0.0.0.0' : server.ip;
  const dstIp = phase === 'ACK' || phase === 'Offer' ? offered : '255.255.255.255';
  const payload = randomPayload(240);

  const ethernet = eth(srcMac, dstMac, '0x0800', 'IPv4');
  const ip = ipLayer(srcIp, dstIp, 17, 'UDP', 8 + payload.length);
  const udp = udpLayer(fromClient ? 68 : 67, fromClient ? 67 : 68, payload.length);
  const rawBytes = [
    ...generateEthernetBytes(srcMac, dstMac, 0x0800),
    ...generateIpBytes(srcIp, dstIp, 17, 8 + payload.length),
    ...generateUdpBytes(udp.srcPort, udp.dstPort, payload.length),
    ...payload,
  ];

  const fields = [
    { key: 'Message Type', value: `Boot ${fromClient ? 'Request (1)' : 'Reply (2)'}` },
    { key: 'DHCP Message Type', value: `${phase}` },
    { key: 'Transaction ID', value: xid },
    { key: 'Client MAC', value: client.mac },
    { key: 'Your (client) IP', value: phase === 'Offer' || phase === 'ACK' ? offered : '0.0.0.0' },
    { key: 'DHCP Server ID', value: server.ip },
    { key: 'Subnet Mask', value: '255.255.255.0' },
    { key: 'Router', value: server.ip },
    { key: 'Domain Name Server', value: '8.8.8.8, 1.1.1.1' },
    { key: 'IP Address Lease Time', value: '86400s (1 day)' },
  ];

  return makePacket({
    protocol: 'DHCP',
    info: `DHCP ${phase} - Transaction ID ${xid}${phase === 'Offer' || phase === 'ACK' ? ` - ${offered}` : ''}`,
    ethernet, ip, udp, rawBytes,
    protoViews: [{ name: 'Dynamic Host Configuration Protocol', summary: `(${phase})`, fields }],
  });
}

// ── STP / Spanning Tree (BPDU) ───────────────────────────────────────────────
function generateStpPacket(): Packet {
  const sw = randomChoice([HOSTS[4], HOSTS[0]]);
  const rootPriority = 32768;
  const rootMac = '00:1a:2b:3c:4d:00';
  const cost = randomChoice([0, 4, 19, 23]);
  const portId = `0x800${randomBetween(1, 9)}`;
  const payload = randomPayload(35);
  const ethernet = eth(sw.mac, STP_MAC, '0x0026', 'IEEE 802.3 / LLC');
  const rawBytes = [...generateEthernetBytes(sw.mac, STP_MAC, 0x0026), ...payload];

  return makePacket({
    protocol: 'STP',
    info: `Conf. Root = ${rootPriority}/${rootMac}  Cost = ${cost}  Port = ${portId}`,
    ethernet, rawBytes,
    protoViews: [{
      name: 'Spanning Tree Protocol', summary: '(Configuration BPDU)',
      fields: [
        { key: 'Protocol Identifier', value: 'Spanning Tree Protocol (0x0000)' },
        { key: 'Protocol Version', value: 'Rapid Spanning Tree (2)' },
        { key: 'BPDU Type', value: 'Rapid/Multiple (0x02)' },
        { key: 'Root Identifier', value: `${rootPriority} / ${rootMac}` },
        { key: 'Root Path Cost', value: String(cost) },
        { key: 'Bridge Identifier', value: `${rootPriority} / ${sw.mac}` },
        { key: 'Port Identifier', value: portId },
        { key: 'Message Age', value: '0' },
        { key: 'Max Age', value: '20' },
        { key: 'Hello Time', value: '2' },
        { key: 'Forward Delay', value: '15' },
      ],
    }],
  });
}

// ── LLDP (Link Layer Discovery) ──────────────────────────────────────────────
function generateLldpPacket(): Packet {
  const dev = randomChoice([HOSTS[0], HOSTS[4]]);
  const port = `Gi0/${randomBetween(1, 24)}`;
  const payload = randomPayload(80);
  const ethernet = eth(dev.mac, LLDP_MAC, '0x88cc', 'LLDP');
  const rawBytes = [...generateEthernetBytes(dev.mac, LLDP_MAC, 0x88cc), ...payload];

  return makePacket({
    protocol: 'LLDP',
    info: `${dev.name} Port ${port} TTL=120`,
    ethernet, rawBytes,
    protoViews: [{
      name: 'Link Layer Discovery Protocol',
      fields: [
        { key: 'Chassis ID', value: `MAC address (${dev.mac})` },
        { key: 'Port ID', value: `Interface name (${port})` },
        { key: 'Time To Live', value: '120 seconds' },
        { key: 'System Name', value: dev.name },
        { key: 'System Description', value: 'Cisco IOS Software, C2960' },
        { key: 'Capabilities', value: 'Bridge, Router' },
      ],
    }],
  });
}

// ── NTP ──────────────────────────────────────────────────────────────────────
function generateNtpPacket(): Packet {
  const isClient = Math.random() > 0.5;
  const src = isClient ? randomChoice([HOSTS[1], HOSTS[2]]) : HOSTS[0];
  const dst = isClient ? HOSTS[0] : randomChoice([HOSTS[1], HOSTS[2]]);
  const payload = randomPayload(48);
  const ethernet = eth(src.mac, dst.mac, '0x0800', 'IPv4');
  const ip = ipLayer(src.ip, dst.ip, 17, 'UDP', 8 + payload.length);
  const udp = udpLayer(123, 123, payload.length);
  const rawBytes = [
    ...generateEthernetBytes(src.mac, dst.mac, 0x0800),
    ...generateIpBytes(src.ip, dst.ip, 17, 8 + payload.length),
    ...generateUdpBytes(123, 123, payload.length), ...payload,
  ];
  return makePacket({
    protocol: 'NTP', info: `NTP Version 4, ${isClient ? 'client' : 'server'}`,
    ethernet, ip, udp, rawBytes,
    protoViews: [{
      name: 'Network Time Protocol', summary: `(${isClient ? 'client' : 'server'})`,
      fields: [
        { key: 'Leap Indicator', value: 'no warning (0)' },
        { key: 'Version', value: '4' },
        { key: 'Mode', value: isClient ? 'client (3)' : 'server (4)' },
        { key: 'Stratum', value: isClient ? 'unspecified (0)' : 'secondary reference (2)' },
        { key: 'Reference ID', value: '129.6.15.28' },
      ],
    }],
  });
}

// ── SNMP ─────────────────────────────────────────────────────────────────────
function generateSnmpPacket(): Packet {
  const pdu = randomChoice(['get-request', 'get-next-request', 'get-response', 'trap']);
  const src = randomChoice([HOSTS[0], HOSTS[4]]);
  const dst = HOSTS[3];
  const payload = randomPayload(60);
  const port = pdu === 'trap' ? 162 : 161;
  const ethernet = eth(src.mac, dst.mac, '0x0800', 'IPv4');
  const ip = ipLayer(src.ip, dst.ip, 17, 'UDP', 8 + payload.length);
  const udp = udpLayer(randomBetween(49152, 65535), port, payload.length);
  const rawBytes = [
    ...generateEthernetBytes(src.mac, dst.mac, 0x0800),
    ...generateIpBytes(src.ip, dst.ip, 17, 8 + payload.length),
    ...generateUdpBytes(udp.srcPort, port, payload.length), ...payload,
  ];
  return makePacket({
    protocol: 'SNMP', info: `${pdu}  1.3.6.1.2.1.1.3.0`,
    ethernet, ip, udp, rawBytes,
    protoViews: [{
      name: 'Simple Network Management Protocol', summary: `(${pdu})`,
      fields: [
        { key: 'Version', value: 'v2c (1)' },
        { key: 'Community', value: 'public' },
        { key: 'PDU Type', value: pdu },
        { key: 'Request ID', value: String(randomBetween(1, 99999)) },
        { key: 'Object Identifier', value: '1.3.6.1.2.1.1.3.0 (sysUpTime)' },
      ],
    }],
  });
}

// ── OSPF ─────────────────────────────────────────────────────────────────────
function generateOspfPacket(): Packet {
  const src = randomChoice([HOSTS[0], HOSTS[4]]);
  const dst = '224.0.0.5';
  const payload = randomPayload(44);
  const ethernet = eth(src.mac, '01:00:5e:00:00:05', '0x0800', 'IPv4');
  const ip = ipLayer(src.ip, dst, 89, 'OSPF', payload.length, 1);
  const rawBytes = [
    ...generateEthernetBytes(src.mac, '01:00:5e:00:00:05', 0x0800),
    ...generateIpBytes(src.ip, dst, 89, payload.length), ...payload,
  ];
  return makePacket({
    protocol: 'OSPF', info: 'Hello Packet',
    ethernet, ip, rawBytes,
    protoViews: [{
      name: 'Open Shortest Path First', summary: '(Hello Packet)',
      fields: [
        { key: 'Version', value: '2' },
        { key: 'Message Type', value: 'Hello Packet (1)' },
        { key: 'Source OSPF Router', value: src.ip },
        { key: 'Area ID', value: '0.0.0.0 (backbone)' },
        { key: 'Hello Interval', value: '10 seconds' },
        { key: 'Router Dead Interval', value: '40 seconds' },
      ],
    }],
  });
}

// ── SSDP (UPnP discovery) ────────────────────────────────────────────────────
function generateSsdpPacket(): Packet {
  const isSearch = Math.random() > 0.5;
  const src = randomChoice([HOSTS[1], HOSTS[2]]);
  const dst = '239.255.255.250';
  const payload = randomPayload(120);
  const ethernet = eth(src.mac, '01:00:5e:7f:ff:fa', '0x0800', 'IPv4');
  const ip = ipLayer(src.ip, dst, 17, 'UDP', 8 + payload.length);
  const udp = udpLayer(randomBetween(49152, 65535), 1900, payload.length);
  const rawBytes = [
    ...generateEthernetBytes(src.mac, '01:00:5e:7f:ff:fa', 0x0800),
    ...generateIpBytes(src.ip, dst, 17, 8 + payload.length),
    ...generateUdpBytes(udp.srcPort, 1900, payload.length), ...payload,
  ];
  return makePacket({
    protocol: 'SSDP', info: isSearch ? 'M-SEARCH * HTTP/1.1' : 'NOTIFY * HTTP/1.1',
    ethernet, ip, udp, rawBytes,
    protoViews: [{
      name: 'Simple Service Discovery Protocol',
      fields: [
        { key: 'Method', value: isSearch ? 'M-SEARCH' : 'NOTIFY' },
        { key: 'Host', value: '239.255.255.250:1900' },
        { key: isSearch ? 'ST' : 'NT', value: 'ssdp:all' },
        { key: 'Man', value: isSearch ? '"ssdp:discover"' : '—' },
      ],
    }],
  });
}

// ── mDNS ─────────────────────────────────────────────────────────────────────
function generateMdnsPacket(): Packet {
  const src = randomChoice([HOSTS[1], HOSTS[2], HOSTS[3]]);
  const names = ['_services._dns-sd._udp.local', '_airplay._tcp.local', '_ipp._tcp.local', `${src.name}.local`];
  const name = randomChoice(names);
  const payload = randomPayload(40);
  const ethernet = eth(src.mac, '01:00:5e:00:00:fb', '0x0800', 'IPv4');
  const ip = ipLayer(src.ip, '224.0.0.251', 17, 'UDP', 8 + payload.length);
  const udp = udpLayer(5353, 5353, payload.length);
  const rawBytes = [
    ...generateEthernetBytes(src.mac, '01:00:5e:00:00:fb', 0x0800),
    ...generateIpBytes(src.ip, '224.0.0.251', 17, 8 + payload.length),
    ...generateUdpBytes(5353, 5353, payload.length), ...payload,
  ];
  return makePacket({
    protocol: 'mDNS', info: `Standard query 0x0000 PTR ${name}`,
    ethernet, ip, udp, rawBytes,
    protoViews: [{
      name: 'Multicast DNS',
      fields: [
        { key: 'Transaction ID', value: '0x0000' },
        { key: 'Type', value: 'Standard query' },
        { key: 'Question', value: `${name}  PTR  IN` },
      ],
    }],
  });
}

// ── SIP (VoIP signalling) ────────────────────────────────────────────────────
function generateSipPacket(): Packet {
  const method = randomChoice(['REGISTER', 'INVITE', 'ACK', 'BYE', '200 OK', '100 Trying']);
  const src = randomChoice([HOSTS[1], HOSTS[2]]);
  const dst = HOSTS[3];
  const payload = randomPayload(150);
  const ethernet = eth(src.mac, dst.mac, '0x0800', 'IPv4');
  const ip = ipLayer(src.ip, dst.ip, 17, 'UDP', 8 + payload.length);
  const udp = udpLayer(5060, 5060, payload.length);
  const rawBytes = [
    ...generateEthernetBytes(src.mac, dst.mac, 0x0800),
    ...generateIpBytes(src.ip, dst.ip, 17, 8 + payload.length),
    ...generateUdpBytes(5060, 5060, payload.length), ...payload,
  ];
  const isResp = method.includes('OK') || method.includes('Trying');
  return makePacket({
    protocol: 'SIP', info: isResp ? `Status: ${method}` : `Request: ${method} sip:user@${dst.ip}`,
    ethernet, ip, udp, rawBytes,
    protoViews: [{
      name: 'Session Initiation Protocol', summary: `(${method})`,
      fields: [
        { key: isResp ? 'Status-Line' : 'Request-Line', value: isResp ? `SIP/2.0 ${method}` : `${method} sip:user@${dst.ip} SIP/2.0` },
        { key: 'From', value: `sip:${src.name}@${src.ip}` },
        { key: 'To', value: `sip:user@${dst.ip}` },
        { key: 'Call-ID', value: `${randomHex(8)}@${src.ip}` },
        { key: 'CSeq', value: `${randomBetween(1, 999)} ${isResp ? 'INVITE' : method}` },
      ],
    }],
  });
}

function generateRandomPacket(): Packet {
  const src = randomChoice(HOSTS.slice(0, 5));
  let dst = randomChoice(HOSTS);
  while (dst.ip === src.ip) dst = randomChoice(HOSTS);

  const roll = Math.random();
  // Core IP traffic (~60%)
  if (roll < 0.16) return generateHttpPacket(src, dst);
  if (roll < 0.28) return generateDnsPacket(src);
  if (roll < 0.36) return generateTlsPacket(src, dst);
  if (roll < 0.42) return generateIcmpPacket(src, dst);
  if (roll < 0.50) return generateTcpHandshakePacket(src, dst, randomChoice<'SYN' | 'SYN-ACK' | 'ACK'>(['SYN', 'SYN-ACK', 'ACK']));
  if (roll < 0.56) return generateUdpPacket(src, dst);
  if (roll < 0.60) return generateArpPacket(src);
  // Infrastructure & control-plane traffic (~40%)
  if (roll < 0.70) return generateDhcpPacket();
  if (roll < 0.78) return generateStpPacket();
  if (roll < 0.83) return generateLldpPacket();
  if (roll < 0.88) return generateMdnsPacket();
  if (roll < 0.91) return generateNtpPacket();
  if (roll < 0.94) return generateSnmpPacket();
  if (roll < 0.97) return generateOspfPacket();
  if (roll < 0.99) return generateSsdpPacket();
  return generateSipPacket();
}

// Seed a representative mix so every protocol is visible immediately on start
function seedInitialPackets(): void {
  const client = HOSTS[1];
  const web = HOSTS[7];
  const seeds: Packet[] = [
    generateDhcpPacket(),
    generateStpPacket(),
    generateArpPacket(client),
    generateDnsPacket(client),
    generateTcpHandshakePacket(client, web, 'SYN'),
    generateTcpHandshakePacket(web, client, 'SYN-ACK'),
    generateTlsPacket(client, web),
    generateHttpPacket(client, web),
    generateLldpPacket(),
    generateMdnsPacket(),
    generateNtpPacket(),
    generateSnmpPacket(),
    generateOspfPacket(),
    generateSsdpPacket(),
    generateSipPacket(),
    generateIcmpPacket(client, HOSTS[0]),
  ];
  for (const p of seeds) packetBuffer.push(p);
}

export function startCapture(): void {
  if (isCapturing) return;
  isCapturing = true;
  captureStartTime = Date.now();
  packetIdCounter = 1;
  packetBuffer.length = 0;
  seedInitialPackets();

  const addPacket = () => {
    if (!isCapturing) return;
    const packet = generateRandomPacket();
    packetBuffer.push(packet);
    if (packetBuffer.length > 10000) packetBuffer.shift();
    const delay = randomBetween(50, 500);
    captureInterval = setTimeout(addPacket, delay);
  };
  addPacket();
}

export function stopCapture(): void {
  isCapturing = false;
  if (captureInterval) {
    clearTimeout(captureInterval);
    captureInterval = null;
  }
}

export function clearPackets(): void {
  packetBuffer.length = 0;
  packetIdCounter = 1;
  captureStartTime = Date.now();
}

export function getPackets(since?: number, limit = 200): Packet[] {
  if (since !== undefined) {
    return packetBuffer.filter(p => p.id > since).slice(-limit);
  }
  return packetBuffer.slice(-limit);
}

export function getPacketById(id: number): Packet | undefined {
  return packetBuffer.find(p => p.id === id);
}

export function getStats(): PacketStats {
  const byProtocol: Record<string, number> = {};
  let bytesTotal = 0;

  for (const p of packetBuffer) {
    byProtocol[p.protocol] = (byProtocol[p.protocol] || 0) + 1;
    bytesTotal += p.length;
  }

  const duration = (Date.now() - captureStartTime) / 1000;
  return {
    total: packetBuffer.length,
    byProtocol,
    bytesTotal,
    startTime: captureStartTime,
    duration,
    packetsPerSecond: duration > 0 ? packetBuffer.length / duration : 0,
    bytesPerSecond: duration > 0 ? bytesTotal / duration : 0,
  };
}

export function isRunning(): boolean {
  return isCapturing;
}
