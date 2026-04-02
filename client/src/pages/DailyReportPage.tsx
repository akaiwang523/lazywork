import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Download, Plus, X, Save } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type ExtraItem = {
  name: string;
  note: string;
};

function ExtraSection({
  label,
  items,
  onAdd,
  onUpdate,
  onRemove,
}: {
  label: string;
  items: ExtraItem[];
  onAdd: () => void;
  onUpdate: (index: number, field: "name" | "note", value: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{items.length} 人</span>
          <button onClick={onAdd} className="text-blue-400 hover:text-blue-300 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <Input
            placeholder="姓名"
            value={item.name}
            onChange={e => onUpdate(i, "name", e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-200 h-8 text-xs w-24 flex-shrink-0"
          />
          <Input
            placeholder="備註（選填）"
            value={item.note}
            onChange={e => onUpdate(i, "note", e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-200 h-8 text-xs flex-1"
          />
          <button
            onClick={() => onRemove(i)}
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
}

export default function DailyReportPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedDate, setSelectedDate] = useState(today);
  const [unvisitedNotes, setUnvisitedNotes] = useState<Record<number, string>>({});
  const [repair, setRepair] = useState<ExtraItem[]>([]);
  const [resource, setResource] = useState<ExtraItem[]>([]);
  const [lifeHelp, setLifeHelp] = useState<ExtraItem[]>([]);
  const [supplies, setSupplies] = useState<ExtraItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoad = useRef(true);

  const { data: reportData, isLoading } = trpc.cases.getDailyReport.useQuery(
    { date: selectedDate },
    { enabled: !!selectedDate }
  );

  const { data: extraData } = trpc.cases.getDailyReportExtra.useQuery(
    { date: selectedDate },
    { enabled: !!selectedDate }
  );

  const saveMutation = trpc.cases.saveDailyReport.useMutation({
    onSuccess: () => {
      setIsSaving(false);
      setLastSaved(format(new Date(), "HH:mm:ss"));
    },
    onError: () => {
      setIsSaving(false);
      toast.error("儲存失敗");
    },
  });

  // 載入已儲存的資料
  useEffect(() => {
    if (extraData) {
      setRepair(extraData.repair || []);
      setResource(extraData.resource || []);
      setLifeHelp(extraData.lifeHelp || []);
      setSupplies(extraData.supplies || []);
      const notes: Record<number, string> = {};
      Object.entries(extraData.unvisitedNotes || {}).forEach(([k, v]) => {
        notes[Number(k)] = v as string;
      });
      setUnvisitedNotes(notes);
      isFirstLoad.current = false;
    } else if (!isLoading) {
      setRepair([]);
      setResource([]);
      setLifeHelp([]);
      setSupplies([]);
      setUnvisitedNotes({});
      isFirstLoad.current = false;
    }
  }, [extraData, selectedDate]);

  // 日期切換時重置
  useEffect(() => {
    isFirstLoad.current = true;
    setLastSaved(null);
  }, [selectedDate]);

  const triggerAutoSave = (
    r: ExtraItem[], res: ExtraItem[], lh: ExtraItem[], s: ExtraItem[], notes: Record<number, string>
  ) => {
    if (isFirstLoad.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      setIsSaving(true);
      const stringNotes: Record<string, string> = {};
      Object.entries(notes).forEach(([k, v]) => { stringNotes[k] = v; });
      saveMutation.mutate({
        date: selectedDate,
        repair: r, resource: res, lifeHelp: lh, supplies: s,
        unvisitedNotes: stringNotes,
      });
    }, 1000);
  };

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
    return [
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
    ].join("\n");
  };

  const handleDownload = () => {
    const blob = new Blob([generateReport()], { type: "text/plain;charset=utf-8" });
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

  const handleManualSave = () => {
    setIsSaving(true);
    const stringNotes: Record<string, string> = {};
    Object.entries(unvisitedNotes).forEach(([k, v]) => { stringNotes[k] = v; });
    saveMutation.mutate({
      date: selectedDate,
      repair, resource, lifeHelp, supplies,
      unvisitedNotes: stringNotes,
    });
  };

  const makeHandlers = (
    setter: React.Dispatch<React.SetStateAction<ExtraItem[]>>,
    getCurrent: () => ExtraItem[]
  ) => ({
    onAdd: () => {
      const next = [...getCurrent(), { name: "", note: "" }];
      setter(next);
      triggerAutoSave(
        setter === setRepair ? next : repair,
        setter === setResource ? next : resource,
        setter === setLifeHelp ? next : lifeHelp,
        setter === setSupplies ? next : supplies,
        unvisitedNotes
      );
    },
    onUpdate: (i: number, field: "name" | "note", value: string) => {
      const next = getCurrent().map((item, idx) => idx === i ? { ...item, [field]: value } : item);
      setter(next);
      triggerAutoSave(
        setter === setRepair ? next : repair,
        setter === setResource ? next : resource,
        setter === setLifeHelp ? next : lifeHelp,
        setter === setSupplies ? next : supplies,
        unvisitedNotes
      );
    },
    onRemove: (i: number) => {
      const next = getCurrent().filter((_, idx) => idx !== i);
      setter(next);
      triggerAutoSave(
        setter === setRepair ? next : repair,
        setter === setResource ? next : resource,
        setter === setLifeHelp ? next : lifeHelp,
        setter === setSupplies ? next : supplies,
        unvisitedNotes
      );
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 mb-1">每日訪視日報</h1>
            <p className="text-slate-400 text-sm">選擇日期後自動帶入訪視資料，填寫完成後下載文字檔</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {lastSaved && (
              <span className="text-xs text-slate-500">已儲存 {lastSaved}</span>
            )}
            {isSaving && (
              <span className="text-xs text-slate-500">儲存中...</span>
            )}
            <Button size="sm" onClick={handleManualSave} disabled={isSaving}
              className="bg-slate-700 hover:bg-slate-600 text-xs h-8">
              <Save className="w-3 h-3 mr-1" />儲存
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 左側：自動帶入資料 */}
          <div className="space-y-4">
            <Card className="bg-slate-900/50 border-slate-800 p-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">選擇日期</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-slate-800 border-slate-700 text-slate-200"
              />
            </Card>

            <Card className="bg-slate-900/50 border-slate-800 p-4 space-y-4">
              <h3 className="text-sm font-medium text-slate-300">自動帶入資料</h3>
              {isLoading ? (
                <p className="text-xs text-slate-500">載入中...</p>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">1. 應訪</span>
                      <span className="text-xs font-medium text-slate-200">{scheduled.length} 人</span>
                    </div>
                    {scheduled.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {scheduled.map(c => (
                          <span key={c.id} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">{c.clientName}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">2. 已訪</span>
                      <span className="text-xs font-medium text-emerald-400">{visited.length} 人</span>
                    </div>
                    {visited.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {visited.map(c => (
                          <span key={c.id} className="text-xs bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded">{c.clientName}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400">3. 補訪本月名單</span>
                      <span className="text-xs font-medium text-blue-400">{rescheduled.length} 人</span>
                    </div>
                    {rescheduled.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {rescheduled.map(c => (
                          <span key={c.id} className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">{c.clientName}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">4. 非本月預排名單訪視</span>
                    <span className="text-xs font-medium text-slate-400">0 人</span>
                  </div>

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
                          onChange={e => {
                            const next = { ...unvisitedNotes, [c.id]: e.target.value };
                            setUnvisitedNotes(next);
                            triggerAutoSave(repair, resource, lifeHelp, supplies, next);
                          }}
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
            <Card className="bg-slate-900/50 border-slate-800 p-4 space-y-4">
              <h3 className="text-sm font-medium text-slate-300">手動填入項目</h3>
              <ExtraSection label="6. 維修" items={repair} {...makeHandlers(setRepair, () => repair)} />
              <ExtraSection label="7. 資源轉介" items={resource} {...makeHandlers(setResource, () => resource)} />
              <ExtraSection label="8. 生活協助" items={lifeHelp} {...makeHandlers(setLifeHelp, () => lifeHelp)} />
              <ExtraSection label="9. 物資發送" items={supplies} {...makeHandlers(setSupplies, () => supplies)} />
            </Card>

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