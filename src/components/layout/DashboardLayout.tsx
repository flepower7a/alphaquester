import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import {
  Zap, LayoutDashboard, History, Settings,
  LogOut, Menu, X, User, BarChart3, Award, Bell
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { path: "/dashboard/badges", label: "الشارات", icon: Award, customIcon: "/emojis/boost_level_9.png" },
  { path: "/dashboard/history", label: "السجل", icon: History },
  { path: "/dashboard/stats", label: "الإحصائيات", icon: BarChart3 },
  { path: "/dashboard/update/me", label: "Update Me", icon: Bell },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col relative" dir="rtl">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[500px] h-[500px] -top-48 right-1/4 rounded-full bg-primary/[0.04] blur-[120px]" />
        <div className="absolute w-[400px] h-[400px] bottom-0 left-1/4 rounded-full bg-accent/[0.03] blur-[100px]" />
      </div>

      {/* ─── Top Navbar ─── */}
      <header className="sticky top-0 z-50 bg-card/60 backdrop-blur-2xl border-b border-border/30">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-extrabold text-foreground/90 hidden sm:inline">Alpha Quester</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 flex-1 mr-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  {item.customIcon ? (
                    <img src={item.customIcon} alt="" className="w-4 h-4" />
                  ) : (
                    <item.icon className="w-4 h-4" />
                  )}
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/15"
                      style={{ zIndex: -1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1 lg:flex-none" />

          <div className="hidden lg:flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted/30">
              <div className="w-6 h-6 rounded-md bg-gradient-primary flex items-center justify-center">
                <User className="w-3 h-3 text-primary-foreground" />
              </div>
              <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">{user?.email?.split("@")[0]}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              خروج
            </button>
          </div>

          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ─── Mobile Overlay ─── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-0 right-0 h-screen w-64 z-50 flex flex-col lg:hidden bg-card/95 backdrop-blur-2xl border-l border-border/40"
            >
              <div className="h-14 flex items-center justify-between px-4 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary-foreground" />
                  </div>
                  <span className="text-sm font-extrabold text-foreground/90">Alpha Quester</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 py-4 px-3 space-y-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all",
                        isActive
                          ? "bg-primary/12 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      )}
                    >
                      {item.customIcon ? (
                        <img src={item.customIcon} alt="" className="w-[18px] h-[18px]" />
                      ) : (
                        <item.icon className="w-[18px] h-[18px]" />
                      )}
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="p-3 border-t border-border/30">
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{user?.email?.split("@")[0]}</p>
                  </div>
                </div>
                <button onClick={handleSignOut}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all">
                  <LogOut className="w-4 h-4" />خروج
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ─── Page Content ─── */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 relative z-10">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
