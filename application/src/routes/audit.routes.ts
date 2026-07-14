import { Router } from 'express';
import * as handlers from '../handlers/audit.handlers.js';
import { asyncHandler } from '../lib/errors.js';
import { requireRole } from '../middlewares/auth.js';

const router = Router();

router.get('/', requireRole('admin'), asyncHandler(handlers.listAudit));

export default router;
