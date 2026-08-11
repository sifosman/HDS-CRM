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
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Segments", href: "/segments", icon: Filter },
  { title: "Quotes", href: "/quotes", icon: FileText },
  { title: "Payments", href: "/payments", icon: CreditCard },
  { title: "Reports", href: "/reports", icon: BarChart3 },
  { title: "Intelligence", href: "/intelligence", icon: Brain },
  { title: "System Health", href: "/health", icon: HeartPulse },
  { title: "Templates", href: "/templates", icon: MessageSquare },
  { title: "Broadcasts", href: "/broadcasts", icon: Megaphone },
  { title: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

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
