import { Router } from 'express';
import * as handlers from '../handlers/metrics.handlers.js';
import { asyncHandler } from '../lib/errors.js';
import { requireRole } from '../middlewares/auth.js';

const router = Router();

router.get('/', requireRole('admin'), asyncHandler(handlers.getMetrics));

export default router;
