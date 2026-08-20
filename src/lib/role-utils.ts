/**
 * Pure role utility functions — safe to import from Client Components.
 *
 * These do NOT depend on `next/headers` or the server-only Supabase client,
 * so they can be bundled into the browser without pulling server code in.
 */

export type UserRole = "owner" | "manager" | "sales";

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Owner",
  manager: "Sales Manager",
  sales: "Sales Representative",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  owner:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  manager:
    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  sales:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

// Higher index = higher privilege
export const ROLE_HIERARCHY: UserRole[] = ["sales", "manager", "owner"];

/**
 * Whether a user with `creatorRole` may create/assign the `targetRole`.
 * Owner can create any role, manager can create sales + manager, sales none.
 */
export function canCreateRole(
  creatorRole: UserRole,
  targetRole: UserRole,
): boolean {
  if (creatorRole === "owner") return true;
  if (creatorRole === "manager")
    return targetRole === "sales" || targetRole === "manager";
  return false;
}

/**
 * Whether a user with `actorRole` may edit/deactivate a user with `targetRole`.
 * Owner can manage anyone. Manager can manage sales and other managers but
 * not owners. Sales cannot manage anyone.
 */
export function canManageRole(
  actorRole: UserRole,
  targetRole: UserRole,
): boolean {
  if (actorRole === "owner") return true;
  if (actorRole === "manager")
    return targetRole === "sales" || targetRole === "manager";
  return false;
}
