import { useCallback, useEffect, useState } from 'react'
import { TerminalSquare, RefreshCw, X, Download } from 'lucide-react'
import { network } from '../../lib/api/index.ts'
import type { ControlPlaneReport } from '../../lib/api/index.ts'

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function Section({ title, cmd, children }: { title: string; cmd: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">{title}</div>
      <div className="text-[10px] font-mono text-[var(--green)] mb-1">$ {cmd}</div>
      <div className="font-mono text-[11px] text-[var(--text-secondary)] overflow-x-auto">{children}</div>
    </div>
  )
}

const th = 'text-left pr-3 text-[var(--text-muted)] font-normal'
const td = 'pr-3 whitespace-nowrap text-[var(--text-primary)]'

// CLI-style "show" output: the operational state tables a real device holds,
// for the currently-selected node.
export default function DeviceStatePanel({ topologyId, nodeId, onClose }: {
  topologyId?: string
  nodeId: string | null
  onClose: () => void
}) {
  const [report, setReport] = useState<ControlPlaneReport | null>(null)
  const [config, setConfig] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async () => {
    if (!topologyId || !nodeId) { setReport(null); setConfig(''); return }
    setLoading(true); setError('')
    try {
      const [cp, cfg] = await Promise.all([
        network.controlPlane(topologyId, nodeId),
        network.deviceConfig(topologyId, nodeId),
      ])
      setReport(cp.data)
      setConfig(cfg.data)
    } catch {
      setError('Could not load device state (save the topology first).')
    } finally {
      setLoading(false)
    }
  }, [topologyId, nodeId])

  useEffect(() => { run() }, [run])

  const empty = report && !report.arp && !report.macTable && !report.dhcpLeases
    && !report.ospfNeighbors && !report.stp && !report.acl && !report.nat

  return (
    <div className="absolute bottom-3 right-3 w-96 max-h-[70%] flex flex-col rounded-lg bg-[var(--bg-900)] border border-[var(--border)] shadow-xl z-20 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
        <TerminalSquare size={14} className="text-[var(--accent)]" />
        <span className="text-xs font-semibold text-[var(--text-primary)]">
          Device state{report ? ` — ${report.hostname}` : ''}
        </span>
        <div className="flex-1" />
        <button onClick={run} title="Refresh" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <button onClick={onClose} title="Close" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <X size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!nodeId && <div className="text-xs text-[var(--text-muted)]">Select a device on the canvas to see its live state.</div>}
        {error && <div className="text-xs text-red-400">{error}</div>}
        {empty && <div className="text-xs text-[var(--text-muted)]">No control-plane state for this device type.</div>}

        {report?.macTable && (
          <Section title="MAC address table" cmd="show mac address-table">
            <table><tbody>
              <tr><th className={th}>VLAN</th><th className={th}>MAC</th><th className={th}>Port</th><th className={th}>Type</th></tr>
              {report.macTable.map((m, i) => (
                <tr key={i}><td className={td}>{m.vlan}</td><td className={td}>{m.mac}</td><td className={td}>{m.port}</td><td className={td}>{m.type}</td></tr>
              ))}
            </tbody></table>
          </Section>
        )}

        {report?.stp && (
          <Section title="Spanning tree" cmd="show spanning-tree">
            <div className="mb-1">
              bridge {report.stp.bridgeId} {report.stp.isRoot ? <span className="text-[var(--green)]">(root)</span> : <>root {report.stp.rootBridgeId}</>}
            </div>
            <table><tbody>
              <tr><th className={th}>Port</th><th className={th}>Neighbor</th><th className={th}>Role</th><th className={th}>State</th></tr>
              {report.stp.ports.map((p, i) => (
                <tr key={i}><td className={td}>{p.port}</td><td className={td}>{p.neighbor}</td><td className={td}>{p.role}</td>
                  <td className={p.state === 'blocking' ? 'pr-3 text-red-400' : 'pr-3 text-[var(--green)]'}>{p.state}</td></tr>
              ))}
            </tbody></table>
          </Section>
        )}

        {report?.arp && report.arp.length > 0 && (
          <Section title="ARP table" cmd="show ip arp">
            <table><tbody>
              <tr><th className={th}>Address</th><th className={th}>MAC</th><th className={th}>Interface</th><th className={th}>Type</th></tr>
              {report.arp.map((a, i) => (
                <tr key={i}><td className={td}>{a.ip}</td><td className={td}>{a.mac}</td><td className={td}>{a.iface}</td><td className={td}>{a.type}</td></tr>
              ))}
            </tbody></table>
          </Section>
        )}

        {report?.ospfNeighbors && report.ospfNeighbors.length > 0 && (
          <Section title="OSPF neighbors" cmd="show ip ospf neighbor">
            <table><tbody>
              <tr><th className={th}>Neighbor ID</th><th className={th}>State</th><th className={th}>Address</th><th className={th}>Interface</th></tr>
              {report.ospfNeighbors.map((o, i) => (
                <tr key={i}><td className={td}>{o.neighborId}</td><td className={td}>{o.state}</td><td className={td}>{o.address}</td><td className={td}>{o.iface}</td></tr>
              ))}
            </tbody></table>
          </Section>
        )}

        {report?.dhcpLeases && report.dhcpLeases.length > 0 && (
          <Section title="DHCP leases" cmd="show ip dhcp binding">
            <table><tbody>
              <tr><th className={th}>IP</th><th className={th}>MAC</th><th className={th}>Host</th><th className={th}>State</th><th className={th}>Lease</th></tr>
              {report.dhcpLeases.map((l, i) => (
                <tr key={i}><td className={td}>{l.ip}</td><td className={td}>{l.mac}</td><td className={td}>{l.hostname}</td><td className={td}>{l.state}</td><td className={td}>{l.lease}</td></tr>
              ))}
            </tbody></table>
          </Section>
        )}

        {report?.acl && (
          <Section title="Firewall ACL (with hit counters)" cmd="show access-list">
            <table><tbody>
              <tr><th className={th}>#</th><th className={th}>Action</th><th className={th}>Proto</th><th className={th}>Src</th><th className={th}>Dst</th><th className={th}>Dir</th><th className={th}>Hits</th></tr>
              {report.acl.map((r, i) => (
                <tr key={i} className={r.enabled ? '' : 'opacity-50'}>
                  <td className={td}>{r.seq}</td>
                  <td className={r.action === 'allow' ? 'pr-3 text-[var(--green)]' : 'pr-3 text-red-400'}>{r.action}</td>
                  <td className={td}>{r.protocol}</td><td className={td}>{r.src}</td><td className={td}>{r.dst}</td><td className={td}>{r.direction}</td>
                  <td className={td}>{r.hits.toLocaleString()}</td>
                </tr>
              ))}
            </tbody></table>
          </Section>
        )}

        {report?.nat && report.nat.length > 0 && (
          <Section title="NAT translations" cmd="show ip nat translations">
            <table><tbody>
              <tr><th className={th}>Pro</th><th className={th}>Inside local</th><th className={th}>Inside global</th><th className={th}>Outside global</th></tr>
              {report.nat.map((n, i) => (
                <tr key={i}><td className={td}>{n.protocol}</td><td className={td}>{n.insideLocal}</td><td className={td}>{n.insideGlobal}</td><td className={td}>{n.outsideGlobal}</td></tr>
              ))}
            </tbody></table>
          </Section>
        )}

        {config && (
          <div className="mb-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Running config</span>
              <button
                onClick={() => downloadText(`${report?.hostname ?? 'device'}.cfg`, config)}
                className="text-[10px] flex items-center gap-1 text-[var(--accent)] hover:underline"
              >
                <Download size={10} /> download
              </button>
            </div>
            <pre className="font-mono text-[10px] leading-snug text-[var(--text-secondary)] bg-[var(--bg-950)] rounded p-2 overflow-x-auto whitespace-pre">{config}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
