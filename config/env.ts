import dotenv from "dotenv";
import path from "node:path";

dotenv.config();

type NodeEnv = "development" | "test";

function required(name: string): string {
    const value = process.env[name];
    if (!value || value.trim() === "") {
        throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
    }
    return value.trim();
}

function optional(name: string, fallback: string): string {
    const value = process.env[name];
    return value && value.trim() !== "" ? value.trim() : fallback;
}

function toNumber(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw || raw.trim() === "") return fallback;
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
        throw new Error(`Variável de ambiente ${name} precisa ser numérica`);
    }
    return parsed;
}

const nodeEnv = optional("NODE_ENV", "development") as NodeEnv;
if (!["development", "test"].includes(nodeEnv)) {
    throw new Error(`NODE_ENV inválido: ${nodeEnv} (use development ou test — MVP roda só em localhost, C-14)`);
}
const isTest = nodeEnv === "test";

/**
 * Leitura centralizada do .env. Nenhum outro arquivo lê `process.env`
 * diretamente — assim o boot falha cedo e num lugar só.
 */
export const env = {
    nodeEnv,
    isTest,
    port: toNumber("PORT", 3333),

    /** Postgres. Em teste usamos DATABASE_URL_TEST; `database/db.ts` recusa banco sem "_test" no nome. */
    databaseUrl: isTest ? required("DATABASE_URL_TEST") : required("DATABASE_URL"),
    databasePoolMin: toNumber("DATABASE_POOL_MIN", 2),
    databasePoolMax: toNumber("DATABASE_POOL_MAX", 10),

    /** Serviço FastAPI de scraping do Cifra Club (scraper/). Node só fala com ele via HTTP (C-1). */
    scraperBaseUrl: optional("SCRAPER_BASE_URL", "http://localhost:8000"),

    /** SMTP via Gmail pessoal com App Password (Approved Sender do Send-to-Kindle, C-11). */
    smtpHost: optional("SMTP_HOST", "smtp.gmail.com"),
    smtpPort: toNumber("SMTP_PORT", 587),
    smtpUser: optional("SMTP_USER", ""),
    smtpPass: optional("SMTP_PASS", ""),
    kindleEmailTo: optional("KINDLE_EMAIL_TO", ""),

    migrationsDir: path.join(__dirname, "..", "migrations"),
} as const;
