import { integer, pgEnum, pgTable, text, timestamp, varchar, boolean, json, serial } from "drizzle-orm/pg-core";

// Enums
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const layerEnum = pgEnum("layer", ["website", "api", "manual"]);
export const sourceTypeEnum = pgEnum("source_type", ["html", "rss", "api"]);
export const ruleTypeEnum = pgEnum("rule_type", ["include", "exclude", "whitelist"]);
export const logicEnum = pgEnum("logic", ["or", "and"]);
export const excludeStrengthEnum = pgEnum("exclude_strength", ["hard", "soft"]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  password: varchar("password", { length: 200 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 信息源配置表
 */
export const sources = pgTable("sources", {
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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Source = typeof sources.$inferSelect;
export type InsertSource = typeof sources.$inferInsert;

/**
 * 关键词规则表
 */
export const keywordRules = pgTable("keyword_rules", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  ruleType: ruleTypeEnum("rule_type").notNull(),
  logic: logicEnum("logic").default("or").notNull(),
  keywords: json("keywords").notNull(),
  excludeStrength: excludeStrengthEnum("exclude_strength"),
  enabled: boolean("enabled").default(true).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type KeywordRule = typeof keywordRules.$inferSelect;
export type InsertKeywordRule = typeof keywordRules.$inferInsert;

/**
 * 新闻条目表
 */
export const articles = pgTable("articles", {
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;

/**
 * 报告表
 */
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  dateFrom: timestamp("date_from").notNull(),
  dateTo: timestamp("date_to").notNull(),
  contentHtml: text("content_html"),
  contentText: text("content_text"),
  articleCount: integer("article_count").default(0).notNull(),
  emailSent: boolean("email_sent").default(false).notNull(),
  emailSentAt: timestamp("email_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/**
 * 邮件配置表（单行配置）
 */
export const emailConfig = pgTable("email_config", {
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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type EmailConfig = typeof emailConfig.$inferSelect;
export type InsertEmailConfig = typeof emailConfig.$inferInsert;
