import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { SignJWT } from "jose";
import crypto from "crypto";

async function createSessionToken(openId: string, name: string): Promise<string> {
  const secretKey = new TextEncoder().encode(ENV.cookieSecret);
  const expiresInMs = ONE_YEAR_MS;
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);

  return new SignJWT({
    openId,
    name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

export function registerOAuthRoutes(app: Express) {
  // Simple password login endpoint
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { password } = req.body || {};

    if (!password) {
      res.status(400).json({ error: "密码不能为空" });
      return;
    }

    if (password !== ENV.adminPassword) {
      res.status(401).json({ error: "密码错误" });
      return;
    }

    try {
      // Use a fixed admin user
      const openId = "admin-" + crypto.createHash("md5").update(ENV.adminPassword).digest("hex").substring(0, 12);

      await db.upsertUser({
        openId,
        name: "管理员",
        email: null,
        loginMethod: "password",
        role: "admin",
        lastSignedIn: new Date(),
      });

      const sessionToken = await createSessionToken(openId, "管理员");

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      res.json({ success: true, message: "登录成功" });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "登录失败" });
    }
  });

  // Keep the old OAuth callback route as a no-op redirect
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.redirect(302, "/");
  });
}
