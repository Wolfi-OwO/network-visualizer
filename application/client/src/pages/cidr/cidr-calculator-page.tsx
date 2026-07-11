import { useState, useReducer, useCallback } from 'react'
import { Calculator, ChevronDown, ChevronRight, AlertCircle, CheckCircle, Check, Copy, X } from 'lucide-react'
import { cidr as cidrApi } from '../../lib/api/index.ts'
import { cidrReducer, initialCidrState } from './cidr-calculator-page.reducer.ts'

const PRESETS = [
  '192.168.1.0/24', '10.0.0.0/8', '172.16.0.0/12',
  '10.10.0.0/16', '192.168.0.0/16', '203.0.113.0/24',
]

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-700)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:scale-105 transition-all ml-1 font-mono"
      title={copied ? 'Copied' : 'Copy'}
    >
      {copied
        ? <><Check size={9} className="text-[var(--green)]" /> copied</>
        : <><Copy size={9} /> copy</>}
    </button>
  )
}

function BinaryDisplay({ binary, prefix }: { binary: string; prefix: number }) {
  const parts = binary.split('.')
  return (
    <div className="font-mono text-[11px] flex gap-1">
      {parts.map((octet, i) => (
        <span key={i}>
          {i > 0 && <span className="text-[var(--text-muted)]">.</span>}
          {octet.split('').map((bit, j) => {
            const bitIndex = i * 8 + j
            const isNetwork = bitIndex < prefix
            return (
              <span
                key={j}
                className={isNetwork ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}
              >
                {bit}
              </span>
            )
          })}
        </span>
      ))}
    </div>
  )
}

function ResultRow({ label, value, mono, copyable, extra }: {
  label: string; value: string | number; mono?: boolean; copyable?: boolean; extra?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-[var(--border)]/50 last:border-0">
      <span className="text-[11px] text-[var(--text-muted)] w-40 shrink-0">{label}</span>
      <span className={`text-[11px] text-[var(--text-primary)] flex-1 ${mono ? 'font-mono' : ''}`}>
        {String(value)}
        {copyable && <CopyBtn value={String(value)} />}
      </span>
      {extra}
    </div>
  )
}

export default function CIDRCalculatorPage() {
  const [state, dispatch] = useReducer(cidrReducer, initialCidrState)
  const {
    input, result, error, loading, showSubnets, subnets,
    subnetCount, subnetPrefix, subnetLoading, supernetInputs, supernetResult,
  } = state

  const calculate = useCallback(async (value?: string) => {
    const v = value ?? input
    if (!v.trim()) return
    dispatch({ type: 'patch', values: { loading: true, error: '', result: null, subnets: [], showSubnets: false } })
    try {
      const { data } = await cidrApi.calculate(v.trim())
      dispatch({ type: 'set', key: 'result', value: data })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Invalid CIDR notation'
      dispatch({ type: 'set', key: 'error', value: msg })
    } finally {
      dispatch({ type: 'set', key: 'loading', value: false })
    }
  }, [input])

  const calcSubnets = useCallback(async () => {
    if (!result) return
    dispatch({ type: 'set', key: 'subnetLoading', value: true })
    try {
      const count = subnetPrefix ? undefined : parseInt(subnetCount) || 4
      const prefix = subnetPrefix ? parseInt(subnetPrefix) : undefined
      const { data } = await cidrApi.subnets(result.networkAddress + '/' + result.cidrPrefix, count, prefix)
      dispatch({ type: 'patch', values: { subnets: data.items, showSubnets: true } })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed'
      dispatch({ type: 'set', key: 'error', value: msg })
    } finally {
      dispatch({ type: 'set', key: 'subnetLoading', value: false })
    }
  }, [result, subnetCount, subnetPrefix])

  const calcSupernet = useCallback(async () => {
    try {
      const nets = supernetInputs.filter(s => s.trim())
      const { data } = await cidrApi.supernet(nets)
      dispatch({ type: 'set', key: 'supernetResult', value: data })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed'
      dispatch({ type: 'set', key: 'error', value: msg })
    }
  }, [supernetInputs])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 backdrop-blur-xl bg-[var(--glass-bg)] border-b border-[var(--glass-border)] shrink-0">
        <Calculator size={16} className="text-[var(--accent)]" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">CIDR Calculator</span>
        <span className="hidden sm:inline text-xs text-[var(--text-muted)]">IPv4 Subnet Calculator & Network Analyzer</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Input section */}
        <div className="card p-4 space-y-3">
          <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Network Input</div>
          <div className="flex gap-2">
            <input
              className="input flex-1 font-mono text-sm"
              value={input}
              onChange={e => dispatch({ type: 'set', key: 'input', value: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && calculate()}
              placeholder="192.168.1.0/24 or 10.0.0.1 255.255.255.0"
              spellCheck={false}
            />
            <button onClick={() => calculate()} disabled={loading} className="btn-primary px-4">
              {loading ? 'Calculating…' : 'Calculate'}
            </button>
          </div>

          {/* Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-[var(--text-muted)]">Presets:</span>
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => { dispatch({ type: 'set', key: 'input', value: p }); calculate(p) }}
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-white/10 hover:border-white/20 transition-all border border-white/10 active:scale-[0.97]"
              >
                {p}
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[var(--red)] text-xs">
              <AlertCircle size={12} /> {error}
            </div>
          )}
        </div>

        {result && (
          <>
            {/* Main results */}
            <div className="animate-rise grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left column */}
              <div className="card p-4 space-y-0.5">
                <div className="panel-header -mx-4 -mt-4 mb-3">Network Details</div>
                <ResultRow label="IP Address" value={result.ipAddress} mono copyable />
                <ResultRow label="Network Address" value={result.networkAddress} mono copyable />
                <ResultRow label="Broadcast Address" value={result.broadcastAddress} mono copyable />
                <ResultRow label="First Host" value={result.firstHost} mono copyable />
                <ResultRow label="Last Host" value={result.lastHost} mono copyable />
                <ResultRow label="Subnet Mask" value={result.subnetMask} mono copyable />
                <ResultRow label="Wildcard Mask" value={result.wildcardMask} mono copyable />
                <ResultRow label="CIDR Notation" value={`${result.networkAddress}/${result.cidrPrefix}`} mono copyable />
              </div>

              {/* Right column */}
              <div className="card p-4 space-y-0.5">
                <div className="panel-header -mx-4 -mt-4 mb-3">Address Info</div>
                <ResultRow label="Total Hosts" value={result.totalHosts.toLocaleString()} mono />
                <ResultRow label="Usable Hosts" value={result.usableHosts.toLocaleString()} mono />
                <ResultRow label="IP Class" value={result.ipClass} />
                <ResultRow
                  label="Private Range"
                  value={result.isPrivate ? 'Yes (RFC 1918)' : 'No (Public)'}
                  extra={
                    result.isPrivate
                      ? <CheckCircle size={12} className="text-[var(--green)]" />
                      : <AlertCircle size={12} className="text-[var(--yellow)]" />
                  }
                />
                <ResultRow label="Prefix Length" value={`/${result.cidrPrefix}`} mono />

                <div className="pt-2 space-y-1.5">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Binary Representation</div>
                  <div className="space-y-1">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block mb-0.5">IP Address</span>
                      <BinaryDisplay binary={result.binaryIpAddress} prefix={result.cidrPrefix} />
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block mb-0.5">Subnet Mask</span>
                      <BinaryDisplay binary={result.binarySubnetMask} prefix={result.cidrPrefix} />
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block mb-0.5">Network Address</span>
                      <BinaryDisplay binary={result.binaryNetworkAddress} prefix={result.cidrPrefix} />
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-1 flex gap-3">
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-sm bg-[var(--accent)]" /> Network bits
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-sm bg-[var(--text-muted)]" /> Host bits
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual subnet bar */}
            <div className="card p-4">
              <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Address Space Visualization</div>
              <div className="relative h-8 rounded overflow-hidden bg-[var(--bg-700)]">
                <div
                  className="absolute left-0 top-0 h-full bg-[var(--accent)] opacity-25"
                  style={{ width: `${(result.cidrPrefix / 32) * 100}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-3">
                  <span className="text-[10px] font-mono text-[var(--text-primary)]">{result.networkAddress}</span>
                  <span className="text-[10px] font-mono text-[var(--text-primary)]">{result.broadcastAddress}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-[var(--accent)] opacity-30" />
                  <span className="text-[10px] text-[var(--text-muted)]">Network portion (/{result.cidrPrefix})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-[var(--bg-600)]" />
                  <span className="text-[10px] text-[var(--text-muted)]">Host portion ({32 - result.cidrPrefix} bits = {result.usableHosts.toLocaleString()} hosts)</span>
                </div>
              </div>
            </div>

            {/* Subnet Calculator */}
            <div className="card p-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => dispatch({ type: 'set', key: 'showSubnets', value: v => !v })}
              >
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Subnet Calculator</div>
                {showSubnets ? <ChevronDown size={14} className="text-[var(--text-muted)]" /> : <ChevronRight size={14} className="text-[var(--text-muted)]" />}
              </div>

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-[var(--text-muted)]">Split</span>
                <input
                  className="input w-16"
                  value={subnetCount}
                  onChange={e => dispatch({ type: 'patch', values: { subnetCount: e.target.value, subnetPrefix: '' } })}
                  placeholder="count"
                />
                <span className="text-xs text-[var(--text-muted)]">subnets  — or use prefix</span>
                <input
                  className="input w-16 font-mono"
                  value={subnetPrefix}
                  onChange={e => dispatch({ type: 'patch', values: { subnetPrefix: e.target.value, subnetCount: '' } })}
                  placeholder="/26"
                />
                <button onClick={calcSubnets} disabled={subnetLoading} className="btn-ghost">
                  {subnetLoading ? 'Calculating…' : 'Generate Subnets'}
                </button>
              </div>

              {showSubnets && subnets.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        {['#', 'Network', 'First Host', 'Last Host', 'Broadcast', 'Mask', 'Hosts'].map(h => (
                          <th key={h} className="px-2 py-1.5 text-left text-[var(--text-muted)] font-semibold uppercase text-[9px] tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {subnets.map((s, i) => (
                        <tr key={i} className="border-b border-[var(--border)]/30 hover:bg-[var(--bg-700)] transition-colors">
                          <td className="px-2 py-1 font-mono text-[var(--text-muted)]">{i + 1}</td>
                          <td className="px-2 py-1 font-mono text-[var(--accent)]">{s.networkAddress}/{s.cidrPrefix}</td>
                          <td className="px-2 py-1 font-mono text-[var(--text-primary)]">{s.firstHost}</td>
                          <td className="px-2 py-1 font-mono text-[var(--text-primary)]">{s.lastHost}</td>
                          <td className="px-2 py-1 font-mono text-[var(--text-muted)]">{s.broadcastAddress}</td>
                          <td className="px-2 py-1 font-mono text-[var(--text-muted)]">{s.subnetMask}</td>
                          <td className="px-2 py-1 font-mono text-[var(--text-secondary)]">{s.usableHosts.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Supernet Calculator */}
        <div className="card p-4">
          <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Supernet Calculator</div>
          <div className="space-y-2">
            {supernetInputs.map((v, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input font-mono flex-1"
                  value={v}
                  onChange={e => dispatch({ type: 'set', key: 'supernetInputs', value: prev => prev.map((s, j) => (j === i ? e.target.value : s)) })}
                  placeholder="192.168.0.0/24"
                />
                {supernetInputs.length > 2 && (
                  <button
                    onClick={() => dispatch({ type: 'set', key: 'supernetInputs', value: inp => inp.filter((_, j) => j !== i) })}
                    className="btn-ghost text-[var(--red)] border-[var(--red)]/30"
                    title="Remove this network"
                  ><X size={12} /></button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <button
                onClick={() => dispatch({ type: 'set', key: 'supernetInputs', value: inp => [...inp, ''] })}
                className="btn-ghost text-xs"
              >
                + Add Network
              </button>
              <button onClick={calcSupernet} className="btn-primary">
                Find Supernet
              </button>
            </div>
          </div>

          {supernetResult && (
            <div className="mt-3 p-3 bg-[var(--bg-800)] rounded border border-[var(--border)]">
              <div className="text-[10px] text-[var(--text-muted)] mb-1">Smallest common supernet:</div>
              <div className="font-mono text-sm text-[var(--accent)]">
                {supernetResult.networkAddress}/{supernetResult.cidrPrefix}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                Mask: {supernetResult.subnetMask} — {supernetResult.usableHosts.toLocaleString()} usable hosts
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
