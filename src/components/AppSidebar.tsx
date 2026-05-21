import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, Briefcase, Users, MapPin, ShieldCheck, Truck, Bell, LogOut, UserCog, Tag, ClipboardList } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import logo from "@/assets/jodha/logo.jpg";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { role, signOut, user } = useAuth();

  const adminItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Jobs", url: "/jobs", icon: Briefcase },
    { title: "Drivers", url: "/drivers", icon: Users },
    { title: "Store Locations", url: "/locations", icon: MapPin },
    { title: "Job Titles", url: "/job-titles", icon: Tag },
    { title: "Users & Roles", url: "/users", icon: ShieldCheck },
    { title: "Driver Checkout Logs", url: "/checkout-logs", icon: ClipboardList },
    { title: "Admin", url: "/admin", icon: UserCog },
    { title: "Notifications", url: "/notifications", icon: Bell },
  ];
  const memberItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "Jobs", url: "/jobs", icon: Briefcase },
    { title: "Notifications", url: "/notifications", icon: Bell },
  ];
  const driverItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
    { title: "My Jobs", url: "/jobs", icon: Briefcase },
    { title: "Notifications", url: "/notifications", icon: Bell },
  ];

  const items = role === "super_admin" ? adminItems : role === "driver" ? driverItems : memberItems;
  const isActive = (p: string) => pathname === p;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Jodha" className="h-8 w-8 rounded-md bg-white p-0.5 object-contain shrink-0" />
          {!collapsed && <span className="font-semibold text-white">Jodha Group</span>}
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
          <LogOut className="h-4 w-4 mr-2" />{!collapsed && "Logout"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
