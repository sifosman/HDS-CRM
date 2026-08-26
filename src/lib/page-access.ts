import type { UserRole } from "@/lib/auth";

/**
 * Centralised page access configuration.
 *
 * Keys are route prefixes (matched with `startsWith` against the pathname).
 * The first matching entry wins, so order more specific routes first.
 *
 * Routes not listed here default to all roles (e.g. /dashboard, /customers).
 */
export const PAGE_ACCESS: { path: string; roles: UserRole[] }[] = [
  // Most specific first
  { path: "/reports/ai-performance", roles: ["owner", "manager"] },
  { path: "/reports", roles: ["owner", "manager"] },
  { path: "/segments", roles: ["owner", "manager"] },
  { path: "/intelligence", roles: ["owner", "manager"] },
  { path: "/templates", roles: ["owner", "manager"] },
  { path: "/broadcasts", roles: ["owner", "manager"] },
  { path: "/health", roles: ["owner"] },
  { path: "/ai-training", roles: ["owner", "manager"] },
  { path: "/settings/users", roles: ["owner", "manager"] },
  // /settings (profile) is accessible to all roles — no entry needed.
];

/**
 * Returns the set of roles allowed to access `pathname`, or null if the path
 * has no restriction (i.e. all authenticated users may access it).
 */
export function getAllowedRoles(pathname: string): UserRole[] | null {
  for (const entry of PAGE_ACCESS) {
    if (pathname === entry.path || pathname.startsWith(entry.path + "/")) {
      return entry.roles;
    }
  }
  return null;
}
