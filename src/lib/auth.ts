import { createClient } from "@/lib/supabase/server";
import {
  ROLE_LABELS,
  ROLE_COLORS,
  ROLE_HIERARCHY,
  canCreateRole,
  canManageRole,
} from "@/lib/role-utils";

// Re-export pure utilities so callers can import everything from "@/lib/auth"
// in server components. Client components should import from "@/lib/role-utils"
// directly to avoid pulling in the server-only supabase client.
export {
  ROLE_LABELS,
  ROLE_COLORS,
  ROLE_HIERARCHY,
  canCreateRole,
  canManageRole,
};
export type { UserRole } from "@/lib/role-utils";

import type { UserRole } from "@/lib/role-utils";

export type CurrentUser = {
  id: string;
  email: string;
  role: UserRole;
  fullName: string | null;
  branchId: number | null;
};

/**
 * Returns the currently authenticated user with their role, or null if not
 * signed in. Never throws — callers should handle null by redirecting.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role, full_name, branch_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // If no role row exists yet, treat as sales (least privilege) so the user
  // isn't locked out entirely — an owner can promote them later.
  const role: UserRole = (roleRow?.role as UserRole) ?? "sales";

  return {
    id: user.id,
    email: user.email ?? "",
    role,
    fullName: roleRow?.full_name ?? null,
    branchId: roleRow?.branch_id ?? null,
  };
}

export type RequireRoleResult =
  | { user: CurrentUser; error?: never }
  | { user: null; error: "forbidden" | "unauthenticated" };

/**
 * Server-side guard for restricted pages. Returns the user if they have one
 * of the allowed roles, otherwise returns an error code that the caller can
 * use to redirect.
 *
 * @example
 * const result = await requireRole(["owner"]);
 * if (result.error) redirect("/dashboard?error=access_denied");
 */
export async function requireRole(
  allowedRoles: UserRole[],
): Promise<RequireRoleResult> {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: "unauthenticated" };
  if (!allowedRoles.includes(user.role)) {
    return { user: null, error: "forbidden" };
  }
  return { user };
}
