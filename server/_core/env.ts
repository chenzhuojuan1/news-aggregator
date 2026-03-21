export const ENV = {
  cookieSecret: process.env.JWT_SECRET || "change-me-in-production-secret-key-2024",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.deepseek.com",
  openaiModel: process.env.OPENAI_MODEL ?? "deepseek-chat",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin123",
};
