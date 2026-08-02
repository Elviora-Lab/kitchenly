import 'server-only';

import { getSession } from './get-session';
import { type AccessClaims } from './tokens';

import { ForbiddenError, UnauthorizedError } from '@/server/http/errors';
import { type Ability, can } from '@/server/permissions/abilities';

/**
 * Require an authenticated session. Throws 401 otherwise.
 * Pass `request` from Route Handlers, omit from RSC / Server Actions.
 */
export async function requireUser(request?: Request): Promise<AccessClaims> {
  const session = await getSession(request);
  if (!session) throw new UnauthorizedError();
  return session;
}

const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'STAFF']);

export async function requireAdmin(request?: Request): Promise<AccessClaims> {
  const session = await requireUser(request);
  if (!ADMIN_ROLES.has(session.role)) throw new ForbiddenError();
  return session;
}

export async function requireRole(
  roles: ReadonlyArray<AccessClaims['role']>,
  request?: Request,
): Promise<AccessClaims> {
  const session = await requireUser(request);
  if (!roles.includes(session.role)) throw new ForbiddenError();
  return session;
}

/**
 * Require a named capability rather than a role — see `abilities.ts`.
 *
 * Prefer this to `requireAdmin` for anything where STAFF and ADMIN should
 * differ. `requireAdmin` lumps STAFF, ADMIN and SUPER_ADMIN together, which is
 * too coarse for work that commits money.
 */
export async function requireAbility(ability: Ability, request?: Request): Promise<AccessClaims> {
  const session = await requireUser(request);
  if (!can(session, ability)) throw new ForbiddenError();
  return session;
}
