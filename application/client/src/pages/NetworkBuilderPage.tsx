import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Node, type Edge, type Connection, type OnConnectStartParams,
  BackgroundVariant, ConnectionMode,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Save, RefreshCw, Trash2, CheckCircle, XCircle, AlertTriangle, X, GraduationCap, Hammer, Activity, Undo2, Redo2 } from 'lucide-react'
import type { NetworkTopology, NetworkNode as NetNode, NetworkEdge as NetEdge, NodeType, NetworkNodeConfig, NetworkInterface } from '../types'
import type { TraceResult } from '../lib/api'
import { network as networkApi } from '../lib/api'
import { nodeTypes, type NetworkNodeData, type NodeHighlight } from '../components/NetworkBuilder/CustomNodes'
import { isDhcpClient, meta } from '../components/NetworkBuilder/deviceCatalog'
import { edgeTypes, type PacketEdgeData, type PacketEdgeState, type PulseDot } from '../components/NetworkBuilder/PacketEdge'
import NodePalette from '../components/NetworkBuilder/NodePalette'
import PropertiesPanel from '../components/NetworkBuilder/PropertiesPanel'
import EdgePropertiesPanel from '../components/NetworkBuilder/EdgePropertiesPanel'
import ResizablePanel from '../components/NetworkBuilder/ResizablePanel'
import PacketSender from '../components/NetworkBuilder/PacketSender'
import TracePanel from '../components/NetworkBuilder/TracePanel'
import Tutorial, { TUTORIAL_SEEN_KEY } from '../components/NetworkBuilder/Tutorial'
import GuidedBuild from '../components/NetworkBuilder/GuidedBuild'

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
  const [topology, setTopology] = useState<NetworkTopology | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NetworkNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge<PacketEdgeData>>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [guidedActive, setGuidedActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null)
  const [traceStep, setTraceStep] = useState(-1)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [animSpeed, setAnimSpeed] = useState(700)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const connectingNodeId = useRef<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stepRef = useRef(0)
  const animSpeedRef = useRef(700)
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
  const [liveMode, setLiveMode] = useState(true)
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

  // The <svg> that React Flow renders edges into — used to pause/resume SMIL dots
  const getEdgesSvg = useCallback((): SVGSVGElement | null => {
    const el = reactFlowWrapper.current?.querySelector('.react-flow__edges')
    if (!el) return null
    return (el instanceof SVGSVGElement ? el : el.closest('svg')) as SVGSVGElement | null
  }, [])

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
  const [, setHistTick] = useState(0)

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
    // If actively playing, restart the current hop at the new speed (clean remount)
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

  // ── Concurrent pulse engine ────────────────────────────────────────────────
  // Independent traveling dots that ride edges in parallel. Unlike the single
  // trace engine, many can run at once — so several hosts animate together.
  const addPulse = useCallback((edgeId: string, pulse: PulseDot) => {
    setEdges(prev => prev.map(e => e.id === edgeId
      ? { ...e, data: { ...e.data, pulses: [...((e.data?.pulses as PulseDot[]) ?? []), pulse] } }
      : e))
  }, [setEdges])

  const removePulse = useCallback((edgeId: string, pulseId: string) => {
    setEdges(prev => prev.map(e => e.id === edgeId
      ? { ...e, data: { ...e.data, pulses: ((e.data?.pulses as PulseDot[]) ?? []).filter(p => p.id !== pulseId) } }
      : e))
  }, [setEdges])

  // Animate one packet hop-by-hop along a path; calls onDone at the end, or
  // onAbort if the packet is dropped (link/device went down mid-flight).
  // Per-hop duration follows the current Fast/Normal/Slow speed setting.
  const spawnAgent = useCallback((
    path: string[], edgePath: string[], color: string, label?: string,
    onDone?: () => void, onAbort?: () => void,
  ) => {
    const agentId = `ag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const nodeOn = (nid: string) => {
      const n = nodesRef.current.find(x => x.id === nid)
      return !!n && (n.data as NetworkNodeData).config.powered !== false
    }
    const step = (i: number) => {
      if (i >= edgePath.length) { onDone?.(); return }
      const edgeId = edgePath[i]
      const edge = edgesRef.current.find(e => e.id === edgeId)
      // Drop the packet if the hop is no longer usable: link removed/down, or
      // either endpoint device was powered off mid-flight.
      if (!edge || (edge.data?.linkStatus ?? 'up') === 'down' || !nodeOn(edge.source) || !nodeOn(edge.target)) {
        onAbort?.()
        return
      }
      const edgeDur = animSpeedRef.current   // live speed (changes apply per hop)
      const reversed = edge.source !== path[i]   // travelling target→source?
      const pulseId = `${agentId}-${i}`
      addPulse(edgeId, { id: pulseId, color, reversed, dur: edgeDur, label })
      window.setTimeout(() => { removePulse(edgeId, pulseId); step(i + 1) }, edgeDur)
    }
    step(0)
  }, [addPulse, removePulse])

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
    // Realistic DORA: Discover/Request (client→server), then Offer/ACK (server→client).
    // Any leg can abort (link/device down) → release() so the host retries.
    spawnAgent(fwd.path, fwd.edgePath, '#2dd4bf', 'DHCP Discover', () => {
      spawnAgent(back.path, back.edgePath, '#2dd4bf', 'DHCP Offer', () => {
        spawnAgent(fwd.path, fwd.edgePath, '#2dd4bf', 'DHCP Request', () => {
          spawnAgent(back.path, back.edgePath, '#3fb950', 'DHCP ACK', applyLease, onAbort)
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
        // Powering off immediately drops any packets in flight on its links
        setEdges(prev => prev.map(e => (e.source === id || e.target === id)
          ? { ...e, data: { ...e.data, pulses: [], packetState: 'idle' as PacketEdgeState } }
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
    const flowNodes = nodesRef.current
    const data = (n: Node<NetworkNodeData>) => n.data as NetworkNodeData
    const isOn = (n: Node<NetworkNodeData>) => data(n).config.powered !== false
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
    const hosts = flowNodes.filter(n => isOn(n) && hasIp(n) && ['pc', 'phone', 'printer', 'laptop', 'iot'].includes(data(n).type))
    const targets = flowNodes.filter(n => isOn(n) && hasIp(n) && ['server', 'www', 'dns', 'mailserver', 'fileserver', 'database', 'load_balancer', 'proxy', 'api_gateway'].includes(data(n).type))
    if (hosts.length === 0) return
    const dnsServer = flowNodes.find(n => isOn(n) && hasIp(n) && (data(n).type === 'dns'))

    const APP: Record<string, { label: string; color: string }> = {
      server:        { label: 'HTTPS', color: '#3fb950' },
      www:           { label: 'HTTPS', color: '#38bdf8' },
      proxy:         { label: 'HTTPS', color: '#bc8cff' },
      api_gateway:   { label: 'API',   color: '#c297ff' },
      load_balancer: { label: 'HTTPS', color: '#d2a8ff' },
      mailserver:    { label: 'SMTP',  color: '#e3b341' },
      fileserver:    { label: 'SMB',   color: '#56d4dd' },
      database:      { label: 'SQL',   color: '#f778ba' },
      dns:           { label: 'DNS',   color: '#a371f7' },
    }

    // Cap concurrent dots so large topologies don't drown in re-renders
    const activePulses = edgesRef.current.reduce((s, e) => s + ((e.data?.pulses as PulseDot[] | undefined)?.length ?? 0), 0)
    if (activePulses > 24) return

    const burst = 1 + Math.floor(Math.random() * 3)   // 1–3 concurrent sessions
    for (let k = 0; k < burst; k++) {
      const src = hosts[Math.floor(Math.random() * hosts.length)]
      const pool = targets.filter(t => t.id !== src.id)
      if (pool.length === 0) continue
      const dst = pool[Math.floor(Math.random() * pool.length)]
      const p = findPath(src.id, dst.id, simpleEdges)
      if (!p) continue
      const app = APP[data(dst).type] ?? { label: 'TCP', color: '#58a6ff' }

      // Realistic session: resolve the name via DNS first (if a resolver exists
      // and the target isn't the DNS server itself), then make the app request.
      const doApp = () => {
        spawnAgent(p.path, p.edgePath, app.color, app.label, () => {
          const back = { path: [...p.path].reverse(), edgePath: [...p.edgePath].reverse() }
          spawnAgent(back.path, back.edgePath, app.color, `${app.label} ◂`)
        })
      }
      if (dnsServer && dnsServer.id !== dst.id && Math.random() < 0.6) {
        const dq = findPath(src.id, dnsServer.id, simpleEdges)
        if (dq) {
          spawnAgent(dq.path, dq.edgePath, '#a371f7', 'DNS query', () => {
            const dback = { path: [...dq.path].reverse(), edgePath: [...dq.edgePath].reverse() }
            spawnAgent(dback.path, dback.edgePath, '#a371f7', 'DNS reply', doApp)
          })
          continue
        }
      }
      doApp()
    }
  }

  useEffect(() => {
    const iv = setInterval(() => runSimTickRef.current(), 1600)
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
          onClick={() => setLiveMode(v => !v)}
          className={liveMode ? 'btn-primary' : 'btn-ghost'}
          title="Toggle live background traffic (hosts request DHCP automatically either way)"
        >
          <Activity size={12} />{liveMode ? 'Live ●' : 'Live'}
        </button>
        <button onClick={undo} disabled={historyRef.current.past.length === 0} className="btn-ghost" title="Undo (Ctrl+Z)">
          <Undo2 size={12} />
        </button>
        <button onClick={redo} disabled={historyRef.current.future.length === 0} className="btn-ghost" title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={12} />
        </button>
        <div data-tour="toolbar" className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary"><Save size={11} />{saving ? 'Saving…' : 'Save'}</button>
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
        </div>

        {/* Right inspector (resizable): trace > edge > node properties */}
        {traceResult && (
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
