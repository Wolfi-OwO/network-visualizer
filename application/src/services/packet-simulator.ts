import {
  Packet, PacketStats, EthernetLayer, IpLayer, TcpLayer, UdpLayer, ProtoView,
} from '../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Realistic packet-capture simulator.
//
// Rather than emitting independent random packets, this models real *flows*:
//   • TCP connections with a correct 3-way handshake, consistent seq/ack that
//     advance by payload length, data exchange, and FIN teardown.
//   • DNS lookups that precede web connections, with matching transaction IDs.
//   • DHCP DORA, ARP request/reply, ICMP echo request/reply pairs.
//   • Correct L2 next-hop MACs (off-subnet traffic is addressed to the gateway).
//   • Real IPv4 / TCP / UDP / ICMP checksums computed over the actual bytes.
//   • Bursty, heavy-tailed session arrivals (self-similar-ish) instead of a flat
//     uniform inter-packet delay.
// ─────────────────────────────────────────────────────────────────────────────

interface Host {
  ip: string;
  mac: string;
  name: string;
  kind: 'gateway' | 'client' | 'server' | 'dns' | 'internet';
}

const GATEWAY: Host = { ip: '10.0.0.1', mac: '00:1a:2b:3c:4d:01', name: 'gateway', kind: 'gateway' };

const CLIENTS: Host[] = [
  { ip: '10.0.0.10', mac: '00:1a:2b:3c:4d:10', name: 'pc1', kind: 'client' },
  { ip: '10.0.0.11', mac: '00:1a:2b:3c:4d:11', name: 'pc2', kind: 'client' },
  { ip: '10.0.0.12', mac: '00:1a:2b:3c:4d:12', name: 'laptop', kind: 'client' },
];

const LOCAL_SERVERS: Host[] = [
  { ip: '10.0.0.20', mac: '00:1a:2b:3c:4d:20', name: 'intranet', kind: 'server' },
  { ip: '10.0.0.21', mac: '00:1a:2b:3c:4d:21', name: 'fileserver', kind: 'server' },
];

const DNS_SERVERS: Host[] = [
  { ip: '8.8.8.8', mac: 'aa:bb:cc:dd:ee:ff', name: 'dns-google', kind: 'dns' },
  { ip: '1.1.1.1', mac: 'aa:bb:cc:00:11:22', name: 'dns-cloudflare', kind: 'dns' },
];

const INTERNET: Host[] = [
  { ip: '93.184.216.34', mac: 'bb:cc:dd:ee:ff:00', name: 'example.com', kind: 'internet' },
  { ip: '151.101.1.140', mac: 'cc:dd:ee:ff:00:11', name: 'fastly-cdn', kind: 'internet' },
  { ip: '172.217.23.110', mac: 'dd:ee:ff:00:11:22', name: 'google', kind: 'internet' },
  { ip: '140.82.121.4', mac: 'ee:ff:00:11:22:33', name: 'github', kind: 'internet' },
];

const BROADCAST_MAC = 'ff:ff:ff:ff:ff:ff';

// ── Capture state ────────────────────────────────────────────────────────────
let packetIdCounter = 1;
let captureStartTime = Date.now();
const packetBuffer: Packet[] = [];
let isCapturing = false;
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

// Scheduled-but-not-yet-emitted packets (id assigned at flush time, in order).
interface Pending { at: number; pkt: Packet }
let pending: Pending[] = [];

// Periodic control-plane next-due timestamps (ms epoch).
const nextDue: Record<string, number> = {};

// ── Small helpers ────────────────────────────────────────────────────────────
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function hex16(n: number): string {
  return `0x${(n & 0xffff).toString(16).padStart(4, '0')}`;
}
function ipToOctets(ip: string): number[] {
  return ip.split('.').map(Number);
}
function macToBytes(mac: string): number[] {
  return mac.split(':').map((h) => parseInt(h, 16));
}
function isLocal(ip: string): boolean {
  return ip.startsWith('10.0.0.');
}

// Round-trip time (ms) between two endpoints: tiny on the LAN, larger off-net.
function rtt(a: Host, b: Host): number {
  const offNet = a.kind === 'internet' || b.kind === 'internet'
    || a.kind === 'dns' || b.kind === 'dns';
  return offNet ? randFloat(8, 45) : randFloat(0.2, 1.4);
}

// ── Checksums (real ones, computed over the actual bytes) ────────────────────
function onesComplement16(bytes: number[]): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    sum += ((bytes[i] << 8) | (bytes[i + 1] ?? 0)) >>> 0;
  }
  while (sum > 0xffff) sum = (sum & 0xffff) + (sum >>> 16);
  return (~sum) & 0xffff;
}

// ── Byte builders ────────────────────────────────────────────────────────────
function ethernetBytes(srcMac: string, dstMac: string, etherType: number): number[] {
  return [...macToBytes(dstMac), ...macToBytes(srcMac), (etherType >> 8) & 0xff, etherType & 0xff];
}

function ipv4Header(srcIp: string, dstIp: string, proto: number, payloadLen: number, ttl: number, id: number): { bytes: number[]; checksum: number } {
  const totalLength = 20 + payloadLen;
  const header = [
    0x45, 0x00,
    (totalLength >> 8) & 0xff, totalLength & 0xff,
    (id >> 8) & 0xff, id & 0xff,
    0x40, 0x00,            // DF set, no fragment
    ttl & 0xff, proto,
    0x00, 0x00,            // checksum placeholder
    ...ipToOctets(srcIp),
    ...ipToOctets(dstIp),
  ];
  const checksum = onesComplement16(header);
  header[10] = (checksum >> 8) & 0xff;
  header[11] = checksum & 0xff;
  return { bytes: header, checksum };
}

function pseudoHeader(srcIp: string, dstIp: string, proto: number, transportLen: number): number[] {
  return [
    ...ipToOctets(srcIp), ...ipToOctets(dstIp),
    0x00, proto, (transportLen >> 8) & 0xff, transportLen & 0xff,
  ];
}

function tcpSegment(srcPort: number, dstPort: number, seq: number, ack: number, flagsByte: number, window: number, payload: number[], srcIp: string, dstIp: string): { bytes: number[]; checksum: number } {
  const header = [
    (srcPort >> 8) & 0xff, srcPort & 0xff,
    (dstPort >> 8) & 0xff, dstPort & 0xff,
    (seq >>> 24) & 0xff, (seq >>> 16) & 0xff, (seq >>> 8) & 0xff, seq & 0xff,
    (ack >>> 24) & 0xff, (ack >>> 16) & 0xff, (ack >>> 8) & 0xff, ack & 0xff,
    0x50, flagsByte,                       // data offset 5 (no options)
    (window >> 8) & 0xff, window & 0xff,
    0x00, 0x00,                            // checksum placeholder
    0x00, 0x00,                            // urgent pointer
  ];
  const segment = [...header, ...payload];
  const sumInput = [...pseudoHeader(srcIp, dstIp, 6, segment.length), ...segment];
  if (sumInput.length % 2 !== 0) sumInput.push(0);
  const checksum = onesComplement16(sumInput);
  segment[16] = (checksum >> 8) & 0xff;
  segment[17] = checksum & 0xff;
  return { bytes: segment, checksum };
}

function udpDatagram(srcPort: number, dstPort: number, payload: number[], srcIp: string, dstIp: string): { bytes: number[]; checksum: number } {
  const length = 8 + payload.length;
  const header = [
    (srcPort >> 8) & 0xff, srcPort & 0xff,
    (dstPort >> 8) & 0xff, dstPort & 0xff,
    (length >> 8) & 0xff, length & 0xff,
    0x00, 0x00,                            // checksum placeholder
  ];
  const datagram = [...header, ...payload];
  const sumInput = [...pseudoHeader(srcIp, dstIp, 17, datagram.length), ...datagram];
  if (sumInput.length % 2 !== 0) sumInput.push(0);
  let checksum = onesComplement16(sumInput);
  if (checksum === 0) checksum = 0xffff;
  datagram[6] = (checksum >> 8) & 0xff;
  datagram[7] = checksum & 0xff;
  return { bytes: datagram, checksum };
}

function generateHexDump(bytes: number[]): string[] {
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const chunk = bytes.slice(i, i + 16);
    const offset = i.toString(16).padStart(4, '0');
    const hex = chunk.map((b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(47, ' ');
    const ascii = chunk.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
    lines.push(`${offset}  ${hex}  ${ascii}`);
  }
  return lines;
}

function getProtocolColor(protocol: string): string {
  const colors: Record<string, string> = {
    HTTP: '#1b4332', HTTPS: '#0d3b2e', DNS: '#1a3a5c', mDNS: '#16304a',
    TCP: '#1a1a2e', UDP: '#3d3300', ICMP: '#4a1020', ARP: '#3d3200',
    TLS: '#2d1b4e', SSH: '#1a2e1a', SMTP: '#2e1a2e', DHCP: '#103d3a',
    STP: '#3a2a10', NTP: '#10303d', LLDP: '#2a103d', SNMP: '#3d1030',
    OSPF: '#103d1a', SSDP: '#2a2a3d', SIP: '#3d2010',
  };
  return colors[protocol] || '#1a1a1a';
}

// Next-hop L2 addressing: off-subnet traffic is delivered to the gateway MAC.
function nextHopMacs(src: Host, dst: Host): { srcMac: string; dstMac: string } {
  if (isLocal(src.ip) && isLocal(dst.ip)) return { srcMac: src.mac, dstMac: dst.mac };
  // crossing the router: the on-LAN peer MAC is the gateway
  if (isLocal(src.ip)) return { srcMac: src.mac, dstMac: GATEWAY.mac };
  return { srcMac: GATEWAY.mac, dstMac: dst.mac };
}

function ttlFor(src: Host): number {
  // Replies coming back in from the internet have a decremented TTL.
  return src.kind === 'internet' || src.kind === 'dns' ? randInt(48, 58) : 64;
}

// ── Packet assembly ──────────────────────────────────────────────────────────
function schedule(at: number, pkt: Packet): void {
  pending.push({ at, pkt });
}

function baseIpLayer(srcIp: string, dstIp: string, proto: number, protoName: string, payloadLen: number, ttl: number, id: number, checksum: number): IpLayer {
  return {
    version: 4, headerLength: 20, dscp: 0, ecn: 0,
    totalLength: 20 + payloadLen, identification: hex16(id),
    flags: '0x40', fragmentOffset: 0, ttl, protocol: proto, protocolName: protoName,
    checksum: hex16(checksum), srcIp, dstIp,
  };
}

interface TcpOpts {
  at: number; src: Host; dst: Host; srcPort: number; dstPort: number;
  seq: number; ack: number;
  flags: { syn?: boolean; ack?: boolean; psh?: boolean; fin?: boolean; rst?: boolean; urg?: boolean };
  window?: number; payload?: number[];
  protocol: string; info: string; http?: Packet['http']; tls?: Packet['tls'];
}

function emitTcp(o: TcpOpts): void {
  const payload = o.payload ?? [];
  const window = o.window ?? 64240;
  const ipId = randInt(0, 0xffff);
  const ttl = ttlFor(o.src);
  const flagsByte =
    (o.flags.fin ? 0x01 : 0) | (o.flags.syn ? 0x02 : 0) | (o.flags.rst ? 0x04 : 0)
    | (o.flags.psh ? 0x08 : 0) | (o.flags.ack ? 0x10 : 0) | (o.flags.urg ? 0x20 : 0);

  const seg = tcpSegment(o.srcPort, o.dstPort, o.seq, o.ack, flagsByte, window, payload, o.src.ip, o.dst.ip);
  const ipH = ipv4Header(o.src.ip, o.dst.ip, 6, seg.bytes.length, ttl, ipId);
  const { srcMac, dstMac } = nextHopMacs(o.src, o.dst);
  const rawBytes = [...ethernetBytes(srcMac, dstMac, 0x0800), ...ipH.bytes, ...seg.bytes];

  const ethernet: EthernetLayer = { srcMac, dstMac, etherType: '0x0800', etherTypeName: 'IPv4' };
  const tcp: TcpLayer = {
    srcPort: o.srcPort, dstPort: o.dstPort, sequenceNumber: o.seq, acknowledgmentNumber: o.ack,
    dataOffset: 5,
    flags: {
      fin: !!o.flags.fin, syn: !!o.flags.syn, rst: !!o.flags.rst,
      psh: !!o.flags.psh, ack: !!o.flags.ack, urg: !!o.flags.urg,
    },
    windowSize: window, checksum: hex16(seg.checksum), urgentPointer: 0,
  };

  schedule(o.at, {
    id: 0, timestamp: o.at, relativeTime: 0,
    length: rawBytes.length, capturedLength: rawBytes.length,
    protocol: o.protocol, info: o.info, color: getProtocolColor(o.protocol),
    ethernet, ip: baseIpLayer(o.src.ip, o.dst.ip, 6, 'TCP', seg.bytes.length, ttl, ipId, ipH.checksum),
    tcp, http: o.http, tls: o.tls,
    hexDump: generateHexDump(rawBytes), rawBytes,
  });
}

interface UdpOpts {
  at: number; src: Host; dst: Host; srcPort: number; dstPort: number; payload: number[];
  protocol: string; info: string; dns?: Packet['dns']; protoViews?: ProtoView[];
  multicastMac?: string;
}

function emitUdp(o: UdpOpts): void {
  const ipId = randInt(0, 0xffff);
  const ttl = ttlFor(o.src);
  const dg = udpDatagram(o.srcPort, o.dstPort, o.payload, o.src.ip, o.dst.ip);
  const ipH = ipv4Header(o.src.ip, o.dst.ip, 17, dg.bytes.length, ttl, ipId);
  const { srcMac, dstMac } = o.multicastMac
    ? { srcMac: o.src.mac, dstMac: o.multicastMac }
    : nextHopMacs(o.src, o.dst);
  const rawBytes = [...ethernetBytes(srcMac, dstMac, 0x0800), ...ipH.bytes, ...dg.bytes];

  const udp: UdpLayer = { srcPort: o.srcPort, dstPort: o.dstPort, length: 8 + o.payload.length, checksum: hex16(dg.checksum) };

  schedule(o.at, {
    id: 0, timestamp: o.at, relativeTime: 0,
    length: rawBytes.length, capturedLength: rawBytes.length,
    protocol: o.protocol, info: o.info, color: getProtocolColor(o.protocol),
    ethernet: { srcMac, dstMac, etherType: '0x0800', etherTypeName: 'IPv4' },
    ip: baseIpLayer(o.src.ip, o.dst.ip, 17, 'UDP', dg.bytes.length, ttl, ipId, ipH.checksum),
    udp, dns: o.dns, protoViews: o.protoViews,
    hexDump: generateHexDump(rawBytes), rawBytes,
  });
}

function bytesOf(s: string): number[] {
  return Array.from(s).map((c) => c.charCodeAt(0));
}
function randomPayload(len: number): number[] {
  return Array.from({ length: len }, () => randInt(0, 255));
}

// ── DNS lookup (query → response, matching transaction id) ───────────────────
function emitDnsLookup(at: number, client: Host, resolver: Host, domain: string, resolvedIp: string): number {
  const txid = randInt(0, 0xffff);
  const sport = randInt(49152, 65535);
  emitUdp({
    at, src: client, dst: resolver, srcPort: sport, dstPort: 53, payload: randomPayload(28),
    protocol: 'DNS', info: `Standard query ${hex16(txid)} A ${domain}`,
    dns: {
      transactionId: hex16(txid), flags: '0x0100', isResponse: false, opcode: 'Standard query',
      questions: 1, answerRRs: 0, authorityRRs: 0, additionalRRs: 0,
      queries: [{ name: domain, type: 'A', class: 'IN' }], answers: [],
    },
  });
  const respAt = at + rtt(client, resolver);
  emitUdp({
    at: respAt, src: resolver, dst: client, srcPort: 53, dstPort: sport, payload: randomPayload(60),
    protocol: 'DNS', info: `Standard query response ${hex16(txid)} A ${domain} A ${resolvedIp}`,
    dns: {
      transactionId: hex16(txid), flags: '0x8180', isResponse: true, opcode: 'Standard query',
      questions: 1, answerRRs: 1, authorityRRs: 0, additionalRRs: 0,
      queries: [{ name: domain, type: 'A', class: 'IN' }],
      answers: [{ name: domain, type: 'A', class: 'IN', ttl: 300, dataLength: 4, address: resolvedIp }],
    },
  });
  return respAt;
}

// ── A full TCP web session: handshake → request/response(s) → teardown ───────
function emitWebSession(startAt: number, client: Host, server: Host, secure: boolean): void {
  const sport = randInt(49152, 65535);
  const dport = secure ? 443 : 80;
  const r = rtt(client, server);
  let cSeq = randInt(0, 0xffffffff) >>> 0;   // client ISN
  let sSeq = randInt(0, 0xffffffff) >>> 0;   // server ISN
  let t = startAt;

  // 3-way handshake (SYN consumes one sequence number on each side)
  emitTcp({ at: t, src: client, dst: server, srcPort: sport, dstPort: dport, seq: cSeq, ack: 0, flags: { syn: true }, window: 64240, protocol: 'TCP', info: `${sport} → ${dport} [SYN] Seq=${cSeq} Win=64240 Len=0 MSS=1460` });
  t += r / 2;
  emitTcp({ at: t, src: server, dst: client, srcPort: dport, dstPort: sport, seq: sSeq, ack: (cSeq + 1) >>> 0, flags: { syn: true, ack: true }, window: 65160, protocol: 'TCP', info: `${dport} → ${sport} [SYN, ACK] Seq=${sSeq} Ack=${(cSeq + 1) >>> 0} Win=65160 Len=0 MSS=1460` });
  cSeq = (cSeq + 1) >>> 0;
  sSeq = (sSeq + 1) >>> 0;
  t += r / 2;
  emitTcp({ at: t, src: client, dst: server, srcPort: sport, dstPort: dport, seq: cSeq, ack: sSeq, flags: { ack: true }, protocol: 'TCP', info: `${sport} → ${dport} [ACK] Seq=${cSeq} Ack=${sSeq} Win=64240 Len=0` });

  const rounds = randInt(1, 3);   // keep-alive request/response rounds
  for (let i = 0; i < rounds; i++) {
    t += randFloat(0.1, 1.5);
    if (secure && i === 0) {
      // TLS Client Hello / Server Hello
      const domain = server.name;
      const chPayload = randomPayload(180);
      emitTcp({
        at: t, src: client, dst: server, srcPort: sport, dstPort: dport, seq: cSeq, ack: sSeq,
        flags: { psh: true, ack: true }, payload: chPayload, protocol: 'TLS',
        info: `Client Hello (SNI=${domain})`,
        tls: { contentType: 'Handshake', version: 'TLS 1.3', length: chPayload.length, handshakeType: 'Client Hello', cipherSuites: ['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256'], serverName: domain },
      });
      cSeq = (cSeq + chPayload.length) >>> 0;
      t += r;
      const shPayload = randomPayload(220);
      emitTcp({
        at: t, src: server, dst: client, srcPort: dport, dstPort: sport, seq: sSeq, ack: cSeq,
        flags: { psh: true, ack: true }, payload: shPayload, protocol: 'TLS',
        info: 'Server Hello, Change Cipher Spec, Encrypted Extensions, Certificate',
        tls: { contentType: 'Handshake', version: 'TLS 1.3', length: shPayload.length, handshakeType: 'Server Hello' },
      });
      sSeq = (sSeq + shPayload.length) >>> 0;
      t += r / 2;
      emitTcp({ at: t, src: client, dst: server, srcPort: sport, dstPort: dport, seq: cSeq, ack: sSeq, flags: { ack: true }, protocol: 'TCP', info: `${sport} → ${dport} [ACK] Seq=${cSeq} Ack=${sSeq} Win=64240 Len=0` });
      continue;
    }

    // Plain HTTP request / response (or app data inside an established TLS conn)
    const method = pick(['GET', 'GET', 'GET', 'POST']);
    const uri = pick(['/', '/index.html', '/api/data', '/assets/app.js', '/style.css', '/favicon.ico']);
    const reqText = `${method} ${uri} HTTP/1.1\r\nHost: ${server.name}\r\nUser-Agent: Mozilla/5.0\r\nAccept: */*\r\n\r\n`;
    const reqPayload = bytesOf(reqText);
    emitTcp({
      at: t, src: client, dst: server, srcPort: sport, dstPort: dport, seq: cSeq, ack: sSeq,
      flags: { psh: true, ack: true }, payload: reqPayload,
      protocol: secure ? 'TLS' : 'HTTP', info: secure ? 'Application Data' : `${method} ${uri} HTTP/1.1`,
      http: secure ? undefined : { isRequest: true, method, uri, version: 'HTTP/1.1', headers: { Host: server.name, 'User-Agent': 'Mozilla/5.0', Accept: '*/*' } },
    });
    cSeq = (cSeq + reqPayload.length) >>> 0;

    // server ACK of the request
    t += r;
    emitTcp({ at: t, src: server, dst: client, srcPort: dport, dstPort: sport, seq: sSeq, ack: cSeq, flags: { ack: true }, protocol: 'TCP', info: `${dport} → ${sport} [ACK] Seq=${sSeq} Ack=${cSeq} Win=65160 Len=0` });

    // server response after some processing time
    t += randFloat(1, 25);
    const status = pick([200, 200, 200, 304, 404, 500]);
    const statusMsg: Record<number, string> = { 200: 'OK', 304: 'Not Modified', 404: 'Not Found', 500: 'Internal Server Error' };
    const bodyLen = randInt(120, 1400);
    const respText = `HTTP/1.1 ${status} ${statusMsg[status]}\r\nContent-Type: text/html\r\nContent-Length: ${bodyLen}\r\nServer: nginx/1.24.0\r\n\r\n`;
    const respPayload = [...bytesOf(respText), ...randomPayload(Math.min(bodyLen, 200))];
    emitTcp({
      at: t, src: server, dst: client, srcPort: dport, dstPort: sport, seq: sSeq, ack: cSeq,
      flags: { psh: true, ack: true }, payload: respPayload,
      protocol: secure ? 'TLS' : 'HTTP', info: secure ? 'Application Data' : `HTTP/1.1 ${status} ${statusMsg[status]}`,
      http: secure ? undefined : { isRequest: false, version: 'HTTP/1.1', statusCode: status, statusMessage: statusMsg[status], headers: { 'Content-Type': 'text/html', 'Content-Length': String(bodyLen), Server: 'nginx/1.24.0' } },
    });
    sSeq = (sSeq + respPayload.length) >>> 0;

    // client ACK of the response
    t += r / 2;
    emitTcp({ at: t, src: client, dst: server, srcPort: sport, dstPort: dport, seq: cSeq, ack: sSeq, flags: { ack: true }, protocol: 'TCP', info: `${sport} → ${dport} [ACK] Seq=${cSeq} Ack=${sSeq} Win=64240 Len=0` });
  }

  // graceful teardown (client-initiated FIN)
  t += randFloat(0.5, 6);
  emitTcp({ at: t, src: client, dst: server, srcPort: sport, dstPort: dport, seq: cSeq, ack: sSeq, flags: { fin: true, ack: true }, protocol: 'TCP', info: `${sport} → ${dport} [FIN, ACK] Seq=${cSeq} Ack=${sSeq} Win=64240 Len=0` });
  cSeq = (cSeq + 1) >>> 0;
  t += r / 2;
  emitTcp({ at: t, src: server, dst: client, srcPort: dport, dstPort: sport, seq: sSeq, ack: cSeq, flags: { fin: true, ack: true }, protocol: 'TCP', info: `${dport} → ${sport} [FIN, ACK] Seq=${sSeq} Ack=${cSeq} Win=65160 Len=0` });
  sSeq = (sSeq + 1) >>> 0;
  t += r / 2;
  emitTcp({ at: t, src: client, dst: server, srcPort: sport, dstPort: dport, seq: cSeq, ack: sSeq, flags: { ack: true }, protocol: 'TCP', info: `${sport} → ${dport} [ACK] Seq=${cSeq} Ack=${sSeq} Win=64240 Len=0` });
}

// ── ICMP echo session (request/reply pairs with matching id/seq) ─────────────
function emitPingSession(startAt: number, src: Host, dst: Host): void {
  const identifier = randInt(0, 0xffff);
  const count = randInt(3, 5);
  let t = startAt;
  for (let seq = 1; seq <= count; seq++) {
    emitIcmp(t, src, dst, false, identifier, seq);
    t += rtt(src, dst);
    emitIcmp(t, dst, src, true, identifier, seq);
    t += randFloat(700, 1100);   // ping spacing ~1s
  }
}

function emitIcmp(at: number, src: Host, dst: Host, reply: boolean, identifier: number, seq: number): void {
  const data = randomPayload(32);
  const icmpHeader = [reply ? 0 : 8, 0, 0, 0, (identifier >> 8) & 0xff, identifier & 0xff, (seq >> 8) & 0xff, seq & 0xff];
  const msg = [...icmpHeader, ...data];
  const cs = onesComplement16(msg);
  msg[2] = (cs >> 8) & 0xff; msg[3] = cs & 0xff;
  const ttl = ttlFor(src);
  const ipId = randInt(0, 0xffff);
  const ipH = ipv4Header(src.ip, dst.ip, 1, msg.length, ttl, ipId);
  const { srcMac, dstMac } = nextHopMacs(src, dst);
  const rawBytes = [...ethernetBytes(srcMac, dstMac, 0x0800), ...ipH.bytes, ...msg];
  schedule(at, {
    id: 0, timestamp: at, relativeTime: 0, length: rawBytes.length, capturedLength: rawBytes.length,
    protocol: 'ICMP',
    info: `Echo (ping) ${reply ? 'reply  ' : 'request'}  id=${hex16(identifier)}, seq=${seq}/${seq << 8}, ttl=${ttl}`,
    color: getProtocolColor('ICMP'),
    ethernet: { srcMac, dstMac, etherType: '0x0800', etherTypeName: 'IPv4' },
    ip: baseIpLayer(src.ip, dst.ip, 1, 'ICMP', msg.length, ttl, ipId, ipH.checksum),
    icmp: { type: reply ? 0 : 8, typeName: reply ? 'Echo (ping) reply' : 'Echo (ping) request', code: 0, checksum: hex16(cs), identifier, sequenceNumber: seq },
    hexDump: generateHexDump(rawBytes), rawBytes,
  });
}

// ── ARP request → reply ──────────────────────────────────────────────────────
function emitArpExchange(at: number, asker: Host, target: Host): void {
  emitArp(at, asker, target, false);
  emitArp(at + rtt(asker, target), target, asker, true);
}
function emitArp(at: number, src: Host, dst: Host, reply: boolean): void {
  const dstMac = reply ? dst.mac : BROADCAST_MAC;
  const arp = [
    0x00, 0x01, 0x08, 0x00, 0x06, 0x04, 0x00, reply ? 0x02 : 0x01,
    ...macToBytes(src.mac), ...ipToOctets(src.ip),
    ...macToBytes(reply ? dst.mac : '00:00:00:00:00:00'), ...ipToOctets(dst.ip),
  ];
  const rawBytes = [...ethernetBytes(src.mac, dstMac, 0x0806), ...arp];
  schedule(at, {
    id: 0, timestamp: at, relativeTime: 0, length: rawBytes.length, capturedLength: rawBytes.length,
    protocol: 'ARP',
    info: reply ? `${src.ip} is at ${src.mac}` : `Who has ${dst.ip}? Tell ${src.ip}`,
    color: getProtocolColor('ARP'),
    ethernet: { srcMac: src.mac, dstMac, etherType: '0x0806', etherTypeName: 'ARP' },
    arp: {
      hardwareType: 1, protocolType: '0x0800', hardwareSize: 6, protocolSize: 4,
      opcode: reply ? 2 : 1, opcodeName: reply ? 'reply' : 'request',
      senderMac: src.mac, senderIp: src.ip,
      targetMac: reply ? dst.mac : '00:00:00:00:00:00', targetIp: dst.ip,
    },
    hexDump: generateHexDump(rawBytes), rawBytes,
  });
}

// ── DHCP DORA (correlated 4-packet exchange) ─────────────────────────────────
function emitDhcpDora(at: number, client: Host): void {
  const xid = hex16(randInt(0, 0xffffffff));
  const offered = `10.0.0.${randInt(100, 200)}`;
  const phases: Array<{ phase: 'Discover' | 'Offer' | 'Request' | 'ACK'; fromClient: boolean }> = [
    { phase: 'Discover', fromClient: true }, { phase: 'Offer', fromClient: false },
    { phase: 'Request', fromClient: true }, { phase: 'ACK', fromClient: false },
  ];
  let t = at;
  for (const { phase, fromClient } of phases) {
    const src = fromClient ? client : GATEWAY;
    const dst = fromClient ? GATEWAY : client;
    const srcIp = fromClient ? '0.0.0.0' : GATEWAY.ip;
    const dstIp = phase === 'Offer' || phase === 'ACK' ? offered : '255.255.255.255';
    const fields = [
      { key: 'Message Type', value: `Boot ${fromClient ? 'Request (1)' : 'Reply (2)'}` },
      { key: 'DHCP Message Type', value: phase },
      { key: 'Transaction ID', value: xid },
      { key: 'Client MAC', value: client.mac },
      { key: 'Your (client) IP', value: phase === 'Offer' || phase === 'ACK' ? offered : '0.0.0.0' },
      { key: 'DHCP Server', value: GATEWAY.ip },
      { key: 'Subnet Mask', value: '255.255.255.0' }, { key: 'Router', value: GATEWAY.ip },
      { key: 'DNS', value: '8.8.8.8, 1.1.1.1' }, { key: 'Lease Time', value: '86400s (1 day)' },
    ];
    emitUdp({
      at: t,
      src: { ...src, ip: srcIp }, dst: { ...dst, ip: dstIp },
      srcPort: fromClient ? 68 : 67, dstPort: fromClient ? 67 : 68, payload: randomPayload(240),
      protocol: 'DHCP', info: `DHCP ${phase} - Transaction ID ${xid}${phase === 'Offer' || phase === 'ACK' ? ` - ${offered}` : ''}`,
      protoViews: [{ name: 'Dynamic Host Configuration Protocol', summary: `(${phase})`, fields }],
      multicastMac: dstIp === '255.255.255.255' ? BROADCAST_MAC : client.mac,
    });
    t += randFloat(1, 8);
  }
}

// ── Periodic control-plane single packets ────────────────────────────────────
function emitNtp(at: number, client: Host): void {
  const sport = randInt(49152, 65535);
  emitUdp({ at, src: client, dst: GATEWAY, srcPort: sport, dstPort: 123, payload: randomPayload(48), protocol: 'NTP', info: 'NTP Version 4, client',
    protoViews: [{ name: 'Network Time Protocol', summary: '(client)', fields: [{ key: 'Version', value: '4' }, { key: 'Mode', value: 'client (3)' }, { key: 'Stratum', value: 'unspecified (0)' }] }] });
  emitUdp({ at: at + rtt(client, GATEWAY), src: GATEWAY, dst: client, srcPort: 123, dstPort: sport, payload: randomPayload(48), protocol: 'NTP', info: 'NTP Version 4, server',
    protoViews: [{ name: 'Network Time Protocol', summary: '(server)', fields: [{ key: 'Version', value: '4' }, { key: 'Mode', value: 'server (4)' }, { key: 'Stratum', value: 'secondary reference (2)' }, { key: 'Reference ID', value: '129.6.15.28' }] }] });
}

function emitSnmp(at: number): void {
  const target = LOCAL_SERVERS[0];
  emitUdp({ at, src: GATEWAY, dst: target, srcPort: randInt(49152, 65535), dstPort: 161, payload: randomPayload(60), protocol: 'SNMP', info: 'get-request 1.3.6.1.2.1.1.3.0',
    protoViews: [{ name: 'Simple Network Management Protocol', summary: '(get-request)', fields: [{ key: 'Version', value: 'v2c (1)' }, { key: 'Community', value: 'public' }, { key: 'OID', value: '1.3.6.1.2.1.1.3.0 (sysUpTime)' }] }] });
}

function emitOspfHello(at: number): void {
  const src = GATEWAY;
  const payload = randomPayload(44);
  const ipId = randInt(0, 0xffff);
  const ipH = ipv4Header(src.ip, '224.0.0.5', 89, payload.length, 1, ipId);
  const rawBytes = [...ethernetBytes(src.mac, '01:00:5e:00:00:05', 0x0800), ...ipH.bytes, ...payload];
  schedule(at, {
    id: 0, timestamp: at, relativeTime: 0, length: rawBytes.length, capturedLength: rawBytes.length,
    protocol: 'OSPF', info: 'Hello Packet', color: getProtocolColor('OSPF'),
    ethernet: { srcMac: src.mac, dstMac: '01:00:5e:00:00:05', etherType: '0x0800', etherTypeName: 'IPv4' },
    ip: baseIpLayer(src.ip, '224.0.0.5', 89, 'OSPF', payload.length, 1, ipId, ipH.checksum),
    protoViews: [{ name: 'Open Shortest Path First', summary: '(Hello Packet)', fields: [{ key: 'Version', value: '2' }, { key: 'Message Type', value: 'Hello Packet (1)' }, { key: 'Source OSPF Router', value: src.ip }, { key: 'Area ID', value: '0.0.0.0 (backbone)' }, { key: 'Hello Interval', value: '10 seconds' }, { key: 'Dead Interval', value: '40 seconds' }] }],
    hexDump: generateHexDump(rawBytes), rawBytes,
  });
}

function emitStpBpdu(at: number): void {
  const src = GATEWAY;
  const STP_MAC = '01:80:c2:00:00:00';
  const payload = randomPayload(35);
  const rawBytes = [...ethernetBytes(src.mac, STP_MAC, 0x0026), ...payload];
  schedule(at, {
    id: 0, timestamp: at, relativeTime: 0, length: rawBytes.length, capturedLength: rawBytes.length,
    protocol: 'STP', info: 'Conf. Root = 32768/00:1a:2b:3c:4d:00  Cost = 0', color: getProtocolColor('STP'),
    ethernet: { srcMac: src.mac, dstMac: STP_MAC, etherType: '0x0026', etherTypeName: 'IEEE 802.3' },
    protoViews: [{ name: 'Spanning Tree Protocol', summary: '(Rapid/Configuration BPDU)', fields: [{ key: 'Protocol', value: 'STP (0x0000)' }, { key: 'Version', value: 'RSTP (2)' }, { key: 'Root', value: '32768 / 00:1a:2b:3c:4d:00' }, { key: 'Hello Time', value: '2' }, { key: 'Max Age', value: '20' }, { key: 'Forward Delay', value: '15' }] }],
    hexDump: generateHexDump(rawBytes), rawBytes,
  });
}

function emitLldp(at: number): void {
  const src = GATEWAY;
  const LLDP_MAC = '01:80:c2:00:00:0e';
  const payload = randomPayload(80);
  const port = `Gi0/${randInt(1, 24)}`;
  const rawBytes = [...ethernetBytes(src.mac, LLDP_MAC, 0x88cc), ...payload];
  schedule(at, {
    id: 0, timestamp: at, relativeTime: 0, length: rawBytes.length, capturedLength: rawBytes.length,
    protocol: 'LLDP', info: `${src.name} Port ${port} TTL=120`, color: getProtocolColor('LLDP'),
    ethernet: { srcMac: src.mac, dstMac: LLDP_MAC, etherType: '0x88cc', etherTypeName: 'LLDP' },
    protoViews: [{ name: 'Link Layer Discovery Protocol', fields: [{ key: 'Chassis ID', value: `MAC (${src.mac})` }, { key: 'Port ID', value: port }, { key: 'TTL', value: '120 seconds' }, { key: 'System Name', value: src.name }, { key: 'Capabilities', value: 'Bridge, Router' }] }],
    hexDump: generateHexDump(rawBytes), rawBytes,
  });
}

function emitMdns(at: number, src: Host): void {
  const name = pick(['_services._dns-sd._udp.local', '_airplay._tcp.local', '_ipp._tcp.local', `${src.name}.local`]);
  emitUdp({ at, src, dst: { ...src, ip: '224.0.0.251' }, srcPort: 5353, dstPort: 5353, payload: randomPayload(40), protocol: 'mDNS', info: `Standard query 0x0000 PTR ${name}`, multicastMac: '01:00:5e:00:00:fb',
    protoViews: [{ name: 'Multicast DNS', fields: [{ key: 'Type', value: 'Standard query' }, { key: 'Question', value: `${name}  PTR  IN` }] }] });
}

function emitSsdp(at: number, src: Host): void {
  emitUdp({ at, src, dst: { ...src, ip: '239.255.255.250' }, srcPort: randInt(49152, 65535), dstPort: 1900, payload: randomPayload(120), protocol: 'SSDP', info: 'M-SEARCH * HTTP/1.1', multicastMac: '01:00:5e:7f:ff:fa',
    protoViews: [{ name: 'Simple Service Discovery Protocol', fields: [{ key: 'Method', value: 'M-SEARCH' }, { key: 'Host', value: '239.255.255.250:1900' }, { key: 'ST', value: 'ssdp:all' }, { key: 'Man', value: '"ssdp:discover"' }] }] });
}

// ── Session arrival (the realistic, bursty part) ─────────────────────────────
function startUserSession(at: number): void {
  const client = pick(CLIENTS);
  const roll = Math.random();

  if (roll < 0.55) {
    // Browse an internet site: DNS lookup first, then an HTTPS connection.
    const server = pick(INTERNET);
    const resolver = pick(DNS_SERVERS);
    const afterDns = emitDnsLookup(at, client, resolver, server.name, server.ip);
    emitWebSession(afterDns + randFloat(0.2, 2), client, server, true);
  } else if (roll < 0.75) {
    // Talk to a local server (intranet/file) — no DNS, plain or TLS.
    const server = pick(LOCAL_SERVERS);
    emitWebSession(at, client, server, Math.random() < 0.5);
  } else if (roll < 0.88) {
    // Ping something.
    emitPingSession(at, client, Math.random() < 0.5 ? GATEWAY : pick(INTERNET));
  } else {
    // Local discovery chatter.
    if (Math.random() < 0.5) emitMdns(at, client); else emitSsdp(at, client);
  }
}

// ── Scheduler ────────────────────────────────────────────────────────────────
const SCHED_TICK = 60;          // ms between scheduler runs
const SESSION_RATE = 2.2;       // avg user sessions per second

function due(key: string, now: number, intervalMs: number, jitter = 0): boolean {
  if (nextDue[key] === undefined) { nextDue[key] = now + Math.random() * intervalMs; return false; }
  if (now >= nextDue[key]) { nextDue[key] = now + intervalMs + (jitter ? randFloat(-jitter, jitter) : 0); return true; }
  return false;
}

function tick(): void {
  if (!isCapturing) return;
  const now = Date.now();

  // New user sessions — Poisson-ish with occasional bursts (heavy-tailed).
  const lambda = SESSION_RATE * (SCHED_TICK / 1000);
  let starts = 0;
  while (Math.random() < lambda && starts < 4) starts++;            // base arrivals
  if (Math.random() < 0.06) starts += randInt(2, 5);               // burst
  for (let i = 0; i < starts; i++) startUserSession(now + randFloat(0, SCHED_TICK));

  // Periodic control-plane traffic at realistic cadences.
  if (due('stp', now, 2000)) emitStpBpdu(now);
  if (due('ospf', now, 10000, 500)) emitOspfHello(now);
  if (due('lldp', now, 30000, 2000)) emitLldp(now);
  if (due('ntp', now, 64000, 4000)) emitNtp(now, pick(CLIENTS));
  if (due('snmp', now, 15000, 3000)) emitSnmp(now);
  if (due('arp', now, 4000, 1500)) emitArpExchange(now, pick(CLIENTS), GATEWAY);
  if (due('dhcp', now, 45000, 10000)) emitDhcpDora(now, pick(CLIENTS));

  // Flush everything whose scheduled time has arrived, in time order.
  const ready = pending.filter((p) => p.at <= now).sort((a, b) => a.at - b.at);
  if (ready.length) {
    pending = pending.filter((p) => p.at > now);
    for (const { at, pkt } of ready) {
      pkt.id = packetIdCounter++;
      pkt.timestamp = at;
      pkt.relativeTime = parseFloat(((at - captureStartTime) / 1000).toFixed(6));
      packetBuffer.push(pkt);
      if (packetBuffer.length > 10000) packetBuffer.shift();
    }
  }
}

// ── Public API (unchanged) ───────────────────────────────────────────────────
export function startCapture(): void {
  if (isCapturing) return;
  isCapturing = true;
  captureStartTime = Date.now();
  packetIdCounter = 1;
  packetBuffer.length = 0;
  pending = [];
  for (const k of Object.keys(nextDue)) delete nextDue[k];

  // Seed an immediate representative burst so the UI is lively at once.
  const now = Date.now();
  emitStpBpdu(now);
  emitArpExchange(now + 5, CLIENTS[0], GATEWAY);
  emitDhcpDora(now + 10, CLIENTS[2]);
  startUserSession(now + 20);
  startUserSession(now + 30);
  emitPingSession(now + 40, CLIENTS[1], GATEWAY);

  schedulerInterval = setInterval(tick, SCHED_TICK);
}

export function stopCapture(): void {
  isCapturing = false;
  if (schedulerInterval) { clearInterval(schedulerInterval); schedulerInterval = null; }
}

export function clearPackets(): void {
  packetBuffer.length = 0;
  pending = [];
  packetIdCounter = 1;
  captureStartTime = Date.now();
}

export function getPackets(since?: number, limit = 200): Packet[] {
  if (since !== undefined) return packetBuffer.filter((p) => p.id > since).slice(-limit);
  return packetBuffer.slice(-limit);
}

export function getPacketById(id: number): Packet | undefined {
  return packetBuffer.find((p) => p.id === id);
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
    total: packetBuffer.length, byProtocol, bytesTotal, startTime: captureStartTime, duration,
    packetsPerSecond: duration > 0 ? packetBuffer.length / duration : 0,
    bytesPerSecond: duration > 0 ? bytesTotal / duration : 0,
  };
}

export function isRunning(): boolean {
  return isCapturing;
}
