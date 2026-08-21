"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/role-utils";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/constants";

export function UserNav({
  className,
  userEmail = "",
  userRole = "sales" as UserRole,
  userName = null,
}: {
  className?: string;
  userEmail?: string;
  userRole?: UserRole;
  userName?: string | null;
}) {
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();

  async function handleSignOut() {
    setIsLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsLoading(false);
    router.push("/login");
  }

  const displayName = userName || userEmail;

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
        <User className="h-4 w-4" />
        <span className="max-w-[140px] truncate">{displayName}</span>
        <Badge
          variant="secondary"
          className={cn("text-[10px] px-1.5 py-0", ROLE_COLORS[userRole])}
        >
          {ROLE_LABELS[userRole]}
        </Badge>
      </div>
      {(userRole === "owner" || userRole === "manager") && (
        <Link href="/settings/users">
          <Button
            variant="ghost"
            size="icon"
            aria-label="User Management"
          >
            <Users className="h-5 w-5" />
          </Button>
        </Link>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSignOut}
        disabled={isLoading}
        aria-label="Sign out"
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <LogOut className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}
