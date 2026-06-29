import { memo } from 'react'
import { ViewportPortal } from '@xyflow/react'
import type { PacketInfo } from './packet-model.ts'

// One packet in flight along a multi-hop path. Position is advanced every frame
// by the rAF engine in the builder; the DOM element is updated imperatively, so
// changing speed/latency mid-flight is reflected smoothly (no remount, no reset).
export interface Flight {
  id: string
  path: string[]        // node ids, source → destination
  edgePath: string[]    // edge ids between them
  hop: number           // index of the edge currently being crossed
  progress: number      // 0..1 along the current edge
  color: string
  label?: string
  packet?: PacketInfo
  onDone?: () => void
  onAbort?: () => void
  el?: HTMLDivElement | null
}

// Rendered inside React Flow's transformed viewport, so dots pan/zoom with the
// canvas. Only re-renders when `version` changes (a flight added/removed), never
// per frame — frame-to-frame motion is done imperatively on `flight.el`.
function FlightLayer({ flights }: { flights: Flight[]; version: number }) {
  return (
    <ViewportPortal>
      {flights.map(f => (
        <div
          key={f.id}
          ref={el => { f.el = el }}
          onClick={f.packet ? e => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('netviz:inspectPacket', { detail: f.packet })) } : undefined}
          style={{
            position: 'absolute', left: 0, top: 0,
            transform: 'translate(-3000px,-3000px)',   // offscreen until first frame positions it
            pointerEvents: f.packet ? 'auto' : 'none',
            cursor: f.packet ? 'pointer' : 'default',
            zIndex: 6, willChange: 'transform',
          }}
        >
          {f.label && (
            <span style={{
              position: 'absolute', left: '50%', top: -17, transform: 'translateX(-50%)',
              fontSize: 8, fontWeight: 700, color: f.color, fontFamily: 'monospace',
              whiteSpace: 'nowrap', textShadow: '0 0 2px #0d1117, 0 0 3px #0d1117',
            }}>{f.label}</span>
          )}
          {/* invisible larger hit target so the small dot is easy to click */}
          {f.packet && <span style={{ position: 'absolute', left: -11, top: -11, width: 22, height: 22, borderRadius: '50%' }} />}
          <span style={{
            position: 'absolute', left: -5, top: -5, width: 10, height: 10, borderRadius: '50%',
            background: f.color, border: '1px solid #0d1117',
            boxShadow: `0 0 6px ${f.color}, 0 0 12px ${f.color}66`,
          }} />
        </div>
      ))}
    </ViewportPortal>
  )
}

export const PacketFlightLayer = memo(FlightLayer)
