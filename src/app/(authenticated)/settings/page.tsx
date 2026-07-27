import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getBranches } from "@/lib/queries";

export default async function SettingsPage() {
  const branches = await getBranches();

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
              <Input id="name" placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@hdsgroup.co.za" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select defaultValue="admin">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Sales Manager</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

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
          <div className="space-y-2">
            <Label>Day of week</Label>
            <Select defaultValue="mon">
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mon">Monday</SelectItem>
                <SelectItem value="tue">Tuesday</SelectItem>
                <SelectItem value="wed">Wednesday</SelectItem>
                <SelectItem value="thu">Thursday</SelectItem>
                <SelectItem value="fri">Friday</SelectItem>
              </SelectContent>
            </Select>
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
