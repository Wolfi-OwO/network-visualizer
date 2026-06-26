import { Router } from 'express'
import * as handlers from '../handlers/auth.handlers.js'
import { asyncHandler } from '../lib/errors.js'

const router = Router()

router.get('/providers', handlers.providers)
router.get('/me', asyncHandler(handlers.me))
router.post('/logout', handlers.logout)
router.post('/dev-login', asyncHandler(handlers.devLogin))

router.get('/google', handlers.googleStart)
router.get('/google/callback', asyncHandler(handlers.googleCallback))
router.get('/microsoft', handlers.microsoftStart)
router.get('/microsoft/callback', asyncHandler(handlers.microsoftCallback))

export default router
