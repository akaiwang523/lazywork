import { describe, it, expect } from "vitest";

describe("Google Maps API", () => {
  it("should have valid API key in environment", () => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toBeTruthy();
    expect(apiKey).toMatch(/^AIza/); // Google API keys start with "AIza"
  });

  it("should have valid frontend API key in environment", () => {
    const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toBeTruthy();
    expect(apiKey).toMatch(/^AIza/); // Google API keys start with "AIza"
  });

  it("should validate API key format", () => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    // Google API keys are typically 39 characters long
    expect(apiKey?.length).toBeGreaterThan(30);
    expect(apiKey?.length).toBeLessThan(50);
  });
});
