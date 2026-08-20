"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { Plus, Loader2 } from "lucide-react";
import { createUserAction } from "@/app/(authenticated)/settings/users/actions";
import type { UserRole } from "@/lib/role-utils";
import type { Branch } from "@/lib/types";

type RoleOption = { value: UserRole; label: string };

export function UserFormTrigger({
  allowedRoles,
  branches,
  currentUserId,
}: {
  allowedRoles: UserRole[];
  branches: Branch[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const roleOptions: RoleOption[] = allowedRoles.map((r) => ({
    value: r,
    label: r === "owner" ? "Owner" : r === "manager" ? "Sales Manager" : "Sales Representative",
  }));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    const formData = new FormData(e.currentTarget);
    const result = await createUserAction(formData);
    setIsLoading(false);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  function generatePassword() {
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pw = "";
    for (let i = 0; i < 16; i++)
      pw += chars[Math.floor(Math.random() * chars.length)];
    const el = document.getElementById("new-user-password") as HTMLInputElement;
    if (el) el.value = pw;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new team member to the CRM. They will be able to log in
            immediately with the credentials below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-user-name">Full Name</Label>
            <Input
              id="new-user-name"
              name="fullName"
              placeholder="Jane Smith"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-email">Email</Label>
            <Input
              id="new-user-email"
              name="email"
              type="email"
              placeholder="jane@hdsgroup.co.za"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-user-password">Password</Label>
            <div className="flex gap-2">
              <Input
                id="new-user-password"
                name="password"
                type="text"
                minLength={8}
                placeholder="Min 8 characters"
                required
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generatePassword}
              >
                Generate
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select name="role" defaultValue={allowedRoles[0]}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Branch (optional)</Label>
            <Select name="branchId">
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
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
