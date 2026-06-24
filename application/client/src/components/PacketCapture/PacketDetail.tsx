import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import type { Packet } from '../../types'

interface TreeNodeProps {
  label: string
  value?: string
  comment?: string
  children?: React.ReactNode
  defaultOpen?: boolean
}

function TreeNode({ label, value, comment, children, defaultOpen = true }: TreeNodeProps) {
  const [open, setOpen] = useState(defaultOpen)
  const hasChildren = !!children

  return (
    <div>
      <div
        className="tree-item"
        onClick={() => hasChildren && setOpen(v => !v)}
        style={{ cursor: hasChildren ? 'pointer' : 'default' }}
      >
        {hasChildren ? (
          open ? <ChevronDown size={10} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
                : <ChevronRight size={10} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
        ) : <span className="w-[10px] shrink-0" />}
        <span className="tree-key">{label}</span>
        {value && <span className="tree-val">{value}</span>}
        {comment && <span className="tree-comment"> ({comment})</span>}
      </div>
      {hasChildren && open && (
        <div style={{ paddingLeft: 16 }}>{children}</div>
      )}
    </div>
  )
}

function Leaf({ label, value, comment }: { label: string; value: string | number; comment?: string }) {
  return (
    <div className="tree-item">
      <span className="w-[10px] shrink-0" />
      <span className="tree-key">{label}:</span>
      <span className="tree-val">{String(value)}</span>
      {comment && <span className="tree-comment"> ({comment})</span>}
    </div>
  )
}

interface PacketDetailProps {
  packet: Packet | null
}

export default function PacketDetail({ packet }: PacketDetailProps) {
  if (!packet) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--text-muted)]">
        Select a packet to view details
      </div>
    )
  }

  const ts = new Date(packet.timestamp)
  const flagStr = packet.tcp
    ? Object.entries(packet.tcp.flags)
        .filter(([, v]) => v)
        .map(([k]) => k.toUpperCase())
        .join(', ')
    : ''

  return (
    <div className="h-full overflow-y-auto py-1 text-xs">
      {/* Frame */}
      <TreeNode label="Frame" value={`${packet.length} bytes on wire, ${packet.capturedLength} bytes captured`} defaultOpen={false}>
        <Leaf label="Arrival Time" value={ts.toISOString()} />
        <Leaf label="Frame Number" value={packet.id} />
        <Leaf label="Frame Length" value={`${packet.length} bytes`} />
        <Leaf label="Capture Length" value={`${packet.capturedLength} bytes`} />
        <Leaf label="Protocol" value={packet.protocol} />
      </TreeNode>

      {/* Ethernet */}
      {packet.ethernet && (
        <TreeNode
          label="Ethernet II"
          value={`Src: ${packet.ethernet.srcMac}, Dst: ${packet.ethernet.dstMac}`}
        >
          <Leaf label="Destination" value={packet.ethernet.dstMac} />
          <Leaf label="Source" value={packet.ethernet.srcMac} />
          <Leaf label="Type" value={`${packet.ethernet.etherTypeName} (${packet.ethernet.etherType})`} />
        </TreeNode>
      )}

      {/* ARP (no IP layer) */}
      {packet.arp && (
        <TreeNode
          label="Address Resolution Protocol"
          value={`(${packet.arp.opcodeName})`}
        >
          <Leaf label="Hardware type" value={`Ethernet (${packet.arp.hardwareType})`} />
          <Leaf label="Protocol type" value={`IPv4 (${packet.arp.protocolType})`} />
          <Leaf label="Hardware size" value={packet.arp.hardwareSize} />
          <Leaf label="Protocol size" value={packet.arp.protocolSize} />
          <Leaf label="Opcode" value={`${packet.arp.opcodeName} (${packet.arp.opcode})`} />
          <Leaf label="Sender MAC" value={packet.arp.senderMac} />
          <Leaf label="Sender IP" value={packet.arp.senderIp} />
          <Leaf label="Target MAC" value={packet.arp.targetMac} />
          <Leaf label="Target IP" value={packet.arp.targetIp} />
        </TreeNode>
      )}

      {/* IP */}
      {packet.ip && (
        <TreeNode
          label="Internet Protocol Version 4"
          value={`Src: ${packet.ip.srcIp}, Dst: ${packet.ip.dstIp}`}
        >
          <Leaf label="Version" value={packet.ip.version} />
          <Leaf label="Header Length" value={`${packet.ip.headerLength} bytes`} />
          <Leaf label="DSCP" value={packet.ip.dscp} />
          <Leaf label="Total Length" value={packet.ip.totalLength} />
          <Leaf label="Identification" value={packet.ip.identification} />
          <Leaf label="Flags" value={packet.ip.flags} />
          <Leaf label="Fragment Offset" value={packet.ip.fragmentOffset} />
          <Leaf label="Time to Live" value={packet.ip.ttl} />
          <Leaf label="Protocol" value={`${packet.ip.protocolName} (${packet.ip.protocol})`} />
          <Leaf label="Header Checksum" value={packet.ip.checksum} />
          <Leaf label="Source Address" value={packet.ip.srcIp} />
          <Leaf label="Destination Address" value={packet.ip.dstIp} />
        </TreeNode>
      )}

      {/* ICMP */}
      {packet.icmp && (
        <TreeNode label="Internet Control Message Protocol" value={packet.icmp.typeName}>
          <Leaf label="Type" value={`${packet.icmp.type} (${packet.icmp.typeName})`} />
          <Leaf label="Code" value={packet.icmp.code} />
          <Leaf label="Checksum" value={packet.icmp.checksum} />
          {packet.icmp.identifier !== undefined && <Leaf label="Identifier" value={`0x${packet.icmp.identifier.toString(16).padStart(4, '0')}`} />}
          {packet.icmp.sequenceNumber !== undefined && <Leaf label="Sequence Number" value={packet.icmp.sequenceNumber} />}
        </TreeNode>
      )}

      {/* TCP */}
      {packet.tcp && (
        <TreeNode
          label="Transmission Control Protocol"
          value={`Src Port: ${packet.tcp.srcPort}, Dst Port: ${packet.tcp.dstPort}, ${flagStr ? `[${flagStr}]` : ''}`}
        >
          <Leaf label="Source Port" value={packet.tcp.srcPort} />
          <Leaf label="Destination Port" value={packet.tcp.dstPort} />
          <Leaf label="Sequence Number" value={packet.tcp.sequenceNumber} />
          <Leaf label="Acknowledgment Number" value={packet.tcp.acknowledgmentNumber} />
          <Leaf label="Header Length" value={`${packet.tcp.dataOffset * 4} bytes`} />
          <TreeNode label="Flags" value={flagStr ? `0x... [${flagStr}]` : '0x000'} defaultOpen={false}>
            {Object.entries(packet.tcp.flags).map(([k, v]) => (
              <Leaf key={k} label={`.... .... ${k.toUpperCase()}`} value={v ? '1' : '0'} comment={v ? 'Set' : 'Not set'} />
            ))}
          </TreeNode>
          <Leaf label="Window Size" value={packet.tcp.windowSize} />
          <Leaf label="Checksum" value={packet.tcp.checksum} />
          <Leaf label="Urgent Pointer" value={packet.tcp.urgentPointer} />
        </TreeNode>
      )}

      {/* UDP */}
      {packet.udp && (
        <TreeNode label="User Datagram Protocol" value={`Src Port: ${packet.udp.srcPort}, Dst Port: ${packet.udp.dstPort}`}>
          <Leaf label="Source Port" value={packet.udp.srcPort} />
          <Leaf label="Destination Port" value={packet.udp.dstPort} />
          <Leaf label="Length" value={`${packet.udp.length} bytes`} />
          <Leaf label="Checksum" value={packet.udp.checksum} />
        </TreeNode>
      )}

      {/* DNS */}
      {packet.dns && (
        <TreeNode label="Domain Name System" value={`(${packet.dns.isResponse ? 'response' : 'query'})`}>
          <Leaf label="Transaction ID" value={packet.dns.transactionId} />
          <Leaf label="Flags" value={packet.dns.flags} />
          <Leaf label="Questions" value={packet.dns.questions} />
          <Leaf label="Answer RRs" value={packet.dns.answerRRs} />
          {packet.dns.queries.length > 0 && (
            <TreeNode label="Queries" defaultOpen>
              {packet.dns.queries.map((q, i) => (
                <TreeNode key={i} label={q.name} defaultOpen={false}>
                  <Leaf label="Name" value={q.name} />
                  <Leaf label="Type" value={q.type} />
                  <Leaf label="Class" value={q.class} />
                </TreeNode>
              ))}
            </TreeNode>
          )}
          {packet.dns.answers.length > 0 && (
            <TreeNode label="Answers" defaultOpen>
              {packet.dns.answers.map((a, i) => (
                <TreeNode key={i} label={a.name} defaultOpen={false}>
                  <Leaf label="Name" value={a.name} />
                  <Leaf label="Type" value={a.type} />
                  <Leaf label="TTL" value={`${a.ttl} seconds`} />
                  {a.address && <Leaf label="Address" value={a.address} />}
                </TreeNode>
              ))}
            </TreeNode>
          )}
        </TreeNode>
      )}

      {/* HTTP */}
      {packet.http && (
        <TreeNode
          label={`Hypertext Transfer Protocol${packet.http.isRequest ? ' (Request)' : ' (Response)'}`}
          value={packet.http.isRequest
            ? `${packet.http.method} ${packet.http.uri} ${packet.http.version}`
            : `${packet.http.version} ${packet.http.statusCode} ${packet.http.statusMessage}`}
        >
          {packet.http.isRequest ? (
            <>
              <Leaf label="Request Method" value={packet.http.method ?? ''} />
              <Leaf label="Request URI" value={packet.http.uri ?? ''} />
              <Leaf label="Version" value={packet.http.version} />
            </>
          ) : (
            <>
              <Leaf label="Version" value={packet.http.version} />
              <Leaf label="Status Code" value={packet.http.statusCode ?? ''} />
              <Leaf label="Status Message" value={packet.http.statusMessage ?? ''} />
            </>
          )}
          {Object.entries(packet.http.headers).length > 0 && (
            <TreeNode label="Headers" defaultOpen={false}>
              {Object.entries(packet.http.headers).map(([k, v]) => (
                <Leaf key={k} label={k} value={v} />
              ))}
            </TreeNode>
          )}
        </TreeNode>
      )}

      {/* TLS */}
      {packet.tls && (
        <TreeNode label="Transport Layer Security" value={packet.tls.handshakeType ?? packet.tls.contentType}>
          <Leaf label="Content Type" value={packet.tls.contentType} />
          <Leaf label="Version" value={packet.tls.version} />
          <Leaf label="Length" value={`${packet.tls.length} bytes`} />
          {packet.tls.handshakeType && <Leaf label="Handshake Type" value={packet.tls.handshakeType} />}
          {packet.tls.serverName && <Leaf label="Server Name (SNI)" value={packet.tls.serverName} />}
          {packet.tls.cipherSuites && (
            <TreeNode label="Cipher Suites" defaultOpen={false}>
              {packet.tls.cipherSuites.map(cs => (
                <Leaf key={cs} label="Cipher Suite" value={cs} />
              ))}
            </TreeNode>
          )}
        </TreeNode>
      )}

      {/* Generic protocol views (DHCP, STP, NTP, LLDP, SNMP, OSPF, SSDP, mDNS, SIP, …) */}
      {packet.protoViews?.map((view, i) => (
        <TreeNode key={i} label={view.name} value={view.summary}>
          {view.fields.map((f, j) => (
            <Leaf key={j} label={f.key} value={f.value} />
          ))}
        </TreeNode>
      ))}
    </div>
  )
}
