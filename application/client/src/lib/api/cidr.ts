import { api } from './client'
import type { CIDRResult } from '../../types'

export const cidr = {
  calculate: (input: string) =>
    api.post<CIDRResult>('/cidr/calculate', { input }),
  subnets: (network: string, count?: number, prefixLength?: number) =>
    api.post<{ subnets: CIDRResult[]; count: number }>('/cidr/subnets', { network, count, prefixLength }),
  supernet: (networks: string[]) =>
    api.post<CIDRResult>('/cidr/supernet', { networks }),
}
