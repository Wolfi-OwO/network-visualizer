import { Router } from 'express'
import * as handlers from '../handlers/capture.handlers.js'

const router = Router()

router.get('/', handlers.getCapture)
router.patch('/', handlers.updateCapture)

export default router
