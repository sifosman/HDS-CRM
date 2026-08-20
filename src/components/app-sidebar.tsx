"use client";

import {
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  Brain,
  HeartPulse,
  MessageSquare,
  Megaphone,
  Filter,
  Bot,
  ChevronRight,
  UserCog,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { UserRole } from "@/lib/role-utils";

type NavItem = {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
};

const allNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["owner", "manager", "sales"] },
  { title: "Customers", href: "/customers", icon: Users, roles: ["owner", "manager", "sales"] },
  { title: "Segments", href: "/segments", icon: Filter, roles: ["owner", "manager"] },
  { title: "Quotes", href: "/quotes", icon: FileText, roles: ["owner", "manager", "sales"] },
  { title: "Payments", href: "/payments", icon: CreditCard, roles: ["owner", "manager", "sales"] },
  { title: "Intelligence", href: "/intelligence", icon: Brain, roles: ["owner", "manager"] },
  { title: "System Health", href: "/health", icon: HeartPulse, roles: ["owner"] },
  { title: "Templates", href: "/templates", icon: MessageSquare, roles: ["owner", "manager"] },
  { title: "Broadcasts", href: "/broadcasts", icon: Megaphone, roles: ["owner", "manager"] },
  { title: "Settings", href: "/settings", icon: Settings, roles: ["owner", "manager", "sales"] },
  { title: "User Management", href: "/settings/users", icon: UserCog, roles: ["owner", "manager"] },
];

const reportSubItems: NavItem[] = [
  { title: "Weekly Reports", href: "/reports", icon: BarChart3, roles: ["owner", "manager"] },
  { title: "AI Performance", href: "/reports/ai-performance", icon: Bot, roles: ["owner", "manager"] },
];

export function AppSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const reportsActive = pathname.startsWith("/reports");

  const navItems = allNavItems.filter((item) => item.roles.includes(role));
  const visibleReportSubItems = reportSubItems.filter((item) =>
    item.roles.includes(role),
  );
  const showReports = visibleReportSubItems.length > 0;

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center justify-center px-2 py-3">
          <Image
            src="/hds-logo.webp"
            alt="HDS Group"
            width={120}
            height={120}
            className="w-full max-w-[140px] h-auto"
            priority
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    item.href !== "/settings" &&
                    pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={
                        <Link href={item.href}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                );
              })}

              {/* Reports — collapsible sub-menu (only if user has access) */}
              {showReports && (
                <Collapsible defaultOpen={reportsActive}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger
                      render={
                        <SidebarMenuButton isActive={reportsActive}>
                          <BarChart3 className="h-4 w-4" />
                          <span>Reports</span>
                          <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[panel-open]/menu-button:rotate-90" />
                        </SidebarMenuButton>
                      }
                    />
                  </SidebarMenuItem>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {visibleReportSubItems.map((sub) => {
                        const subActive = pathname === sub.href;
                        return (
                          <SidebarMenuSubItem key={sub.href}>
                            <SidebarMenuSubButton
                              isActive={subActive}
                              render={
                                <Link href={sub.href}>
                                  <sub.icon className="h-4 w-4" />
                                  <span>{sub.title}</span>
                                </Link>
                              }
                            />
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-2 py-2">
          <SidebarTrigger />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
