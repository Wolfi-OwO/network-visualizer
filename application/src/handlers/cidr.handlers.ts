import { Request, Response } from 'express'
import * as cidrService from '../services/cidrService.js'
import { BadRequestError } from '../lib/errors.js'

export function calculate(req: Request, res: Response): void {
  const { input } = req.body
  if (!input) throw new BadRequestError('input is required')
  try {
    res.json(cidrService.parseCIDR(input))
  } catch (err) {
    throw new BadRequestError(err instanceof Error ? err.message : 'Invalid CIDR')
  }
}

export function generateSubnets(req: Request, res: Response): void {
  const { network, count, prefixLength } = req.body
  if (!network) throw new BadRequestError('network is required')
  try {
    const subnets = cidrService.generateSubnets(network, count, prefixLength)
    res.json({ subnets, count: subnets.length })
  } catch (err) {
    throw new BadRequestError(err instanceof Error ? err.message : 'Invalid network')
  }
}

export function findSupernet(req: Request, res: Response): void {
  const { networks } = req.body
  if (!networks || !Array.isArray(networks) || networks.length < 2) {
    throw new BadRequestError('networks array with at least 2 entries is required')
  }
  try {
    res.json(cidrService.findSupernet(networks))
  } catch (err) {
    throw new BadRequestError(err instanceof Error ? err.message : 'Invalid networks')
  }
}

export function validateIp(req: Request, res: Response): void {
  res.json({ ip: req.params.ip, valid: cidrService.validateIpAddress(req.params.ip) })
}
