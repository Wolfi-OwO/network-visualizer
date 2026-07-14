import { api } from './client.ts'
import type { CIDRResult } from '../../types/index.ts'

export const cidr = {
  calculate: (input: string) => api.post<CIDRResult>('/cidr/calculations', { input }),
  subnets: (network: string, count?: number, prefixLength?: number) =>
    api.post<{ items: CIDRResult[]; count: number }>('/cidr/subnets', {
      network,
      count,
      prefixLength,
    }),
  supernet: (networks: string[]) => api.post<CIDRResult>('/cidr/supernets', { networks }),
}
