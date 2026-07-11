// ── Authentic packet model for the Wireshark-style inspector ──────────────────
// Each in-flight packet carries a fully decoded, layered representation so the
// user can freeze it and drill into every protocol layer, just like Wireshark.

export interface PacketField { label: string; value: string }
export interface PacketLayer { name: string; summary: string; fields: PacketField[] }

export interface PacketInfo {
  id: string
  ts: number
  protocol: string            // top-most app protocol (DNS, HTTPS, SQL…)
  srcName: string
  dstName: string
  srcIp: string
  dstIp: string
  srcMac: string
  dstMac: string
  l4: 'TCP' | 'UDP' | 'ICMP'
  srcPort?: number
  dstPort?: number
  length: number              // total frame length (bytes)
  info: string                // the Wireshark "Info" column
  layers: PacketLayer[]       // Frame -> Ethernet -> IP -> TCP/UDP -> App
  payloadHex: string          // formatted hex dump
  phase?: 'request' | 'reply' // which leg of the exchange this is
}

export type AppProto = 'DNS' | 'HTTPS' | 'HTTP' | 'SQL' | 'DHCP' | 'MQTT' | 'SMB' | 'IMAP' | 'IPP' | 'ICMP'

const WELL_KNOWN: Record<AppProto, { l4: 'TCP' | 'UDP' | 'ICMP'; port: number; etherType: string }> = {
  DNS:   { l4: 'UDP', port: 53,   etherType: '0x0800' },
  HTTPS: { l4: 'TCP', port: 443,  etherType: '0x0800' },
  HTTP:  { l4: 'TCP', port: 80,   etherType: '0x0800' },
  SQL:   { l4: 'TCP', port: 3306, etherType: '0x0800' },
  DHCP:  { l4: 'UDP', port: 67,   etherType: '0x0800' },
  MQTT:  { l4: 'TCP', port: 1883, etherType: '0x0800' },
  SMB:   { l4: 'TCP', port: 445,  etherType: '0x0800' },
  IMAP:  { l4: 'TCP', port: 143,  etherType: '0x0800' },
  IPP:   { l4: 'TCP', port: 631,  etherType: '0x0800' },
  ICMP:  { l4: 'ICMP', port: 0,   etherType: '0x0800' },
}

function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

// Stable, locally-administered MAC derived from the node id (so each device
// keeps the same MAC across renders).
export function macFor(seed: string): string {
  const h = hash(seed)
  const o = (n: number) => ((h >>> (n * 5)) & 0xff).toString(16).padStart(2, '0')
  return `02:${o(0)}:${o(1)}:${o(2)}:${o(3)}:${(hash(seed + 'x') & 0xff).toString(16).padStart(2, '0')}`
}

function ephemeralPort(seed: string): number {
  return 49152 + (hash(seed) % 16000)
}

function hexDump(text: string): string {
  // Build a plausible byte stream from the header + payload text.
  const bytes: number[] = []
  for (let i = 0; i < text.length && bytes.length < 96; i++) bytes.push(text.charCodeAt(i) & 0xff)
  while (bytes.length < 48) bytes.push((hash('pad' + bytes.length) & 0xff))
  const rows: string[] = []
  for (let off = 0; off < bytes.length; off += 16) {
    const slice = bytes.slice(off, off + 16)
    const hex = slice.map(b => b.toString(16).padStart(2, '0')).join(' ').padEnd(16 * 3 - 1, ' ')
    const ascii = slice.map(b => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('')
    rows.push(`${off.toString(16).padStart(4, '0')}  ${hex}  ${ascii}`)
  }
  return rows.join('\n')
}

interface BuildOpts {
  phase?: 'request' | 'reply'
  query?: string      // DNS: queried name
  answer?: string     // DNS: resolved A record
  dhcp?: string       // DHCP message type (Discover/Offer/Request/ACK)
  sql?: string        // SQL: the statement
  reqId?: string      // correlation id shared by request/reply
}

export function appFromLabel(label: string): AppProto {
  const L = label.toUpperCase()
  if (L.includes('DNS')) return 'DNS'
  if (L.includes('SQL')) return 'SQL'
  if (L.includes('DHCP')) return 'DHCP'
  if (L.includes('MQTT')) return 'MQTT'
  if (L.includes('SMB')) return 'SMB'
  if (L.includes('IMAP')) return 'IMAP'
  if (L.includes('IPP')) return 'IPP'
  if (L.includes('HTTP')) return 'HTTPS'
  if (L.includes('PING') || L.includes('ICMP')) return 'ICMP'
  return 'HTTPS'
}

// Build a fully-decoded packet from src -> dst for the given app protocol.
export function buildPacket(
  srcName: string, srcIp: string, srcId: string,
  dstName: string, dstIp: string, dstId: string,
  app: AppProto, opts: BuildOpts = {},
): PacketInfo {
  const wk = WELL_KNOWN[app]
  const reply = opts.phase === 'reply'
  const srcMac = macFor(srcId)
  const dstMac = macFor(dstId)
  const ttl = 64 - Math.floor(Math.random() * 3)

  // Ports: client uses an ephemeral port, server the well-known one.
  let srcPort: number | undefined
  let dstPort: number | undefined
  if (wk.l4 !== 'ICMP') {
    if (app === 'DHCP') { srcPort = reply ? 67 : 68; dstPort = reply ? 68 : 67 }
    else if (reply) { srcPort = wk.port; dstPort = ephemeralPort(dstId) }
    else { srcPort = ephemeralPort(srcId); dstPort = wk.port }
  }

  const seq = hash(srcId + (opts.reqId ?? '')) % 4000000000
  const ipv4: PacketLayer = {
    name: 'Internet Protocol Version 4',
    summary: `${srcIp} -> ${dstIp}`,
    fields: [
      { label: 'Version', value: '4' },
      { label: 'Header Length', value: '20 bytes (5)' },
      { label: 'Differentiated Services', value: '0x00 (DSCP CS0)' },
      { label: 'Time to Live', value: String(ttl) },
      { label: 'Protocol', value: wk.l4 === 'ICMP' ? 'ICMP (1)' : wk.l4 === 'UDP' ? 'UDP (17)' : 'TCP (6)' },
      { label: 'Source Address', value: srcIp },
      { label: 'Destination Address', value: dstIp },
      { label: 'Flags', value: "0x40, Don't fragment" },
    ],
  }

  let transport: PacketLayer
  if (wk.l4 === 'ICMP') {
    transport = {
      name: 'Internet Control Message Protocol',
      summary: reply ? 'Echo (ping) reply' : 'Echo (ping) request',
      fields: [
        { label: 'Type', value: reply ? '0 (Echo reply)' : '8 (Echo request)' },
        { label: 'Code', value: '0' },
        { label: 'Checksum', value: `0x${(hash(srcId + dstId) & 0xffff).toString(16).padStart(4, '0')}` },
        { label: 'Identifier', value: String(hash(srcId) % 65535) },
        { label: 'Sequence', value: String((hash(opts.reqId ?? srcId) % 1000)) },
      ],
    }
  } else if (wk.l4 === 'UDP') {
    transport = {
      name: 'User Datagram Protocol',
      summary: `${srcPort} -> ${dstPort}`,
      fields: [
        { label: 'Source Port', value: String(srcPort) },
        { label: 'Destination Port', value: String(dstPort) },
        { label: 'Length', value: String(8 + 40) },
        { label: 'Checksum', value: `0x${(hash('udp' + seq) & 0xffff).toString(16).padStart(4, '0')}` },
      ],
    }
  } else {
    transport = {
      name: 'Transmission Control Protocol',
      summary: `${srcPort} -> ${dstPort} [${reply ? 'ACK, PSH' : 'PSH, ACK'}] Seq=${seq % 100000} Win=64240`,
      fields: [
        { label: 'Source Port', value: String(srcPort) },
        { label: 'Destination Port', value: String(dstPort) },
        { label: 'Sequence Number', value: String(seq % 100000) },
        { label: 'Acknowledgment Number', value: String((seq + 1) % 100000) },
        { label: 'Flags', value: reply ? '0x018 (PSH, ACK)' : '0x018 (PSH, ACK)' },
        { label: 'Window Size', value: '64240' },
        { label: 'Checksum', value: `0x${(hash('tcp' + seq) & 0xffff).toString(16).padStart(4, '0')}` },
      ],
    }
  }

  // Application layer + the human-readable Info column.
  let appLayer: PacketLayer
  let info: string
  let protoLabel: string   // every switch branch (incl. default) sets this
  switch (app) {
    case 'DNS': {
      const name = opts.query ?? dstName
      protoLabel = 'DNS'
      info = reply
        ? `Standard query response 0x${(hash(name) & 0xffff).toString(16).padStart(4, '0')} A ${name} A ${opts.answer ?? dstIp}`
        : `Standard query 0x${(hash(name) & 0xffff).toString(16).padStart(4, '0')} A ${name}`
      appLayer = {
        name: 'Domain Name System' + (reply ? ' (response)' : ' (query)'),
        summary: info,
        fields: [
          { label: 'Transaction ID', value: `0x${(hash(name) & 0xffff).toString(16).padStart(4, '0')}` },
          { label: 'Flags', value: reply ? '0x8180 Standard query response, No error' : '0x0100 Standard query' },
          { label: 'Questions', value: '1' },
          { label: 'Answer RRs', value: reply ? '1' : '0' },
          { label: 'Queries', value: `${name}: type A, class IN` },
          ...(reply ? [{ label: 'Answer', value: `${name}: type A, addr ${opts.answer ?? dstIp}` }] : []),
        ],
      }
      break
    }
    case 'DHCP': {
      const mt = opts.dhcp ?? (reply ? 'Offer' : 'Discover')
      protoLabel = 'DHCP'
      info = `DHCP ${mt} - Transaction ID 0x${(hash(srcId) & 0xffffff).toString(16).padStart(8, '0')}`
      appLayer = {
        name: 'Dynamic Host Configuration Protocol',
        summary: `DHCP ${mt}`,
        fields: [
          { label: 'Message type', value: `Boot ${reply ? 'Reply (2)' : 'Request (1)'}` },
          { label: 'Hardware type', value: 'Ethernet (0x01)' },
          { label: 'Transaction ID', value: `0x${(hash(srcId) & 0xffffff).toString(16).padStart(8, '0')}` },
          { label: 'Client MAC', value: srcMac },
          { label: 'Option (53) DHCP Message Type', value: mt },
          ...(mt === 'Offer' || mt === 'ACK' ? [{ label: 'Your (client) IP', value: dstIp }] : []),
        ],
      }
      break
    }
    case 'SQL': {
      const stmt = opts.sql ?? (reply ? 'OK 1 row' : 'SELECT * FROM users WHERE id = ?')
      protoLabel = 'MySQL'
      info = reply ? `Response TABULAR (${stmt})` : `Request Query: ${stmt}`
      appLayer = {
        name: 'MySQL Protocol',
        summary: info,
        fields: [
          { label: 'Packet Length', value: String(8 + stmt.length) },
          { label: 'Packet Number', value: reply ? '1' : '0' },
          { label: reply ? 'Response' : 'Command', value: reply ? 'Result set' : 'Query (0x03)' },
          { label: 'Statement', value: stmt },
        ],
      }
      break
    }
    case 'HTTP':
    case 'HTTPS': {
      const secure = app === 'HTTPS'
      protoLabel = secure ? 'TLSv1.3' : 'HTTP'
      if (secure) {
        info = reply ? 'Application Data' : 'Application Data, Client Hello'
        appLayer = {
          name: 'Transport Layer Security',
          summary: info,
          fields: [
            { label: 'Content Type', value: 'Application Data (23)' },
            { label: 'Version', value: 'TLS 1.3 (0x0303)' },
            { label: 'Length', value: String(64 + (hash(srcId) % 400)) },
            { label: 'SNI', value: dstName.toLowerCase().replace(/\s+/g, '-') + '.lan' },
          ],
        }
      } else {
        info = reply ? 'HTTP/1.1 200 OK (text/html)' : `GET / HTTP/1.1  Host: ${dstName.toLowerCase().replace(/\s+/g, '-')}.lan`
        appLayer = {
          name: 'Hypertext Transfer Protocol',
          summary: info,
          fields: reply
            ? [{ label: 'Status', value: 'HTTP/1.1 200 OK' }, { label: 'Content-Type', value: 'text/html; charset=utf-8' }, { label: 'Server', value: dstName }]
            : [{ label: 'Request', value: 'GET / HTTP/1.1' }, { label: 'Host', value: `${dstName.toLowerCase().replace(/\s+/g, '-')}.lan` }, { label: 'User-Agent', value: 'NetViz/1.0' }],
        }
      }
      break
    }
    case 'ICMP': {
      // ICMP has no separate application layer — the transport layer above
      // already fully describes the echo request/reply, so this is filtered
      // out of the final `layers` array below.
      protoLabel = 'ICMP'
      info = reply ? 'Echo (ping) reply' : 'Echo (ping) request'
      appLayer = transport
      break
    }
    default: {
      // MQTT / SMB / IMAP / IPP
      const verbs: Record<string, [string, string]> = {
        MQTT: ['Publish Message', 'PubAck'],
        SMB: ['Create Request File', 'Create Response'],
        IMAP: ['Request: FETCH', 'Response: OK'],
        IPP: ['Print-Job', 'successful-ok'],
      }
      const [reqV, repV] = verbs[app] ?? ['Request', 'Response']
      protoLabel = app
      info = reply ? repV : reqV
      appLayer = { name: `${app} Protocol`, summary: info, fields: [{ label: 'Operation', value: reply ? repV : reqV }] }
    }
  }

  const ethernet: PacketLayer = {
    name: 'Ethernet II',
    summary: `${srcMac} -> ${dstMac}`,
    fields: [
      { label: 'Destination', value: dstMac },
      { label: 'Source', value: srcMac },
      { label: 'Type', value: `IPv4 (${wk.etherType})` },
    ],
  }

  const length = 54 + appLayer.fields.reduce((s, f) => s + f.value.length, 0) % 900 + 20
  const frame: PacketLayer = {
    name: `Frame: ${length} bytes`,
    summary: `${length} bytes on wire, ${length} bytes captured`,
    fields: [
      { label: 'Arrival Time', value: new Date().toLocaleTimeString() },
      { label: 'Frame Length', value: `${length} bytes` },
      { label: 'Protocols in frame', value: `eth:ethertype:ip:${wk.l4.toLowerCase()}:${protoLabel.toLowerCase()}` },
    ],
  }

  return {
    id: `pkt-${hash(srcId + dstId + (opts.reqId ?? '') + protoLabel + (reply ? 'r' : 'q'))}-${Date.now() % 100000}`,
    ts: Date.now(),
    phase: reply ? 'reply' : 'request',
    protocol: protoLabel,
    srcName, dstName, srcIp, dstIp, srcMac, dstMac,
    l4: wk.l4, srcPort, dstPort,
    length,
    info,
    layers: app === 'ICMP' ? [frame, ethernet, ipv4, transport] : [frame, ethernet, ipv4, transport, appLayer],
    payloadHex: hexDump(`${srcMac}${dstMac}${srcIp}${dstIp}${info}`),
  }
}

// ── Control-plane / L2 packets (ARP, TCP handshake) ──────────────────────────
export function buildArp(
  srcName: string, srcIp: string, srcId: string,
  dstName: string, dstIp: string, dstId: string, request: boolean,
): PacketInfo {
  const srcMac = macFor(srcId), dstMac = macFor(dstId)
  const info = request ? `Who has ${dstIp}? Tell ${srcIp}` : `${dstIp} is at ${dstMac}`
  const length = 42
  return {
    id: `arp-${hash(srcId + dstId + (request ? 'q' : 'r'))}-${Date.now() % 100000}`,
    phase: request ? 'request' : 'reply',
    ts: Date.now(), protocol: 'ARP', srcName, dstName, srcIp, dstIp, srcMac, dstMac,
    l4: 'TCP', length, info,
    layers: [
      { name: `Frame: ${length} bytes`, summary: `${length} bytes on wire`, fields: [{ label: 'Protocols in frame', value: 'eth:arp' }] },
      { name: 'Ethernet II', summary: `${srcMac} -> ${request ? 'Broadcast' : dstMac}`, fields: [
        { label: 'Destination', value: request ? 'Broadcast (ff:ff:ff:ff:ff:ff)' : dstMac },
        { label: 'Source', value: srcMac }, { label: 'Type', value: 'ARP (0x0806)' } ] },
      { name: 'Address Resolution Protocol', summary: info, fields: [
        { label: 'Opcode', value: request ? 'request (1)' : 'reply (2)' },
        { label: 'Sender MAC address', value: srcMac }, { label: 'Sender IP address', value: srcIp },
        { label: 'Target MAC address', value: request ? '00:00:00:00:00:00' : dstMac },
        { label: 'Target IP address', value: dstIp } ] },
    ],
    payloadHex: hexDump(`${srcMac}ffffffffffff${srcIp}${dstIp}${info}`),
  }
}

export function buildTcp(
  srcName: string, srcIp: string, srcId: string,
  dstName: string, dstIp: string, dstId: string,
  flags: 'SYN' | 'SYN, ACK' | 'ACK', forApp: AppProto,
): PacketInfo {
  const wk = WELL_KNOWN[forApp]
  const synAck = flags === 'SYN, ACK'
  const srcPort = synAck ? wk.port : ephemeralPort(srcId)
  const dstPort = synAck ? ephemeralPort(dstId) : wk.port
  const srcMac = macFor(srcId), dstMac = macFor(dstId)
  const seq = hash(srcId + flags) % 100000
  const info = `${srcPort} -> ${dstPort} [${flags}] Seq=${flags === 'ACK' ? 1 : 0}${flags.includes('ACK') ? ' Ack=1' : ''} Win=64240 Len=0 MSS=1460`
  const length = 66
  return {
    id: `tcp-${hash(srcId + dstId + flags)}-${Date.now() % 100000}`,
    phase: synAck ? 'reply' : 'request',
    ts: Date.now(), protocol: 'TCP', srcName, dstName, srcIp, dstIp, srcMac, dstMac,
    l4: 'TCP', srcPort, dstPort, length, info,
    layers: [
      { name: `Frame: ${length} bytes`, summary: `${length} bytes on wire`, fields: [{ label: 'Protocols in frame', value: 'eth:ethertype:ip:tcp' }] },
      { name: 'Ethernet II', summary: `${srcMac} -> ${dstMac}`, fields: [
        { label: 'Destination', value: dstMac }, { label: 'Source', value: srcMac }, { label: 'Type', value: 'IPv4 (0x0800)' } ] },
      { name: 'Internet Protocol Version 4', summary: `${srcIp} -> ${dstIp}`, fields: [
        { label: 'Time to Live', value: '64' }, { label: 'Protocol', value: 'TCP (6)' },
        { label: 'Source Address', value: srcIp }, { label: 'Destination Address', value: dstIp } ] },
      { name: 'Transmission Control Protocol', summary: info, fields: [
        { label: 'Source Port', value: String(srcPort) }, { label: 'Destination Port', value: String(dstPort) },
        { label: 'Sequence Number', value: String(seq) }, { label: 'Flags', value: `[${flags}]` },
        { label: 'Window Size', value: '64240' }, { label: 'Options', value: 'MSS, SACK permitted, Timestamps' } ] },
    ],
    payloadHex: hexDump(`${srcMac}${dstMac}${srcIp}${dstIp}${info}`),
  }
}
