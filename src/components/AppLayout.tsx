import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import DriverChecklistDialog from "@/components/DriverChecklistDialog";
import PushToggle from "@/components/PushToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function AppLayout() {
  const { role, driverExit } = useAuth();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="min-h-14 pt-safe pl-safe pr-safe border-b bg-card flex items-center justify-between px-3 sm:px-4 sticky top-0 z-30">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <SidebarTrigger />
              <h1 className="font-semibold text-sm text-foreground/80 truncate hidden sm:block">Operations Console</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize text-[10px] sm:text-xs">{role?.replace("_"," ")}</Badge>
              <PushToggle />
              {role === "driver" && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm("End your working day? This will close your session and notify the admin.")) {
                      driverExit();
                    }
                  }}
                >
                  <LogOut className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Exit</span>
                </Button>
              )}
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-6 bg-background">
            <Outlet />
          </main>
          <DriverChecklistDialog />
        </div>
      </div>
    </SidebarProvider>
  );
}
