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

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Segments", href: "/segments", icon: Filter },
  { title: "Quotes", href: "/quotes", icon: FileText },
  { title: "Payments", href: "/payments", icon: CreditCard },
  { title: "Intelligence", href: "/intelligence", icon: Brain },
  { title: "System Health", href: "/health", icon: HeartPulse },
  { title: "Templates", href: "/templates", icon: MessageSquare },
  { title: "Broadcasts", href: "/broadcasts", icon: Megaphone },
  { title: "Settings", href: "/settings", icon: Settings },
];

const reportSubItems = [
  { title: "Weekly Reports", href: "/reports", icon: BarChart3 },
  { title: "AI Performance", href: "/reports/ai-performance", icon: Bot },
];

export function AppSidebar() {
  const pathname = usePathname();
  const reportsActive = pathname.startsWith("/reports");

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
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
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

              {/* Reports — collapsible sub-menu */}
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
                    {reportSubItems.map((sub) => {
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
