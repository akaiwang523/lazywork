import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";

export default function MissedCasesPage() {
  const [, navigate] = useLocation();
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [searchName, setSearchName] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [newVisitDate, setNewVisitDate] = useState<string>("");

  const { data: districts } = trpc.cases.districts.useQuery();
  const { data: missedCases = [], isLoading } = trpc.cases.getMissedCasesByDistrict.useQuery({
    district: selectedDistrict,
  });

  const updateScheduleMutation = trpc.cases.updateScheduledDate.useMutation({
    onSuccess: () => {
      toast.success("訪視時間已更新");
      setSelectedCaseId(null);
      setNewVisitDate("");
    },
    onError: (error: any) => {
      toast.error(`更新失敗: ${error.message}`);
    },
  });

  const filteredCases = useMemo(() => {
    if (!missedCases) return [];
    if (!searchName.trim()) return missedCases;

    return missedCases.filter((c: any) =>
      c.clientName.toLowerCase().includes(searchName.toLowerCase())
    );
  }, [missedCases, searchName]);

  const handleUpdateVisitDate = async () => {
    if (!selectedCaseId || !newVisitDate) {
      toast.error("請選擇日期");
      return;
    }

    await updateScheduleMutation.mutateAsync({
      caseId: selectedCaseId,
      scheduledDate: new Date(newVisitDate),
    });
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "未設定";
    const d = new Date(date);
    return d.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">訪視未果名單</h1>

        {/* 篩選區域 */}
        <div className="bg-slate-800 p-4 rounded-lg mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                鄉鎮區
              </label>
              <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                <SelectTrigger className="bg-slate-700 border-slate-600">
                  <SelectValue placeholder="選擇鄉鎮區" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {districts?.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                搜尋姓名
              </label>
              <Input
                placeholder="輸入個案姓名"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="bg-slate-700 border-slate-600"
              />
            </div>
          </div>
        </div>

        {/* 個案列表 */}
        {isLoading ? (
          <div className="text-center py-8 text-slate-400">載入中...</div>
        ) : filteredCases.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            沒有未遇的個案
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCases.map((caseItem) => (
              <div
                key={caseItem.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition"
              >
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-slate-100">
                        {caseItem.clientName}
                      </h3>
                      <p className="text-sm text-slate-400">{caseItem.district}</p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-300">{caseItem.address}</p>

                  <div className="flex gap-2 text-sm text-slate-400">
                    {caseItem.phone && <span>{caseItem.phone}</span>}
                    {caseItem.mobile && <span>{caseItem.mobile}</span>}
                  </div>

                  <div className="bg-slate-700 p-2 rounded text-sm">
                    <span className="text-slate-400">原預訂訪視時間: </span>
                    <span className="text-slate-100 font-medium">
                      {formatDate(caseItem.scheduledVisitDate)}
                    </span>
                  </div>

                  <div className="flex gap-2 flex-wrap mt-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setSelectedCaseId(caseItem.id)}
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          修改訪視時間
                        </Button>
                      </DialogTrigger>
                    <DialogContent className="bg-slate-800 border-slate-700">
                      <DialogHeader>
                        <DialogTitle className="text-slate-100">
                          修改訪視時間 - {caseItem.clientName}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            新訪視日期
                          </label>
                          <input
                            type="date"
                            value={newVisitDate}
                            onChange={(e) => setNewVisitDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100"
                          />
                        </div>
                        <Button
                          onClick={handleUpdateVisitDate}
                          disabled={updateScheduleMutation.isPending}
                          className="w-full"
                        >
                          {updateScheduleMutation.isPending ? "更新中..." : "確認更新"}
                        </Button>
                      </div>
                    </DialogContent>
                    </Dialog>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/assessment/${caseItem.id}`)}
                    >
                      紀錄
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
