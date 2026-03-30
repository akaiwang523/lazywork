import { eq, and, gte, lte, like, lt, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, cases, Case, assessments, Assessment } from "../drizzle/schema";
import { ENV } from './_core/env';
import { sql } from "drizzle-orm";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function importCasesFromExcel(casesData: any[]): Promise<number> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    let importedCount = 0;
    for (const caseData of casesData) {
      try {
        await db.insert(cases).values({
          contractNumber: caseData.contractNumber || `auto-${Date.now()}-${Math.random()}`,
          sequenceNumber: caseData.sequenceNumber || 0,
          clientName: caseData.clientName || "",
          phone: caseData.phone || "",
          mobile: caseData.mobile || "",
          county: caseData.county || "",
          district: caseData.district || "",
          address: caseData.address || "",
          caseworker: caseData.caseworker || "",
          onlineDate: caseData.onlineDate || "",
          visitStatus: "unvisited",
          source: "excel",
        }).onDuplicateKeyUpdate({
          set: {
            updatedAt: new Date(),
          },
        });
        importedCount++;
      } catch (error) {
        console.warn(`[Database] Failed to import case: ${caseData.clientName}`, error);
      }
    }
    return importedCount;
  } catch (error) {
    console.error("[Database] Failed to import cases:", error);
    throw error;
  }
}

export async function getCasesByStatusAndDistrict(
  status: "unvisited" | "visited" | "all",
  district?: string
): Promise<Case[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get cases: database not available");
    return [];
  }

  try {
    const conditions = [];
    
    conditions.push(eq(cases.source, "excel"));
    
    if (status !== "all") {
      conditions.push(eq(cases.visitStatus, status));
    }

    if (district && district !== "all") {
      conditions.push(eq(cases.district, district));
    }

    if (conditions.length > 0) {
      return await db.select().from(cases).where(and(...conditions));
    }

    return await db.select().from(cases);
  } catch (error) {
    console.error("[Database] Failed to get cases:", error);
    throw error;
  }
}

export async function getCaseById(caseId: number): Promise<Case | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get case: database not available");
    return undefined;
  }

  try {
    const result = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to get case:", error);
    throw error;
  }
}

export async function updateCaseVisitStatus(
  caseId: number,
  status: "unvisited" | "visited"
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    await db.update(cases)
      .set({
        visitStatus: status,
        lastVisitedAt: status === "visited" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(cases.id, caseId));
  } catch (error) {
    console.error("[Database] Failed to update case visit status:", error);
    throw error;
  }
}

export async function getVisitStatistics() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get statistics: database not available");
    return { total: 0, visited: 0, unvisited: 0 };
  }

  try {
    const allCases = await db.select().from(cases).where(eq(cases.source, "excel"));
    const visited = allCases.filter(c => c.visitStatus === "visited").length;
    const unvisited = allCases.filter(c => c.visitStatus === "unvisited").length;
    
    return {
      total: allCases.length,
      visited,
      unvisited,
    };
  } catch (error) {
    console.error("[Database] Failed to get statistics:", error);
    throw error;
  }
}

export async function updateCaseScheduledVisitDate(
  caseId: number,
  scheduledDate: Date | null
) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    await db.update(cases)
      .set({
        scheduledVisitDate: scheduledDate,
        updatedAt: new Date(),
      })
      .where(eq(cases.id, caseId));
  } catch (error) {
    console.error("[Database] Failed to update case scheduled visit date:", error);
    throw error;
  }
}

export async function getTodaysCases(): Promise<Case[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get today's cases: database not available");
    return [];
  }

  try {
    // 使用台灣時間（UTC+8）
    const now = new Date();
    const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
    const today = new Date(taiwanTime);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const result = await db.select().from(cases).where(
      and(
        eq(cases.visitStatus, "unvisited"),
        sql`DATE(${cases.scheduledVisitDate}) = ${todayStr}`
      )
    );

    return result;
  } catch (error) {
    console.error("[Database] Failed to get today's cases:", error);
    return [];
  }
}

export async function getTomorrowsCases(): Promise<Case[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get tomorrow's cases: database not available");
    return [];
  }

  try {
    // 使用台灣時間（UTC+8）
    const now = new Date();
    const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
    const tomorrow = new Date(taiwanTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const result = await db.select().from(cases).where(
      and(
        eq(cases.visitStatus, "unvisited"),
        sql`DATE(${cases.scheduledVisitDate}) = ${tomorrowStr}`
      )
    );

    return result;
  } catch (error) {
    console.error("[Database] Failed to get tomorrow's cases:", error);
    return [];
  }
}

export async function createCaseManually(caseData: {
  clientName: string;
  district: string;
  address: string;
  phone?: string;
  mobile?: string;
  scheduledVisitDate?: Date;
}): Promise<Case | null> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const contractNumber = `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await db.insert(cases).values({
      contractNumber,
      sequenceNumber: 0,
      clientName: caseData.clientName,
      phone: caseData.phone || "",
      mobile: caseData.mobile || "",
      county: "台南市",
      district: caseData.district,
      address: caseData.address,
      caseworker: "手動新增",
      visitStatus: "unvisited",
      source: "manual",
      scheduledVisitDate: caseData.scheduledVisitDate,
    });

    const newCases = await db.select().from(cases).where(
      eq(cases.contractNumber, contractNumber)
    ).limit(1);
    
    return newCases.length > 0 ? newCases[0] : null;
  } catch (error) {
    console.error("[Database] Failed to create case manually:", error);
    throw error;
  }
}

export async function getAllDistricts(): Promise<string[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get districts: database not available");
    return [];
  }

  try {
    const result = await db.select({ district: cases.district }).from(cases)
      .where(eq(cases.source, "excel"));
    
    const districts = Array.from(new Set(result.map(r => r.district)))
      .filter(d => d && d.trim() !== "")
      .sort();
    
    return districts;
  } catch (error) {
    console.error("[Database] Failed to get districts:", error);
    return [];
  }
}


// Google Maps API 相關函數
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("[Geocoding] API key not configured");
      return null;
    }

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    );
    const data = await response.json() as { results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }> };

    if (data.results && data.results.length > 0 && data.results[0]?.geometry?.location) {
      return data.results[0].geometry.location;
    }
    return null;
  } catch (error) {
    console.error("[Geocoding] Error:", error);
    return null;
  }
}

export async function getOptimizedRoute(
  waypoints: Array<{ lat: number; lng: number }>
): Promise<{ distance: string; duration: string; polyline: string } | null> {
  try {
    if (waypoints.length < 2) {
      console.error("[Directions] Need at least 2 waypoints");
      return null;
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("[Directions] API key not configured");
      return null;
    }

    const origin = `${waypoints[0]?.lat},${waypoints[0]?.lng}`;
    const destination = `${waypoints[waypoints.length - 1]?.lat},${waypoints[waypoints.length - 1]?.lng}`;
    const waypointsStr = waypoints
      .slice(1, -1)
      .map((wp) => `${wp.lat},${wp.lng}`)
      .join("|");

    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", destination);
    if (waypoints.length > 2) {
      url.searchParams.set("waypoints", waypointsStr);
    }
    url.searchParams.set("optimize", "true");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    const data = await response.json() as {
      routes?: Array<{
        legs?: Array<{ distance?: { text: string }; duration?: { text: string } }>;
        overview_polyline?: { points: string };
      }>;
    };

    if (data.routes && data.routes.length > 0 && data.routes[0]) {
      const route = data.routes[0];
      let totalDistance = "";
      let totalDuration = "";

      if (route.legs) {
        const distances = route.legs
          .map((leg) => leg.distance?.text)
          .filter((d) => d);
        const durations = route.legs
          .map((leg) => leg.duration?.text)
          .filter((d) => d);
        totalDistance = distances.join(" + ");
        totalDuration = durations.join(" + ");
      }

      return {
        distance: totalDistance || "N/A",
        duration: totalDuration || "N/A",
        polyline: route.overview_polyline?.points || "",
      };
    }

    return null;
  } catch (error) {
    console.error("[Directions] Error:", error);
    return null;
  }
}


export async function searchCasesByNameAndDistrict(
  clientName: string,
  district: string
): Promise<Case[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot search cases: database not available");
    return [];
  }

  try {
    if (!clientName.trim() || district === "all") {
      return [];
    }

    const result = await db
      .select()
      .from(cases)
      .where(
        and(
          like(cases.clientName, `%${clientName}%`),
          eq(cases.district, district),
          eq(cases.visitStatus, "unvisited")
        )
      )
      .limit(10);

    return result;
  } catch (error) {
    console.error("[Database] Failed to search cases:", error);
    return [];
  }
}

export async function getMissedCases(): Promise<Case[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get missed cases: database not available");
    return [];
  }

  try {
    // 使用台灣時間（UTC+8）
    const now = new Date();
    const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
    const today = new Date(taiwanTime);
    today.setHours(0, 0, 0, 0);

    const result = await db.select().from(cases).where(
      and(
        eq(cases.visitStatus, "unvisited"),
        lt(cases.scheduledVisitDate, today)
      )
    );

    return result;
  } catch (error) {
    console.error("[Database] Failed to get missed cases:", error);
    return [];
  }
}

export async function getMissedCasesByDistrict(district: string): Promise<Case[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get missed cases by district: database not available");
    return [];
  }

  try {
    // 使用台灣時間（UTC+8）
    const now = new Date();
    const taiwanTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) - (now.getTimezoneOffset() * 60 * 1000));
    const today = new Date(taiwanTime);
    today.setHours(0, 0, 0, 0);

    const result = await db.select().from(cases).where(
      and(
        eq(cases.visitStatus, "unvisited"),
        lt(cases.scheduledVisitDate, today),
        eq(cases.district, district)
      )
    );

    return result;
  } catch (error) {
    console.error("[Database] Failed to get missed cases by district:", error);
    return [];
  }
}


/**
 * 保存評估表資料
 */
export async function saveAssessment(
  caseId: number,
  assessmentData: Record<string, any>,
  signatureUrl?: string
): Promise<Assessment> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  try {
    const now = new Date();
    const result = await db.insert(assessments).values({
      caseId,
      assessmentDate: now,
      assessmentData: JSON.stringify(assessmentData),
      signatureUrl: signatureUrl || null,
      status: "completed",
    });

    // 獲取剛插入的記錄
    const inserted = await db
      .select()
      .from(assessments)
      .where(eq(assessments.caseId, caseId))
      .orderBy(desc(assessments.createdAt))
      .limit(1);

    return inserted[0] || { id: 0, caseId, assessmentDate: now, assessmentData: JSON.stringify(assessmentData), signatureUrl, status: "completed", createdAt: now, updatedAt: now };
  } catch (error) {
    console.error("[Database] Failed to save assessment:", error);
    throw error;
  }
}

/**
 * 獲取個案的所有評估表記錄
 */
export async function getAssessmentsByCaseId(caseId: number): Promise<Assessment[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get assessments: database not available");
    return [];
  }

  try {
    const result = await db
      .select()
      .from(assessments)
      .where(eq(assessments.caseId, caseId))
      .orderBy(desc(assessments.createdAt));

    return result;
  } catch (error) {
    console.error("[Database] Failed to get assessments:", error);
    return [];
  }
}

/**
 * 獲取個案的最新評估表
 */
export async function getLatestAssessment(caseId: number): Promise<Assessment | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get latest assessment: database not available");
    return null;
  }

  try {
    const result = await db
      .select()
      .from(assessments)
      .where(eq(assessments.caseId, caseId))
      .orderBy(desc(assessments.createdAt))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[Database] Failed to get latest assessment:", error);
    return null;
  }
}
