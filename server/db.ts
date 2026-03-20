import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  InsertUser, users,
  sources, InsertSource, Source,
  keywordRules, InsertKeywordRule, KeywordRule,
  articles, InsertArticle, Article,
  reports, InsertReport, Report,
  emailConfig, InsertEmailConfig, EmailConfig,
} from "../drizzle/schema";
import { ENV } from './_core/env';

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

// ========== User ==========
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const existing = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    if (existing.length > 0) {
      const updateSet: Record<string, unknown> = {};
      if (user.name !== undefined) updateSet.name = user.name;
      if (user.email !== undefined) updateSet.email = user.email;
      if (user.loginMethod !== undefined) updateSet.loginMethod = user.loginMethod;
      if (user.lastSignedIn !== undefined) updateSet.lastSignedIn = user.lastSignedIn;
      if (user.role !== undefined) updateSet.role = user.role;
      if (user.password !== undefined) updateSet.password = user.password;
      updateSet.updatedAt = new Date();
      if (Object.keys(updateSet).length > 0) {
        await db.update(users).set(updateSet).where(eq(users.openId, user.openId));
      }
    } else {
      await db.insert(users).values({
        ...user,
        lastSignedIn: user.lastSignedIn || new Date(),
      });
    }
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ========== Sources ==========
export async function listSources() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sources).orderBy(desc(sources.createdAt));
}

export async function getSourceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
  return result[0];
}

export async function createSource(data: InsertSource) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(sources).values(data).returning({ id: sources.id });
  return result[0].id;
}

export async function updateSource(id: number, data: Partial<InsertSource>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(sources).set({ ...data, updatedAt: new Date() }).where(eq(sources.id, id));
}

export async function deleteSource(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(sources).where(eq(sources.id, id));
}

export async function getEnabledSources() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sources).where(eq(sources.enabled, true));
}

// ========== Keyword Rules ==========
export async function listKeywordRules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(keywordRules).orderBy(desc(keywordRules.createdAt));
}

export async function getKeywordRuleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(keywordRules).where(eq(keywordRules.id, id)).limit(1);
  return result[0];
}

export async function createKeywordRule(data: InsertKeywordRule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(keywordRules).values(data).returning({ id: keywordRules.id });
  return result[0].id;
}

export async function updateKeywordRule(id: number, data: Partial<InsertKeywordRule>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(keywordRules).set({ ...data, updatedAt: new Date() }).where(eq(keywordRules.id, id));
}

export async function deleteKeywordRule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(keywordRules).where(eq(keywordRules.id, id));
}

export async function getEnabledKeywordRules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(keywordRules).where(eq(keywordRules.enabled, true));
}

// ========== Articles ==========
export async function listArticles(opts: { dateFrom?: Date; dateTo?: Date; sourceId?: number; limit?: number; offset?: number; excludeExcluded?: boolean }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions = [];
  if (opts.dateFrom) conditions.push(gte(articles.publishDate, opts.dateFrom));
  if (opts.dateTo) conditions.push(lte(articles.publishDate, opts.dateTo));
  if (opts.sourceId) conditions.push(eq(articles.sourceId, opts.sourceId));
  if (opts.excludeExcluded) conditions.push(eq(articles.isExcluded, false));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [items, countResult] = await Promise.all([
    db.select().from(articles).where(where).orderBy(desc(articles.publishDate)).limit(opts.limit ?? 50).offset(opts.offset ?? 0),
    db.select({ count: sql<number>`count(*)` }).from(articles).where(where),
  ]);
  return { items, total: Number(countResult[0]?.count ?? 0) };
}

export async function createArticle(data: InsertArticle) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(articles).values(data).returning({ id: articles.id });
  return result[0].id;
}

export async function createArticlesBatch(dataList: InsertArticle[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (dataList.length === 0) return;
  await db.insert(articles).values(dataList);
}

export async function getArticlesByDateRange(dateFrom: Date, dateTo: Date, excludeExcluded = true) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [gte(articles.publishDate, dateFrom), lte(articles.publishDate, dateTo)];
  if (excludeExcluded) conditions.push(eq(articles.isExcluded, false));
  return db.select().from(articles).where(and(...conditions)).orderBy(desc(articles.publishDate));
}

// ========== Reports ==========
export async function listReports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reports).orderBy(desc(reports.createdAt));
}

export async function getReportById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  return result[0];
}

export async function createReport(data: InsertReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reports).values(data).returning({ id: reports.id });
  return result[0].id;
}

export async function updateReport(id: number, data: Partial<InsertReport>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reports).set(data).where(eq(reports.id, id));
}

export async function deleteReport(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(reports).where(eq(reports.id, id));
}

// ========== Email Config ==========
export async function getEmailConfig(): Promise<EmailConfig | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(emailConfig).limit(1);
  return result[0];
}

export async function upsertEmailConfig(data: Partial<InsertEmailConfig>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await getEmailConfig();
  if (existing) {
    await db.update(emailConfig).set({ ...data, updatedAt: new Date() }).where(eq(emailConfig.id, existing.id));
  } else {
    await db.insert(emailConfig).values(data as InsertEmailConfig);
  }
}
