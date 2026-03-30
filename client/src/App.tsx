import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CasesListPage from "./pages/CasesListPage";
import ImportPage from "./pages/ImportPage";
import RoutePlannerPage from "./pages/RoutePlannerPage";
import SchedulePage from "./pages/SchedulePage";
import MissedCasesPage from "./pages/MissedCasesPage";
import AssessmentPage from "./pages/AssessmentPage";
import { Menu, X, LogOut } from "lucide-react";
import { useAuth } from "./_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

function Router() {
  return (
    <Switch>
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

function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();
  const { logout } = useAuth();

  const menuItems = [
    { label: "首頁", href: "/" },
    { label: "未訪視名單", href: "/cases/unvisited" },
    { label: "已訪視名單", href: "/cases/visited" },
    { label: "訪視未果名單", href: "/cases/missed" },
    { label: "路線規劃", href: "/route-planner" },
    { label: "排程", href: "/schedule" },
    { label: "匯入資料", href: "/import" },
  ];

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
      {/* 背景遮罩 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* 側邊欄 */}
      <div
        className={`fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 z-50 lg:relative lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 關閉按鈕 */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 lg:hidden">
          <h2 className="text-lg font-bold text-slate-100">菜單</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 菜單項目 */}
        <nav className="p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.href}
              onClick={() => handleNavigate(item.href)}
              className="w-full text-left px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
            >
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* 登出按鈕 */}
        <div className="absolute bottom-4 left-4 right-4">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 justify-start gap-2"
          >
            <LogOut className="w-4 h-4" />
            登出
          </Button>
        </div>
      </div>
    </>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <div className="flex h-screen bg-slate-950">
            {/* 側邊欄 */}
            {user && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}

            {/* 主內容區 */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 頂部導航 */}
              {user && (
                <div className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-sm px-4 py-3 flex items-center justify-between lg:hidden">
                  <h1 className="text-lg font-bold text-slate-100">家訪管理系統</h1>
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="text-slate-400 hover:text-slate-100 transition-colors"
                  >
                    <Menu className="w-6 h-6" />
                  </button>
                </div>
              )}

              {/* 頁面內容 */}
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
