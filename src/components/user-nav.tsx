"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function UserNav({ className }: { className?: string }) {
  const [user, setUser] = React.useState<{ email?: string } | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data, error }) => {
      if (!error && data.session?.user) {
        setUser(data.session.user);
      }
    });
  }, []);

  async function handleSignOut() {
    setIsLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setIsLoading(false);
    router.push("/login");
  }

  if (!user) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
        <User className="h-4 w-4" />
        <span className="max-w-[160px] truncate">{user.email}</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSignOut}
        disabled={isLoading}
        aria-label="Sign out"
      >
        <LogOut className="h-5 w-5" />
      </Button>
    </div>
  );
}
