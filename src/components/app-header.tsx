"use client";

import { Search, Bell } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserNav } from "@/components/user-nav";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/role-utils";

function getPageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Dashboard";
  const map: Record<string, string> = {
    dashboard: "Dashboard",
    customers: "Customers",
    quotes: "Quotes",
    payments: "Payments",
    reports: "Reports",
    settings: "Settings",
    "william-pricing": "Product Pricing",
    carpenters: "Carpenters",
    "follow-up-surveys": "Follow-up Surveys",
  };
  return map[segments[0]] || segments[0];
}

export function AppHeader({
  userEmail = "",
  userRole = "sales" as UserRole,
  userName = null,
}: {
  userEmail?: string;
  userRole?: UserRole;
  userName?: string | null;
}) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="flex h-14 items-center gap-3 border-b px-4">
      <SidebarTrigger />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>
        <ThemeToggle />
        <UserNav
          userEmail={userEmail}
          userRole={userRole}
          userName={userName}
        />
      </div>
    </header>
  );
}
