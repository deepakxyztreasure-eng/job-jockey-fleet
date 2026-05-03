import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Briefcase, Users, MapPin, ShieldCheck, Truck, Bell, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { role, signOut, user } = useAuth();

  const adminItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Jobs", url: "/jobs", icon: Briefcase },
    { title: "Drivers", url: "/drivers", icon: Users },
    { title: "Store Locations", url: "/locations", icon: MapPin },
    { title: "Users & Roles", url: "/users", icon: ShieldCheck },
    { title: "Notifications", url: "/notifications", icon: Bell },
  ];
  const memberItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Jobs", url: "/jobs", icon: Briefcase },
    { title: "Notifications", url: "/notifications", icon: Bell },
  ];
  const driverItems = [
    { title: "My Jobs", url: "/", icon: Briefcase },
    { title: "Notifications", url: "/notifications", icon: Bell },
  ];

  const items = role === "super_admin" ? adminItems : role === "driver" ? driverItems : memberItems;
  const isActive = (p: string) => pathname === p;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Truck className="h-4 w-4 text-accent-foreground" />
          </div>
          {!collapsed && <span className="font-semibold text-white">Dispatch OS</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{!collapsed && "Workspace"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={isActive(it.url)}>
                    <NavLink to={it.url} className="flex items-center gap-3">
                      <it.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{it.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed && (
          <div className="text-xs text-sidebar-foreground/70 mb-2 px-1 truncate">
            {user?.email}<br/>
            <span className="uppercase tracking-wide">{role?.replace("_"," ")}</span>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground hover:text-white hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4 mr-2" />{!collapsed && "Sign out"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
