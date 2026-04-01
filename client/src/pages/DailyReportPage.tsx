import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Download, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type ExtraItem = {
  name: string;
  note: string;
};

export default function DailyReportPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);

  // 未訪視成功的備註（每個人可填）
  const [unvisitedNotes, setUnvisitedNotes] = useState<Record<number, string>>({});

  // 6789 項目
  const [repair, setRepair] = useState<ExtraItem[]>([]);
  const [resource, setResource] = useState<ExtraItem[]>([]);
  const [lifeHelp, setLifeHelp] = useState<ExtraItem[]>([]);
  const [supplies, setSupplies] = useState<ExtraItem[]>([]);

  const { data: reportData, isLoading } = trpc.cases.getDailyReport.useQuery(
    { date: selectedDate },
    { enabled: !!selectedDate }
  );

  const scheduled = reportData?.scheduled || [];
  const visited = reportData?.visited || [];
  const rescheduled = reportData?.rescheduled || [];
  const unvisited = scheduled.filter(c => c.visitStatus !== "visited");

  const formatNames = (items: { clientName: string }[]) =>
    items.map(c => c.clientName).join(".");

  const formatExtraItems = (items: ExtraItem[]) => {
    if (items.length === 0) return "0人";
    const names = items.map(i => i.note ? `${i.name}-${i.note}` : i.name).join("；");
    return `${items.length}人(${names})`;
  };

  const formatUnvisited = () => {
    if (unvisited.length === 0) return "0人";
    const parts = unvisited.map(c => {
      const note = unvisitedNotes[c.id];
      return note ? `${c.clientName}-${note}` : c.clientName;
    }).join("；");
    return `${unvisited.length}人(${parts})`;
  };

  const generateReport = () => {
    const dateStr = selectedDate.replace(/-/g, "/");
    const lines = [
      dateStr,
      `1.應訪：${scheduled.length}人${scheduled.length > 0 ? `(${formatNames(scheduled)})` : ""}`,
      `2.已訪：${visited.length}人${visited.length > 0 ? `(${formatNames(visited)})` : ""}`,
      `3.補訪本月名單：${rescheduled.length}人${rescheduled.length > 0 ? `(${formatNames(rescheduled)})` : ""}`,
      `4.非本月預排名單訪視：0人`,
      `5.未訪視成功：${formatUnvisited()}`,
      `6.維修：${formatExtraItems(repair)}`,
      `7.資源轉介：${formatExtraItems(resource)}`,
      `8.生活協助：${formatExtraItems(lifeHelp)}`,
      `9.物資發送：${formatExtraItems(supplies)}`,
    ];
    return lines.join("\n");
  };

  const handleDownload = () => {
    const content = generateReport();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `日報_${selectedDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("日報已下載");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateReport());
    toast.success("已複製到剪貼簿");
  };

  const addExtraItem = (setter: React.Dispatch<React.SetStateAction<ExtraItem[]>>) => {
    setter(prev => [...prev, { name: "", note: "" }]);
  };

  const updateExtraItem = (
    setter: React.Dispatch<React.SetStateAction<ExtraItem[]>>,
    index: number,
    field: "name" | "note",
    value: string
  ) => {
    setter(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const removeExtraItem = (
    setter: React.Dispatch<React.SetStateAction<ExtraItem[]>>,
    index: number
  ) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const ExtraSection = ({
    label,
    items,
    setter,
  }: {
    label: string;
    items: ExtraItem[];
    setter: React.Dispatch<React.SetStateAction<ExtraItem[]>>;
  }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{items.length} 人</span>
          <button
            onClick={() => addExtraItem(setter)}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            placeholder="姓名"
            value={item.name}
            onChange={e => updateExtraItem(setter, i, "name", e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-200 h-8 text-xs w-24 flex-shrink-0"
          />
          <Input
            placeholder="備註（選填）"
            value={item.note}
            onChange={e => updateExtraItem(setter, i, "note", e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-200 h-8 text-xs flex-1"
          />
          <button
            onClick={() => removeExtraItem(setter, i)}
            className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-slate-600 pl-1">0 人</p>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-100 mb-1">每日訪視日報</h1>
          <p className="text-slate-400 text-sm">選擇日期後自動帶入訪視資料，填寫完成後下載文字檔</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 左側：自動帶入資料 */}
          <div className="space-y-4">
            {/* 日期選擇 */}
            <Card className="bg-slate-900/50 border-slate-800 p-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">選擇日期</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-200"
              />
            </Card>

            {/* 自動帶入項目 */}
            <Card className="bg-slate-900/50 border-slate-800 p-4 space-y-4">
              <h3 className="text-sm font-medium text-slate-300">自動帶入資料</h3>

              {isLoading ? (
                <p className="text-xs text-slate-500">載入中...</p>
              ) : (
                <>
                  {/* 1. 應訪 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">1. 應訪</span>
                      <span className="text-xs font-medium text-slate-200">{scheduled.length} 人</span>
                    </div>
                    {scheduled.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {scheduled.map(c => (
                          <span key={c.id} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                            {c.clientName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. 已訪 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">2. 已訪</span>
                      <span className="text-xs font-medium text-emerald-400">{visited.length} 人</span>
                    </div>
                    {visited.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {visited.map(c => (
                          <span key={c.id} className="text-xs bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded">
                            {c.clientName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. 補訪 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">3. 補訪本月名單</span>
                      <span className="text-xs font-medium text-blue-400">{rescheduled.length} 人</span>
                    </div>
                    {rescheduled.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {rescheduled.map(c => (
                          <span key={c.id} className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">
                            {c.clientName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 4. 非本月 */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">4. 非本月預排名單訪視</span>
                    <span className="text-xs font-medium text-slate-400">0 人</span>
                  </div>

                  {/* 5. 未訪視成功 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-slate-400">5. 未訪視成功</span>
                      <span className="text-xs font-medium text-amber-400">{unvisited.length} 人</span>
                    </div>
                    {unvisited.map(c => (
                      <div key={c.id} className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-amber-400 w-16 flex-shrink-0 truncate">{c.clientName}</span>
                        <Input
                          placeholder="原因備註"
                          value={unvisitedNotes[c.id] || ""}
                          onChange={e => setUnvisitedNotes(prev => ({ ...prev, [c.id]: e.target.value }))}
                          className="bg-slate-800 border-slate-700 text-slate-200 h-7 text-xs flex-1"
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* 右側：手動填入 + 預覽 */}
          <div className="space-y-4">
            {/* 6789 手動項目 */}
            <Card className="bg-slate-900/50 border-slate-800 p-4 space-y-4">
              <h3 className="text-sm font-medium text-slate-300">手動填入項目</h3>
              <ExtraSection label="6. 維修" items={repair} setter={setRepair} />
              <ExtraSection label="7. 資源轉介" items={resource} setter={setResource} />
              <ExtraSection label="8. 生活協助" items={lifeHelp} setter={setLifeHelp} />
              <ExtraSection label="9. 物資發送" items={supplies} setter={setSupplies} />
            </Card>

            {/* 預覽 */}
            <Card className="bg-slate-900/50 border-slate-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-slate-300">預覽</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopy}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-7 px-2">
                    複製
                  </Button>
                  <Button size="sm" onClick={handleDownload}
                    className="bg-blue-600 hover:bg-blue-700 text-xs h-7 px-2">
                    <Download className="w-3 h-3 mr-1" />下載
                  </Button>
                </div>
              </div>
              <pre className="text-xs text-slate-300 bg-slate-800 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed">
                {generateReport()}
              </pre>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
