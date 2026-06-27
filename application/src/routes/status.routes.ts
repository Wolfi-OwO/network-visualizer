import { Router } from 'express'
import * as handlers from '../handlers/status.handlers.js'
import { asyncHandler } from '../lib/errors.js'

const router = Router()

// Public — a status page is meant to be reachable without signing in.
router.get('/', asyncHandler(handlers.getServiceStatus))

export default router
