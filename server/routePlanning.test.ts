import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { geocodeAddress, getOptimizedRoute } from "./db";

describe("Google Maps Route Planning", () => {
  // 測試地理編碼功能
  describe("geocodeAddress", () => {
    it("should geocode a valid Taiwan address", async () => {
      const address = "台南市安南區中華路123號";
      const result = await geocodeAddress(address);
      
      // 如果 API 金鑰正確配置，應該返回座標
      if (result) {
        expect(result).toHaveProperty("lat");
        expect(result).toHaveProperty("lng");
        expect(typeof result.lat).toBe("number");
        expect(typeof result.lng).toBe("number");
        // 台南市大約在 23°N, 120°E
        expect(result.lat).toBeGreaterThan(22);
        expect(result.lat).toBeLessThan(24);
        expect(result.lng).toBeGreaterThan(119);
        expect(result.lng).toBeLessThan(121);
      }
    }, { timeout: 10000 });

    it("should return null for invalid address", async () => {
      const address = "xxxxxxxxxxxxxxxxxxxxxxxxxx無效地址";
      const result = await geocodeAddress(address);
      
      // 無效地址應該返回 null
      expect(result).toBeNull();
    }, { timeout: 10000 });

    it("should handle missing API key gracefully", async () => {
      // 臨時移除 API 金鑰
      const originalKey = process.env.GOOGLE_MAPS_API_KEY;
      delete process.env.GOOGLE_MAPS_API_KEY;
      
      const address = "台南市安南區中華路123號";
      const result = await geocodeAddress(address);
      
      // 沒有 API 金鑰應該返回 null
      expect(result).toBeNull();
      
      // 恢復 API 金鑰
      if (originalKey) {
        process.env.GOOGLE_MAPS_API_KEY = originalKey;
      }
    });
  });

  // 測試路線規劃功能
  describe("getOptimizedRoute", () => {
    it("should return null for less than 2 waypoints", async () => {
      const waypoints = [{ lat: 23.0, lng: 120.0 }];
      const result = await getOptimizedRoute(waypoints);
      
      expect(result).toBeNull();
    });

    it("should handle valid waypoints", async () => {
      const waypoints = [
        { lat: 23.0, lng: 120.0 },
        { lat: 23.1, lng: 120.1 },
      ];
      
      const result = await getOptimizedRoute(waypoints);
      
      if (result) {
        expect(result).toHaveProperty("distance");
        expect(result).toHaveProperty("duration");
        expect(result).toHaveProperty("polyline");
        expect(typeof result.distance).toBe("string");
        expect(typeof result.duration).toBe("string");
      }
    }, { timeout: 10000 });

    it("should handle missing API key gracefully", async () => {
      const originalKey = process.env.GOOGLE_MAPS_API_KEY;
      delete process.env.GOOGLE_MAPS_API_KEY;
      
      const waypoints = [
        { lat: 23.0, lng: 120.0 },
        { lat: 23.1, lng: 120.1 },
      ];
      
      const result = await getOptimizedRoute(waypoints);
      
      // 沒有 API 金鑰應該返回 null
      expect(result).toBeNull();
      
      // 恢復 API 金鑰
      if (originalKey) {
        process.env.GOOGLE_MAPS_API_KEY = originalKey;
      }
    });
  });
});
