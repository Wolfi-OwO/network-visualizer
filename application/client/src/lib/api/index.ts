// Barrel for the API layer — one module per backend resource.
export { api } from './client.ts'
export { packets } from './packets.ts'
export { capture } from './capture.ts'
export { cidr } from './cidr.ts'
export { network } from './networks.ts'
export type { ValidationReport, ValidationFinding, Severity, ControlPlaneReport } from './networks.ts'
export { send } from './traces.ts'
export type { TraceHop, TraceResult } from './traces.ts'
