import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, MapPin, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type OptimizedCase = {
  id: number;
  clientName: string;
  district: string;
  address: string;
  phone?: string | null;
  mobile?: string | null;
  order: number;
};

export default function RoutePlannerPage() {
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [selectedCases, setSelectedCases] = useState<number[]>([]);
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
  } | null>(null);
  const [optimizedCases, setOptimizedCases] = useState<OptimizedCase[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  const { data: districts = [] } = trpc.cases.districts.useQuery();

  const { data: cases = [] } = trpc.cases.list.useQuery({
    status: "unvisited",
    district: selectedDistrict === "all" ? undefined : selectedDistrict,
  });

  const geocodeMutation = trpc.maps.geocodeAddress.useMutation();
  const routeMutation = trpc.maps.getOptimizedRoute.useMutation();

  const planRoute = async () => {
    if (selectedCases.length === 0) {
      toast.error("請選擇至少一個個案");
      return;
    }

    setIsPlanning(true);
    try {
      const casesToRoute = cases.filter((c) => selectedCases.includes(c.id));

      // 地理編碼所有地址，保留對應關係
      const geocoded: Array<{ caseItem: typeof casesToRoute[0]; lat: number; lng: number }> = [];
      for (const caseItem of casesToRoute) {
        const coords = await geocodeMutation.mutateAsync({
          address: `台南市${caseItem.district}${caseItem.address}`,
        });
        if (coords) {
          geocoded.push({ caseItem, lat: coords.lat, lng: coords.lng });
        }
      }

      if (geocoded.length === 0) {
        toast.error("無法地理編碼任何地址，請檢查地址資訊");
        return;
      }

      if (geocoded.length < casesToRoute.length) {
        toast.warning(`只有 ${geocoded.length} 個地址被成功識別`);
      }

      if (geocoded.length < 2) {
        toast.error("至少需要 2 個有效地址才能規劃路線");
        return;
      }

      // 把所有點都當 waypoints，第一個點同時當 origin 和加入 waypoints
// 讓 Google 完全自由排序
const allAsWaypoints = [
  geocoded[0],
  ...geocoded.slice(1),
];
const waypoints = allAsWaypoints.map(g => ({ lat: g.lat, lng: g.lng }));

const route = await routeMutation.mutateAsync({ waypoints });

if (route) {
  setRouteInfo({
    distance: route.distance,
    duration: route.duration,
  });

  const waypointOrder: number[] = (route as any).waypointOrder || [];

  let orderedGeocoded: typeof geocoded;
  if (waypointOrder.length > 0 && geocoded.length > 2) {
    // 所有中間點都自由排序（首尾固定是 Google 的限制）
    // 為了盡量自由，我們把除了最後一個以外的都放中間
    const first = geocoded[0];
    const last = geocoded[geocoded.length - 1];
    const middle = geocoded.slice(1, -1);
    const orderedMiddle = waypointOrder.map(i => middle[i]).filter(Boolean);
    orderedGeocoded = [first, ...orderedMiddle, last];
  } else {
    orderedGeocoded = geocoded;
  }

        // 設定優化後的個案順序
        setOptimizedCases(
          orderedGeocoded.map((g, i) => ({
            ...g.caseItem,
            order: i + 1,
          }))
        );

        // 構建地圖 URL（用優化後的順序）
        const origin = orderedGeocoded[0];
        const destination = orderedGeocoded[orderedGeocoded.length - 1];
        const waypointStr = orderedGeocoded
          .slice(1, -1)
          .map(g => `${g.lat},${g.lng}`)
          .join('|');

        const mapsUrl = `https://www.google.com/maps/embed/v1/directions?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}${waypointStr ? `&waypoints=${waypointStr}` : ''}`;
        setMapUrl(mapsUrl);
        toast.success("路線規劃完成！");
      } else {
        toast.error("無法規劃路線，請檢查地址資訊");
      }
    } catch (error) {
      console.error("Route planning error:", error);
      toast.error("路線規劃失敗，請稍後重試");
    } finally {
      setIsPlanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">訪視路線規劃</h1>
          <p className="text-slate-400">選擇個案，系統將為您規劃最順路的訪視路線</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左側：個案選擇 */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-900/50 border-slate-800 p-6">
              <h2 className="text-xl font-bold text-slate-100 mb-6">選擇個案</h2>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">鄉鎮區</label>
                <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100">
                    <SelectValue placeholder="選擇鄉鎮區" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="all">全部鄉鎮區</SelectItem>
                    {districts.map((district) => (
                      <SelectItem key={district} value={district}>{district}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {cases.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-400">沒有待訪個案</p>
                  </div>
                ) : (
                  cases.map((caseItem) => (
                    <div
                      key={caseItem.id}
                      className="flex items-start gap-3 p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Checkbox
                        checked={selectedCases.includes(caseItem.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCases([...selectedCases, caseItem.id]);
                          } else {
                            setSelectedCases(selectedCases.filter((id) => id !== caseItem.id));
                          }
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-100 truncate">{caseItem.clientName}</h3>
                        <p className="text-sm text-slate-400 truncate">{caseItem.district} {caseItem.address}</p>
                        <div className="flex gap-2 mt-2 text-xs text-slate-500">
                          {caseItem.phone && <span>📞 {caseItem.phone}</span>}
                          {caseItem.mobile && <span>📱 {caseItem.mobile}</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Button
                onClick={planRoute}
                disabled={isPlanning || selectedCases.length === 0}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isPlanning ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />規劃中...</>
                ) : (
                  <><MapPin className="w-4 h-4 mr-2" />規劃最優路線</>
                )}
              </Button>
            </Card>
          </div>

          {/* 右側：路線資訊 */}
          <div>
            <Card className="bg-slate-900/50 border-slate-800 p-6 sticky top-6">
              <h2 className="text-xl font-bold text-slate-100 mb-6">路線資訊</h2>

              {routeInfo ? (
                <div className="space-y-4">
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-slate-400">總距離</span>
                    </div>
                    <p className="text-lg font-semibold text-slate-100">{routeInfo.distance}</p>
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm text-slate-400">預計時間</span>
                    </div>
                    <p className="text-lg font-semibold text-slate-100">{routeInfo.duration}</p>
                  </div>

                  {/* 優化後的訪視順序 */}
                  {optimizedCases.length > 0 && (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                      <p className="text-sm font-medium text-slate-300 mb-3">建議訪視順序</p>
                      <div className="space-y-2">
                        {optimizedCases.map((c) => (
                          <div key={c.id} className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                              {c.order}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-200 truncate">{c.clientName}</p>
                              <p className="text-xs text-slate-500 truncate">{c.district} {c.address}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-200">
                        已依最短路線重新排列 {selectedCases.length} 個個案的訪視順序。
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">選擇個案後點擊「規劃最優路線」查看路線資訊</p>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* 地圖顯示 */}
        {mapUrl && (
          <Card className="bg-slate-900/50 border-slate-800 p-6 mt-6">
            <h2 className="text-xl font-bold text-slate-100 mb-4">訪視路線地圖</h2>
            <div className="w-full h-96 rounded-lg overflow-hidden border border-slate-700">
              <iframe
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                src={mapUrl}
              />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}