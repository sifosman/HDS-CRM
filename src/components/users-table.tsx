"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Ban, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserWithRole, Branch } from "@/lib/types";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/constants";
import { canCreateRole, canManageRole } from "@/lib/role-utils";
import type { UserRole } from "@/lib/role-utils";
import {
  updateUserAction,
  deactivateUserAction,
  reactivateUserAction,
} from "@/app/(authenticated)/settings/users/actions";

export function UsersTable({
  users,
  branches,
  currentUserRole,
  currentUserId,
}: {
  users: UserWithRole[];
  branches: Branch[];
  currentUserRole: UserRole;
  currentUserId: string;
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              branches={branches}
              currentUserRole={currentUserRole}
              currentUserId={currentUserId}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UserRow({
  user,
  branches,
  currentUserRole,
  currentUserId,
}: {
  user: UserWithRole;
  branches: Branch[];
  currentUserRole: UserRole;
  currentUserId: string;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canManage = canManageRole(currentUserRole, user.role);
  const isSelf = user.id === currentUserId;
  const branch = branches.find((b) => b.id === user.branch_id);

  const editableRoles: UserRole[] = (
    ["owner", "manager", "sales"] as UserRole[]
  ).filter((r) => canCreateRole(currentUserRole, r));

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const role = formData.get("role") as UserRole;
    const fullName = (formData.get("fullName") as string)?.trim();
    const branchIdRaw = formData.get("branchId") as string;
    const branchId = branchIdRaw ? Number(branchIdRaw) : null;

    const result = await updateUserAction(user.id, {
      role,
      fullName,
      branchId,
    });
    setIsLoading(false);
    if (result.ok) {
      setEditOpen(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleDeactivate() {
    setIsLoading(true);
    setError(null);
    const result = await deactivateUserAction(user.id);
    setIsLoading(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function handleReactivate() {
    setIsLoading(true);
    setError(null);
    const result = await reactivateUserAction(user.id);
    setIsLoading(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {user.full_name || "—"}
      </TableCell>
      <TableCell className="text-sm">{user.email}</TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={cn(ROLE_COLORS[user.role])}
        >
          {ROLE_LABELS[user.role]}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {branch?.trading_as || "—"}
      </TableCell>
      <TableCell>
        {user.is_active ? (
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
            Active
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
            Deactivated
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {user.created_at
          ? new Date(user.created_at).toLocaleDateString()
          : "—"}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {error && (
            <span className="mr-2 text-xs text-destructive">{error}</span>
          )}
          {isLoading && (
            <Loader2 className="mr-1 h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {canManage && !isSelf && (
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger
                render={
                  <Button variant="ghost" size="icon" aria-label="Edit user">
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Edit {user.full_name || user.email}</DialogTitle>
                  <DialogDescription>
                    Update role, name, or branch assignment.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`edit-name-${user.id}`}>Full Name</Label>
                    <Input
                      id={`edit-name-${user.id}`}
                      name="fullName"
                      defaultValue={user.full_name ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select name="role" defaultValue={user.role}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {editableRoles.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <Select name="branchId" defaultValue={user.branch_id ? String(user.branch_id) : undefined}>
                      <SelectTrigger>
                        <SelectValue placeholder="No branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>
                            {b.trading_as || `Branch #${b.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                      Save Changes
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
          {canManage && !isSelf && user.is_active && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Deactivate user"
              onClick={handleDeactivate}
              disabled={isLoading}
            >
              <Ban className="h-4 w-4" />
            </Button>
          )}
          {canManage && !isSelf && !user.is_active && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Reactivate user"
              onClick={handleReactivate}
              disabled={isLoading}
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
