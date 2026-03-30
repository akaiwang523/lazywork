import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";


export default function AssessmentPage() {
  const [match, params] = useRoute("/assessment/:caseId");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const caseId = params?.caseId ? parseInt(params.caseId, 10) : null;

  const { data: caseData, isLoading: caseLoading } = trpc.cases.detail.useQuery(
    { id: caseId! },
    { enabled: !!caseId }
  );

  const saveAssessmentMutation = trpc.assessments.save.useMutation({
    onSuccess: () => {
      toast.success("評估表已保存");
      setIsSaving(false);
    },
    onError: (error) => {
      toast.error(`保存失敗: ${error.message}`);
      setIsSaving(false);
    },
  });

  const handleDownloadSignature = (signatureType: 'client' | 'worker') => {
    if (!iframeRef.current) return;
    
    try {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (!iframeDoc) {
        toast.error("無法訪問評估表");
        return;
      }

      const canvasId = signatureType === 'client' ? 'sig-client' : 'sig-worker';
      const canvas = iframeDoc.getElementById(canvasId) as HTMLCanvasElement;
      
      if (!canvas) {
        toast.error("找不到簽名");
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toast.error("無法讀取簽名");
        return;
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const isBlank = !imageData.data.some(v => v !== 0);

      if (isBlank) {
        toast.error(signatureType === 'client' ? "個案還未簽名" : "家訪員還未簽名");
        return;
      }

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const sigType = signatureType === 'client' ? '個案' : '家訪員';
      link.download = `${caseData?.clientName || '簽名'}_${sigType}_${timestamp}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("簽名已下載");
    } catch (error) {
      console.error('Error downloading signature:', error);
      toast.error("下載失敗");
    }
  };

  const handleSaveAssessment = () => {
    if (!iframeRef.current) return;
    
    setIsSaving(true);
    
    try {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (!iframeDoc) {
        toast.error("無法訪問評估表");
        setIsSaving(false);
        return;
      }

      const sigClientCanvas = iframeDoc.getElementById('sig-client') as HTMLCanvasElement;
      
      if (!sigClientCanvas) {
        toast.error("找不到簽名畫布");
        setIsSaving(false);
        return;
      }

      const sigClientUrl = sigClientCanvas.toDataURL('image/png');

      const ctx = sigClientCanvas.getContext('2d');
      if (!ctx) {
        toast.error("無法讀取簽名");
        setIsSaving(false);
        return;
      }

      saveAssessmentMutation.mutate({
        caseId: caseId!,
        assessmentData: { timestamp: new Date().toISOString() },
        signatureUrl: sigClientUrl,
      });
    } catch (error) {
      console.error('Error saving assessment:', error);
      toast.error("操作失敗");
      setIsSaving(false);
    }
  };

  useEffect(() => {
    setIsLoading(false);
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'downloadSignature') {
        handleDownloadSignature(event.data.signatureType);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [caseData]);

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
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveAssessment}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    儲存中...
                  </>
                ) : (
                  "儲存評估表"
                )}
              </Button>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {caseData.clientName}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              成約單號：{caseData.contractNumber} | {caseData.county} {caseData.district}
            </p>
          </div>
        </div>
      </div>

      <div className="w-full">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src="/zeabur-form.html"
          className="w-full border-0"
          style={{ minHeight: "100vh" }}
          title="Assessment Form"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
