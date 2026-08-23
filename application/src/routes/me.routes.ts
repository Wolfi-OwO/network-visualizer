import { Router } from 'express';
import * as handlers from '../handlers/me.handlers.js';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth } from '../middlewares/auth.js';

// Self-service GDPR endpoints (Art. 15/17/20 DSGVO). Distinct from
// /api/users, which is admin-only management of OTHER accounts — every route
// here acts on req.user's own id, so only "signed in" is required, not a role.
const router = Router();

router.use(requireAuth);
router.get('/export', asyncHandler(handlers.exportMe));
router.delete('/', asyncHandler(handlers.deleteMe));

export default router;
