import { Router } from 'express'
import * as handlers from '../handlers/cidr.handlers.js'

const router = Router()

router.post('/calculate', handlers.calculate)
router.post('/subnets', handlers.generateSubnets)
router.post('/supernet', handlers.findSupernet)
router.get('/validate/:ip', handlers.validateIp)

export default router
