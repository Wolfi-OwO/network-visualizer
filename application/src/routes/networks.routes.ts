import { Router } from 'express'
import * as handlers from '../handlers/network.handlers.js'
import { createTrace } from '../handlers/trace.handlers.js'
import { asyncHandler } from '../lib/errors.js'

const router = Router()

// Topologies
router.get('/', asyncHandler(handlers.listTopologies))
router.post('/', asyncHandler(handlers.createTopology))
router.get('/default', asyncHandler(handlers.getDefaultTopology))
router.get('/:id', asyncHandler(handlers.getTopologyById))
router.put('/:id', asyncHandler(handlers.updateTopology))
router.delete('/:id', asyncHandler(handlers.deleteTopology))

// Nodes (sub-resource)
router.post('/:id/nodes', asyncHandler(handlers.addNode))
router.put('/:id/nodes/:nodeId', asyncHandler(handlers.updateNode))
router.delete('/:id/nodes/:nodeId', asyncHandler(handlers.deleteNode))

// Edges (sub-resource)
router.post('/:id/edges', asyncHandler(handlers.addEdge))
router.put('/:id/edges/:edgeId', asyncHandler(handlers.updateEdge))
router.delete('/:id/edges/:edgeId', asyncHandler(handlers.deleteEdge))

// Traces (sub-resource) — create a hop-by-hop packet trace through the topology
router.post('/:id/traces', asyncHandler(createTrace))

export default router
