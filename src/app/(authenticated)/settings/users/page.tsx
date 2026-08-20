import { redirect } from "next/navigation";
import { requireRole, canCreateRole } from "@/lib/auth";
import { listUsers, getBranches } from "@/lib/queries";
import { UsersTable } from "@/components/users-table";
import { UserFormTrigger } from "@/components/user-form";
import type { UserRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function UserManagementPage() {
  const access = await requireRole(["owner", "manager"]);
  if (access.error) redirect("/dashboard?error=access_denied");
  const currentUser = access.user;

  const [users, branches] = await Promise.all([listUsers(), getBranches()]);

  // Roles the current user is allowed to create
  const allowedRoles: UserRole[] = (
    ["owner", "manager", "sales"] as UserRole[]
  ).filter((r) => canCreateRole(currentUser.role, r));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and manage CRM user accounts and roles
          </p>
        </div>
        <UserFormTrigger
          allowedRoles={allowedRoles}
          branches={branches}
          currentUserId={currentUser.id}
        />
      </div>

      {users.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No users found.
        </div>
      ) : (
        <UsersTable
          users={users}
          branches={branches}
          currentUserRole={currentUser.role}
          currentUserId={currentUser.id}
        />
      )}
    </div>
  );
}
