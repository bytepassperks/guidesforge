import { Server } from "@hocuspocus/server";
import { Logger } from "@hocuspocus/extension-logger";
import { Database } from "@hocuspocus/extension-database";
import { Throttle } from "@hocuspocus/extension-throttle";
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

// PostgreSQL pool for document persistence
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("render.com")
    ? { rejectUnauthorized: false }
    : false,
});

// Ensure the collaboration documents table exists
async function ensureTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS hocuspocus_documents (
        name TEXT PRIMARY KEY,
        data BYTEA NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log("[Hocuspocus] Documents table ready");
  } catch (err) {
    console.error("[Hocuspocus] Failed to create table:", err.message);
  }
}

ensureTable();

const port = parseInt(process.env.PORT || "4000", 10);
const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  "https://guidesforge.org,https://www.guidesforge.org,https://guidesforge-web.onrender.com"
)
  .split(",")
  .map((s) => s.trim());

const server = Server.configure({
  port,
  address: "0.0.0.0",

  // CORS-like origin check for WebSocket upgrade
  async onConnect(data) {
    const origin = data.request.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      console.warn(`[Hocuspocus] Rejected connection from origin: ${origin}`);
      throw new Error("Forbidden origin");
    }
  },

  // Auth: validate JWT token passed from the frontend
  async onAuthenticate(data) {
    const token = data.token;
    if (!token) {
      // Allow anonymous read-only connections (token not required for now)
      // In production, enforce JWT validation here
      return { user: { name: "anonymous", role: "viewer" } };
    }
    // Token present — trust the frontend for now
    // Full JWT validation would verify against the backend SECRET_KEY
    return { user: { name: "authenticated", role: "editor" } };
  },

  extensions: [
    new Logger(),
    new Throttle({
      throttle: 15,
      banTime: 5,
    }),
    new Database({
      // Load document from PostgreSQL
      fetch: async ({ documentName }) => {
        try {
          const result = await pool.query(
            "SELECT data FROM hocuspocus_documents WHERE name = $1",
            [documentName]
          );
          if (result.rows.length > 0) {
            return result.rows[0].data;
          }
        } catch (err) {
          console.error(
            `[Hocuspocus] Error fetching document ${documentName}:`,
            err.message
          );
        }
        return null;
      },

      // Save document to PostgreSQL
      store: async ({ documentName, state }) => {
        try {
          await pool.query(
            `INSERT INTO hocuspocus_documents (name, data, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (name) DO UPDATE SET data = $2, updated_at = NOW()`,
            [documentName, state]
          );
        } catch (err) {
          console.error(
            `[Hocuspocus] Error storing document ${documentName}:`,
            err.message
          );
        }
      },
    }),
  ],
});

server.listen().then(() => {
  console.log(`[Hocuspocus] WebSocket server running on port ${port}`);
});
