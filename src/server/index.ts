import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer as createViteServer } from "vite";
import { createApiRouter } from "../api/routes.js";
import { ensureDataDir, loadConfig, openDatabase } from "../db/client.js";
import { closeAuthDb, findSessionUser, getAuthDb } from "./auth.js";
import type Database from "better-sqlite3";

const PORT = 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const userDbCache = new Map<string, Database.Database>();

async function bootstrap() {
  ensureDataDir();
  const authDb = getAuthDb();
  const getCurrentUser = (req: express.Request) => findSessionUser(authDb, req.headers.cookie);
  const getContext = (req: express.Request) => {
    const user = getCurrentUser(req);
    if (!user) {
      return null;
    }

    const db = getUserDatabase(user.data_db_path);
    const config = loadConfig(db);
    return { db, config, user };
  };

  const app = express();
  app.use(express.json());
  app.use("/api", createApiRouter(authDb, getContext));

  if (process.env.NODE_ENV === "production" && fs.existsSync(path.join(projectRoot, "dist/client/index.html"))) {
    app.use(express.static(path.join(projectRoot, "dist/client")));
    app.use((_req, res) => {
      res.sendFile(path.join(projectRoot, "dist/client/index.html"));
    });
  } else {
    const vite = await createViteServer({
      root: path.join(projectRoot, "src/frontend"),
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa"
    });

    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      try {
        const templatePath = path.join(projectRoot, "src/frontend/index.html");
        const template = fs.readFileSync(templatePath, "utf8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).setHeader("Content-Type", "text/html").end(html);
      } catch (error) {
        next(error);
      }
    });
  }

  const server = app.listen(PORT, () => {
    console.log(`HealthPulse running at http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    server.close(() => {
      for (const db of userDbCache.values()) {
        db.close();
      }
      userDbCache.clear();
      closeAuthDb();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((error) => {
  console.error("Failed to start HealthPulse", error);
  process.exit(1);
});

function getUserDatabase(dbPath: string): Database.Database {
  const cached = userDbCache.get(dbPath);
  if (cached) {
    return cached;
  }

  const db = openDatabase(dbPath);

  userDbCache.set(dbPath, db);
  return db;
}
