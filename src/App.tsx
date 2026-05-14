import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Jobs from "@/pages/Jobs";
import Drivers from "@/pages/Drivers";
import StoreLocations from "@/pages/StoreLocations";
import Users from "@/pages/Users";
import Admin from "@/pages/Admin";
import Notifications from "@/pages/Notifications";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/drivers" element={<ProtectedRoute roles={["super_admin"]}><Drivers /></ProtectedRoute>} />
              <Route path="/locations" element={<StoreLocations />} />
              <Route path="/users" element={<ProtectedRoute roles={["super_admin"]}><Users /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute roles={["super_admin"]}><Admin /></ProtectedRoute>} />
              <Route path="/notifications" element={<Notifications />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
