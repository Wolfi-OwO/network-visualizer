import { useState, useEffect } from 'react'
import { X, Server, GitBranch, Shield, Wifi, Plus, Trash2, ChevronDown, ChevronRight, Network, Globe, Boxes, Power, Cpu, Cable } from 'lucide-react'
import type {
  NetworkNode, FirewallRule, RoutingTableEntry, NetworkNodeConfig, NetworkInterface,
  DhcpConfig, DnsConfig, DnsRecord, DnsRecordType, ServiceConfig,
} from '../../types'
import { meta, canHostServices, hardwareFor, isWireless } from './deviceCatalog'

type PropsTab = 'info' | 'interfaces' | 'routing' | 'firewall' | 'vlans' | 'dhcp' | 'dns' | 'services'

// Security zones a device can be assigned to
const SECURITY_ZONES = ['Internal', 'DMZ', 'External', 'Management', 'Guest', 'Production', 'Development'] as const

// Common services the user can switch on with one click
const SERVICE_CATALOG: { name: string; port: number; protocol: 'tcp' | 'udp' }[] = [
  { name: 'HTTP',   port: 80,   protocol: 'tcp' },
  { name: 'HTTPS',  port: 443,  protocol: 'tcp' },
  { name: 'SSH',    port: 22,   protocol: 'tcp' },
  { name: 'FTP',    port: 21,   protocol: 'tcp' },
  { name: 'SMTP',   port: 25,   protocol: 'tcp' },
  { name: 'DNS',    port: 53,   protocol: 'udp' },
  { name: 'RDP',    port: 3389, protocol: 'tcp' },
  { name: 'Telnet', port: 23,   protocol: 'tcp' },
]

interface PropertiesPanelProps {
  node: NetworkNode | null
  onClose: () => void
  onChange?: (nodeId: string, config: NetworkNodeConfig) => void
}

// ── Small reusable field ────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="text-[10px] text-[var(--text-muted)] w-20 shrink-0 pt-1.5">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function TinyInput({ value, onChange, placeholder, type = 'text', className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; className?: string
}) {
  return (
    <input
      className={`input text-[11px] h-6 py-0 px-2 font-mono ${className}`}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
    />
  )
}

// ── Interface row ────────────────────────────────────────────────────────────
function InterfaceRow({ iface, onUpdate, onDelete }: {
  iface: NetworkInterface
  onUpdate: (updated: NetworkInterface) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const upd = (k: keyof NetworkInterface, v: string) => onUpdate({ ...iface, [k]: v })

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[var(--bg-700)]" onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown size={10} className="text-[var(--text-muted)]" /> : <ChevronRight size={10} className="text-[var(--text-muted)]" />}
        <span className="text-[11px] font-mono font-semibold text-[var(--text-primary)] flex-1">{iface.name || 'eth?'}</span>
        <button
          onClick={e => { e.stopPropagation(); onUpdate({ ...iface, status: iface.status === 'up' ? 'down' : 'up' }) }}
          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${iface.status === 'up' ? 'bg-[rgba(63,185,80,0.2)] text-[var(--green)]' : 'bg-[rgba(248,81,73,0.2)] text-[var(--red)]'}`}
        >{iface.status.toUpperCase()}</button>
        <button onClick={e => { e.stopPropagation(); onDelete() }} className="text-[var(--red)] opacity-60 hover:opacity-100 p-0.5">
          <Trash2 size={10} />
        </button>
      </div>
      {open && (
        <div className="px-2 pb-2 space-y-1.5 border-t border-[var(--border)]">
          <div className="pt-1.5 grid grid-cols-2 gap-1.5">
            <Field label="Name"><TinyInput value={iface.name} onChange={v => upd('name', v)} placeholder="eth0" /></Field>
            <Field label="IP"><TinyInput value={iface.ipAddress ?? ''} onChange={v => upd('ipAddress', v)} placeholder="10.0.0.1" /></Field>
            <Field label="Mask"><TinyInput value={iface.subnetMask ?? ''} onChange={v => upd('subnetMask', v)} placeholder="255.255.255.0" /></Field>
            <Field label="CIDR"><TinyInput value={iface.cidr ?? ''} onChange={v => upd('cidr', v)} placeholder="/24" /></Field>
            <Field label="Speed"><TinyInput value={iface.speed ?? ''} onChange={v => upd('speed', v)} placeholder="1 Gbps" /></Field>
            <Field label="MAC"><TinyInput value={iface.macAddress ?? ''} onChange={v => upd('macAddress', v)} placeholder="aa:bb:cc:dd:ee:ff" /></Field>
            <Field label="VLAN">
              <TinyInput
                value={iface.vlan != null ? String(iface.vlan) : ''}
                onChange={v => onUpdate({ ...iface, vlan: v === '' ? undefined : (parseInt(v, 10) || undefined) })}
                type="number" placeholder="1 (untagged)"
              />
            </Field>
          </div>
          <Field label="Desc"><TinyInput value={iface.description ?? ''} onChange={v => upd('description', v)} placeholder="WAN link" /></Field>
        </div>
      )}
    </div>
  )
}

// ── Route row ────────────────────────────────────────────────────────────────
function RouteRow({ route, onUpdate, onDelete }: {
  route: RoutingTableEntry
  onUpdate: (updated: RoutingTableEntry) => void
  onDelete: () => void
}) {
  const upd = (k: keyof RoutingTableEntry, v: string | number) => onUpdate({ ...route, [k]: v })
  const typeColors: Record<string, string> = {
    connected: 'text-[var(--green)]', static: 'text-[var(--accent)]',
    default: 'text-[var(--yellow)]', dynamic: 'text-[var(--purple)]',
  }
  return (
    <tr className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-700)] group">
      <td className="px-1 py-1">
        <input className="input text-[10px] h-5 py-0 px-1 font-mono w-full" value={route.destination}
          onChange={e => upd('destination', e.target.value)} placeholder="0.0.0.0" />
      </td>
      <td className="px-1 py-1">
        <input className="input text-[10px] h-5 py-0 px-1 font-mono w-full" value={route.mask}
          onChange={e => upd('mask', e.target.value)} placeholder="0.0.0.0" />
      </td>
      <td className="px-1 py-1">
        <input className="input text-[10px] h-5 py-0 px-1 font-mono w-full" value={route.gateway}
          onChange={e => upd('gateway', e.target.value)} placeholder="10.0.0.1" />
      </td>
      <td className="px-1 py-1">
        <input className="input text-[10px] h-5 py-0 px-1 font-mono w-full" value={route.interface}
          onChange={e => upd('interface', e.target.value)} placeholder="eth0" />
      </td>
      <td className="px-1 py-1">
        <input className="input text-[10px] h-5 py-0 px-1 font-mono w-12" type="number" value={route.metric}
          onChange={e => upd('metric', parseInt(e.target.value) || 0)} />
      </td>
      <td className="px-1 py-1">
        <select className="select text-[10px] h-5 py-0 px-1"
          value={route.type} onChange={e => upd('type', e.target.value)}>
          {(['static', 'connected', 'default', 'dynamic'] as const).map(t =>
            <option key={t} value={t}>{t}</option>
          )}
        </select>
      </td>
      <td className="px-1 py-1">
        <button onClick={onDelete} className={`opacity-0 group-hover:opacity-100 ${typeColors[route.type] ?? ''} transition-opacity`}>
          <Trash2 size={10} className="text-[var(--red)]" />
        </button>
      </td>
    </tr>
  )
}

// ── Firewall rule row ────────────────────────────────────────────────────────
function FirewallRuleRow({ rule, onUpdate, onDelete }: {
  rule: FirewallRule
  onUpdate: (updated: FirewallRule) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const upd = (k: keyof FirewallRule, v: string | number | boolean) => onUpdate({ ...rule, [k]: v })
  const actionColor = rule.action === 'allow' ? 'text-[var(--green)]' : 'text-[var(--red)]'

  return (
    <div className={`card p-0 overflow-hidden border-l-2 ${rule.action === 'allow' ? 'border-l-[var(--green)]' : 'border-l-[var(--red)]'} ${rule.enabled ? '' : 'opacity-50'}`}>
      <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[var(--bg-700)]" onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown size={10} className="text-[var(--text-muted)]" /> : <ChevronRight size={10} className="text-[var(--text-muted)]" />}
        <span className="text-[10px] text-[var(--text-muted)] font-mono w-4">#{rule.priority}</span>
        <span className={`text-[10px] font-bold ${actionColor} w-10`}>{rule.action.toUpperCase()}</span>
        <span className="badge text-[9px] bg-[var(--bg-700)] text-[var(--text-secondary)]">{rule.protocol.toUpperCase()}</span>
        <span className="text-[10px] text-[var(--text-muted)] flex-1 truncate">{rule.description}</span>
        <button
          onClick={e => { e.stopPropagation(); upd('enabled', !rule.enabled) }}
          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${rule.enabled ? 'bg-[var(--green)] border-[var(--green)]' : 'bg-transparent border-[var(--bg-600)]'}`}
        />
        <button onClick={e => { e.stopPropagation(); onDelete() }} className="text-[var(--red)] opacity-60 hover:opacity-100 p-0.5">
          <Trash2 size={10} />
        </button>
      </div>
      {open && (
        <div className="px-2 pb-2 border-t border-[var(--border)] space-y-1.5 pt-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Description">
              <TinyInput value={rule.description} onChange={v => upd('description', v)} placeholder="Allow HTTP" className="w-full" />
            </Field>
            <Field label="Priority">
              <TinyInput value={String(rule.priority)} onChange={v => upd('priority', parseInt(v) || 1)} type="number" />
            </Field>
            <Field label="Action">
              <select className="select text-[10px] h-6 py-0 px-2 w-full" value={rule.action}
                onChange={e => upd('action', e.target.value)}>
                <option value="allow">allow</option>
                <option value="deny">deny</option>
                <option value="drop">drop</option>
                <option value="reject">reject</option>
              </select>
            </Field>
            <Field label="Protocol">
              <select className="select text-[10px] h-6 py-0 px-2 w-full" value={rule.protocol}
                onChange={e => upd('protocol', e.target.value)}>
                <option value="any">any</option>
                <option value="tcp">tcp</option>
                <option value="udp">udp</option>
                <option value="icmp">icmp</option>
              </select>
            </Field>
            <Field label="Src IP"><TinyInput value={rule.srcIp} onChange={v => upd('srcIp', v)} placeholder="any" /></Field>
            <Field label="Src Port"><TinyInput value={rule.srcPort} onChange={v => upd('srcPort', v)} placeholder="any" /></Field>
            <Field label="Dst IP"><TinyInput value={rule.dstIp} onChange={v => upd('dstIp', v)} placeholder="any" /></Field>
            <Field label="Dst Port"><TinyInput value={rule.dstPort} onChange={v => upd('dstPort', v)} placeholder="any" /></Field>
            <Field label="Direction">
              <select className="select text-[10px] h-6 py-0 px-2 w-full" value={rule.direction}
                onChange={e => upd('direction', e.target.value)}>
                <option value="in">in</option>
                <option value="out">out</option>
                <option value="both">both</option>
              </select>
            </Field>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Blank defaults ───────────────────────────────────────────────────────────
function newIface(): NetworkInterface {
  return { name: 'eth0', ipAddress: '', subnetMask: '255.255.255.0', status: 'up', speed: '1 Gbps' }
}

function newRoute(priority: number): RoutingTableEntry {
  return { id: `r-${Date.now()}`, destination: '0.0.0.0', mask: '0.0.0.0', gateway: '', interface: 'eth0', metric: priority * 10, type: 'static' }
}

function newRule(priority: number): FirewallRule {
  return { id: `fw-${Date.now()}`, priority, action: 'allow', protocol: 'any', srcIp: 'any', srcPort: 'any', dstIp: 'any', dstPort: 'any', direction: 'in', description: 'New rule', enabled: true }
}

function newService(): ServiceConfig {
  return { id: `svc-${Date.now()}`, name: 'Custom', port: 8080, protocol: 'tcp', enabled: true, description: '', version: '' }
}

// ── Editable service / open-port row ──────────────────────────────────────────
function ServiceRow({ svc, onUpdate, onDelete }: {
  svc: ServiceConfig
  onUpdate: (s: ServiceConfig) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const upd = (k: keyof ServiceConfig, v: string | number | boolean) => onUpdate({ ...svc, [k]: v })
  return (
    <div className={`card p-0 overflow-hidden ${svc.enabled ? '' : 'opacity-55'}`}>
      <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[var(--bg-700)]" onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown size={10} className="text-[var(--text-muted)]" /> : <ChevronRight size={10} className="text-[var(--text-muted)]" />}
        <button
          onClick={e => { e.stopPropagation(); upd('enabled', !svc.enabled) }}
          title={svc.enabled ? 'Stop service (close port)' : 'Start service (open port)'}
          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${svc.enabled ? 'bg-[var(--green)] border-[var(--green)]' : 'bg-transparent border-[var(--bg-600)]'}`}
        />
        <span className="text-[11px] font-semibold text-[var(--text-primary)] flex-1 truncate">{svc.name || 'service'}</span>
        <span className="badge text-[9px] bg-[var(--bg-700)] text-[var(--text-secondary)] font-mono">{svc.protocol}/{svc.port}</span>
        <button onClick={e => { e.stopPropagation(); onDelete() }} className="text-[var(--red)] opacity-60 hover:opacity-100 p-0.5">
          <Trash2 size={10} />
        </button>
      </div>
      {open && (
        <div className="px-2 pb-2 border-t border-[var(--border)] space-y-1.5 pt-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Name"><TinyInput value={svc.name} onChange={v => upd('name', v)} placeholder="HTTP" className="w-full" /></Field>
            <Field label="Port"><TinyInput value={String(svc.port)} onChange={v => upd('port', parseInt(v) || 0)} type="number" /></Field>
            <Field label="Protocol">
              <select className="select text-[10px] h-6 py-0 px-2 w-full" value={svc.protocol} onChange={e => upd('protocol', e.target.value)}>
                <option value="tcp">tcp</option>
                <option value="udp">udp</option>
              </select>
            </Field>
            <Field label="Version"><TinyInput value={svc.version ?? ''} onChange={v => upd('version', v)} placeholder="1.0" /></Field>
          </div>
          <Field label="Description"><TinyInput value={svc.description ?? ''} onChange={v => upd('description', v)} placeholder="What this service does" className="w-full" /></Field>
        </div>
      )}
    </div>
  )
}

function defaultDhcp(): DhcpConfig {
  return { enabled: true, poolStart: '192.168.1.100', poolEnd: '192.168.1.200', subnetMask: '255.255.255.0', gateway: '192.168.1.1', dnsServers: '8.8.8.8, 1.1.1.1', leaseHours: 24 }
}

function defaultDns(): DnsConfig {
  return { enabled: true, forwarders: '8.8.8.8, 1.1.1.1', records: [] }
}

function newDnsRecord(): DnsRecord {
  return { id: `dns-${Date.now()}`, hostname: 'host.example.com', type: 'A', value: '192.168.1.10', ttl: 3600 }
}

// ── DNS record row ─────────────────────────────────────────────────────────
function DnsRecordRow({ record, onUpdate, onDelete }: {
  record: DnsRecord
  onUpdate: (r: DnsRecord) => void
  onDelete: () => void
}) {
  const upd = (k: keyof DnsRecord, v: string | number) => onUpdate({ ...record, [k]: v })
  return (
    <tr className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-700)] group">
      <td className="px-1 py-1">
        <input className="input text-[10px] h-5 py-0 px-1 font-mono w-full" value={record.hostname}
          onChange={e => upd('hostname', e.target.value)} placeholder="www.site.com" />
      </td>
      <td className="px-1 py-1">
        <select className="select text-[10px] h-5 py-0 px-1" value={record.type}
          onChange={e => upd('type', e.target.value as DnsRecordType)}>
          {(['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT'] as const).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </td>
      <td className="px-1 py-1">
        <input className="input text-[10px] h-5 py-0 px-1 font-mono w-full" value={record.value}
          onChange={e => upd('value', e.target.value)} placeholder="10.0.0.5" />
      </td>
      <td className="px-1 py-1">
        <input className="input text-[10px] h-5 py-0 px-1 font-mono w-14" type="number" value={record.ttl}
          onChange={e => upd('ttl', parseInt(e.target.value) || 0)} />
      </td>
      <td className="px-1 py-1">
        <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 size={10} className="text-[var(--red)]" />
        </button>
      </td>
    </tr>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function PropertiesPanel({ node, onClose, onChange }: PropertiesPanelProps) {
  const [config, setConfig] = useState<NetworkNodeConfig>(node?.config ?? {})
  const [tab, setTab] = useState<PropsTab>('info')

  useEffect(() => {
    if (node) { setConfig(node.config); setTab('info') }
  }, [node?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!node) return null

  const push = (partial: Partial<NetworkNodeConfig>) => {
    const next = { ...config, ...partial }
    setConfig(next)
    onChange?.(node.id, next)
  }

  const canShowTab = (id: PropsTab) => {
    if (id === 'info') return true
    if (id === 'interfaces') return node.type !== 'cloud' && node.type !== 'www'
    if (id === 'routing') return ['router', 'firewall', 'server'].includes(node.type)
    if (id === 'firewall') return ['router', 'firewall'].includes(node.type)
    if (id === 'vlans') return ['switch', 'router'].includes(node.type)
    if (id === 'dhcp') return ['dhcp', 'router', 'server'].includes(node.type)
    if (id === 'dns') return ['dns', 'www', 'server'].includes(node.type)
    if (id === 'services') return canHostServices(node.type)
    return false
  }

  const allTabs: { id: PropsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'info',       label: 'Info',       icon: <Server size={11} /> },
    { id: 'interfaces', label: 'Interfaces', icon: <Wifi size={11} /> },
    { id: 'services',   label: 'Services',   icon: <Boxes size={11} /> },
    { id: 'routing',    label: 'Routing',    icon: <GitBranch size={11} /> },
    { id: 'firewall',   label: 'Firewall',   icon: <Shield size={11} /> },
    { id: 'dhcp',       label: 'DHCP',       icon: <Network size={11} /> },
    { id: 'dns',        label: 'DNS',        icon: <Globe size={11} /> },
    { id: 'vlans',      label: 'VLANs',      icon: null as React.ReactNode },
  ]
  const tabs = allTabs.filter(t => canShowTab(t.id))

  const ifaces = config.interfaces ?? []
  const routes = config.routingTable ?? []
  const rules = config.firewallRules ?? []
  const dhcp = config.dhcp ?? null
  const dns = config.dns ?? null
  const services = config.services ?? []
  const webPage = config.webPage ?? null
  const httpOn = services.some(s => s.enabled && (s.port === 80 || s.port === 443))
  const m = meta(node.type)
  const HeaderIcon = m.Icon
  const powered = config.powered !== false

  return (
    <div className="flex flex-col h-full bg-[var(--bg-900)] border-l border-[var(--border)] w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-950)] shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: m.bg, border: `1px solid ${m.color}55` }}>
            <HeaderIcon size={15} color={m.color} strokeWidth={1.9} />
          </span>
          <div>
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              {config.hostname ?? node.label}
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">{m.label}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('netviz:togglePower', { detail: { id: node.id } }))}
            title={powered ? 'Power off' : 'Power on (auto-requests DHCP)'}
            className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] font-medium transition-colors"
            style={{ background: powered ? 'rgba(63,185,80,0.15)' : 'var(--bg-800)', color: powered ? 'var(--green)' : 'var(--text-muted)' }}
          >
            <Power size={11} />{powered ? 'On' : 'Off'}
          </button>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)] bg-[var(--bg-950)] overflow-x-auto shrink-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={[
              'flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium whitespace-nowrap border-b-2 transition-colors',
              tab === t.id ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
            ].join(' ')}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Info ── */}
        {tab === 'info' && (
          <div className="p-3 space-y-2">
            <Field label="Hostname">
              <TinyInput value={config.hostname ?? ''} onChange={v => push({ hostname: v })} placeholder="router-01" />
            </Field>
            <Field label="Description">
              <TinyInput value={config.description ?? ''} onChange={v => push({ description: v })} placeholder="Core router" />
            </Field>
            <Field label="Model">
              <TinyInput value={config.model ?? ''} onChange={v => push({ model: v })} placeholder="Cisco ISR 4321" />
            </Field>
            <Field label="OS">
              <TinyInput value={config.osType ?? ''} onChange={v => push({ osType: v })} placeholder="IOS 15.7" />
            </Field>
            <Field label="Mgmt IP">
              <TinyInput value={config.mgmtIp ?? ''} onChange={v => push({ mgmtIp: v })} placeholder="192.168.1.1" />
            </Field>
            <Field label="Serial">
              <TinyInput value={config.serialNumber ?? ''} onChange={v => push({ serialNumber: v })} placeholder="SN-000001" />
            </Field>
            <Field label="Security Zone">
              <select
                className="select text-[11px] h-6 py-0 px-2 w-full"
                value={config.zone ?? ''}
                onChange={e => push({ zone: e.target.value || undefined })}
              >
                <option value="">— none —</option>
                {SECURITY_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </Field>

            {/* Hardware / capabilities */}
            <div className="pt-2 mt-1 border-t border-[var(--border)]">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5 flex items-center gap-1">
                <Cpu size={10} /> Hardware &amp; capabilities
              </div>
              <div className="flex flex-wrap gap-1">
                {hardwareFor(node.type).map(h => (
                  <span key={h} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-800)] border border-[var(--border)] text-[var(--text-secondary)]">
                    {h}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1">{isWireless(node.type)
                  ? <><Wifi size={10} className="text-[var(--green)]" /> Wireless</>
                  : <><Cable size={10} /> Wired only</>}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Interfaces ── */}
        {tab === 'interfaces' && (
          <div className="p-2 space-y-1.5">
            {ifaces.map((iface, i) => (
              <InterfaceRow
                key={i}
                iface={iface}
                onUpdate={updated => {
                  const next = ifaces.map((x, j) => j === i ? updated : x)
                  push({ interfaces: next })
                }}
                onDelete={() => {
                  push({ interfaces: ifaces.filter((_, j) => j !== i) })
                }}
              />
            ))}
            <button
              onClick={() => push({ interfaces: [...ifaces, newIface()] })}
              className="btn-ghost w-full justify-center text-[10px]"
            >
              <Plus size={10} /> Add Interface
            </button>
          </div>
        )}

        {/* ── Routing ── */}
        {tab === 'routing' && (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    {['Dest', 'Mask', 'Gateway', 'Iface', 'M', 'Type', ''].map(h => (
                      <th key={h} className="px-1 py-1.5 text-left text-[var(--text-muted)] font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {routes.map((r, i) => (
                    <RouteRow
                      key={r.id}
                      route={r}
                      onUpdate={updated => {
                        const next = routes.map((x, j) => j === i ? updated : x)
                        push({ routingTable: next })
                      }}
                      onDelete={() => push({ routingTable: routes.filter((_, j) => j !== i) })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-2">
              <button
                onClick={() => push({ routingTable: [...routes, newRoute(routes.length + 1)] })}
                className="btn-ghost w-full justify-center text-[10px]"
              >
                <Plus size={10} /> Add Route
              </button>
            </div>
          </div>
        )}

        {/* ── Firewall ── */}
        {tab === 'firewall' && (
          <div className="p-2 space-y-1.5">
            {rules.map((rule, i) => (
              <FirewallRuleRow
                key={rule.id}
                rule={rule}
                onUpdate={updated => {
                  const next = rules.map((x, j) => j === i ? updated : x)
                  push({ firewallRules: next })
                }}
                onDelete={() => push({ firewallRules: rules.filter((_, j) => j !== i) })}
              />
            ))}
            <button
              onClick={() => push({ firewallRules: [...rules, newRule(rules.length + 1)] })}
              className="btn-ghost w-full justify-center text-[10px]"
            >
              <Plus size={10} /> Add Rule
            </button>
          </div>
        )}

        {/* ── Services ── */}
        {tab === 'services' && (
          <div className="p-3 space-y-3">
            {/* Quick-add common services */}
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">Quick add</div>
              <div className="flex flex-wrap gap-1">
                {SERVICE_CATALOG.map(svc => {
                  const on = services.some(s => s.name === svc.name)
                  return (
                    <button
                      key={svc.name}
                      disabled={on}
                      onClick={() => push({ services: [...services, { id: `svc-${Date.now()}-${svc.port}`, name: svc.name, port: svc.port, protocol: svc.protocol, enabled: true }] })}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors disabled:opacity-40"
                      style={{ background: 'var(--bg-800)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                      title={on ? 'Already added' : `Open ${svc.protocol}/${svc.port}`}
                    >
                      + {svc.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Open ports / running services — fully editable */}
            <div className="space-y-1.5">
              <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Open ports / services</div>
              {services.map((s, i) => (
                <ServiceRow
                  key={s.id}
                  svc={s}
                  onUpdate={updated => push({ services: services.map((x, j) => j === i ? updated : x) })}
                  onDelete={() => push({ services: services.filter((_, j) => j !== i) })}
                />
              ))}
              <button onClick={() => push({ services: [...services, newService()] })} className="btn-ghost w-full justify-center text-[10px]">
                <Plus size={10} /> Add custom service / open port
              </button>
              {services.length === 0 && (
                <p className="text-[10px] text-[var(--text-muted)] text-center py-1">
                  No open ports. Add a service to make this host respond to traffic on that port.
                </p>
              )}
            </div>

            {/* Mini web page editor (when HTTP/HTTPS is on) */}
            {httpOn && (
              <div className="space-y-1.5 border-t border-[var(--border)] pt-2">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                  <Globe size={10} /> Hosted web page
                </div>
                <Field label="Title">
                  <TinyInput
                    value={webPage?.title ?? ''}
                    onChange={v => push({ webPage: { title: v, body: webPage?.body ?? '' } })}
                    placeholder="My Company Intranet"
                    className="w-full"
                  />
                </Field>
                <textarea
                  className="input text-[11px] w-full h-24 font-mono resize-none"
                  value={webPage?.body ?? ''}
                  onChange={e => push({ webPage: { title: webPage?.title ?? '', body: e.target.value } })}
                  placeholder={'<h1>Welcome</h1>\n<p>This page is served by this device.</p>'}
                />
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                  When another device sends an HTTP request to this host, the trace shows the page title in the response.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── DHCP ── */}
        {tab === 'dhcp' && (
          <div className="p-3 space-y-2">
            {!dhcp ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-[11px] text-[var(--text-muted)]">No DHCP scope configured on this device.</p>
                <button onClick={() => push({ dhcp: defaultDhcp() })} className="btn-primary text-[10px] mx-auto">
                  <Plus size={10} /> Enable DHCP Server
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-[var(--text-primary)]">DHCP Scope</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <span className="text-[10px] text-[var(--text-muted)]">{dhcp.enabled ? 'Enabled' : 'Disabled'}</span>
                    <button
                      onClick={() => push({ dhcp: { ...dhcp, enabled: !dhcp.enabled } })}
                      className={`w-8 h-4 rounded-full transition-colors relative ${dhcp.enabled ? 'bg-[var(--green)]' : 'bg-[var(--bg-600)]'}`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${dhcp.enabled ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </label>
                </div>
                <Field label="Pool Start"><TinyInput value={dhcp.poolStart} onChange={v => push({ dhcp: { ...dhcp, poolStart: v } })} placeholder="192.168.1.100" /></Field>
                <Field label="Pool End"><TinyInput value={dhcp.poolEnd} onChange={v => push({ dhcp: { ...dhcp, poolEnd: v } })} placeholder="192.168.1.200" /></Field>
                <Field label="Subnet Mask"><TinyInput value={dhcp.subnetMask} onChange={v => push({ dhcp: { ...dhcp, subnetMask: v } })} placeholder="255.255.255.0" /></Field>
                <Field label="Gateway"><TinyInput value={dhcp.gateway} onChange={v => push({ dhcp: { ...dhcp, gateway: v } })} placeholder="192.168.1.1" /></Field>
                <Field label="DNS Servers"><TinyInput value={dhcp.dnsServers} onChange={v => push({ dhcp: { ...dhcp, dnsServers: v } })} placeholder="8.8.8.8, 1.1.1.1" /></Field>
                <Field label="Lease (h)"><TinyInput value={String(dhcp.leaseHours)} onChange={v => push({ dhcp: { ...dhcp, leaseHours: parseInt(v) || 0 } })} type="number" /></Field>
                <button onClick={() => push({ dhcp: undefined })} className="btn-ghost w-full justify-center text-[10px] text-[var(--red)] mt-2">
                  <Trash2 size={10} /> Remove DHCP Scope
                </button>
              </>
            )}
          </div>
        )}

        {/* ── DNS ── */}
        {tab === 'dns' && (
          <div className="p-2 space-y-2">
            {!dns ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-[11px] text-[var(--text-muted)]">No DNS zone configured on this device.</p>
                <button onClick={() => push({ dns: defaultDns() })} className="btn-primary text-[10px] mx-auto">
                  <Plus size={10} /> Enable DNS Server
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-semibold text-[var(--text-primary)]">DNS Zone</span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <span className="text-[10px] text-[var(--text-muted)]">{dns.enabled ? 'Enabled' : 'Disabled'}</span>
                    <button
                      onClick={() => push({ dns: { ...dns, enabled: !dns.enabled } })}
                      className={`w-8 h-4 rounded-full transition-colors relative ${dns.enabled ? 'bg-[var(--green)]' : 'bg-[var(--bg-600)]'}`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${dns.enabled ? 'left-4' : 'left-0.5'}`} />
                    </button>
                  </label>
                </div>
                <div className="px-1">
                  <Field label="Forwarders"><TinyInput value={dns.forwarders} onChange={v => push({ dns: { ...dns, forwarders: v } })} placeholder="8.8.8.8, 1.1.1.1" /></Field>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        {['Hostname', 'Type', 'Value', 'TTL', ''].map(h => (
                          <th key={h} className="px-1 py-1.5 text-left text-[var(--text-muted)] font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dns.records.map((r, i) => (
                        <DnsRecordRow
                          key={r.id}
                          record={r}
                          onUpdate={updated => push({ dns: { ...dns, records: dns.records.map((x, j) => j === i ? updated : x) } })}
                          onDelete={() => push({ dns: { ...dns, records: dns.records.filter((_, j) => j !== i) } })}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => push({ dns: { ...dns, records: [...dns.records, newDnsRecord()] } })} className="btn-ghost w-full justify-center text-[10px]">
                  <Plus size={10} /> Add Record
                </button>
                <button onClick={() => push({ dns: undefined })} className="btn-ghost w-full justify-center text-[10px] text-[var(--red)]">
                  <Trash2 size={10} /> Remove DNS Zone
                </button>
              </>
            )}
          </div>
        )}

        {/* ── VLANs ── */}
        {tab === 'vlans' && (
          <div className="p-2 space-y-2">
            {(config.vlans ?? []).map(vlan => (
              <div key={vlan.id} className="card p-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge bg-[rgba(88,166,255,0.2)] text-[var(--accent)] text-[10px] font-mono">
                    VLAN {vlan.id}
                  </span>
                  <span className="text-xs font-medium text-[var(--text-primary)]">{vlan.name}</span>
                </div>
                {vlan.ports.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {vlan.ports.map(p => (
                      <span key={p} className="text-[9px] font-mono text-[var(--text-muted)] bg-[var(--bg-700)] px-1 py-0.5 rounded">{p}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!(config.vlans?.length) && (
              <p className="text-[10px] text-[var(--text-muted)] text-center py-4">No VLANs configured</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
