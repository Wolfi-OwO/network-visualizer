import type { Request, Response } from 'express';
import { getUserById, eraseUserAndOwnedData } from '../services/auth-service.js';
import { getAllTopologies } from '../db/network-service.js';
import { AuditModel } from '../db/models/audit.model.js';
import { SESSION_COOKIE } from '../lib/jwt.js';
import { NotFoundError, UnauthorizedError } from '../lib/errors.js';

// GET /api/me/export — everything this account holds, as a downloadable JSON
// file (Art. 15/20 DSGVO). Audit entries are included but never deleted by
// the endpoint below: PRIVACY.md documents a 90-day retention window for
// them, already enforced by the TTL index on AuditModel.
export async function exportMe(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError('Not signed in');
  const userId = req.user.id;

  const profile = await getUserById(userId);
  if (!profile) throw new NotFoundError('User not found');

  const [topologies, auditEntries] = await Promise.all([
    getAllTopologies(userId),
    AuditModel.find({ userId }).sort({ at: -1 }).lean(),
  ]);

  res.setHeader('Content-Disposition', 'attachment; filename=user_data_export.json');
  res.status(200).json({
    exportedAt: new Date().toISOString(),
    profile,
    networks: topologies,
    auditLog: auditEntries.map((entry) => ({
      action: entry.action,
      method: entry.method,
      path: entry.path,
      status: entry.status,
      at: new Date(entry.at as number).toISOString(),
    })),
  });
}

// DELETE /api/me — permanently remove this account and everything it owns
// (Art. 17 DSGVO). Refuses if this is the last admin (see auth-service's
// deleteUser) so the request 400s rather than locking the instance out.
// The erasure sequence itself (ordering, audit-entry policy) lives in
// auth-service's eraseUserAndOwnedData — shared with the admin-initiated
// deletion path (`DELETE /api/users/:id`) so both stay in sync.
export async function deleteMe(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new UnauthorizedError('Not signed in');
  const userId = req.user.id;

  await eraseUserAndOwnedData(userId);

  // Stateless JWT session: there is no server-side row to revoke, only the
  // cookie to stop honouring. OAuth access/refresh tokens are never persisted
  // (see auth-service.ts — only email/name/provider survive the OAuth
  // exchange), so there is nothing else to clear here.
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.status(204).end();
}
