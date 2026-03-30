import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileUp, List, CheckCircle2, MapPin, Clock, ChevronRight, Calendar } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

export default function Home() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // 獲取訪視統計
  const { data: stats } = trpc.cases.statistics.useQuery();

  // 獲取今日待訪個案
  const { data: todaysCases = [] } = trpc.cases.todaysCases.useQuery();

  // 獲取明日待訪個案
  const { data: tomorrowsCases = [] } = trpc.cases.tomorrowsCases.useQuery();

  // 更新訪視狀態
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-300 mb-4">請登入以繼續</p>
        </div>
      </div>
    );
  }

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* 頂部問候 */}
      <div className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-slate-100">
            Hello, {user?.name || "家訪員"}
          </h1>
        </div>
      </div>

      {/* 主容器 */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 今日日程表 與 明日日程表 - 上下排列 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 今日日程表 */}
          <Card className="bg-slate-900/50 border-slate-800 p-6 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-100">
                今日日程 ({todayStr})
              </h2>
              <Badge variant="default" className="bg-blue-600 text-blue-50">
                {todaysCases.length} 筆
              </Badge>
            </div>

            {todaysCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="w-12 h-12 text-slate-600 mb-3" />
                <p className="text-slate-400">今日沒有待訪個案</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto min-w-0">
                {todaysCases.map((caseItem) => (
                  <div
                    key={caseItem.id}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 hover:bg-slate-800 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="font-semibold text-slate-100 text-sm group-hover:text-blue-300 transition-colors">
                          {caseItem.clientName}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {caseItem.district}
                        </p>
                        {caseItem.address && (
                          <p className="text-xs text-slate-400 break-words">
                            {caseItem.address}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500 pt-1">
                          {caseItem.phone && <span>{caseItem.phone}</span>}
                          {caseItem.mobile && <span>{caseItem.mobile}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(caseItem.id, "visited");
                          }}
                          disabled={updateStatusMutation.isPending}
                          className="bg-amber-700 hover:bg-amber-800 whitespace-nowrap"
                        >
                          {updateStatusMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "已完成"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/assessment/${caseItem.id}`);
                          }}
                          className="whitespace-nowrap"
                        >
                          紀錄
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 明日日程表 */}
          <Card className="bg-slate-900/50 border-slate-800 p-6 min-w-0">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-100">
                明日日程 ({tomorrowStr})
              </h2>
              <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                {tomorrowsCases.length}
              </Badge>
            </div>

            {tomorrowsCases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="w-12 h-12 text-slate-600 mb-3" />
                <p className="text-slate-400">無待訪個案</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto min-w-0">
                {tomorrowsCases.map((caseItem) => (
                  <div
                    key={caseItem.id}
                    className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 hover:bg-slate-800 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="font-semibold text-slate-100 text-sm group-hover:text-emerald-300 transition-colors">
                          {caseItem.clientName}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {caseItem.district}
                        </p>
                        {caseItem.address && (
                          <p className="text-xs text-slate-400 break-words">
                            {caseItem.address}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500 pt-1">
                          {caseItem.phone && <span>{caseItem.phone}</span>}
                          {caseItem.mobile && <span>{caseItem.mobile}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(caseItem.id, "visited");
                          }}
                          disabled={updateStatusMutation.isPending}
                          className="bg-amber-700 hover:bg-amber-800 whitespace-nowrap"
                        >
                          {updateStatusMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "已完成"
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/assessment/${caseItem.id}`);
                          }}
                          className="whitespace-nowrap"
                        >
                          紀錄
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* 統計卡片 - 左右並列 */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* 未訪視統計 */}
          <Card className="bg-transparent border-slate-700 p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium mb-2">未訪視</p>
                <p className="text-4xl font-bold text-white">{stats?.unvisited || 0}</p>
              </div>
            </div>
          </Card>

          {/* 已訪視統計 */}
          <Card className="bg-transparent border-slate-700 p-6 hover:border-slate-600 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium mb-2">已訪視</p>
                <p className="text-4xl font-bold text-white">{stats?.visited || 0}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
