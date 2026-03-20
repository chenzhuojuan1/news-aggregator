import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { scrapeSource, applyKeywordRules, parseManualText, convertToArticles, smartExtractFromHtml } from "./scraper";
import { generateReport, summarizeNews } from "./report";
import { sendReportEmail, testSmtpConnection } from "./mailer";
import { DEFAULT_SOURCES, DEFAULT_KEYWORD_RULES, SOURCE_TEMPLATES } from "./seed-defaults";
import type { Source, KeywordRule } from "../drizzle/schema";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ========== 信息源管理 ==========
  source: router({
    list: protectedProcedure.query(async () => {
      return db.listSources();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getSourceById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1, "名称不能为空"),
        layer: z.enum(["website", "api", "manual"]),
        url: z.string().optional(),
        sourceType: z.enum(["html", "rss", "api"]).default("html"),
        selectors: z.any().optional(),
        dateFormat: z.string().optional(),
        apiConfig: z.any().optional(),
        paginationConfig: z.any().optional(),
        description: z.string().optional(),
        enabled: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createSource(input as any);
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        layer: z.enum(["website", "api", "manual"]).optional(),
        url: z.string().optional(),
        sourceType: z.enum(["html", "rss", "api"]).optional(),
        selectors: z.any().optional(),
        dateFormat: z.string().optional(),
        apiConfig: z.any().optional(),
        paginationConfig: z.any().optional(),
        description: z.string().optional(),
        enabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateSource(id, data as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSource(input.id);
        return { success: true };
      }),

    // 测试抓取预览
    testScrape: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const source = await db.getSourceById(input.id);
        if (!source) throw new Error("信息源不存在");
        const result = await scrapeSource(source);
        return {
          items: result.items.slice(0, 10),
          totalCount: result.items.length,
          errors: result.errors,
        };
      }),

    // 获取预置模板列表
    templates: protectedProcedure.query(() => {
      return SOURCE_TEMPLATES;
    }),

    // 从模板一键添加信息源
    addFromTemplate: protectedProcedure
      .input(z.object({ templateIndex: z.number() }))
      .mutation(async ({ input }) => {
        const template = SOURCE_TEMPLATES[input.templateIndex];
        if (!template) throw new Error("模板不存在");
        const id = await db.createSource({
          name: template.name,
          layer: "website",
          url: template.url,
          sourceType: template.sourceType,
          selectors: Object.keys(template.selectors).length > 0 ? JSON.stringify(template.selectors) : null,
          dateFormat: (template as any).dateFormat || null,
          description: template.description,
          enabled: true,
        } as any);
        return { id, name: template.name };
      }),

    // 智能测试：只需URL就能抓取
    smartTest: protectedProcedure
      .input(z.object({ url: z.string().url("请输入有效的URL") }))
      .mutation(async ({ input }) => {
        try {
          const response = await fetch(input.url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            signal: AbortSignal.timeout(30000),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const html = await response.text();
          const items = smartExtractFromHtml(html, input.url);
          return {
            items: items.slice(0, 15),
            totalCount: items.length,
            errors: items.length === 0 ? ["未能自动识别新闻列表，该网站可能需要手动配置CSS选择器"] : [],
          };
        } catch (err: any) {
          return { items: [], totalCount: 0, errors: [`抓取失败: ${err.message}`] };
        }
      }),
  }),

  // ========== 关键词规则管理 ==========
  keywordRule: router({
    list: protectedProcedure.query(async () => {
      return db.listKeywordRules();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getKeywordRuleById(input.id);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1, "名称不能为空"),
        ruleType: z.enum(["include", "exclude", "whitelist"]),
        logic: z.enum(["or", "and"]).default("or"),
        keywords: z.array(z.string()),
        excludeStrength: z.enum(["hard", "soft"]).optional(),
        description: z.string().optional(),
        enabled: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createKeywordRule(input as any);
        return { id };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        ruleType: z.enum(["include", "exclude", "whitelist"]).optional(),
        logic: z.enum(["or", "and"]).optional(),
        keywords: z.array(z.string()).optional(),
        excludeStrength: z.enum(["hard", "soft"]).optional().nullable(),
        description: z.string().optional(),
        enabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateKeywordRule(id, data as any);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteKeywordRule(input.id);
        return { success: true };
      }),

    // 测试关键词匹配
    testMatch: protectedProcedure
      .input(z.object({ title: z.string() }))
      .mutation(async ({ input }) => {
        const rules = await db.getEnabledKeywordRules();
        return applyKeywordRules(input.title, rules);
      }),
  }),

  // ========== 文章管理 ==========
  article: router({
    list: protectedProcedure
      .input(z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        sourceId: z.number().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
        excludeExcluded: z.boolean().default(true),
      }))
      .query(async ({ input }) => {
        return db.listArticles({
          dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
          dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
          sourceId: input.sourceId,
          limit: input.limit,
          offset: input.offset,
          excludeExcluded: input.excludeExcluded,
        });
      }),

    // 手动粘贴新闻
    addManual: protectedProcedure
      .input(z.object({
        text: z.string().min(1, "请粘贴新闻内容"),
        sourceName: z.string().default("手动添加"),
      }))
      .mutation(async ({ input }) => {
        const parsedItems = parseManualText(input.text);
        if (parsedItems.length === 0) {
          return { added: 0, message: "未识别到有效的新闻条目，请检查格式" };
        }

        const rules = await db.getEnabledKeywordRules();
        const articlesToInsert = parsedItems.map(item => {
          const filterResult = applyKeywordRules(item.title, rules);
          return {
            title: item.title,
            url: item.url || null,
            publishDate: item.date ? new Date(item.date) : new Date(),
            matchedKeywords: filterResult.matchedKeywords,
            sourceName: input.sourceName,
            isManual: true,
            isExcluded: !filterResult.passed,
            inReport: false,
          };
        });

        await db.createArticlesBatch(articlesToInsert as any);
        const passedCount = articlesToInsert.filter(a => !a.isExcluded).length;
        return {
          added: articlesToInsert.length,
          passed: passedCount,
          excluded: articlesToInsert.length - passedCount,
          message: `成功添加 ${articlesToInsert.length} 条新闻，其中 ${passedCount} 条通过筛选`,
        };
      }),

    // 触发抓取所有启用的信息源
    scrapeAll: protectedProcedure.mutation(async () => {
      const enabledSources = await db.getEnabledSources();
      const rules = await db.getEnabledKeywordRules();
      const results: { sourceName: string; fetched: number; passed: number; errors: string[] }[] = [];

      for (const source of enabledSources) {
        if (source.layer === "manual") continue;
        try {
          const result = await scrapeSource(source);
          const articleList = convertToArticles(result, rules);
          if (articleList.length > 0) {
            await db.createArticlesBatch(articleList);
          }
          const passedCount = articleList.filter(a => !a.isExcluded).length;
          results.push({
            sourceName: source.name,
            fetched: result.items.length,
            passed: passedCount,
            errors: result.errors,
          });
        } catch (err: any) {
          results.push({
            sourceName: source.name,
            fetched: 0,
            passed: 0,
            errors: [err.message],
          });
        }
      }

      return { results };
    }),

    // 抓取单个信息源
    scrapeOne: protectedProcedure
      .input(z.object({ sourceId: z.number() }))
      .mutation(async ({ input }) => {
        const source = await db.getSourceById(input.sourceId);
        if (!source) throw new Error("信息源不存在");
        const rules = await db.getEnabledKeywordRules();
        const result = await scrapeSource(source);
        const articleList = convertToArticles(result, rules);
        if (articleList.length > 0) {
          await db.createArticlesBatch(articleList);
        }
        const passedCount = articleList.filter(a => !a.isExcluded).length;
        return {
          fetched: result.items.length,
          passed: passedCount,
          excluded: articleList.length - passedCount,
          errors: result.errors,
        };
      }),

    // LLM总结当日新闻
    summarize: protectedProcedure
      .input(z.object({
        dateFrom: z.string(),
        dateTo: z.string(),
      }))
      .mutation(async ({ input }) => {
        const dateFrom = new Date(input.dateFrom);
        const dateTo = new Date(input.dateTo);
        const articleList = await db.getArticlesByDateRange(dateFrom, dateTo, true);

        if (articleList.length === 0) {
          return { summary: "该日期范围内没有通过筛选的新闻，无法生成总结。", articleCount: 0 };
        }

        const summary = await summarizeNews(articleList);
        return { summary, articleCount: articleList.length };
      }),
  }),

  // ========== 报告管理 ==========
  report: router({
    list: protectedProcedure.query(async () => {
      return db.listReports();
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getReportById(input.id);
      }),

    generate: protectedProcedure
      .input(z.object({
        dateFrom: z.string(),
        dateTo: z.string(),
      }))
      .mutation(async ({ input }) => {
        const dateFrom = new Date(input.dateFrom);
        const dateTo = new Date(input.dateTo);
        const articleList = await db.getArticlesByDateRange(dateFrom, dateTo, true);

        if (articleList.length === 0) {
          return { id: null, message: "该日期范围内没有通过筛选的新闻" };
        }

        const reportData = await generateReport(dateFrom, dateTo, articleList);
        const id = await db.createReport({
          title: reportData.title,
          dateFrom,
          dateTo,
          contentHtml: reportData.contentHtml,
          contentText: reportData.contentText,
          articleCount: articleList.length,
        });

        return { id, articleCount: articleList.length, message: `报告已生成，包含 ${articleList.length} 条新闻` };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteReport(input.id);
        return { success: true };
      }),

    // 发送报告邮件
    sendEmail: protectedProcedure
      .input(z.object({ reportId: z.number() }))
      .mutation(async ({ input }) => {
        const report = await db.getReportById(input.reportId);
        if (!report) throw new Error("报告不存在");

        const config = await db.getEmailConfig();
        if (!config) throw new Error("请先配置邮件设置");

        const result = await sendReportEmail(
          config,
          report.title,
          report.contentHtml || "",
          report.contentText || "",
        );

        if (result.success) {
          await db.updateReport(input.reportId, {
            emailSent: true,
            emailSentAt: new Date(),
          });
        }

        return result;
      }),
  }),

  // ========== 邮件配置 ==========
  emailConfig: router({
    get: protectedProcedure.query(async () => {
      const config = await db.getEmailConfig();
      if (config) {
        // 隐藏密码
        return { ...config, smtpPass: config.smtpPass ? "••••••••" : null };
      }
      return null;
    }),

    save: protectedProcedure
      .input(z.object({
        smtpHost: z.string().optional(),
        smtpPort: z.number().optional(),
        smtpUser: z.string().optional(),
        smtpPass: z.string().optional(),
        fromEmail: z.string().optional(),
        fromName: z.string().optional(),
        recipients: z.array(z.string()).optional(),
        useSsl: z.boolean().optional(),
        dailySendTime: z.string().optional(),
        autoSendEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        // 如果密码是掩码，不更新密码字段
        const data = { ...input } as any;
        if (data.smtpPass === "••••••••") {
          delete data.smtpPass;
        }
        await db.upsertEmailConfig(data);
        return { success: true };
      }),

    testConnection: protectedProcedure
      .input(z.object({
        smtpHost: z.string(),
        smtpPort: z.number().default(587),
        smtpUser: z.string(),
        smtpPass: z.string(),
        useSsl: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        return testSmtpConnection(input);
      }),
  }),

  // ========== 初始化默认配置 ==========
  setup: router({
    seedDefaults: protectedProcedure.mutation(async () => {
      // 检查是否已有配置
      const existingSources = await db.listSources();
      const existingRules = await db.listKeywordRules();

      let sourcesAdded = 0;
      let rulesAdded = 0;

      if (existingSources.length === 0) {
        for (const src of DEFAULT_SOURCES) {
          await db.createSource(src as any);
          sourcesAdded++;
        }
      }

      // 始终检查关键词规则是否存在，确保信息源和规则同步初始化
      if (existingRules.length === 0) {
        for (const rule of DEFAULT_KEYWORD_RULES) {
          const ruleData = {
            ...rule,
            keywords: typeof rule.keywords === 'string' ? rule.keywords : JSON.stringify(rule.keywords),
          };
          await db.createKeywordRule(ruleData as any);
          rulesAdded++;
        }
      }

      return {
        sourcesAdded,
        rulesAdded,
        message: sourcesAdded > 0 || rulesAdded > 0
          ? `已初始化 ${sourcesAdded} 个信息源和 ${rulesAdded} 条关键词规则`
          : "配置已存在，无需重复初始化",
      };
    }),

    // 单独初始化关键词规则（用于信息源已存在但规则缺失的情况）
    seedKeywordRules: protectedProcedure.mutation(async () => {
      const existingRules = await db.listKeywordRules();
      if (existingRules.length > 0) {
        return { rulesAdded: 0, message: `已有 ${existingRules.length} 条关键词规则，无需重复初始化` };
      }

      let rulesAdded = 0;
      for (const rule of DEFAULT_KEYWORD_RULES) {
        const ruleData = {
          ...rule,
          keywords: typeof rule.keywords === 'string' ? rule.keywords : JSON.stringify(rule.keywords),
        };
        await db.createKeywordRule(ruleData as any);
        rulesAdded++;
      }

      return { rulesAdded, message: `已初始化 ${rulesAdded} 条关键词规则` };
    }),

    checkStatus: protectedProcedure.query(async () => {
      const sources = await db.listSources();
      const rules = await db.listKeywordRules();
      return {
        hasSources: sources.length > 0,
        hasRules: rules.length > 0,
        sourceCount: sources.length,
        ruleCount: rules.length,
      };
    }),
  }),

  // ========== Cron触发端点 ==========
  cron: router({
    dailyScrapeAndReport: publicProcedure.mutation(async () => {
      // 1. 抓取所有启用的信息源
      const enabledSources = await db.getEnabledSources();
      const rules = await db.getEnabledKeywordRules();
      let totalFetched = 0;
      let totalPassed = 0;

      for (const source of enabledSources) {
        if (source.layer === "manual") continue;
        try {
          const result = await scrapeSource(source);
          const articleList = convertToArticles(result, rules);
          if (articleList.length > 0) {
            await db.createArticlesBatch(articleList);
          }
          totalFetched += result.items.length;
          totalPassed += articleList.filter(a => !a.isExcluded).length;
        } catch (err) {
          console.error(`[Cron] Failed to scrape ${source.name}:`, err);
        }
      }

      // 2. 生成昨日报告
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const articleList = await db.getArticlesByDateRange(yesterday, todayStart, true);

      if (articleList.length > 0) {
        const reportData = await generateReport(yesterday, todayStart, articleList);
        const reportId = await db.createReport({
          title: reportData.title,
          dateFrom: yesterday,
          dateTo: todayStart,
          contentHtml: reportData.contentHtml,
          contentText: reportData.contentText,
          articleCount: articleList.length,
        });

        // 3. 发送邮件
        const config = await db.getEmailConfig();
        if (config?.autoSendEnabled) {
          const emailResult = await sendReportEmail(
            config,
            reportData.title,
            reportData.contentHtml,
            reportData.contentText,
          );
          if (emailResult.success) {
            await db.updateReport(reportId, { emailSent: true, emailSentAt: new Date() });
          }
        }
      }

      return { totalFetched, totalPassed, articlesInReport: articleList.length };
    }),
  }),
});

export type AppRouter = typeof appRouter;
