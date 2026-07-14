import { Request, Response } from 'express';
import * as cidrService from '../services/cidr-service.js';
import { BadRequestError } from '../lib/errors.js';
import { withLinks, cidrRootLinks } from '../lib/hateoas.js';

// GET /api/cidr — entry point listing the available calculations.
export function index(_req: Request, res: Response): void {
  res.json({ _links: cidrRootLinks() });
}

// POST /api/cidr/calculations — calculate subnet details for a CIDR.
export function calculate(req: Request, res: Response): void {
  const { input } = req.body;
  if (!input) throw new BadRequestError('input is required');
  try {
    res.status(201).json(
      withLinks(cidrService.parseCIDR(input) as object, {
        self: { href: '/api/cidr/calculations' },
        cidr: { href: '/api/cidr' },
      }),
    );
  } catch (err) {
    throw new BadRequestError(err instanceof Error ? err.message : 'Invalid CIDR');
  }
}

// POST /api/cidr/subnets — split a network into subnets.
export function generateSubnets(req: Request, res: Response): void {
  const { network, count, prefixLength } = req.body;
  if (!network) throw new BadRequestError('network is required');
  try {
    const subnets = cidrService.generateSubnets(network, count, prefixLength);
    res.status(201).json({
      _links: { self: { href: '/api/cidr/subnets' }, cidr: { href: '/api/cidr' } },
      count: subnets.length,
      items: subnets,
    });
  } catch (err) {
    throw new BadRequestError(err instanceof Error ? err.message : 'Invalid network');
  }
}

// POST /api/cidr/supernets — summarise networks into a supernet.
export function findSupernet(req: Request, res: Response): void {
  const { networks } = req.body;
  if (!networks || !Array.isArray(networks) || networks.length < 2) {
    throw new BadRequestError('networks array with at least 2 entries is required');
  }
  try {
    res.status(201).json(
      withLinks(cidrService.findSupernet(networks) as object, {
        self: { href: '/api/cidr/supernets' },
        cidr: { href: '/api/cidr' },
      }),
    );
  } catch (err) {
    throw new BadRequestError(err instanceof Error ? err.message : 'Invalid networks');
  }
}

// GET /api/cidr/validations/:ip — check whether a string is a valid IPv4 address.
export function validateIp(req: Request, res: Response): void {
  res.json({ ip: req.params.ip, valid: cidrService.validateIpAddress(req.params.ip) });
}
