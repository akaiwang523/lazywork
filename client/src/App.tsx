import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import LoginPage from "./pages/LoginPage";
import CasesListPage from "./pages/CasesListPage";
import ImportPage from "./pages/ImportPage";
import RoutePlannerPage from "./pages/RoutePlannerPage";
import SchedulePage from "./pages/SchedulePage";
import MissedCasesPage from "./pages/MissedCasesPage";
import AssessmentPage from "./pages/AssessmentPage";
import {
  Menu,
  X,
  LogOut,
  Home as HomeIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
  FileUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useAuth } from "./_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={LoginPage} />
      <Route path={"/"} component={Home} />
      <Route path={"/import"} component={ImportPage} />
      <Route path={"/cases/unvisited"} component={() => <CasesListPage status="unvisited" />} />
      <Route path={"/cases/visited"} component={() => <CasesListPage status="visited" />} />
      <Route path={"/cases/missed"} component={MissedCasesPage} />
      <Route path={"/route-planner"} component={RoutePlannerPage} />
      <Route path={"/schedule"} component={SchedulePage} />
      <Route path={"/assessment/:caseId"} component={AssessmentPage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

const menuItems = [
  { label: "首頁", href: "/", icon: HomeIcon },
  { label: "未訪視名單", href: "/cases/unvisited", icon: Clock },
  { label: "已訪視名單", href: "/cases/visited", icon: CheckCircle2 },
  { label: "訪視未果名單", href: "/cases/missed", icon: AlertCircle },
  { label: "路線規劃", href: "/route-planner", icon: MapPin },
  { label: "排程", href: "/schedule", icon: Calendar },
  { label: "匯入資料", href: "/import", icon: FileUp },
];

function Sidebar({
  isOpen,
  collapsed,
  onClose,
  onToggleCollapse,
}: {
  isOpen: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}) {
  const [location, navigate] = useLocation();
  const { logout } = useAuth();

  const handleNavigate = (href: string) => {
    navigate(href);
    onClose();
  };

  const handleLogout = async () => {
    try {
      await logout();
      onClose();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <div
        className={`
          fixed left-0 top-0 h-full bg-slate-900 border-r border-slate-800
          transform transition-all duration-300 z-50 flex flex-col
          lg:relative lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${collapsed ? "lg:w-14" : "lg:w-56"}
          w-56
        `}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800 h-14 flex-shrink-0">
          {!collapsed && (
            <span className="text-sm font-medium text-slate-400 truncate">家訪管理系統</span>
          )}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex text-slate-500 hover:text-slate-300 hover:bg-slate-800 p-1 rounded-md transition-colors ml-auto"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <button
                key={item.href}
                onClick={() => handleNavigate(item.href)}
                title={collapsed ? item.label : undefined}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm
                  ${isActive
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }
                  ${collapsed ? "lg:justify-center lg:px-2" : ""}
                `}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-2 border-t border-slate-800 flex-shrink-0">
          <button
            onClick={handleLogout}
            title={collapsed ? "登出" : undefined}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm
              text-slate-500 hover:bg-slate-800 hover:text-slate-300
              ${collapsed ? "lg:justify-center lg:px-2" : ""}
            `}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="font-medium">登出</span>}
          </button>
        </div>
      </div>
    </>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <div className="flex h-screen bg-slate-950">
            {user && (
              <Sidebar
                isOpen={sidebarOpen}
                collapsed={sidebarCollapsed}
                onClose={() => setSidebarOpen(false)}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
            )}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              {user && (
                <div className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-sm px-4 py-3 flex items-center justify-between lg:hidden flex-shrink-0">
                  <h1 className="text-lg font-bold text-slate-100">家訪管理系統</h1>
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="text-slate-400 hover:text-slate-100 transition-colors"
                  >
                    <Menu className="w-6 h-6" />
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-auto">
                <Router />
              </div>
            </div>
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;