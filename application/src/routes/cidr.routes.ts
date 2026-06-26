import { Router } from 'express'
import * as handlers from '../handlers/cidr.handlers.js'

const router = Router()

router.get('/', handlers.index)
router.post('/calculations', handlers.calculate)
router.post('/subnets', handlers.generateSubnets)
router.post('/supernets', handlers.findSupernet)
router.get('/validations/:ip', handlers.validateIp)

export default router
