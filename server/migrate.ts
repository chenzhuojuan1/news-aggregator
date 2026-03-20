import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import * as schema from "../drizzle/schema";

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const db = drizzle(databaseUrl);

  console.log("Running schema creation...");

  // Create enums
  await db.execute(sql`DO $$ BEGIN CREATE TYPE role AS ENUM ('user', 'admin'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE layer AS ENUM ('website', 'api', 'manual'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE source_type AS ENUM ('html', 'rss', 'api'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE rule_type AS ENUM ('include', 'exclude', 'whitelist'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE logic AS ENUM ('or', 'and'); EXCEPTION WHEN duplicate_object THEN null; END $$`);
  await db.execute(sql`DO $$ BEGIN CREATE TYPE exclude_strength AS ENUM ('hard', 'soft'); EXCEPTION WHEN duplicate_object THEN null; END $$`);

  // Create tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      open_id VARCHAR(64) NOT NULL UNIQUE,
      name TEXT,
      email VARCHAR(320),
      password VARCHAR(200),
      login_method VARCHAR(64),
      role role NOT NULL DEFAULT 'user',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_signed_in TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sources (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      layer layer NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      url TEXT,
      source_type source_type NOT NULL DEFAULT 'html',
      selectors JSON,
      date_format VARCHAR(100),
      api_config JSON,
      pagination_config JSON,
      description TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS keyword_rules (
      id SERIAL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      rule_type rule_type NOT NULL,
      logic logic NOT NULL DEFAULT 'or',
      keywords JSON NOT NULL,
      exclude_strength exclude_strength,
      enabled BOOLEAN NOT NULL DEFAULT true,
      description TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS articles (
      id SERIAL PRIMARY KEY,
      source_id INTEGER,
      title VARCHAR(500) NOT NULL,
      title_cn VARCHAR(500),
      url TEXT,
      publish_date TIMESTAMP,
      matched_keywords JSON,
      summary TEXT,
      source_name VARCHAR(200),
      in_report BOOLEAN NOT NULL DEFAULT false,
      is_manual BOOLEAN NOT NULL DEFAULT false,
      is_excluded BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      title VARCHAR(300) NOT NULL,
      date_from TIMESTAMP NOT NULL,
      date_to TIMESTAMP NOT NULL,
      content_html TEXT,
      content_text TEXT,
      article_count INTEGER NOT NULL DEFAULT 0,
      email_sent BOOLEAN NOT NULL DEFAULT false,
      email_sent_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_config (
      id SERIAL PRIMARY KEY,
      smtp_host VARCHAR(200),
      smtp_port INTEGER DEFAULT 587,
      smtp_user VARCHAR(200),
      smtp_pass VARCHAR(500),
      from_email VARCHAR(320),
      from_name VARCHAR(200),
      recipients JSON,
      use_ssl BOOLEAN NOT NULL DEFAULT false,
      daily_send_time VARCHAR(10) DEFAULT '08:00',
      auto_send_enabled BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  console.log("Migration completed successfully!");
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
