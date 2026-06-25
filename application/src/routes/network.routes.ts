import { Router } from 'express'
import * as handlers from '../handlers/network.handlers.js'
import { asyncHandler } from '../lib/errors.js'

const router = Router()

router.get('/', asyncHandler(handlers.listTopologies))
router.get('/default', asyncHandler(handlers.getDefaultTopology))
router.post('/', asyncHandler(handlers.createTopology))
router.get('/:id', asyncHandler(handlers.getTopologyById))
router.put('/:id', asyncHandler(handlers.updateTopology))
router.delete('/:id', asyncHandler(handlers.deleteTopology))

router.post('/:id/nodes', asyncHandler(handlers.addNode))
router.put('/:id/nodes/:nodeId', asyncHandler(handlers.updateNode))
router.delete('/:id/nodes/:nodeId', asyncHandler(handlers.deleteNode))

router.post('/:id/edges', asyncHandler(handlers.addEdge))
router.put('/:id/edges/:edgeId', asyncHandler(handlers.updateEdge))
router.delete('/:id/edges/:edgeId', asyncHandler(handlers.deleteEdge))

export default router
