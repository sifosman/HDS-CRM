import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import { getBranches } from "@/lib/queries";
import { getCurrentUser, ROLE_LABELS, ROLE_COLORS } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [branches, user] = await Promise.all([getBranches(), getCurrentUser()]);

  const canManageUsers = user?.role === "owner" || user?.role === "manager";
  const userBranch = branches.find((b) => b.id === user?.branchId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your profile and preferences
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={user?.fullName ?? ""}
                placeholder="Your name"
                readOnly
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={user?.email ?? ""}
                readOnly
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="flex h-9 items-center">
                <Badge
                  variant="secondary"
                  className={cn(user ? ROLE_COLORS[user.role] : "")}
                >
                  {user ? ROLE_LABELS[user.role] : "—"}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Input
                value={userBranch?.trading_as ?? "No branch assigned"}
                readOnly
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Management link */}
      {canManageUsers && (
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Create and manage CRM user accounts, assign roles, and deactivate
              users.
            </p>
            <Link href="/settings/users">
              <Button>
                <Users className="mr-2 h-4 w-4" />
                Manage Users
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "New quotes", desc: "Email when a new quote is generated" },
            { label: "Payments", desc: "Email when a payment is received" },
            { label: "Handovers", desc: "Email when a lead is handed over to human agent" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between border-b pb-3 last:border-0"
            >
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Badge variant="secondary">Enabled</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Weekly Report Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Report Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-email weekly report</p>
              <p className="text-xs text-muted-foreground">
                Send report every week automatically
              </p>
            </div>
            <Badge variant="secondary">Enabled</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Branch Assignment */}
      <Card>
        <CardHeader>
          <CardTitle>Branch Assignment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {branches.map((branch) => (
              <Badge key={branch.id} variant="secondary">
                {branch.trading_as || `Branch #${branch.id}`}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
