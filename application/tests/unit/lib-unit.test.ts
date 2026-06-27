/// <reference types="mocha" />
import { assert, wait } from './common.ts'
import * as ip from '../../src/lib/ip.js'
import { signSession, verifySession } from '../../src/lib/jwt.js'
import * as hateoas from '../../src/lib/hateoas.js'
import { AppError, BadRequestError, NotFoundError, InternalServerError, asyncHandler } from '../../src/lib/errors.js'

describe('lib/ip', () => {
  it('parses, formats and reasons about IPv4', () => {
    assert.equal(ip.ipToInt('255.255.255.255'), 0xffffffff)
    assert.equal(ip.ipToInt('0.0.0.0'), 0)
    assert.equal(ip.ipToInt('bad'), null)
    assert.equal(ip.ipToInt('1.2.3.4.5'), null)
    assert.equal(ip.ipToInt('999.0.0.1'), null)
    assert.equal(ip.intToIp(0xffffffff), '255.255.255.255')
    assert.equal(ip.maskToPrefix('255.255.255.0'), 24)
    assert.equal(ip.maskToPrefix('255.255.255.255'), 32)
    assert.equal(ip.maskToPrefix('255.0.255.0'), null)
    assert.equal(ip.prefixOf({ cidr: '/26' }), 26)
    assert.equal(ip.prefixOf({ subnetMask: '255.255.0.0' }), 16)
    assert.equal(ip.prefixOf({}), null)
    assert.ok(ip.inSubnet('10.0.0.5', '10.0.0.1', 24))
    assert.ok(!ip.inSubnet('10.0.1.5', '10.0.0.1', 24))
    assert.ok(ip.isPrivate('10.1.2.3') && ip.isPrivate('192.168.1.1') && ip.isPrivate('172.16.5.5'))
    assert.ok(!ip.isPrivate('8.8.8.8'))
  })
})

describe('lib/jwt', () => {
  it('signs and verifies, rejects garbage', () => {
    const token = signSession({ sub: 'u1', email: 'a@b.c', name: 'A', role: 'admin' })
    assert.equal(verifySession(token)?.sub, 'u1')
    assert.equal(verifySession('not-a-token'), null)
  })
})

describe('lib/hateoas', () => {
  it('builds link maps', () => {
    assert.ok(hateoas.apiRootLinks().networks)
    assert.ok(hateoas.networksCollectionLinks().create)
    assert.ok(hateoas.topologyLinks('x').traces)
    assert.ok(hateoas.captureLinks().update)
    assert.ok(hateoas.packetsCollectionLinks().stream)
    assert.ok(hateoas.packetLinks(1).self)
    assert.ok(hateoas.cidrRootLinks().subnets)
    assert.equal(hateoas.withLinks({ a: 1 }, { self: { href: '/x' } })._links.self.href, '/x')
  })
})

describe('lib/errors', () => {
  it('error classes carry status codes', () => {
    assert.equal(new BadRequestError().statusCode, 400)
    assert.equal(new NotFoundError().statusCode, 404)
    assert.equal(new InternalServerError().expose, false)
    assert.ok(new AppError(418, 'teapot') instanceof Error)
  })
  it('asyncHandler forwards rejections to next', async () => {
    let caught: unknown
    const handler = asyncHandler(async () => { throw new BadRequestError('boom') })
    await handler({} as never, {} as never, ((e: unknown) => { caught = e }) as never)
    await wait(5)
    assert.ok(caught instanceof BadRequestError)
  })
})
