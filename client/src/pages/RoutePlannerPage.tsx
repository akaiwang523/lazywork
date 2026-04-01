import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, RotateCcw, Zap, Hand, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Calendar, Search } from "lucide-react";
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
  const [resultOpen, setResultOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<number, any>>(new Map());
  const polylineRef = useRef<any>(null);
  const manualOrderRef = useRef<number[]>([]);

  const { data: districts = [] } = trpc.cases.districts.useQuery();
  const { data: cases = [] } = trpc.cases.list.useQuery({
    status: "unvisited",
    district: selectedDistrict === "all" ? undefined : selectedDistrict,
  });
  const { data: tomorrowsCases = [] } = trpc.cases.tomorrowsCases.useQuery();
  const { data: todaysCases = [] } = trpc.cases.todaysCases.useQuery();

  const geocodeMutation = trpc.maps.geocodeAddress.useMutation();
  const routeMutation = trpc.maps.getOptimizedRoute.useMutation();

  const filteredCases = cases.filter(c =>
    searchQuery.trim() === "" ||
    c.clientName.includes(searchQuery.trim()) ||
    c.address.includes(searchQuery.trim())
  );

  useEffect(() => {
    if (window.google) { setMapReady(true); return; }
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) { toast.error("Google Maps API 金鑰未設定"); return; }
    window.initMap = () => setMapReady(true);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap&language=zh-TW`;
    script.async = true;
    document.head.appendChild(script);
    return () => { if (document.head.contains(script)) document.head.removeChild(script); };
  }, []);

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

  const drawPolyline = useCallback((orderIds: number[], gcases: GeocodedCase[]) => {
    if (polylineRef.current) { polylineRef.current.setMap(null); }
    const path = orderIds
      .map(id => gcases.find(c => c.id === id))
      .filter(Boolean)
      .map(c => ({ lat: c!.lat, lng: c!.lng }));
    if (path.length < 2 || !mapInstanceRef.current) return;
    polylineRef.current = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: "#10b981",
      strokeOpacity: 0.8,
      strokeWeight: 3,
      icons: [{ icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3 }, offset: "50%", repeat: "100px" }],
    });
    polylineRef.current.setMap(mapInstanceRef.current);
  }, []);

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
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: "#3b82f6", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 2 },
      });
      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div style="color:#1e293b;font-size:13px;padding:2px"><div style="font-weight:600">${gc.clientName}</div><div style="color:#64748b;margin-top:2px;font-size:12px">${gc.district} ${gc.address}</div></div>`,
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

  const geocodeAndShow = async (caseItems: CaseItem[]) => {
    if (caseItems.length === 0) { toast.error("沒有個案可定位"); return; }
    setIsGeocoding(true);
    setGeocodedCases([]);
    clearMarkers();
    const results: GeocodedCase[] = [];
    for (const c of caseItems) {
      try {
        const coords = await geocodeMutation.mutateAsync({ address: `台南市${c.district}${c.address}` });
        if (coords) results.push({ ...c, lat: coords.lat, lng: coords.lng });
      } catch {}
    }
    setIsGeocoding(false);
    if (results.length === 0) { toast.error("無法定位任何地址"); return; }
    if (results.length < caseItems.length) toast.warning(`${results.length}/${caseItems.length} 個地址成功定位`);
    setGeocodedCases(results);
    toast.success("地圖已更新，請點選標記決定訪視順序");
  };

  const handleShowOnMap = async () => {
    await geocodeAndShow(cases.filter(c => checkedCases.includes(c.id)));
  };

  const handleLoadToday = async () => {
    if (todaysCases.length === 0) { toast.error("今日沒有排定的行程"); return; }
    setCheckedCases(todaysCases.map((c: CaseItem) => c.id));
    await geocodeAndShow(todaysCases);
    toast.success(`已載入今日 ${todaysCases.length} 筆行程`);
  };

  const handleLoadTomorrow = async () => {
    if (tomorrowsCases.length === 0) { toast.error("明日沒有排定的行程"); return; }
    setCheckedCases(tomorrowsCases.map((c: CaseItem) => c.id));
    await geocodeAndShow(tomorrowsCases);
    toast.success(`已載入明日 ${tomorrowsCases.length} 筆行程`);
  };

  const handleManualRoute = () => {
    if (manualOrder.length < 2) { toast.error("請在地圖上點選至少 2 個個案"); return; }
    setMode("manual");
    setResultOpen(true);
    drawPolyline(manualOrder, geocodedCases);
    toast.success("已依點選順序排列路線");
  };

  const handleAutoRoute = async () => {
    const baseOrder = manualOrder.length >= 2 ? manualOrder : geocodedCases.map(c => c.id);
    const orderedItems = baseOrder.map(id => geocodedCases.find(c => c.id === id)).filter(Boolean) as GeocodedCase[];
    if (orderedItems.length < 2) { toast.error("請選擇至少 2 個個案"); return; }
    setIsPlanning(true);
    try {
      const route = await routeMutation.mutateAsync({ waypoints: orderedItems.map(c => ({ lat: c.lat, lng: c.lng })) });
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
        setResultOpen(true);
        setRouteInfo({ distance: route.distance, duration: route.duration });
        updateMarkers(finalOrder);
        drawPolyline(finalOrder, geocodedCases);
        toast.success("最佳路線規劃完成");
      }
    } catch { toast.error("路線規劃失敗"); }
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

  const openGoogleMaps = () => {
    const origin = orderedCaseList[0];
    const destination = orderedCaseList[orderedCaseList.length - 1];
    const waypoints = orderedCaseList.slice(1, -1);
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`台南市${origin.district}${origin.address}`)}&destination=${encodeURIComponent(`台南市${destination.district}${destination.address}`)}${waypoints.length ? `&waypoints=${waypoints.map(c => encodeURIComponent(`台南市${c.district}${c.address}`)).join('|')}` : ''}&travelmode=driving`;
    window.open(url, '_blank');
  };

  const orderedCaseList = manualOrder
    .map(id => geocodedCases.find(c => c.id === id))
    .filter(Boolean) as GeocodedCase[];

  return (
    <div className="flex h-screen bg-slate-950">
      {/* 左側清單 */}
      <div className={`flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-64" : "w-10"}`}>

        {/* 標題列 + 收合按鈕 */}
        <div className="flex items-center justify-between p-3 border-b border-slate-800 flex-shrink-0">
          {sidebarOpen && <h2 className="text-sm font-bold text-slate-100 truncate">選擇個案</h2>}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0 ml-auto"
          >
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {sidebarOpen && (
          <>
            {/* 篩選區 */}
            <div className="p-3 border-b border-slate-800 space-y-2 flex-shrink-0">
              <Select value={selectedDistrict} onValueChange={v => { setSelectedDistrict(v); setCheckedCases([]); }}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-100 h-8 text-xs">
                  <SelectValue placeholder="選擇鄉鎮區" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all">全部鄉鎮區</SelectItem>
                  {districts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                <Input
                  placeholder="搜尋姓名或地址"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-slate-200 h-8 text-xs pl-7"
                />
              </div>
            </div>

            {/* 個案清單 */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
              {filteredCases.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">沒有符合的個案</div>
              ) : filteredCases.map(c => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  onClick={() => setCheckedCases(prev =>
                    prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                  )}
                >
                  <Checkbox checked={checkedCases.includes(c.id)} onCheckedChange={() => {}} className="flex-shrink-0 w-3.5 h-3.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{c.clientName}</p>
                    <p className="text-xs text-slate-500 truncate">{c.district}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 底部按鈕 */}
            <div className="p-2.5 border-t border-slate-800 space-y-1.5 flex-shrink-0">
              <p className="text-xs text-slate-500 text-center">已勾選 {checkedCases.length} 個</p>
              <Button
                onClick={handleLoadToday}
                disabled={isGeocoding}
                variant="outline"
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-8"
              >
                <Calendar className="w-3 h-3 mr-1.5" />載入今日行程
              </Button>
              <Button
                onClick={handleLoadTomorrow}
                disabled={isGeocoding}
                variant="outline"
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-8"
              >
                <Calendar className="w-3 h-3 mr-1.5" />載入明日行程
              </Button>
              <Button
                onClick={handleShowOnMap}
                disabled={checkedCases.length === 0 || isGeocoding}
                className="w-full bg-blue-600 hover:bg-blue-700 text-xs h-8"
              >
                {isGeocoding
                  ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />定位中...</>
                  : <><MapPin className="w-3 h-3 mr-1.5" />顯示在地圖上</>
                }
              </Button>
            </div>
          </>
        )}
      </div>

      {/* 右側地圖 */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
                  className="bg-slate-900/90 border-slate-700 text-slate-300 backdrop-blur-sm text-xs h-8">
                  <RotateCcw className="w-3 h-3 mr-1" />重新選擇
                </Button>
              )}
              {mode === "idle" && manualOrder.length >= 2 && (
                <>
                  <Button size="sm" onClick={handleManualRoute}
                    className="bg-blue-600 hover:bg-blue-700 backdrop-blur-sm shadow-lg text-xs h-8">
                    <Hand className="w-3 h-3 mr-1" />依點選順序
                  </Button>
                  <Button size="sm" onClick={handleAutoRoute} disabled={isPlanning}
                    className="bg-emerald-600 hover:bg-emerald-700 backdrop-blur-sm shadow-lg text-xs h-8">
                    {isPlanning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                    自動最佳化
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 底部結果列 — 可收合 */}
        {mode !== "idle" && orderedCaseList.length > 0 && (
          <div className="bg-slate-900 border-t border-slate-800 flex-shrink-0">
            <button
              onClick={() => setResultOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-400 hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-300">
                  {mode === "manual" ? "手動排序" : "自動最佳化"} · {orderedCaseList.length} 個個案
                </span>
                {routeInfo && (
                  <span className="text-slate-500">{routeInfo.distance} · {routeInfo.duration}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={e => { e.stopPropagation(); openGoogleMaps(); }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-xs h-6 px-2"
                >
                  <MapPin className="w-3 h-3 mr-1" />Google Maps 導航
                </Button>
                {resultOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </div>
            </button>

            {resultOpen && (
              <div className="px-4 pb-3">
                <div className="flex flex-wrap gap-1.5">
                  {orderedCaseList.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2 py-1">
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-xs text-slate-200">{c.clientName}</span>
                      <span className="text-xs text-slate-500">{c.district}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}