import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Verification from "./pages/Verification";
import AdminCodes from "./pages/AdminCodes";
import Dashboard from "./pages/Dashboard";
import QuestSolver from "./pages/QuestSolver";
import QuestHistory from "./pages/QuestHistory";
import StatsPage from "./pages/StatsPage";
import SettingsPage from "./pages/SettingsPage";
import DashboardLayout from "./components/layout/DashboardLayout";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

const ADMIN_EMAILS = ["sf1@sf1.sf1", "uwu@alpha.dcq"];

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }
  if (!user || !ADMIN_EMAILS.includes(user.email || "")) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function PremiumRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("account_type")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setIsPremium(data?.account_type === "premium");
      });
  }, [user]);

  if (loading || (user && isPremium === null)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isPremium) return <Navigate to="/verification" replace />;
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }
  if (user) return <Navigate to="/verification" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/verification" element={<ProtectedRoute><Verification /></ProtectedRoute>} />
            <Route path="/admin/codes" element={<AdminRoute><AdminCodes /></AdminRoute>} />
            <Route path="/dashboard" element={<PremiumRoute><DashboardLayout><Dashboard /></DashboardLayout></PremiumRoute>} />
            <Route path="/dashboard/solver" element={<PremiumRoute><DashboardLayout><QuestSolver /></DashboardLayout></PremiumRoute>} />
            <Route path="/dashboard/history" element={<PremiumRoute><DashboardLayout><QuestHistory /></DashboardLayout></PremiumRoute>} />
            <Route path="/dashboard/stats" element={<PremiumRoute><DashboardLayout><StatsPage /></DashboardLayout></PremiumRoute>} />
            <Route path="/dashboard/settings" element={<PremiumRoute><DashboardLayout><SettingsPage /></DashboardLayout></PremiumRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
