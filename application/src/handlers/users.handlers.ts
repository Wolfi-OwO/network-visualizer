import type { Request, Response } from 'express'
import { listUsers, setUserRole, deleteUser, isRole, ROLES } from '../services/auth-service.js'
import { BadRequestError } from '../lib/errors.js'
import { withLinks } from '../lib/hateoas.js'

// GET /api/users — list every account (admin only; enforced by the route).
export async function getUsers(_req: Request, res: Response): Promise<void> {
  const users = await listUsers()
  res.json(withLinks({ users, roles: ROLES } as object, { self: { href: '/api/users' } }))
}

// PATCH /api/users/:id — assign a role to an account (admin only).
export async function patchUser(req: Request, res: Response): Promise<void> {
  const { role } = req.body as { role?: string }
  if (!role || !isRole(role)) {
    throw new BadRequestError(`role must be one of: ${ROLES.join(', ')}`)
  }
  const user = await setUserRole(req.params.id, role)
  res.json(withLinks(user as object, { self: { href: `/api/users/${user.id}` } }))
}

// DELETE /api/users/:id — remove an account (admin only).
export async function removeUser(req: Request, res: Response): Promise<void> {
  await deleteUser(req.params.id)
  res.status(204).end()
}
