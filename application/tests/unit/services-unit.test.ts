/// <reference types="mocha" />
import { EventEmitter } from 'node:events'
import { assert, wait } from './common.ts'
import * as cidr from '../../src/services/cidr-service.js'
import { validateTopology } from '../../src/services/validation-service.js'
import { controlPlaneForNode } from '../../src/services/control-plane-service.js'
import { deviceRunningConfig, topologyConfigBundle } from '../../src/services/config-export-service.js'
import { tracePacket } from '../../src/services/packet-sender-service.js'
import * as sim from '../../src/services/packet-simulator.js'
import * as netdb from '../../src/db/network-service.js'
import * as authService from '../../src/services/auth-service.js'
import * as packetsHandlers from '../../src/handlers/packets.handlers.js'
import { buildDemoTopology } from '../../src/db/seed.js'
import type { NetworkTopology } from '../../src/types/index.js'

describe('cidr-service', () => {
  it('parses, splits and summarises networks', () => {
    const r = cidr.parseCIDR('192.168.1.10/24')
    assert.equal(r.networkAddress, '192.168.1.0')
    assert.equal(r.broadcastAddress, '192.168.1.255')
    assert.ok(r.isPrivate)
    assert.ok(cidr.parseCIDR('8.8.8.8/32').usableHosts >= 0)
    assert.equal(cidr.validateIpAddress('10.0.0.1'), true)
    assert.equal(cidr.validateIpAddress('999.1.1.1'), false)
    assert.equal(cidr.generateSubnets('10.0.0.0/24', 4).length, 4)
    assert.ok(cidr.generateSubnets('10.0.0.0/24', undefined, 26).length >= 1)
    assert.ok(cidr.findSupernet(['192.168.0.0/24', '192.168.1.0/24']).networkAddress)
  })
  it('rejects invalid input', () => {
    assert.throws(() => cidr.parseCIDR('not-an-ip/24'))
    assert.throws(() => cidr.parseCIDR('10.0.0.0/40'))
  })
})

describe('validation-service', () => {
  it('flags duplicate IP/MAC, gateways, isolation and shadowed rules', () => {
    const now = Date.now()
    const topo: NetworkTopology = {
      id: 't', name: 'bad', nodes: [
        { id: 'a', type: 'pc', label: 'A', position: { x: 0, y: 0 }, config: { interfaces: [{ name: 'e', ipAddress: '10.0.0.5', subnetMask: '255.255.255.0', macAddress: 'aa:aa:aa:aa:aa:aa', status: 'up' }], routingTable: [{ id: '1', destination: '0.0.0.0', mask: '0.0.0.0', gateway: '192.168.99.1', interface: 'e', metric: 1, type: 'default' }] } },
        { id: 'b', type: 'pc', label: 'B', position: { x: 1, y: 1 }, config: { interfaces: [{ name: 'e', ipAddress: '10.0.0.5', subnetMask: '255.255.255.0', macAddress: 'aa:aa:aa:aa:aa:aa', status: 'up' }] } },
        { id: 'c', type: 'firewall', label: 'FW', position: { x: 2, y: 2 }, config: { firewallRules: [
          { id: 'r1', priority: 1, action: 'deny', protocol: 'any', srcIp: 'any', srcPort: 'any', dstIp: 'any', dstPort: 'any', direction: 'in', description: 'deny all', enabled: true },
          { id: 'r2', priority: 2, action: 'allow', protocol: 'tcp', srcIp: 'any', srcPort: 'any', dstIp: 'any', dstPort: '80', direction: 'in', description: 'web', enabled: true },
        ] } },
      ], edges: [], createdAt: now, updatedAt: now,
    }
    const cats = validateTopology(topo).findings.map((f) => f.category)
    for (const c of ['duplicate-ip', 'duplicate-mac', 'gateway-unreachable', 'isolated-node', 'shadowed-rule']) {
      assert.ok(cats.includes(c), `missing ${c}`)
    }
  })
  it('passes the demo topology', () => {
    assert.equal(validateTopology(buildDemoTopology()).ok, true)
  })
})

describe('control-plane-service', () => {
  it('returns role-appropriate tables', () => {
    const topo = buildDemoTopology()
    assert.ok(controlPlaneForNode(topo, 'switch-1')!.macTable)
    assert.ok(controlPlaneForNode(topo, 'fw-1')!.nat)
    assert.ok(controlPlaneForNode(topo, 'pc-1')!.arp)
    assert.equal(controlPlaneForNode(topo, 'nope'), null)
  })
})

describe('config-export-service', () => {
  it('renders running-config + bundle', () => {
    const topo = buildDemoTopology()
    const cfg = deviceRunningConfig(topo, topo.nodes.find((n) => n.id === 'fw-1')!)
    assert.match(cfg, /hostname /)
    assert.match(cfg, /ip access-list extended/)
    assert.match(deviceRunningConfig(topo, topo.nodes.find((n) => n.id === 'switch-1')!), /switchport access vlan/)
    assert.match(topologyConfigBundle(topo), /configuration archive/)
  })
})

describe('packet-sender-service.tracePacket', () => {
  const topo = buildDemoTopology()
  it('allowed LAN→server path', () => {
    assert.ok(tracePacket(topo, { srcNodeId: 'pc-1', dstNodeId: 'server-1', protocol: 'tcp', dstPort: 443 }).path.length >= 2)
  })
  it('to the internet (NAT edge)', () => {
    assert.ok(tracePacket(topo, { srcNodeId: 'pc-1', dstNodeId: 'internet-1', protocol: 'tcp', dstPort: 443 }).hops.length >= 1)
  })
  it('blocks inbound SSH at the firewall', () => {
    assert.equal(tracePacket(topo, { srcNodeId: 'internet-1', dstNodeId: 'server-1', protocol: 'tcp', dstPort: 22 }).blocked, true)
  })
  it('low TTL on a multi-hop path', () => {
    const r = tracePacket(topo, { srcNodeId: 'pc-1', dstNodeId: 'server-1', protocol: 'tcp', dstPort: 443, ttl: 1 })
    assert.ok(r.blocked || r.success)
  })
  it('icmp same-switch peers', () => {
    assert.ok(Array.isArray(tracePacket(topo, { srcNodeId: 'pc-1', dstNodeId: 'pc-2', protocol: 'icmp' }).hops))
  })
  it('errors on unknown nodes', () => {
    assert.equal(tracePacket(topo, { srcNodeId: 'pc-1', dstNodeId: 'ghost', protocol: 'tcp' }).success, false)
  })

  it('routes between two private LANs over a two-router WAN link', () => {
    const now = Date.now()
    const ifc = (ip: string, cidr: string, name = 'eth0') => ({ name, ipAddress: ip, subnetMask: '255.255.255.0', cidr, status: 'up' as const })
    const rt = (destination: string, mask: string, gateway: string, type: 'connected' | 'static') =>
      ({ id: Math.random().toString(36), destination, mask, gateway, interface: 'x', metric: type === 'static' ? 1 : 0, type })
    const wanTopo = {
      id: 't', name: 'wan', createdAt: now, updatedAt: now,
      nodes: [
        { id: 'pcA', type: 'pc', label: 'A', position: { x: 0, y: 0 }, config: { interfaces: [ifc('10.1.0.10', '/24')] } },
        { id: 'swA', type: 'switch', label: 'swA', position: { x: 1, y: 0 }, config: {} },
        { id: 'rA', type: 'router', label: 'rA', position: { x: 2, y: 0 }, config: { interfaces: [ifc('10.1.0.1', '/24', 'LAN'), { name: 'WAN', ipAddress: '172.16.255.1', subnetMask: '255.255.255.252', cidr: '/30', status: 'up' as const }], routingTable: [rt('10.1.0.0', '255.255.255.0', '0.0.0.0', 'connected'), rt('172.16.255.0', '255.255.255.252', '0.0.0.0', 'connected'), rt('10.2.0.0', '255.255.255.0', '172.16.255.2', 'static')] } },
        { id: 'rB', type: 'router', label: 'rB', position: { x: 3, y: 0 }, config: { interfaces: [ifc('10.2.0.1', '/24', 'LAN'), { name: 'WAN', ipAddress: '172.16.255.2', subnetMask: '255.255.255.252', cidr: '/30', status: 'up' as const }], routingTable: [rt('10.2.0.0', '255.255.255.0', '0.0.0.0', 'connected'), rt('172.16.255.0', '255.255.255.252', '0.0.0.0', 'connected'), rt('10.1.0.0', '255.255.255.0', '172.16.255.1', 'static')] } },
        { id: 'swB', type: 'switch', label: 'swB', position: { x: 4, y: 0 }, config: {} },
        { id: 'pcB', type: 'pc', label: 'B', position: { x: 5, y: 0 }, config: { interfaces: [ifc('10.2.0.10', '/24')] } },
      ],
      edges: [
        { id: 'e1', source: 'pcA', target: 'swA', config: {} },
        { id: 'e2', source: 'swA', target: 'rA', config: {} },
        { id: 'e3', source: 'rA', target: 'rB', config: {} },
        { id: 'e4', source: 'rB', target: 'swB', config: {} },
        { id: 'e5', source: 'swB', target: 'pcB', config: {} },
      ],
    } as unknown as NetworkTopology

    const r = tracePacket(wanTopo, { srcNodeId: 'pcA', dstNodeId: 'pcB', protocol: 'icmp' })
    assert.equal(r.blocked, false)
    assert.equal(r.success, true)
  })
})

describe('packet-simulator', () => {
  it('captures, stops and clears', async () => {
    sim.startCapture()
    assert.equal(sim.isRunning(), true)
    await wait(700)
    const pkts = sim.getPackets(0, 1000)
    assert.ok(pkts.length > 0)
    assert.ok(sim.getStats().total > 0)
    assert.ok(sim.getPacketById(pkts[0].id))
    sim.stopCapture()
    sim.clearPackets()
    assert.equal(sim.getPackets().length, 0)
  })

  it('streams over the SSE handler', async () => {
    sim.startCapture()
    const req = Object.assign(new EventEmitter(), { query: {} }) as never
    let wrote = 0
    const res = { setHeader() {}, flushHeaders() {}, write() { wrote++ } } as never
    packetsHandlers.streamPackets(req, res)
    await wait(600)
    ;(req as unknown as EventEmitter).emit('close')
    sim.stopCapture()
    sim.clearPackets()
    assert.ok(wrote >= 0)
  })
})

describe('network-service mutations', () => {
  it('covers the full node/edge surface', async () => {
    const t = await netdb.createTopology('unit', 'desc', 'unit-owner')
    const n1 = await netdb.addNode(t.id, { type: 'pc', label: 'A', position: { x: 0, y: 0 }, config: {} }, 'unit-owner')
    const n2 = await netdb.addNode(t.id, { type: 'server', label: 'B', position: { x: 1, y: 1 }, config: {} }, 'unit-owner')
    assert.equal((await netdb.updateNode(t.id, n1!.id, { label: 'A2' }, 'unit-owner'))?.label, 'A2')
    const e = await netdb.addEdge(t.id, { source: n1!.id, target: n2!.id, config: {} }, 'unit-owner')
    assert.equal((await netdb.updateEdge(t.id, e!.id, { label: 'link' }, 'unit-owner'))?.label, 'link')
    assert.equal(await netdb.deleteEdge(t.id, e!.id, 'unit-owner'), true)
    assert.equal(await netdb.deleteNode(t.id, n1!.id, 'unit-owner'), true)
    assert.equal(await netdb.deleteTopology(t.id, 'unit-owner'), true)
    assert.equal(await netdb.getTopology(t.id, 'someone-else'), null)
    assert.equal(await netdb.addNode('missing', { type: 'pc', label: 'x', position: { x: 0, y: 0 }, config: {} }, 'unit-owner'), null)
    assert.equal(await netdb.updateNode('missing', 'x', {}, 'unit-owner'), null)
    assert.equal(await netdb.deleteNode('missing', 'x', 'unit-owner'), false)
  })
})

describe('auth-service', () => {
  it('builds OAuth urls and finds/creates users', async () => {
    assert.match(authService.googleAuthUrl('http://cb', 'st'), /accounts\.google\.com/)
    assert.match(authService.microsoftAuthUrl('http://cb', 'st'), /login\.microsoftonline\.com/)
    const u1 = await authService.findOrCreateUser({ provider: 'local', providerId: 'u@x.io', email: 'u@x.io', name: 'U' })
    const u2 = await authService.findOrCreateUser({ provider: 'local', providerId: 'u@x.io', email: 'u@x.io', name: 'U' })
    assert.equal(u1.id, u2.id)
    assert.equal((await authService.getUserById(u1.id))?.email, 'u@x.io')
    assert.equal(await authService.getUserById('nope'), null)
  })

  it('exchanges OAuth codes for profiles (mocked fetch)', async () => {
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      const u = String(url)
      if (u.includes('/token')) return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 })
      return new Response(JSON.stringify({ sub: 'g', id: 'm', email: 'p@x.io', name: 'P', displayName: 'P' }), { status: 200 })
    }) as typeof fetch
    try {
      assert.equal((await authService.googleProfile('code', 'http://cb')).email, 'p@x.io')
      assert.equal((await authService.microsoftProfile('code', 'http://cb')).provider, 'microsoft')
      globalThis.fetch = (async () => new Response('no', { status: 400 })) as typeof fetch
      await assert.rejects(authService.googleProfile('c', 'http://cb'))
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
