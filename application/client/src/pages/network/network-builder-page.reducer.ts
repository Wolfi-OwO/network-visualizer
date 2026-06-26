import type { NetworkTopology } from '../../types/index.ts'
import type { TraceResult } from '../../lib/api/index.ts'

// Consolidated UI/animation state for the network builder page, with initial
// values kept here (out of the component).
export interface BuilderState {
  topology: NetworkTopology | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  showValidation: boolean
  showState: boolean
  showTutorial: boolean
  guidedActive: boolean
  saving: boolean
  status: string
  traceResult: TraceResult | null
  traceStep: number
  isAnimating: boolean
  isPaused: boolean
  animSpeed: number
  liveMode: boolean
  histTick: number
}

export const initialBuilderState: BuilderState = {
  topology: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  showValidation: false,
  showState: false,
  showTutorial: false,
  guidedActive: false,
  saving: false,
  status: '',
  traceResult: null,
  traceStep: -1,
  isAnimating: false,
  isPaused: false,
  animSpeed: 5000,
  liveMode: true,
  histTick: 0,
}

type Updater<T> = T | ((prev: T) => T)

export type BuilderAction =
  | { [K in keyof BuilderState]: { type: 'set'; key: K; value: Updater<BuilderState[K]> } }[keyof BuilderState]
  | { type: 'patch'; values: Partial<BuilderState> }
  | { type: 'reset' }

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'set': {
      const prev = state[action.key]
      const value = action.value as Updater<unknown>
      const next = typeof value === 'function' ? (value as (p: unknown) => unknown)(prev) : value
      return { ...state, [action.key]: next }
    }
    case 'patch': return { ...state, ...action.values }
    case 'reset': return initialBuilderState
    default: return state
  }
}
