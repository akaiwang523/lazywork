import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Phone, MapPin, CheckCircle2, Clock, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";

interface CasesListPageProps {
  status: "unvisited" | "visited";
}

export default function CasesListPage({ status }: CasesListPageProps) {
  const [, navigate] = useLocation();
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");

  // 獲取所有鄉鎮區
  const { data: districts = [] } = trpc.cases.districts.useQuery();

  // 獲取個案列表
  const { data: cases = [], isLoading, refetch } = trpc.cases.list.useQuery({
    status,
    district: selectedDistrict || undefined,
  });

  // 更新訪視狀態
  const updateStatusMutation = trpc.cases.updateVisitStatus.useMutation({
    onSuccess: () => {
      toast.success("狀態已更新");
      refetch();
    },
    onError: () => {
      toast.error("更新失敗");
    },
  });

  // 更新訪視日期
  const updateDateMutation = trpc.cases.updateScheduledDate.useMutation({
    onSuccess: () => {
      toast.success("訪視日期已更新");
      setEditingCaseId(null);
      setSelectedDate("");
      refetch();
    },
    onError: () => {
      toast.error("更新失敗");
    },
  });

  // 搜尋過濾
  const filteredCases = useMemo(() => {
    return cases.filter(c =>
      c.clientName.includes(searchTerm) ||
      c.contractNumber.includes(searchTerm) ||
      c.address.includes(searchTerm)
    );
  }, [cases, searchTerm]);

  const handleStatusChange = (caseId: number, newStatus: "unvisited" | "visited") => {
    updateStatusMutation.mutate({
      caseId,
      status: newStatus,
    });
  };

  const handleDateUpdate = (caseId: number) => {
    if (!selectedDate) {
      toast.error("請選擇日期");
      return;
    }
    updateDateMutation.mutate({
      caseId,
      scheduledDate: new Date(selectedDate),
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="max-w-6xl mx-auto">
        {/* 標題 */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            {status === "unvisited" ? "未訪視名單" : "已訪視名單"}
          </h1>
          <p className="text-slate-400">
            {filteredCases.length} 筆個案
          </p>
        </div>

        {/* 篩選區 */}
        <Card className="bg-slate-900/50 border-slate-800 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                鄉鎮區
              </label>
              <Select value={selectedDistrict || "all"} onValueChange={(value) => setSelectedDistrict(value === "all" ? null : value)}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                  <SelectValue placeholder="全部鄉鎮區" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">全部鄉鎮區</SelectItem>
                  {districts.map(district => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                搜尋
              </label>
              <Input
                placeholder="搜尋姓名、成約單號或地址"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
              />
            </div>
          </div>
        </Card>

        {/* 個案列表 */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : filteredCases.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-800 p-8 text-center">
            <p className="text-slate-400">沒有符合條件的個案</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCases.map(caseItem => (
              <Card key={caseItem.id} className="bg-slate-900/50 border-slate-800 p-4 hover:border-slate-700 transition-colors">
                <div className="space-y-3">
                  {/* 第一行：姓名和狀態 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-100">
                      {caseItem.clientName}
                    </h3>
                    <Badge variant={status === "visited" ? "default" : "secondary"} className={status === "visited" ? "bg-emerald-600" : "bg-amber-600"}>
                      {status === "visited" ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          已訪視
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 mr-1" />
                          未訪視
                        </>
                      )}
                    </Badge>
                  </div>

                  {/* 第二行：成約單號 */}
                  <p className="text-sm text-slate-400">
                    成約單號：{caseItem.contractNumber}
                  </p>

                  {/* 第三行：地址（完整顯示） */}
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-400">
                      {caseItem.county} {caseItem.district} {caseItem.address}
                    </p>
                  </div>

                  {/* 第四行：聯絡方式 */}
                  <div className="flex flex-wrap gap-3 text-sm">
                    {caseItem.phone && (
                      <div className="flex items-center gap-1 text-slate-400">
                        <Phone className="w-4 h-4" />
                        {caseItem.phone}
                      </div>
                    )}
                    {caseItem.mobile && (
                      <div className="flex items-center gap-1 text-slate-400">
                        <Phone className="w-4 h-4" />
                        {caseItem.mobile}
                      </div>
                    )}
                  </div>

                  {/* 第五行：訪視日期 */}
                  {caseItem.scheduledVisitDate && (
                    <div className="flex items-center gap-2 text-sm text-blue-300">
                      <Calendar className="w-4 h-4" />
                      訪視日期：{format(new Date(caseItem.scheduledVisitDate), "yyyy-MM-dd", { locale: zhTW })}
                    </div>
                  )}

                  {/* 日期編輯區 */}
                  {editingCaseId === caseItem.id && (
                    <div className="flex gap-2 pt-2">
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-slate-100 rounded px-3 py-2 text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleDateUpdate(caseItem.id)}
                        disabled={updateDateMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {updateDateMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "確認"
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingCaseId(null);
                          setSelectedDate("");
                        }}
                        className="border-slate-700 text-slate-300 hover:bg-slate-800"
                      >
                        取消
                      </Button>
                    </div>
                  )}

                  {/* 操作按鈕 */}
                  <div className="flex gap-2 flex-wrap justify-start pt-2">
                    {status === "unvisited" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingCaseId(caseItem.id);
                            setSelectedDate(caseItem.scheduledVisitDate ? format(new Date(caseItem.scheduledVisitDate), "yyyy-MM-dd") : "");
                          }}
                          className="border-slate-700 text-slate-300 hover:bg-slate-800"
                        >
                          <Calendar className="w-4 h-4 mr-1" />
                          設定日期
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleStatusChange(caseItem.id, "visited")}
                          disabled={updateStatusMutation.isPending}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {updateStatusMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            "完成訪視"
                          )}
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/assessment/${caseItem.id}`)}
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      紀錄
                    </Button>
                    {status === "visited" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(caseItem.id, "unvisited")}
                        disabled={updateStatusMutation.isPending}
                        className="border-slate-700 text-slate-300 hover:bg-slate-800"
                      >
                        {updateStatusMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "標記未訪視"
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
