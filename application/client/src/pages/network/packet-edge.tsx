import { useCallback } from 'react'
import { getBezierPath, EdgeLabelRenderer } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

export type PacketEdgeState = 'idle' | 'dimmed' | 'path' | 'active' | 'done' | 'blocked'

export interface PacketEdgeData extends Record<string, unknown> {
  packetState?: PacketEdgeState
  edgeLabel?: string
  packetReversed?: boolean  // dot travels target→source when true
  animDuration?: number     // ms — must match the step interval
  animVersion?: number      // increment to force-restart the dot animation
  // Link metadata (editable via the edge properties panel)
  bandwidth?: string
  latencyMs?: number
  linkStatus?: 'up' | 'down'
}

const STATE_COLORS: Record<PacketEdgeState, string> = {
  idle:    '#58a6ff',
  dimmed:  '#30363d',
  path:    '#484f58',
  active:  '#3fb950',
  done:    '#3fb950',
  blocked: '#f85149',
}

const STATE_WIDTH: Record<PacketEdgeState, number> = {
  idle: 2, dimmed: 1.5, path: 1.5, active: 3, done: 2.5, blocked: 3,
}

export function PacketEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, markerEnd,
}: EdgeProps) {
  const d = data as PacketEdgeData
  const state: PacketEdgeState = d?.packetState ?? 'idle'
  const isReversed = d?.packetReversed ?? false
  const dur = `${(d?.animDuration ?? 700) / 1000}s`
  const animVersion = d?.animVersion ?? 0

  // Visual path always source→target
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  // Forward (source→target) and reversed motion paths — dots pick one by direction
  const [fwdPath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const [revPath] = getBezierPath({
    sourceX: targetX, sourceY: targetY, sourcePosition: targetPosition,
    targetX: sourceX, targetY: sourceY, targetPosition: sourcePosition,
  })
  const fwdId = `${id}-mf`
  const revId = `${id}-mr`
  const motionPathId = isReversed ? revId : fwdId

  const pathId = `${id}-p`

  const isDown = d?.linkStatus === 'down'
  const stroke = isDown ? '#f85149' : STATE_COLORS[state]
  const strokeWidth = STATE_WIDTH[state]
  const dashed = isDown || state === 'active' || state === 'blocked'

  // Start the motion exactly when the element mounts, not relative to the SVG
  // document timeline (which would make a freshly-added dot appear already
  // finished — frozen at the destination — when the page has been open a while).
  const beginMotion = useCallback((el: SVGAnimateMotionElement | null) => {
    // Don't (re)start a dot while the analyzer has frozen the world — it must
    // stay exactly where it is, not jump back to the start of the edge.
    if (el && !(window as unknown as { __netvizFrozen?: boolean }).__netvizFrozen) {
      try { el.beginElement() } catch { /* not yet attached */ }
    }
  }, [])

  return (
    <>
      {/* Hidden motion paths (both directions) — dots follow these */}
      <path id={fwdId} d={fwdPath} fill="none" stroke="none" />
      <path id={revId} d={revPath} fill="none" stroke="none" />

      {/* Visible edge */}
      <path
        id={pathId}
        d={edgePath}
        fill="none"
        className="react-flow__edge-path"
        strokeWidth={strokeWidth}
        stroke={stroke}
        strokeDasharray={dashed ? '8 4' : undefined}
        opacity={isDown ? 0.5 : state === 'dimmed' ? 0.3 : 1}
        style={{ transition: 'stroke 0.3s, stroke-width 0.3s, opacity 0.3s' }}
        markerEnd={markerEnd}
      />
      {/* Wider transparent hit area */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="react-flow__edge-interaction"
      />

      {/* ── Traveling packet dot ───────────────────────────────── */}
      {state === 'active' && (
        // key=animVersion forces a clean remount (and animation restart) after resume
        <circle key={`dot-${animVersion}`} r={5} fill="#3fb950" stroke="#0d1117" strokeWidth={1.5}
          style={{ filter: 'drop-shadow(0 0 7px #3fb950) drop-shadow(0 0 14px #3fb95066)' }}>
          <animateMotion ref={beginMotion} dur={dur} begin="indefinite" repeatCount="1" fill="freeze" rotate="auto">
            <mpath href={`#${motionPathId}`} />
          </animateMotion>
        </circle>
      )}

      {state === 'blocked' && (
        <>
          <circle key={`bdot-${animVersion}`} r={5} fill="#f85149" stroke="#0d1117" strokeWidth={1.5}
            style={{ filter: 'drop-shadow(0 0 7px #f85149)' }}>
            <animateMotion ref={beginMotion} dur={dur} begin="indefinite" repeatCount="1" fill="freeze" rotate="auto">
              <mpath href={`#${motionPathId}`} />
            </animateMotion>
          </circle>
          <text key={`btxt-${animVersion}`} fontSize={9} fontWeight={700} fill="#f85149"
            textAnchor="middle" dy="-8"
            style={{ fontFamily: 'monospace', filter: 'drop-shadow(0 0 3px #f85149)' }}>
            <animateMotion ref={beginMotion} dur={dur} begin="indefinite" repeatCount="1" fill="freeze" rotate="auto">
              <mpath href={`#${motionPathId}`} />
            </animateMotion>
            ✗
          </text>
        </>
      )}

      {/* Small dot frozen at end of completed edges */}
      {state === 'done' && (
        <circle r={3.5} fill="#3fb950" stroke="#0d1117" strokeWidth={1}
          style={{ filter: 'drop-shadow(0 0 4px #3fb950)' }}>
          <animateMotion dur="0.001s" repeatCount="1" fill="freeze" begin="0s">
            <mpath href={`#${motionPathId}`} />
          </animateMotion>
        </circle>
      )}

      {/* Concurrent live/DHCP packets are rendered by the rAF PacketFlightLayer */}

      {/* Label */}
      {d?.edgeLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10, color: '#8b949e',
              pointerEvents: 'none',
              background: '#161b22cc',
              padding: '1px 4px',
              borderRadius: 3,
            }}
            className="nodrag nopan"
          >
            {d.edgeLabel as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export const edgeTypes = { packet: PacketEdge }
