// Packet-capture & protocol-layer types.

export interface EthernetLayer {
  srcMac: string;
  dstMac: string;
  etherType: string;
  etherTypeName: string;
}

export interface IpLayer {
  version: number;
  headerLength: number;
  dscp: number;
  ecn: number;
  totalLength: number;
  identification: string;
  flags: string;
  fragmentOffset: number;
  ttl: number;
  protocol: number;
  protocolName: string;
  checksum: string;
  srcIp: string;
  dstIp: string;
}

export interface TcpLayer {
  srcPort: number;
  dstPort: number;
  sequenceNumber: number;
  acknowledgmentNumber: number;
  dataOffset: number;
  flags: {
    fin: boolean;
    syn: boolean;
    rst: boolean;
    psh: boolean;
    ack: boolean;
    urg: boolean;
  };
  windowSize: number;
  checksum: string;
  urgentPointer: number;
}

export interface UdpLayer {
  srcPort: number;
  dstPort: number;
  length: number;
  checksum: string;
}

export interface IcmpLayer {
  type: number;
  typeName: string;
  code: number;
  checksum: string;
  identifier?: number;
  sequenceNumber?: number;
  data?: string;
}

export interface DnsQuery {
  name: string;
  type: string;
  class: string;
}

export interface DnsAnswer {
  name: string;
  type: string;
  class: string;
  ttl: number;
  dataLength: number;
  address?: string;
  cname?: string;
}

export interface DnsLayer {
  transactionId: string;
  flags: string;
  isResponse: boolean;
  opcode: string;
  questions: number;
  answerRRs: number;
  authorityRRs: number;
  additionalRRs: number;
  queries: DnsQuery[];
  answers: DnsAnswer[];
}

export interface HttpLayer {
  isRequest: boolean;
  method?: string;
  uri?: string;
  version: string;
  statusCode?: number;
  statusMessage?: string;
  headers: Record<string, string>;
  contentLength?: number;
}

export interface ArpLayer {
  hardwareType: number;
  protocolType: string;
  hardwareSize: number;
  protocolSize: number;
  opcode: number;
  opcodeName: string;
  senderMac: string;
  senderIp: string;
  targetMac: string;
  targetIp: string;
}

export interface TlsLayer {
  contentType: string;
  version: string;
  length: number;
  handshakeType?: string;
  cipherSuites?: string[];
  serverName?: string;
}

export interface ProtoField {
  key: string;
  value: string;
}

export interface ProtoView {
  name: string;
  summary?: string;
  fields: ProtoField[];
}

export interface Packet {
  id: number;
  timestamp: number;
  relativeTime: number;
  length: number;
  capturedLength: number;
  protocol: string;
  info: string;
  color: string;

  ethernet?: EthernetLayer;
  ip?: IpLayer;
  tcp?: TcpLayer;
  udp?: UdpLayer;
  icmp?: IcmpLayer;
  dns?: DnsLayer;
  http?: HttpLayer;
  arp?: ArpLayer;
  tls?: TlsLayer;
  protoViews?: ProtoView[];

  hexDump: string[];
  rawBytes: number[];
}

export interface PacketStats {
  total: number;
  byProtocol: Record<string, number>;
  bytesTotal: number;
  startTime: number;
  duration: number;
  packetsPerSecond: number;
  bytesPerSecond: number;
}
