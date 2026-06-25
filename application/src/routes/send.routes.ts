import { Router } from 'express'
import * as handlers from '../handlers/send.handlers.js'
import { asyncHandler } from '../lib/errors.js'

const router = Router()

router.post('/trace', asyncHandler(handlers.trace))

export default router
