import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";
import { InsertUser, users, cases, Case, assessments, Assessment, dailyReports } from "../drizzle/schema";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 個案資料表 - 存儲所有家訪個案的基本資訊
 */
export const cases = mysqlTable("cases", {
  id: int("id").autoincrement().primaryKey(),
  /** 成約單號 - 唯一識別碼 */
  contractNumber: varchar("contractNumber", { length: 64 }).notNull().unique(),
  /** 序號 - Excel 中的序號 */
  sequenceNumber: int("sequenceNumber").notNull(),
  /** 個案姓名 */
  clientName: varchar("clientName", { length: 128 }).notNull(),
  /** 連絡電話 */
  phone: varchar("phone", { length: 20 }),
  /** 手機 */
  mobile: varchar("mobile", { length: 20 }),
  /** 縣市 */
  county: varchar("county", { length: 64 }).notNull(),
  /** 鄉鎮區 */
  district: varchar("district", { length: 64 }).notNull(),
  /** 完整地址 */
  address: text("address").notNull(),
  /** 家訪員名稱 */
  caseworker: varchar("caseworker", { length: 128 }).notNull(),
  /** 上線日期 */
  onlineDate: varchar("onlineDate", { length: 20 }),
  /** 訪視狀態: unvisited=未訪視, visited=已訪視 */
  visitStatus: mysqlEnum("visitStatus", ["unvisited", "visited"]).default("unvisited").notNull(),
  /** 最後訪視日期 */
  lastVisitedAt: timestamp("lastVisitedAt"),
  /** 訪視日期 - 計劃的訪視日期 */
  scheduledVisitDate: timestamp("scheduledVisitDate"),
  /** 緯度 - 用於地圖顯示 */
  latitude: varchar("latitude", { length: 32 }),
  /** 經度 - 用於地圖顯示 */
  longitude: varchar("longitude", { length: 32 }),
  /** 地理編碼狀態: pending=待編碼, success=成功, failed=失敗 */
  geocodeStatus: mysqlEnum("geocodeStatus", ["pending", "success", "failed"]).default("pending").notNull(),
  /** 來源: excel=Excel匯入, manual=手動新增 */
  source: mysqlEnum("source", ["excel", "manual"]).default("excel").notNull(),
  isRescheduled: boolean("isRescheduled").default(false).notNull(),
  missedNote: text("missedNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Case = typeof cases.$inferSelect;
export type InsertCase = typeof cases.$inferInsert;

/**
 * 訪視歷史表 - 記錄每次訪視的詳細資訊
 */
export const visitHistory = mysqlTable("visitHistory", {
  id: int("id").autoincrement().primaryKey(),
  /** 關聯的個案 ID */
  caseId: int("caseId").notNull(),
  /** 訪視日期 */
  visitDate: timestamp("visitDate").notNull(),
  /** 訪視備註 */
  notes: text("notes"),
  /** 訪視結果: completed=完成, rescheduled=改期, unable_to_contact=無法聯繫 */
  result: mysqlEnum("result", ["completed", "rescheduled", "unable_to_contact"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VisitHistory = typeof visitHistory.$inferSelect;
export type InsertVisitHistory = typeof visitHistory.$inferInsert;

/**
 * 訪視路線表 - 記錄規劃的訪視路線
 */
export const visitRoutes = mysqlTable("visitRoutes", {
  id: int("id").autoincrement().primaryKey(),
  /** 路線名稱/日期 */
  routeName: varchar("routeName", { length: 128 }).notNull(),
  /** 選定的鄉鎮區 */
  district: varchar("district", { length: 64 }).notNull(),
  /** 路線中的個案 ID 列表（JSON 陣列） */
  caseIds: text("caseIds").notNull(),
  /** Google Maps 路線 JSON 資料 */
  routeData: text("routeData"),
  /** 預計訪視時間（分鐘） */
  estimatedDuration: int("estimatedDuration"),
  /** 路線狀態: planning=規劃中, in_progress=進行中, completed=已完成 */
  status: mysqlEnum("status", ["planning", "in_progress", "completed"]).default("planning").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VisitRoute = typeof visitRoutes.$inferSelect;
export type InsertVisitRoute = typeof visitRoutes.$inferInsert;

/**
 * 評估表資料表 - 存儲每次訪視的評估表填寫資料
 */
export const assessments = mysqlTable("assessments", {
  id: int("id").autoincrement().primaryKey(),
  /** 關聯的個案 ID */
  caseId: int("caseId").notNull(),
  /** 評估日期 */
  assessmentDate: timestamp("assessmentDate").notNull(),
  /** 評估表資料 (JSON 格式) - 包含所有評估欄位 */
  assessmentData: text("assessmentData").notNull(),
  /** 簽名圖片 URL (S3) */
  signatureUrl: text("signatureUrl"),
  /** 評估狀態: draft=草稿, completed=已完成 */
  status: mysqlEnum("status", ["draft", "completed"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = typeof assessments.$inferInsert;

export const dailyReports = mysqlTable("dailyReports", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 10 }).notNull().unique(),
  repair: text("repair").default("[]").notNull(),
  resource: text("resource").default("[]").notNull(),
  lifeHelp: text("lifeHelp").default("[]").notNull(),
  supplies: text("supplies").default("[]").notNull(),
  unvisitedNotes: text("unvisitedNotes").default("{}").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyReport = typeof dailyReports.$inferSelect;
export type InsertDailyReport = typeof dailyReports.$inferInsert;