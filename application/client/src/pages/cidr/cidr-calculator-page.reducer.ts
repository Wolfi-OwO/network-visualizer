import type { CIDRResult } from '../../types/index.ts'

// State + initial values + reducer for the CIDR calculator page.
export interface CidrState {
  input: string
  result: CIDRResult | null
  error: string
  loading: boolean
  showSubnets: boolean
  subnets: CIDRResult[]
  subnetCount: string
  subnetPrefix: string
  subnetLoading: boolean
  supernetInputs: string[]
  supernetResult: CIDRResult | null
}

export const initialCidrState: CidrState = {
  input: '192.168.1.0/24',
  result: null,
  error: '',
  loading: false,
  showSubnets: false,
  subnets: [],
  subnetCount: '4',
  subnetPrefix: '',
  subnetLoading: false,
  supernetInputs: ['192.168.0.0/24', '192.168.1.0/24'],
  supernetResult: null,
}

type Updater<T> = T | ((prev: T) => T)

export type CidrAction =
  | {
      [K in keyof CidrState]: { type: 'set'; key: K; value: Updater<CidrState[K]> }
    }[keyof CidrState]
  | { type: 'patch'; values: Partial<CidrState> }
  | { type: 'reset' }

export function cidrReducer(state: CidrState, action: CidrAction): CidrState {
  switch (action.type) {
    case 'set': {
      const prev = state[action.key]
      const value = action.value as Updater<unknown>
      const next = typeof value === 'function' ? (value as (p: unknown) => unknown)(prev) : value
      return { ...state, [action.key]: next }
    }
    case 'patch':
      return { ...state, ...action.values }
    case 'reset':
      return initialCidrState
    default:
      return state
  }
}
