import { useState } from "react";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Loader2, Upload, CheckCircle2, AlertCircle, Plus } from "lucide-react";

// 家訪員列表
const CASEWORKERS = ["陳宣伶", "蔡文寧", "王思婷"];

// 台南市所有鄉鎮區
const DISTRICTS = [
  "中西區", "東區", "南區", "北區", "安平區", "安南區", "永康區", "歸仁區",
  "新化區", "左鎮區", "玉井區", "南化區", "關廟區", "龍崗區", "官田區", "麻豆區",
  "下營區", "六甲區", "柳營區", "後壁區", "白河區", "東山區", "山上區", "新市區",
  "佳里區", "學甲區", "西港區", "七股區", "將軍區", "北門區"
];

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [selectedCaseworker, setSelectedCaseworker] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; count: number } | null>(null);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [manualFormData, setManualFormData] = useState({
    clientName: "",
    district: "",
    address: "",
    phone: "",
    mobile: "",
  });
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const importMutation = trpc.cases.importExcel.useMutation();
  const createManualMutation = trpc.cases.createManually.useMutation();

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      if (selectedFile.name.endsWith(".xlsx") || selectedFile.name.endsWith(".xls")) {
        setFile(selectedFile);
        setImportResult(null);
      } else {
        toast.error("請選擇 Excel 檔案（.xlsx 或 .xls）");
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
  });

  const handleManualSubmit = async () => {
    if (!manualFormData.clientName.trim()) {
      toast.error("請輸入個案姓名");
      return;
    }
    if (!manualFormData.district.trim()) {
      toast.error("請選擇鄉鎮區");
      return;
    }
    if (!manualFormData.address.trim()) {
      toast.error("請輸入地址");
      return;
    }

    setIsSubmittingManual(true);
    try {
      await createManualMutation.mutateAsync({
        clientName: manualFormData.clientName.trim(),
        district: manualFormData.district.trim(),
        address: manualFormData.address.trim(),
        phone: manualFormData.phone.trim() || undefined,
        mobile: manualFormData.mobile.trim() || undefined,
      });
      toast.success("個案已新增");
      setManualFormData({
        clientName: "",
        district: "",
        address: "",
        phone: "",
        mobile: "",
      });
      setIsManualDialogOpen(false);
    } catch (error) {
      toast.error("新增失敗");
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("請先選擇檔案");
      return;
    }

    if (!selectedCaseworker) {
      toast.error("請先選擇家訪員");
      return;
    }

    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // 跳過第一行標題
          const rows = jsonData.slice(1) as Array<any[]>;

          // 解析資料並篩選該家訪員的個案
          const casesData = rows
            .filter(row => row.length > 0 && row[0]) // 過濾空行
            .map((row, index) => ({
              sequenceNumber: parseInt(row[0]) || index + 1,
              contractNumber: String(row[1] || "").trim(),
              clientName: String(row[5] || "").trim(),
              phone: String(row[6] || "").trim() || undefined,
              mobile: String(row[7] || "").trim() || undefined,
              county: String(row[8] || "").trim(),
              district: String(row[9] || "").trim(),
              address: String(row[10] || "").trim(),
              caseworker: String(row[4] || "").trim(),
              onlineDate: String(row[2] || "").trim() || undefined,
            }))
            .filter(c => c.contractNumber && c.clientName) // 過濾無效資料
            .filter(c => c.caseworker === selectedCaseworker); // 只匯入選定家訪員的個案

          if (casesData.length === 0) {
            toast.error(`找不到 ${selectedCaseworker} 的個案資料`);
            setImporting(false);
            return;
          }

          // 呼叫 API 匯入
          const result = await importMutation.mutateAsync(casesData);
          setImportResult(result);
          toast.success(`成功匯入 ${selectedCaseworker} 的 ${result.count} 筆個案資料`);
          setFile(null);
          setSelectedCaseworker(null);
        } catch (error) {
          console.error("Import error:", error);
          toast.error("匯入失敗，請檢查檔案格式");
        } finally {
          setImporting(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (error) {
      console.error("File read error:", error);
      toast.error("檔案讀取失敗");
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">匯入個案資料</h1>
          <p className="text-slate-600">選擇家訪員並上傳 Excel 檔案以匯入個案資料</p>
        </div>

        <Card className="p-8">
          {/* 家訪員選擇 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              選擇家訪員 *
            </label>
            <Select value={selectedCaseworker || ""} onValueChange={(value) => setSelectedCaseworker(value)}>
              <SelectTrigger>
                <SelectValue placeholder="請選擇家訪員" />
              </SelectTrigger>
              <SelectContent>
                {CASEWORKERS.map(name => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 mt-1">
              只會匯入選定家訪員負責的個案
            </p>
          </div>

          {/* 拖放區域 */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-slate-300 hover:border-slate-400"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            {file ? (
              <div>
                <p className="font-semibold text-slate-900">{file.name}</p>
                <p className="text-sm text-slate-600 mt-1">點擊或拖放以更換檔案</p>
              </div>
            ) : (
              <div>
                <p className="font-semibold text-slate-900">拖放 Excel 檔案到此</p>
                <p className="text-sm text-slate-600 mt-1">或點擊選擇檔案</p>
              </div>
            )}
          </div>

          {/* 匯入結果 */}
          {importResult && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-900">匯入成功</p>
                <p className="text-sm text-green-700">已匯入 {importResult.count} 筆個案資料</p>
              </div>
            </div>
          )}

          {/* 匯入按鈕 */}
          <div className="mt-6 flex gap-3">
            <Button
              onClick={handleImport}
              disabled={!file || !selectedCaseworker || importing}
              className="flex-1"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  匯入中...
                </>
              ) : (
                "開始匯入"
              )}
            </Button>
            {file && (
              <Button
                variant="outline"
                onClick={() => setFile(null)}
                disabled={importing}
              >
                清除
              </Button>
            )}
          </div>

          {/* 手動輸入按鈕 */}
          <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full mt-4">
                <Plus className="w-4 h-4 mr-2" />
                手動輸入個案
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-slate-100">手動新增個案</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    個案姓名 *
                  </label>
                  <Input
                    placeholder="輸入個案姓名"
                    value={manualFormData.clientName}
                    onChange={(e) => setManualFormData({ ...manualFormData, clientName: e.target.value })}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    鄉鎮區 *
                  </label>
                  <Select
                    value={manualFormData.district}
                    onValueChange={(value) => setManualFormData({ ...manualFormData, district: value })}
                  >
                    <SelectTrigger className="bg-slate-700 border-slate-600">
                      <SelectValue placeholder="選擇鄉鎮區" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISTRICTS.map((district) => (
                        <SelectItem key={district} value={district}>
                          {district}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    地址 *
                  </label>
                  <Input
                    placeholder="輸入地址"
                    value={manualFormData.address}
                    onChange={(e) => setManualFormData({ ...manualFormData, address: e.target.value })}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    電話
                  </label>
                  <Input
                    placeholder="輸入電話"
                    value={manualFormData.phone}
                    onChange={(e) => setManualFormData({ ...manualFormData, phone: e.target.value })}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    手機
                  </label>
                  <Input
                    placeholder="輸入手機"
                    value={manualFormData.mobile}
                    onChange={(e) => setManualFormData({ ...manualFormData, mobile: e.target.value })}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>

                <Button
                  onClick={handleManualSubmit}
                  disabled={isSubmittingManual}
                  className="w-full"
                >
                  {isSubmittingManual ? "新增中..." : "確認新增"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* 說明 */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-sm font-semibold text-slate-900 mb-3">使用說明：</p>
            <ul className="text-sm text-slate-600 space-y-2">
              <li>• 先選擇要匯入的家訪員</li>
              <li>• 上傳 Excel 檔案（.xlsx 或 .xls）</li>
              <li>• 系統會自動篩選該家訪員負責的個案</li>
              <li>• 第一行為標題列（會自動跳過）</li>
              <li>• 或使用「手動輸入個案」新增單筆個案</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
