import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import {
  Zap, LayoutDashboard, Swords, History, Settings,
  LogOut, Menu, X, User, BarChart3, ChevronLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { path: "/dashboard/solver", label: "المهمات", icon: Swords },
  { path: "/dashboard/history", label: "السجل", icon: History },
  { path: "/dashboard/stats", label: "الإحصائيات", icon: BarChart3 },
  { path: "/dashboard/settings", label: "الإعدادات", icon: Settings },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex relative" dir="rtl">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[600px] h-[600px] -top-48 -left-48 rounded-full bg-primary/[0.04] blur-[120px]" />
        <div className="absolute w-[400px] h-[400px] bottom-0 right-0 rounded-full bg-accent/[0.03] blur-[100px]" />
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — Desktop: icon-only expandable | Mobile: full overlay */}
      <motion.aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={cn(
          "fixed top-0 right-0 h-screen z-50 flex flex-col",
          "bg-card/80 backdrop-blur-2xl border-l border-border/40",
          // Desktop
          "hidden lg:flex transition-all duration-300 ease-out",
          expanded ? "w-56" : "w-[68px]"
        )}
      >
        {/* Logo */}
        <div className={cn("h-16 flex items-center gap-2 px-4 border-b border-border/30", expanded ? "justify-start" : "justify-center")}>
          <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="text-sm font-extrabold text-gradient-strong whitespace-nowrap overflow-hidden"
              >
                Alpha Quester
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-xl transition-all duration-200 group relative",
                  expanded ? "px-3 py-2.5" : "justify-center py-2.5",
                  isActive
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <item.icon className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-primary")} />
                <AnimatePresence>
                  {expanded && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-[13px] font-semibold whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-l-full bg-primary"
                  />
                )}
                {/* Tooltip when collapsed */}
                {!expanded && (
                  <div className="absolute right-full mr-2 px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-lg border border-border/30">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-2 border-t border-border/30">
          <div className={cn("flex items-center gap-2 rounded-xl p-2", expanded ? "" : "justify-center")}>
            <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5 text-white" />
            </div>
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex-1 min-w-0 overflow-hidden"
                >
                  <p className="text-xs font-semibold truncate text-foreground">{user?.email?.split("@")[0]}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={handleSignOut}
            className={cn(
              "flex items-center gap-2 w-full rounded-xl py-2 text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all duration-200",
              expanded ? "px-3" : "justify-center"
            )}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {expanded && <span className="text-xs font-medium">خروج</span>}
          </button>
        </div>
      </motion.aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 h-screen w-64 z-50 flex flex-col lg:hidden bg-card/95 backdrop-blur-2xl border-l border-border/40"
          >
            <div className="h-16 flex items-center justify-between px-4 border-b border-border/30">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-extrabold text-gradient-strong">Alpha Quester</span>
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
                    <item.icon className="w-[18px] h-[18px]" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-border/30">
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-white" />
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
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className={cn("flex-1 flex flex-col min-h-screen relative z-10 transition-all duration-300", "lg:mr-[68px]")}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 bg-background/70 backdrop-blur-xl border-b border-border/30 px-4 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground">
            {navItems.find(n => n.path === location.pathname)?.icon && (
              <>
                {(() => {
                  const nav = navItems.find(n => n.path === location.pathname);
                  if (!nav) return null;
                  const Icon = nav.icon;
                  return <Icon className="w-3.5 h-3.5 text-primary" />;
                })()}
                <span className="font-semibold text-foreground text-sm">
                  {navItems.find(n => n.path === location.pathname)?.label}
                </span>
              </>
            )}
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-primary flex items-center justify-center lg:hidden">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6">
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
    </div>
  );
}
