import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export default function AssessmentPage() {
  const [match, params] = useRoute("/assessment/:caseId");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const caseId = params?.caseId ? parseInt(params.caseId, 10) : null;

  const { data: caseData, isLoading: caseLoading } = trpc.cases.detail.useQuery(
    { id: caseId! },
    { enabled: !!caseId }
  );

  const { data: latestAssessment } = trpc.assessments.getLatest.useQuery(
    { caseId: caseId! },
    { enabled: !!caseId }
  );

  const saveAssessmentMutation = trpc.assessments.save.useMutation({
    onSuccess: () => {
      toast.success("評估表已儲存");
      setIsSaving(false);
      // 通知 iframe 儲存成功
      iframeRef.current?.contentWindow?.postMessage({ type: 'saveSuccess' }, '*');
    },
    onError: (error) => {
      toast.error(`儲存失敗: ${error.message}`);
      setIsSaving(false);
    },
  });

  // iframe 載入完成後把之前的資料填回去
  const handleIframeLoad = () => {
    setIframeReady(true);
  };

  useEffect(() => {
    if (!iframeReady || !latestAssessment || !iframeRef.current) return;
    try {
      const assessmentData = JSON.parse(latestAssessment.assessmentData);
      iframeRef.current.contentWindow?.postMessage(
        { type: 'loadAssessment', payload: assessmentData },
        '*'
      );
    } catch (e) {
      console.error('載入評估表資料失敗', e);
    }
  }, [iframeReady, latestAssessment]);

  // 接收 iframe 傳來的資料
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'saveAssessment' && event.data.payload) {
        setIsSaving(true);
        const payload = event.data.payload;
        const { signatures, ...assessmentData } = payload;
        const dataToSave = {
          ...assessmentData,
          signatureClient: signatures?.client || null,
          signatureWorker: signatures?.worker || null,
        };
        saveAssessmentMutation.mutate({
          caseId: caseId!,
          assessmentData: dataToSave,
          signatureUrl: signatures?.client || undefined,
        });
      }

      if (event.data.type === 'downloadSignature') {
        handleDownloadSignature(event.data.signatureType);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [caseId]);

  // 頂部按鈕觸發儲存
  const handleSaveAssessment = () => {
    if (!iframeRef.current) return;
    setIsSaving(true);
    iframeRef.current.contentWindow?.postMessage({ type: 'collectAndSend' }, '*');
    // 5 秒無回應則取消 loading
    setTimeout(() => setIsSaving(s => s ? false : s), 5000);
  };

  const handleDownloadSignature = (signatureType: 'client' | 'worker') => {
    if (!iframeRef.current) return;
    try {
      const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (!iframeDoc) { toast.error("無法訪問評估表"); return; }
      const canvasId = signatureType === 'client' ? 'sig-client' : 'sig-worker';
      const canvas = iframeDoc.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) { toast.error("找不到簽名"); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { toast.error("無法讀取簽名"); return; }
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const isBlank = !imageData.data.some(v => v !== 0);
      if (isBlank) { toast.error(signatureType === 'client' ? "個案還未簽名" : "家訪員還未簽名"); return; }
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      const sigType = signatureType === 'client' ? '個案' : '家訪員';
      link.download = `${caseData?.clientName || '簽名'}_${sigType}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("簽名已下載");
    } catch (error) {
      toast.error("下載失敗");
    }
  };

  if (!match || !caseId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">無效的個案 ID</p>
      </div>
    );
  }

  if (caseLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">個案不存在</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.history.back()}
              className="border-slate-300"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAssessment}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />儲存中...</>
              ) : "儲存評估表"}
            </Button>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{caseData.clientName}</h1>
            <p className="text-sm text-slate-600 mt-1">
              成約單號：{caseData.contractNumber} | {caseData.county} {caseData.district}
            </p>
          </div>
        </div>
      </div>

      <div className="w-full">
        <iframe
          ref={iframeRef}
          src="/zeabur-form.html"
          className="w-full border-0"
          style={{ minHeight: "100vh" }}
          title="Assessment Form"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          onLoad={handleIframeLoad}
        />
      </div>
    </div>
  );
}