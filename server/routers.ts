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

  cases: router({
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

    list: protectedProcedure
      .input(z.object({
        status: z.enum(["unvisited", "visited"]),
        district: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await getCasesByStatusAndDistrict(input.status, input.district);
      }),

    districts: protectedProcedure
      .query(async () => {
        return await getAllDistricts();
      }),

    detail: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getCaseById(input.id);
      }),

    updateVisitStatus: protectedProcedure
      .input(z.object({
        caseId: z.number(),
        status: z.enum(["unvisited", "visited"]),
      }))
      .mutation(async ({ input }) => {
        await updateCaseVisitStatus(input.caseId, input.status);
        return { success: true };
      }),

    statistics: protectedProcedure
      .query(async () => {
        return await getVisitStatistics();
      }),

    updateScheduledDate: protectedProcedure
      .input(z.object({
        caseId: z.number(),
        scheduledDate: z.date().nullable(),
      }))
      .mutation(async ({ input }) => {
        await updateCaseScheduledVisitDate(input.caseId, input.scheduledDate);
        return { success: true };
      }),

    todaysCases: protectedProcedure
      .query(async () => {
        return await getTodaysCases();
      }),

    tomorrowsCases: protectedProcedure
      .query(async () => {
        return await getTomorrowsCases();
      }),

    searchByNameAndDistrict: protectedProcedure
      .input(z.object({
        clientName: z.string(),
        district: z.string(),
      }))
      .query(async ({ input }) => {
        return await searchCasesByNameAndDistrict(input.clientName, input.district);
      }),

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

    getDailyReport: protectedProcedure
      .input(z.object({ date: z.string() }))
      .query(async ({ input }) => {
        const { getDailyReport } = await import("./db");
        return await getDailyReport(input.date);
      }),

    saveDailyReport: protectedProcedure
      .input(z.object({
        date: z.string(),
        repair: z.array(z.object({ name: z.string(), note: z.string() })),
        resource: z.array(z.object({ name: z.string(), note: z.string() })),
        lifeHelp: z.array(z.object({ name: z.string(), note: z.string() })),
        supplies: z.array(z.object({ name: z.string(), note: z.string() })),
        unvisitedNotes: z.record(z.string(), z.string()),
      }))
      .mutation(async ({ input }) => {
        const { saveDailyReport } = await import("./db");
        await saveDailyReport(input.date, input);
        return { success: true };
      }),

    ggetDailyReportExtra: protectedProcedure
      .input(z.object({ date: z.string() }))
      .query(async ({ input }) => {
        const { getDailyReportExtra } = await import("./db");
        return await getDailyReportExtra(input.date);
      }),

    updateMissedNote: protectedProcedure
      .input(z.object({
        caseId: z.number(),
        note: z.string(),
      }))
      .mutation(async ({ input }) => {
        const { updateMissedNote } = await import("./db");
        await updateMissedNote(input.caseId, input.note);
        return { success: true };
      }),
  }),

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

  assessments: router({
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

    getByCaseId: protectedProcedure
      .input(z.object({ caseId: z.number() }))
      .query(async ({ input }) => {
        const { getAssessmentsByCaseId } = await import("./db");
        return await getAssessmentsByCaseId(input.caseId);
      }),

    getLatest: protectedProcedure
      .input(z.object({ caseId: z.number() }))
      .query(async ({ input }) => {
        const { getLatestAssessment } = await import("./db");
        return await getLatestAssessment(input.caseId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
