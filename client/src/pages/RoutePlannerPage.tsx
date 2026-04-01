import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, MapPin, RotateCcw, Zap, Hand } from "lucide-react";
import { toast } from "sonner";

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

type CaseItem = {
  id: number;
  clientName: string;
  district: string;
  address: string;
  phone?: string | null;
  mobile?: string | null;
};

type GeocodedCase = CaseItem & {
  lat: number;
  lng: number;
};

type Mode = "idle" | "manual" | "auto";

export default function RoutePlannerPage() {
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [checkedCases, setCheckedCases] = useState<number[]>([]);
  const [geocodedCases, setGeocodedCases] = useState<GeocodedCase[]>([]);
  const [manualOrder, setManualOrder] = useState<number[]>([]);
  const [mode, setMode] = useState<Mode>("idle");
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<number, any>>(new Map());
  const polylineRef = useRef<any>(null);
  const manualOrderRef = useRef<number[]>([]);
  const geocodedCasesRef = useRef<GeocodedCase[]>([]);

  const { data: districts = [] } = trpc.cases.districts.useQuery();
  const { data: cases = [] } = trpc.cases.list.useQuery({
    status: "unvisited",
    district: selectedDistrict === "all" ? undefined : selectedDistrict,
  });

  const geocodeMutation = trpc.maps.geocodeAddress.useMutation();
  const routeMutation = trpc.maps.getOptimizedRoute.useMutation();

  useEffect(() => { geocodedCasesRef.current = geocodedCases; }, [geocodedCases]);

  // 載入 Google Maps JS API
  useEffect(() => {
    if (window.google) { setMapReady(true); return; }
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) { toast.error("Google Maps API 金鑰未設定"); return; }
    window.initMap = () => setMapReady(true);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap&language=zh-TW`;
    script.async = true;
    document.head.appendChild(script);
    return () => {
      if (document.head.contains(script)) document.head.removeChild(script);
    };
  }, []);

  // 初始化地圖
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: { lat: 23.0, lng: 120.2 },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#1e293b" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
        { featureType: "poi", stylers: [{ visibility: "off" }] },
      ],
    });
  }, [mapReady]);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current.clear();
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
  }, []);

  const updateMarkers = useCallback((order: number[]) => {
    markersRef.current.forEach((marker, caseId) => {
      const orderIdx = order.indexOf(caseId);
      const isOrdered = orderIdx >= 0;
      marker.setIcon({
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: isOrdered ? "#10b981" : "#3b82f6",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      });
      marker.setLabel(isOrdered
        ? { text: String(orderIdx + 1), color: "white", fontSize: "11px", fontWeight: "bold" }
        : null
      );
    });
  }, []);

  const drawPolyline = useCallback((orderIds: number[], cases: GeocodedCase[]) => {
    if (polylineRef.current) { polylineRef.current.setMap(null); }
    const path = orderIds
      .map(id => cases.find(c => c.id === id))
      .filter(Boolean)
      .map(c => ({ lat: c!.lat, lng: c!.lng }));

    if (path.length < 2 || !mapInstanceRef.current) return;

    polylineRef.current = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#10b981",
      strokeOpacity: 0.8,
      strokeWeight: 3,
      icons: [{
        icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3 },
        offset: "50%",
        repeat: "100px",
      }],
    });
    polylineRef.current.setMap(mapInstanceRef.current);
  }, []);

  // 顯示個案到地圖
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || geocodedCases.length === 0) return;

    clearMarkers();
    setManualOrder([]);
    manualOrderRef.current = [];
    setMode("idle");
    setRouteInfo(null);

    const bounds = new window.google.maps.LatLngBounds();

    geocodedCases.forEach(gc => {
      const marker = new window.google.maps.Marker({
        position: { lat: gc.lat, lng: gc.lng },
        map: mapInstanceRef.current,
        title: gc.clientName,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#3b82f6",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div style="color:#1e293b;font-size:13px;padding:2px">
          <div style="font-weight:600">${gc.clientName}</div>
          <div style="color:#64748b;margin-top:2px;font-size:12px">${gc.district} ${gc.address}</div>
        </div>`,
      });

      marker.addListener("mouseover", () => infoWindow.open(mapInstanceRef.current, marker));
      marker.addListener("mouseout", () => infoWindow.close());
      marker.addListener("click", () => {
        const cur = manualOrderRef.current;
        const idx = cur.indexOf(gc.id);
        const newOrder = idx >= 0 ? cur.filter(id => id !== gc.id) : [...cur, gc.id];
        manualOrderRef.current = newOrder;
        setManualOrder([...newOrder]);
        updateMarkers(newOrder);
      });

      markersRef.current.set(gc.id, marker);
      bounds.extend({ lat: gc.lat, lng: gc.lng });
    });

    mapInstanceRef.current.fitBounds(bounds);
  }, [geocodedCases, mapReady, clearMarkers, updateMarkers]);

  const handleShowOnMap = async () => {
    const selectedItems = cases.filter(c => checkedCases.includes(c.id));
    if (selectedItems.length === 0) { toast.error("請先勾選個案"); return; }

    setIsGeocoding(true);
    setGeocodedCases([]);
    clearMarkers();

    const results: GeocodedCase[] = [];
    for (const c of selectedItems) {
      try {
        const coords = await geocodeMutation.mutateAsync({ address: `台南市${c.district}${c.address}` });
        if (coords) results.push({ ...c, lat: coords.lat, lng: coords.lng });
      } catch {}
    }

    setIsGeocoding(false);
    if (results.length === 0) { toast.error("無法定位任何地址"); return; }
    if (results.length < selectedItems.length) toast.warning(`${results.length}/${selectedItems.length} 個地址成功定位`);
    setGeocodedCases(results);
    toast.success("地圖已更新，請點選標記決定訪視順序");
  };

  const handleManualRoute = () => {
    if (manualOrder.length < 2) { toast.error("請在地圖上點選至少 2 個個案"); return; }
    setMode("manual");
    drawPolyline(manualOrder, geocodedCases);
    toast.success("已依點選順序排列路線");
  };

  const handleAutoRoute = async () => {
    const baseOrder = manualOrder.length >= 2 ? manualOrder : geocodedCases.map(c => c.id);
    const orderedItems = baseOrder.map(id => geocodedCases.find(c => c.id === id)).filter(Boolean) as GeocodedCase[];
    if (orderedItems.length < 2) { toast.error("請選擇至少 2 個個案"); return; }

    setIsPlanning(true);
    try {
      const waypoints = orderedItems.map(c => ({ lat: c.lat, lng: c.lng }));
      const route = await routeMutation.mutateAsync({ waypoints });

      if (route) {
        const waypointOrder: number[] = (route as any).waypointOrder || [];
        let finalOrder: number[];

        if (waypointOrder.length > 0 && orderedItems.length > 2) {
          const first = orderedItems[0];
          const last = orderedItems[orderedItems.length - 1];
          const middle = orderedItems.slice(1, -1);
          const orderedMiddle = waypointOrder.map(i => middle[i]).filter(Boolean) as GeocodedCase[];
          finalOrder = [first, ...orderedMiddle, last].map(c => c.id);
        } else {
          finalOrder = orderedItems.map(c => c.id);
        }

        manualOrderRef.current = finalOrder;
        setManualOrder(finalOrder);
        setMode("auto");
        setRouteInfo({ distance: route.distance, duration: route.duration });
        updateMarkers(finalOrder);
        drawPolyline(finalOrder, geocodedCases);
        toast.success("最佳路線規劃完成");
      }
    } catch {
      toast.error("路線規劃失敗");
    }
    setIsPlanning(false);
  };

  const resetRoute = () => {
    setManualOrder([]);
    manualOrderRef.current = [];
    setMode("idle");
    setRouteInfo(null);
    if (polylineRef.current) { polylineRef.current.setMap(null); polylineRef.current = null; }
    updateMarkers([]);
  };

  const orderedCaseList = manualOrder
    .map(id => geocodedCases.find(c => c.id === id))
    .filter(Boolean) as GeocodedCase[];

  return (
    <div className="flex h-screen bg-slate-950">
      {/* 左側清單 */}
      <div className="w-68 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col" style={{ width: "270px" }}>
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-base font-bold text-slate-100 mb-3">選擇個案</h2>
          <Select value={selectedDistrict} onValueChange={v => { setSelectedDistrict(v); setCheckedCases([]); }}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-sm">
              <SelectValue placeholder="選擇鄉鎮區" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all">全部鄉鎮區</SelectItem>
              {districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {cases.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">沒有待訪個案</div>
          ) : cases.map(c => (
            <div
              key={c.id}
              className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              onClick={() => setCheckedCases(prev =>
                prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
              )}
            >
              <Checkbox checked={checkedCases.includes(c.id)} onCheckedChange={() => {}} className="flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{c.clientName}</p>
                <p className="text-xs text-slate-500 truncate">{c.district}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-slate-800 space-y-2">
          <p className="text-xs text-slate-500 text-center">已勾選 {checkedCases.length} 個</p>
          <Button
            onClick={handleShowOnMap}
            disabled={checkedCases.length === 0 || isGeocoding}
            className="w-full bg-blue-600 hover:bg-blue-700 text-sm h-9"
          >
            {isGeocoding
              ? <><Loader2 className="w-3 h-3 mr-2 animate-spin" />定位中...</>
              : <><MapPin className="w-3 h-3 mr-2" />顯示在地圖上</>
            }
          </Button>
        </div>
      </div>

      {/* 右側地圖 */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative">
          <div ref={mapRef} className="absolute inset-0" />

          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          )}

          {geocodedCases.length > 0 && mode === "idle" && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm text-slate-300 text-xs px-4 py-2 rounded-full border border-slate-700 pointer-events-none">
              點擊標記依序選擇訪視順序
            </div>
          )}

          {geocodedCases.length > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {mode !== "idle" && (
                <Button size="sm" variant="outline" onClick={resetRoute}
                  className="bg-slate-900/90 border-slate-700 text-slate-300 backdrop-blur-sm text-xs">
                  <RotateCcw className="w-3 h-3 mr-1" />重新選擇
                </Button>
              )}
              {mode === "idle" && manualOrder.length >= 2 && (
                <>
                  <Button size="sm" onClick={handleManualRoute}
                    className="bg-blue-600 hover:bg-blue-700 backdrop-blur-sm shadow-lg text-xs">
                    <Hand className="w-3 h-3 mr-1" />依點選順序
                  </Button>
                  <Button size="sm" onClick={handleAutoRoute} disabled={isPlanning}
                    className="bg-emerald-600 hover:bg-emerald-700 backdrop-blur-sm shadow-lg text-xs">
                    {isPlanning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                    自動最佳化
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 底部訪視順序 */}
        {mode !== "idle" && orderedCaseList.length > 0 && (
          <div className="bg-slate-900 border-t border-slate-800 p-4">
            <div className="flex items-start gap-6">
              {routeInfo && (
                <div className="flex gap-4 flex-shrink-0">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">總距離</p>
                    <p className="text-sm font-medium text-slate-200">{routeInfo.distance}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">預計時間</p>
                    <p className="text-sm font-medium text-slate-200">{routeInfo.duration}</p>
                  </div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 mb-2">
                  {mode === "manual" ? "手動排序" : "自動最佳化"} · 訪視順序
                </p>
                <div className="flex flex-wrap gap-2">
                  {orderedCaseList.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2.5 py-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-200">{c.clientName}</span>
                      <span className="text-xs text-slate-500">{c.district}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}