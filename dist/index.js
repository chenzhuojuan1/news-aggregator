// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;

// server/db.ts
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

// drizzle/schema.ts
import { integer, pgEnum, pgTable, text, timestamp, varchar, boolean, json, serial } from "drizzle-orm/pg-core";
var roleEnum = pgEnum("role", ["user", "admin"]);
var layerEnum = pgEnum("layer", ["website", "api", "manual"]);
var sourceTypeEnum = pgEnum("source_type", ["html", "rss", "api"]);
var ruleTypeEnum = pgEnum("rule_type", ["include", "exclude", "whitelist"]);
var logicEnum = pgEnum("logic", ["or", "and"]);
var excludeStrengthEnum = pgEnum("exclude_strength", ["hard", "soft"]);
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  password: varchar("password", { length: 200 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull()
});
var sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  layer: layerEnum("layer").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  url: text("url"),
  sourceType: sourceTypeEnum("source_type").default("html").notNull(),
  selectors: json("selectors"),
  dateFormat: varchar("date_format", { length: 100 }),
  apiConfig: json("api_config"),
  paginationConfig: json("pagination_config"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var keywordRules = pgTable("keyword_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  ruleType: ruleTypeEnum("rule_type").notNull(),
  logic: logicEnum("logic").default("or").notNull(),
  keywords: json("keywords").notNull(),
  excludeStrength: excludeStrengthEnum("exclude_strength"),
  enabled: boolean("enabled").default(true).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id"),
  title: varchar("title", { length: 500 }).notNull(),
  titleCn: varchar("title_cn", { length: 500 }),
  url: text("url"),
  publishDate: timestamp("publish_date"),
  matchedKeywords: json("matched_keywords"),
  summary: text("summary"),
  sourceName: varchar("source_name", { length: 200 }),
  inReport: boolean("in_report").default(false).notNull(),
  isManual: boolean("is_manual").default(false).notNull(),
  isExcluded: boolean("is_excluded").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  dateFrom: timestamp("date_from").notNull(),
  dateTo: timestamp("date_to").notNull(),
  contentHtml: text("content_html"),
  contentText: text("content_text"),
  articleCount: integer("article_count").default(0).notNull(),
  emailSent: boolean("email_sent").default(false).notNull(),
  emailSentAt: timestamp("email_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var emailConfig = pgTable("email_config", {
  id: serial("id").primaryKey(),
  smtpHost: varchar("smtp_host", { length: 200 }),
  smtpPort: integer("smtp_port").default(587),
  smtpUser: varchar("smtp_user", { length: 200 }),
  smtpPass: varchar("smtp_pass", { length: 500 }),
  fromEmail: varchar("from_email", { length: 320 }),
  fromName: varchar("from_name", { length: 200 }),
  recipients: json("recipients"),
  useSsl: boolean("use_ssl").default(false).notNull(),
  dailySendTime: varchar("daily_send_time", { length: 10 }).default("08:00"),
  autoSendEnabled: boolean("auto_send_enabled").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// server/db.ts
var _db = null;
async function getDb() {
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
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    if (existing.length > 0) {
      const updateSet = {};
      if (user.name !== void 0) updateSet.name = user.name;
      if (user.email !== void 0) updateSet.email = user.email;
      if (user.loginMethod !== void 0) updateSet.loginMethod = user.loginMethod;
      if (user.lastSignedIn !== void 0) updateSet.lastSignedIn = user.lastSignedIn;
      if (user.role !== void 0) updateSet.role = user.role;
      if (user.password !== void 0) updateSet.password = user.password;
      updateSet.updatedAt = /* @__PURE__ */ new Date();
      if (Object.keys(updateSet).length > 0) {
        await db.update(users).set(updateSet).where(eq(users.openId, user.openId));
      }
    } else {
      await db.insert(users).values({
        ...user,
        lastSignedIn: user.lastSignedIn || /* @__PURE__ */ new Date()
      });
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function listSources() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sources).orderBy(desc(sources.createdAt));
}
async function getSourceById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
  return result[0];
}
async function createSource(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(sources).values(data).returning({ id: sources.id });
  return result[0].id;
}
async function updateSource(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sources).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(sources.id, id));
}
async function deleteSource(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(sources).where(eq(sources.id, id));
}
async function getEnabledSources() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sources).where(eq(sources.enabled, true));
}
async function listKeywordRules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(keywordRules).orderBy(desc(keywordRules.createdAt));
}
async function getKeywordRuleById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(keywordRules).where(eq(keywordRules.id, id)).limit(1);
  return result[0];
}
async function createKeywordRule(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(keywordRules).values(data).returning({ id: keywordRules.id });
  return result[0].id;
}
async function updateKeywordRule(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(keywordRules).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(keywordRules.id, id));
}
async function deleteKeywordRule(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(keywordRules).where(eq(keywordRules.id, id));
}
async function getEnabledKeywordRules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(keywordRules).where(eq(keywordRules.enabled, true));
}
async function listArticles(opts) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions = [];
  if (opts.dateFrom) conditions.push(gte(articles.publishDate, opts.dateFrom));
  if (opts.dateTo) conditions.push(lte(articles.publishDate, opts.dateTo));
  if (opts.sourceId) conditions.push(eq(articles.sourceId, opts.sourceId));
  if (opts.excludeExcluded) conditions.push(eq(articles.isExcluded, false));
  const where = conditions.length > 0 ? and(...conditions) : void 0;
  const [items, countResult] = await Promise.all([
    db.select().from(articles).where(where).orderBy(desc(articles.publishDate)).limit(opts.limit ?? 50).offset(opts.offset ?? 0),
    db.select({ count: sql`count(*)` }).from(articles).where(where)
  ]);
  return { items, total: Number(countResult[0]?.count ?? 0) };
}
async function createArticlesBatch(dataList) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (dataList.length === 0) return;
  await db.insert(articles).values(dataList);
}
async function getArticlesByDateRange(dateFrom, dateTo, excludeExcluded = true) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [gte(articles.publishDate, dateFrom), lte(articles.publishDate, dateTo)];
  if (excludeExcluded) conditions.push(eq(articles.isExcluded, false));
  return db.select().from(articles).where(and(...conditions)).orderBy(desc(articles.publishDate));
}
async function listReports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reports).orderBy(desc(reports.createdAt));
}
async function getReportById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  return result[0];
}
async function createReport(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reports).values(data).returning({ id: reports.id });
  return result[0].id;
}
async function updateReport(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reports).set(data).where(eq(reports.id, id));
}
async function deleteReport(id) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(reports).where(eq(reports.id, id));
}
async function getEmailConfig() {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(emailConfig).limit(1);
  return result[0];
}
async function upsertEmailConfig(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getEmailConfig();
  if (existing) {
    await db.update(emailConfig).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(emailConfig.id, existing.id));
  } else {
    await db.insert(emailConfig).values(data);
  }
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// server/_core/env.ts
var ENV = {
  cookieSecret: process.env.JWT_SECRET || "change-me-in-production-secret-key-2024",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin123"
};

// server/_core/oauth.ts
import { SignJWT } from "jose";
import crypto from "crypto";
async function createSessionToken(openId, name) {
  const secretKey = new TextEncoder().encode(ENV.cookieSecret);
  const expiresInMs = ONE_YEAR_MS;
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1e3);
  return new SignJWT({
    openId,
    name
  }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
}
function registerOAuthRoutes(app) {
  app.post("/api/auth/login", async (req, res) => {
    const { password } = req.body || {};
    if (!password) {
      res.status(400).json({ error: "\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A" });
      return;
    }
    if (password !== ENV.adminPassword) {
      res.status(401).json({ error: "\u5BC6\u7801\u9519\u8BEF" });
      return;
    }
    try {
      const openId = "admin-" + crypto.createHash("md5").update(ENV.adminPassword).digest("hex").substring(0, 12);
      await upsertUser({
        openId,
        name: "\u7BA1\u7406\u5458",
        email: null,
        loginMethod: "password",
        role: "admin",
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await createSessionToken(openId, "\u7BA1\u7406\u5458");
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, message: "\u767B\u5F55\u6210\u529F" });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "\u767B\u5F55\u5931\u8D25" });
    }
  });
  app.get("/api/oauth/callback", (_req, res) => {
    res.redirect(302, "/");
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "\u8BF7\u5148\u767B\u5F55 (10001)" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "\u60A8\u6CA1\u6709\u6240\u9700\u6743\u9650 (10002)" });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  }))
});

// server/routers.ts
import { z as z2 } from "zod";

// server/scraper.ts
import * as cheerio from "cheerio";
async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    signal: AbortSignal.timeout(3e4)
  });
  if (!response.ok) {
    throw new Error(`HTTP\u8BF7\u6C42\u5931\u8D25: ${response.status} ${response.statusText}`);
  }
  return response.text();
}
function smartExtractFromHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const items = [];
  const seen = /* @__PURE__ */ new Set();
  $("nav, footer, header, aside, .sidebar, .nav, .footer, .header, .menu, .breadcrumb, script, style, noscript").remove();
  const listSelectors = [
    "article",
    ".news-item",
    ".news-list li",
    ".article-item",
    ".post-item",
    ".entry",
    ".item",
    ".list-item",
    "table.views-table tbody tr",
    // Drupal views
    ".view-content .views-row",
    // Drupal views
    "ul.news li",
    "ol li",
    ".press-release",
    ".announcement"
  ];
  for (const selector of listSelectors) {
    const elements = $(selector);
    if (elements.length >= 3) {
      elements.each((_, el) => {
        const $el = $(el);
        const $link = $el.find("a").first();
        const title = $link.text().trim() || $el.find("h2, h3, h4, .title").first().text().trim();
        if (!title || title.length < 5 || seen.has(title)) return;
        seen.add(title);
        let url = $link.attr("href") || "";
        if (url && !url.startsWith("http")) {
          try {
            url = new URL(url, baseUrl).href;
          } catch {
          }
        }
        const dateText = $el.find("time, .date, .time, .published, [datetime]").first().text().trim() || $el.find("time, .date, .time, .published").first().attr("datetime") || "";
        items.push({ title, url, date: dateText });
      });
      if (items.length >= 3) break;
    }
  }
  if (items.length < 3) {
    items.length = 0;
    seen.clear();
    $("a").each((_, el) => {
      const $a = $(el);
      const title = $a.text().trim();
      let href = $a.attr("href") || "";
      if (!title || title.length < 10 || seen.has(title)) return;
      if (href.startsWith("#") || href.startsWith("javascript:") || href === "/") return;
      if (/^\s*(Home|About|Contact|Login|Sign|Menu|More|Back|Next|Previous|\d+)\s*$/i.test(title)) return;
      if (/^(Other|All|View|See|Read|Show|Browse|Search|Filter|Sort|Category|Archive|Tag)\s/i.test(title)) return;
      if (/^(News|Announcements?|Press|Media|Publications?|Reports?|Statements?|Decisions?)$/i.test(title)) return;
      if (href.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip)$/i)) return;
      seen.add(title);
      if (href && !href.startsWith("http")) {
        try {
          href = new URL(href, baseUrl).href;
        } catch {
        }
      }
      items.push({ title, url: href, date: "" });
    });
  }
  return items;
}
async function scrapeHtmlSource(source) {
  const errors = [];
  const items = [];
  if (!source.url) {
    return { source, items, errors: ["\u4FE1\u606F\u6E90URL\u4E3A\u7A7A"] };
  }
  const selectors = source.selectors;
  try {
    const html = await fetchHtml(source.url);
    const $ = cheerio.load(html);
    if (selectors?.container && selectors?.title) {
      $(selectors.container).each((_, el) => {
        const $el = $(el);
        const title = $el.find(selectors.title).text().trim();
        if (!title) return;
        let url = "";
        if (selectors.link) {
          const linkEl = $el.find(selectors.link);
          url = linkEl.attr("href") || "";
        } else {
          const linkEl = $el.find(selectors.title);
          url = linkEl.attr("href") || linkEl.closest("a").attr("href") || "";
        }
        if (url && !url.startsWith("http")) {
          try {
            url = new URL(url, source.url).href;
          } catch {
          }
        }
        let date = "";
        if (selectors.date) {
          date = $el.find(selectors.date).text().trim();
        }
        let summary = "";
        if (selectors.summary) {
          summary = $el.find(selectors.summary).text().trim();
        }
        items.push({ title, url, date, summary });
      });
      if (items.length === 0) {
        errors.push("\u7CBE\u786E\u6A21\u5F0F\u672A\u627E\u5230\u5339\u914D\uFF0C\u5C1D\u8BD5\u667A\u80FD\u6293\u53D6...");
        const smartItems = smartExtractFromHtml(html, source.url);
        items.push(...smartItems);
        if (smartItems.length > 0) {
          errors.length = 0;
          errors.push(`\u5DF2\u81EA\u52A8\u5207\u6362\u5230\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF0C\u83B7\u53D6\u5230 ${smartItems.length} \u6761\u65B0\u95FB`);
        }
      }
    } else {
      const smartItems = smartExtractFromHtml(html, source.url);
      items.push(...smartItems);
      if (items.length === 0) {
        errors.push("\u667A\u80FD\u6293\u53D6\u672A\u627E\u5230\u65B0\u95FB\u6761\u76EE\uFF0C\u8BE5\u7F51\u7AD9\u53EF\u80FD\u9700\u8981\u624B\u52A8\u914D\u7F6ECSS\u9009\u62E9\u5668");
      }
    }
  } catch (err) {
    errors.push(`\u6293\u53D6\u5931\u8D25: ${err.message}`);
  }
  return { source, items, errors };
}
async function scrapeRssSource(source) {
  const errors = [];
  const items = [];
  if (!source.url) {
    return { source, items, errors: ["RSS\u8BA2\u9605\u5730\u5740\u4E3A\u7A7A"] };
  }
  try {
    const response = await fetch(source.url, {
      headers: { "User-Agent": "NewsAggregator/1.0", "Accept": "application/rss+xml,application/xml,text/xml,*/*" },
      signal: AbortSignal.timeout(3e4)
    });
    if (!response.ok) {
      return { source, items, errors: [`HTTP\u8BF7\u6C42\u5931\u8D25: ${response.status}`] };
    }
    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    $("item").each((_, el) => {
      const $el = $(el);
      items.push({
        title: $el.find("title").text().trim(),
        url: $el.find("link").text().trim() || $el.find("guid").text().trim(),
        date: $el.find("pubDate").text().trim(),
        summary: $el.find("description").text().trim().substring(0, 500)
      });
    });
    if (items.length === 0) {
      $("entry").each((_, el) => {
        const $el = $(el);
        items.push({
          title: $el.find("title").text().trim(),
          url: $el.find("link").attr("href") || "",
          date: $el.find("published").text().trim() || $el.find("updated").text().trim(),
          summary: $el.find("summary").text().trim().substring(0, 500)
        });
      });
    }
    if (items.length === 0) {
      errors.push("\u672A\u627E\u5230RSS/Atom\u6761\u76EE\uFF0C\u8BF7\u68C0\u67E5\u8BA2\u9605\u5730\u5740");
    }
  } catch (err) {
    errors.push(`RSS\u6293\u53D6\u5931\u8D25: ${err.message}`);
  }
  return { source, items, errors };
}
async function scrapeApiSource(source) {
  const errors = [];
  const items = [];
  const apiConfig = source.apiConfig;
  if (!apiConfig?.endpoint) {
    return { source, items, errors: ["API\u7AEF\u70B9\u5730\u5740\u4E3A\u7A7A"] };
  }
  try {
    const fetchOpts = {
      method: apiConfig.method || "GET",
      headers: {
        "User-Agent": "NewsAggregator/1.0",
        "Accept": "application/json",
        ...apiConfig.headers
      },
      signal: AbortSignal.timeout(3e4)
    };
    if (apiConfig.body && apiConfig.method === "POST") {
      fetchOpts.body = apiConfig.body;
      fetchOpts.headers["Content-Type"] = "application/json";
    }
    const response = await fetch(apiConfig.endpoint, fetchOpts);
    if (!response.ok) {
      return { source, items, errors: [`API\u8BF7\u6C42\u5931\u8D25: ${response.status}`] };
    }
    const json2 = await response.json();
    let dataArray = json2;
    if (apiConfig.dataPath) {
      const parts = apiConfig.dataPath.split(".");
      let current = json2;
      for (const part of parts) {
        current = current?.[part];
      }
      dataArray = Array.isArray(current) ? current : [];
    }
    if (!Array.isArray(dataArray)) {
      return { source, items, errors: ["API\u8FD4\u56DE\u6570\u636E\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u65E0\u6CD5\u63D0\u53D6\u65B0\u95FB\u5217\u8868"] };
    }
    for (const item of dataArray) {
      const title = apiConfig.titleField ? getNestedValue(item, apiConfig.titleField) : "";
      if (!title) continue;
      items.push({
        title: String(title),
        url: apiConfig.urlField ? String(getNestedValue(item, apiConfig.urlField) || "") : "",
        date: apiConfig.dateField ? String(getNestedValue(item, apiConfig.dateField) || "") : "",
        summary: apiConfig.summaryField ? String(getNestedValue(item, apiConfig.summaryField) || "").substring(0, 500) : ""
      });
    }
    if (items.length === 0) {
      errors.push("API\u8FD4\u56DE\u6570\u636E\u4E2D\u672A\u627E\u5230\u65B0\u95FB\u6761\u76EE\uFF0C\u8BF7\u68C0\u67E5\u5B57\u6BB5\u6620\u5C04\u914D\u7F6E");
    }
  } catch (err) {
    errors.push(`API\u6293\u53D6\u5931\u8D25: ${err.message}`);
  }
  return { source, items, errors };
}
function getNestedValue(obj, path3) {
  return path3.split(".").reduce((current, key) => current?.[key], obj);
}
async function scrapeSource(source) {
  switch (source.sourceType) {
    case "html":
      return scrapeHtmlSource(source);
    case "rss":
      return scrapeRssSource(source);
    case "api":
      return scrapeApiSource(source);
    default:
      return { source, items: [], errors: [`\u4E0D\u652F\u6301\u7684\u4FE1\u606F\u6E90\u7C7B\u578B: ${source.sourceType}`] };
  }
}
function applyKeywordRules(title, rules) {
  const titleLower = title.toLowerCase();
  const matchedKeywords = [];
  const includeRules = rules.filter((r) => r.ruleType === "include" && r.enabled);
  const excludeRules = rules.filter((r) => r.ruleType === "exclude" && r.enabled);
  const whitelistRules = rules.filter((r) => r.ruleType === "whitelist" && r.enabled);
  for (const rule of whitelistRules) {
    const keywords = rule.keywords;
    for (const kw of keywords) {
      if (titleLower.includes(kw.toLowerCase())) {
        matchedKeywords.push(kw);
        return { passed: true, matchedKeywords };
      }
    }
  }
  for (const rule of excludeRules) {
    if (rule.excludeStrength !== "hard") continue;
    const keywords = rule.keywords;
    for (const kw of keywords) {
      if (titleLower.includes(kw.toLowerCase())) {
        return { passed: false, matchedKeywords: [], excludeReason: `\u786C\u6392\u9664: "${kw}"` };
      }
    }
  }
  let softExcludeReason = "";
  for (const rule of excludeRules) {
    if (rule.excludeStrength !== "soft") continue;
    const keywords = rule.keywords;
    for (const kw of keywords) {
      if (titleLower.includes(kw.toLowerCase())) {
        softExcludeReason = `\u8F6F\u6392\u9664: "${kw}"`;
        break;
      }
    }
    if (softExcludeReason) break;
  }
  let includeMatched = false;
  if (includeRules.length === 0) {
    includeMatched = true;
  } else {
    for (const rule of includeRules) {
      const keywords = rule.keywords;
      if (rule.logic === "and") {
        const allMatch = keywords.every((kw) => titleLower.includes(kw.toLowerCase()));
        if (allMatch) {
          includeMatched = true;
          matchedKeywords.push(...keywords);
        }
      } else {
        for (const kw of keywords) {
          if (titleLower.includes(kw.toLowerCase())) {
            includeMatched = true;
            matchedKeywords.push(kw);
          }
        }
      }
    }
  }
  if (!includeMatched) {
    return { passed: false, matchedKeywords: [], excludeReason: "\u672A\u5339\u914D\u4EFB\u4F55\u5305\u542B\u89C4\u5219" };
  }
  if (softExcludeReason) {
    return { passed: false, matchedKeywords, excludeReason: softExcludeReason };
  }
  return { passed: true, matchedKeywords: Array.from(new Set(matchedKeywords)) };
}
function parseManualText(text2) {
  const items = [];
  const blocks = text2.split(/\n\s*\n/).filter((b) => b.trim());
  for (const block of blocks) {
    const lines = block.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    let title = lines[0];
    let url = "";
    let date = "";
    for (const line of lines) {
      const urlMatch = line.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        url = urlMatch[0];
        break;
      }
    }
    for (const line of lines) {
      const dateMatch = line.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/) || line.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/) || line.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}/i);
      if (dateMatch) {
        date = dateMatch[0];
        break;
      }
    }
    title = title.replace(/https?:\/\/[^\s]+/g, "").trim();
    if (title) {
      items.push({ title, url, date });
    }
  }
  if (items.length === 0) {
    const lines = text2.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const urlMatch = line.match(/https?:\/\/[^\s]+/);
      const cleanTitle = line.replace(/https?:\/\/[^\s]+/g, "").trim();
      if (cleanTitle.length > 5) {
        items.push({
          title: cleanTitle,
          url: urlMatch?.[0] || "",
          date: ""
        });
      }
    }
  }
  return items;
}
function convertToArticles(result, rules) {
  const articleList = [];
  for (const item of result.items) {
    const filterResult = applyKeywordRules(item.title, rules);
    articleList.push({
      sourceId: result.source.id,
      title: item.title,
      url: item.url,
      publishDate: parseDate(item.date) || /* @__PURE__ */ new Date(),
      matchedKeywords: filterResult.matchedKeywords,
      summary: item.summary || null,
      sourceName: result.source.name,
      inReport: false,
      isManual: false,
      isExcluded: !filterResult.passed
    });
  }
  return articleList;
}
function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// server/_core/llm.ts
var normalizeMessage = (message) => {
  const { role, name, tool_call_id, content } = message;
  if (typeof content === "string") {
    return { role, name, tool_call_id, content };
  }
  if (Array.isArray(content)) {
    const parts = content.map((part) => {
      if (typeof part === "string") return { type: "text", text: part };
      return part;
    });
    if (parts.length === 1 && parts[0].type === "text") {
      return { role, name, content: parts[0].text };
    }
    return { role, name, content: parts };
  }
  if (content && typeof content === "object" && "type" in content) {
    if (content.type === "text") return { role, name, content: content.text };
    return { role, name, content: [content] };
  }
  return { role, name, content: "" };
};
async function invokeLLM(params) {
  if (!ENV.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured. Set it in environment variables.");
  }
  const { messages, tools, toolChoice, tool_choice, response_format, responseFormat } = params;
  const apiUrl = `${ENV.openaiBaseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  const payload = {
    model: ENV.openaiModel,
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const tc = toolChoice || tool_choice;
  if (tc) {
    if (tc === "required" && tools && tools.length === 1) {
      payload.tool_choice = { type: "function", function: { name: tools[0].function.name } };
    } else if (typeof tc === "object" && "name" in tc) {
      payload.tool_choice = { type: "function", function: { name: tc.name } };
    } else {
      payload.tool_choice = tc;
    }
  }
  const rf = responseFormat || response_format;
  if (rf) {
    payload.response_format = rf;
  }
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openaiApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}

// server/report.ts
async function batchTranslateTitles(titles) {
  if (titles.length === 0) return [];
  const results = new Array(titles.length);
  const toTranslate = [];
  for (let i = 0; i < titles.length; i++) {
    if (isChinese(titles[i])) {
      results[i] = titles[i];
    } else {
      toTranslate.push({ index: i, title: titles[i] });
    }
  }
  if (toTranslate.length === 0) return results;
  const batchSize = 20;
  for (let i = 0; i < toTranslate.length; i += batchSize) {
    const batch = toTranslate.slice(i, i + batchSize);
    const numberedTitles = batch.map((item, idx) => `${idx + 1}. ${item.title}`).join("\n");
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u91D1\u878D\u7FFB\u8BD1\u3002\u8BF7\u5C06\u4EE5\u4E0B\u7F16\u53F7\u7684\u82F1\u6587\u6807\u9898\u9010\u6761\u7FFB\u8BD1\u4E3A\u7B80\u6D01\u51C6\u786E\u7684\u4E2D\u6587\u3002\u4FDD\u6301\u7F16\u53F7\u683C\u5F0F\uFF0C\u6BCF\u884C\u4E00\u6761\u7FFB\u8BD1\u7ED3\u679C\u3002"
          },
          { role: "user", content: numberedTitles }
        ]
      });
      const rawContent = response.choices?.[0]?.message?.content;
      const translated = typeof rawContent === "string" ? rawContent.trim() : "";
      const lines = translated.split("\n").filter((l) => l.trim());
      for (let j = 0; j < batch.length; j++) {
        const line = lines[j];
        if (line) {
          results[batch[j].index] = line.replace(/^\d+\.\s*/, "").trim();
        } else {
          results[batch[j].index] = batch[j].title;
        }
      }
    } catch (err) {
      console.error("[BatchTranslation] Failed:", err);
      for (const item of batch) {
        results[item.index] = item.title;
      }
    }
  }
  return results;
}
function isChinese(text2) {
  return /[\u4e00-\u9fff]/.test(text2) && !/^[a-zA-Z\s]+$/.test(text2);
}
async function summarizeNews(articleList) {
  if (articleList.length === 0) {
    return "\u5F53\u524D\u65E5\u671F\u8303\u56F4\u5185\u6CA1\u6709\u901A\u8FC7\u7B5B\u9009\u7684\u65B0\u95FB\u3002";
  }
  const titles = articleList.map((a) => a.title);
  const translations = await batchTranslateTitles(titles);
  for (let i = 0; i < articleList.length; i++) {
    if (!articleList[i].titleCn && translations[i] !== articleList[i].title) {
      articleList[i].titleCn = translations[i];
    }
  }
  const newsListText = articleList.map((a, idx) => {
    const cnTitle = a.titleCn && a.titleCn !== a.title ? `
   \u4E2D\u6587: ${a.titleCn}` : "";
    const source = a.sourceName ? `
   \u6765\u6E90: ${a.sourceName}` : "";
    const link = a.url ? `
   \u94FE\u63A5: ${a.url}` : "";
    const keywords = a.matchedKeywords?.length ? `
   \u5173\u952E\u8BCD: ${a.matchedKeywords.join(", ")}` : "";
    return `${idx + 1}. ${a.title}${cnTitle}${source}${keywords}${link}`;
  }).join("\n\n");
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `\u4F60\u662F\u4E00\u4F4D\u8D44\u6DF1\u91D1\u878D\u76D1\u7BA1\u653F\u7B56\u5206\u6790\u5E08\u3002\u8BF7\u6839\u636E\u4EE5\u4E0B\u65B0\u95FB\u6807\u9898\u5217\u8868\uFF0C\u751F\u6210\u4E00\u4EFD\u7B80\u6D01\u7684\u4E2D\u6587\u603B\u7ED3\u62A5\u544A\u3002

\u8981\u6C42\uFF1A
1. \u6309\u4E3B\u9898\u5206\u7C7B\u5F52\u7EB3\uFF08\u5982\uFF1A\u4EA4\u6613\u6240\u52A8\u6001\u3001\u76D1\u7BA1\u653F\u7B56\u3001\u5E02\u573A\u7ED3\u6784\u3001\u6280\u672F\u521B\u65B0\u3001\u8DE8\u5883\u5408\u4F5C\u7B49\uFF09
2. \u6BCF\u4E2A\u4E3B\u9898\u4E0B\u75282-3\u53E5\u8BDD\u6982\u62EC\u8981\u70B9
3. \u5728\u603B\u7ED3\u4E2D\u5F15\u7528\u5177\u4F53\u7684\u65B0\u95FB\u6807\u9898\uFF08\u4FDD\u7559\u539F\u6587\u6807\u9898\uFF09\u548C\u5BF9\u5E94\u94FE\u63A5
4. \u6700\u540E\u7ED9\u51FA1-2\u53E5\u6574\u4F53\u8D8B\u52BF\u89C2\u5BDF
5. \u4F7F\u7528Markdown\u683C\u5F0F\u8F93\u51FA
6. \u603B\u7ED3\u5E94\u57FA\u4E8E\u63D0\u4F9B\u7684\u65B0\u95FB\u6807\u9898\u5185\u5BB9\uFF0C\u4E0D\u8981\u7F16\u9020\u4FE1\u606F`
        },
        {
          role: "user",
          content: `\u4EE5\u4E0B\u662F\u4ECA\u65E5\u6293\u53D6\u5230\u7684 ${articleList.length} \u6761\u91D1\u878D\u76D1\u7BA1\u65B0\u95FB\uFF1A

${newsListText}`
        }
      ]
    });
    const content = response.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : "\u603B\u7ED3\u751F\u6210\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002";
  } catch (err) {
    console.error("[Summarize] Failed:", err);
    return `\u603B\u7ED3\u751F\u6210\u5931\u8D25: ${err.message}`;
  }
}
async function generateReport(dateFrom, dateTo, articleList) {
  const grouped = /* @__PURE__ */ new Map();
  for (const article of articleList) {
    const sourceName = article.sourceName || "\u672A\u77E5\u6765\u6E90";
    if (!grouped.has(sourceName)) grouped.set(sourceName, []);
    grouped.get(sourceName).push(article);
  }
  const needTranslation = articleList.filter((a) => !a.titleCn && !isChinese(a.title));
  if (needTranslation.length > 0) {
    const translations = await batchTranslateTitles(needTranslation.map((a) => a.title));
    for (let i = 0; i < needTranslation.length; i++) {
      needTranslation[i].titleCn = translations[i];
    }
  }
  const dateFromStr = formatDate(dateFrom);
  const dateToStr = formatDate(dateTo);
  const reportTitle = `\u4EA4\u6613\u6240\u4E0E\u76D1\u7BA1\u65B0\u95FB\u65E5\u62A5 (${dateFromStr} - ${dateToStr})`;
  let html = `<div style="font-family: 'Microsoft YaHei', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">`;
  html += `<h1 style="color: #1a365d; border-bottom: 3px solid #2b6cb0; padding-bottom: 12px; font-size: 22px;">${reportTitle}</h1>`;
  html += `<p style="color: #718096; font-size: 14px;">\u62A5\u544A\u751F\u6210\u65F6\u95F4: ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")} | \u5171 ${articleList.length} \u6761\u65B0\u95FB</p>`;
  let text2 = `${reportTitle}
${"=".repeat(50)}
`;
  text2 += `\u62A5\u544A\u751F\u6210\u65F6\u95F4: ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")} | \u5171 ${articleList.length} \u6761\u65B0\u95FB

`;
  let articleIndex = 1;
  for (const [sourceName, sourceArticles] of Array.from(grouped.entries())) {
    html += `<h2 style="color: #2d3748; margin-top: 24px; font-size: 18px; border-left: 4px solid #4299e1; padding-left: 12px;">${sourceName} (${sourceArticles.length})</h2>`;
    text2 += `
\u3010${sourceName}\u3011(${sourceArticles.length}\u6761)
${"-".repeat(40)}
`;
    for (const article of sourceArticles) {
      const cnTitle = article.titleCn || "";
      const keywords = article.matchedKeywords || [];
      const keywordTags = keywords.map((k) => `<span style="display:inline-block;background:#ebf8ff;color:#2b6cb0;padding:2px 8px;border-radius:12px;font-size:12px;margin-right:4px;">${k}</span>`).join("");
      const publishDate = article.publishDate ? formatDate(article.publishDate) : "";
      html += `<div style="margin: 16px 0; padding: 14px; background: #f7fafc; border-radius: 8px; border-left: 3px solid #4299e1;">`;
      html += `<p style="margin:0 0 4px 0; font-weight:600; color:#2d3748; font-size:15px;">${articleIndex}. ${article.title}</p>`;
      if (cnTitle && cnTitle !== article.title) {
        html += `<p style="margin:0 0 4px 0; color:#4a5568; font-size:14px;">\u{1F4CC} ${cnTitle}</p>`;
      }
      if (publishDate) {
        html += `<p style="margin:0 0 4px 0; color:#a0aec0; font-size:12px;">\u{1F4C5} ${publishDate}</p>`;
      }
      if (keywordTags) {
        html += `<p style="margin:4px 0;">${keywordTags}</p>`;
      }
      if (article.url) {
        html += `<p style="margin:4px 0 0 0;"><a href="${article.url}" style="color:#3182ce; font-size:13px; text-decoration:none;">\u{1F517} \u67E5\u770B\u539F\u6587</a></p>`;
      }
      html += `</div>`;
      text2 += `
${articleIndex}. ${article.title}
`;
      if (cnTitle && cnTitle !== article.title) text2 += `   \u4E2D\u6587: ${cnTitle}
`;
      if (publishDate) text2 += `   \u65E5\u671F: ${publishDate}
`;
      if (keywords.length > 0) text2 += `   \u5173\u952E\u8BCD: ${keywords.join(", ")}
`;
      if (article.url) text2 += `   \u94FE\u63A5: ${article.url}
`;
      articleIndex++;
    }
  }
  html += `<hr style="margin-top: 30px; border: none; border-top: 1px solid #e2e8f0;">`;
  html += `<p style="color: #a0aec0; font-size: 12px; text-align: center;">\u672C\u62A5\u544A\u7531\u65B0\u95FB\u805A\u5408\u5E73\u53F0\u81EA\u52A8\u751F\u6210</p>`;
  html += `</div>`;
  text2 += `
${"=".repeat(50)}
\u672C\u62A5\u544A\u7531\u65B0\u95FB\u805A\u5408\u5E73\u53F0\u81EA\u52A8\u751F\u6210
`;
  return {
    title: reportTitle,
    dateFrom,
    dateTo,
    articles: articleList,
    contentHtml: html,
    contentText: text2
  };
}
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// server/mailer.ts
import nodemailer from "nodemailer";
async function sendReportEmail(config, subject, htmlContent, textContent) {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    return { success: false, error: "SMTP\u914D\u7F6E\u4E0D\u5B8C\u6574\uFF0C\u8BF7\u5148\u5728\u90AE\u4EF6\u8BBE\u7F6E\u4E2D\u914D\u7F6ESMTP\u670D\u52A1\u5668\u4FE1\u606F" };
  }
  const recipients = config.recipients;
  if (!recipients || recipients.length === 0) {
    return { success: false, error: "\u6536\u4EF6\u4EBA\u5217\u8868\u4E3A\u7A7A\uFF0C\u8BF7\u5148\u6DFB\u52A0\u6536\u4EF6\u4EBA\u90AE\u7BB1" };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.useSsl,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      }
    });
    await transporter.sendMail({
      from: config.fromName ? `"${config.fromName}" <${config.fromEmail || config.smtpUser}>` : config.fromEmail || config.smtpUser,
      to: recipients.join(", "),
      subject,
      html: htmlContent,
      text: textContent
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: `\u90AE\u4EF6\u53D1\u9001\u5931\u8D25: ${err.message}` };
  }
}
async function testSmtpConnection(config) {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
    return { success: false, error: "SMTP\u914D\u7F6E\u4E0D\u5B8C\u6574" };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort || 587,
      secure: config.useSsl || false,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass
      }
    });
    await transporter.verify();
    return { success: true };
  } catch (err) {
    return { success: false, error: `SMTP\u8FDE\u63A5\u6D4B\u8BD5\u5931\u8D25: ${err.message}` };
  }
}

// server/seed-defaults.ts
var DEFAULT_SOURCES = [
  {
    name: "Mondo Visione - \u4EA4\u6613\u6240\u65B0\u95FB",
    layer: "website",
    enabled: true,
    url: "https://mondovisione.com/news/",
    sourceType: "html",
    selectors: JSON.stringify({
      container: "table.views-table tbody tr",
      title: "td.views-field-title a",
      link: "td.views-field-title a",
      date: "td.views-field-created span.date-display-single",
      summary: ""
    }),
    dateFormat: "DD/MM/YYYY",
    description: "\u5168\u7403\u4EA4\u6613\u6240\u548C\u91D1\u878D\u57FA\u7840\u8BBE\u65BD\u65B0\u95FB\u805A\u5408\u7F51\u7AD9\uFF0C\u8986\u76D6\u4E3B\u8981\u4EA4\u6613\u6240\u516C\u544A"
  }
];
var SOURCE_TEMPLATES = [
  // --- 交易所 ---
  {
    name: "Mondo Visione - \u4EA4\u6613\u6240\u65B0\u95FB",
    category: "\u4EA4\u6613\u6240",
    url: "https://mondovisione.com/news/",
    sourceType: "html",
    selectors: {
      container: "table.views-table tbody tr",
      title: "td.views-field-title a",
      link: "td.views-field-title a",
      date: "td.views-field-created span.date-display-single"
    },
    dateFormat: "DD/MM/YYYY",
    description: "\u5168\u7403\u4EA4\u6613\u6240\u548C\u91D1\u878D\u57FA\u7840\u8BBE\u65BD\u65B0\u95FB\u805A\u5408\u7F51\u7AD9"
  },
  {
    name: "Nasdaq - \u65B0\u95FB\u53D1\u5E03",
    category: "\u4EA4\u6613\u6240",
    url: "https://www.nasdaq.com/press-release",
    sourceType: "html",
    selectors: {},
    description: "\u7EB3\u65AF\u8FBE\u514B\u4EA4\u6613\u6240\u65B0\u95FB\u53D1\u5E03\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "NYSE - \u65B0\u95FB",
    category: "\u4EA4\u6613\u6240",
    url: "https://www.nyse.com/news",
    sourceType: "html",
    selectors: {},
    description: "\u7EBD\u7EA6\u8BC1\u5238\u4EA4\u6613\u6240\u65B0\u95FB\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "LSEG - \u65B0\u95FB\u53D1\u5E03",
    category: "\u4EA4\u6613\u6240",
    url: "https://www.lseg.com/en/media-centre/press-releases",
    sourceType: "html",
    selectors: {},
    description: "\u4F26\u6566\u8BC1\u5238\u4EA4\u6613\u6240\u96C6\u56E2\u65B0\u95FB\u53D1\u5E03\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "SGX - \u65B0\u95FB\u53D1\u5E03",
    category: "\u4EA4\u6613\u6240",
    url: "https://www.sgx.com/media-centre",
    sourceType: "html",
    selectors: {},
    description: "\u65B0\u52A0\u5761\u4EA4\u6613\u6240\u65B0\u95FB\u53D1\u5E03\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "JPX - \u65B0\u95FB\u53D1\u5E03",
    category: "\u4EA4\u6613\u6240",
    url: "https://www.jpx.co.jp/english/corporate/news/news-releases/index.html",
    sourceType: "html",
    selectors: {},
    description: "\u65E5\u672C\u4EA4\u6613\u6240\u96C6\u56E2\u65B0\u95FB\u53D1\u5E03\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "KRX - \u65B0\u95FB",
    category: "\u4EA4\u6613\u6240",
    url: "https://global.krx.co.kr/contents/GLB/06/0608/0608010000/GLB0608010000.jsp",
    sourceType: "html",
    selectors: {},
    description: "\u97E9\u56FD\u4EA4\u6613\u6240\u65B0\u95FB\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "HKEX - \u65B0\u95FB\u53D1\u5E03",
    category: "\u4EA4\u6613\u6240",
    url: "https://www.hkex.com.hk/News/News-Release?sc_lang=en",
    sourceType: "html",
    selectors: {},
    description: "\u9999\u6E2F\u4EA4\u6613\u6240\u65B0\u95FB\u53D1\u5E03\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "Deutsche B\xF6rse - \u65B0\u95FB\u53D1\u5E03",
    category: "\u4EA4\u6613\u6240",
    url: "https://www.deutsche-boerse.com/dbg-en/media/press-releases",
    sourceType: "html",
    selectors: {},
    description: "\u5FB7\u610F\u5FD7\u4EA4\u6613\u6240\u96C6\u56E2\u65B0\u95FB\u53D1\u5E03\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "Euronext - \u65B0\u95FB\u53D1\u5E03",
    category: "\u4EA4\u6613\u6240",
    url: "https://www.euronext.com/en/about/media/press-releases",
    sourceType: "html",
    selectors: {},
    description: "\u6CDB\u6B27\u4EA4\u6613\u6240\u65B0\u95FB\u53D1\u5E03\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "WFE - \u4E16\u754C\u4EA4\u6613\u6240\u8054\u5408\u4F1A",
    category: "\u4EA4\u6613\u6240",
    url: "https://www.world-exchanges.org/news",
    sourceType: "html",
    selectors: {},
    description: "\u4E16\u754C\u4EA4\u6613\u6240\u8054\u5408\u4F1A\u65B0\u95FB\u4E0E\u7814\u7A76\u62A5\u544A\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  // --- 监管机构/证监会 ---
  {
    name: "SEC - \u65B0\u95FB\u53D1\u5E03",
    category: "\u76D1\u7BA1\u673A\u6784",
    url: "https://www.sec.gov/news/pressreleases",
    sourceType: "html",
    selectors: {},
    description: "\u7F8E\u56FD\u8BC1\u5238\u4EA4\u6613\u59D4\u5458\u4F1A\u65B0\u95FB\u53D1\u5E03\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "FCA - \u65B0\u95FB\u4E0E\u58F0\u660E",
    category: "\u76D1\u7BA1\u673A\u6784",
    url: "https://www.fca.org.uk/news",
    sourceType: "html",
    selectors: {},
    description: "\u82F1\u56FD\u91D1\u878D\u884C\u4E3A\u76D1\u7BA1\u5C40\u65B0\u95FB\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "MAS - \u65B0\u95FB\u53D1\u5E03",
    category: "\u76D1\u7BA1\u673A\u6784",
    url: "https://www.mas.gov.sg/news",
    sourceType: "html",
    selectors: {},
    description: "\u65B0\u52A0\u5761\u91D1\u878D\u7BA1\u7406\u5C40\u65B0\u95FB\u53D1\u5E03\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "JFSA - \u65B0\u95FB\u53D1\u5E03",
    category: "\u76D1\u7BA1\u673A\u6784",
    url: "https://www.fsa.go.jp/en/news/index.html",
    sourceType: "html",
    selectors: {},
    description: "\u65E5\u672C\u91D1\u878D\u5385\u65B0\u95FB\u53D1\u5E03\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "FSC \u97E9\u56FD - \u65B0\u95FB\u53D1\u5E03",
    category: "\u76D1\u7BA1\u673A\u6784",
    url: "https://www.fsc.go.kr/eng/pr010101",
    sourceType: "html",
    selectors: {},
    description: "\u97E9\u56FD\u91D1\u878D\u59D4\u5458\u4F1A\u65B0\u95FB\u53D1\u5E03\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "SFC \u9999\u6E2F - \u65B0\u95FB\u53D1\u5E03",
    category: "\u76D1\u7BA1\u673A\u6784",
    url: "https://www.sfc.hk/en/News-and-announcements/Policy-statements-and-announcements",
    sourceType: "html",
    selectors: {},
    description: "\u9999\u6E2F\u8BC1\u5238\u53CA\u671F\u8D27\u4E8B\u52A1\u76D1\u5BDF\u59D4\u5458\u4F1A\u65B0\u95FB\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  },
  {
    name: "ESMA - \u65B0\u95FB\u4E0E\u516C\u544A",
    category: "\u76D1\u7BA1\u673A\u6784",
    url: "https://www.esma.europa.eu/press-news/esma-news",
    sourceType: "html",
    selectors: {},
    description: "\u6B27\u6D32\u8BC1\u5238\u548C\u5E02\u573A\u7BA1\u7406\u5C40\u65B0\u95FB\uFF08\u667A\u80FD\u6293\u53D6\u6A21\u5F0F\uFF09"
  }
];
var DEFAULT_KEYWORD_RULES = [
  // ===== 包含规则 =====
  {
    name: "\u4EA4\u6613\u6240\u5173\u952E\u8BCD",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "NYSE",
      "Nasdaq",
      "LSE",
      "LSEG",
      "CME",
      "ICE",
      "Cboe",
      "HKEX",
      "SGX",
      "ASX",
      "TMX",
      "JSE",
      "B3",
      "Euronext",
      "Deutsche B\xF6rse",
      "Deutsche Borse",
      "SIX",
      "Borsa Italiana",
      "JPX",
      "KRX",
      "LME",
      "Eurex",
      "EEX",
      "ATHEX",
      "Bursa Malaysia",
      "Warsaw Stock Exchange",
      "Taiwan Futures Exchange",
      "London Metal Exchange",
      "WFE",
      "World Federation of Exchanges"
    ]),
    description: "\u4E3B\u8981\u5168\u7403\u4EA4\u6613\u6240\u540D\u79F0\uFF0C\u5339\u914D\u4EFB\u4E00\u5373\u4FDD\u7559",
    enabled: true
  },
  {
    name: "\u76D1\u7BA1\u673A\u6784\u5173\u952E\u8BCD",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "SEC",
      "FCA",
      "ESMA",
      "CFTC",
      "IOSCO",
      "MAS",
      "SFC",
      "ASIC",
      "JFSA",
      "FSC",
      "FSA"
    ]),
    description: "\u4E3B\u8981\u91D1\u878D\u76D1\u7BA1\u673A\u6784\u7F29\u5199",
    enabled: true
  },
  {
    name: "\u56FD\u9645\u7EC4\u7EC7\u5173\u952E\u8BCD",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "BIS",
      "FSB",
      "IMF",
      "World Bank",
      "WFE"
    ]),
    description: "\u56FD\u9645\u91D1\u878D\u7EC4\u7EC7",
    enabled: true
  },
  {
    name: "\u673A\u6784\u5168\u79F0\u77ED\u8BED",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "Securities and Exchange Commission",
      "Financial Conduct Authority",
      "Commodity Futures Trading Commission",
      "European Securities and Markets Authority",
      "Bank for International Settlements",
      "Financial Stability Board",
      "International Organization of Securities Commissions",
      "Monetary Authority of Singapore",
      "Securities and Futures Commission",
      "Australian Securities and Investments Commission",
      "New York Stock Exchange",
      "London Stock Exchange",
      "Hong Kong Exchanges",
      "Japan Exchange Group",
      "Korea Exchange",
      "Chicago Mercantile Exchange",
      "Intercontinental Exchange",
      "Singapore Exchange",
      "Financial Services Agency",
      "Financial Services Commission",
      "World Federation of Exchanges"
    ]),
    description: "\u673A\u6784\u5168\u79F0\uFF0C\u907F\u514D\u7F29\u5199\u8BEF\u5339\u914D",
    enabled: true
  },
  // --- 制度改革 ---
  {
    name: "\u5236\u5EA6\u6539\u9769\u5173\u952E\u8BCD",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "regulatory reform",
      "rule change",
      "rule amendment",
      "rule proposal",
      "rule filing",
      "regulation change",
      "regulatory framework",
      "new regulation",
      "deregulation",
      "regulatory sandbox",
      "pilot program",
      "consultation paper",
      "policy reform",
      "legislative reform",
      "capital framework",
      "liquidity regulation",
      "market reform",
      "governance reform"
    ]),
    description: "\u5236\u5EA6\u6539\u9769\u3001\u89C4\u5219\u4FEE\u8BA2\u3001\u76D1\u7BA1\u6846\u67B6\u53D8\u66F4",
    enabled: true
  },
  // --- 重要产品 ---
  {
    name: "\u91CD\u8981\u4EA7\u54C1\u5173\u952E\u8BCD",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "DR listing",
      "depositary receipt",
      "ETF",
      "ESG",
      "green bond",
      "sustainability bond",
      "derivatives",
      "futures",
      "options",
      "structured product",
      "new index",
      "new contract",
      "carbon credit",
      "SPAC",
      "REIT",
      "tokenized",
      "digital asset",
      "stablecoin"
    ]),
    description: "DR\u3001ETF\u3001ESG\u3001\u884D\u751F\u54C1\u7B49\u91CD\u8981\u4EA7\u54C1\u7C7B\u578B",
    enabled: true
  },
  // --- 市场结构 ---
  {
    name: "\u5E02\u573A\u7ED3\u6784\u5173\u952E\u8BCD",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "market structure",
      "trading system",
      "matching engine",
      "order type",
      "tick size",
      "circuit breaker",
      "market maker",
      "liquidity provider",
      "dark pool",
      "best execution",
      "price discovery",
      "auction",
      "closing auction",
      "opening auction",
      "continuous trading",
      "market microstructure",
      "trading venue",
      "lit market",
      "clearing",
      "settlement",
      "CCP",
      "central counterparty",
      "T+1 settlement",
      "T+0 settlement",
      "netting"
    ]),
    description: "\u5E02\u573A\u7ED3\u6784\u3001\u4EA4\u6613\u7CFB\u7EDF\u3001\u6E05\u7B97\u7ED3\u7B97\u76F8\u5173",
    enabled: true
  },
  // --- 数据 ---
  {
    name: "\u6570\u636E\u76F8\u5173\u5173\u952E\u8BCD",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "market data",
      "data standard",
      "data sharing",
      "data transparency",
      "consolidated tape",
      "reporting requirement",
      "trade reporting",
      "transaction reporting",
      "data analytics",
      "reference data",
      "LEI",
      "ISIN",
      "data regulation",
      "data access"
    ]),
    description: "\u5E02\u573A\u6570\u636E\u3001\u6570\u636E\u6807\u51C6\u3001\u62A5\u544A\u8981\u6C42\u76F8\u5173",
    enabled: true
  },
  // --- 技术改革 ---
  {
    name: "\u6280\u672F\u6539\u9769\u5173\u952E\u8BCD",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "technology upgrade",
      "cloud migration",
      "cloud computing",
      "artificial intelligence",
      "machine learning",
      "AI trading",
      "blockchain",
      "distributed ledger",
      "DLT",
      "tokenization",
      "smart contract",
      "API",
      "cyber security",
      "cybersecurity",
      "resilience",
      "system upgrade",
      "platform migration",
      "RegTech",
      "SupTech",
      "FinTech",
      "quantum computing",
      "real-time",
      "low latency"
    ]),
    description: "\u6280\u672F\u5347\u7EA7\u3001\u4E91\u8BA1\u7B97\u3001AI\u3001\u533A\u5757\u94FE\u3001\u7F51\u7EDC\u5B89\u5168\u7B49\u6280\u672F\u6539\u9769",
    enabled: true
  },
  // --- 交易所合作 ---
  {
    name: "\u4EA4\u6613\u6240\u5408\u4F5C\u5173\u952E\u8BCD",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "partnership",
      "strategic alliance",
      "collaboration",
      "joint venture",
      "cooperation agreement",
      "exchange cooperation",
      "exchange partnership",
      "technology partnership",
      "licensing agreement",
      "merger",
      "acquisition",
      "stake",
      "consortium",
      "working group"
    ]),
    description: "\u4EA4\u6613\u6240\u95F4\u5408\u4F5C\u3001\u8054\u76DF\u3001\u5E76\u8D2D\u3001\u6280\u672F\u5408\u4F5C",
    enabled: true
  },
  // --- 对外开放 ---
  {
    name: "\u5BF9\u5916\u5F00\u653E\u5173\u952E\u8BCD",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "cross-border",
      "international access",
      "foreign investor",
      "QFII",
      "RQFII",
      "Stock Connect",
      "Bond Connect",
      "mutual recognition",
      "passport",
      "equivalence",
      "market access",
      "liberalization",
      "opening up",
      "interoperability",
      "cross-listing",
      "dual listing",
      "global offering",
      "international listing",
      "MOU",
      "memorandum of understanding",
      "regulatory cooperation",
      "supervisory cooperation"
    ]),
    description: "\u8DE8\u5883\u4E92\u8054\u4E92\u901A\u3001\u5BF9\u5916\u5F00\u653E\u3001\u4E92\u8BA4\u673A\u5236\u3001\u76D1\u7BA1\u5408\u4F5C",
    enabled: true
  },
  // --- SEC专题 ---
  {
    name: "SEC\u4E13\u9898\u5173\u952E\u8BCD",
    ruleType: "include",
    logic: "or",
    keywords: JSON.stringify([
      "SEC Chairman",
      "SEC Chair",
      "SEC Speaks",
      "SEC enforcement",
      "SEC rulemaking",
      "SEC no-action",
      "SEC guidance",
      "SEC exemptive",
      "SEC concept release",
      "Regulation NMS",
      "Regulation SHO",
      "Regulation ATS",
      "Regulation Best Interest",
      "Form 10-K",
      "proxy",
      "disclosure requirement"
    ]),
    description: "SEC\u76F8\u5173\u4E13\u9898\uFF1A\u4E3B\u5E2D\u8BB2\u8BDD\u3001\u6267\u6CD5\u3001\u89C4\u5219\u5236\u5B9A\u3001\u5173\u952E\u6CD5\u89C4",
    enabled: true
  },
  // ===== 排除规则 =====
  {
    name: "\u4EBA\u4E8B\u53D8\u52A8\u6392\u9664",
    ruleType: "exclude",
    logic: "or",
    excludeStrength: "hard",
    keywords: JSON.stringify([
      "appoints",
      "appointed",
      "appointment",
      "resigns",
      "resignation",
      "retires",
      "retirement",
      "steps down",
      "new CEO",
      "new chairman",
      "commissioner"
    ]),
    description: "\u6392\u9664\u4EBA\u4E8B\u4EFB\u547D\u3001\u8F9E\u804C\u3001\u9000\u4F11\u7B49\u65B0\u95FB",
    enabled: true
  },
  {
    name: "\u4F01\u4E1A\u8D22\u52A1\u6392\u9664",
    ruleType: "exclude",
    logic: "or",
    excludeStrength: "hard",
    keywords: JSON.stringify([
      "quarterly results",
      "annual results",
      "financial results",
      "revenue growth",
      "profit",
      "earnings",
      "dividend"
    ]),
    description: "\u6392\u9664\u4F01\u4E1A\u8D22\u52A1\u62A5\u544A\u7C7B\u65B0\u95FB",
    enabled: true
  },
  {
    name: "\u4F4E\u4EF7\u503C\u5185\u5BB9\u6392\u9664",
    ruleType: "exclude",
    logic: "or",
    excludeStrength: "hard",
    keywords: JSON.stringify([
      "monthly report",
      "monthly summary",
      "monthly review",
      "monthly bulletin",
      "monthly volumes",
      "monthly headlines",
      "trading statistics",
      "market statistics",
      "daily statistics",
      "weekly report",
      "weekly summary",
      "weekly bulletin"
    ]),
    description: "\u6392\u9664\u6708\u5EA6/\u5468\u5EA6\u7EDF\u8BA1\u62A5\u544A\u3001\u4EA4\u6613\u91CF\u7EDF\u8BA1\u7B49\u4F4E\u4EF7\u503C\u5185\u5BB9",
    enabled: true
  },
  {
    name: "\u4E2A\u80A1\u4E0A\u5E02\u6392\u9664",
    ruleType: "exclude",
    logic: "or",
    excludeStrength: "hard",
    keywords: JSON.stringify([
      "new listing",
      "lists on",
      "listed on",
      "begins trading",
      "starts trading",
      "IPO",
      "initial public offering",
      "prime standard",
      "general standard",
      "new in the",
      "welcomes.*to trading",
      "joins.*exchange",
      "moves to.*main",
      "transfers to"
    ]),
    description: "\u6392\u9664\u4E2A\u80A1\u4E0A\u5E02\u3001\u8F6C\u677F\u7B49\u65B0\u95FB",
    enabled: true
  },
  {
    name: "\u4E2D\u56FD\u4EA4\u6613\u6240\u6392\u9664",
    ruleType: "exclude",
    logic: "or",
    excludeStrength: "soft",
    keywords: JSON.stringify([
      "Shanghai Stock Exchange",
      "Shenzhen Stock Exchange",
      "Beijing Stock Exchange",
      "SSE",
      "SZSE"
    ]),
    description: "\u8F6F\u6392\u9664\u4EE5\u4E2D\u56FD\u4EA4\u6613\u6240\u4E3A\u4E3B\u4F53\u7684\u65B0\u95FB\uFF08\u6807\u8BB0\u4F46\u4FDD\u7559\uFF09",
    enabled: true
  },
  {
    name: "\u76D1\u7BA1\u65E5\u5E38\u4E8B\u52A1\u6392\u9664",
    ruleType: "exclude",
    logic: "or",
    excludeStrength: "hard",
    keywords: JSON.stringify([
      "disciplinary action",
      "reprimands",
      "bans",
      "fines.*individual",
      "suspends licence",
      "warns against",
      "investor alert",
      "circular to intermediaries",
      "compliance deadline",
      "licence revoked",
      "licence suspended",
      "restriction notice",
      "winding up petition"
    ]),
    description: "\u6392\u9664\u76D1\u7BA1\u673A\u6784\u65E5\u5E38\u6267\u6CD5\u3001\u5904\u7F5A\u4E2A\u4EBA/\u5C0F\u673A\u6784\u3001\u6295\u8D44\u8005\u8B66\u793A\u7B49\u4E8B\u52A1\u6027\u65B0\u95FB",
    enabled: true
  },
  // ===== 白名单 =====
  {
    name: "SEC\u4E3B\u5E2D\u8BB2\u8BDD\u767D\u540D\u5355",
    ruleType: "whitelist",
    logic: "or",
    keywords: JSON.stringify([
      "SEC Chairman",
      "SEC Chair",
      "SEC Speaks",
      "Chairman Gensler",
      "Chairman Atkins"
    ]),
    description: "SEC\u4E3B\u5E2D\u8BB2\u8BDD\u4F18\u5148\u4FDD\u7559\uFF0C\u4E0D\u53D7\u6392\u9664\u89C4\u5219\u5F71\u54CD",
    enabled: true
  },
  {
    name: "\u91CD\u5927\u76D1\u7BA1\u6539\u9769\u767D\u540D\u5355",
    ruleType: "whitelist",
    logic: "or",
    keywords: JSON.stringify([
      "regulatory reform",
      "regulatory framework",
      "market reform",
      "new regulation",
      "market structure reform",
      "capital framework reform"
    ]),
    description: "\u91CD\u5927\u76D1\u7BA1\u6539\u9769\u65B0\u95FB\u4F18\u5148\u4FDD\u7559",
    enabled: true
  },
  {
    name: "\u4EA4\u6613\u6240\u5408\u4F5C\u767D\u540D\u5355",
    ruleType: "whitelist",
    logic: "or",
    keywords: JSON.stringify([
      "exchange cooperation",
      "exchange partnership",
      "Stock Connect",
      "Bond Connect",
      "cross-border cooperation",
      "interoperability"
    ]),
    description: "\u4EA4\u6613\u6240\u5408\u4F5C\u4E0E\u4E92\u8054\u4E92\u901A\u65B0\u95FB\u4F18\u5148\u4FDD\u7559",
    enabled: true
  }
];

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  // ========== 信息源管理 ==========
  source: router({
    list: protectedProcedure.query(async () => {
      return listSources();
    }),
    getById: protectedProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
      return getSourceById(input.id);
    }),
    create: protectedProcedure.input(z2.object({
      name: z2.string().min(1, "\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A"),
      layer: z2.enum(["website", "api", "manual"]),
      url: z2.string().optional(),
      sourceType: z2.enum(["html", "rss", "api"]).default("html"),
      selectors: z2.any().optional(),
      dateFormat: z2.string().optional(),
      apiConfig: z2.any().optional(),
      paginationConfig: z2.any().optional(),
      description: z2.string().optional(),
      enabled: z2.boolean().default(true)
    })).mutation(async ({ input }) => {
      const id = await createSource(input);
      return { id };
    }),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      name: z2.string().optional(),
      layer: z2.enum(["website", "api", "manual"]).optional(),
      url: z2.string().optional(),
      sourceType: z2.enum(["html", "rss", "api"]).optional(),
      selectors: z2.any().optional(),
      dateFormat: z2.string().optional(),
      apiConfig: z2.any().optional(),
      paginationConfig: z2.any().optional(),
      description: z2.string().optional(),
      enabled: z2.boolean().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateSource(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      await deleteSource(input.id);
      return { success: true };
    }),
    // 测试抓取预览
    testScrape: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      const source = await getSourceById(input.id);
      if (!source) throw new Error("\u4FE1\u606F\u6E90\u4E0D\u5B58\u5728");
      const result = await scrapeSource(source);
      return {
        items: result.items.slice(0, 10),
        totalCount: result.items.length,
        errors: result.errors
      };
    }),
    // 获取预置模板列表
    templates: protectedProcedure.query(() => {
      return SOURCE_TEMPLATES;
    }),
    // 从模板一键添加信息源
    addFromTemplate: protectedProcedure.input(z2.object({ templateIndex: z2.number() })).mutation(async ({ input }) => {
      const template = SOURCE_TEMPLATES[input.templateIndex];
      if (!template) throw new Error("\u6A21\u677F\u4E0D\u5B58\u5728");
      const id = await createSource({
        name: template.name,
        layer: "website",
        url: template.url,
        sourceType: template.sourceType,
        selectors: Object.keys(template.selectors).length > 0 ? JSON.stringify(template.selectors) : null,
        dateFormat: template.dateFormat || null,
        description: template.description,
        enabled: true
      });
      return { id, name: template.name };
    }),
    // 智能测试：只需URL就能抓取
    smartTest: protectedProcedure.input(z2.object({ url: z2.string().url("\u8BF7\u8F93\u5165\u6709\u6548\u7684URL") })).mutation(async ({ input }) => {
      try {
        const response = await fetch(input.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          },
          signal: AbortSignal.timeout(3e4)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const html = await response.text();
        const items = smartExtractFromHtml(html, input.url);
        return {
          items: items.slice(0, 15),
          totalCount: items.length,
          errors: items.length === 0 ? ["\u672A\u80FD\u81EA\u52A8\u8BC6\u522B\u65B0\u95FB\u5217\u8868\uFF0C\u8BE5\u7F51\u7AD9\u53EF\u80FD\u9700\u8981\u624B\u52A8\u914D\u7F6ECSS\u9009\u62E9\u5668"] : []
        };
      } catch (err) {
        return { items: [], totalCount: 0, errors: [`\u6293\u53D6\u5931\u8D25: ${err.message}`] };
      }
    })
  }),
  // ========== 关键词规则管理 ==========
  keywordRule: router({
    list: protectedProcedure.query(async () => {
      return listKeywordRules();
    }),
    getById: protectedProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
      return getKeywordRuleById(input.id);
    }),
    create: protectedProcedure.input(z2.object({
      name: z2.string().min(1, "\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A"),
      ruleType: z2.enum(["include", "exclude", "whitelist"]),
      logic: z2.enum(["or", "and"]).default("or"),
      keywords: z2.array(z2.string()),
      excludeStrength: z2.enum(["hard", "soft"]).optional(),
      description: z2.string().optional(),
      enabled: z2.boolean().default(true)
    })).mutation(async ({ input }) => {
      const id = await createKeywordRule(input);
      return { id };
    }),
    update: protectedProcedure.input(z2.object({
      id: z2.number(),
      name: z2.string().optional(),
      ruleType: z2.enum(["include", "exclude", "whitelist"]).optional(),
      logic: z2.enum(["or", "and"]).optional(),
      keywords: z2.array(z2.string()).optional(),
      excludeStrength: z2.enum(["hard", "soft"]).optional().nullable(),
      description: z2.string().optional(),
      enabled: z2.boolean().optional()
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateKeywordRule(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      await deleteKeywordRule(input.id);
      return { success: true };
    }),
    // 测试关键词匹配
    testMatch: protectedProcedure.input(z2.object({ title: z2.string() })).mutation(async ({ input }) => {
      const rules = await getEnabledKeywordRules();
      return applyKeywordRules(input.title, rules);
    })
  }),
  // ========== 文章管理 ==========
  article: router({
    list: protectedProcedure.input(z2.object({
      dateFrom: z2.string().optional(),
      dateTo: z2.string().optional(),
      sourceId: z2.number().optional(),
      limit: z2.number().default(50),
      offset: z2.number().default(0),
      excludeExcluded: z2.boolean().default(true)
    })).query(async ({ input }) => {
      return listArticles({
        dateFrom: input.dateFrom ? new Date(input.dateFrom) : void 0,
        dateTo: input.dateTo ? new Date(input.dateTo) : void 0,
        sourceId: input.sourceId,
        limit: input.limit,
        offset: input.offset,
        excludeExcluded: input.excludeExcluded
      });
    }),
    // 手动粘贴新闻
    addManual: protectedProcedure.input(z2.object({
      text: z2.string().min(1, "\u8BF7\u7C98\u8D34\u65B0\u95FB\u5185\u5BB9"),
      sourceName: z2.string().default("\u624B\u52A8\u6DFB\u52A0")
    })).mutation(async ({ input }) => {
      const parsedItems = parseManualText(input.text);
      if (parsedItems.length === 0) {
        return { added: 0, message: "\u672A\u8BC6\u522B\u5230\u6709\u6548\u7684\u65B0\u95FB\u6761\u76EE\uFF0C\u8BF7\u68C0\u67E5\u683C\u5F0F" };
      }
      const rules = await getEnabledKeywordRules();
      const articlesToInsert = parsedItems.map((item) => {
        const filterResult = applyKeywordRules(item.title, rules);
        return {
          title: item.title,
          url: item.url || null,
          publishDate: item.date ? new Date(item.date) : /* @__PURE__ */ new Date(),
          matchedKeywords: filterResult.matchedKeywords,
          sourceName: input.sourceName,
          isManual: true,
          isExcluded: !filterResult.passed,
          inReport: false
        };
      });
      await createArticlesBatch(articlesToInsert);
      const passedCount = articlesToInsert.filter((a) => !a.isExcluded).length;
      return {
        added: articlesToInsert.length,
        passed: passedCount,
        excluded: articlesToInsert.length - passedCount,
        message: `\u6210\u529F\u6DFB\u52A0 ${articlesToInsert.length} \u6761\u65B0\u95FB\uFF0C\u5176\u4E2D ${passedCount} \u6761\u901A\u8FC7\u7B5B\u9009`
      };
    }),
    // 触发抓取所有启用的信息源
    scrapeAll: protectedProcedure.mutation(async () => {
      const enabledSources = await getEnabledSources();
      const rules = await getEnabledKeywordRules();
      const results = [];
      for (const source of enabledSources) {
        if (source.layer === "manual") continue;
        try {
          const result = await scrapeSource(source);
          const articleList = convertToArticles(result, rules);
          if (articleList.length > 0) {
            await createArticlesBatch(articleList);
          }
          const passedCount = articleList.filter((a) => !a.isExcluded).length;
          results.push({
            sourceName: source.name,
            fetched: result.items.length,
            passed: passedCount,
            errors: result.errors
          });
        } catch (err) {
          results.push({
            sourceName: source.name,
            fetched: 0,
            passed: 0,
            errors: [err.message]
          });
        }
      }
      return { results };
    }),
    // 抓取单个信息源
    scrapeOne: protectedProcedure.input(z2.object({ sourceId: z2.number() })).mutation(async ({ input }) => {
      const source = await getSourceById(input.sourceId);
      if (!source) throw new Error("\u4FE1\u606F\u6E90\u4E0D\u5B58\u5728");
      const rules = await getEnabledKeywordRules();
      const result = await scrapeSource(source);
      const articleList = convertToArticles(result, rules);
      if (articleList.length > 0) {
        await createArticlesBatch(articleList);
      }
      const passedCount = articleList.filter((a) => !a.isExcluded).length;
      return {
        fetched: result.items.length,
        passed: passedCount,
        excluded: articleList.length - passedCount,
        errors: result.errors
      };
    }),
    // LLM总结当日新闻
    summarize: protectedProcedure.input(z2.object({
      dateFrom: z2.string(),
      dateTo: z2.string()
    })).mutation(async ({ input }) => {
      const dateFrom = new Date(input.dateFrom);
      const dateTo = new Date(input.dateTo);
      const articleList = await getArticlesByDateRange(dateFrom, dateTo, true);
      if (articleList.length === 0) {
        return { summary: "\u8BE5\u65E5\u671F\u8303\u56F4\u5185\u6CA1\u6709\u901A\u8FC7\u7B5B\u9009\u7684\u65B0\u95FB\uFF0C\u65E0\u6CD5\u751F\u6210\u603B\u7ED3\u3002", articleCount: 0 };
      }
      const summary = await summarizeNews(articleList);
      return { summary, articleCount: articleList.length };
    })
  }),
  // ========== 报告管理 ==========
  report: router({
    list: protectedProcedure.query(async () => {
      return listReports();
    }),
    getById: protectedProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
      return getReportById(input.id);
    }),
    generate: protectedProcedure.input(z2.object({
      dateFrom: z2.string(),
      dateTo: z2.string()
    })).mutation(async ({ input }) => {
      const dateFrom = new Date(input.dateFrom);
      const dateTo = new Date(input.dateTo);
      const articleList = await getArticlesByDateRange(dateFrom, dateTo, true);
      if (articleList.length === 0) {
        return { id: null, message: "\u8BE5\u65E5\u671F\u8303\u56F4\u5185\u6CA1\u6709\u901A\u8FC7\u7B5B\u9009\u7684\u65B0\u95FB" };
      }
      const reportData = await generateReport(dateFrom, dateTo, articleList);
      const id = await createReport({
        title: reportData.title,
        dateFrom,
        dateTo,
        contentHtml: reportData.contentHtml,
        contentText: reportData.contentText,
        articleCount: articleList.length
      });
      return { id, articleCount: articleList.length, message: `\u62A5\u544A\u5DF2\u751F\u6210\uFF0C\u5305\u542B ${articleList.length} \u6761\u65B0\u95FB` };
    }),
    delete: protectedProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
      await deleteReport(input.id);
      return { success: true };
    }),
    // 发送报告邮件
    sendEmail: protectedProcedure.input(z2.object({ reportId: z2.number() })).mutation(async ({ input }) => {
      const report = await getReportById(input.reportId);
      if (!report) throw new Error("\u62A5\u544A\u4E0D\u5B58\u5728");
      const config = await getEmailConfig();
      if (!config) throw new Error("\u8BF7\u5148\u914D\u7F6E\u90AE\u4EF6\u8BBE\u7F6E");
      const result = await sendReportEmail(
        config,
        report.title,
        report.contentHtml || "",
        report.contentText || ""
      );
      if (result.success) {
        await updateReport(input.reportId, {
          emailSent: true,
          emailSentAt: /* @__PURE__ */ new Date()
        });
      }
      return result;
    })
  }),
  // ========== 邮件配置 ==========
  emailConfig: router({
    get: protectedProcedure.query(async () => {
      const config = await getEmailConfig();
      if (config) {
        return { ...config, smtpPass: config.smtpPass ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : null };
      }
      return null;
    }),
    save: protectedProcedure.input(z2.object({
      smtpHost: z2.string().optional(),
      smtpPort: z2.number().optional(),
      smtpUser: z2.string().optional(),
      smtpPass: z2.string().optional(),
      fromEmail: z2.string().optional(),
      fromName: z2.string().optional(),
      recipients: z2.array(z2.string()).optional(),
      useSsl: z2.boolean().optional(),
      dailySendTime: z2.string().optional(),
      autoSendEnabled: z2.boolean().optional()
    })).mutation(async ({ input }) => {
      const data = { ...input };
      if (data.smtpPass === "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022") {
        delete data.smtpPass;
      }
      await upsertEmailConfig(data);
      return { success: true };
    }),
    testConnection: protectedProcedure.input(z2.object({
      smtpHost: z2.string(),
      smtpPort: z2.number().default(587),
      smtpUser: z2.string(),
      smtpPass: z2.string(),
      useSsl: z2.boolean().default(false)
    })).mutation(async ({ input }) => {
      return testSmtpConnection(input);
    })
  }),
  // ========== 初始化默认配置 ==========
  setup: router({
    seedDefaults: protectedProcedure.mutation(async () => {
      const existingSources = await listSources();
      const existingRules = await listKeywordRules();
      let sourcesAdded = 0;
      let rulesAdded = 0;
      if (existingSources.length === 0) {
        for (const src of DEFAULT_SOURCES) {
          await createSource(src);
          sourcesAdded++;
        }
      }
      if (existingRules.length === 0) {
        for (const rule of DEFAULT_KEYWORD_RULES) {
          const ruleData = {
            ...rule,
            keywords: typeof rule.keywords === "string" ? rule.keywords : JSON.stringify(rule.keywords)
          };
          await createKeywordRule(ruleData);
          rulesAdded++;
        }
      }
      return {
        sourcesAdded,
        rulesAdded,
        message: sourcesAdded > 0 || rulesAdded > 0 ? `\u5DF2\u521D\u59CB\u5316 ${sourcesAdded} \u4E2A\u4FE1\u606F\u6E90\u548C ${rulesAdded} \u6761\u5173\u952E\u8BCD\u89C4\u5219` : "\u914D\u7F6E\u5DF2\u5B58\u5728\uFF0C\u65E0\u9700\u91CD\u590D\u521D\u59CB\u5316"
      };
    }),
    // 单独初始化关键词规则（用于信息源已存在但规则缺失的情况）
    seedKeywordRules: protectedProcedure.mutation(async () => {
      const existingRules = await listKeywordRules();
      if (existingRules.length > 0) {
        return { rulesAdded: 0, message: `\u5DF2\u6709 ${existingRules.length} \u6761\u5173\u952E\u8BCD\u89C4\u5219\uFF0C\u65E0\u9700\u91CD\u590D\u521D\u59CB\u5316` };
      }
      let rulesAdded = 0;
      for (const rule of DEFAULT_KEYWORD_RULES) {
        const ruleData = {
          ...rule,
          keywords: typeof rule.keywords === "string" ? rule.keywords : JSON.stringify(rule.keywords)
        };
        await createKeywordRule(ruleData);
        rulesAdded++;
      }
      return { rulesAdded, message: `\u5DF2\u521D\u59CB\u5316 ${rulesAdded} \u6761\u5173\u952E\u8BCD\u89C4\u5219` };
    }),
    checkStatus: protectedProcedure.query(async () => {
      const sources2 = await listSources();
      const rules = await listKeywordRules();
      return {
        hasSources: sources2.length > 0,
        hasRules: rules.length > 0,
        sourceCount: sources2.length,
        ruleCount: rules.length
      };
    })
  }),
  // ========== Cron触发端点 ==========
  cron: router({
    dailyScrapeAndReport: publicProcedure.mutation(async () => {
      const enabledSources = await getEnabledSources();
      const rules = await getEnabledKeywordRules();
      let totalFetched = 0;
      let totalPassed = 0;
      for (const source of enabledSources) {
        if (source.layer === "manual") continue;
        try {
          const result = await scrapeSource(source);
          const articleList2 = convertToArticles(result, rules);
          if (articleList2.length > 0) {
            await createArticlesBatch(articleList2);
          }
          totalFetched += result.items.length;
          totalPassed += articleList2.filter((a) => !a.isExcluded).length;
        } catch (err) {
          console.error(`[Cron] Failed to scrape ${source.name}:`, err);
        }
      }
      const now = /* @__PURE__ */ new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const articleList = await getArticlesByDateRange(yesterday, todayStart, true);
      if (articleList.length > 0) {
        const reportData = await generateReport(yesterday, todayStart, articleList);
        const reportId = await createReport({
          title: reportData.title,
          dateFrom: yesterday,
          dateTo: todayStart,
          contentHtml: reportData.contentHtml,
          contentText: reportData.contentText,
          articleCount: articleList.length
        });
        const config = await getEmailConfig();
        if (config?.autoSendEnabled) {
          const emailResult = await sendReportEmail(
            config,
            reportData.title,
            reportData.contentHtml,
            reportData.contentText
          );
          if (emailResult.success) {
            await updateReport(reportId, { emailSent: true, emailSentAt: /* @__PURE__ */ new Date() });
          }
        }
      }
      return { totalFetched, totalPassed, articlesInReport: articleList.length };
    })
  })
});

// server/_core/context.ts
import { parse as parseCookieHeader } from "cookie";
import { jwtVerify } from "jose";
async function createContext(opts) {
  let user = null;
  try {
    const cookies = parseCookieHeader(opts.req.headers.cookie || "");
    const sessionCookie = cookies[COOKIE_NAME];
    if (sessionCookie) {
      const secretKey = new TextEncoder().encode(ENV.cookieSecret);
      const { payload } = await jwtVerify(sessionCookie, secretKey, {
        algorithms: ["HS256"]
      });
      const openId = payload.openId;
      if (openId) {
        user = await getUserByOpenId(openId) || null;
      }
    }
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
var vite_config_default = defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: true
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
startServer().catch(console.error);
