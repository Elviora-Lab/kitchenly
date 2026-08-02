import 'server-only';

import type { AccessClaims } from '@/server/auth/tokens';

/**
 * Capability-based RBAC.
 *
 * Roles map to a set of action strings (`resource:verb`). To check, call
 * `can(session, 'orders:read:any')`. Add new capabilities by name only —
 * never branch on `role === 'ADMIN'` in business code.
 */
export type Ability = string;

const ROLE_ABILITIES: Record<AccessClaims['role'], readonly Ability[]> = {
  CUSTOMER: [
    'profile:read:self',
    'profile:write:self',
    'orders:read:self',
    'orders:create',
    'cart:read:self',
    'cart:write:self',
    'reviews:create',
    'wishlist:write:self',
  ],
  VIP: [
    'profile:read:self',
    'profile:write:self',
    'orders:read:self',
    'orders:create',
    'cart:read:self',
    'cart:write:self',
    'reviews:create',
    'wishlist:write:self',
    'loyalty:redeem',
  ],
  STAFF: [
    'orders:read:any',
    'orders:write:any',
    'shipments:write:any',
    'reviews:moderate',
    'customers:read:any',
    // Warehouse work: count stock, correct it, and book in deliveries — but
    // not commit the company to spend by raising or approving an order.
    'inventory:read',
    'inventory:adjust',
    'purchasing:read',
    'purchasing:receive',
  ],
  ADMIN: ['*'],
  SUPER_ADMIN: ['*'],
};

export function can(session: AccessClaims | null, ability: Ability): boolean {
  if (!session) return false;
  const abilities = ROLE_ABILITIES[session.role] ?? [];
  return abilities.includes('*') || abilities.includes(ability);
}

/**
 * Abilities that exist but belong to no role below ADMIN. Listed so the set of
 * capabilities is discoverable in one place rather than only where it's
 * checked: raising and approving purchase orders, and managing suppliers.
 */
export const ADMIN_ONLY_ABILITIES = [
  'inventory:configure',
  'purchasing:write',
  'suppliers:write',
] as const satisfies readonly Ability[];
