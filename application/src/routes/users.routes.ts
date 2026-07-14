import { Router } from 'express';
import * as handlers from '../handlers/users.handlers.js';
import { asyncHandler } from '../lib/errors.js';
import { requireRole } from '../middlewares/auth.js';

// Account & role administration. Every endpoint is admin-only — like the
// "Users & roles" section of a Google Workspace / Microsoft 365 admin console.
const router = Router();

router.use(requireRole('admin'));
router.get('/', asyncHandler(handlers.getUsers));
router.patch('/:id', asyncHandler(handlers.patchUser));
router.delete('/:id', asyncHandler(handlers.removeUser));

export default router;
