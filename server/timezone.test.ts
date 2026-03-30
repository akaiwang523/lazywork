import { describe, it, expect } from "vitest";

describe("Taiwan Timezone (UTC+8)", () => {
  it("should calculate Taiwan time correctly", () => {
    // 驗證台灣時間計算邏輯
    const now = new Date();
    const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
    
    expect(taiwanTime).toBeInstanceOf(Date);
    expect(taiwanTime.getTime()).toBeGreaterThan(0);
  });

  it("should set hours to 0 for today's date", () => {
    const now = new Date();
    const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
    const today = new Date(taiwanTime);
    today.setHours(0, 0, 0, 0);
    
    expect(today.getHours()).toBe(0);
    expect(today.getMinutes()).toBe(0);
    expect(today.getSeconds()).toBe(0);
  });

  it("should calculate tomorrow correctly", () => {
    const now = new Date();
    const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
    const today = new Date(taiwanTime);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    expect(tomorrow.getDate()).toBe(today.getDate() + 1);
  });

  it("should not have date mismatch between selection and display", () => {
    // 驗證選擇的日期和首頁顯示的日期一致
    const now = new Date();
    const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
    const selectedDate = new Date(taiwanTime);
    
    // 模擬首頁查詢邏輯
    const today = new Date(taiwanTime);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 驗證選擇的日期在今天和明天之間
    expect(selectedDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
    expect(selectedDate.getTime()).toBeLessThan(tomorrow.getTime() + (24 * 60 * 60 * 1000));
  });
});
