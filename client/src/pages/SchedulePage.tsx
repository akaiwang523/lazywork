import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { format, getDaysInMonth, startOfMonth } from "date-fns";
import { zhTW } from "date-fns/locale";

export default function SchedulePage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [formData, setFormData] = useState({
    clientName: "",
    district: "all",
    address: "",
    phone: "",
    mobile: "",
  });

  // 獲取所有鄉鎮區
  const { data: districts = [] } = trpc.cases.districts.useQuery();

  // 搜尋個案
  const { data: searchResults = [] } = trpc.cases.searchByNameAndDistrict.useQuery(
    {
      clientName: formData.clientName,
      district: formData.district,
    },
    {
      enabled: formData.clientName.length > 0 && formData.district !== "all",
    }
  );

  // 處理個案選擇
  const handleSelectCase = (caseItem: any) => {
    setFormData({
      ...formData,
      clientName: caseItem.clientName,
      address: caseItem.address || "",
      phone: caseItem.phone || "",
      mobile: caseItem.mobile || "",
    });
    setShowSuggestions(false);
  };

  // 新增個案 mutation
  const createCaseMutation = trpc.cases.createManually.useMutation({
    onSuccess: () => {
      toast.success("個案新增成功");
      setShowDialog(false);
      setFormData({
        clientName: "",
        district: "all",
        address: "",
        phone: "",
        mobile: "",
      });
    },
    onError: (error) => {
      toast.error(`新增失敗: ${error.message}`);
    },
  });

  // 計算月曆日期
  const firstDay = startOfMonth(currentMonth);
  const daysInMonth = getDaysInMonth(currentMonth);
  const startingDayOfWeek = firstDay.getDay();
  const days: (number | null)[] = [];

  // 填充前面的空白
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }

  // 填充日期
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  // 處理日期點擊
  const handleDateClick = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(date);
    setShowDialog(true);
  };

  // 處理表單提交
  const handleSubmit = async () => {
    if (!formData.clientName.trim()) {
      toast.error("請輸入個案名字");
      return;
    }

    if (formData.district === "all") {
      toast.error("請選擇鄉鎮區");
      return;
    }

    try {
      await createCaseMutation.mutateAsync({
        clientName: formData.clientName,
        district: formData.district,
        address: formData.address,
        phone: formData.phone,
        mobile: formData.mobile,
        scheduledVisitDate: selectedDate || undefined,
      });
    } catch (error) {
      console.error("Submit failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 標題 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">排程管理</h1>
          <p className="text-slate-400">點擊日期新增訪視排程</p>
        </div>

        {/* 月曆卡片 */}
        <Card className="bg-slate-900/50 border-slate-800 p-6 mb-8">
          {/* 月份導航 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-100">
              {format(currentMonth, "yyyy年 MMMM", { locale: zhTW })}
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentMonth(
                    new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
                  )
                }
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                上月
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                今月
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentMonth(
                    new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
                  )
                }
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                下月
              </Button>
            </div>
          </div>

          {/* 星期標題 */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
              <div key={day} className="text-center text-sm font-semibold text-slate-400 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* 日期網格 */}
          <div className="grid grid-cols-7 gap-2">
            {days.map((day, index) => (
              <div
                key={index}
                className={`aspect-square flex items-center justify-center rounded-lg border-2 transition-all ${
                  day === null
                    ? "bg-transparent border-transparent"
                    : "border-slate-700 bg-slate-800/50 hover:border-blue-500 hover:bg-blue-900/30 cursor-pointer"
                }`}
                onClick={() => day !== null && handleDateClick(day)}
              >
                {day !== null && (
                  <span className="text-slate-200 font-semibold">{day}</span>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* 新增個案對話框 */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="bg-slate-900 border-slate-800 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-slate-100">
                新增排程
                {selectedDate && (
                  <span className="text-sm text-slate-400 ml-2">
                    ({format(selectedDate, "yyyy-MM-dd")})
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* 鄉鎮區 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  鄉鎮區 *
                </label>
                <Select
                  value={formData.district}
                  onValueChange={(value) => {
                    setFormData({ ...formData, district: value, clientName: "" });
                    setShowSuggestions(false);
                  }}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                    <SelectValue placeholder="選擇鄉鎮區" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all" disabled>
                      選擇鄉鎮區
                    </SelectItem>
                    {districts.map((district) => (
                      <SelectItem key={district} value={district}>
                        {district}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 個案名字 - 帶 autocomplete */}
              <div className="relative">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  個案名字 *
                </label>
                <div className="relative">
                  <Input
                    placeholder="輸入個案名字"
                    value={formData.clientName}
                    onChange={(e) => {
                      setFormData({ ...formData, clientName: e.target.value });
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    disabled={formData.district === "all"}
                    className="bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500"
                  />
                  {formData.clientName && (
                    <button
                      onClick={() => setFormData({ ...formData, clientName: "" })}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* 搜尋建議下拉列表 */}
                {showSuggestions && formData.clientName && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                    {searchResults.map((caseItem) => (
                      <button
                        key={caseItem.id}
                        onClick={() => handleSelectCase(caseItem)}
                        className="w-full text-left px-4 py-2 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0"
                      >
                        <div className="text-sm font-medium text-slate-100">
                          {caseItem.clientName}
                        </div>
                        <div className="text-xs text-slate-400">
                          {caseItem.address}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {showSuggestions && formData.clientName && searchResults.length === 0 && formData.district !== "all" && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg p-3 z-50">
                    <p className="text-sm text-slate-400">沒有找到符合的個案</p>
                  </div>
                )}
              </div>

              {/* 地址 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  地址
                </label>
                <Input
                  placeholder="地址"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500"
                />
              </div>

              {/* 電話 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  電話
                </label>
                <Input
                  placeholder="電話"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500"
                />
              </div>

              {/* 手機 */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  手機
                </label>
                <Input
                  placeholder="手機"
                  value={formData.mobile}
                  onChange={(e) =>
                    setFormData({ ...formData, mobile: e.target.value })
                  }
                  className="bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500"
                />
              </div>

              {/* 按鈕 */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                  className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
                >
                  取消
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createCaseMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {createCaseMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      新增中...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      新增排程
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
