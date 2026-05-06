import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import DriverChecklistDialog from "@/components/DriverChecklistDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

export default function AppLayout() {
  const { role } = useAuth();
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
            <Badge variant="secondary" className="capitalize">{role?.replace("_"," ")}</Badge>
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
