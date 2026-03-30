import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  importCasesFromExcel,
  getCasesByStatusAndDistrict,
  getAllDistricts,
  getCaseById,
  updateCaseVisitStatus,
  getVisitStatistics,
  updateCaseScheduledVisitDate,
  getTodaysCases,
  getTomorrowsCases,
  createCaseManually,
  searchCasesByNameAndDistrict,
  getMissedCases,
  getMissedCasesByDistrict,
} from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // 個案管理相關的 procedures
  cases: router({
    // 匯入 Excel 資料
    importExcel: protectedProcedure
      .input(z.array(z.object({
        sequenceNumber: z.number(),
        contractNumber: z.string(),
        clientName: z.string(),
        phone: z.string().optional(),
        mobile: z.string().optional(),
        county: z.string(),
        district: z.string(),
        address: z.string(),
        caseworker: z.string(),
        onlineDate: z.string().optional(),
      })))
      .mutation(async ({ input }) => {
        try {
          await importCasesFromExcel(input);
          return { success: true, count: input.length };
        } catch (error) {
          console.error("Import failed:", error);
          throw error;
        }
      }),

    // 獲取個案列表（按狀態與區域篩選）
    list: protectedProcedure
      .input(z.object({
        status: z.enum(["unvisited", "visited"]),
        district: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await getCasesByStatusAndDistrict(input.status, input.district);
      }),

    // 獲取所有鄉鎮區
    districts: protectedProcedure
      .query(async () => {
        return await getAllDistricts();
      }),

    // 獲取單個個案詳情
    detail: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getCaseById(input.id);
      }),

    // 更新個案訪視狀態
    updateVisitStatus: protectedProcedure
      .input(z.object({
        caseId: z.number(),
        status: z.enum(["unvisited", "visited"]),
      }))
      .mutation(async ({ input }) => {
        await updateCaseVisitStatus(input.caseId, input.status);
        return { success: true };
      }),

    // 獲取訪視統計
    statistics: protectedProcedure
      .query(async () => {
        return await getVisitStatistics();
      }),

    // 更新個案訪視日期
    updateScheduledDate: protectedProcedure
      .input(z.object({
        caseId: z.number(),
        scheduledDate: z.date().nullable(),
      }))
      .mutation(async ({ input }) => {
        await updateCaseScheduledVisitDate(input.caseId, input.scheduledDate);
        return { success: true };
      }),

    // 獲取今日待訪個案
    todaysCases: protectedProcedure
      .query(async () => {
        return await getTodaysCases();
      }),

    // 獲取明日待訪個案
    tomorrowsCases: protectedProcedure
      .query(async () => {
        return await getTomorrowsCases();
      }),

    // 搜尋個案
    searchByNameAndDistrict: protectedProcedure
      .input(z.object({
        clientName: z.string(),
        district: z.string(),
      }))
      .query(async ({ input }) => {
        return await searchCasesByNameAndDistrict(input.clientName, input.district);
      }),

    // 手動新增個案
    createManually: protectedProcedure
      .input(z.object({
        clientName: z.string(),
        district: z.string(),
        address: z.string(),
        phone: z.string().optional(),
        mobile: z.string().optional(),
        scheduledVisitDate: z.date().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          await createCaseManually(input);
          return { success: true };
        } catch (error) {
          console.error("Create case failed:", error);
          throw error;
        }
      }),

    // 未遇名單
    getMissedCases: protectedProcedure
      .query(async () => {
        return await getMissedCases();
      }),

    getMissedCasesByDistrict: protectedProcedure
      .input(z.object({ district: z.string() }))
      .query(async ({ input }) => {
        if (input.district === "all") {
          return await getMissedCases();
        }
        return await getMissedCasesByDistrict(input.district);
      }),
  }),

  // Google Maps 路線規劃 API
  maps: router({
    geocodeAddress: publicProcedure
      .input(z.object({ address: z.string() }))
      .mutation(async ({ input }) => {
        const { geocodeAddress } = await import("./db");
        return geocodeAddress(input.address);
      }),

    getOptimizedRoute: publicProcedure
      .input(
        z.object({
          waypoints: z.array(z.object({ lat: z.number(), lng: z.number() })),
        })
      )
      .mutation(async ({ input }) => {
        const { getOptimizedRoute } = await import("./db");
        return getOptimizedRoute(input.waypoints);
      }),
  }),

  // 評估表相關的 procedures
  assessments: router({
    // 保存評估表資料
    save: protectedProcedure
      .input(z.object({
        caseId: z.number(),
        assessmentData: z.record(z.string(), z.any()),
        signatureUrl: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { saveAssessment } = await import("./db");
        return await saveAssessment(input.caseId, input.assessmentData, input.signatureUrl);
      }),

    // 獲取個案的評估表記錄
    getByCaseId: protectedProcedure
      .input(z.object({ caseId: z.number() }))
      .query(async ({ input }) => {
        const { getAssessmentsByCaseId } = await import("./db");
        return await getAssessmentsByCaseId(input.caseId);
      }),

    // 獲取最新的評估表
    getLatest: protectedProcedure
      .input(z.object({ caseId: z.number() }))
      .query(async ({ input }) => {
        const { getLatestAssessment } = await import("./db");
        return await getLatestAssessment(input.caseId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
