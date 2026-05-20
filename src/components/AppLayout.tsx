import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import DriverChecklistDialog from "@/components/DriverChecklistDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function AppLayout() {
  const { role, signOut } = useAuth();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-card flex items-center justify-between px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <h1 className="font-semibold text-sm text-foreground/80">Operations Console</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">{role?.replace("_"," ")}</Badge>
              {role === "driver" && (
                <Button size="sm" variant="destructive" onClick={signOut}>
                  <LogOut className="h-4 w-4 mr-1" /> Exit
                </Button>
              )}
            </div>
          </header>
          <main className="flex-1 p-6 bg-background">
            <Outlet />
          </main>
          <DriverChecklistDialog />
        </div>
      </div>
    </SidebarProvider>
  );
}
