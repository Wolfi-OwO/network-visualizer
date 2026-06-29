import { useReducer, useMemo, useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Node, type Edge, type Connection, type OnConnectStartParams,
  BackgroundVariant, ConnectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Save, RefreshCw, Trash2, CheckCircle, XCircle, AlertTriangle, X, GraduationCap, Hammer, Activity, Undo2, Redo2, ShieldCheck, TerminalSquare, Download, History, Layers } from 'lucide-react'
import type { NetworkTopology, NetworkNode as NetNode, NetworkEdge as NetEdge, NodeType, NetworkNodeConfig, NetworkInterface, RoutingTableEntry } from '../../types/index.ts'
import type { TraceResult } from '../../lib/api/index.ts'
import { network as networkApi } from '../../lib/api/index.ts'
import { nodeTypes, type NetworkNodeData, type NodeHighlight } from './custom-nodes.tsx'
import { isDhcpClient, meta } from './device-catalog.tsx'
import { edgeTypes, type PacketEdgeData, type PacketEdgeState } from './packet-edge.tsx'
import { PacketFlightLayer, type Flight } from './packet-flight-layer.tsx'
import NodePalette from './node-palette.tsx'
import PropertiesPanel from './properties-panel.tsx'
import EdgePropertiesPanel from './edge-properties-panel.tsx'
import ResizablePanel from '../../components/core/resizable-panel.tsx'
import PacketSender from './packet-sender.tsx'
import TracePanel from './trace-panel.tsx'
import Tutorial, { TUTORIAL_SEEN_KEY } from './tutorial.tsx'
import GuidedBuild from './guided-build.tsx'
import ValidationPanel from './validation-panel.tsx'
import DeviceStatePanel from './device-state-panel.tsx'
import VersionsPanel from './versions-panel.tsx'
import PacketInspector from './packet-inspector.tsx'
import { buildPacket, buildArp, buildTcp, appFromLabel, type PacketInfo, type AppProto } from './packet-model.ts'
import { builderReducer, initialBuilderState, type BuilderState } from './network-builder-page.reducer.ts'

// ── Converters ───────────────────────────────────────────────────────────────

function toFlowNode(n: NetNode): Node<NetworkNodeData> {
  return {
    id: n.id, type: n.type, position: n.position,
    data: { type: n.type, label: n.label, config: n.config, highlight: 'none' },
  }
}

function toFlowEdge(e: NetEdge): Edge<PacketEdgeData> {
  const lat = e.config?.latency ? parseFloat(e.config.latency) : undefined
  return {
    id: e.id, source: e.source, target: e.target, type: 'packet',
    data: {
      packetState: 'idle',
      edgeLabel: e.label,
      bandwidth: e.config?.bandwidth,
      latencyMs: Number.isFinite(lat) ? lat : undefined,
      linkStatus: e.config?.status,
    },
  }
}

// Parse a bandwidth string ("1 Gbps", "100 Mbps", "64 Kbps") to Mbps.
function bwToMbps(s?: string): number {
  if (!s) return 100
  const n = parseFloat(s)
  if (!Number.isFinite(n) || n <= 0) return 100
  if (/g/i.test(s)) return n * 1000
  if (/k/i.test(s)) return n / 1000
  return n
}

// Relative per-hop animation duration: a hop takes longer on a high-latency /
// low-bandwidth link than on a fast one (propagation ∝ latency, serialization ∝
// 1/bandwidth), referenced to a 100 Mbps / 1 ms link and bounded so it stays
// watchable. `baseMs` is the Fast/Normal/Slow speed setting.
function hopDuration(baseMs: number, latencyMs?: number, bandwidth?: string): number {
  const refLat = 1, refBw = 100
  const lat = latencyMs && latencyMs > 0 ? latencyMs : refLat
  const bw = bwToMbps(bandwidth)
  const mult = Math.sqrt(lat / refLat) * Math.sqrt(refBw / bw)
  return Math.round(Math.min(baseMs * 3, Math.max(baseMs * 0.35, baseMs * mult)))
}

// Map a ReactFlow edge back to a persistable NetworkEdge
function toNetEdge(e: Edge<PacketEdgeData>): NetEdge {
  const d = e.data ?? {}
  return {
    id: e.id, source: e.source, target: e.target,
    label: d.edgeLabel,
    config: {
      bandwidth: d.bandwidth,
      latency: d.latencyMs != null ? String(d.latencyMs) : undefined,
      status: d.linkStatus,
    },
  }
}

// ── IP / DHCP helpers ────────────────────────────────────────────────────────

function ipToInt(ip: string): number {
  return ip.split('.').reduce((a, o) => (a << 8) | (parseInt(o, 10) || 0), 0) >>> 0
}
function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}
function maskToCidr(mask: string): number {
  return mask.split('.').reduce((a, o) => {
    let b = parseInt(o, 10) || 0, c = 0
    while (b & 0x80) { c++; b = (b << 1) & 0xff }
    return a + c
  }, 0)
}
function setLastOctet(ip: string, last: number): string {
  const p = ip.split('.'); if (p.length === 4) p[3] = String(last); return p.join('.')
}
// All node ids reachable from `start` across the (undirected) edges
function reachableFrom(start: string, edges: { source: string; target: string }[]): Set<string> {
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, [])
    if (!adj.has(e.target)) adj.set(e.target, [])
    adj.get(e.source)!.push(e.target)
    adj.get(e.target)!.push(e.source)
  }
  const seen = new Set([start]); const q = [start]
  while (q.length) {
    const c = q.shift()!
    for (const nb of adj.get(c) ?? []) if (!seen.has(nb)) { seen.add(nb); q.push(nb) }
  }
  return seen
}
// Shortest path (node ids + edge ids) between two nodes over the links
function findPath(
  src: string, dst: string,
  edges: { id: string; source: string; target: string }[],
): { path: string[]; edgePath: string[] } | null {
  if (src === dst) return { path: [src], edgePath: [] }
  const adj = new Map<string, { node: string; edge: string }[]>()
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, [])
    if (!adj.has(e.target)) adj.set(e.target, [])
    adj.get(e.source)!.push({ node: e.target, edge: e.id })
    adj.get(e.target)!.push({ node: e.source, edge: e.id })
  }
  const prev = new Map<string, { node: string; edge: string }>()
  const seen = new Set([src]); const q = [src]
  while (q.length) {
    const cur = q.shift()!
    if (cur === dst) break
    for (const nb of adj.get(cur) ?? []) {
      if (!seen.has(nb.node)) { seen.add(nb.node); prev.set(nb.node, { node: cur, edge: nb.edge }); q.push(nb.node) }
    }
  }
  if (!seen.has(dst)) return null
  const path: string[] = [dst]; const edgePath: string[] = []
  let cur = dst
  while (cur !== src) {
    const p = prev.get(cur)!; path.unshift(p.node); edgePath.unshift(p.edge); cur = p.node
  }
  return { path, edgePath }
}

// Set the primary interface's IP / mask / cidr (creating eth0 if needed)
function assignIface(config: NetworkNodeConfig, ip: string, mask: string, cidr: string, desc?: string): NetworkNodeConfig {
  const base: NetworkInterface[] = config.interfaces && config.interfaces.length
    ? [...config.interfaces]
    : [{ name: 'eth0', status: 'up', speed: '1 Gbps' }]
  base[0] = { ...base[0], ipAddress: ip, subnetMask: mask, cidr, ...(desc ? { description: desc } : {}) }
  return { ...config, interfaces: base }
}

// ── Trace animation helpers ──────────────────────────────────────────────────

function getEdgeState(edgeId: string, result: TraceResult, step: number): PacketEdgeState {
  const idx = result.edgePath.indexOf(edgeId)
  if (idx === -1) return 'dimmed'
  const edgeHopIndex = idx + 1
  if (edgeHopIndex > step) return 'path'

  const blockedHopStep = result.hops.findIndex(
    h => h.action === 'firewall_deny' || h.action === 'firewall_drop' || h.action === 'ttl_exceeded' || h.action === 'no_route' || h.action === 'port_closed',
  )
  if (blockedHopStep !== -1 && edgeHopIndex === blockedHopStep) {
    return step >= edgeHopIndex ? 'blocked' : 'path'
  }
  if (edgeHopIndex === step) return 'active'
  return 'done'
}

function getNodeHighlight(nodeId: string, result: TraceResult, step: number): NodeHighlight {
  if (!result.path.includes(nodeId)) return 'none'
  const nodeStepIndex = result.path.indexOf(nodeId)
  if (nodeStepIndex > step) return 'path'
  const hop = result.hops.find(h => h.nodeId === nodeId)
  if (!hop) return 'none'
  if (['firewall_deny', 'firewall_drop', 'ttl_exceeded', 'no_route'].includes(hop.action)) {
    return step >= nodeStepIndex ? 'blocked' : 'path'
  }
  if (hop.action === 'delivered') return step >= nodeStepIndex ? 'delivered' : 'path'
  if (hop.step === step) return 'active'
  return 'path'
}

// ── Result overlay ───────────────────────────────────────────────────────────

function ResultOverlay({ result, onClose }: { result: TraceResult; onClose: () => void }) {
  const blockedHop = result.hops.find(h =>
    ['firewall_deny', 'firewall_drop', 'ttl_exceeded', 'no_route'].includes(h.action),
  )
  const deliveredHop = result.hops.find(h => h.action === 'delivered')

  return (
    <div style={{
      position: 'absolute', top: 16, left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50, minWidth: 360, maxWidth: 520,
      animation: 'slideDown 0.25s ease-out',
      pointerEvents: 'auto',
    }}>
      <div style={{
        background: result.success ? '#0d2018' : '#1e0a0a',
        border: `1.5px solid ${result.success ? '#3fb950' : '#f85149'}`,
        borderRadius: 10,
        boxShadow: result.success ? '0 4px 24px #3fb95044' : '0 4px 24px #f8514944',
        padding: '12px 16px',
      }}>
        <div className="flex items-center gap-2 mb-2">
          {result.success
            ? <CheckCircle size={16} color="#3fb950" />
            : result.blocked
              ? <XCircle size={16} color="#f85149" />
              : <AlertTriangle size={16} color="#d29922" />}
          <span style={{ fontSize: 13, fontWeight: 700, color: result.success ? '#3fb950' : '#f85149' }}>
            {result.success ? 'Packet Delivered' : result.blocked ? 'Packet Blocked' : 'Delivery Failed'}
          </span>
          <span style={{ fontSize: 11, color: '#8b949e', marginLeft: 4, fontFamily: 'monospace' }}>
            {result.hops.length - 1} hop{result.hops.length !== 2 ? 's' : ''} · {result.totalLatencyMs.toFixed(2)} ms
          </span>
          <button onClick={onClose}
            style={{ marginLeft: 'auto', color: '#6e7681', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
            <X size={14} />
          </button>
        </div>

        {/* Packet summary */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8, fontSize: 11, fontFamily: 'monospace' }}>
          {[
            { k: 'Proto', v: result.packet.protocol.toUpperCase(), c: '#ffa657' },
            { k: 'Src', v: result.packet.srcIp, c: '#e6edf3' },
            { k: 'Dst', v: `${result.packet.dstIp}${result.packet.dstPort ? `:${result.packet.dstPort}` : ''}`, c: '#e6edf3' },
            { k: 'TTL', v: String(result.packet.ttl), c: '#e6edf3' },
          ].map(({ k, v, c }) => (
            <span key={k} style={{ color: '#8b949e' }}>
              <span style={{ color: '#6e7681' }}>{k} </span>
              <span style={{ color: c }}>{v}</span>
            </span>
          ))}
        </div>

        {/* Path chips */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, fontSize: 11, fontFamily: 'monospace', marginBottom: blockedHop ? 8 : 0 }}>
          {result.hops.map((hop, i) => {
            const isBlocked = ['firewall_deny', 'firewall_drop'].includes(hop.action)
            const isDelivered = hop.action === 'delivered'
            return (
              <span key={hop.step} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && <span style={{ color: '#484f58' }}>→</span>}
                <span style={{
                  padding: '1px 6px', borderRadius: 4, fontSize: 10,
                  background: isBlocked ? '#3d0a0a' : isDelivered ? '#0d2a18' : '#21262d',
                  color: isBlocked ? '#f85149' : isDelivered ? '#3fb950' : '#8b949e',
                  border: `1px solid ${isBlocked ? '#f8514944' : isDelivered ? '#3fb95044' : '#30363d'}`,
                }}>
                  {hop.nodeName}
                </span>
              </span>
            )
          })}
        </div>

        {/* Block reason */}
        {blockedHop && (
          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 6, background: '#2d0a0a', border: '1px solid #f8514933' }}>
            <div style={{ fontSize: 11, color: '#f85149', fontWeight: 600, marginBottom: 3 }}>
              ⛔ Blocked at {blockedHop.nodeName}
            </div>
            <div style={{ fontSize: 10, color: '#8b949e', fontFamily: 'monospace', lineHeight: 1.6 }}>
              {blockedHop.detail}
            </div>
            {blockedHop.firewallRule && (
              <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 4, background: '#1a0808', fontSize: 10, fontFamily: 'monospace', color: '#6e7681', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span><span style={{ color: '#6e7681' }}>Rule #</span><span style={{ color: '#ffa657' }}>{blockedHop.firewallRule.priority}</span></span>
                <span><span style={{ color: '#6e7681' }}>Action: </span><span style={{ color: '#f85149', fontWeight: 700 }}>{blockedHop.firewallRule.action.toUpperCase()}</span></span>
                <span style={{ color: '#8b949e' }}>"{blockedHop.firewallRule.description}"</span>
              </div>
            )}
          </div>
        )}

        {deliveredHop && (
          <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: '#0a1e10', border: '1px solid #3fb95033', fontSize: 10, color: '#3fb950', fontFamily: 'monospace' }}>
            ✓ {deliveredHop.detail}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

const AUTOSAVE_KEY = 'netviz.topology.autosave.v1'

interface TopoSnapshot { nodes: NetNode[]; edges: NetEdge[] }

let nodeCounter = 100

export default function NetworkBuilderPage() {
  const [builder, dispatch] = useReducer(builderReducer, initialBuilderState)
  const {
    topology, selectedNodeId, selectedEdgeId, showValidation, showState, showVersions,
    showTutorial, guidedActive, saving, status, traceResult, traceStep,
    isAnimating, isPaused, animSpeed, liveMode,
  } = builder
  // Stable setX wrappers backed by the reducer (dispatch is stable), so existing
  // call sites and effect dependency arrays keep working unchanged.
  const {
    setTopology, setSelectedNodeId, setSelectedEdgeId, setShowValidation, setShowState, setShowVersions,
    setShowTutorial, setGuidedActive, setSaving, setStatus, setTraceResult, setTraceStep,
    setIsAnimating, setIsPaused, setAnimSpeed, setLiveMode, setHistTick,
  } = useMemo(() => ({
    setTopology: (v: SetStateAction<BuilderState['topology']>) => dispatch({ type: 'set', key: 'topology', value: v }),
    setSelectedNodeId: (v: SetStateAction<BuilderState['selectedNodeId']>) => dispatch({ type: 'set', key: 'selectedNodeId', value: v }),
    setSelectedEdgeId: (v: SetStateAction<BuilderState['selectedEdgeId']>) => dispatch({ type: 'set', key: 'selectedEdgeId', value: v }),
    setShowValidation: (v: SetStateAction<boolean>) => dispatch({ type: 'set', key: 'showValidation', value: v }),
    setShowState: (v: SetStateAction<boolean>) => dispatch({ type: 'set', key: 'showState', value: v }),
    setShowVersions: (v: SetStateAction<boolean>) => dispatch({ type: 'set', key: 'showVersions', value: v }),
    setShowTutorial: (v: SetStateAction<boolean>) => dispatch({ type: 'set', key: 'showTutorial', value: v }),
    setGuidedActive: (v: SetStateAction<boolean>) => dispatch({ type: 'set', key: 'guidedActive', value: v }),
    setSaving: (v: SetStateAction<boolean>) => dispatch({ type: 'set', key: 'saving', value: v }),
    setStatus: (v: SetStateAction<string>) => dispatch({ type: 'set', key: 'status', value: v }),
    setTraceResult: (v: SetStateAction<BuilderState['traceResult']>) => dispatch({ type: 'set', key: 'traceResult', value: v }),
    setTraceStep: (v: SetStateAction<number>) => dispatch({ type: 'set', key: 'traceStep', value: v }),
    setIsAnimating: (v: SetStateAction<boolean>) => dispatch({ type: 'set', key: 'isAnimating', value: v }),
    setIsPaused: (v: SetStateAction<boolean>) => dispatch({ type: 'set', key: 'isPaused', value: v }),
    setAnimSpeed: (v: SetStateAction<number>) => dispatch({ type: 'set', key: 'animSpeed', value: v }),
    setLiveMode: (v: SetStateAction<boolean>) => dispatch({ type: 'set', key: 'liveMode', value: v }),
    setHistTick: (v: SetStateAction<number>) => dispatch({ type: 'set', key: 'histTick', value: v }),
  }), [])
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NetworkNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<PacketEdgeData>>([])
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const connectingNodeId = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stepRef = useRef(0)
  const animSpeedRef = useRef(2000)   // mirrored from animSpeed each render
  const isPausedRef = useRef(false)
  const traceResultRef = useRef<TraceResult | null>(null)
  // Edges traversed target→source (dot must travel reversed)
  const edgeReversedRef = useRef<Set<string>>(new Set())
  // Incremented to force-remount the SVG animation (new trace / speed change)
  const animVersionRef = useRef(0)
  // Timing for true pause/resume of the in-flight dot
  const stepStartRef = useRef(0)
  const remainingRef = useRef(0)

  // ── Live simulation (auto-DHCP + background traffic) ──
  const liveRef = useRef(true)
  const isAnimatingRef = useRef(false)
  const quietRef = useRef(false)              // current flow is background (no panel)
  const onAnimDoneRef = useRef<(() => void) | null>(null)
  const edgesRef = useRef<Edge<PacketEdgeData>[]>([])
  const nodesRef = useRef<Node<NetworkNodeData>[]>([])
  const editingRef = useRef(false)
  const topologyRef = useRef<NetworkTopology | null>(null)
  // keep mutable mirrors of latest state for use inside timers/intervals
  edgesRef.current = edges
  nodesRef.current = nodes
  liveRef.current = liveMode
  editingRef.current = !!(selectedNodeId || selectedEdgeId)
  topologyRef.current = topology
  // Keep the live animation base in sync with the selected Fast/Normal/Slow
  // button, so the speed it actually runs at always matches what's highlighted.
  animSpeedRef.current = animSpeed

  // The <svg> that React Flow renders edges into — used to pause/resume SMIL dots
  const getEdgesSvg = useCallback((): SVGSVGElement | null => {
    const el = reactFlowWrapper.current?.querySelector('.react-flow__edges')
    if (!el) return null
    return (el instanceof SVGSVGElement ? el : el.closest('svg')) as SVGSVGElement | null
  }, [])

  // ── Packet analyzer (Wireshark-style): freeze + capture ────────────────────
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [frozen, setFrozen] = useState(false)
  const [capturedPackets, setCapturedPackets] = useState<PacketInfo[]>([])
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null)
  const frozenRef = useRef(false)
  frozenRef.current = frozen

  // ── rAF packet-flight engine ───────────────────────────────────────────────
  // Live/DHCP packets are real particles advanced every animation frame, so they
  // visibly speed up / slow down the instant the speed or a link's latency
  // changes — and stick to the wire while panning/zooming.
  const flightsRef = useRef<Flight[]>([])
  const [flightVersion, bumpFlights] = useReducer((x: number) => (x + 1) & 0xffff, 0)
  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef(0)

  // Point (in flow coordinates) a fraction `t` along an edge's hidden motion path.
  const samplePoint = (edgeId: string, reversed: boolean, t: number): { x: number; y: number } | null => {
    const el = document.getElementById(`${edgeId}-${reversed ? 'mr' : 'mf'}`) as SVGPathElement | null
    if (!el || typeof el.getTotalLength !== 'function') return null
    const len = el.getTotalLength()
    if (!len) return null
    const pt = el.getPointAtLength(Math.min(1, Math.max(0, t)) * len)
    return { x: pt.x, y: pt.y }
  }

  const runFrame = useCallback(() => {
    const now = performance.now()
    const dt = lastFrameRef.current ? Math.min(64, now - lastFrameRef.current) : 16
    lastFrameRef.current = now
    const flights = flightsRef.current
    const frozen = frozenRef.current
    const nodeOn = (nid: string) => { const n = nodesRef.current.find(x => x.id === nid); return !!n && (n.data as NetworkNodeData).config.powered !== false }
    let structural = false

    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]
      let edge = edgesRef.current.find(e => e.id === f.edgePath[f.hop])
      // Drop instantly if the link is gone/down or an endpoint powered off.
      if (!edge || (edge.data?.linkStatus ?? 'up') === 'down' || !nodeOn(edge.source) || !nodeOn(edge.target)) {
        flights.splice(i, 1); structural = true; f.onAbort?.(); continue
      }
      if (!frozen) {
        // Duration is recomputed every frame, so speed/latency changes retime the
        // packet in place — no remount, no jump.
        const dur = hopDuration(animSpeedRef.current, edge.data?.latencyMs as number | undefined, edge.data?.bandwidth as string | undefined)
        f.progress += dt / Math.max(16, dur)
        if (f.progress >= 1) {
          f.hop++; f.progress -= 1
          if (f.hop >= f.edgePath.length) { flights.splice(i, 1); structural = true; f.onDone?.(); continue }
          edge = edgesRef.current.find(e => e.id === f.edgePath[f.hop])
          if (!edge || (edge.data?.linkStatus ?? 'up') === 'down' || !nodeOn(edge.source) || !nodeOn(edge.target)) {
            flights.splice(i, 1); structural = true; f.onAbort?.(); continue
          }
        }
      }
      if (f.el && edge) {
        const reversed = edge.source !== f.path[f.hop]
        const p = samplePoint(edge.id, reversed, f.progress)
        if (p) f.el.style.transform = `translate(${p.x}px, ${p.y}px)`
      }
    }

    if (structural) bumpFlights()
    if (flightsRef.current.length > 0) rafRef.current = requestAnimationFrame(runFrame)
    else { rafRef.current = null; lastFrameRef.current = 0 }
  }, [])
  const ensureRaf = useCallback(() => {
    if (rafRef.current == null) { lastFrameRef.current = 0; rafRef.current = requestAnimationFrame(runFrame) }
  }, [runFrame])

  const applyFreeze = useCallback((next: boolean) => {
    setFrozen(next)
    frozenRef.current = next
    // A flag the trace dot's SMIL renderer reads so it doesn't restart on resume.
    ;(window as unknown as { __netvizFrozen?: boolean }).__netvizFrozen = next
    // Freeze the single SMIL trace dot too (live dots are held by the rAF engine).
    reactFlowWrapper.current?.querySelectorAll('svg').forEach(svg => {
      try { if (next) (svg as SVGSVGElement).pauseAnimations(); else (svg as SVGSVGElement).unpauseAnimations() } catch { /* ignore */ }
    })
    if (!next) ensureRaf()   // resume the flight loop
  }, [ensureRaf])

  // Clicking any moving packet captures + decodes it and stops the world.
  useEffect(() => {
    const onInspect = (e: Event) => {
      const pkt = (e as CustomEvent<PacketInfo>).detail
      if (!pkt) return
      setCapturedPackets(prev => prev.some(p => p.id === pkt.id) ? prev : [...prev.slice(-79), pkt])
      setSelectedCaptureId(pkt.id)
      setInspectorOpen(true)
      if (!frozenRef.current) applyFreeze(true)
    }
    window.addEventListener('netviz:inspectPacket', onInspect)
    return () => window.removeEventListener('netviz:inspectPacket', onInspect)
  }, [applyFreeze])

  // ── Make the whole network react INSTANTLY to any change ───────────────────
  // A signature of only the structural/config state (NOT the constantly-churning
  // pulse animation) — so this fires the moment a device is powered, a link goes
  // up/down, an IP/service/DHCP/DNS/firewall rule changes, or a node/edge is
  // added or removed, but never on ambient-traffic churn.
  const topoSignature = useMemo(() => JSON.stringify({
    n: nodes.map(n => {
      const d = n.data as NetworkNodeData
      const c = d.config
      return [n.id, d.type, c.powered, c.interfaces?.[0]?.ipAddress ?? '', c.interfaces?.[0]?.vlan ?? '',
        c.dhcp?.enabled ?? false, c.dhcp?.poolStart ?? '', c.dhcp?.gateway ?? '',
        c.dns?.enabled ?? false, c.dns?.records?.length ?? 0,
        c.services?.length ?? 0, c.firewallRules?.length ?? 0, c.routingTable?.length ?? 0]
    }),
    e: edges.map(e => [e.id, e.source, e.target, e.data?.linkStatus ?? 'up']),
  }), [nodes, edges])

  useEffect(() => {
    // Re-evaluate addressing + traffic right now instead of waiting for the next
    // clock tick — the network responds the instant something changes. (Packets
    // on links that just died are dropped by the rAF engine on the next frame.)
    if (!frozenRef.current) runSimTickRef.current()
  }, [topoSignature])

  // Load topology on mount — prefer an autosaved working copy, else the sample
  useEffect(() => {
    networkApi.getDefault().then(({ data }) => {
      setTopology(data)
      let restored = false
      try {
        const saved = localStorage.getItem(AUTOSAVE_KEY)
        if (saved) {
          const t = JSON.parse(saved) as { nodes?: NetNode[]; edges?: NetEdge[] }
          if (t.nodes?.length) {
            setNodes(t.nodes.map(toFlowNode))
            setEdges((t.edges ?? []).map(toFlowEdge))
            restored = true
            setStatus('Restored your autosaved network')
            setTimeout(() => setStatus(''), 2500)
          }
        }
      } catch { /* ignore corrupt autosave */ }
      if (!restored) {
        setNodes(data.nodes.map(toFlowNode))
        setEdges(data.edges.map(toFlowEdge))
      }
    }).catch(() => setStatus('Failed to load topology'))
  }, [setNodes, setEdges])

  // Open the tutorial automatically on the very first visit
  useEffect(() => {
    try {
      if (!localStorage.getItem(TUTORIAL_SEEN_KEY)) setShowTutorial(true)
    } catch { /* localStorage unavailable */ }
  }, [])

  // ── Undo / Redo / Autosave (structural topology only — ignores live state) ──
  const historyRef = useRef<{ past: TopoSnapshot[]; future: TopoSnapshot[] }>({ past: [], future: [] })

  // Sanitised snapshot of the editable topology (no pulses/highlights/anim state)
  const serializeTopology = useCallback((): TopoSnapshot => ({
    nodes: nodesRef.current.map(n => {
      const d = n.data as NetworkNodeData
      return { id: n.id, type: d.type, label: d.label, position: { ...n.position }, config: d.config }
    }),
    edges: edgesRef.current.map(toNetEdge),
  }), [])

  const applyTopology = useCallback((snap: TopoSnapshot) => {
    setSelectedNodeId(null); setSelectedEdgeId(null)
    setNodes(snap.nodes.map(toFlowNode))
    setEdges(snap.edges.map(toFlowEdge))
  }, [setNodes, setEdges])

  // Capture the CURRENT state before a user-initiated structural change
  const pushHistory = useCallback(() => {
    const h = historyRef.current
    h.past.push(serializeTopology())
    if (h.past.length > 60) h.past.shift()
    h.future = []
    setHistTick(t => t + 1)
  }, [serializeTopology])

  const undo = useCallback(() => {
    const h = historyRef.current
    if (!h.past.length) return
    h.future.push(serializeTopology())
    applyTopology(h.past.pop()!)
    setHistTick(t => t + 1)
    setStatus('Undo')
  }, [serializeTopology, applyTopology])

  const redo = useCallback(() => {
    const h = historyRef.current
    if (!h.future.length) return
    h.past.push(serializeTopology())
    applyTopology(h.future.pop()!)
    setHistTick(t => t + 1)
    setStatus('Redo')
  }, [serializeTopology, applyTopology])

  // Keyboard: Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl+Y = redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  // Autosave the working topology every few seconds (sanitised, no live churn)
  useEffect(() => {
    const iv = setInterval(() => {
      try {
        if (nodesRef.current.length) localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeTopology()))
      } catch { /* quota / unavailable */ }
    }, 4000)
    return () => clearInterval(iv)
  }, [serializeTopology])

  // ── Animation engine (recursive setTimeout for variable speed) ─────────────
  const runStep = useCallback(() => {
    if (isPausedRef.current) return
    const result = traceResultRef.current
    if (!result) return

    const step = stepRef.current + 1
    stepRef.current = step
    setTraceStep(step)

    const reversed = edgeReversedRef.current
    const animDuration = animSpeedRef.current
    const animVersion = animVersionRef.current
    setEdges(prev => prev.map(e => ({
      ...e,
      data: {
        ...e.data,
        packetState: getEdgeState(e.id, result, step),
        packetReversed: reversed.has(e.id),
        animDuration,
        animVersion,
      },
    })))
    setNodes(prev => prev.map(n => ({
      ...n,
      data: { ...n.data, highlight: getNodeHighlight(n.id, result, step) },
    })))

    if (step < result.hops.length) {
      stepStartRef.current = performance.now()
      remainingRef.current = animSpeedRef.current
      timerRef.current = setTimeout(runStep, animSpeedRef.current)
    } else {
      isAnimatingRef.current = false
      if (!quietRef.current) setIsAnimating(false)
      const done = onAnimDoneRef.current
      onAnimDoneRef.current = null
      done?.()
    }
  }, [setEdges, setNodes])

  const startAnimation = useCallback((result: TraceResult, currentEdges: Edge<PacketEdgeData>[]) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    getEdgesSvg()?.unpauseAnimations()
    traceResultRef.current = result
    stepRef.current = 0
    animVersionRef.current++   // fresh remount for this trace
    setTraceStep(0)
    isAnimatingRef.current = true
    if (!quietRef.current) setIsAnimating(true)
    setIsPaused(false)
    isPausedRef.current = false

    // Determine which path edges are traversed in reverse (target→source)
    const reversed = new Set<string>()
    result.edgePath.forEach((edgeId, idx) => {
      const flowEdge = currentEdges.find(e => e.id === edgeId)
      // path[idx] is the node the packet LEAVES from; if that's the edge's target, it's reversed
      if (flowEdge && flowEdge.source !== result.path[idx]) {
        reversed.add(edgeId)
      }
    })
    edgeReversedRef.current = reversed

    // Apply step 0: source node active, rest of path dimmed
    const initialDur = animSpeedRef.current
    const initialVer = animVersionRef.current
    setEdges(prev => prev.map(e => ({
      ...e,
      data: {
        ...e.data,
        packetState: getEdgeState(e.id, result, 0),
        packetReversed: reversed.has(e.id),
        animDuration: initialDur,
        animVersion: initialVer,
      },
    })))
    setNodes(prev => prev.map(n => ({
      ...n,
      data: { ...n.data, highlight: getNodeHighlight(n.id, result, 0) },
    })))

    stepStartRef.current = performance.now()
    remainingRef.current = animSpeedRef.current
    timerRef.current = setTimeout(runStep, animSpeedRef.current)
  }, [setEdges, setNodes, runStep, getEdgesSvg])

  const clearTrace = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    getEdgesSvg()?.unpauseAnimations()
    traceResultRef.current = null
    onAnimDoneRef.current = null
    quietRef.current = false
    isAnimatingRef.current = false
    setTraceResult(null)
    setTraceStep(-1)
    setIsAnimating(false)
    setIsPaused(false)
    isPausedRef.current = false
    // Clear animation state on the *current* edges (don't restore a stale snapshot)
    setEdges(prev => prev.map(e => ({ ...e, data: { ...e.data, packetState: 'idle' as PacketEdgeState, packetReversed: false } })))
    setNodes(prev => prev.map(n => ({ ...n, data: { ...n.data, highlight: 'none' as NodeHighlight } })))
  }, [setEdges, setNodes, getEdgesSvg])

  // Re-apply the current step's edge data, optionally bumping the anim version
  const reapplyCurrentStep = useCallback((bumpVersion: boolean) => {
    const result = traceResultRef.current
    if (!result) return
    if (bumpVersion) animVersionRef.current++
    const step = stepRef.current
    const reversed = edgeReversedRef.current
    const animDuration = animSpeedRef.current
    const animVersion = animVersionRef.current
    setEdges(prev => prev.map(e => ({
      ...e,
      data: {
        ...e.data,
        packetState: getEdgeState(e.id, result, step),
        packetReversed: reversed.has(e.id),
        animDuration,
        animVersion,
      },
    })))
  }, [setEdges])

  const handleSpeedChange = useCallback((ms: number) => {
    animSpeedRef.current = ms
    setAnimSpeed(ms)
    // Live traffic retimes itself in place — the rAF engine reads animSpeedRef
    // every frame, so all in-flight dots smoothly change pace immediately.
    // If actively playing, restart the current trace hop at the new speed.
    if (isAnimating && !isPausedRef.current) {
      if (timerRef.current) clearTimeout(timerRef.current)
      reapplyCurrentStep(true)
      stepStartRef.current = performance.now()
      remainingRef.current = ms
      timerRef.current = setTimeout(runStep, ms)
    }
  }, [isAnimating, runStep, reapplyCurrentStep])

  const handlePauseToggle = useCallback(() => {
    if (isPausedRef.current) {
      // ── Resume: continue the frozen dot from exactly where it stopped ──
      isPausedRef.current = false
      setIsPaused(false)
      getEdgesSvg()?.unpauseAnimations()
      // Schedule the next step for the remaining slice of this hop
      stepStartRef.current = performance.now() - (animSpeedRef.current - remainingRef.current)
      timerRef.current = setTimeout(runStep, Math.max(0, remainingRef.current))
    } else {
      // ── Pause: freeze the dot in place and remember the time left ──
      isPausedRef.current = true
      setIsPaused(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      const elapsed = performance.now() - stepStartRef.current
      remainingRef.current = Math.max(0, animSpeedRef.current - elapsed)
      getEdgesSvg()?.pauseAnimations()
    }
  }, [runStep, getEdgesSvg])

  const handleTraceResult = useCallback((result: TraceResult) => {
    // A user-initiated trace interrupts any background flow and shows the panel
    onAnimDoneRef.current = null
    quietRef.current = false
    setSelectedNodeId(null)
    setTraceResult(result)
    startAnimation(result, edgesRef.current)
  }, [startAnimation])

  // Launch one packet as an rAF flight along a path; the engine advances it,
  // retimes it live, drops it if a hop fails, and calls onDone / onAbort.
  // (Signature unchanged so every existing call site keeps working.)
  const spawnAgent = useCallback((
    path: string[], edgePath: string[], color: string, label?: string,
    packet?: PacketInfo, onDone?: () => void, onAbort?: () => void,
  ) => {
    if (edgePath.length === 0) { onDone?.(); return }
    flightsRef.current.push({
      id: `fl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      path, edgePath, hop: 0, progress: 0, color, label, packet, onDone, onAbort, el: null,
    })
    bumpFlights()
    ensureRaf()
  }, [ensureRaf])

  // ── Concurrent DHCP (DORA) for a single host ───────────────────────────────
  const dhcpInProgressRef = useRef<Set<string>>(new Set())
  const reservedIpsRef = useRef<Set<number>>(new Set())

  const startDhcpForHost = useCallback((hostId: string) => {
    if (dhcpInProgressRef.current.has(hostId)) return
    const flowNodes = nodesRef.current
    const data = (n: Node<NetworkNodeData>) => n.data as NetworkNodeData
    const host = flowNodes.find(n => n.id === hostId)
    if (!host) return
    const hd = data(host)
    if (hd.config.powered === false || hd.config.interfaces?.[0]?.ipAddress || !isDhcpClient(hd.type)) return

    // Only traverse links whose BOTH ends are powered on and which are up —
    // a packet can't pass through a switch (or any device) that is off.
    const poweredIds = new Set(flowNodes.filter(n => data(n).config.powered !== false).map(n => n.id))
    const simpleEdges = edgesRef.current
      .filter(e => poweredIds.has(e.source) && poweredIds.has(e.target) && (e.data?.linkStatus ?? 'up') !== 'down')
      .map(e => ({ id: e.id, source: e.source, target: e.target }))
    const reach = reachableFrom(hostId, simpleEdges)
    const dhcpNode = flowNodes.find(n => reach.has(n.id) && data(n).type === 'dhcp'
      && data(n).config.dhcp?.enabled && data(n).config.powered !== false)
    if (!dhcpNode) return

    const cfg = data(dhcpNode).config.dhcp!
    const mask = cfg.subnetMask || '255.255.255.0'
    const cidr = `/${maskToCidr(mask)}`
    const gw = cfg.gateway || '192.168.1.1'
    const dns = cfg.dnsServers || '8.8.8.8'
    // Reserve a free address so concurrent hosts never grab the same one
    const used = new Set<number>(reservedIpsRef.current)
    flowNodes.forEach(n => { const ip = data(n).config.interfaces?.[0]?.ipAddress; if (ip) used.add(ipToInt(ip)) })
    let ipInt = ipToInt(cfg.poolStart || '192.168.1.100')
    const end = ipToInt(cfg.poolEnd || '192.168.1.200')
    while (used.has(ipInt) && ipInt <= end) ipInt++
    if (ipInt > end) { setStatus('DHCP pool exhausted'); return }
    const assignedIp = intToIp(ipInt)
    reservedIpsRef.current.add(ipInt)
    dhcpInProgressRef.current.add(hostId)

    const dhcpId = dhcpNode.id
    const hostName = hd.config.hostname ?? hd.label
    const fwd = findPath(hostId, dhcpId, simpleEdges)

    // Free the in-progress flag and the reserved address (idempotent). Called
    // both on success and on abort, so an interrupted DORA simply retries later.
    const release = () => {
      dhcpInProgressRef.current.delete(hostId)
      reservedIpsRef.current.delete(ipInt)
    }
    const onAbort = () => { release(); setStatus(`${hostName}: DHCP failed (link/device down) — will retry`) }

    const applyLease = () => {
      setNodes(prev => prev.map(n => {
        const d = n.data as NetworkNodeData
        if (n.id === hostId) return { ...n, data: { ...d, config: assignIface(d.config, assignedIp, mask, cidr, `DHCP lease — GW ${gw}, DNS ${dns}`) } }
        if (d.type === 'router' && reach.has(n.id) && !d.config.interfaces?.[0]?.ipAddress) return { ...n, data: { ...d, config: assignIface(d.config, gw, mask, cidr, 'Default gateway') } }
        if (n.id === dhcpId && !d.config.interfaces?.[0]?.ipAddress) return { ...n, data: { ...d, config: assignIface(d.config, setLastOctet(gw, 2), mask, cidr, 'DHCP server (static)') } }
        return n
      }))
      release()
      setStatus(`✓ ${hostName} obtained ${assignedIp} via DHCP`)
    }

    if (!fwd) { applyLease(); return }
    const back = { path: [...fwd.path].reverse(), edgePath: [...fwd.edgePath].reverse() }
    setStatus(`${hostName}: DHCP Discover →`)
    // Decoded DHCP packets for the analyzer (client uses 0.0.0.0 → broadcast).
    const dhcpSrvIp = data(dhcpNode).config.interfaces?.[0]?.ipAddress || setLastOctet(gw, 2)
    const dpkt = (mt: string, phase: 'request' | 'reply'): PacketInfo => phase === 'request'
      ? buildPacket(hostName, '0.0.0.0', hostId, 'DHCP Server', '255.255.255.255', dhcpId, 'DHCP', { phase, dhcp: mt })
      : buildPacket('DHCP Server', dhcpSrvIp, dhcpId, hostName, assignedIp, hostId, 'DHCP', { phase, dhcp: mt })
    // Realistic DORA: Discover/Request (client→server), then Offer/ACK (server→client).
    // Any leg can abort (link/device down) → release() so the host retries.
    spawnAgent(fwd.path, fwd.edgePath, '#2dd4bf', 'DHCP Discover', dpkt('Discover', 'request'), () => {
      spawnAgent(back.path, back.edgePath, '#2dd4bf', 'DHCP Offer', dpkt('Offer', 'reply'), () => {
        spawnAgent(fwd.path, fwd.edgePath, '#2dd4bf', 'DHCP Request', dpkt('Request', 'request'), () => {
          spawnAgent(back.path, back.edgePath, '#3fb950', 'DHCP ACK', dpkt('ACK', 'reply'), applyLease, onAbort)
        }, onAbort)
      }, onAbort)
    }, onAbort)
  }, [spawnAgent, setNodes])

  // Power button (node or properties panel) toggles a device; powering a host
  // on makes it immediately broadcast its own DHCP Discover (in parallel).
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail?.id
      if (!id) return
      const node = nodesRef.current.find(n => n.id === id)
      if (!node) return
      const d = node.data as NetworkNodeData
      const newPowered = !(d.config.powered !== false)
      const nextConfig = { ...d.config, powered: newPowered }
      setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...(n.data as NetworkNodeData), config: nextConfig } } : n))
      const tp = topologyRef.current
      if (tp) networkApi.updateNode(tp.id, id, { config: nextConfig }).catch(() => {})
      setStatus(`${d.config.hostname ?? d.label} powered ${newPowered ? 'on' : 'off'}`)
      if (newPowered) {
        window.setTimeout(() => startDhcpForHost(id), 400)
      } else {
        // Powering off resets any trace highlight on its links; the rAF engine
        // drops the in-flight packets touching this node on the next frame.
        setEdges(prev => prev.map(e => (e.source === id || e.target === id)
          ? { ...e, data: { ...e.data, packetState: 'idle' as PacketEdgeState } }
          : e))
      }
    }
    window.addEventListener('netviz:togglePower', handler)
    return () => window.removeEventListener('netviz:togglePower', handler)
  }, [startDhcpForHost, setNodes, setEdges])

  // Live simulation clock: keep every powered host addressed (concurrently) and
  // generate ambient traffic between hosts and services.
  const runSimTickRef = useRef<() => void>(() => {})
  runSimTickRef.current = () => {
    if (frozenRef.current) return   // analyzer froze the world — emit nothing new
    const flowNodes = nodesRef.current
    const data = (n: Node<NetworkNodeData>) => n.data as NetworkNodeData
    const isOn = (n: Node<NetworkNodeData>) => data(n).config.powered !== false
    const ipOf = (n: Node<NetworkNodeData>) => data(n).config.interfaces?.[0]?.ipAddress ?? ''
    const nameOf = (n: Node<NetworkNodeData>) => data(n).config.hostname ?? data(n).label
    const fqdn = (n: Node<NetworkNodeData>) => `${nameOf(n).toLowerCase().replace(/\s+/g, '-')}.lan`
    const pkt = (s: Node<NetworkNodeData>, d: Node<NetworkNodeData>, app: AppProto, opts?: Parameters<typeof buildPacket>[7]) =>
      buildPacket(nameOf(s), ipOf(s), s.id, nameOf(d), ipOf(d), d.id, app, opts)
    if (flowNodes.length < 2) return
    // Graph of only powered-on, up links (off devices block traffic)
    const poweredIds = new Set(flowNodes.filter(isOn).map(n => n.id))
    const simpleEdges = edgesRef.current
      .filter(e => poweredIds.has(e.source) && poweredIds.has(e.target) && (e.data?.linkStatus ?? 'up') !== 'down')
      .map(e => ({ id: e.id, source: e.source, target: e.target }))
    if (simpleEdges.length === 0) return

    // 1) Address ALL powered hosts that still need an IP — in parallel
    flowNodes
      .filter(n => isOn(n) && isDhcpClient(data(n).type) && !data(n).config.interfaces?.[0]?.ipAddress)
      .forEach(n => startDhcpForHost(n.id))

    // 2) Ambient traffic while Live is on — only from hosts that actually hold
    //    an IP (a device without an address can't make application requests).
    if (!liveRef.current || editingRef.current) return
    const hasIp = (n: Node<NetworkNodeData>) => !!data(n).config.interfaces?.[0]?.ipAddress

    // Only real clients initiate ambient sessions. Printers, servers and
    // infrastructure are destinations — a printer never "browses".
    const clients = flowNodes.filter(n => isOn(n) && hasIp(n) && ['pc', 'phone', 'laptop', 'iot'].includes(data(n).type))
    if (clients.length === 0) return
    const dnsServer = flowNodes.find(n => isOn(n) && hasIp(n) && data(n).type === 'dns')
    const databases = flowNodes.filter(n => isOn(n) && hasIp(n) && data(n).type === 'database')

    // What each server role actually speaks, so the label matches the device:
    // a printer gets IPP, a file server SMB, a mail server IMAP — not HTTP.
    const SERVICE: Record<string, { label: string; color: string; usesDns: boolean; appTier?: boolean }> = {
      www:           { label: 'HTTPS', color: '#38bdf8', usesDns: true, appTier: true },
      server:        { label: 'HTTPS', color: '#3fb950', usesDns: true, appTier: true },
      proxy:         { label: 'HTTPS', color: '#bc8cff', usesDns: true, appTier: true },
      api_gateway:   { label: 'HTTPS', color: '#c297ff', usesDns: true, appTier: true },
      load_balancer: { label: 'HTTPS', color: '#d2a8ff', usesDns: true, appTier: true },
      mailserver:    { label: 'IMAP',  color: '#e3b341', usesDns: false },
      fileserver:    { label: 'SMB',   color: '#56d4dd', usesDns: false },
      nas:           { label: 'SMB',   color: '#56d4dd', usesDns: false },
      storage:       { label: 'SMB',   color: '#56d4dd', usesDns: false },
      printer:       { label: 'IPP',   color: '#f0a35e', usesDns: false },
    }

    // Cap concurrent dots so large topologies don't drown in re-renders
    if (flightsRef.current.length > 30) return   // cap concurrent dots

    const back = (q: { path: string[]; edgePath: string[] }) => ({ path: [...q.path].reverse(), edgePath: [...q.edgePath].reverse() })
    const SQL_STMTS = ['SELECT * FROM users WHERE id = ?', 'SELECT token FROM sessions WHERE sid = ?', 'UPDATE carts SET qty = ? WHERE id = ?', 'INSERT INTO events (type, ts) VALUES (?, ?)', 'SELECT name, price FROM products LIMIT 20']

    const burst = 1 + Math.floor(Math.random() * 2)   // 1–2 concurrent sessions
    for (let k = 0; k < burst; k++) {
      const src = clients[Math.floor(Math.random() * clients.length)]
      const srcType = data(src).type

      // Role-appropriate destination. IoT only sends telemetry to gateways/cloud.
      let candidates = flowNodes.filter(n => isOn(n) && hasIp(n) && n.id !== src.id && SERVICE[data(n).type])
      if (srcType === 'iot') candidates = candidates.filter(n => ['api_gateway', 'www', 'server'].includes(data(n).type))
      if (candidates.length === 0) continue
      const dst = candidates[Math.floor(Math.random() * candidates.length)]
      const svc = SERVICE[data(dst).type]
      if (!svc) continue
      const label = srcType === 'iot' ? 'MQTT' : svc.label
      const color = srcType === 'iot' ? '#7ee787' : svc.color

      const p = findPath(src.id, dst.id, simpleEdges)
      if (!p) continue
      const appProto = appFromLabel(label)

      // Backend tier: an app/web server queries a database after the request.
      const maybeBackend = () => {
        if (!svc.appTier || databases.length === 0 || Math.random() > 0.6) return
        const db = databases[Math.floor(Math.random() * databases.length)]
        if (db.id === dst.id) return
        const q = findPath(dst.id, db.id, simpleEdges)
        if (!q) return
        const stmt = SQL_STMTS[Math.floor(Math.random() * SQL_STMTS.length)]
        spawnAgent(q.path, q.edgePath, '#f778ba', 'SQL', pkt(dst, db, 'SQL', { phase: 'request', sql: stmt }),
          () => spawnAgent(back(q).path, back(q).edgePath, '#f778ba', 'SQL ◂', pkt(db, dst, 'SQL', { phase: 'reply', sql: `OK ${1 + Math.floor(Math.random() * 40)} rows` })))
      }

      // The application request/response itself.
      const sendApp = () => {
        spawnAgent(p.path, p.edgePath, color, label, pkt(src, dst, appProto, { phase: 'request' }), () => {
          const rb = back(p)
          spawnAgent(rb.path, rb.edgePath, color, `${label} ◂`, pkt(dst, src, appProto, { phase: 'reply' }), maybeBackend)
        })
      }

      // Realistic TCP setup: SYN → SYN/ACK → ACK before the app exchange.
      const ctl = (s: Node<NetworkNodeData>, d: Node<NetworkNodeData>, flags: 'SYN' | 'SYN, ACK' | 'ACK') =>
        buildTcp(nameOf(s), ipOf(s), s.id, nameOf(d), ipOf(d), d.id, flags, appProto)
      const doApp = () => {
        if (Math.random() < 0.65) {
          const rb = back(p)
          spawnAgent(p.path, p.edgePath, '#8b949e', 'SYN', ctl(src, dst, 'SYN'), () =>
            spawnAgent(rb.path, rb.edgePath, '#8b949e', 'SYN, ACK', ctl(dst, src, 'SYN, ACK'), () =>
              spawnAgent(p.path, p.edgePath, '#8b949e', 'ACK', ctl(src, dst, 'ACK'), sendApp)))
        } else sendApp()
      }

      // ARP resolves the next hop's MAC on the local segment before first contact.
      const startSession = () => {
        const nbId = p.path[1]
        const nb = nbId ? flowNodes.find(n => n.id === nbId) : undefined
        if (nb && Math.random() < 0.25) {
          const seg = [src.id, nb.id], segE = [p.edgePath[0]]
          spawnAgent(seg, segE, '#f0883e', 'ARP', buildArp(nameOf(src), ipOf(src), src.id, nameOf(nb), ipOf(nb), nb.id, true), () =>
            spawnAgent([nb.id, src.id], segE, '#f0883e', 'ARP ◂', buildArp(nameOf(nb), ipOf(nb), nb.id, nameOf(src), ipOf(src), src.id, false), doApp))
        } else doApp()
      }

      // DNS name resolution precedes web/app connections only (file/print/mail
      // to a known local server don't trigger a fresh lookup every time).
      if (svc.usesDns && dnsServer && dnsServer.id !== dst.id && Math.random() < 0.6) {
        const dq = findPath(src.id, dnsServer.id, simpleEdges)
        if (dq) {
          spawnAgent(dq.path, dq.edgePath, '#a371f7', 'DNS query', pkt(src, dnsServer, 'DNS', { phase: 'request', query: fqdn(dst), answer: ipOf(dst) }), () => {
            spawnAgent(back(dq).path, back(dq).edgePath, '#a371f7', 'DNS reply', pkt(dnsServer!, src, 'DNS', { phase: 'reply', query: fqdn(dst), answer: ipOf(dst) }), startSession)
          })
          continue
        }
      }
      startSession()
    }
  }

  useEffect(() => {
    const iv = setInterval(() => runSimTickRef.current(), 1200)
    return () => clearInterval(iv)
  }, [])

  // ── Node/edge management ────────────────────────────────────────────────────
  const onConnect = useCallback((connection: Connection) => {
    pushHistory()
    const newEdge: Edge<PacketEdgeData> = {
      ...connection,
      id: `e-${Date.now()}`,
      type: 'packet',
      data: { packetState: 'idle', linkStatus: 'up' },
    }
    setEdges(eds => addEdge(newEdge, eds))
    // Select the fresh link so the user can name it right away
    setSelectedNodeId(null)
    setSelectedEdgeId(newEdge.id)
  }, [setEdges, pushHistory])

  const onConnectStart = useCallback((_: unknown, params: OnConnectStartParams) => {
    connectingNodeId.current = params.nodeId
  }, [])

  // Snapshot before a drag so undo restores the previous position
  const onNodeDragStart = useCallback(() => pushHistory(), [pushHistory])

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/reactflow') as NodeType
    if (!type || !reactFlowWrapper.current) return
    pushHistory()
    const rect = reactFlowWrapper.current.getBoundingClientRect()
    const position = { x: event.clientX - rect.left - 60, y: event.clientY - rect.top - 40 }
    const id = `${type}-${++nodeCounter}`
    const label = `${type.charAt(0).toUpperCase() + type.slice(1)}-${nodeCounter}`
    const noIface = type === 'cloud' || type === 'www'
    const config: NetworkNodeConfig = {
      hostname: label,
      description: '',
      interfaces: noIface ? [] : [{ name: 'eth0', ipAddress: '', subnetMask: '255.255.255.0', status: 'up', speed: '1 Gbps' }],
      routingTable: ['router', 'firewall', 'server'].includes(type) ? [] : undefined,
      firewallRules: ['router', 'firewall'].includes(type) ? [] : undefined,
      dhcp: type === 'dhcp'
        ? { enabled: true, poolStart: '192.168.1.100', poolEnd: '192.168.1.200', subnetMask: '255.255.255.0', gateway: '192.168.1.1', dnsServers: '8.8.8.8, 1.1.1.1', leaseHours: 24 }
        : undefined,
      dns: type === 'dns' || type === 'www'
        ? { enabled: true, forwarders: '8.8.8.8, 1.1.1.1', records: [] }
        : undefined,
      services:
        type === 'server' ? [
          { id: `svc-${id}-80`, name: 'HTTP', port: 80, protocol: 'tcp' as const, enabled: true },
          { id: `svc-${id}-22`, name: 'SSH', port: 22, protocol: 'tcp' as const, enabled: true },
        ]
        : type === 'www' ? [
          { id: `svc-${id}-443`, name: 'HTTPS', port: 443, protocol: 'tcp' as const, enabled: true },
        ]
        : type === 'dns' ? [
          { id: `svc-${id}-53`, name: 'DNS', port: 53, protocol: 'udp' as const, enabled: true },
        ]
        : undefined,
      webPage: type === 'server' || type === 'www'
        ? { title: `${label} home page`, body: '<h1>It works!</h1>' }
        : undefined,
      powered: false,   // new devices start powered off — turn on to join the network
    }
    setNodes(nds => [...nds, {
      id, type, position,
      data: { type, label, highlight: 'none', config },
    }])
    setStatus(`Added ${label} — power it on (⏻) to join the network`)
  }, [setNodes])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDragStart = useCallback((event: React.DragEvent, type: NodeType) => {
    event.dataTransfer.setData('application/reactflow', type)
    event.dataTransfer.effectAllowed = 'move'
  }, [])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (traceResult) clearTrace()
    setSelectedEdgeId(null)
    setSelectedNodeId(node.id)
  }, [traceResult, clearTrace])

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    if (traceResult) clearTrace()
    setSelectedNodeId(null)
    setSelectedEdgeId(edge.id)
  }, [traceResult, clearTrace])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }, [])

  // ── Edge (link) editing ──────────────────────────────────────────────────
  // The rAF engine reads each link's latency/bandwidth/status every frame, so a
  // change here retimes packets crossing it instantly (or drops them if it goes
  // down) with no extra bookkeeping.
  const handleEdgeDataChange = useCallback((edgeId: string, partial: Partial<PacketEdgeData>) => {
    setEdges(prev => prev.map(e => e.id === edgeId ? { ...e, data: { ...e.data, ...partial } } : e))
  }, [setEdges])

  const handleDeleteEdge = useCallback((edgeId: string) => {
    pushHistory()
    setEdges(prev => prev.filter(e => e.id !== edgeId))
    setSelectedEdgeId(null)
  }, [setEdges, pushHistory])

  // ── PropertiesPanel onChange ─────────────────────────────────────────────
  const handleNodeConfigChange = useCallback((nodeId: string, config: NetworkNodeConfig) => {
    setNodes(prev => prev.map(n => n.id !== nodeId ? n : {
      ...n,
      data: { ...n.data as NetworkNodeData, config },
    }))
    // Persist to backend if we have a topology
    if (topology) {
      networkApi.updateNode(topology.id, nodeId, { config }).catch(() => {})
    }
  }, [topology, setNodes])

  // ── Connect two private networks: configure a router↔router edge as a WAN
  //    site-link (assign a /30, install cross static routes between the LANs). ──
  const configureWanLink = useCallback((edgeId: string) => {
    const data = (n: Node<NetworkNodeData>) => n.data as NetworkNodeData
    const wanEdge = edgesRef.current.find(e => e.id === edgeId)
    if (!wanEdge) return
    const aNode = nodesRef.current.find(n => n.id === wanEdge.source)
    const bNode = nodesRef.current.find(n => n.id === wanEdge.target)
    if (!aNode || !bNode) return
    const isRouter = (n: Node<NetworkNodeData>) => ['router', 'l3switch'].includes(data(n).type)
    if (!isRouter(aNode) || !isRouter(bNode)) {
      setStatus('WAN link needs a router (or L3 switch) on both ends')
      setTimeout(() => setStatus(''), 2500)
      return
    }

    const priv = (ip?: string) => !!ip && (ip.startsWith('10.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || ip.startsWith('192.168.'))
    const prefixOf = (i?: NetworkInterface) => {
      if (i?.cidr) { const p = parseInt(i.cidr.replace('/', ''), 10); if (!isNaN(p)) return p }
      if (i?.subnetMask) return maskToCidr(i.subnetMask)
      return 24
    }
    const maskInt = (p: number) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0)
    const maskStr = (p: number) => intToIp(maskInt(p))
    const netStr = (ip: string, p: number) => intToIp((ipToInt(ip) & maskInt(p)) >>> 0)

    // Subnets a router serves = private subnets of IP-bearing devices reachable
    // from it WITHOUT crossing the WAN edge.
    const simpleEdges = edgesRef.current.filter(e => e.id !== edgeId).map(e => ({ source: e.source, target: e.target }))
    type Sub = { net: string; mask: string }
    const lanSubnets = (routerId: string): Sub[] => {
      const out = new Map<string, Sub>()
      for (const id of reachableFrom(routerId, simpleEdges)) {
        const n = nodesRef.current.find(x => x.id === id)
        const iface = n && data(n).config.interfaces?.[0]
        const ip = iface?.ipAddress
        if (!priv(ip)) continue
        const prefix = prefixOf(iface || undefined)
        out.set(`${netStr(ip!, prefix)}/${prefix}`, { net: netStr(ip!, prefix), mask: maskStr(prefix) })
      }
      return [...out.values()]
    }
    const aLans = lanSubnets(aNode.id)
    const bLans = lanSubnets(bNode.id)
    if (aLans.length === 0 || bLans.length === 0) {
      setStatus('Power on / address the hosts on both sides first (no subnets found)')
      setTimeout(() => setStatus(''), 3500)
      return
    }

    // Pick a free /30 for the WAN point-to-point link.
    const used = new Set<string>()
    nodesRef.current.forEach(n => data(n).config.interfaces?.forEach(i => i.ipAddress && used.add(i.ipAddress)))
    let base = ipToInt('172.16.255.0')
    for (let k = 0; k < 64; k++) {
      if (!used.has(intToIp(base + 1)) && !used.has(intToIp(base + 2))) break
      base += 4
    }
    const aWan = intToIp(base + 1), bWan = intToIp(base + 2)

    const buildConfig = (node: Node<NetworkNodeData>, selfLans: Sub[], peerLans: Sub[], selfWan: string, peerWan: string): NetworkNodeConfig => {
      const cfg = data(node).config
      const wanIface: NetworkInterface = { name: 'WAN', ipAddress: selfWan, subnetMask: '255.255.255.252', cidr: '/30', status: 'up', description: 'WAN site-link' }
      const interfaces = [...(cfg.interfaces ?? []).filter(i => i.name !== 'WAN'), wanIface]
      const routes: RoutingTableEntry[] = [...(cfg.routingTable ?? [])]
      const add = (r: RoutingTableEntry) => { if (!routes.some(x => x.destination === r.destination && x.mask === r.mask)) routes.push(r) }
      add({ id: crypto.randomUUID(), destination: netStr(selfWan, 30), mask: '255.255.255.252', gateway: '0.0.0.0', interface: 'WAN', metric: 0, type: 'connected' })
      selfLans.forEach(s => add({ id: crypto.randomUUID(), destination: s.net, mask: s.mask, gateway: '0.0.0.0', interface: 'LAN', metric: 0, type: 'connected' }))
      peerLans.forEach(s => add({ id: crypto.randomUUID(), destination: s.net, mask: s.mask, gateway: peerWan, interface: 'WAN', metric: 1, type: 'static' }))
      return { ...cfg, interfaces, routingTable: routes }
    }

    pushHistory()
    handleNodeConfigChange(aNode.id, buildConfig(aNode, aLans, bLans, aWan, bWan))
    handleNodeConfigChange(bNode.id, buildConfig(bNode, bLans, aLans, bWan, aWan))
    handleEdgeDataChange(edgeId, { edgeLabel: 'WAN link', bandwidth: '100 Mbps', latencyMs: 10 })
    setStatus(`WAN link up: ${aLans.length}↔${bLans.length} subnet(s) routed (static routes added)`)
    setTimeout(() => setStatus(''), 3500)
  }, [handleNodeConfigChange, handleEdgeDataChange, pushHistory])

  // ── Save/Delete/Reset ────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!topology) return
    setSaving(true)
    try {
      const updatedNodes = nodes.map(n => {
        const d = n.data as NetworkNodeData
        return { id: n.id, type: d.type, label: d.label, position: n.position, config: d.config }
      })
      const updatedEdges = edges.map(toNetEdge)
      await networkApi.update(topology.id, { nodes: updatedNodes, edges: updatedEdges })
      setStatus('Saved ✓')
      setTimeout(() => setStatus(''), 2000)
    } catch { setStatus('Save failed') }
    finally { setSaving(false) }
  }, [topology, nodes, edges])

  const handleDeleteSelected = useCallback(() => {
    if (!selectedNodeId) return
    pushHistory()
    setNodes(nds => nds.filter(n => n.id !== selectedNodeId))
    setEdges(prev => prev.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId))
    setSelectedNodeId(null)
  }, [selectedNodeId, setNodes, setEdges, pushHistory])

  const handleReset = useCallback(() => {
    pushHistory()
    try { localStorage.removeItem(AUTOSAVE_KEY) } catch { /* ignore */ }
    networkApi.getDefault().then(({ data }) => {
      setTopology(data)
      setNodes(data.nodes.map(toFlowNode))
      setEdges(data.edges.map(toFlowEdge))
      clearTrace()
    }).catch(() => {})
  }, [setNodes, setEdges, clearTrace, pushHistory])

  // Blank slate for the guided build exercise
  const handleClearCanvas = useCallback(() => {
    pushHistory()
    clearTrace()
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setNodes([])
    setEdges([])
    setStatus('Canvas cleared — build away!')
  }, [setNodes, setEdges, clearTrace, pushHistory])

  const handleStartBuild = useCallback(() => {
    setShowTutorial(false)
    setGuidedActive(true)
  }, [])

  // Compute net nodes for PacketSender and PropertiesPanel
  const allNetNodes = nodes.map(n => {
    const d = n.data as NetworkNodeData
    return { id: n.id, type: d.type, label: d.label, position: n.position, config: d.config }
  })

  const selectedNode = selectedNodeId
    ? (allNetNodes.find(n => n.id === selectedNodeId) ?? null)
    : null

  const selectedEdge = selectedEdgeId
    ? (edges.find(e => e.id === selectedEdgeId) ?? null)
    : null

  const nodeName = useCallback((nid: string) => {
    const n = allNetNodes.find(x => x.id === nid)
    return n?.config.hostname ?? n?.label ?? nid
  }, [allNetNodes])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-900)] border-b border-[var(--border)] shrink-0">
        <span className="text-xs font-semibold text-[var(--text-primary)]">{topology?.name ?? 'Network Builder'}</span>
        <div className="flex-1" />
        {status && <span className="text-[11px] text-[var(--green)] font-mono">{status}</span>}
        <button onClick={() => setShowTutorial(true)} className="btn-ghost" title="Open tutorial">
          <GraduationCap size={12} />Tutorial
        </button>
        <button onClick={handleStartBuild} className="btn-ghost" title="Guided hands-on build" disabled={guidedActive}>
          <Hammer size={12} />Build
        </button>
        <button
          onClick={() => { handleSave(); setShowValidation(v => !v) }}
          className={showValidation ? 'btn-primary' : 'btn-ghost'}
          title="Validate the design (saves first, then runs all checks)"
        >
          <ShieldCheck size={12} />Validate
        </button>
        <button
          onClick={() => { handleSave(); setShowState(v => !v) }}
          className={showState ? 'btn-primary' : 'btn-ghost'}
          title="Show the selected device's live state (ARP, MAC, OSPF, STP, ACL, NAT)"
        >
          <TerminalSquare size={12} />State
        </button>
        <button
          onClick={() => { handleSave(); setShowVersions(v => !v) }}
          className={showVersions ? 'btn-primary' : 'btn-ghost'}
          title="Snapshot history — save and restore versions of this topology"
        >
          <History size={12} />Versions
        </button>
        <button
          onClick={() => setLiveMode(v => !v)}
          className={liveMode ? 'btn-primary' : 'btn-ghost'}
          title="Toggle live background traffic (hosts request DHCP automatically either way)"
        >
          <Activity size={12} />{liveMode ? 'Live ●' : 'Live'}
        </button>
        <button
          onClick={() => setInspectorOpen(v => !v)}
          className={inspectorOpen ? 'btn-primary' : 'btn-ghost'}
          title="Packet analyzer — freeze traffic and click any packet to decode it (Wireshark-style)"
        >
          <Layers size={12} />Analyze
        </button>
        <button onClick={undo} disabled={historyRef.current.past.length === 0} className="btn-ghost" title="Undo (Ctrl+Z)">
          <Undo2 size={12} />
        </button>
        <button onClick={redo} disabled={historyRef.current.future.length === 0} className="btn-ghost" title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={12} />
        </button>
        <div data-tour="toolbar" className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary"><Save size={11} />{saving ? 'Saving…' : 'Save'}</button>
          <button
            onClick={async () => {
              if (!topology?.id) return
              await handleSave()
              const { data } = await networkApi.topologyConfig(topology.id)
              const url = URL.createObjectURL(new Blob([data], { type: 'text/plain' }))
              const a = document.createElement('a')
              a.href = url
              a.download = `${(topology.name ?? 'network').replace(/\s+/g, '-')}.cfg`
              a.click()
              URL.revokeObjectURL(url)
            }}
            className="btn-ghost"
            title="Export every device's running-config"
          >
            <Download size={11} />Export
          </button>
          {selectedNode && <button onClick={handleDeleteSelected} className="btn-danger"><Trash2 size={11} />Delete</button>}
          <button onClick={handleReset} className="btn-ghost"><RefreshCw size={11} />Reset</button>
        </div>
      </div>

      {/* Packet Sender toolbar */}
      <PacketSender
        nodes={allNetNodes}
        topologyId={topology?.id}
        currentEdges={edges}
        onTraceResult={handleTraceResult}
        onClear={clearTrace}
        animSpeed={animSpeed}
        isPaused={isPaused}
        isAnimating={isAnimating}
        onSpeedChange={handleSpeedChange}
        onPauseToggle={handlePauseToggle}
      />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-44 shrink-0"><NodePalette onDragStart={onDragStart} /></div>

        {/* Canvas */}
        <div ref={reactFlowWrapper} data-tour="canvas" className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onNodeDragStart={onNodeDragStart}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{ type: 'packet', data: { packetState: 'idle' } }}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.1}
            maxZoom={3}
          >
            <Background variant={BackgroundVariant.Dots} color="#21262d" gap={20} size={1} />
            <Controls />
            <MiniMap nodeColor={n => meta(n.type ?? '').color} />
            <PacketFlightLayer flights={flightsRef.current} version={flightVersion} />
          </ReactFlow>

          {/* Result overlay — shown when animation finishes */}
          {traceResult && !isAnimating && (
            <ResultOverlay result={traceResult} onClose={clearTrace} />
          )}

          {/* Guided hands-on build exercise (floats over the canvas) */}
          <GuidedBuild
            active={guidedActive}
            nodes={allNetNodes}
            edges={edges.map(e => ({ source: e.source, target: e.target }))}
            onClearCanvas={handleClearCanvas}
            onClose={() => setGuidedActive(false)}
          />

          {/* Design-validation "problems" panel */}
          {showValidation && (
            <ValidationPanel
              topologyId={topology?.id}
              onClose={() => setShowValidation(false)}
              onFocus={(nodeId, edgeId) => {
                if (edgeId) { setSelectedNodeId(null); setSelectedEdgeId(edgeId) }
                else if (nodeId) { setSelectedEdgeId(null); setSelectedNodeId(nodeId) }
              }}
            />
          )}

          {/* Per-device control-plane / operational state */}
          {showState && (
            <DeviceStatePanel
              topologyId={topology?.id}
              nodeId={selectedNodeId}
              onClose={() => setShowState(false)}
            />
          )}

          {/* Snapshot history */}
          {showVersions && (
            <VersionsPanel
              topologyId={topology?.id}
              onClose={() => setShowVersions(false)}
              onRestored={(topo) => {
                setNodes(topo.nodes.map(toFlowNode))
                setEdges(topo.edges.map(toFlowEdge))
                setTopology(topo)
                setSelectedNodeId(null)
                setSelectedEdgeId(null)
                setStatus('Snapshot restored')
                setTimeout(() => setStatus(''), 2000)
              }}
            />
          )}
        </div>

        {/* Right inspector (resizable): packet analyzer > trace > edge > node */}
        {inspectorOpen && (
          <ResizablePanel>
            <PacketInspector
              packets={capturedPackets}
              selectedId={selectedCaptureId}
              frozen={frozen}
              onSelect={setSelectedCaptureId}
              onClear={() => { setCapturedPackets([]); setSelectedCaptureId(null) }}
              onToggleFreeze={() => applyFreeze(!frozen)}
              onClose={() => { setInspectorOpen(false); if (frozenRef.current) applyFreeze(false) }}
            />
          </ResizablePanel>
        )}
        {!inspectorOpen && traceResult && (
          <ResizablePanel>
            <TracePanel result={traceResult} activeStep={traceStep} onClose={clearTrace} />
          </ResizablePanel>
        )}
        {!traceResult && selectedEdge && (
          <ResizablePanel>
            <EdgePropertiesPanel
              edge={selectedEdge}
              sourceName={nodeName(selectedEdge.source)}
              targetName={nodeName(selectedEdge.target)}
              canConfigureWan={
                ['router', 'l3switch'].includes(allNetNodes.find(n => n.id === selectedEdge.source)?.type ?? '') &&
                ['router', 'l3switch'].includes(allNetNodes.find(n => n.id === selectedEdge.target)?.type ?? '')
              }
              onConfigureWanLink={() => configureWanLink(selectedEdge.id)}
              onChange={handleEdgeDataChange}
              onDelete={handleDeleteEdge}
              onClose={() => setSelectedEdgeId(null)}
            />
          </ResizablePanel>
        )}
        {!traceResult && !selectedEdge && selectedNode && (
          <ResizablePanel>
            <PropertiesPanel
              node={selectedNode}
              onClose={() => setSelectedNodeId(null)}
              onChange={handleNodeConfigChange}
            />
          </ResizablePanel>
        )}
      </div>

      <Tutorial open={showTutorial} onClose={() => setShowTutorial(false)} onStartBuild={handleStartBuild} />
    </div>
  )
}
