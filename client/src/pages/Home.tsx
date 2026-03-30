import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Clock,
  CheckCircle2,
  Users,
  TrendingUp,
  MapPin,
  Calendar,
  FileUp,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

export default function Home() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: stats } = trpc.cases.statistics.useQuery();
  const { data: todaysCases = [] } = trpc.cases.todaysCases.useQuery();
  const { data: tomorrowsCases = [] } = trpc.cases.tomorrowsCases.useQuery();

  const updateStatusMutation = trpc.cases.updateVisitStatus.useMutation({
    onSuccess: () => {
      utils.cases.todaysCases.invalidate();
      utils.cases.tomorrowsCases.invalidate();
      utils.cases.statistics.invalidate();
    },
  });

  const handleStatusChange = (caseId: number, newStatus: "visited" | "unvisited") => {
    updateStatusMutation.mutate({ caseId, status: newStatus });
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");
  const todayLabel = format(new Date(), "M月d日 EEEE", { locale: zhTW });

  const total = (stats?.visited ?? 0) + (stats?.unvisited ?? 0);
  const visitedCount = stats?.visited ?? 0;
  const unvisitedCount = stats?.unvisited ?? 0;
  const progressPct = total > 0 ? Math.round((visitedCount / total) * 100) : 0;

  const quickActions = [
    { label: "未訪視名單", href: "/cases/unvisited", icon: Clock, color: "text-amber-400" },
    { label: "已訪視名單", href: "/cases/visited", icon: CheckCircle2, color: "text-emerald-400" },
    { label: "路線規劃", href: "/route-planner", icon: MapPin, color: "text-blue-400" },
    { label: "排程", href: "/schedule", icon: Calendar, color: "text-purple-400" },
    { label: "匯入資料", href: "/import", icon: FileUp, color: "text-slate-400" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* 頂部問候 */}
      <div className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            Hello, {user?.name || "家訪員"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{todayLabel}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* 統計卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-slate-900/50 border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-blue-400" />
              <p className="text-xs text-slate-400 font-medium">總個案數</p>
            </div>
            <p className="text-3xl font-bold text-blue-400">{total}</p>
          </Card>
          <Card className="bg-slate-900/50 border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-slate-400 font-medium">未訪視</p>
            </div>
            <p className="text-3xl font-bold text-amber-400">{unvisitedCount}</p>
          </Card>
          <Card className="bg-slate-900/50 border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-slate-400 font-medium">已訪視</p>
            </div>
            <p className="text-3xl font-bold text-emerald-400">{visitedCount}</p>
          </Card>
          <Card className="bg-slate-900/50 border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <p className="text-xs text-slate-400 font-medium">完成率</p>
            </div>
            <p className="text-3xl font-bold text-purple-400">{progressPct}%</p>
          </Card>
        </div>

        {/* 進度條 */}
        <Card className="bg-slate-900/50 border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-300">本月訪視進度</p>
            <span className="text-xs text-slate-500">{visitedCount} / {total}</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-slate-600">0%</span>
            <span className="text-xs text-slate-600">100%</span>
          </div>
        </Card>

        {/* 今日 / 明日日程 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 今日日程 */}
          <Card className="bg-slate-900/50 border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-100">今日日程 ({todayStr})</h2>
              <Badge variant="default" className="bg-blue-600 text-blue-50 text-xs">
                {todaysCases.length} 筆
              </Badge>
            </div>
            {todaysCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Clock className="w-10 h-10 text-slate-700 mb-2" />
                <p className="text-slate-500 text-sm">今日沒有待訪個案</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {todaysCases.map((caseItem) => (
                  <CaseCard
                    key={caseItem.id}
                    caseItem={caseItem}
                    onComplete={() => handleStatusChange(caseItem.id, "visited")}
                    onRecord={() => navigate(`/assessment/${caseItem.id}`)}
                    isPending={updateStatusMutation.isPending}
                    accentColor="blue"
                  />
                ))}
              </div>
            )}
          </Card>

          {/* 明日日程 */}
          <Card className="bg-slate-900/50 border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-100">明日日程 ({tomorrowStr})</h2>
              <Badge variant="secondary" className="bg-slate-800 text-slate-400 text-xs">
                {tomorrowsCases.length}
              </Badge>
            </div>
            {tomorrowsCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Clock className="w-10 h-10 text-slate-700 mb-2" />
                <p className="text-slate-500 text-sm">無待訪個案</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {tomorrowsCases.map((caseItem) => (
                  <CaseCard
                    key={caseItem.id}
                    caseItem={caseItem}
                    onComplete={() => handleStatusChange(caseItem.id, "visited")}
                    onRecord={() => navigate(`/assessment/${caseItem.id}`)}
                    isPending={updateStatusMutation.isPending}
                    accentColor="emerald"
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* 快速操作 */}
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">快速操作</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.href}
                  onClick={() => navigate(action.href)}
                  className="flex items-center justify-between gap-2 bg-slate-900/50 border border-slate-800 hover:border-slate-600 hover:bg-slate-800/50 rounded-lg px-3 py-3 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 flex-shrink-0 ${action.color}`} />
                    <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors font-medium">
                      {action.label}
                    </span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

// 個案卡片元件
function CaseCard({
  caseItem,
  onComplete,
  onRecord,
  isPending,
  accentColor,
}: {
  caseItem: {
    id: number;
    clientName: string;
    district: string;
    address?: string | null;
    phone?: string | null;
    mobile?: string | null;
  };
  onComplete: () => void;
  onRecord: () => void;
  isPending: boolean;
  accentColor: "blue" | "emerald";
}) {
  const hoverColor = accentColor === "blue" ? "group-hover:text-blue-300" : "group-hover:text-emerald-300";
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 hover:bg-slate-800 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-0.5">
          <h3 className={`font-semibold text-slate-100 text-sm transition-colors ${hoverColor}`}>
            {caseItem.clientName}
          </h3>
          <p className="text-xs text-slate-400">{caseItem.district}</p>
          {caseItem.address && (
            <p className="text-xs text-slate-500 break-words">{caseItem.address}</p>
          )}
          <div className="flex flex-wrap gap-2 text-xs text-slate-500 pt-0.5">
            {caseItem.phone && <span>{caseItem.phone}</span>}
            {caseItem.mobile && <span>{caseItem.mobile}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onComplete(); }}
            disabled={isPending}
            className="bg-amber-700 hover:bg-amber-800 whitespace-nowrap text-xs h-7 px-2"
          >
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "已完成"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => { e.stopPropagation(); onRecord(); }}
            className="whitespace-nowrap text-xs h-7 px-2"
          >
            紀錄
          </Button>
        </div>
      </div>
    </div>
  );
}