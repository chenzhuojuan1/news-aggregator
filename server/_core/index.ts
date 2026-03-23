import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import * as db from "../db";
import { scrapeSource, convertToArticles } from "../scraper";
import { generateReport } from "../report";
import { sendReportEmail } from "../mailer";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ─── Daily cron: scrape + email at 08:30 CST on weekdays ──────────────────────
// Checks every minute; triggers exactly at 08:30 (±1 min window) Mon–Fri (UTC+8)
let _lastCronDate = "";

async function runDailyJob() {
  console.log("[CRON] Starting daily scrape + report + email job...");

  // 1. Scrape all enabled sources
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
      totalPassed += articleList.filter((a: any) => !a.isExcluded).length;
    } catch (err) {
      console.error(`[CRON] Failed to scrape ${source.name}:`, err);
    }
  }

  // 2. Generate yesterday's report
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const articleList = await db.getArticlesByDateRange(yesterday, todayStart, true);
  console.log(`[CRON] Articles for report: ${articleList.length}`);

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

    // 3. Always send email at 08:30 (ignore autoSendEnabled — cron always sends)
    const config = await db.getEmailConfig();
    if (config && config.smtpHost && config.smtpUser && config.smtpPass) {
      const emailResult = await sendReportEmail(
        config,
        reportData.title,
        reportData.contentHtml,
        reportData.contentText,
      );
      if (emailResult.success) {
        await db.updateReport(reportId, { emailSent: true, emailSentAt: new Date() });
        console.log("[CRON] Email sent successfully");
      } else {
        console.error("[CRON] Email failed:", emailResult.error);
      }
    } else {
      console.warn("[CRON] Email config not set, skipping email");
    }
  }

  console.log(`[CRON] Done: fetched=${totalFetched}, passed=${totalPassed}, inReport=${articleList.length}`);
}

function startDailyCron() {
  setInterval(async () => {
    const now = new Date();
    // Convert to UTC+8 (China Standard Time)
    const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const hours = utc8.getUTCHours();
    const minutes = utc8.getUTCMinutes();
    const dayOfWeek = utc8.getUTCDay(); // 0=Sun, 6=Sat
    const todayStr = `${utc8.getUTCFullYear()}-${String(utc8.getUTCMonth() + 1).padStart(2, "0")}-${String(utc8.getUTCDate()).padStart(2, "0")}`;

    // Only run on weekdays (Mon=1 … Fri=5) at exactly 08:30–08:31 CST
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    const isTargetTime = hours === 8 && minutes >= 30 && minutes <= 31;

    if (!isWeekday || !isTargetTime) return;
    if (_lastCronDate === todayStr) return; // Already ran today
    _lastCronDate = todayStr;

    console.log(`[CRON] 08:30 CST weekday trigger — ${todayStr}`);
    runDailyJob().catch(err => {
      console.error("[CRON] Daily job error:", err);
      // Reset so it can retry in the next minute (within the 2-min window)
      _lastCronDate = "";
    });
  }, 60 * 1000); // Check every minute

  console.log("[CRON] Daily auto-scrape + email scheduled for 08:30 CST on weekdays (Mon–Fri)");
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Auth routes
  registerOAuthRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
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
    // Start the daily cron after server is up
    startDailyCron();
  });
}

startServer().catch(console.error);
